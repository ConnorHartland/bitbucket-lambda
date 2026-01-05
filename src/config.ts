/**
 * Configuration management for the Bitbucket to Teams webhook integration
 * Loads configuration from environment variables with validation
 */

import { Config } from './types';

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

    // Validate required variables
    if (!teamsWebhookUrlSecretArn) {
      throw new Error('Missing required environment variable: TEAMS_WEBHOOK_URL_SECRET_ARN');
    }

    if (!bitbucketSecretArn) {
      throw new Error('Missing required environment variable: BITBUCKET_SECRET_ARN');
    }

    // Parse IP_RESTRICTION_ENABLED as boolean (defaults to true)
    const ipRestrictionEnabled = ipRestrictionEnabledStr.toLowerCase() !== 'false';

    return {
      teamsWebhookUrlSecretArn,
      bitbucketSecretArn,
      ipRestrictionEnabled,
    };
  }
}
