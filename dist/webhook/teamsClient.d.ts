/**
 * Teams client for posting messages to Microsoft Teams
 * Posts formatted failure notifications to Teams webhook URL
 */
import { Logger } from '../logger';
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
export declare function postToTeams(message: Record<string, any>, webhookUrl: string, logger: Logger): Promise<boolean>;
//# sourceMappingURL=teamsClient.d.ts.map