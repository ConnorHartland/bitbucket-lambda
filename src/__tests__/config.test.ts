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
      process.env.EVENT_FILTER = 'repo:push,pullrequest:created';
      process.env.FILTER_MODE = 'explicit';

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
      expect(config.eventFilter).toBe('repo:push,pullrequest:created');
      expect(config.filterMode).toBe('explicit');
    });

    it('should use default values for optional variables', () => {
      process.env.TEAMS_WEBHOOK_URL_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:teams-url';
      process.env.BITBUCKET_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:bitbucket-secret';
      process.env.BITBUCKET_IPS_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:bitbucket-ips';
      delete process.env.EVENT_FILTER;
      delete process.env.FILTER_MODE;

      const config = Configuration.loadFromEnvironment();

      expect(config.eventFilter).toBe('');
      expect(config.filterMode).toBe('all');
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

    it('should fail fast when FILTER_MODE is invalid', () => {
      process.env.TEAMS_WEBHOOK_URL_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:teams-url';
      process.env.BITBUCKET_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:bitbucket-secret';
      process.env.BITBUCKET_IPS_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:bitbucket-ips';
      process.env.FILTER_MODE = 'invalid_mode';

      expect(() => Configuration.loadFromEnvironment()).toThrow(
        'Configuration error: FILTER_MODE must be one of all, deployments, failures, explicit, got \'invalid_mode\''
      );
    });

    // Property 7: Configuration Loading from Environment
    // For any set of environment variables containing required configuration,
    // the system SHALL load all configuration values correctly
    it('Property 7: Configuration Loading from Environment', () => {
      fc.assert(
        fc.property(
          fc.webUrl(),
          fc.webUrl(),
          fc.webUrl(),
          fc.stringOf(fc.char(), { minLength: 1, maxLength: 100 }),
          fc.oneof(
            fc.constant('all'),
            fc.constant('deployments'),
            fc.constant('failures'),
            fc.constant('explicit')
          ),
          (teamsArn: string, bitbucketArn: string, bitbucketIpsArn: string, eventFilter: string, filterMode: string) => {
            process.env.TEAMS_WEBHOOK_URL_SECRET_ARN = teamsArn;
            process.env.BITBUCKET_SECRET_ARN = bitbucketArn;
            process.env.BITBUCKET_IPS_SECRET_ARN = bitbucketIpsArn;
            process.env.EVENT_FILTER = eventFilter;
            process.env.FILTER_MODE = filterMode;

            const config = Configuration.loadFromEnvironment();

            expect(config.teamsWebhookUrlSecretArn).toBe(teamsArn);
            expect(config.bitbucketSecretArn).toBe(bitbucketArn);
            expect(config.bitbucketIpsSecretArn).toBe(bitbucketIpsArn);
            expect(config.eventFilter).toBe(eventFilter);
            expect(config.filterMode).toBe(filterMode);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property 8: Configuration Validation Fails Fast
    // For any missing required configuration variable,
    // the system SHALL raise an error during initialization
    it('Property 8: Configuration Validation Fails Fast', () => {
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
    it('should create a Configuration instance with all parameters', () => {
      const config = new Configuration(
        'arn:aws:secretsmanager:us-east-1:123456789012:secret:teams-url',
        'arn:aws:secretsmanager:us-east-1:123456789012:secret:bitbucket-secret',
        'arn:aws:secretsmanager:us-east-1:123456789012:secret:bitbucket-ips',
        'repo:push',
        'explicit'
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
      expect(config.eventFilter).toBe('repo:push');
      expect(config.filterMode).toBe('explicit');
    });
  });
});

describe('FilterConfig', () => {
  describe('fromEnvironment', () => {
    it('should parse comma-separated event types', () => {
      const filterConfig = FilterConfig.fromEnvironment(
        'repo:push,pullrequest:created,pullrequest:updated',
        'explicit'
      );

      expect(filterConfig.eventTypes).toEqual([
        'repo:push',
        'pullrequest:created',
        'pullrequest:updated'
      ]);
    });

    it('should handle whitespace in event filter', () => {
      const filterConfig = FilterConfig.fromEnvironment(
        'repo:push , pullrequest:created , pullrequest:updated',
        'explicit'
      );

      expect(filterConfig.eventTypes).toEqual([
        'repo:push',
        'pullrequest:created',
        'pullrequest:updated'
      ]);
    });

    it('should handle empty event filter', () => {
      const filterConfig = FilterConfig.fromEnvironment('', 'all');

      expect(filterConfig.eventTypes).toEqual([]);
    });
  });

  describe('shouldProcess', () => {
    it('should process all events when mode is "all"', () => {
      const filterConfig = new FilterConfig('all', []);

      expect(filterConfig.shouldProcess('repo:push', {})).toBe(true);
      expect(filterConfig.shouldProcess('pullrequest:created', {})).toBe(true);
      expect(filterConfig.shouldProcess('pullrequest:comment_created', {})).toBe(true);
      expect(filterConfig.shouldProcess('repo:commit_status_updated', {})).toBe(true);
    });

    // Property 11: Filter Mode 'all' Processes All Events
    // For any event type, when filter mode is 'all',
    // the system SHALL process the event (not filter it out)
    it('Property 11: Filter Mode "all" Processes All Events', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1 }), (eventType: string) => {
          const filterConfig = new FilterConfig('all', []);
          expect(filterConfig.shouldProcess(eventType, {})).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should process only deployment events when mode is "deployments"', () => {
      const filterConfig = new FilterConfig('deployments', []);

      // Deployment events should be processed
      expect(filterConfig.shouldProcess('repo:commit_status_updated', {})).toBe(true);
      expect(filterConfig.shouldProcess('repo:commit_status_created', {})).toBe(true);
      expect(filterConfig.shouldProcess('pullrequest:approved', {})).toBe(true);
      expect(filterConfig.shouldProcess('pullrequest:unapproved', {})).toBe(true);

      // Non-deployment events should not be processed
      expect(filterConfig.shouldProcess('repo:push', {})).toBe(false);
      expect(filterConfig.shouldProcess('pullrequest:created', {})).toBe(false);
      expect(filterConfig.shouldProcess('pullrequest:comment_created', {})).toBe(false);
    });

    // Property 12: Filter Mode 'deployments' Filters Correctly
    // For any event type, when filter mode is 'deployments',
    // the system SHALL process only deployment-related events
    it('Property 12: Filter Mode "deployments" Filters Correctly', () => {
      const deploymentEvents = [
        'repo:commit_status_updated',
        'repo:commit_status_created',
        'pullrequest:approved',
        'pullrequest:unapproved'
      ];

      fc.assert(
        fc.property(fc.string({ minLength: 1 }), (eventType: string) => {
          const filterConfig = new FilterConfig('deployments', []);
          const shouldProcess = filterConfig.shouldProcess(eventType, {});
          const isDeploymentEvent = deploymentEvents.includes(eventType);

          expect(shouldProcess).toBe(isDeploymentEvent);
        }),
        { numRuns: 100 }
      );
    });

    it('should process only failure events when mode is "failures"', () => {
      const filterConfig = new FilterConfig('failures', []);

      // Failure events should be processed
      expect(
        filterConfig.shouldProcess('repo:commit_status_updated', {
          commit_status: { state: 'FAILED' }
        })
      ).toBe(true);
      expect(
        filterConfig.shouldProcess('repo:commit_status_created', {
          commit_status: { state: 'STOPPED' }
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
    });

    // Property 13: Filter Mode 'failures' Filters Correctly
    // For any event type, when filter mode is 'failures',
    // the system SHALL process only failure events
    it('Property 13: Filter Mode "failures" Filters Correctly', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant('repo:commit_status_updated'),
            fc.constant('repo:commit_status_created'),
            fc.constant('pullrequest:rejected'),
            fc.constant('repo:push'),
            fc.constant('pullrequest:created')
          ),
          (eventType: string) => {
            const filterConfig = new FilterConfig('failures', []);

            if (eventType === 'repo:commit_status_updated' || eventType === 'repo:commit_status_created') {
              const failedEvent = filterConfig.shouldProcess(eventType, {
                commit_status: { state: 'FAILED' }
              });
              const successEvent = filterConfig.shouldProcess(eventType, {
                commit_status: { state: 'SUCCESSFUL' }
              });

              expect(failedEvent).toBe(true);
              expect(successEvent).toBe(false);
            } else if (eventType === 'pullrequest:rejected') {
              expect(filterConfig.shouldProcess(eventType, {})).toBe(true);
            } else {
              expect(filterConfig.shouldProcess(eventType, {})).toBe(false);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should process only explicit events when mode is "explicit"', () => {
      const filterConfig = new FilterConfig('explicit', [
        'repo:push',
        'pullrequest:created'
      ]);

      // Explicit events should be processed
      expect(filterConfig.shouldProcess('repo:push', {})).toBe(true);
      expect(filterConfig.shouldProcess('pullrequest:created', {})).toBe(true);

      // Non-explicit events should not be processed
      expect(filterConfig.shouldProcess('pullrequest:updated', {})).toBe(false);
      expect(filterConfig.shouldProcess('pullrequest:comment_created', {})).toBe(false);
    });

    // Property 14: Filter Mode 'explicit' Filters Correctly
    // For any event type and explicit event filter list,
    // when filter mode is 'explicit', the system SHALL process only events in the filter list
    it('Property 14: Filter Mode "explicit" Filters Correctly', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 5 }),
          fc.string({ minLength: 1 }),
          (eventTypes: string[], testEventType: string) => {
            const filterConfig = new FilterConfig('explicit', eventTypes);
            const shouldProcess = filterConfig.shouldProcess(testEventType, {});
            const isInList = eventTypes.includes(testEventType);

            expect(shouldProcess).toBe(isInList);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Constructor', () => {
    it('should create a FilterConfig instance', () => {
      const filterConfig = new FilterConfig('explicit', ['repo:push', 'pullrequest:created']);

      expect(filterConfig.mode).toBe('explicit');
      expect(filterConfig.eventTypes).toEqual(['repo:push', 'pullrequest:created']);
    });

    it('should create a FilterConfig with empty event types', () => {
      const filterConfig = new FilterConfig('all', []);

      expect(filterConfig.mode).toBe('all');
      expect(filterConfig.eventTypes).toEqual([]);
    });
  });
});
