/**
 * AWS Secrets Manager Integration Module
 * Retrieves secrets from AWS Secrets Manager with caching for warm invocations
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import {
  SecretsManagerClient,
  GetSecretValueCommand,
  GetSecretValueCommandInput
} from '@aws-sdk/client-secrets-manager';
import { Configuration } from '../config';

const secretCache: Map<string, string> = new Map();
let secretsClient: SecretsManagerClient | null = null;

export function getSecretsClient(): SecretsManagerClient {
  if (!secretsClient) {
    secretsClient = new SecretsManagerClient({ region: process.env.AWS_REGION || 'us-east-1' });
  }
  return secretsClient;
}

export async function getSecret(secretArn: string): Promise<string> {
  if (secretCache.has(secretArn)) {
    return secretCache.get(secretArn)!;
  }

  try {
    const client = getSecretsClient();
    const response = await client.send(
      new GetSecretValueCommand({ SecretId: secretArn } as GetSecretValueCommandInput)
    );

    let secretValue: string;
    if (response.SecretString) {
      secretValue = response.SecretString;
    } else if (response.SecretBinary) {
      const binaryData = response.SecretBinary;
      const buffer = Buffer.isBuffer(binaryData)
        ? binaryData
        : Buffer.from(binaryData as unknown as string, 'base64');
      secretValue = buffer.toString('utf-8');
    } else {
      throw new Error('Secret value not found in response');
    }

    secretCache.set(secretArn, secretValue);
    return secretValue;
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Failed to retrieve secret from AWS Secrets Manager: ${error.message}`);
      if ('Code' in error) {
        console.error(`AWS Error Code: ${(error as any).Code}`);
      }
    }
    throw error;
  }
}

export const retrieveWebhookSecret = (config: Configuration) => getSecret(config.bitbucketSecretArn);
export const retrieveTeamsUrl = (config: Configuration) => getSecret(config.teamsWebhookUrlSecretArn);
export const clearSecretCache = () => secretCache.clear();
export const closeSecretsClient = () => {
  if (secretsClient) {
    secretsClient.destroy();
    secretsClient = null;
  }
};
