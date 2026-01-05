/**
 * Tests for Configuration and FilterConfig classes
 * Property-based tests using fast-check
 */

import fc from 'fast-check';
import { Configuration, FilterConfig } from '../config';

describe('Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('loadFromEnvironment', () => {
    it('should load valid configuration from environment variables', () => {
      process.env.TEAMS_WEBHOOK_URL_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:teams-url';
      process.env.BITBUCKET_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:bitbucket-secret';
      process.env.BITBUCKET_IPS_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:bitbucket-ips';

      const config = Configuration.loadFromEnvironment();

      expect(config.teamsWebhookUrlSecretArn).toBe(
        'arn:aws:secretsmanager:us-east-1:123456789012:secret:teams-url'
      );
      expect(config.bitbucketSecretArn).toBe(
        'arn:aws:secretsmanager:us-east-1:123456789012:secret:bitbucket-secret'
      );
      expect(config.bitbucketIpsSecretArn).toBe(
        'arn:aws:secretsmanager:us-east-1:123456789012:secret:bitbucket-ips'
      );
    });

    it('should fail fast when TEAMS_WEBHOOK_URL_SECRET_ARN is missing', () => {
      delete process.env.TEAMS_WEBHOOK_URL_SECRET_ARN;
      process.env.BITBUCKET_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:bitbucket-secret';
      process.env.BITBUCKET_IPS_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:bitbucket-ips';

      expect(() => Configuration.loadFromEnvironment()).toThrow(
        'Configuration error: TEAMS_WEBHOOK_URL_SECRET_ARN environment variable is required'
      );
    });

    it('should fail fast when BITBUCKET_SECRET_ARN is missing', () => {
      process.env.TEAMS_WEBHOOK_URL_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:teams-url';
      delete process.env.BITBUCKET_SECRET_ARN;
      process.env.BITBUCKET_IPS_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:bitbucket-ips';

      expect(() => Configuration.loadFromEnvironment()).toThrow(
        'Configuration error: BITBUCKET_SECRET_ARN environment variable is required'
      );
    });

    it('should fail fast when BITBUCKET_IPS_SECRET_ARN is missing', () => {
      process.env.TEAMS_WEBHOOK_URL_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:teams-url';
      process.env.BITBUCKET_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:bitbucket-secret';
      delete process.env.BITBUCKET_IPS_SECRET_ARN;

      expect(() => Configuration.loadFromEnvironment()).toThrow(
        'Configuration error: BITBUCKET_IPS_SECRET_ARN environment variable is required'
      );
    });

    // Property 14: Configuration Loading from Environment
    // For any set of environment variables containing required configuration,
    // the system SHALL load all configuration values correctly
    it('Property 14: Configuration Loading from Environment', () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          fc.webUrl(),
          fc.webUrl(),
          (teamsArn: string, bitbucketArn: string, bitbucketIpsArn: string) => {
            process.env.TEAMS_WEBHOOK_URL_SECRET_ARN = teamsArn;
            process.env.BITBUCKET_SECRET_ARN = bitbucketArn;
            process.env.BITBUCKET_IPS_SECRET_ARN = bitbucketIpsArn;

            const config = Configuration.loadFromEnvironment();

            expect(config.teamsWebhookUrlSecretArn).toBe(teamsArn);
            expect(config.bitbucketSecretArn).toBe(bitbucketArn);
            expect(config.bitbucketIpsSecretArn).toBe(bitbucketIpsArn);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property 15: Configuration Validation Fails Fast
    // For any missing required configuration variable,
    // the system SHALL raise an error during initialization
    it('Property 15: Configuration Validation Fails Fast', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 2 }), (missingIndex: number) => {
          process.env.TEAMS_WEBHOOK_URL_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:teams-url';
          process.env.BITBUCKET_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:bitbucket-secret';
          process.env.BITBUCKET_IPS_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:bitbucket-ips';

          if (missingIndex === 0) {
            delete process.env.TEAMS_WEBHOOK_URL_SECRET_ARN;
          } else if (missingIndex === 1) {
            delete process.env.BITBUCKET_SECRET_ARN;
          } else {
            delete process.env.BITBUCKET_IPS_SECRET_ARN;
          }

          expect(() => Configuration.loadFromEnvironment()).toThrow();
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Constructor', () => {
    it('should create a Configuration instance with required parameters', () => {
      const config = new Configuration(
        'arn:aws:secretsmanager:us-east-1:123456789012:secret:teams-url',
        'arn:aws:secretsmanager:us-east-1:123456789012:secret:bitbucket-secret',
        'arn:aws:secretsmanager:us-east-1:123456789012:secret:bitbucket-ips'
      );

      expect(config.teamsWebhookUrlSecretArn).toBe(
        'arn:aws:secretsmanager:us-east-1:123456789012:secret:teams-url'
      );
      expect(config.bitbucketSecretArn).toBe(
        'arn:aws:secretsmanager:us-east-1:123456789012:secret:bitbucket-secret'
      );
      expect(config.bitbucketIpsSecretArn).toBe(
        'arn:aws:secretsmanager:us-east-1:123456789012:secret:bitbucket-ips'
      );
    });
  });
});

