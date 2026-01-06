/**
 * Signature verification for Bitbucket webhooks
 * Implements HMAC-SHA256 verification with constant-time comparison
 */
/**
 * Verify a webhook signature using HMAC-SHA256
 * Uses constant-time comparison to prevent timing attacks
 *
 * @param body The webhook body (raw string)
 * @param signature The signature from X-Hub-Signature header (format: sha256=<hex>)
 * @param secret The Bitbucket webhook secret
 * @returns true if signature is valid, false otherwise
 */
export declare function verifySignature(body: string, signature: string, secret: string): boolean;
//# sourceMappingURL=signature.d.ts.map