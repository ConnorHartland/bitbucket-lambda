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
export declare function extractWebhookData(event: APIGatewayProxyEvent, logger: Logger): WebhookData | null;
/**
 * Parse webhook body as JSON
 *
 * @param body The webhook body string
 * @param logger Logger instance for error logging
 * @returns Parsed JSON object or null if parsing fails
 */
export declare function parseWebhookBody(body: string, logger: Logger): Record<string, any> | null;
//# sourceMappingURL=reception.d.ts.map