"use strict";
/**
 * Secret retrieval from AWS Secrets Manager with caching
 * Handles AWS errors gracefully and caches secrets for warm Lambda invocations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSecret = getSecret;
exports.clearSecretCache = clearSecretCache;
exports.resetSecretsManagerClient = resetSecretsManagerClient;
exports.getCacheStats = getCacheStats;
const client_secrets_manager_1 = require("@aws-sdk/client-secrets-manager");
/**
 * Cache for secrets to avoid repeated AWS calls during warm Lambda invocations
 */
const secretCache = new Map();
/**
 * Cache TTL in milliseconds (5 minutes)
 */
const CACHE_TTL_MS = 5 * 60 * 1000;
/**
 * SecretsManager client instance (reused across invocations)
 */
let secretsManagerClient = null;
/**
 * Get or create the SecretsManager client
 * Reuses the same client instance across Lambda invocations for efficiency
 *
 * @returns SecretsManagerClient instance
 */
function getSecretsManagerClient() {
    if (!secretsManagerClient) {
        secretsManagerClient = new client_secrets_manager_1.SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });
    }
    return secretsManagerClient;
}
/**
 * Check if a cached secret is still valid
 *
 * @param arn The secret ARN
 * @returns true if the secret is cached and not expired
 */
function isCacheValid(arn) {
    const cached = secretCache.get(arn);
    if (!cached) {
        return false;
    }
    const now = Date.now();
    return now - cached.timestamp < CACHE_TTL_MS;
}
/**
 * Retrieve a secret from AWS Secrets Manager with caching
 * Implements caching for warm Lambda invocations to reduce AWS API calls
 *
 * @param arn The ARN of the secret to retrieve
 * @param logger Optional logger for error logging
 * @returns Promise resolving to the secret value
 * @throws Error if the secret cannot be retrieved
 */
async function getSecret(arn, logger) {
    // Check cache first
    if (isCacheValid(arn)) {
        const cached = secretCache.get(arn);
        if (cached) {
            return cached.value;
        }
    }
    try {
        const client = getSecretsManagerClient();
        const command = new client_secrets_manager_1.GetSecretValueCommand({ SecretId: arn });
        const response = await client.send(command);
        // Extract the secret value
        let secretValue;
        if (response.SecretString) {
            secretValue = response.SecretString;
        }
        else if (response.SecretBinary) {
            // Handle binary secrets
            const buffer = Buffer.from(response.SecretBinary, 'base64');
            secretValue = buffer.toString('utf-8');
        }
        else {
            throw new Error('Secret has no SecretString or SecretBinary');
        }
        // Cache the secret
        secretCache.set(arn, {
            value: secretValue,
            timestamp: Date.now(),
        });
        return secretValue;
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (logger) {
            logger.error('Failed to retrieve secret from AWS Secrets Manager', {
                arn,
                error: errorMessage,
            });
        }
        throw new Error(`Failed to retrieve secret: ${errorMessage}`);
    }
}
/**
 * Clear the secret cache
 * Useful for testing or forcing a refresh
 */
function clearSecretCache() {
    secretCache.clear();
}
/**
 * Reset the SecretsManager client
 * Useful for testing to ensure a fresh client is created
 */
function resetSecretsManagerClient() {
    secretsManagerClient = null;
}
/**
 * Get cache statistics (for testing and monitoring)
 *
 * @returns Object with cache statistics
 */
function getCacheStats() {
    return {
        size: secretCache.size,
        entries: Array.from(secretCache.keys()),
    };
}
//# sourceMappingURL=secrets.js.map