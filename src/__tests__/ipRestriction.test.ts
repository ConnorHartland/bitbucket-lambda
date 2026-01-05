/**
 * IP Restriction Module Tests
 */

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
  });
});
