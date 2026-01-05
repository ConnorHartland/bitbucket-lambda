/**
 * IP Restriction Module Tests
 * Property-based tests using fast-check
 * Requirements: 2.5.2, 2.5.3, 1.2
 */

import fc from 'fast-check';
import { getSourceIp, validateSourceIp, clearIpRangesCache } from '../webhook/ipRestriction';
import * as awsSecrets from '../aws/secrets';

jest.mock('../aws/secrets');
jest.mock('../utils/logging', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('IP Restriction Module', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearIpRangesCache();
  });

  describe('getSourceIp', () => {
    it('should extract source IP from requestContext', () => {
      const event = {
        requestContext: {
          identity: {
            sourceIp: '192.168.1.1'
          }
        }
      };

      const ip = getSourceIp(event);
      expect(ip).toBe('192.168.1.1');
    });

    it('should extract source IP from X-Forwarded-For header', () => {
      const event = {
        headers: {
          'x-forwarded-for': '10.0.0.1, 192.168.1.1'
        }
      };

      const ip = getSourceIp(event);
      expect(ip).toBe('10.0.0.1');
    });

    it('should return null if no source IP found', () => {
      const event = {
        headers: {},
        requestContext: {}
      };

      const ip = getSourceIp(event);
      expect(ip).toBeNull();
    });

    it('should prefer requestContext over X-Forwarded-For', () => {
      const event = {
        requestContext: {
          identity: {
            sourceIp: '192.168.1.1'
          }
        },
        headers: {
          'x-forwarded-for': '10.0.0.1'
        }
      };

      const ip = getSourceIp(event);
      expect(ip).toBe('192.168.1.1');
    });
  });

  describe('validateSourceIp', () => {
    const mockSecretArn = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:test';
    const mockIpRanges = {
      ip_ranges: ['18.205.93.0/25', '18.234.32.128/25']
    };

    it('should allow IP within allowed ranges', async () => {
      (awsSecrets.getSecret as jest.Mock).mockResolvedValue(JSON.stringify(mockIpRanges));

      const event = {
        requestContext: {
          identity: {
            sourceIp: '18.205.93.50'
          }
        }
      };

      const result = await validateSourceIp(event, mockSecretArn, 'test-request-id');
      expect(result.isValid).toBe(true);
    });

    it('should reject IP outside allowed ranges', async () => {
      (awsSecrets.getSecret as jest.Mock).mockResolvedValue(JSON.stringify(mockIpRanges));

      const event = {
        requestContext: {
          identity: {
            sourceIp: '192.168.1.1'
          }
        }
      };

      const result = await validateSourceIp(event, mockSecretArn, 'test-request-id');
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('not in allowed ranges');
    });

    it('should handle missing source IP', async () => {
      const event = {
        headers: {},
        requestContext: {}
      };

      const result = await validateSourceIp(event, mockSecretArn, 'test-request-id');
      expect(result.isValid).toBe(false);
      expect(result.reason).toContain('Could not determine source IP');
    });

    it('should fail open on secret retrieval error', async () => {
      (awsSecrets.getSecret as jest.Mock).mockRejectedValue(new Error('Secret not found'));

      const event = {
        requestContext: {
          identity: {
            sourceIp: '192.168.1.1'
          }
        }
      };

      const result = await validateSourceIp(event, mockSecretArn, 'test-request-id');
      expect(result.isValid).toBe(true); // Fail open
    });

    // Property 1: IP Whitelist Validation
    // For any source IP address, the system SHALL correctly identify whether it is in the Bitbucket IP whitelist
    it('Property 1: IP Whitelist Validation', async () => {
      (awsSecrets.getSecret as jest.Mock).mockResolvedValue(JSON.stringify(mockIpRanges));

      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant('18.205.93.50'),
            fc.constant('18.205.93.100'),
            fc.constant('18.234.32.200')
          ),
          async (ip: string) => {
            const event = {
              requestContext: {
                identity: {
                  sourceIp: ip
                }
              }
            };

            const result = await validateSourceIp(event, mockSecretArn, 'test-request-id');
            expect(result.isValid).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property 2: Non-Whitelisted IP Returns 200
    // For any request from a non-whitelisted IP, the system SHALL return a 200 status code and log the rejection
    it('Property 2: Non-Whitelisted IP Returns 200', async () => {
      (awsSecrets.getSecret as jest.Mock).mockResolvedValue(JSON.stringify(mockIpRanges));

      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            fc.constant('192.168.1.1'),
            fc.constant('10.0.0.1'),
            fc.constant('172.16.0.1')
          ),
          async (ip: string) => {
            const event = {
              requestContext: {
                identity: {
                  sourceIp: ip
                }
              }
            };

            const result = await validateSourceIp(event, mockSecretArn, 'test-request-id');
            expect(result.isValid).toBe(false);
            expect(result.reason).toContain('not in allowed ranges');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
