/**
 * Webhook reception and parsing for Bitbucket webhooks
 * Handles extraction of headers and decoding of request bodies
 */

import { APIGatewayProxyEvent } from '../types';
import { Logger } from '../logger';

/**
 * Represents extracted webhook data
 */
export interface WebhookData {
  eventType: string;
  signature: string;
  body: string;
}

/**
 * Extract webhook data from API Gateway event
 * Extracts event type and signature from headers, and decodes body if base64 encoded
 *
 * @param event The API Gateway event
 * @param logger Logger instance for error logging
 * @returns Extracted webhook data or null if extraction fails
 */
export function extractWebhookData(event: APIGatewayProxyEvent, logger: Logger): WebhookData | null {
  try {
    // Extract event type from X-Event-Key header
    const eventType = event.headers['X-Event-Key'] || event.headers['x-event-key'];
    if (!eventType) {
      logger.warn('Missing X-Event-Key header');
      return null;
    }

    // Extract signature from X-Hub-Signature header
    const signature = event.headers['X-Hub-Signature'] || event.headers['x-hub-signature'];
    if (!signature) {
      logger.warn('Missing X-Hub-Signature header');
      return null;
    }

    // Decode body if base64 encoded
    let body = event.body || '';
    if (event.isBase64Encoded) {
      body = Buffer.from(body, 'base64').toString('utf-8');
    }

    return {
      eventType,
      signature,
      body,
    };
  } catch (error) {
    logger.error('Failed to extract webhook data', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

/**
 * Parse webhook body as JSON
 *
 * @param body The webhook body string
 * @param logger Logger instance for error logging
 * @returns Parsed JSON object or null if parsing fails
 */
export function parseWebhookBody(body: string, logger: Logger): Record<string, any> | null {
  try {
    return JSON.parse(body);
  } catch (error) {
    logger.error('Failed to parse webhook body as JSON', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}
