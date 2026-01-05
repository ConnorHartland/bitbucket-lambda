/**
 * Signature Verification Module
 * Verifies webhook signatures using HMAC-SHA256
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */

import { createHmac } from 'crypto';

export function extractSignatureFromHeaders(headers: Record<string, string>): string | null {
  const signatureHeader = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === 'x-hub-signature'
  );

  if (!signatureHeader) return null;

  const signatureValue = signatureHeader[1];
  return signatureValue.startsWith('sha256=') ? signatureValue.substring(7) : signatureValue;
}

export function computeSignature(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

function constantTimeCompare(a: string, b: string): boolean {
  const minLength = Math.min(a.length, b.length);
  let mismatch = a.length !== b.length ? 1 : 0;

  for (let i = 0; i < minLength; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return mismatch === 0;
}

export function verifySignature(
  payload: string,
  receivedSignature: string,
  secret: string
): boolean {
  return constantTimeCompare(computeSignature(payload, secret), receivedSignature);
}

export function validateWebhookSignature(
  headers: Record<string, string>,
  body: string,
  secret: string
): [boolean, string | null] {
  const receivedSignature = extractSignatureFromHeaders(headers);

  if (!receivedSignature) {
    return [false, 'No signature found in X-Hub-Signature header'];
  }

  if (verifySignature(body, receivedSignature, secret)) {
    return [true, null];
  }

  // Try with minified JSON as fallback
  try {
    const minifiedBody = JSON.stringify(JSON.parse(body));
    if (minifiedBody !== body && verifySignature(minifiedBody, receivedSignature, secret)) {
      return [true, null];
    }
  } catch {
    // Ignore JSON parsing errors
  }

  return [false, 'Signature verification failed'];
}
