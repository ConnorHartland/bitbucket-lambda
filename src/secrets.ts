/**
 * Secret retrieval from AWS Secrets Manager with caching
 * Handles AWS errors gracefully and caches secrets for warm Lambda invocations
 */

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { Logger } from './logger';

/**
 * Cache for secrets to avoid repeated AWS calls during warm Lambda invocations
 */
const secretCache: Map<string, { value: string; timestamp: number }> = new Map();

/**
 * Cache TTL in milliseconds (5 minutes)
 */
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * SecretsManager client instance (reused across invocations)
 */
let secretsManagerClient: SecretsManagerClient | null = null;

/**
 * Get or create the SecretsManager client
 * Reuses the same client instance across Lambda invocations for efficiency
 *
 * @returns SecretsManagerClient instance
 */
function getSecretsManagerClient(): SecretsManagerClient {
  if (!secretsManagerClient) {
    secretsManagerClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });
  }
  return secretsManagerClient;
}

/**
 * Check if a cached secret is still valid
 *
 * @param arn The secret ARN
 * @returns true if the secret is cached and not expired
 */
function isCacheValid(arn: string): boolean {
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
export async function getSecret(arn: string, logger?: Logger): Promise<string> {
  // Check cache first
  if (isCacheValid(arn)) {
    const cached = secretCache.get(arn);
    if (cached) {
      return cached.value;
    }
  }

  try {
    const client = getSecretsManagerClient();
    const command = new GetSecretValueCommand({ SecretId: arn });
    const response = await client.send(command);

    // Extract the secret value
    let secretValue: string;
    if (response.SecretString) {
      secretValue = response.SecretString;
    } else if (response.SecretBinary) {
      // Handle binary secrets
      const buffer = Buffer.from(response.SecretBinary as any, 'base64');
      secretValue = buffer.toString('utf-8');
    } else {
      throw new Error('Secret has no SecretString or SecretBinary');
    }

    // Cache the secret
    secretCache.set(arn, {
      value: secretValue,
      timestamp: Date.now(),
    });

    return secretValue;
  } catch (error) {
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
export function clearSecretCache(): void {
  secretCache.clear();
}

/**
 * Reset the SecretsManager client
 * Useful for testing to ensure a fresh client is created
 */
export function resetSecretsManagerClient(): void {
  secretsManagerClient = null;
}

/**
 * Get cache statistics (for testing and monitoring)
 *
 * @returns Object with cache statistics
 */
export function getCacheStats(): { size: number; entries: string[] } {
  return {
    size: secretCache.size,
    entries: Array.from(secretCache.keys()),
  };
}
