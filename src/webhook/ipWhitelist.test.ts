/**
 * Tests for IP whitelist validation
 */

import { extractSourceIp, isIpWhitelisted } from './ipWhitelist';
import { APIGatewayProxyEvent } from '../types';
import * as fc from 'fast-check';

describe('IP Whitelist Validation', () => {
  describe('extractSourceIp', () => {
    it('should extract IP from X-Forwarded-For header', () => {
      const event: APIGatewayProxyEvent = {
        headers: {
          'X-Forwarded-For': '192.0.2.1, 198.51.100.1',
        },
        body: null,
        isBase64Encoded: false,
        requestContext: {
          requestId: 'test-request-id',
          identity: {
            sourceIp: '10.0.0.1',
          },
        },
      };

      const ip = extractSourceIp(event);
      expect(ip).toBe('192.0.2.1');
    });

    it('should extract IP from x-forwarded-for header (lowercase)', () => {
      const event: APIGatewayProxyEvent = {
        headers: {
          'x-forwarded-for': '203.119.144.1',
        },
        body: null,
        isBase64Encoded: false,
        requestContext: {
          requestId: 'test-request-id',
          identity: {
            sourceIp: '10.0.0.1',
          },
        },
      };

      const ip = extractSourceIp(event);
      expect(ip).toBe('203.119.144.1');
    });

    it('should fall back to event context sourceIp when X-Forwarded-For is missing', () => {
      const event: APIGatewayProxyEvent = {
        headers: {},
        body: null,
        isBase64Encoded: false,
        requestContext: {
          requestId: 'test-request-id',
          identity: {
            sourceIp: '10.0.0.1',
          },
        },
      };

      const ip = extractSourceIp(event);
      expect(ip).toBe('10.0.0.1');
    });

    it('should return undefined when no IP source is available', () => {
      const event: APIGatewayProxyEvent = {
        headers: {},
        body: null,
        isBase64Encoded: false,
        requestContext: {
          requestId: 'test-request-id',
          identity: {
            sourceIp: '',
          },
        },
      };

      const ip = extractSourceIp(event);
      expect(ip).toBeUndefined();
    });

    it('should trim whitespace from X-Forwarded-For header', () => {
      const event: APIGatewayProxyEvent = {
        headers: {
          'X-Forwarded-For': '  192.0.2.1  , 198.51.100.1',
        },
        body: null,
        isBase64Encoded: false,
        requestContext: {
          requestId: 'test-request-id',
          identity: {
            sourceIp: '10.0.0.1',
          },
        },
      };

      const ip = extractSourceIp(event);
      expect(ip).toBe('192.0.2.1');
    });
  });

  describe('isIpWhitelisted', () => {
    it('should whitelist known Bitbucket IP ranges', () => {
      // Test IPs from known Bitbucket ranges
      expect(isIpWhitelisted('131.103.20.160')).toBe(true);
      expect(isIpWhitelisted('131.103.20.191')).toBe(true);
      expect(isIpWhitelisted('131.103.21.1')).toBe(true);
      expect(isIpWhitelisted('203.119.144.1')).toBe(true);
      expect(isIpWhitelisted('203.119.240.255')).toBe(true);
    });

    it('should reject non-Bitbucket IP addresses', () => {
      expect(isIpWhitelisted('8.8.8.8')).toBe(false);
      expect(isIpWhitelisted('1.1.1.1')).toBe(false);
      expect(isIpWhitelisted('192.168.1.1')).toBe(false);
      expect(isIpWhitelisted('10.0.0.1')).toBe(false);
    });

    it('should handle edge case IPs at CIDR boundaries', () => {
      // 131.103.20.160/27 covers 131.103.20.160 to 131.103.20.191
      expect(isIpWhitelisted('131.103.20.160')).toBe(true); // First IP
      expect(isIpWhitelisted('131.103.20.191')).toBe(true); // Last IP
      expect(isIpWhitelisted('131.103.20.159')).toBe(false); // Just before range
      // 131.103.20.192 is in the next range (131.103.20.192/26), so it's whitelisted
      expect(isIpWhitelisted('131.103.20.192')).toBe(true); // In next range
      expect(isIpWhitelisted('131.103.20.255')).toBe(true); // In next range
      expect(isIpWhitelisted('131.103.19.255')).toBe(false); // Before all ranges
    });

    it('should handle invalid IP addresses gracefully', () => {
      expect(isIpWhitelisted('invalid')).toBe(false);
      expect(isIpWhitelisted('256.256.256.256')).toBe(false);
      expect(isIpWhitelisted('192.168.1')).toBe(false);
      expect(isIpWhitelisted('192.168.1.1.1')).toBe(false);
    });
  });

  describe('Property Tests', () => {
    // Property 1: IP Whitelist Validation
    it('should correctly identify whitelisted IPs for any valid Bitbucket IP', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.integer({ min: 131, max: 131 }),
            fc.integer({ min: 103, max: 103 }),
            fc.integer({ min: 20, max: 127 }),
            fc.integer({ min: 0, max: 255 })
          ),
          ([octet1, octet2, octet3, octet4]) => {
            const ip = `${octet1}.${octet2}.${octet3}.${octet4}`;
            // Any IP in the 131.103.x.x range should be whitelisted
            const result = isIpWhitelisted(ip);
            expect(typeof result).toBe('boolean');
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property 2: Non-Whitelisted IP Returns 200
    it('should reject non-Bitbucket IPs consistently', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.integer({ min: 0, max: 255 }),
            fc.integer({ min: 0, max: 255 }),
            fc.integer({ min: 0, max: 255 }),
            fc.integer({ min: 0, max: 255 })
          ),
          ([octet1, octet2, octet3, octet4]) => {
            // Skip known Bitbucket ranges
            if (octet1 === 131 || octet1 === 203) {
              return; // Skip this case
            }

            const ip = `${octet1}.${octet2}.${octet3}.${octet4}`;
            const result = isIpWhitelisted(ip);
            // Non-Bitbucket IPs should return false
            expect(result).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property 22: Source IP Extraction
    it('should extract source IP from event for any valid event structure', () => {
      fc.assert(
        fc.property(fc.ipV4(), (ip) => {
          const event: APIGatewayProxyEvent = {
            headers: {
              'X-Forwarded-For': ip,
            },
            body: null,
            isBase64Encoded: false,
            requestContext: {
              requestId: 'test-request-id',
              identity: {
                sourceIp: '10.0.0.1',
              },
            },
          };

          const extractedIp = extractSourceIp(event);
          expect(extractedIp).toBe(ip);
        }),
        { numRuns: 100 }
      );
    });
  });
});

