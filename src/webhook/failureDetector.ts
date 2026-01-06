/**
 * Failure detection for Bitbucket webhook events
 * Detects pull request rejections and build failures
 */

import { FailureEvent, BitbucketCommitStatusPayload, BitbucketPullRequestPayload } from '../types';
import * as https from 'https';

/**
 * Get branch information from Bitbucket API using commit hash
 * @param repoSlug Repository slug (e.g., "team/repo")
 * @param commitHash Commit hash
 * @returns Promise<string> Branch name or commit hash if not found
 */
async function getBranchFromCommit(repoSlug: string, commitHash: string): Promise<string> {
  return new Promise((resolve) => {
    try {
      const options = {
        hostname: 'api.bitbucket.org',
        path: `/2.0/repositories/${repoSlug}/commit/${commitHash}`,
        method: 'GET',
        headers: {
          'User-Agent': 'bitbucket-teams-webhook',
        },
        timeout: 5000,
      };

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            if (res.statusCode === 200) {
              const commit = JSON.parse(data);
              // Try to extract branch from commit metadata
              if (commit.parents && commit.parents.length > 0) {
                // If we can't get branch directly, return short hash
                resolve(commitHash.substring(0, 7));
              } else {
                resolve(commitHash.substring(0, 7));
              }
            } else {
              resolve(commitHash.substring(0, 7));
            }
          } catch {
            resolve(commitHash.substring(0, 7));
          }
        });
      });

      req.on('error', () => {
        resolve(commitHash.substring(0, 7));
      });

      req.on('timeout', () => {
        req.destroy();
        resolve(commitHash.substring(0, 7));
      });

      req.end();
    } catch {
      resolve(commitHash.substring(0, 7));
    }
  });
}

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
export async function detectFailure(eventType: string, payload: Record<string, any>): Promise<FailureEvent | null> {
  if (eventType === 'pullrequest:rejected') {
    return detectPullRequestRejection(payload);
  }

  if (eventType === 'repo:commit_status_updated') {
    return await detectCommitStatusFailure(payload);
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
    const branch = typedPayload.pullrequest.source?.branch?.name || 'unknown';

    return {
      type: 'pr_rejected',
      repository,
      branch,
      pipelineName: `PR #${prId}`,
      author,
      reason: `Pull request rejected: ${prTitle}`,
      link,
      status: 'REJECTED',
    };
  } catch {
    return null;
  }
}

/**
 * Get branch name from refname (e.g., "refs/heads/main" -> "main")
 * @param refname Full reference name from Bitbucket
 * @returns Branch name or the refname if it can't be parsed
 */
function parseBranchFromRefname(refname: string): string {
  if (!refname) return '';
  
  // Handle refs/heads/branch-name format
  if (refname.startsWith('refs/heads/')) {
    return refname.substring('refs/heads/'.length);
  }
  
  // Handle refs/tags/tag-name format
  if (refname.startsWith('refs/tags/')) {
    return refname.substring('refs/tags/'.length);
  }
  
  // Return as-is if it doesn't match known patterns
  return refname;
}

/**
 * Detect commit status failure
 *
 * @param payload The webhook payload
 * @returns FailureEvent for failed commit status, null if not a failure
 */
async function detectCommitStatusFailure(payload: Record<string, any>): Promise<FailureEvent | null> {
  try {
    const typedPayload = payload as BitbucketCommitStatusPayload;

    // Check if state is 'FAILED'
    if (typedPayload.commit_status?.state !== 'FAILED') {
      return null;
    }

    // Validate that we have at least repository and actor objects
    if (!typedPayload.repository || !typedPayload.actor) {
      return null;
    }

    // Extract fields with fallbacks
    const repository = typedPayload.repository.full_slug || typedPayload.repository.name || 'unknown';
    const author = typedPayload.actor.username || 'unknown';
    const reason = typedPayload.commit_status.description || 'Build failed';
    const link = typedPayload.commit_status.url || '';
    const pipelineName = typedPayload.commit_status.key || 'Pipeline';
    
    // Try to get branch from refname first (primary source from Python version)
    let branch = '';
    if (typedPayload.commit_status?.refname) {
      branch = parseBranchFromRefname(typedPayload.commit_status.refname);
    }
    
    // If no branch from refname, try commit.branch
    if (!branch && typedPayload.commit?.branch) {
      branch = typedPayload.commit.branch;
    }
    
    // If still no branch, try to get it from Bitbucket API using commit hash
    if (!branch && typedPayload.commit?.hash) {
      branch = await getBranchFromCommit(repository, typedPayload.commit.hash);
    }
    
    // Final fallback
    if (!branch) {
      branch = 'unknown';
    }

    return {
      type: 'build_failed',
      repository,
      branch,
      pipelineName,
      author,
      reason,
      link,
      status: 'FAILED',
    };
  } catch {
    return null;
  }
}
