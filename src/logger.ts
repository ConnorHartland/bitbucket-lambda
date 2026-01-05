/**
 * Structured logging with sanitization for the Bitbucket to Teams webhook integration
 * Redacts sensitive information (signatures, tokens, secrets) from all log messages
 */

export type LogLevel = 'info' | 'warn' | 'error';

/**
 * Context information to include in all log messages
 */
export interface LogContext {
  requestId?: string;
  eventType?: string;
  [key: string]: any;
}

/**
 * Logger class for structured logging with sanitization
 */
export class Logger {
  private requestId: string;
  private eventType?: string;

  constructor(requestId: string, eventType?: string) {
    this.requestId = requestId;
    this.eventType = eventType;
  }

  /**
   * Sanitize sensitive information from a string
   * Redacts: signatures, tokens, secrets, API keys, and webhook URLs
   *
   * @param value The string to sanitize
   * @returns The sanitized string with sensitive data redacted
   */
  private sanitize(value: string): string {
    if (typeof value !== 'string') {
      return value;
    }

    // Redact HMAC signatures (sha256=...)
    let sanitized = value.replace(/sha256=[a-f0-9]+/gi, 'sha256=[REDACTED]');

    // Redact AWS secret ARNs and values
    sanitized = sanitized.replace(/arn:aws:secretsmanager:[^:]+:[^:]+:secret:[^\s"']+/gi, 'arn:aws:secretsmanager:[REDACTED]');

    // Redact AWS secret values (common patterns)
    sanitized = sanitized.replace(/"SecretString"\s*:\s*"[^"]*"/gi, '"SecretString": "[REDACTED]"');

    // Redact webhook URLs (Slack, Teams, etc.)
    sanitized = sanitized.replace(/https?:\/\/[^\s"']*webhook[^\s"']*/gi, 'https://[REDACTED_WEBHOOK_URL]');
    sanitized = sanitized.replace(/https?:\/\/hooks\.[^\s"']+/gi, 'https://[REDACTED_WEBHOOK_URL]');

    // Redact bearer tokens
    sanitized = sanitized.replace(/bearer\s+[^\s"']+/gi, 'bearer [REDACTED]');

    // Redact authorization headers
    sanitized = sanitized.replace(/authorization["\s:]*[^\s"']+/gi, 'authorization: [REDACTED]');

    // Redact API keys (sk_live_*, sk_test_*, etc.)
    sanitized = sanitized.replace(/sk_(?:live|test)_[a-zA-Z0-9]+/gi, 'sk_[REDACTED]');

    // Redact generic secrets
    sanitized = sanitized.replace(/secret["\s:]*[^\s"']+/gi, 'secret: [REDACTED]');

    return sanitized;
  }

  /**
   * Sanitize an object recursively
   *
   * @param obj The object to sanitize
   * @returns A new object with sensitive data redacted
   */
  private sanitizeObject(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.sanitize(obj);
    }

    if (typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item));
    }

    const sanitized: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const value = obj[key];
        // Redact sensitive keys entirely
        if (
          key.toLowerCase().includes('signature') ||
          key.toLowerCase().includes('secret') ||
          key.toLowerCase().includes('token') ||
          key.toLowerCase().includes('password') ||
          key.toLowerCase().includes('key') ||
          key.toLowerCase().includes('authorization')
        ) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = this.sanitizeObject(value);
        }
      }
    }
    return sanitized;
  }

  /**
   * Format a log message with context
   *
   * @param level The log level
   * @param message The log message
   * @param context Additional context to include
   * @returns Formatted log message
   */
  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const sanitizedMessage = this.sanitize(message);
    const sanitizedContext = context ? this.sanitizeObject(context) : {};

    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      requestId: this.requestId,
      eventType: this.eventType,
      message: sanitizedMessage,
      ...sanitizedContext,
    };

    return JSON.stringify(logEntry);
  }

  /**
   * Log an info level message
   *
   * @param message The message to log
   * @param context Optional context to include
   */
  info(message: string, context?: LogContext): void {
    console.log(this.formatMessage('info', message, context));
  }

  /**
   * Log a warning level message
   *
   * @param message The message to log
   * @param context Optional context to include
   */
  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage('warn', message, context));
  }

  /**
   * Log an error level message
   *
   * @param message The message to log
   * @param context Optional context to include
   */
  error(message: string, context?: LogContext): void {
    console.error(this.formatMessage('error', message, context));
  }
}
