/**
 * Failure detection for Bitbucket webhook events
 * Detects pull request rejections and build failures
 */
import { FailureEvent } from '../types';
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
export declare function detectFailure(eventType: string, payload: Record<string, any>): FailureEvent | null;
//# sourceMappingURL=failureDetector.d.ts.map