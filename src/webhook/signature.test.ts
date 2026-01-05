/**
 * Tests for signature verification
 */

import { verifySignature } from './signature';
import { createHmac } from 'crypto';
import * as fc from 'fast-check';

describe('Signature Verification', () => {
  describe('verifySignature', () => {
    it('should verify a valid signature', () => {
      const body = '{"repository": {"name": "test-repo"}}';
      const secret = 'my-secret-key';

      // Compute the expected signature
      const hmac = createHmac('sha256', secret);
      hmac.update(body);
      const expectedSignature = `sha256=${hmac.digest('hex')}`;

      const result = verifySignature(body, expectedSignature, secret);

      expect(result).toBe(true);
    });

    it('should reject an invalid signature', () => {
      const body = '{"repository": {"name": "test-repo"}}';
      const secret = 'my-secret-key';
      const invalidSignature = 'sha256=0000000000000000000000000000000000000000000000000000000000000000';

      const result = verifySignature(body, invalidSignature, secret);

      expect(result).toBe(false);
    });

    it('should reject a signature with wrong secret', () => {
      const body = '{"repository": {"name": "test-repo"}}';
      const secret = 'my-secret-key';
      const wrongSecret = 'wrong-secret-key';

      // Compute signature with correct secret
      const hmac = createHmac('sha256', secret);
      hmac.update(body);
      const signature = `sha256=${hmac.digest('hex')}`;

      // Verify with wrong secret should fail
      const result = verifySignature(body, signature, wrongSecret);

      expect(result).toBe(false);
    });

    it('should reject a signature with wrong body', () => {
      const body = '{"repository": {"name": "test-repo"}}';
      const wrongBody = '{"repository": {"name": "different-repo"}}';
      const secret = 'my-secret-key';

      // Compute signature with original body
      const hmac = createHmac('sha256', secret);
      hmac.update(body);
      const signature = `sha256=${hmac.digest('hex')}`;

      // Verify with different body should fail
      const result = verifySignature(wrongBody, signature, secret);

      expect(result).toBe(false);
    });

    it('should reject a signature with invalid format', () => {
      const body = '{"repository": {"name": "test-repo"}}';
      const secret = 'my-secret-key';

      // Missing sha256= prefix
      const result1 = verifySignature(body, 'abc123def456', secret);
      expect(result1).toBe(false);

      // Wrong algorithm
      const result2 = verifySignature(body, 'sha1=abc123def456', secret);
      expect(result2).toBe(false);

      // Empty signature
      const result3 = verifySignature(body, '', secret);
      expect(result3).toBe(false);
    });

    it('should reject a signature with invalid hex encoding', () => {
      const body = '{"repository": {"name": "test-repo"}}';
      const secret = 'my-secret-key';
      const invalidHexSignature = 'sha256=zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz';

      const result = verifySignature(body, invalidHexSignature, secret);

      expect(result).toBe(false);
    });

    it('should handle empty body', () => {
      const body = '';
      const secret = 'my-secret-key';

      // Compute signature for empty body
      const hmac = createHmac('sha256', secret);
      hmac.update(body);
      const signature = `sha256=${hmac.digest('hex')}`;

      const result = verifySignature(body, signature, secret);

      expect(result).toBe(true);
    });

    it('should handle special characters in body', () => {
      const body = '{"message": "Hello\\nWorld\\t!@#$%^&*()"}';
      const secret = 'my-secret-key';

      // Compute signature
      const hmac = createHmac('sha256', secret);
      hmac.update(body);
      const signature = `sha256=${hmac.digest('hex')}`;

      const result = verifySignature(body, signature, secret);

      expect(result).toBe(true);
    });

    it('should handle unicode characters in body', () => {
      const body = '{"message": "Hello 世界 🌍"}';
      const secret = 'my-secret-key';

      // Compute signature
      const hmac = createHmac('sha256', secret);
      hmac.update(body);
      const signature = `sha256=${hmac.digest('hex')}`;

      const result = verifySignature(body, signature, secret);

      expect(result).toBe(true);
    });

    it('should handle uppercase hex encoding in signature', () => {
      const body = '{"repository": {"name": "test-repo"}}';
      const secret = 'my-secret-key';

      // Compute signature
      const hmac = createHmac('sha256', secret);
      hmac.update(body);
      const hexSignature = hmac.digest('hex');

      // Convert hex part to uppercase (sha256= prefix stays lowercase)
      const uppercaseSignature = `sha256=${hexSignature.toUpperCase()}`;

      const result = verifySignature(body, uppercaseSignature, secret);

      expect(result).toBe(true);
    });
  });

  describe('Property Tests', () => {
    // Property 3: Signature Verification Accuracy
    it('should correctly verify computed signatures for any body and secret', () => {
      fc.assert(
        fc.property(fc.string(), fc.string(), (body, secret) => {
          // Compute the expected signature
          const hmac = createHmac('sha256', secret);
          hmac.update(body);
          const expectedSignature = `sha256=${hmac.digest('hex')}`;

          // Verify should return true
          const result = verifySignature(body, expectedSignature, secret);

          expect(result).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    // Property 4: Invalid Signature Returns False
    it('should reject invalid signatures for any body and secret', () => {
      fc.assert(
        fc.property(fc.string(), fc.string(), (body, secret) => {
          // Create an invalid signature (all zeros)
          const invalidSignature = 'sha256=0000000000000000000000000000000000000000000000000000000000000000';

          // Verify should return false (unless by extreme coincidence the computed signature is all zeros)
          const result = verifySignature(body, invalidSignature, secret);

          // Compute the actual signature to check if it matches
          const hmac = createHmac('sha256', secret);
          hmac.update(body);
          const actualSignature = hmac.digest('hex');

          // Result should be false unless the actual signature happens to be all zeros
          if (actualSignature === '0000000000000000000000000000000000000000000000000000000000000000') {
            expect(result).toBe(true);
          } else {
            expect(result).toBe(false);
          }
        }),
        { numRuns: 100 }
      );
    });

    // Property 3: Signature Verification Accuracy (continued)
    it('should reject signatures with wrong secret for any body', () => {
      fc.assert(
        fc.property(fc.string(), fc.string(), fc.string(), (body, secret, wrongSecret) => {
          // Skip if secrets are the same
          if (secret === wrongSecret) {
            return true;
          }

          // Compute signature with correct secret
          const hmac = createHmac('sha256', secret);
          hmac.update(body);
          const signature = `sha256=${hmac.digest('hex')}`;

          // Verify with wrong secret should fail
          const result = verifySignature(body, signature, wrongSecret);

          return result === false;
        }),
        { numRuns: 100 }
      );
    });

    // Property 3: Signature Verification Accuracy (continued)
    it('should reject signatures with wrong body for any secret', () => {
      fc.assert(
        fc.property(fc.string(), fc.string(), fc.string(), (body, wrongBody, secret) => {
          // Skip if bodies are the same
          if (body === wrongBody) {
            return true;
          }

          // Compute signature with original body
          const hmac = createHmac('sha256', secret);
          hmac.update(body);
          const signature = `sha256=${hmac.digest('hex')}`;

          // Verify with different body should fail
          const result = verifySignature(wrongBody, signature, secret);

          return result === false;
        }),
        { numRuns: 100 }
      );
    });
  });
});
