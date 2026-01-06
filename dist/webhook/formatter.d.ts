/**
 * Message formatting for Teams notifications
 * Converts failure events into Teams Adaptive Card JSON
 */
import { FailureEvent } from '../types';
/**
 * Format a failure event into a Teams Adaptive Card message
 * Includes pipeline name, repository, branch, triggered by, and status
 *
 * @param failure The failure event to format
 * @returns Teams Adaptive Card payload
 */
export declare function formatMessage(failure: FailureEvent): Record<string, any>;
//# sourceMappingURL=formatter.d.ts.map