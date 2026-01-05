/**
 * Failure detection for Bitbucket webhook events
 * Detects pull request rejections and build failures
 */

import { FailureEvent, BitbucketCommitStatusPayload, BitbucketPullRequestPayload } from '../types';

/**
 * Detect if a webhook event represents a failure
 * Supports:
 * - pullrequest:rejected events
 * - repo:commit_status_updated events with state='failed'
 *
 * @param eventType The event type from X-Event-Key header
 * @param payload The parsed webhook payload
 * @returns FailureEvent if a failure is detected, null otherwise
 */
export function detectFailure(eventType: string, payload: Record<string, any>): FailureEvent | null {
  if (eventType === 'pullrequest:rejected') {
    return detectPullRequestRejection(payload);
  }

  if (eventType === 'repo:commit_status_updated') {
    return detectCommitStatusFailure(payload);
  }

  // Non-failure event
  return null;
}

/**
 * Detect pull request rejection
 *
 * @param payload The webhook payload
 * @returns FailureEvent for rejected PR, null if not a valid rejection
 */
function detectPullRequestRejection(payload: Record<string, any>): FailureEvent | null {
  try {
    const typedPayload = payload as BitbucketPullRequestPayload;

    // Validate required fields
    if (!typedPayload.repository?.name || !typedPayload.pullrequest?.id || !typedPayload.actor?.username) {
      return null;
    }

    const repository = typedPayload.repository.full_slug || typedPayload.repository.name;
    const author = typedPayload.actor.username;
    const prId = typedPayload.pullrequest.id;
    const prTitle = typedPayload.pullrequest.title || `PR #${prId}`;
    const link = typedPayload.pullrequest.links?.html?.href || '';

    return {
      type: 'pr_rejected',
      repository,
      author,
      reason: `Pull request rejected: ${prTitle}`,
      link,
    };
  } catch {
    return null;
  }
}

/**
 * Detect commit status failure
 *
 * @param payload The webhook payload
 * @returns FailureEvent for failed commit status, null if not a failure
 */
function detectCommitStatusFailure(payload: Record<string, any>): FailureEvent | null {
  try {
    const typedPayload = payload as BitbucketCommitStatusPayload;

    // Check if state is 'FAILED'
    if (typedPayload.commit_status?.state !== 'FAILED') {
      return null;
    }

    // Validate required fields
    if (!typedPayload.repository?.name || !typedPayload.actor?.username) {
      return null;
    }

    const repository = typedPayload.repository.full_slug || typedPayload.repository.name;
    const author = typedPayload.actor.username;
    const reason = typedPayload.commit_status.description || 'Build failed';
    const link = typedPayload.commit_status.url || '';

    return {
      type: 'build_failed',
      repository,
      author,
      reason,
      link,
    };
  } catch {
    return null;
  }
}
