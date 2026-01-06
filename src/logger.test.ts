/**
 * Tests for structured logging with sanitization
 */

import { Logger } from './logger';
import * as fc from 'fast-check';

describe('Logger', () => {
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('Basic Logging', () => {
    it('should log info messages', () => {
      const logger = new Logger('req-123', 'push');
      logger.info('Test message');

      expect(consoleLogSpy).toHaveBeenCalledTimes(1);
      const logOutput = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);

      expect(parsed.level).toBe('INFO');
      expect(parsed.message).toBe('Test message');
      expect(parsed.requestId).toBe('req-123');
      expect(parsed.eventType).toBe('push');
    });

    it('should log warn messages', () => {
      const logger = new Logger('req-456', 'pull_request');
      logger.warn('Warning message');

      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      const logOutput = consoleWarnSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);

      expect(parsed.level).toBe('WARN');
      expect(parsed.message).toBe('Warning message');
      expect(parsed.requestId).toBe('req-456');
      expect(parsed.eventType).toBe('pull_request');
    });

    it('should log error messages', () => {
      const logger = new Logger('req-789');
      logger.error('Error message');

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const logOutput = consoleErrorSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);

      expect(parsed.level).toBe('ERROR');
      expect(parsed.message).toBe('Error message');
      expect(parsed.requestId).toBe('req-789');
    });

    it('should include timestamp in all logs', () => {
      const logger = new Logger('req-123');
      logger.info('Test');

      const logOutput = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);

      expect(parsed.timestamp).toBeDefined();
      expect(typeof parsed.timestamp).toBe('string');
      // Verify it's a valid ISO timestamp
      expect(new Date(parsed.timestamp).getTime()).toBeGreaterThan(0);
    });
  });

  describe('Context Inclusion', () => {
    it('should include additional context in logs', () => {
      const logger = new Logger('req-123', 'push');
      logger.info('Test message', { userId: 'user-456', action: 'deploy' });

      const logOutput = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);

      expect(parsed.userId).toBe('user-456');
      expect(parsed.action).toBe('deploy');
    });

    it('should include error details in context', () => {
      const logger = new Logger('req-123');
      const error = new Error('Test error');
      logger.error('An error occurred', { errorMessage: error.message, errorStack: error.stack });

      const logOutput = consoleErrorSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);

      expect(parsed.errorMessage).toBe('Test error');
      expect(parsed.errorStack).toBeDefined();
    });
  });

  describe('Sanitization - Signatures', () => {
    it('should redact HMAC signatures in messages', () => {
      const logger = new Logger('req-123');
      logger.info('Signature: sha256=abc123def456');

      const logOutput = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);

      expect(parsed.message).toContain('[REDACTED]');
      expect(parsed.message).not.toContain('abc123def456');
    });

    it('should redact signatures in context', () => {
      const logger = new Logger('req-123');
      logger.info('Webhook received', { signature: 'sha256=abc123def456' });

      const logOutput = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);

      expect(parsed.signature).toBe('[REDACTED]');
    });

    it('should redact multiple signatures', () => {
      const logger = new Logger('req-123');
      logger.info('Signatures: sha256=abc123 and sha256=def456');

      const logOutput = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);

      expect(parsed.message).not.toContain('abc123');
      expect(parsed.message).not.toContain('def456');
      expect(parsed.message).toContain('[REDACTED]');
    });
  });

  describe('Sanitization - Secrets', () => {
    it('should redact AWS secret ARNs', () => {
      const logger = new Logger('req-123');
      logger.info('Using secret arn:aws:secretsmanager:us-east-1:123456789012:secret:my-secret');

      const logOutput = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);

      expect(parsed.message).not.toContain('my-secret');
      expect(parsed.message).toContain('[REDACTED]');
    });

    it('should redact secret keys in context', () => {
      const logger = new Logger('req-123');
      logger.info('Processing', { secret: 'super-secret-value' });

      const logOutput = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);

      expect(parsed.secret).toBe('[REDACTED]');
    });

    it('should redact API keys', () => {
      const logger = new Logger('req-123');
      logger.info('API key: sk_live_abc123def456');

      const logOutput = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);

      expect(parsed.message).not.toContain('sk_live_abc123def456');
      expect(parsed.message).toContain('[REDACTED]');
    });
  });

  describe('Sanitization - Tokens', () => {
    it('should redact bearer tokens', () => {
      const logger = new Logger('req-123');
      logger.info('Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');

      const logOutput = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);

      expect(parsed.message).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
      expect(parsed.message).toContain('[REDACTED]');
    });

    it('should redact authorization headers in context', () => {
      const logger = new Logger('req-123');
      logger.info('Request', { authorization: 'Bearer token123' });

      const logOutput = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);

      expect(parsed.authorization).toBe('[REDACTED]');
    });
  });

  describe('Sanitization - Webhook URLs', () => {
    it('should redact webhook URLs', () => {
      const logger = new Logger('req-123');
      logger.info('Posting to https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX');

      const logOutput = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);

      expect(parsed.message).not.toContain('XXXXXXXXXXXXXXXXXXXX');
      expect(parsed.message).toContain('[REDACTED_WEBHOOK_URL]');
    });

    it('should redact webhook URLs in context', () => {
      const logger = new Logger('req-123');
      logger.info('Config', { webhookUrl: 'https://hooks.teams.com/webhook/abc123' });

      const logOutput = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);

      expect(parsed.webhookUrl).toContain('[REDACTED_WEBHOOK_URL]');
    });
  });

  describe('Sanitization - Nested Objects', () => {
    it('should sanitize nested objects', () => {
      const logger = new Logger('req-123');
      logger.info('Processing', {
        user: {
          id: 'user-123',
          token: 'secret-token-abc',
        },
      });

      const logOutput = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);

      expect(parsed.user.id).toBe('user-123');
      expect(parsed.user.token).toBe('[REDACTED]');
    });

    it('should sanitize arrays of objects', () => {
      const logger = new Logger('req-123');
      logger.info('Processing', {
        items: [
          { id: 'item-1', secret: 'secret-1' },
          { id: 'item-2', secret: 'secret-2' },
        ],
      });

      const logOutput = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);

      expect(parsed.items[0].id).toBe('item-1');
      expect(parsed.items[0].secret).toBe('[REDACTED]');
      expect(parsed.items[1].id).toBe('item-2');
      expect(parsed.items[1].secret).toBe('[REDACTED]');
    });
  });

  describe('Property Tests', () => {
    it('should log JSON parsing errors with request ID and event type', () => {
      fc.assert(
        fc.property(fc.string(), fc.string(), (requestId, eventType) => {
          const logger = new Logger(requestId, eventType);
          logger.error('JSON parsing failed', { error: 'Unexpected token' });

          const logOutput = consoleErrorSpy.mock.calls[consoleErrorSpy.mock.calls.length - 1][0];
          const parsed = JSON.parse(logOutput);

          expect(parsed.requestId).toBe(requestId);
          expect(parsed.eventType).toBe(eventType);
          expect(parsed.level).toBe('ERROR');
        }),
        { numRuns: 100 }
      );
    });

    it('should log AWS service errors with request ID and event type', () => {
      fc.assert(
        fc.property(fc.string(), fc.string(), (requestId, eventType) => {
          const logger = new Logger(requestId, eventType);
          logger.error('AWS service error', { service: 'SecretsManager', code: 'AccessDenied' });

          const logOutput = consoleErrorSpy.mock.calls[consoleErrorSpy.mock.calls.length - 1][0];
          const parsed = JSON.parse(logOutput);

          expect(parsed.requestId).toBe(requestId);
          expect(parsed.eventType).toBe(eventType);
          expect(parsed.level).toBe('ERROR');
        }),
        { numRuns: 100 }
      );
    });

    it('should log Teams API errors with request ID and event type', () => {
      fc.assert(
        fc.property(fc.string(), fc.string(), (requestId, eventType) => {
          const logger = new Logger(requestId, eventType);
          logger.error('Teams API error', { statusCode: 400, message: 'Invalid payload' });

          const logOutput = consoleErrorSpy.mock.calls[consoleErrorSpy.mock.calls.length - 1][0];
          const parsed = JSON.parse(logOutput);

          expect(parsed.requestId).toBe(requestId);
          expect(parsed.eventType).toBe(eventType);
          expect(parsed.level).toBe('ERROR');
        }),
        { numRuns: 100 }
      );
    });

    it('should sanitize all sensitive information in logs', () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.string(),
          fc.hexaString({ minLength: 10, maxLength: 50 }),
          (requestId, eventType, sensitiveData) => {
            const logger = new Logger(requestId, eventType);
            logger.info('Processing', {
              signature: `sha256=${sensitiveData}`,
              secret: sensitiveData,
              token: `Bearer ${sensitiveData}`,
            });

            const logOutput = consoleLogSpy.mock.calls[consoleLogSpy.mock.calls.length - 1][0];
            const parsed = JSON.parse(logOutput);

            // Verify sensitive data is not in the output
            const logString = JSON.stringify(parsed);
            expect(logString).not.toContain(sensitiveData);
            expect(parsed.signature).toBe('[REDACTED]');
            expect(parsed.secret).toBe('[REDACTED]');
            expect(parsed.token).toBe('[REDACTED]');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