describe('FilterConfig', () => {
  describe('fromEnvironment', () => {
    it('should create a FilterConfig instance', () => {
      const filterConfig = FilterConfig.fromEnvironment();

      expect(filterConfig).toBeDefined();
    });
  });

  describe('shouldProcess', () => {
    it('should process only failure events', () => {
      const filterConfig = new FilterConfig();

      // Failure events should be processed
      expect(
        filterConfig.shouldProcess('repo:commit_status_updated', {
          commit_status: { state: 'FAILED' }
        })
      ).toBe(true);
      expect(
        filterConfig.shouldProcess('repo:commit_status_created', {
          commit_status: { state: 'FAILED' }
        })
      ).toBe(true);
      expect(filterConfig.shouldProcess('pullrequest:rejected', {})).toBe(true);

      // Non-failure events should not be processed
      expect(
        filterConfig.shouldProcess('repo:commit_status_updated', {
          commit_status: { state: 'SUCCESSFUL' }
        })
      ).toBe(false);
      expect(filterConfig.shouldProcess('repo:push', {})).toBe(false);
      expect(filterConfig.shouldProcess('pullrequest:created', {})).toBe(false);
      expect(filterConfig.shouldProcess('pullrequest:comment_created', {})).toBe(false);
    });

    // Property 6: PR Declined Detected as Failure
    // For any pull request declined event, the failure detector SHALL identify it as a failure event
    it('Property 6: PR Declined Detected as Failure', () => {
      fc.assert(
        fc.property(fc.anything(), (eventData: any) => {
          const filterConfig = new FilterConfig();
          expect(filterConfig.shouldProcess('pullrequest:rejected', eventData)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    // Property 7: Commit Status Failed Detected as Failure
    // For any commit status event with state='FAILED', the failure detector SHALL identify it as a failure event
    it('Property 7: Commit Status Failed Detected as Failure', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('repo:commit_status_updated'),
            fc.constant('repo:commit_status_created')
          ),
          (eventType: string) => {
            const filterConfig = new FilterConfig();
            const eventData = { commit_status: { state: 'FAILED' } };
            expect(filterConfig.shouldProcess(eventType, eventData)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property 8: Non-Failure Events Ignored
    // For any non-failure event, the system SHALL return a 200 response without posting to Teams
    it('Property 8: Non-Failure Events Ignored', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('repo:push'),
            fc.constant('pullrequest:created'),
            fc.constant('pullrequest:updated'),
            fc.constant('pullrequest:comment_created'),
            fc.constant('repo:commit_comment_created')
          ),
          (eventType: string) => {
            const filterConfig = new FilterConfig();
            expect(filterConfig.shouldProcess(eventType, {})).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property: Commit Status Success Not Detected as Failure
    // For any commit status event with state='SUCCESSFUL', the failure detector SHALL NOT identify it as a failure
    it('Property: Commit Status Success Not Detected as Failure', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('repo:commit_status_updated'),
            fc.constant('repo:commit_status_created')
          ),
          (eventType: string) => {
            const filterConfig = new FilterConfig();
            const eventData = { commit_status: { state: 'SUCCESSFUL' } };
            expect(filterConfig.shouldProcess(eventType, eventData)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Constructor', () => {
    it('should create a FilterConfig instance', () => {
      const filterConfig = new FilterConfig();

      expect(filterConfig).toBeDefined();
    });
  });
});
