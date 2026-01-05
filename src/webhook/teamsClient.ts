/**
 * Teams client for posting messages to Microsoft Teams
 * Posts formatted failure notifications to Teams webhook URL
 */

import * as https from 'https';
import { TeamsMessage } from '../types';
import { Logger } from '../logger';

/**
 * Post a message to Teams webhook URL
 * Handles HTTP status 200 and 202 as success
 * Logs errors for failed posts
 *
 * @param message The Teams message to post
 * @param webhookUrl The Teams webhook URL
 * @param logger The logger instance for error logging
 * @returns Promise<boolean> - true if post was successful, false otherwise
 */
export async function postToTeams(
  message: TeamsMessage,
  webhookUrl: string,
  logger: Logger
): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      // Parse the webhook URL
      const url = new URL(webhookUrl);

      // Prepare the payload
      const payload = JSON.stringify({
        title: message.title,
        description: message.description,
        link: message.link,
        color: message.color,
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
          } else {
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
    } catch (error) {
      logger.error('Error posting to Teams', {
        error: error instanceof Error ? error.message : String(error),
      });
      resolve(false);
    }
  });
}
