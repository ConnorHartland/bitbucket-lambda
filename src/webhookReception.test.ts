/**
 * Tests for Webhook Reception Module
 * Property-based tests using fast-check
 * Validates: Requirements 1.1, 1.2, 1.3, 1.4
 */

import fc from 'fast-check';
import { extractWebhookEvent, getRequestId, APIGatewayProxyEvent } from './webhookReception';

describe('Webhook Reception', () => {
  describe('extractWebhookEvent', () => {
    it('should extract all required fields from a valid event', () => {
      const event: APIGatewayProxyEvent = {
        headers: {
          'X-Event-Key': 'repo:push',
          'X-Hub-Signature': 'sha256=abc123def456'
        },
        body: '{"repository": "test"}',
        isBase64Encoded: false
      };

      const result = extractWebhookEvent(event);

      expect(result.eventType).toBe('repo:push');
      expect(result.signature).toBe('sha256=abc123def456');
      expect(result.body).toBe('{"repository": "test"}');
    });

    it('should handle case-insensitive headers', () => {
      const event: APIGatewayProxyEvent = {
        headers: {
          'x-event-key': 'repo:push',
          'x-hub-signature': 'sha256=abc123def456'
        },
        body: '{"repository": "test"}',
        isBase64Encoded: false
      };

      const result = extractWebhookEvent(event);

      expect(result.eventType).toBe('repo:push');
      expect(result.signature).toBe('sha256=abc123def456');
    });

    it('should handle mixed case headers', () => {
      const event: APIGatewayProxyEvent = {
        headers: {
          'X-Event-Key': 'pullrequest:created',
          'X-Hub-Signature': 'sha256=xyz789'
        },
        body: '{"pullrequest": {"id": 1}}',
        isBase64Encoded: false
      };

      const result = extractWebhookEvent(event);

      expect(result.eventType).toBe('pullrequest:created');
      expect(result.signature).toBe('sha256=xyz789');
    });

    it('should decode base64 encoded body', () => {
      const originalBody = '{"repository": "test", "action": "push"}';
      const encodedBody = Buffer.from(originalBody).toString('base64');

      const event: APIGatewayProxyEvent = {
        headers: {
          'X-Event-Key': 'repo:push',
          'X-Hub-Signature': 'sha256=abc123'
        },
        body: encodedBody,
        isBase64Encoded: true
      };

      const result = extractWebhookEvent(event);

      expect(result.body).toBe(originalBody);
    });

    it('should handle empty body', () => {
      const event: APIGatewayProxyEvent = {
        headers: {
          'X-Event-Key': 'repo:push',
          'X-Hub-Signature': 'sha256=abc123'
        },
        body: '',
        isBase64Encoded: false
      };

      const result = extractWebhookEvent(event);

      expect(result.body).toBe('');
    });

    it('should handle null body', () => {
      const event: APIGatewayProxyEvent = {
        headers: {
          'X-Event-Key': 'repo:push',
          'X-Hub-Signature': 'sha256=abc123'
        },
        body: null,
        isBase64Encoded: false
      };

      const result = extractWebhookEvent(event);

      expect(result.body).toBe('');
    });

    it('should throw error when X-Event-Key is missing', () => {
      const event: APIGatewayProxyEvent = {
        headers: {
          'X-Hub-Signature': 'sha256=abc123'
        },
        body: '{}',
        isBase64Encoded: false
      };

      expect(() => extractWebhookEvent(event)).toThrow('Missing X-Event-Key header');
    });

    it('should throw error when X-Hub-Signature is missing', () => {
      const event: APIGatewayProxyEvent = {
        headers: {
          'X-Event-Key': 'repo:push'
        },
        body: '{}',
        isBase64Encoded: false
      };

      expect(() => extractWebhookEvent(event)).toThrow('Missing X-Hub-Signature header');
    });

    it('should throw error when both headers are missing', () => {
      const event: APIGatewayProxyEvent = {
        headers: {},
        body: '{}',
        isBase64Encoded: false
      };

      expect(() => extractWebhookEvent(event)).toThrow('Missing X-Event-Key header');
    });

    it('should handle empty headers object', () => {
      const event: APIGatewayProxyEvent = {
        headers: {},
        body: '{}',
        isBase64Encoded: false
      };

      expect(() => extractWebhookEvent(event)).toThrow();
    });

    // Property 1: Webhook Reception Extracts All Required Fields
    // For any API Gateway proxy event with valid headers and body,
    // the system SHALL extract the event type, signature, and body without loss of information
    it('Property 1: Webhook Reception Extracts All Required Fields', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 0, maxLength: 1000 }),
          (eventType: string, signature: string, body: string) => {
            const event: APIGatewayProxyEvent = {
              headers: {
                'X-Event-Key': eventType,
                'X-Hub-Signature': signature
              },
              body,
              isBase64Encoded: false
            };

            const result = extractWebhookEvent(event);

            expect(result.eventType).toBe(eventType);
            expect(result.signature).toBe(signature);
            expect(result.body).toBe(body);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property 2: Base64 Decoding Round Trip
    // For any valid payload, if it is base64 encoded in the event,
    // the system SHALL decode it to produce the original payload
    it('Property 2: Base64 Decoding Round Trip', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 1000 }),
          (originalBody: string) => {
            const encodedBody = Buffer.from(originalBody).toString('base64');

            const event: APIGatewayProxyEvent = {
              headers: {
                'X-Event-Key': 'repo:push',
                'X-Hub-Signature': 'sha256=abc123'
              },
              body: encodedBody,
              isBase64Encoded: true
            };

            const result = extractWebhookEvent(event);

            expect(result.body).toBe(originalBody);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('getRequestId', () => {
    it('should extract request ID from event context', () => {
      const event: APIGatewayProxyEvent = {
        headers: {},
        body: '{}',
        isBase64Encoded: false,
        requestContext: {
          requestId: 'test-request-id-123'
        }
      };

      const requestId = getRequestId(event);

      expect(requestId).toBe('test-request-id-123');
    });

    it('should return "unknown" when request ID is not available', () => {
      const event: APIGatewayProxyEvent = {
        headers: {},
        body: '{}',
        isBase64Encoded: false
      };

      const requestId = getRequestId(event);

      expect(requestId).toBe('unknown');
    });

    it('should return "unknown" when requestContext is missing', () => {
      const event: APIGatewayProxyEvent = {
        headers: {},
        body: '{}',
        isBase64Encoded: false,
        requestContext: undefined
      };

      const requestId = getRequestId(event);

      expect(requestId).toBe('unknown');
    });
  });
});
