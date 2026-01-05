/**
 * Event Parser Module
 * Parses Bitbucket webhook events into internal format
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
 */

export interface ParsedEvent {
  eventCategory: string;
  repository: string;
  action: string;
  author: string;
  title: string | null;
  description: string | null;
  url: string;
  metadata: Record<string, any>;
}

function _parsePullRequestEvent(_eventType: string, payload: Record<string, any>): ParsedEvent {
  const pr = payload.pullrequest;
  if (!pr) throw new Error('Missing pullrequest field in payload');

  const repository = payload.repository?.full_name;
  if (!repository) throw new Error('Missing repository.full_name in payload');

  const action = _eventType.split(':')[1] || 'unknown';
  const author = pr.author?.display_name || 'Unknown';

  return {
    eventCategory: 'pull_request',
    repository,
    action,
    author,
    title: pr.title || null,
    description: pr.description || null,
    url: pr.links?.html?.href || '',
    metadata: {
      pr_id: pr.id,
      source_branch: pr.source?.branch?.name || 'unknown',
      target_branch: pr.destination?.branch?.name || 'unknown',
      state: pr.state || 'unknown',
      author_email: pr.author?.email_address || ''
    }
  };
}

function _parsePushEvent(_eventType: string, payload: Record<string, any>): ParsedEvent {
  const push = payload.push;
  if (!push) throw new Error('Missing push field in payload');

  const repository = payload.repository?.full_name;
  if (!repository) throw new Error('Missing repository.full_name in payload');

  const actor = payload.actor;
  const author = actor?.display_name || 'Unknown';
  const changes = push.changes || [];
  const branch = changes[0]?.new?.name || 'unknown';
  const commits = changes[0]?.commits || [];

  return {
    eventCategory: 'push',
    repository,
    action: 'push',
    author,
    title: `Push to ${branch}`,
    description: `${commits.length} commit${commits.length !== 1 ? 's' : ''} pushed`,
    url: commits[0]?.links?.html?.href || payload.repository?.links?.html?.href || '',
    metadata: {
      branch,
      commit_count: commits.length,
      commits: commits.map((c: Record<string, any>) => ({
        hash: c.hash || 'unknown',
        message: c.message || 'No message',
        author: c.author?.user?.display_name || 'Unknown',
        url: c.links?.html?.href || ''
      })),
      author_email: actor?.email_address || ''
    }
  };
}

function _parseCommentEvent(_eventType: string, payload: Record<string, any>): ParsedEvent {
  const repository = payload.repository?.full_name;
  if (!repository) throw new Error('Missing repository.full_name in payload');

  const comment = payload.comment;
  if (!comment) throw new Error('Missing comment field in payload');

  const author = comment.user?.display_name || 'Unknown';
  const commentText = comment.content?.raw || '';

  let contextTitle = 'Comment';
  let url = '';

  if (payload.pullrequest) {
    const pr = payload.pullrequest;
    contextTitle = `Comment on PR #${pr.id}`;
    url = pr.links?.html?.href || '';
  } else if (payload.commit) {
    const commit = payload.commit;
    contextTitle = `Comment on commit ${commit.hash}`;
    url = commit.links?.html?.href || '';
  }

  return {
    eventCategory: 'comment',
    repository,
    action: 'comment_created',
    author,
    title: `${author} commented`,
    description: commentText.substring(0, 100),
    url,
    metadata: {
      context_title: contextTitle,
      comment_text: commentText,
      author_email: comment.user?.email_address || ''
    }
  };
}

function _parseCommitStatusEvent(_eventType: string, payload: Record<string, any>): ParsedEvent {
  const commitStatus = payload.commit_status;
  if (!commitStatus) throw new Error('Missing commit_status field in payload');

  const repository = payload.repository?.full_name;
  if (!repository) throw new Error('Missing repository.full_name in payload');

  const state = commitStatus.state || 'unknown';
  const buildName = commitStatus.name || 'Build';
  const commitHash = commitStatus.commit?.hash || 'unknown';

  return {
    eventCategory: 'commit_status',
    repository,
    action: state.toLowerCase(),
    author: 'Build System',
    title: `${buildName} ${state}`,
    description: `Commit ${commitHash.substring(0, 7)}`,
    url: commitStatus.url || '',
    metadata: {
      build_name: buildName,
      state,
      commit_hash: commitHash,
      branch: payload.branch?.name || 'unknown',
      author_email: ''
    }
  };
}

const eventParsers: Record<string, (eventType: string, payload: Record<string, any>) => ParsedEvent> = {
  'pullrequest:comment_created': _parseCommentEvent,
  'repo:commit_comment_created': _parseCommentEvent,
  'repo:push': _parsePushEvent,
  'repo:commit_status_updated': _parseCommitStatusEvent,
  'repo:commit_status_created': _parseCommitStatusEvent
};

export function parse(eventType: string, payload: Record<string, any>): ParsedEvent | null {
  // Check exact match first
  if (eventParsers[eventType]) {
    return eventParsers[eventType](eventType, payload);
  }

  // Check for pullrequest events
  if (eventType.startsWith('pullrequest:')) {
    return _parsePullRequestEvent(eventType, payload);
  }

  return null;
}
