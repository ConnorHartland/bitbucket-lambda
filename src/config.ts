/**
 * Configuration Management Module
 * Loads and validates configuration from environment variables
 */

export class Configuration {
  teamsWebhookUrlSecretArn: string;
  bitbucketSecretArn: string;
  bitbucketIpsSecretArn: string;
  eventFilter: string;
  filterMode: string;

  constructor(
    teamsWebhookUrlSecretArn: string,
    bitbucketSecretArn: string,
    bitbucketIpsSecretArn: string,
    eventFilter: string = '',
    filterMode: string = 'all'
  ) {
    this.teamsWebhookUrlSecretArn = teamsWebhookUrlSecretArn;
    this.bitbucketSecretArn = bitbucketSecretArn;
    this.bitbucketIpsSecretArn = bitbucketIpsSecretArn;
    this.eventFilter = eventFilter;
    this.filterMode = filterMode;
  }

  static loadFromEnvironment(): Configuration {
    const teamsWebhookUrlSecretArn = process.env.TEAMS_WEBHOOK_URL_SECRET_ARN;
    const bitbucketSecretArn = process.env.BITBUCKET_SECRET_ARN;
    const bitbucketIpsSecretArn = process.env.BITBUCKET_IPS_SECRET_ARN;
    const eventFilter = process.env.EVENT_FILTER || '';
    const filterMode = process.env.FILTER_MODE || 'all';

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

    const validFilterModes = ['all', 'deployments', 'failures', 'explicit'];
    if (!validFilterModes.includes(filterMode)) {
      throw new Error(
        `Configuration error: FILTER_MODE must be one of ${validFilterModes.join(', ')}, got '${filterMode}'`
      );
    }

    return new Configuration(teamsWebhookUrlSecretArn, bitbucketSecretArn, bitbucketIpsSecretArn, eventFilter, filterMode);
  }
}

export class FilterConfig {
  mode: string;
  eventTypes: string[];

  constructor(mode: string, eventTypes: string[] = []) {
    this.mode = mode;
    this.eventTypes = eventTypes;
  }

  static fromEnvironment(eventFilter: string, filterMode: string): FilterConfig {
    const eventTypes = eventFilter
      .split(',')
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    return new FilterConfig(filterMode, eventTypes);
  }

  shouldProcess(eventType: string, eventData: Record<string, any>): boolean {
    switch (this.mode) {
      case 'all':
        return true;
      case 'deployments':
        return this.isDeploymentEvent(eventType);
      case 'failures':
        return this.isFailureEvent(eventType, eventData);
      case 'explicit':
        return this.eventTypes.includes(eventType);
      default:
        return false;
    }
  }

  private isDeploymentEvent(eventType: string): boolean {
    return [
      'repo:commit_status_updated',
      'repo:commit_status_created',
      'pullrequest:approved',
      'pullrequest:unapproved'
    ].includes(eventType);
  }

  private isFailureEvent(eventType: string, eventData: Record<string, any>): boolean {
    if (eventType === 'repo:commit_status_updated' || eventType === 'repo:commit_status_created') {
      const state = eventData?.commit_status?.state;
      return state === 'FAILED' || state === 'STOPPED';
    }

    return eventType === 'pullrequest:rejected';
  }
}
