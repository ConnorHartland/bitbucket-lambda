/**
 * Lambda Handler - Main Entry Point
 * Orchestrates the complete webhook processing pipeline
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 5.5, 5.6, 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9, 12.10
 */

import { Configuration, FilterConfig } from './config';
import { extractWebhookEvent, getRequestId, APIGatewayProxyEvent } from './webhook/reception';
import { validateWebhookSignature } from './webhook/signature';
import { retrieveWebhookSecret, retrieveTeamsUrl } from './aws/secrets';
import { validateSourceIp } from './webhook/ipRestriction';
import { parse as parseEvent } from './webhook/parser';
import { formatTeamsMessage } from './teams/formatter';
import { postToTeams } from './teams/client';
import { handleError, validateJsonPayload, APIGatewayProxyResult, SignatureVerificationError } from './utils/errorHandler';
import { logger } from './utils/logging';
import { emitEventTypeMetric, emitSignatureFailure, emitUnsupportedEvent, emitProcessingDuration } from './aws/metrics';

/**
 * Module-level configuration and filter config
 * Loaded on initialization and reused across invocations
 * Requirements: 12.3, 12.4, 12.5
 */
let config: Configuration | null = null;
let filterConfig: FilterConfig | null = null;
let initializationError: Error | null = null;

/**
 * Initialize configuration on module load
 * Fails fast if configuration is missing
 * Requirements: 12.3, 12.4, 12.5
 */
function initializeConfiguration(): void {
  try {
    config = Configuration.loadFromEnvironment();
    filterConfig = FilterConfig.fromEnvironment(config.eventFilter, config.filterMode);
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
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9, 12.10
 *
 * @param event - API Gateway proxy event
 * @param context - Lambda context
 * @returns API Gateway proxy response
 */
export const handler = async (
  event: APIGatewayProxyEvent,
  _context: any
): Promise<APIGatewayProxyResult> => {
  const startTime = Date.now();
  const requestId = getRequestId(event);
  let eventType = 'unknown';
  let eventCategory = 'unknown';

  try {
    // Requirement 12.4, 12.5: Fail fast if configuration is not loaded
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
        statusCode: 403,
        body: JSON.stringify({
          statusCode: 403,
          message: 'Access denied',
          requestId,
          reason: ipValidation.reason
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
      emitSignatureFailure();
      throw new SignatureVerificationError(signatureError || 'Signature verification failed');
    }

    logger.info('Signature verified successfully', requestId, eventType);

    // Requirement 11.1: Emit metric for event type
    emitEventTypeMetric(eventType);

    // Requirement 5.5, 5.6: Filter events
    logger.info('Filtering event', requestId, eventType);
    const shouldProcess = filterConfig.shouldProcess(eventType, payload);

    if (!shouldProcess) {
      logger.info('Event filtered out', requestId, eventType);
      const durationMs = Date.now() - startTime;
      emitProcessingDuration(durationMs);

      return {
        statusCode: 200,
        body: JSON.stringify({
          statusCode: 200,
          message: 'Event filtered',
          requestId,
          eventType,
          eventCategory: 'filtered',
          processingDurationMs: durationMs
        })
      };
    }

    // Requirement 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7: Parse events
    logger.info('Parsing event', requestId, eventType);
    const parsedEvent = parseEvent(eventType, payload);

    if (!parsedEvent) {
      logger.info('Unsupported event type', requestId, eventType);
      emitUnsupportedEvent();
      const durationMs = Date.now() - startTime;
      emitProcessingDuration(durationMs);

      return {
        statusCode: 200,
        body: JSON.stringify({
          statusCode: 200,
          message: 'Unsupported event type',
          requestId,
          eventType,
          eventCategory: 'unsupported',
          processingDurationMs: durationMs
        })
      };
    }

    eventCategory = parsedEvent.eventCategory;
    logger.info('Event parsed successfully', requestId, eventType, {
      eventCategory,
      repository: parsedEvent.repository
    });

    // Requirement 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8: Format messages
    logger.info('Formatting Teams message', requestId, eventType);
    const teamsMessage = formatTeamsMessage(parsedEvent);

    // Requirement 8.1, 8.2, 8.3, 8.4, 8.5, 8.6: Post to Teams
    logger.info('Posting to Teams', requestId, eventType);
    const teamsUrl = await retrieveTeamsUrl(config);
    const postSuccess = await postToTeams(teamsMessage, teamsUrl);

    if (!postSuccess) {
      logger.error('Failed to post to Teams', requestId, eventType);
      const durationMs = Date.now() - startTime;
      emitProcessingDuration(durationMs);

      return handleError(new Error('Failed to post to Teams'), requestId, eventType);
    }

    logger.info('Successfully posted to Teams', requestId, eventType);

    // Requirement 12.6: Track processing duration
    const durationMs = Date.now() - startTime;
    emitProcessingDuration(durationMs);

    // Requirement 12.7, 12.8: Return success response with context
    return {
      statusCode: 200,
      body: JSON.stringify({
        statusCode: 200,
        message: 'Webhook processed successfully',
        requestId,
        eventType,
        eventCategory,
        processingDurationMs: durationMs
      })
    };
  } catch (error) {
    logger.error(`Unexpected error: ${(error as Error).message}`, requestId, eventType);
    const durationMs = Date.now() - startTime;
    emitProcessingDuration(durationMs);

    return handleError(error as Error, requestId, eventType);
  }
};
