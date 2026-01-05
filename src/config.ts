/**
 * Configuration Management Module
 * Loads and validates configuration from environment variables
 */

export class Configuration {
  teamsWebhookUrlSecretArn: string;
  bitbucketSecretArn: string;
  bitbucketIpsSecretArn: string;

  constructor(
    teamsWebhookUrlSecretArn: string,
    bitbucketSecretArn: string,
    bitbucketIpsSecretArn: string
  ) {
    this.teamsWebhookUrlSecretArn = teamsWebhookUrlSecretArn;
    this.bitbucketSecretArn = bitbucketSecretArn;
    this.bitbucketIpsSecretArn = bitbucketIpsSecretArn;
  }

  static loadFromEnvironment(): Configuration {
    const teamsWebhookUrlSecretArn = process.env.TEAMS_WEBHOOK_URL_SECRET_ARN;
    const bitbucketSecretArn = process.env.BITBUCKET_SECRET_ARN;
    const bitbucketIpsSecretArn = process.env.BITBUCKET_IPS_SECRET_ARN;

    if (!teamsWebhookUrlSecretArn) {
      throw new Error(
        'Configuration error: TEAMS_WEBHOOK_URL_SECRET_ARN environment variable is required'
      );
    }

    if (!bitbucketSecretArn) {
      throw new Error(
        'Configuration error: BITBUCKET_SECRET_ARN environment variable is required'
      );
    }

    if (!bitbucketIpsSecretArn) {
      throw new Error(
        'Configuration error: BITBUCKET_IPS_SECRET_ARN environment variable is required'
      );
    }

    return new Configuration(teamsWebhookUrlSecretArn, bitbucketSecretArn, bitbucketIpsSecretArn);
  }
}

export class FilterConfig {
  /**
   * Simplified FilterConfig that only detects failure events
   * Supports: PR declined (pullrequest:rejected) and build failed (repo:commit_status_updated/created with state=FAILED)
   * Requirements: 3.1, 3.2, 3.3
   */

  static fromEnvironment(): FilterConfig {
    // Simplified: always use 'failures' mode
    return new FilterConfig();
  }

  /**
   * Determines if an event should be processed based on failure detection
   * Requirements: 3.1, 3.2, 3.3
   *
   * @param eventType - The Bitbucket event type
   * @param eventData - The event payload
   * @returns true if the event is a failure event, false otherwise
   */
  shouldProcess(eventType: string, eventData: Record<string, any>): boolean {
    return this.isFailureEvent(eventType, eventData);
  }

  /**
   * Detects if an event is a failure event
   * Supports:
   * - Pull request declined: pullrequest:rejected
   * - Commit status failed: repo:commit_status_updated or repo:commit_status_created with state=FAILED
   * Requirements: 3.1, 3.2
   *
   * @param eventType - The Bitbucket event type
   * @param eventData - The event payload
   * @returns true if the event is a failure event, false otherwise
   */
  private isFailureEvent(eventType: string, eventData: Record<string, any>): boolean {
    // Check for PR declined
    if (eventType === 'pullrequest:rejected') {
      return true;
    }

    // Check for commit status failed
    if (eventType === 'repo:commit_status_updated' || eventType === 'repo:commit_status_created') {
      const state = eventData?.commit_status?.state;
      return state === 'FAILED';
    }

    // All other events are not failures
    return false;
  }
}
