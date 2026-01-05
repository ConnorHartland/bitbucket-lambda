/**
 * Message formatting for Teams notifications
 * Converts failure events into Teams message JSON
 */

import { FailureEvent, TeamsMessage } from '../types';

/**
 * Format a failure event into a Teams message
 * Includes failure type, repository, reason, and link
 * Uses red color to indicate failure severity
 *
 * @param failure The failure event to format
 * @returns Teams message payload
 */
export function formatMessage(failure: FailureEvent): TeamsMessage {
  const typeLabel = failure.type === 'pr_rejected' ? 'Pull Request Rejected' : 'Build Failed';

  return {
    title: `${typeLabel} - ${failure.repository}`,
    description: `Author: ${failure.author}\nReason: ${failure.reason}`,
    link: failure.link,
    color: '#FF0000', // Red color for failures
  };
}
