/**
 * Lambda handler entry point for Bitbucket to Teams webhook integration
 * Orchestrates the complete webhook processing pipeline:
 * 1. Load configuration
 * 2. Extract headers and body from event
 * 3. Check IP whitelist (if enabled)
 * 4. Verify signature
 * 5. Load secrets
 * 6. Detect failure
 * 7. Format and post to Teams if failure
 * 8. Return 200 OK for all outcomes
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, LambdaContext } from './types';
import { ConfigManager } from './config';
import { Logger } from './logger';
import { getSecret } from './secrets';
import { extractWebhookData, parseWebhookBody } from './webhook/reception';
import { extractSourceIp, isIpWhitelisted, setIpRanges } from './webhook/ipWhitelist';
import { verifySignature } from './webhook/signature';
import { detectFailure } from './webhook/failureDetector';
import { formatMessage } from './webhook/formatter';
import { postToTeams } from './webhook/teamsClient';

/**
 * Lambda handler for Bitbucket to Teams webhook integration
 * Processes incoming Bitbucket webhooks and posts failure notifications to Teams
 *
 * @param event The API Gateway proxy event
 * @param context The Lambda context
 * @returns Promise<APIGatewayProxyResult> Always returns 200 OK
 */
export async function handler(
  event: APIGatewayProxyEvent,
  context: LambdaContext
): Promise<APIGatewayProxyResult> {
  // Create logger with request ID and event type (if available)
  const requestId = context.requestId || event.requestContext?.requestId || 'unknown';
  let logger = new Logger(requestId);

  try {
    // Step 1: Load configuration from environment variables
    let config;
    try {
      config = ConfigManager.loadFromEnvironment();
      // Set IP ranges from configuration
      setIpRanges(config.bitbucketIpRanges);
    } catch (error) {
      logger.error('Failed to load configuration', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'OK' }),
      };
    }

    // Step 2: Extract headers and body from event
    const webhookData = extractWebhookData(event, logger);
    if (!webhookData) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'OK' }),
      };
    }

    // Update logger with event type
    logger = new Logger(requestId, webhookData.eventType);

    // Step 3: Check IP whitelist (if enabled)
    if (config.ipRestrictionEnabled) {
      const sourceIp = extractSourceIp(event);
      if (!sourceIp) {
        logger.warn('Could not extract source IP from event');
        return {
          statusCode: 200,
          body: JSON.stringify({ message: 'OK' }),
        };
      }

      if (!isIpWhitelisted(sourceIp)) {
        logger.warn('Request from non-whitelisted IP', { sourceIp });
        return {
          statusCode: 200,
          body: JSON.stringify({ message: 'OK' }),
        };
      }
    }

    // Step 4: Load secrets
    let bitbucketSecret: string;
    let teamsWebhookUrl: string;

    try {
      bitbucketSecret = await getSecret(config.bitbucketSecretArn, logger);
      teamsWebhookUrl = await getSecret(config.teamsWebhookUrlSecretArn, logger);
    } catch (error) {
      logger.error('Failed to load secrets', {
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'OK' }),
      };
    }

    // Step 5: Verify signature
    if (!verifySignature(webhookData.body, webhookData.signature, bitbucketSecret)) {
      logger.warn('Invalid webhook signature');
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'OK' }),
      };
    }

    // Step 6: Parse webhook body
    const payload = parseWebhookBody(webhookData.body, logger);
    if (!payload) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'OK' }),
      };
    }

    // Step 7: Detect failure
    const failure = detectFailure(webhookData.eventType, payload);
    if (!failure) {
      // Non-failure event, return 200 silently
      logger.info('Non-failure event received, ignoring');
      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'OK' }),
      };
    }

    // Step 8: Format and post to Teams if failure
    const message = formatMessage(failure);
    const posted = await postToTeams(message, teamsWebhookUrl, logger);

    if (posted) {
      logger.info('Failure notification posted to Teams', {
        failureType: failure.type,
        repository: failure.repository,
      });
    } else {
      logger.error('Failed to post failure notification to Teams', {
        failureType: failure.type,
        repository: failure.repository,
      });
    }

    // Always return 200 OK
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'OK' }),
    };
  } catch (error) {
    // Catch any unexpected errors
    logger.error('Unexpected error in Lambda handler', {
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'OK' }),
    };
  }
}
