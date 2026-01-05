/**
 * Logging Utilities Module
 * Provides structured logging with context and sanitization
 * Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6
 */

const SENSITIVE_PATTERNS: RegExp[] = [
  /sha256=[a-f0-9]{64}/gi,
  /Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi,
  /password\s*[:=]\s*[^\s,}]+/gi,
  /secret\s*[:=]\s*[^\s,}]+/gi,
  /token\s*[:=]\s*[^\s,}]+/gi,
  /arn:aws:[^:]+:[^:]*:[^:]*:[^/\s]+/gi
];

export function sanitizeLogMessage(message: string, sensitivePatterns?: RegExp[]): string {
  const patterns = sensitivePatterns || SENSITIVE_PATTERNS;
  return patterns.reduce((sanitized, pattern) => sanitized.replace(pattern, '[REDACTED]'), message);
}

export function logWithContext(
  level: string,
  message: string,
  requestId?: string,
  eventType?: string,
  context?: Record<string, any>
): void {
  const logEntry: Record<string, any> = {
    timestamp: new Date().toISOString(),
    level,
    message: sanitizeLogMessage(message),
    ...(requestId && { request_id: requestId }),
    ...(eventType && { event_type: eventType })
  };

  if (context) {
    Object.entries(context).forEach(([key, value]) => {
      logEntry[key] =
        typeof value === 'string'
          ? sanitizeLogMessage(value)
          : typeof value === 'object' && value !== null
            ? sanitizeLogMessage(JSON.stringify(value))
            : value;
    });
  }

  const logOutput = JSON.stringify(logEntry);
  const logFn = { ERROR: console.error, WARN: console.warn, DEBUG: console.debug }[level.toUpperCase()] || console.log;
  logFn(logOutput);
}

export const logger = {
  info: (message: string, requestId?: string, eventType?: string, context?: Record<string, any>) =>
    logWithContext('INFO', message, requestId, eventType, context),
  error: (message: string, requestId?: string, eventType?: string, context?: Record<string, any>) =>
    logWithContext('ERROR', message, requestId, eventType, context),
  warn: (message: string, requestId?: string, eventType?: string, context?: Record<string, any>) =>
    logWithContext('WARN', message, requestId, eventType, context),
  debug: (message: string, requestId?: string, eventType?: string, context?: Record<string, any>) =>
    logWithContext('DEBUG', message, requestId, eventType, context)
};
