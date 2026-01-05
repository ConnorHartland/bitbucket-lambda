/**
 * AWS Secrets Manager Integration Tests
 * Tests for secret retrieval and caching
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import {
  getSecretsClient,
  getSecret,
  retrieveWebhookSecret,
  retrieveTeamsUrl,
  clearSecretCache,
  closeSecretsClient
} from './awsSecrets';
import { Configuration } from './config';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

// Mock AWS SDK
jest.mock('@aws-sdk/client-secrets-manager');

describe('AWS Secrets Manager Integration', () => {
  beforeEach(() => {
    clearSecretCache();
    closeSecretsClient();
    jest.clearAllMocks();
  });

  afterEach(() => {
    clearSecretCache();
    closeSecretsClient();
  });

  describe('getSecretsClient', () => {
    it('should return a SecretsManagerClient instance', () => {
      const client = getSecretsClient();
      expect(client).toBeDefined();
      expect(client).toBeInstanceOf(SecretsManagerClient);
    });

    it('should reuse the same client instance on subsequent calls', () => {
      const client1 = getSecretsClient();
      const client2 = getSecretsClient();
      expect(client1).toBe(client2);
    });
  });

  describe('getSecret', () => {
    it('should retrieve a secret from AWS Secrets Manager', async () => {
      const secretArn = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:test-secret';
      const secretValue = 'test-secret-value';

      const mockSend = jest.fn().mockResolvedValue({
        SecretString: secretValue
      });

      (SecretsManagerClient as jest.Mock).mockImplementation(() => ({
        send: mockSend,
        destroy: jest.fn()
      }));

      const result = await getSecret(secretArn);
      expect(result).toBe(secretValue);
      expect(mockSend).toHaveBeenCalled();
    });

    it('should cache secrets for warm invocations', async () => {
      const secretArn = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:test-secret';
      const secretValue = 'test-secret-value';

      const mockSend = jest.fn().mockResolvedValue({
        SecretString: secretValue
      });

      (SecretsManagerClient as jest.Mock).mockImplementation(() => ({
        send: mockSend,
        destroy: jest.fn()
      }));

      // First call should hit AWS
      const result1 = await getSecret(secretArn);
      expect(result1).toBe(secretValue);
      expect(mockSend).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const result2 = await getSecret(secretArn);
      expect(result2).toBe(secretValue);
      expect(mockSend).toHaveBeenCalledTimes(1); // Still 1, not 2
    });

    it('should handle binary secrets', async () => {
      const secretArn = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:test-secret';
      const secretValue = 'test-secret-value';
      const binaryData = Buffer.from(secretValue, 'utf-8');

      const mockSend = jest.fn().mockResolvedValue({
        SecretBinary: binaryData
      });

      (SecretsManagerClient as jest.Mock).mockImplementation(() => ({
        send: mockSend,
        destroy: jest.fn()
      }));

      const result = await getSecret(secretArn);
      expect(result).toBe(secretValue);
    });

    it('should throw error when secret retrieval fails', async () => {
      const secretArn = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:test-secret';
      const error = new Error('Access Denied');

      const mockSend = jest.fn().mockRejectedValue(error);

      (SecretsManagerClient as jest.Mock).mockImplementation(() => ({
        send: mockSend,
        destroy: jest.fn()
      }));

      await expect(getSecret(secretArn)).rejects.toThrow('Access Denied');
    });
  });

  describe('retrieveWebhookSecret', () => {
    it('should retrieve webhook secret using configuration', async () => {
      const config = new Configuration(
        'arn:aws:secretsmanager:us-east-1:123456789012:secret:teams-url',
        'arn:aws:secretsmanager:us-east-1:123456789012:secret:bitbucket-secret',
        '',
        'all'
      );

      const secretValue = 'webhook-secret-value';

      const mockSend = jest.fn().mockResolvedValue({
        SecretString: secretValue
      });

      (SecretsManagerClient as jest.Mock).mockImplementation(() => ({
        send: mockSend,
        destroy: jest.fn()
      }));

      const result = await retrieveWebhookSecret(config);
      expect(result).toBe(secretValue);
    });
  });

  describe('retrieveTeamsUrl', () => {
    it('should retrieve Teams URL using configuration', async () => {
      const config = new Configuration(
        'arn:aws:secretsmanager:us-east-1:123456789012:secret:teams-url',
        'arn:aws:secretsmanager:us-east-1:123456789012:secret:bitbucket-secret',
        '',
        'all'
      );

      const teamsUrl = 'https://outlook.webhook.office.com/webhookb2/...';

      const mockSend = jest.fn().mockResolvedValue({
        SecretString: teamsUrl
      });

      (SecretsManagerClient as jest.Mock).mockImplementation(() => ({
        send: mockSend,
        destroy: jest.fn()
      }));

      const result = await retrieveTeamsUrl(config);
      expect(result).toBe(teamsUrl);
    });
  });

  describe('Property: Secret Retrieval from AWS', () => {
    it('should retrieve secrets consistently', async () => {
      const secretArn = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:test';
      const secretValue = 'test-secret-value';

      const mockSend = jest.fn().mockResolvedValue({
        SecretString: secretValue
      });

      (SecretsManagerClient as jest.Mock).mockImplementation(() => ({
        send: mockSend,
        destroy: jest.fn()
      }));

      const result = await getSecret(secretArn);
      expect(result).toBe(secretValue);
    });
  });

  describe('Property: Secret Caching for Warm Invocations', () => {
    it('should cache secrets and not call AWS on second retrieval', async () => {
      const secretArn = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:test';
      const secretValue = 'test-secret-value';

      const mockSend = jest.fn().mockResolvedValue({
        SecretString: secretValue
      });

      (SecretsManagerClient as jest.Mock).mockImplementation(() => ({
        send: mockSend,
        destroy: jest.fn()
      }));

      // First call
      const result1 = await getSecret(secretArn);
      const callCount1 = mockSend.mock.calls.length;

      // Second call
      const result2 = await getSecret(secretArn);
      const callCount2 = mockSend.mock.calls.length;

      expect(result1).toBe(secretValue);
      expect(result2).toBe(secretValue);
      expect(callCount2).toBe(callCount1); // No additional calls
    });
  });
});
