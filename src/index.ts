/**
 * Lambda Handler - Main Entry Point
 * Orchestrates the complete webhook processing pipeline
 * Requirements: 1.1, 1.2, 1.6, 1.7, 3.3, 5.1
 */

import { Configuration, FilterConfig } from './config';
import { extractWebhookEvent, getRequestId, APIGatewayProxyEvent } from './webhook/reception';
import { validateWebhookSignature } from './webhook/signature';
import { retrieveWebhookSecret, retrieveTeamsUrl } from './aws/secrets';
import { validateSourceIp } from './webhook/ipRestriction';
import { formatMessage, FailureEvent } from './teams/formatter';
import { postToTeams } from './teams/client';
import { handleError, validateJsonPayload, APIGatewayProxyResult, SignatureVerificationError } from './utils/errorHandler';
import { logger } from './utils/logging';

/**
 * Module-level configuration
 * Loaded on initialization and reused across invocations
 * Requirements: 6.1, 6.2, 6.5
 */
let config: Configuration | null = null;
let filterConfig: FilterConfig | null = null;
let initializationError: Error | null = null;

/**
 * Initialize configuration on module load
 * Fails fast if configuration is missing
 * Requirements: 6.1, 6.2, 6.5
 */
function initializeConfiguration(): void {
  try {
    config = Configuration.loadFromEnvironment();
    filterConfig = new FilterConfig();
    logger.info('Configuration loaded successfully');
  } catch (error) {
    initializationError = error as Error;
    logger.error(`Configuration initialization failed: ${(error as Error).message}`);
  }
}

// Initialize configuration on module load
initializeConfiguration();

/**
 * Lambda handler function
 * Orchestrates the complete webhook processing pipeline
 * Requirements: 1.1, 1.2, 1.6, 1.7, 3.3, 5.1
 *
 * @param event - API Gateway proxy event
 * @param context - Lambda context
 * @returns API Gateway proxy response
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  _context: any
): Promise<APIGatewayProxyResult> => {
  const requestId = getRequestId(event);
  let eventType = 'unknown';

  try {
    // Requirement 6.1, 6.2, 6.5: Fail fast if configuration is not loaded
    if (initializationError) {
      logger.error(
        `Configuration initialization failed: ${initializationError.message}`,
        requestId
      );
      return handleError(initializationError, requestId);
    }

    if (!config || !filterConfig) {
      const error = new Error('Configuration not initialized');
      logger.error('Configuration not initialized', requestId);
      return handleError(error, requestId);
    }

    // Validate source IP against allowed Bitbucket ranges
    logger.info('Validating source IP', requestId);
    const ipValidation = await validateSourceIp(event, config.bitbucketIpsSecretArn, requestId);
    if (!ipValidation.isValid) {
      logger.warn(`IP validation failed: ${ipValidation.reason}`, requestId);
      return {
        statusCode: 200,
        body: JSON.stringify({
          statusCode: 200,
          message: 'Access denied',
          requestId
        })
      };
    }

    // Requirement 1.1, 1.2, 1.3, 1.4: Extract headers and body from API Gateway event
    logger.info('Extracting webhook event', requestId);
    let webhookEvent;
    try {
      webhookEvent = extractWebhookEvent(event);
    } catch (error) {
      // If signature header is missing, treat as signature verification error
      if ((error as Error).message.includes('X-Hub-Signature')) {
        throw new SignatureVerificationError((error as Error).message);
      }
      throw error;
    }
    eventType = webhookEvent.eventType;

    // Requirement 1.5: Validate JSON payload
    logger.info('Validating JSON payload', requestId, eventType);
    const payload = validateJsonPayload(webhookEvent.body);

    // Requirement 1.6, 1.7: Verify signature
    logger.info('Verifying webhook signature', requestId, eventType);
    const webhookSecret = await retrieveWebhookSecret(config);
    const [isValid, signatureError] = validateWebhookSignature(
      webhookEvent.headers,
      webhookEvent.body,
      webhookSecret
    );

    if (!isValid) {
      logger.error(`Signature verification failed: ${signatureError}`, requestId, eventType);
      throw new SignatureVerificationError(signatureError || 'Signature verification failed');
    }

    logger.info('Signature verified successfully', requestId, eventType);

    // Requirement 3.3: Filter events - only process failures
    logger.info('Checking if event is a failure', requestId, eventType);
    const shouldProcess = filterConfig.shouldProcess(eventType, payload);

    if (!shouldProcess) {
      logger.info('Event is not a failure, ignoring', requestId, eventType);
      return {
        statusCode: 200,
        body: JSON.stringify({
          statusCode: 200,
          message: 'Event processed',
          requestId
        })
      };
    }

    // Requirement 3.1, 3.2: Extract failure details
    logger.info('Extracting failure details', requestId, eventType);
    const failureEvent = extractFailureDetails(eventType, payload);

    // Requirement 4.1, 4.2, 4.3: Format message
    logger.info('Formatting Teams message', requestId, eventType);
    const teamsMessage = formatMessage(failureEvent);

    // Requirement 5.1: Post to Teams
    logger.info('Posting to Teams', requestId, eventType);
    const teamsUrl = await retrieveTeamsUrl(config);
    const postSuccess = await postToTeams(teamsMessage, teamsUrl);

    if (!postSuccess) {
      logger.error('Failed to post to Teams', requestId, eventType);
      // Requirement 5.3: Return 200 even if Teams posting fails
      return {
        statusCode: 200,
        body: JSON.stringify({
          statusCode: 200,
          message: 'Webhook processed (Teams posting failed)',
          requestId
        })
      };
    }

    logger.info('Successfully posted to Teams', requestId, eventType);

    // Requirement 1.7: Return success response
    return {
      statusCode: 200,
      body: JSON.stringify({
        statusCode: 200,
        message: 'Webhook processed successfully',
        requestId
      })
    };
  } catch (error) {
    logger.error(`Unexpected error: ${(error as Error).message}`, requestId, eventType);
    return handleError(error as Error, requestId, eventType);
  }
};

/**
 * Extract failure details from event payload
 * Requirements: 3.1, 3.2
 *
 * @param eventType - The Bitbucket event type
 * @param payload - The event payload
 * @returns FailureEvent with extracted details
 */
function extractFailureDetails(eventType: string, payload: Record<string, any>): FailureEvent {
  if (eventType === 'pullrequest:rejected') {
    const pr = payload.pullrequest;
    const repository = payload.repository?.full_name || 'unknown';
    const author = pr?.author?.display_name || 'Unknown';
    const reason = pr?.reason || 'Pull request declined';
    const link = pr?.links?.html?.href || '';

    return {
      type: 'PR Declined',
      repository,
      author,
      reason,
      link
    };
  }

  if (eventType === 'repo:commit_status_updated' || eventType === 'repo:commit_status_created') {
    const commitStatus = payload.commit_status;
    const repository = payload.repository?.full_name || 'unknown';
    const buildName = commitStatus?.name || 'Build';
    const reason = `${buildName} failed`;
    const link = commitStatus?.url || '';

    return {
      type: 'Build Failed',
      repository,
      author: 'Build System',
      reason,
      link
    };
  }

  throw new Error(`Unsupported failure event type: ${eventType}`);
}
