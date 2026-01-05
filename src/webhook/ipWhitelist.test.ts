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
      // Test IPs from the new Bitbucket ranges
      expect(isIpWhitelisted('104.192.136.0')).toBe(true);
      expect(isIpWhitelisted('104.192.140.241')).toBe(true);
      expect(isIpWhitelisted('104.192.143.255')).toBe(true);
      expect(isIpWhitelisted('185.166.140.0')).toBe(true);
      expect(isIpWhitelisted('185.166.143.255')).toBe(true);
      expect(isIpWhitelisted('13.200.41.128')).toBe(true);
      expect(isIpWhitelisted('13.200.41.255')).toBe(true);
    });

    it('should reject non-Bitbucket IP addresses', () => {
      expect(isIpWhitelisted('8.8.8.8')).toBe(false);
      expect(isIpWhitelisted('1.1.1.1')).toBe(false);
      expect(isIpWhitelisted('192.168.1.1')).toBe(false);
      expect(isIpWhitelisted('10.0.0.1')).toBe(false);
    });

    it('should handle edge case IPs at CIDR boundaries', () => {
      // 104.192.136.0/21 covers 104.192.136.0 to 104.192.143.255
      expect(isIpWhitelisted('104.192.136.0')).toBe(true); // First IP
      expect(isIpWhitelisted('104.192.143.255')).toBe(true); // Last IP
      expect(isIpWhitelisted('104.192.135.255')).toBe(false); // Just before range
      expect(isIpWhitelisted('104.192.144.0')).toBe(false); // Just after range
      // 185.166.140.0/22 covers 185.166.140.0 to 185.166.143.255
      expect(isIpWhitelisted('185.166.140.0')).toBe(true); // First IP
      expect(isIpWhitelisted('185.166.143.255')).toBe(true); // Last IP
      expect(isIpWhitelisted('185.166.139.255')).toBe(false); // Just before range
      expect(isIpWhitelisted('185.166.144.0')).toBe(false); // Just after range
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
            fc.integer({ min: 104, max: 104 }),
            fc.integer({ min: 192, max: 192 }),
            fc.integer({ min: 136, max: 143 }),
            fc.integer({ min: 0, max: 255 })
          ),
          ([octet1, octet2, octet3, octet4]) => {
            const ip = `${octet1}.${octet2}.${octet3}.${octet4}`;
            // Any IP in the 104.192.136.0/21 range should be whitelisted
            const result = isIpWhitelisted(ip);
            expect(result).toBe(true);
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
            if ((octet1 === 104 && octet2 === 192 && octet3 >= 136 && octet3 <= 143) ||
                (octet1 === 185 && octet2 === 166 && octet3 >= 140 && octet3 <= 143) ||
                (octet1 === 13 && octet2 === 200 && octet3 === 41 && octet4 >= 128)) {
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

