"use strict";
/**
 * Webhook reception and parsing for Bitbucket webhooks
 * Handles extraction of headers and decoding of request bodies
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractWebhookData = extractWebhookData;
exports.parseWebhookBody = parseWebhookBody;
/**
 * Extract webhook data from API Gateway event
 * Extracts event type and signature from headers, and decodes body if base64 encoded
 *
 * @param event The API Gateway event
 * @param logger Logger instance for error logging
 * @returns Extracted webhook data or null if extraction fails
 */
function extractWebhookData(event, logger) {
    try {
        // Extract event type from X-Event-Key header (case-insensitive)
        let eventType = event.headers['X-Event-Key'] || event.headers['x-event-key'];
        // If not found, search through all headers case-insensitively
        if (!eventType) {
            const headerKey = Object.keys(event.headers).find(key => key.toLowerCase() === 'x-event-key');
            eventType = headerKey ? event.headers[headerKey] : undefined;
        }
        if (!eventType) {
            logger.warn('Missing X-Event-Key header', {
                availableHeaders: Object.keys(event.headers),
            });
            return null;
        }
        // Extract signature from X-Hub-Signature header (case-insensitive)
        let signature = event.headers['X-Hub-Signature'] || event.headers['x-hub-signature'];
        // If not found, search through all headers case-insensitively
        if (!signature) {
            const headerKey = Object.keys(event.headers).find(key => key.toLowerCase() === 'x-hub-signature');
            signature = headerKey ? event.headers[headerKey] : undefined;
        }
        if (!signature) {
            logger.warn('Missing X-Hub-Signature header', {
                availableHeaders: Object.keys(event.headers),
            });
            return null;
        }
        // Decode body if base64 encoded
        let body = event.body || '';
        if (event.isBase64Encoded) {
            body = Buffer.from(body, 'base64').toString('utf-8');
        }
        logger.info('Webhook data extracted', {
            eventType,
            bodyLength: body.length,
        });
        return {
            eventType,
            signature,
            body,
        };
    }
    catch (error) {
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
function parseWebhookBody(body, logger) {
    try {
        return JSON.parse(body);
    }
    catch (error) {
        logger.error('Failed to parse webhook body as JSON', {
            error: error instanceof Error ? error.message : String(error),
        });
        return null;
    }
}
//# sourceMappingURL=reception.js.map