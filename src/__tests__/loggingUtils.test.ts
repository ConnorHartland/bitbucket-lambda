/**
 * Tests for Logging Utilities Module
 * Property-based tests using fast-check
 */

import fc from 'fast-check';
import { sanitizeLogMessage, logWithContext, logger } from '../utils/logging';

describe('sanitizeLogMessage', () => {
  it('should redact webhook signatures', () => {
    const message = 'Signature verification failed: sha256=abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789';
    const sanitized = sanitizeLogMessage(message);

    expect(sanitized).toContain('[REDACTED]');
    expect(sanitized).not.toContain('abcdef0123456789');
  });

  it('should redact bearer tokens', () => {
    const message = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
    const sanitized = sanitizeLogMessage(message);

    expect(sanitized).toContain('[REDACTED]');
    expect(sanitized).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
  });

  it('should redact passwords', () => {
    const message = 'Database connection: password=super_secret_password';
    const sanitized = sanitizeLogMessage(message);

    expect(sanitized).toContain('[REDACTED]');
    expect(sanitized).not.toContain('super_secret_password');
  });

  it('should redact secrets', () => {
    const message = 'AWS secret: secret=my-secret-value';
    const sanitized = sanitizeLogMessage(message);

    expect(sanitized).toContain('[REDACTED]');
    expect(sanitized).not.toContain('my-secret-value');
  });

  it('should redact tokens', () => {
    const message = 'API token: token=abc123def456';
    const sanitized = sanitizeLogMessage(message);

    expect(sanitized).toContain('[REDACTED]');
    expect(sanitized).not.toContain('abc123def456');
  });

  it('should redact AWS ARNs', () => {
    const message = 'Secret ARN: arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret';
    const sanitized = sanitizeLogMessage(message);

    expect(sanitized).toContain('[REDACTED]');
    expect(sanitized).not.toContain('arn:aws:secretsmanager');
  });

  it('should handle multiple sensitive patterns in one message', () => {
    const message =
      'Failed: sha256=abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789 and token=secret123';
    const sanitized = sanitizeLogMessage(message);

    expect(sanitized).toContain('[REDACTED]');
    expect(sanitized).not.toContain('abcdef0123456789');
    expect(sanitized).not.toContain('secret123');
  });

  it('should not redact non-sensitive content', () => {
    const message = 'Processing pull request event for repository my-repo';
    const sanitized = sanitizeLogMessage(message);

    expect(sanitized).toBe(message);
  });

  // Property 46: Log Sanitization
  // For any log message containing sensitive information (signatures, tokens, secrets),
  // the system SHALL redact the sensitive data
  it('Property 46: Log Sanitization', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant('sha256=abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'),
          fc.constant('Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'),
          fc.constant('password=secret123'),
          fc.constant('secret=my-secret'),
          fc.constant('token=abc123')
        ),
        (sensitiveData: string) => {
          const message = `Processing with ${sensitiveData}`;
          const sanitized = sanitizeLogMessage(message);

          // Sanitized message should contain [REDACTED]
          expect(sanitized).toContain('[REDACTED]');
          // Sanitized message should not contain the original sensitive data
          expect(sanitized).not.toContain(sensitiveData);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('logWithContext', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('should log with INFO level', () => {
    logWithContext('INFO', 'Test message');

    expect(consoleLogSpy).toHaveBeenCalled();
    const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(logOutput.level).toBe('INFO');
    expect(logOutput.message).toBe('Test message');
  });

  it('should log with ERROR level', () => {
    logWithContext('ERROR', 'Error message');

    expect(consoleErrorSpy).toHaveBeenCalled();
    const logOutput = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
    expect(logOutput.level).toBe('ERROR');
    expect(logOutput.message).toBe('Error message');
  });

  it('should log with WARN level', () => {
    logWithContext('WARN', 'Warning message');

    expect(consoleWarnSpy).toHaveBeenCalled();
    const logOutput = JSON.parse(consoleWarnSpy.mock.calls[0][0]);
    expect(logOutput.level).toBe('WARN');
    expect(logOutput.message).toBe('Warning message');
  });

  // Property 42: Major Steps Logging
  // For any successful webhook processing, the system SHALL log all major processing steps
  it('Property 42: Major Steps Logging', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant('Configuration loaded'),
          fc.constant('Signature verified'),
          fc.constant('Event parsed'),
          fc.constant('Message formatted'),
          fc.constant('Posted to Teams')
        ),
        (step: string) => {
          logWithContext('INFO', step);

          expect(consoleLogSpy).toHaveBeenCalled();
          const logOutput = JSON.parse(consoleLogSpy.mock.calls[consoleLogSpy.mock.calls.length - 1][0]);
          expect(logOutput.message).toBe(step);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Property 43: Request ID in Logs
  // For any log entry, the system SHALL include the request ID for request correlation
  it('Property 43: Request ID in Logs', () => {
    fc.assert(
      fc.property(fc.uuid(), (requestId: string) => {
        logWithContext('INFO', 'Test message', requestId);

        expect(consoleLogSpy).toHaveBeenCalled();
        const logOutput = JSON.parse(consoleLogSpy.mock.calls[consoleLogSpy.mock.calls.length - 1][0]);
        expect(logOutput.request_id).toBe(requestId);
      }),
      { numRuns: 100 }
    );
  });

  // Property 44: Event Type in Logs
  // For any log entry, the system SHALL include the event type for event tracking
  it('Property 44: Event Type in Logs', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (eventType: string) => {
        logWithContext('INFO', 'Test message', undefined, eventType);

        expect(consoleLogSpy).toHaveBeenCalled();
        const logOutput = JSON.parse(consoleLogSpy.mock.calls[consoleLogSpy.mock.calls.length - 1][0]);
        expect(logOutput.event_type).toBe(eventType);
      }),
      { numRuns: 100 }
    );
  });

  // Property 45: Repository in Logs
  // For any log entry related to event processing, the system SHALL include the repository name
  it('Property 45: Repository in Logs', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (repository: string) => {
        logWithContext('INFO', 'Processing event', undefined, 'repo:push', {
          repository
        });

        expect(consoleLogSpy).toHaveBeenCalled();
        const logOutput = JSON.parse(consoleLogSpy.mock.calls[consoleLogSpy.mock.calls.length - 1][0]);
        expect(logOutput.repository).toBe(repository);
      }),
      { numRuns: 100 }
    );
  });

  it('should include timestamp in log entry', () => {
    logWithContext('INFO', 'Test message');

    expect(consoleLogSpy).toHaveBeenCalled();
    const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(logOutput.timestamp).toBeDefined();
    expect(new Date(logOutput.timestamp)).toBeInstanceOf(Date);
  });

  it('should include additional context in log entry', () => {
    logWithContext('INFO', 'Test message', undefined, undefined, {
      action: 'created',
      author: 'john-doe'
    });

    expect(consoleLogSpy).toHaveBeenCalled();
    const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(logOutput.action).toBe('created');
    expect(logOutput.author).toBe('john-doe');
  });

  it('should sanitize context values', () => {
    logWithContext('INFO', 'Test message', undefined, undefined, {
      secret: 'secret=my-secret-value'
    });

    expect(consoleLogSpy).toHaveBeenCalled();
    const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(logOutput.secret).toContain('[REDACTED]');
  });

  // Property 47: Error Type Logging
  // For any error, the system SHALL log the error type and message
  it('Property 47: Error Type Logging', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant('SignatureVerificationError'),
          fc.constant('ConfigurationError'),
          fc.constant('AWSServiceError'),
          fc.constant('NetworkError')
        ),
        (errorType: string) => {
          logWithContext('ERROR', `${errorType}: Something went wrong`, undefined, undefined, {
            error_type: errorType
          });

          expect(consoleErrorSpy).toHaveBeenCalled();
          const logOutput = JSON.parse(consoleErrorSpy.mock.calls[consoleErrorSpy.mock.calls.length - 1][0]);
          expect(logOutput.error_type).toBe(errorType);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('logger convenience functions', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  it('should log info messages', () => {
    logger.info('Info message');

    expect(consoleLogSpy).toHaveBeenCalled();
    const logOutput = JSON.parse(consoleLogSpy.mock.calls[0][0]);
    expect(logOutput.level).toBe('INFO');
  });

  it('should log error messages', () => {
    logger.error('Error message');

    expect(consoleErrorSpy).toHaveBeenCalled();
    const logOutput = JSON.parse(consoleErrorSpy.mock.calls[0][0]);
    expect(logOutput.level).toBe('ERROR');
  });

  it('should log warning messages', () => {
    logger.warn('Warning message');

    expect(consoleWarnSpy).toHaveBeenCalled();
    const logOutput = JSON.parse(consoleWarnSpy.mock.calls[0][0]);
    expect(logOutput.level).toBe('WARN');
  });

  it('should log debug messages', () => {
    const consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();
    logger.debug('Debug message');

    expect(consoleDebugSpy).toHaveBeenCalled();
    const logOutput = JSON.parse(consoleDebugSpy.mock.calls[0][0]);
    expect(logOutput.level).toBe('DEBUG');

    consoleDebugSpy.mockRestore();
  });
});
