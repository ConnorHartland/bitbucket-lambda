/**
 * Teams Message Formatting Module
 * Formats failure events into simple Teams messages
 * Requirements: 4.1, 4.2, 4.3
 */

export interface FailureEvent {
  type: string;
  repository: string;
  author: string;
  reason: string;
  link: string;
}

/**
 * Format a failure event into a simple Teams message
 * Requirements: 4.1, 4.2, 4.3
 * 
 * @param failure - The failure event to format
 * @returns A simple Teams message with title, description, link, and color
 */
export function formatMessage(failure: FailureEvent): Record<string, any> {
  if (!failure || !failure.repository) {
    throw new Error(failure ? 'FailureEvent must have a repository' : 'FailureEvent cannot be null');
  }

  return {
    title: `${failure.type} in ${failure.repository}`,
    description: `${failure.reason} by ${failure.author}`,
    repository: failure.repository,
    link: failure.link,
    color: '#DC3545' // Red for failures
  };
}
