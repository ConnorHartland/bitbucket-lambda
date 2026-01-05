/**
 * Configuration management for the Bitbucket to Teams webhook integration
 * Loads configuration from environment variables with validation
 */

import { Config } from './types';

/**
 * Default Bitbucket IP ranges
 */
const DEFAULT_BITBUCKET_IP_RANGES = [
  '104.192.136.0/21',
  '185.166.140.0/22',
  '13.200.41.128/25',
];

/**
 * ConfigManager class to load and validate configuration from environment variables
 */
export class ConfigManager {
  /**
   * Load configuration from environment variables
   * Throws an error if required variables are missing
   *
   * @returns Config object with all required configuration
   * @throws Error if required environment variables are missing
   */
  static loadFromEnvironment(): Config {
    const teamsWebhookUrlSecretArn = process.env.TEAMS_WEBHOOK_URL_SECRET_ARN;
    const bitbucketSecretArn = process.env.BITBUCKET_SECRET_ARN;
    const ipRestrictionEnabledStr = process.env.IP_RESTRICTION_ENABLED ?? 'true';
    const bitbucketIpRangesStr = process.env.BITBUCKET_IP_RANGES;

    // Validate required variables
    if (!teamsWebhookUrlSecretArn) {
      throw new Error('Missing required environment variable: TEAMS_WEBHOOK_URL_SECRET_ARN');
    }

    if (!bitbucketSecretArn) {
      throw new Error('Missing required environment variable: BITBUCKET_SECRET_ARN');
    }

    // Parse IP_RESTRICTION_ENABLED as boolean (defaults to true)
    const ipRestrictionEnabled = ipRestrictionEnabledStr.toLowerCase() !== 'false';

    // Parse BITBUCKET_IP_RANGES from environment (comma-separated), or use defaults
    let bitbucketIpRanges = DEFAULT_BITBUCKET_IP_RANGES;
    if (bitbucketIpRangesStr) {
      bitbucketIpRanges = bitbucketIpRangesStr.split(',').map((range) => range.trim());
    }

    return {
      teamsWebhookUrlSecretArn,
      bitbucketSecretArn,
      ipRestrictionEnabled,
      bitbucketIpRanges,
    };
  }
}
