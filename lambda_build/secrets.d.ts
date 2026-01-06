/**
 * Secret retrieval from AWS Secrets Manager with caching
 * Handles AWS errors gracefully and caches secrets for warm Lambda invocations
 */
import { Logger } from './logger';
/**
 * Retrieve a secret from AWS Secrets Manager with caching
 * Implements caching for warm Lambda invocations to reduce AWS API calls
 *
 * @param arn The ARN of the secret to retrieve
 * @param logger Optional logger for error logging
 * @returns Promise resolving to the secret value
 * @throws Error if the secret cannot be retrieved
 */
export declare function getSecret(arn: string, logger?: Logger): Promise<string>;
/**
 * Clear the secret cache
 * Useful for testing or forcing a refresh
 */
export declare function clearSecretCache(): void;
/**
 * Reset the SecretsManager client
 * Useful for testing to ensure a fresh client is created
 */
export declare function resetSecretsManagerClient(): void;
/**
 * Get cache statistics (for testing and monitoring)
 *
 * @returns Object with cache statistics
 */
export declare function getCacheStats(): {
    size: number;
    entries: string[];
};
//# sourceMappingURL=secrets.d.ts.map