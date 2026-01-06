"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = handler;
const config_1 = require("./config");
const logger_1 = require("./logger");
const secrets_1 = require("./secrets");
const reception_1 = require("./webhook/reception");
const ipWhitelist_1 = require("./webhook/ipWhitelist");
const signature_1 = require("./webhook/signature");
const failureDetector_1 = require("./webhook/failureDetector");
const formatter_1 = require("./webhook/formatter");
const teamsClient_1 = require("./webhook/teamsClient");
/**
 * Lambda handler for Bitbucket to Teams webhook integration
 * Processes incoming Bitbucket webhooks and posts failure notifications to Teams
 *
 * @param event The API Gateway proxy event
 * @param context The Lambda context
 * @returns Promise<APIGatewayProxyResult> Always returns 200 OK
 */
async function handler(event, context) {
    // Create logger with request ID and event type (if available)
    const requestId = context.requestId || event.requestContext?.requestId || 'unknown';
    let logger = new logger_1.Logger(requestId);
    try {
        // Step 1: Load configuration from environment variables
        let config;
        try {
            config = config_1.ConfigManager.loadFromEnvironment();
            // Set IP ranges from configuration
            (0, ipWhitelist_1.setIpRanges)(config.bitbucketIpRanges);
        }
        catch (error) {
            logger.error('Failed to load configuration', {
                error: error instanceof Error ? error.message : String(error),
            });
            return {
                statusCode: 200,
                body: JSON.stringify({ message: 'OK' }),
            };
        }
        // Step 2: Extract headers and body from event
        const webhookData = (0, reception_1.extractWebhookData)(event, logger);
        if (!webhookData) {
            return {
                statusCode: 200,
                body: JSON.stringify({ message: 'OK' }),
            };
        }
        // Update logger with event type
        logger = new logger_1.Logger(requestId, webhookData.eventType);
        // Step 3: Check IP whitelist (if enabled)
        if (config.ipRestrictionEnabled) {
            const sourceIp = (0, ipWhitelist_1.extractSourceIp)(event);
            if (!sourceIp) {
                logger.warn('Could not extract source IP from event');
                return {
                    statusCode: 200,
                    body: JSON.stringify({ message: 'OK' }),
                };
            }
            if (!(0, ipWhitelist_1.isIpWhitelisted)(sourceIp)) {
                logger.warn('Request from non-whitelisted IP', { sourceIp });
                return {
                    statusCode: 200,
                    body: JSON.stringify({ message: 'OK' }),
                };
            }
        }
        // Step 4: Load secrets
        let bitbucketSecret;
        let teamsWebhookUrl;
        try {
            bitbucketSecret = await (0, secrets_1.getSecret)(config.bitbucketSecretArn, logger);
            teamsWebhookUrl = await (0, secrets_1.getSecret)(config.teamsWebhookUrlSecretArn, logger);
        }
        catch (error) {
            logger.error('Failed to load secrets', {
                error: error instanceof Error ? error.message : String(error),
            });
            return {
                statusCode: 200,
                body: JSON.stringify({ message: 'OK' }),
            };
        }
        // Step 5: Verify signature
        if (!(0, signature_1.verifySignature)(webhookData.body, webhookData.signature, bitbucketSecret)) {
            logger.warn('Invalid webhook signature');
            return {
                statusCode: 200,
                body: JSON.stringify({ message: 'OK' }),
            };
        }
        // Step 6: Parse webhook body
        const payload = (0, reception_1.parseWebhookBody)(webhookData.body, logger);
        if (!payload) {
            return {
                statusCode: 200,
                body: JSON.stringify({ message: 'OK' }),
            };
        }
        // Step 7: Detect failure
        const failure = (0, failureDetector_1.detectFailure)(webhookData.eventType, payload);
        if (!failure) {
            // Non-failure event, return 200 silently
            logger.info('Non-failure event received, ignoring');
            return {
                statusCode: 200,
                body: JSON.stringify({ message: 'OK' }),
            };
        }
        logger.info('Failure detected', {
            failureType: failure.type,
            repository: failure.repository,
            branch: failure.branch,
            pipelineName: failure.pipelineName,
            author: failure.author,
            status: failure.status,
        });
        // Step 8: Format and post to Teams if failure
        const message = (0, formatter_1.formatMessage)(failure);
        const posted = await (0, teamsClient_1.postToTeams)(message, teamsWebhookUrl, logger);
        if (posted) {
            logger.info('Failure notification posted to Teams', {
                failureType: failure.type,
                repository: failure.repository,
            });
        }
        else {
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
    }
    catch (error) {
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
//# sourceMappingURL=index.js.map