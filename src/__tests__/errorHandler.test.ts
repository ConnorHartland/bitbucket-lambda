/**
 * Tests for Error Handling Module
 * Property-based tests using fast-check
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7
 */

import fc from 'fast-check';
import {
  handleError,
  createErrorResponse,
  validateJsonPayload,
  JsonParsingError,
  SignatureVerificationError,
  ConfigurationError,
  AwsServiceError,
  NetworkError
} from '../utils/errorHandler';

// Mock the logging module
jest.mock('../utils/logging', () => ({
  logWithContext: jest.fn()
}));

describe('Error Handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Error Classes', () => {
    it('should create JsonParsingError', () => {
      const error = new JsonParsingError('Invalid JSON');
      expect(error.name).toBe('JsonParsingError');
      expect(error.message).toBe('Invalid JSON');
    });

    it('should create SignatureVerificationError', () => {
      const error = new SignatureVerificationError('Signature mismatch');
      expect(error.name).toBe('SignatureVerificationError');
      expect(error.message).toBe('Signature mismatch');
    });

    it('should create ConfigurationError', () => {
      const error = new ConfigurationError('Missing config');
      expect(error.name).toBe('ConfigurationError');
      expect(error.message).toBe('Missing config');
    });

    it('should create AwsServiceError', () => {
      const error = new AwsServiceError('AWS error');
      expect(error.name).toBe('AwsServiceError');
      expect(error.message).toBe('AWS error');
    });

    it('should create NetworkError', () => {
      const error = new NetworkError('Connection failed');
      expect(error.name).toBe('NetworkError');
      expect(error.message).toBe('Connection failed');
    });
  });

  describe('handleJsonParsingError', () => {
    it('should return 400 status code for JSON parsing errors', () => {
      const error = new JsonParsingError('Invalid JSON');
      const response = handleError(error);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('Invalid JSON payload');
    });

    it('Property 35: JSON Error Response', () => {
      fc.assert(
        fc.property(fc.string(), fc.string({ minLength: 1 }), (errorMsg: string, requestId: string) => {
          const error = new JsonParsingError(errorMsg);
          const response = handleError(error, requestId);

          expect(response.statusCode).toBe(400);
          const body = JSON.parse(response.body);
          expect(body.message).toBe('Invalid JSON payload');
          expect(body.requestId).toBe(requestId);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('handleSignatureVerificationError', () => {
    it('should return 401 status code', () => {
      const error = new SignatureVerificationError('Signature mismatch');
      const response = handleError(error);

      expect(response.statusCode).toBe(401);
    });

    it('should return "Unauthorized" message', () => {
      const error = new SignatureVerificationError('Signature mismatch');
      const response = handleError(error);

      const body = JSON.parse(response.body);
      expect(body.message).toBe('Unauthorized');
    });

    it('should include request ID in response', () => {
      const error = new SignatureVerificationError('Signature mismatch');
      const requestId = 'req-456';
      const response = handleError(error, requestId);

      const body = JSON.parse(response.body);
      expect(body.requestId).toBe(requestId);
    });

    it('Property 36: Signature Error Response', () => {
      fc.assert(
        fc.property(fc.string(), fc.string(), (errorMsg: string, requestId: string) => {
          const error = new SignatureVerificationError(errorMsg);
          const response = handleError(error, requestId);

          expect(response.statusCode).toBe(401);
          const body = JSON.parse(response.body);
          expect(body.message).toBe('Unauthorized');
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('handleConfigurationError', () => {
    it('should return 500 status code', () => {
      const error = new ConfigurationError('Missing config');
      const response = handleError(error);

      expect(response.statusCode).toBe(500);
    });

    it('should return "Server configuration error" message', () => {
      const error = new ConfigurationError('Missing config');
      const response = handleError(error);

      const body = JSON.parse(response.body);
      expect(body.message).toBe('Server configuration error');
    });

    it('should include request ID in response', () => {
      const error = new ConfigurationError('Missing config');
      const requestId = 'req-789';
      const response = handleError(error, requestId);

      const body = JSON.parse(response.body);
      expect(body.requestId).toBe(requestId);
    });

    it('Property 37: Configuration Error Response', () => {
      fc.assert(
        fc.property(fc.string(), fc.string(), (errorMsg: string, requestId: string) => {
          const error = new ConfigurationError(errorMsg);
          const response = handleError(error, requestId);

          expect(response.statusCode).toBe(500);
          const body = JSON.parse(response.body);
          expect(body.message).toBe('Server configuration error');
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('handleAwsServiceError', () => {
    it('should return 500 status code', () => {
      const error = new AwsServiceError('AWS error');
      const response = handleError(error);

      expect(response.statusCode).toBe(500);
    });

    it('should return "Service configuration error" message', () => {
      const error = new AwsServiceError('AWS error');
      const response = handleError(error);

      const body = JSON.parse(response.body);
      expect(body.message).toBe('Service configuration error');
    });

    it('should include request ID in response', () => {
      const error = new AwsServiceError('AWS error');
      const requestId = 'req-aws';
      const response = handleError(error, requestId);

      const body = JSON.parse(response.body);
      expect(body.requestId).toBe(requestId);
    });

    it('Property 38: AWS Error Response', () => {
      fc.assert(
        fc.property(fc.string(), fc.string(), (errorMsg: string, requestId: string) => {
          const error = new AwsServiceError(errorMsg);
          const response = handleError(error, requestId);

          expect(response.statusCode).toBe(500);
          const body = JSON.parse(response.body);
          expect(body.message).toBe('Service configuration error');
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('handleNetworkError', () => {
    it('should return 500 status code', () => {
      const error = new NetworkError('Connection failed');
      const response = handleError(error);

      expect(response.statusCode).toBe(500);
    });

    it('should return "Service temporarily unavailable" message', () => {
      const error = new NetworkError('Connection failed');
      const response = handleError(error);

      const body = JSON.parse(response.body);
      expect(body.message).toBe('Service temporarily unavailable');
    });

    it('should include request ID in response', () => {
      const error = new NetworkError('Connection failed');
      const requestId = 'req-net';
      const response = handleError(error, requestId);

      const body = JSON.parse(response.body);
      expect(body.requestId).toBe(requestId);
    });

    it('Property 39: Network Error Response', () => {
      fc.assert(
        fc.property(fc.string(), fc.string(), (errorMsg: string, requestId: string) => {
          const error = new NetworkError(errorMsg);
          const response = handleError(error, requestId);

          expect(response.statusCode).toBe(500);
          const body = JSON.parse(response.body);
          expect(body.message).toBe('Service temporarily unavailable');
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('handleUnexpectedError', () => {
    it('should return 500 status code', () => {
      const error = new Error('Unexpected error');
      const response = handleError(error);

      expect(response.statusCode).toBe(500);
    });

    it('should return "Internal server error" message', () => {
      const error = new Error('Unexpected error');
      const response = handleError(error);

      const body = JSON.parse(response.body);
      expect(body.message).toBe('Internal server error');
    });

    it('should include request ID in response', () => {
      const error = new Error('Unexpected error');
      const requestId = 'req-unexpected';
      const response = handleError(error, requestId);

      const body = JSON.parse(response.body);
      expect(body.requestId).toBe(requestId);
    });

    it('Property 40: Unexpected Error Response', () => {
      fc.assert(
        fc.property(fc.string(), fc.string(), (errorMsg: string, requestId: string) => {
          const error = new Error(errorMsg);
          const response = handleError(error, requestId);

          expect(response.statusCode).toBe(500);
          const body = JSON.parse(response.body);
          expect(body.message).toBe('Internal server error');
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('handleError', () => {
    it('should route JsonParsingError to handleJsonParsingError', () => {
      const error = new JsonParsingError('Invalid JSON');
      const response = handleError(error);

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('Invalid JSON payload');
    });

    it('should route SignatureVerificationError to handleSignatureVerificationError', () => {
      const error = new SignatureVerificationError('Signature mismatch');
      const response = handleError(error);

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('Unauthorized');
    });

    it('should route ConfigurationError to handleConfigurationError', () => {
      const error = new ConfigurationError('Missing config');
      const response = handleError(error);

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('Server configuration error');
    });

    it('should route AwsServiceError to handleAwsServiceError', () => {
      const error = new AwsServiceError('AWS error');
      const response = handleError(error);

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('Service configuration error');
    });

    it('should route NetworkError to handleNetworkError', () => {
      const error = new NetworkError('Connection failed');
      const response = handleError(error);

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('Service temporarily unavailable');
    });

    it('should detect AWS SDK errors by Code property', () => {
      const error = new Error('AWS error');
      (error as any).Code = 'AccessDenied';
      const response = handleError(error);

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('Service configuration error');
    });

    it('should detect network errors by ECONNREFUSED', () => {
      const error = new Error('ECONNREFUSED: Connection refused');
      const response = handleError(error);

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('Service temporarily unavailable');
    });

    it('should detect network errors by ENOTFOUND', () => {
      const error = new Error('ENOTFOUND: getaddrinfo ENOTFOUND');
      const response = handleError(error);

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('Service temporarily unavailable');
    });

    it('should detect network errors by ETIMEDOUT', () => {
      const error = new Error('ETIMEDOUT: Connection timed out');
      const response = handleError(error);

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('Service temporarily unavailable');
    });

    it('should detect network errors by timeout keyword', () => {
      const error = new Error('Request timeout');
      const response = handleError(error);

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('Service temporarily unavailable');
    });

    it('should default to unexpected error for unknown errors', () => {
      const error = new Error('Unknown error');
      const response = handleError(error);

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('Internal server error');
    });
  });

  describe('createErrorResponse', () => {
    it('should create error response with status code and message', () => {
      const response = createErrorResponse(400, 'Bad request');

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.message).toBe('Bad request');
      expect(body.statusCode).toBe(400);
    });

    it('should include timestamp in response', () => {
      const response = createErrorResponse(400, 'Bad request');

      const body = JSON.parse(response.body);
      expect(body.timestamp).toBeDefined();
      expect(typeof body.timestamp).toBe('string');
    });

    it('should include request ID if provided', () => {
      const response = createErrorResponse(400, 'Bad request', 'req-123');

      const body = JSON.parse(response.body);
      expect(body.requestId).toBe('req-123');
    });

    it('should include event type if provided', () => {
      const response = createErrorResponse(400, 'Bad request', undefined, 'repo:push');

      const body = JSON.parse(response.body);
      expect(body.eventType).toBe('repo:push');
    });

    it('should include both request ID and event type if provided', () => {
      const response = createErrorResponse(400, 'Bad request', 'req-123', 'repo:push');

      const body = JSON.parse(response.body);
      expect(body.requestId).toBe('req-123');
      expect(body.eventType).toBe('repo:push');
    });
  });

  describe('validateJsonPayload', () => {
    it('should parse valid JSON', () => {
      const json = JSON.stringify({ event: 'push', repository: 'test' });
      const result = validateJsonPayload(json);

      expect(result.event).toBe('push');
      expect(result.repository).toBe('test');
    });

    it('should throw JsonParsingError for invalid JSON', () => {
      const invalidJson = '{ invalid json }';

      expect(() => validateJsonPayload(invalidJson)).toThrow(JsonParsingError);
    });

    it('should throw JsonParsingError with descriptive message', () => {
      const invalidJson = '{ invalid json }';

      expect(() => validateJsonPayload(invalidJson)).toThrow(/Invalid JSON/);
    });

    it('should handle empty JSON object', () => {
      const json = '{}';
      const result = validateJsonPayload(json);

      expect(result).toEqual({});
    });

    it('should handle JSON arrays', () => {
      const json = '[1, 2, 3]';
      const result = validateJsonPayload(json);

      expect(result).toEqual([1, 2, 3]);
    });

    it('should handle nested JSON', () => {
      const json = JSON.stringify({
        event: 'push',
        repository: { name: 'test', owner: 'user' }
      });
      const result = validateJsonPayload(json);

      expect(result.repository.name).toBe('test');
      expect(result.repository.owner).toBe('user');
    });

    it('Property 3: Invalid JSON Rejected with 400', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }).filter((s) => {
            try {
              JSON.parse(s);
              return false;
            } catch {
              return true;
            }
          }),
          (invalidJson: string) => {
            expect(() => validateJsonPayload(invalidJson)).toThrow(JsonParsingError);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Error Logging with Context', () => {
    it('should log error with request ID and event type', () => {
      const { logWithContext } = require('../utils/logging');
      const error = new JsonParsingError('Invalid JSON');
      const requestId = 'req-123';
      const eventType = 'repo:push';

      handleError(error, requestId, eventType);

      expect(logWithContext).toHaveBeenCalledWith(
        'error',
        expect.stringContaining('JsonParsingError'),
        requestId,
        eventType,
        expect.any(Object)
      );
    });

    it('Property 41: Error Logging with Context', () => {
      const { logWithContext } = require('../utils/logging');

      fc.assert(
        fc.property(
          fc.string(),
          fc.string(),
          fc.string(),
          (errorMsg: string, requestId: string, eventType: string) => {
            jest.clearAllMocks();
            const error = new Error(errorMsg);
            handleError(error, requestId, eventType);

            expect(logWithContext).toHaveBeenCalled();
            const call = (logWithContext as jest.Mock).mock.calls[0];
            expect(call[0]).toBe('error');
            expect(call[2]).toBe(requestId);
            expect(call[3]).toBe(eventType);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
