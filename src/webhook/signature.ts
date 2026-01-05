/**
 * Signature verification for Bitbucket webhooks
 * Implements HMAC-SHA256 verification with constant-time comparison
 */

import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Verify a webhook signature using HMAC-SHA256
 * Uses constant-time comparison to prevent timing attacks
 *
 * @param body The webhook body (raw string)
 * @param signature The signature from X-Hub-Signature header (format: sha256=<hex>)
 * @param secret The Bitbucket webhook secret
 * @returns true if signature is valid, false otherwise
 */
export function verifySignature(body: string, signature: string, secret: string): boolean {
  try {
    // Parse the signature format: sha256=<hex_encoded_hmac>
    const signatureParts = signature.split('=');
    if (signatureParts.length !== 2 || signatureParts[0] !== 'sha256') {
      return false;
    }

    const providedSignature = signatureParts[1];

    // Compute the expected HMAC-SHA256
    const hmac = createHmac('sha256', secret);
    hmac.update(body);
    const computedSignature = hmac.digest('hex');

    // Use constant-time comparison to prevent timing attacks
    const providedBuffer = Buffer.from(providedSignature, 'hex');
    const computedBuffer = Buffer.from(computedSignature, 'hex');

    // Check if buffers have the same length before comparing
    if (providedBuffer.length !== computedBuffer.length) {
      return false;
    }

    return timingSafeEqual(providedBuffer, computedBuffer);
  } catch (error) {
    // Return false for any errors (invalid hex, etc.)
    return false;
  }
}
