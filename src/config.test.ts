/**
 * Tests for configuration management
 */

import { ConfigManager } from './config';
import * as fc from 'fast-check';

describe('ConfigManager', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Clear environment variables before each test
    process.env = { ...originalEnv };
    delete process.env.TEAMS_WEBHOOK_URL_SECRET_ARN;
    delete process.env.BITBUCKET_SECRET_ARN;
    delete process.env.IP_RESTRICTION_ENABLED;
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('loadFromEnvironment', () => {
    it('should load configuration with all required variables set', () => {
      process.env.TEAMS_WEBHOOK_URL_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:teams-webhook';
      process.env.BITBUCKET_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:bitbucket-secret';

      const config = ConfigManager.loadFromEnvironment();

      expect(config.teamsWebhookUrlSecretArn).toBe('arn:aws:secretsmanager:us-east-1:123456789012:secret:teams-webhook');
      expect(config.bitbucketSecretArn).toBe('arn:aws:secretsmanager:us-east-1:123456789012:secret:bitbucket-secret');
      expect(config.ipRestrictionEnabled).toBe(true);
    });

    it('should default IP_RESTRICTION_ENABLED to true when not set', () => {
      process.env.TEAMS_WEBHOOK_URL_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:teams-webhook';
      process.env.BITBUCKET_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:bitbucket-secret';

      const config = ConfigManager.loadFromEnvironment();

      expect(config.ipRestrictionEnabled).toBe(true);
    });

    it('should parse IP_RESTRICTION_ENABLED as false when set to "false"', () => {
      process.env.TEAMS_WEBHOOK_URL_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:teams-webhook';
      process.env.BITBUCKET_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:bitbucket-secret';
      process.env.IP_RESTRICTION_ENABLED = 'false';

      const config = ConfigManager.loadFromEnvironment();

      expect(config.ipRestrictionEnabled).toBe(false);
    });

    it('should parse IP_RESTRICTION_ENABLED as true when set to "true"', () => {
      process.env.TEAMS_WEBHOOK_URL_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:teams-webhook';
      process.env.BITBUCKET_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:bitbucket-secret';
      process.env.IP_RESTRICTION_ENABLED = 'true';

      const config = ConfigManager.loadFromEnvironment();

      expect(config.ipRestrictionEnabled).toBe(true);
    });

    it('should throw error when TEAMS_WEBHOOK_URL_SECRET_ARN is missing', () => {
      process.env.BITBUCKET_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:bitbucket-secret';

      expect(() => ConfigManager.loadFromEnvironment()).toThrow(
        'Missing required environment variable: TEAMS_WEBHOOK_URL_SECRET_ARN'
      );
    });

    it('should throw error when BITBUCKET_SECRET_ARN is missing', () => {
      process.env.TEAMS_WEBHOOK_URL_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:teams-webhook';

      expect(() => ConfigManager.loadFromEnvironment()).toThrow(
        'Missing required environment variable: BITBUCKET_SECRET_ARN'
      );
    });

    it('should throw error when both required variables are missing', () => {
      expect(() => ConfigManager.loadFromEnvironment()).toThrow(
        'Missing required environment variable: TEAMS_WEBHOOK_URL_SECRET_ARN'
      );
    });
  });

  describe('Property Tests', () => {
    // Property 14: Configuration Loading from Environment
    it('should load configuration correctly for any valid ARN strings', () => {
      fc.assert(
        fc.property(fc.webUrl(), fc.webUrl(), (teamsArn, bitbucketArn) => {
          process.env.TEAMS_WEBHOOK_URL_SECRET_ARN = teamsArn;
          process.env.BITBUCKET_SECRET_ARN = bitbucketArn;

          const config = ConfigManager.loadFromEnvironment();

          expect(config.teamsWebhookUrlSecretArn).toBe(teamsArn);
          expect(config.bitbucketSecretArn).toBe(bitbucketArn);
          expect(typeof config.ipRestrictionEnabled).toBe('boolean');
        }),
        { numRuns: 100 }
      );
    });

    // Property 15: Configuration Validation Fails Fast
    it('should fail fast when required configuration is missing', () => {
      fc.assert(
        fc.property(fc.boolean(), (missingTeams) => {
          if (missingTeams) {
            delete process.env.TEAMS_WEBHOOK_URL_SECRET_ARN;
            process.env.BITBUCKET_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:bitbucket-secret';
          } else {
            process.env.TEAMS_WEBHOOK_URL_SECRET_ARN = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:teams-webhook';
            delete process.env.BITBUCKET_SECRET_ARN;
          }

          expect(() => ConfigManager.loadFromEnvironment()).toThrow();
        }),
        { numRuns: 100 }
      );
    });
  });
});
