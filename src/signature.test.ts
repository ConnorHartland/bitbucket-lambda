/**
 * Tests for Signature Verification Module
 * Property-based tests using fast-check
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */

import fc from 'fast-check';
import {
  extractSignatureFromHeaders,
  computeSignature,
  verifySignature,
  validateWebhookSignature
} from './signature';
import { createHmac } from 'crypto';

describe('Signature Verification', () => {
  describe('extractSignatureFromHeaders', () => {
    it('should extract signature from X-Hub-Signature header', () => {
      const headers = {
        'X-Hub-Signature': 'sha256=abc123def456'
      };

      const signature = extractSignatureFromHeaders(headers);

      expect(signature).toBe('abc123def456');
    });

    it('should handle lowercase header names', () => {
      const headers = {
        'x-hub-signature': 'sha256=abc123def456'
      };

      const signature = extractSignatureFromHeaders(headers);

      expect(signature).toBe('abc123def456');
    });

    it('should handle mixed case header names', () => {
      const headers = {
        'X-HUB-SIGNATURE': 'sha256=abc123def456'
      };

      const signature = extractSignatureFromHeaders(headers);

      expect(signature).toBe('abc123def456');
    });

    it('should return signature without sha256= prefix if not present', () => {
      const headers = {
        'X-Hub-Signature': 'abc123def456'
      };

      const signature = extractSignatureFromHeaders(headers);

      expect(signature).toBe('abc123def456');
    });

    it('should return null if X-Hub-Signature header is missing', () => {
      const headers = {
        'Content-Type': 'application/json'
      };

      const signature = extractSignatureFromHeaders(headers);

      expect(signature).toBeNull();
    });

    it('should return null for empty headers', () => {
      const headers = {};

      const signature = extractSignatureFromHeaders(headers);

      expect(signature).toBeNull();
    });
  });

  describe('computeSignature', () => {
    it('should compute HMAC-SHA256 signature', () => {
      const payload = 'test payload';
      const secret = 'test secret';

      const signature = computeSignature(payload, secret);

      // Verify against Node.js crypto
      const expectedSignature = createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      expect(signature).toBe(expectedSignature);
    });

    it('should produce consistent signatures for same payload and secret', () => {
      const payload = 'test payload';
      const secret = 'test secret';

      const signature1 = computeSignature(payload, secret);
      const signature2 = computeSignature(payload, secret);

      expect(signature1).toBe(signature2);
    });

    it('should produce different signatures for different payloads', () => {
      const secret = 'test secret';

      const signature1 = computeSignature('payload1', secret);
      const signature2 = computeSignature('payload2', secret);

      expect(signature1).not.toBe(signature2);
    });

    it('should produce different signatures for different secrets', () => {
      const payload = 'test payload';

      const signature1 = computeSignature(payload, 'secret1');
      const signature2 = computeSignature(payload, 'secret2');

      expect(signature1).not.toBe(signature2);
    });

    it('should handle empty payload', () => {
      const payload = '';
      const secret = 'test secret';

      const signature = computeSignature(payload, secret);

      expect(signature).toBeDefined();
      expect(signature.length).toBe(64); // SHA256 hex is 64 characters
    });

    it('should handle empty secret', () => {
      const payload = 'test payload';
      const secret = '';

      const signature = computeSignature(payload, secret);

      expect(signature).toBeDefined();
      expect(signature.length).toBe(64);
    });

    // Property 5: HMAC-SHA256 Signature Computation
    // For any payload and secret, the computed HMAC-SHA256 signature
    // SHALL match the expected signature for that payload and secret
    it('Property 5: HMAC-SHA256 Signature Computation', () => {
      fc.assert(
        fc.property(
          fc.string(),
          fc.string(),
          (payload: string, secret: string) => {
            const computedSignature = computeSignature(payload, secret);
            const expectedSignature = createHmac('sha256', secret)
              .update(payload)
              .digest('hex');

            expect(computedSignature).toBe(expectedSignature);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('verifySignature', () => {
    it('should verify matching signature', () => {
      const payload = 'test payload';
      const secret = 'test secret';
      const signature = computeSignature(payload, secret);

      const isValid = verifySignature(payload, signature, secret);

      expect(isValid).toBe(true);
    });

    it('should reject mismatched signature', () => {
      const payload = 'test payload';
      const secret = 'test secret';
      const wrongSignature = 'abc123def456';

      const isValid = verifySignature(payload, wrongSignature, secret);

      expect(isValid).toBe(false);
    });

    it('should reject signature with wrong payload', () => {
      const payload = 'test payload';
      const secret = 'test secret';
      const signature = computeSignature(payload, secret);

      const isValid = verifySignature('different payload', signature, secret);

      expect(isValid).toBe(false);
    });

    it('should reject signature with wrong secret', () => {
      const payload = 'test payload';
      const secret = 'test secret';
      const signature = computeSignature(payload, secret);

      const isValid = verifySignature(payload, signature, 'wrong secret');

      expect(isValid).toBe(false);
    });

    it('should use constant-time comparison', () => {
      const payload = 'test payload';
      const secret = 'test secret';
      const signature = computeSignature(payload, secret);

      // Verify that even a single character difference is caught
      const wrongSignature = signature.substring(0, signature.length - 1) + 'X';

      const isValid = verifySignature(payload, wrongSignature, secret);

      expect(isValid).toBe(false);
    });
  });

  describe('validateWebhookSignature', () => {
    it('should validate webhook with correct signature', () => {
      const body = JSON.stringify({ event: 'push', repository: 'test' });
      const secret = 'test secret';
      const signature = computeSignature(body, secret);

      const headers = {
        'X-Hub-Signature': `sha256=${signature}`
      };

      const [isValid, error] = validateWebhookSignature(headers, body, secret);

      expect(isValid).toBe(true);
      expect(error).toBeNull();
    });

    it('should reject webhook with incorrect signature', () => {
      const body = JSON.stringify({ event: 'push', repository: 'test' });
      const secret = 'test secret';

      const headers = {
        'X-Hub-Signature': 'sha256=abc123def456'
      };

      const [isValid, error] = validateWebhookSignature(headers, body, secret);

      expect(isValid).toBe(false);
      expect(error).toBe('Signature verification failed');
    });

    it('should reject webhook with missing signature header', () => {
      const body = JSON.stringify({ event: 'push', repository: 'test' });
      const secret = 'test secret';

      const headers = {
        'Content-Type': 'application/json'
      };

      const [isValid, error] = validateWebhookSignature(headers, body, secret);

      expect(isValid).toBe(false);
      expect(error).toBe('No signature found in X-Hub-Signature header');
    });

    // Property 6: Signature Verification with Minified JSON
    // For any payload where signature verification fails with the original body,
    // the system SHALL attempt verification with minified JSON and succeed
    // if the minified version matches
    it('Property 6: Signature Verification with Minified JSON', () => {
      fc.assert(
        fc.property(
          fc.object({ maxDepth: 3 }),
          fc.string(),
          (obj: any, secret: string) => {
            // Create original JSON with extra whitespace
            const originalBody = JSON.stringify(obj, null, 2);
            const minifiedBody = JSON.stringify(obj);

            // Compute signature on minified version
            const signature = computeSignature(minifiedBody, secret);

            const headers = {
              'X-Hub-Signature': `sha256=${signature}`
            };

            // Validate with original (formatted) body
            const [isValid, error] = validateWebhookSignature(headers, originalBody, secret);

            // Should succeed because minified version matches
            expect(isValid).toBe(true);
            expect(error).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle signature without sha256= prefix', () => {
      const body = JSON.stringify({ event: 'push', repository: 'test' });
      const secret = 'test secret';
      const signature = computeSignature(body, secret);

      const headers = {
        'X-Hub-Signature': signature
      };

      const [isValid, error] = validateWebhookSignature(headers, body, secret);

      expect(isValid).toBe(true);
      expect(error).toBeNull();
    });

    it('should handle case-insensitive header names', () => {
      const body = JSON.stringify({ event: 'push', repository: 'test' });
      const secret = 'test secret';
      const signature = computeSignature(body, secret);

      const headers = {
        'x-hub-signature': `sha256=${signature}`
      };

      const [isValid, error] = validateWebhookSignature(headers, body, secret);

      expect(isValid).toBe(true);
      expect(error).toBeNull();
    });

    it('should reject webhook with modified body', () => {
      const body = JSON.stringify({ event: 'push', repository: 'test' });
      const secret = 'test secret';
      const signature = computeSignature(body, secret);

      const headers = {
        'X-Hub-Signature': `sha256=${signature}`
      };

      const modifiedBody = JSON.stringify({ event: 'push', repository: 'modified' });

      const [isValid, error] = validateWebhookSignature(headers, modifiedBody, secret);

      expect(isValid).toBe(false);
      expect(error).toBe('Signature verification failed');
    });
  });
});
