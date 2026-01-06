"use strict";
/**
 * Teams client for posting messages to Microsoft Teams
 * Posts formatted failure notifications to Teams webhook URL
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.postToTeams = postToTeams;
const https = __importStar(require("https"));
/**
 * Post a message to Teams webhook URL
 * Handles HTTP status 200 and 202 as success
 * Logs errors for failed posts
 *
 * @param message The Teams Adaptive Card message to post
 * @param webhookUrl The Teams webhook URL
 * @param logger The logger instance for error logging
 * @returns Promise<boolean> - true if post was successful, false otherwise
 */
async function postToTeams(message, webhookUrl, logger) {
    return new Promise((resolve) => {
        try {
            // Parse the webhook URL
            const url = new URL(webhookUrl);
            // Convert the Adaptive Card to the flat structure expected by Teams Workflows
            const payload = JSON.stringify({
                type: 'message',
                attachments: [
                    {
                        contentType: 'application/vnd.microsoft.card.adaptive',
                        content: message,
                    },
                ],
                // Also include flat fields for Teams Workflows Power Automate expressions
                repository: message.body?.[1]?.items?.[0]?.facts?.find((f) => f.title === 'Repository')?.value || 'unknown',
                branch: message.body?.[1]?.items?.[0]?.facts?.find((f) => f.title === 'Branch')?.value || 'unknown',
                build_name: message.body?.[1]?.items?.[0]?.facts?.find((f) => f.title === 'Pipeline')?.value || 'Pipeline',
                author: message.body?.[1]?.items?.[0]?.facts?.find((f) => f.title === 'Triggered by')?.value || 'unknown',
                build_status: message.body?.[1]?.items?.[0]?.facts?.find((f) => f.title === 'Status')?.value || 'UNKNOWN',
                description: message.body?.[2]?.items?.[0]?.text || 'No details available',
                url: message.actions?.[0]?.url || '',
            });
            // Prepare request options
            const options = {
                hostname: url.hostname,
                port: url.port || 443,
                path: url.pathname + url.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload),
                },
                timeout: 10000, // 10 second timeout
            };
            // Make the request
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    // Handle success responses (200 or 202)
                    if (res.statusCode === 200 || res.statusCode === 202) {
                        logger.info('Successfully posted message to Teams', {
                            statusCode: res.statusCode,
                        });
                        resolve(true);
                    }
                    else {
                        // Log error for non-success responses
                        logger.error('Teams API returned error', {
                            statusCode: res.statusCode,
                            response: data,
                        });
                        resolve(false);
                    }
                });
            });
            // Handle request errors
            req.on('error', (error) => {
                logger.error('Failed to post message to Teams', {
                    error: error.message,
                });
                resolve(false);
            });
            // Handle timeout
            req.on('timeout', () => {
                req.destroy();
                logger.error('Teams API request timed out', {
                    timeout: 10000,
                });
                resolve(false);
            });
            // Send the payload
            req.write(payload);
            req.end();
        }
        catch (error) {
            logger.error('Error posting to Teams', {
                error: error instanceof Error ? error.message : String(error),
            });
            resolve(false);
        }
    });
}
//# sourceMappingURL=teamsClient.js.map