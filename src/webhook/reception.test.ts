/**
 * Tests for webhook reception and parsing
 */

import { extractWebhookData, parseWebhookBody } from './reception';
import { APIGatewayProxyEvent } from '../types';
import { Logger } from '../logger';
import * as fc from 'fast-check';

describe('Webhook Reception', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger('test-request-id', 'test-event');
  });

  describe('extractWebhookData', () => {
    it('should extract event type and signature from headers', () => {
      const event: APIGatewayProxyEvent = {
        headers: {
          'X-Event-Key': 'repo:push',
          'X-Hub-Signature': 'sha256=abc123',
        },
        body: '{"test": "data"}',
        isBase64Encoded: false,
        requestContext: {
          requestId: 'test-id',
          identity: {
            sourceIp: '192.168.1.1',
          },
        },
      };

      const result = extractWebhookData(event, logger);

      expect(result).not.toBeNull();
      expect(result?.eventType).toBe('repo:push');
      expect(result?.signature).toBe('sha256=abc123');
      expect(result?.body).toBe('{"test": "data"}');
    });

    it('should handle lowercase header names', () => {
      const event: APIGatewayProxyEvent = {
        headers: {
          'x-event-key': 'repo:push',
          'x-hub-signature': 'sha256=abc123',
        },
        body: '{"test": "data"}',
        isBase64Encoded: false,
        requestContext: {
          requestId: 'test-id',
          identity: {
            sourceIp: '192.168.1.1',
          },
        },
      };

      const result = extractWebhookData(event, logger);

      expect(result).not.toBeNull();
      expect(result?.eventType).toBe('repo:push');
      expect(result?.signature).toBe('sha256=abc123');
    });

    it('should decode base64 encoded body', () => {
      const originalBody = '{"test": "data"}';
      const base64Body = Buffer.from(originalBody).toString('base64');

      const event: APIGatewayProxyEvent = {
        headers: {
          'X-Event-Key': 'repo:push',
          'X-Hub-Signature': 'sha256=abc123',
        },
        body: base64Body,
        isBase64Encoded: true,
        requestContext: {
          requestId: 'test-id',
          identity: {
            sourceIp: '192.168.1.1',
          },
        },
      };

      const result = extractWebhookData(event, logger);

      expect(result).not.toBeNull();
      expect(result?.body).toBe(originalBody);
    });

    it('should return null when X-Event-Key header is missing', () => {
      const event: APIGatewayProxyEvent = {
        headers: {
          'X-Hub-Signature': 'sha256=abc123',
        },
        body: '{"test": "data"}',
        isBase64Encoded: false,
        requestContext: {
          requestId: 'test-id',
          identity: {
            sourceIp: '192.168.1.1',
          },
        },
      };

      const result = extractWebhookData(event, logger);

      expect(result).toBeNull();
    });

    it('should return null when X-Hub-Signature header is missing', () => {
      const event: APIGatewayProxyEvent = {
        headers: {
          'X-Event-Key': 'repo:push',
        },
        body: '{"test": "data"}',
        isBase64Encoded: false,
        requestContext: {
          requestId: 'test-id',
          identity: {
            sourceIp: '192.168.1.1',
          },
        },
      };

      const result = extractWebhookData(event, logger);

      expect(result).toBeNull();
    });

    it('should handle null body', () => {
      const event: APIGatewayProxyEvent = {
        headers: {
          'X-Event-Key': 'repo:push',
          'X-Hub-Signature': 'sha256=abc123',
        },
        body: null,
        isBase64Encoded: false,
        requestContext: {
          requestId: 'test-id',
          identity: {
            sourceIp: '192.168.1.1',
          },
        },
      };

      const result = extractWebhookData(event, logger);

      expect(result).not.toBeNull();
      expect(result?.body).toBe('');
    });
  });

  describe('parseWebhookBody', () => {
    it('should parse valid JSON body', () => {
      const body = '{"repository": {"name": "test-repo"}, "actor": {"username": "user"}}';

      const result = parseWebhookBody(body, logger);

      expect(result).not.toBeNull();
      expect(result?.repository.name).toBe('test-repo');
      expect(result?.actor.username).toBe('user');
    });

    it('should return null for invalid JSON', () => {
      const body = '{invalid json}';

      const result = parseWebhookBody(body, logger);

      expect(result).toBeNull();
    });

    it('should handle empty string', () => {
      const body = '';

      const result = parseWebhookBody(body, logger);

      expect(result).toBeNull();
    });

    it('should handle complex nested JSON', () => {
      const body = JSON.stringify({
        repository: {
          name: 'repo',
          full_slug: 'team/repo',
        },
        pullrequest: {
          id: 123,
          title: 'PR Title',
          links: {
            html: {
              href: 'https://bitbucket.org/team/repo/pull-requests/123',
            },
          },
        },
        actor: {
          username: 'user',
        },
      });

      const result = parseWebhookBody(body, logger);

      expect(result).not.toBeNull();
      expect(result?.pullrequest.id).toBe(123);
      expect(result?.pullrequest.links.html.href).toContain('pull-requests');
    });
  });

  describe('Property Tests', () => {
    // Property 5: Base64 Decoding Round Trip
    it('should decode base64 encoded body to original payload', () => {
      fc.assert(
        fc.property(fc.json(), (payload) => {
          const originalBody = JSON.stringify(payload);
          const base64Body = Buffer.from(originalBody).toString('base64');

          const event: APIGatewayProxyEvent = {
            headers: {
              'X-Event-Key': 'repo:push',
              'X-Hub-Signature': 'sha256=abc123',
            },
            body: base64Body,
            isBase64Encoded: true,
            requestContext: {
              requestId: 'test-id',
              identity: {
                sourceIp: '192.168.1.1',
              },
            },
          };

          const result = extractWebhookData(event, logger);

          expect(result).not.toBeNull();
          expect(result?.body).toBe(originalBody);
        }),
        { numRuns: 100 }
      );
    });
  });
});
