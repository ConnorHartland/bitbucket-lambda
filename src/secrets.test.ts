/**
 * Tests for secret retrieval from AWS Secrets Manager
 */

import * as fc from 'fast-check';

// Mock AWS SDK before importing the module
jest.mock('@aws-sdk/client-secrets-manager');

import { getSecret, clearSecretCache, getCacheStats, resetSecretsManagerClient } from './secrets';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { Logger } from './logger';

describe('Secret Retrieval', () => {
  beforeEach(() => {
    clearSecretCache();
    resetSecretsManagerClient();
    jest.clearAllMocks();
  });

  describe('getSecret', () => {
    it('should retrieve a secret from AWS Secrets Manager', async () => {
      const arn = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:test-secret';
      const secretValue = 'my-secret-value';

      const mockSend = jest.fn().mockResolvedValue({
        SecretString: secretValue,
      });

      (SecretsManagerClient as jest.Mock).mockImplementation(() => ({
        send: mockSend,
      }));

      const result = await getSecret(arn);

      expect(result).toBe(secretValue);
      expect(mockSend).toHaveBeenCalledWith(expect.any(GetSecretValueCommand));
    });

    it('should cache the secret for subsequent calls', async () => {
      const arn = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:test-secret';
      const secretValue = 'my-secret-value';

      const mockSend = jest.fn().mockResolvedValue({
        SecretString: secretValue,
      });

      (SecretsManagerClient as jest.Mock).mockImplementation(() => ({
        send: mockSend,
      }));

      // First call
      const result1 = await getSecret(arn);
      expect(result1).toBe(secretValue);

      // Second call should use cache
      const result2 = await getSecret(arn);
      expect(result2).toBe(secretValue);

      // AWS should only be called once due to caching
      expect(mockSend).toHaveBeenCalledTimes(1);
    });

    it('should handle binary secrets', async () => {
      const arn = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:test-secret';
      const secretValue = 'my-binary-secret';
      const binaryBuffer = Buffer.from(secretValue, 'utf-8');

      const mockSend = jest.fn().mockResolvedValue({
        SecretBinary: binaryBuffer,
      });

      (SecretsManagerClient as jest.Mock).mockImplementation(() => ({
        send: mockSend,
      }));

      const result = await getSecret(arn);

      expect(result).toBe(secretValue);
    });

    it('should throw error when secret has no value', async () => {
      const arn = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:test-secret';

      const mockSend = jest.fn().mockResolvedValue({});

      (SecretsManagerClient as jest.Mock).mockImplementation(() => ({
        send: mockSend,
      }));

      await expect(getSecret(arn)).rejects.toThrow('Secret has no SecretString or SecretBinary');
    });

    it('should handle AWS errors gracefully', async () => {
      const arn = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:test-secret';
      const errorMessage = 'ResourceNotFoundException';

      const mockSend = jest.fn().mockRejectedValue(new Error(errorMessage));

      (SecretsManagerClient as jest.Mock).mockImplementation(() => ({
        send: mockSend,
      }));

      await expect(getSecret(arn)).rejects.toThrow(`Failed to retrieve secret: ${errorMessage}`);
    });

    it('should log errors when logger is provided', async () => {
      const arn = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:test-secret';
      const errorMessage = 'AccessDenied';
      const logger = new Logger('test-request-id', 'test-event');

      const mockSend = jest.fn().mockRejectedValue(new Error(errorMessage));

      (SecretsManagerClient as jest.Mock).mockImplementation(() => ({
        send: mockSend,
      }));

      const loggerErrorSpy = jest.spyOn(logger, 'error');

      await expect(getSecret(arn, logger)).rejects.toThrow();
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Failed to retrieve secret from AWS Secrets Manager',
        expect.objectContaining({
          arn,
          error: errorMessage,
        })
      );
    });

    it('should clear cache when clearSecretCache is called', async () => {
      const arn = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:test-secret';
      const secretValue = 'my-secret-value';

      const mockSend = jest.fn().mockResolvedValue({
        SecretString: secretValue,
      });

      (SecretsManagerClient as jest.Mock).mockImplementation(() => ({
        send: mockSend,
      }));

      // First call
      await getSecret(arn);
      expect(mockSend).toHaveBeenCalledTimes(1);

      // Clear cache
      clearSecretCache();

      // Second call should hit AWS again
      await getSecret(arn);
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('should return cache statistics', async () => {
      const arn1 = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:test-secret-1';
      const arn2 = 'arn:aws:secretsmanager:us-east-1:123456789012:secret:test-secret-2';

      const mockSend = jest.fn().mockResolvedValue({
        SecretString: 'secret-value',
      });

      (SecretsManagerClient as jest.Mock).mockImplementation(() => ({
        send: mockSend,
      }));

      await getSecret(arn1);
      await getSecret(arn2);

      const stats = getCacheStats();
      expect(stats.size).toBe(2);
      expect(stats.entries).toContain(arn1);
      expect(stats.entries).toContain(arn2);
    });
  });

  describe('Property Tests', () => {
    it('should retrieve any valid secret from AWS Secrets Manager', async () => {
      await fc.assert(
        fc.asyncProperty(fc.stringMatching(/^[a-zA-Z0-9]+$/), async (secretValue) => {
          const arn = `arn:aws:secretsmanager:us-east-1:123456789012:secret:test-${secretValue}`;

          // Reset for each iteration
          clearSecretCache();
          resetSecretsManagerClient();
          jest.clearAllMocks();

          const mockSend = jest.fn().mockResolvedValue({
            SecretString: secretValue,
          });

          (SecretsManagerClient as jest.Mock).mockImplementation(() => ({
            send: mockSend,
          }));

          const result = await getSecret(arn);

          expect(result).toBe(secretValue);
        }),
        { numRuns: 100 }
      );
    });

    it('should cache secrets and reduce AWS calls for repeated retrievals', async () => {
      await fc.assert(
        fc.asyncProperty(fc.stringMatching(/^[a-zA-Z0-9]+$/), async (secretValue) => {
          const arn = `arn:aws:secretsmanager:us-east-1:123456789012:secret:test-${secretValue}`;

          // Reset for each iteration
          clearSecretCache();
          resetSecretsManagerClient();
          jest.clearAllMocks();

          const mockSend = jest.fn().mockResolvedValue({
            SecretString: secretValue,
          });

          (SecretsManagerClient as jest.Mock).mockImplementation(() => ({
            send: mockSend,
          }));

          // Call multiple times
          const result1 = await getSecret(arn);
          const result2 = await getSecret(arn);
          const result3 = await getSecret(arn);

          // All results should be the same
          expect(result1).toBe(secretValue);
          expect(result2).toBe(secretValue);
          expect(result3).toBe(secretValue);

          // But AWS should only be called once
          expect(mockSend).toHaveBeenCalledTimes(1);
        }),
        { numRuns: 100 }
      );
    });
  });
});
