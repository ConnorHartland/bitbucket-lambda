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
export declare class Logger {
    private requestId;
    private eventType?;
    constructor(requestId: string, eventType?: string);
    /**
     * Sanitize sensitive information from a string
     * Redacts: signatures, tokens, secrets, API keys, and webhook URLs
     *
     * @param value The string to sanitize
     * @returns The sanitized string with sensitive data redacted
     */
    private sanitize;
    /**
     * Sanitize an object recursively
     *
     * @param obj The object to sanitize
     * @returns A new object with sensitive data redacted
     */
    private sanitizeObject;
    /**
     * Format a log message with context
     *
     * @param level The log level
     * @param message The log message
     * @param context Additional context to include
     * @returns Formatted log message
     */
    private formatMessage;
    /**
     * Log an info level message
     *
     * @param message The message to log
     * @param context Optional context to include
     */
    info(message: string, context?: LogContext): void;
    /**
     * Log a warning level message
     *
     * @param message The message to log
     * @param context Optional context to include
     */
    warn(message: string, context?: LogContext): void;
    /**
     * Log an error level message
     *
     * @param message The message to log
     * @param context Optional context to include
     */
    error(message: string, context?: LogContext): void;
}
//# sourceMappingURL=logger.d.ts.map