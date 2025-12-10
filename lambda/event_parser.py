"""Bitbucket event parsing and data structures."""

import logging
from dataclasses import dataclass
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


@dataclass
class ParsedEvent:
    """Internal representation of a parsed Bitbucket event"""
    event_category: str  # 'pull_request', 'push', 'comment', 'commit_status', etc.
    repository: str
    action: str
    author: str
    title: Optional[str]
    description: Optional[str]
    url: str
    metadata: Dict[str, Any]  # Event-specific fields


def parse_bitbucket_event(body: Dict[str, Any], event_type: str) -> Optional[ParsedEvent]:
    """
    Parse Bitbucket webhook event and extract relevant fields based on event type.
    
    Args:
        body: Parsed JSON payload from Bitbucket webhook
        event_type: Event type from X-Event-Key header
    
    Returns:
        ParsedEvent: Parsed event data, or None if event type is unsupported
    
    Raises:
        ValueError: If required fields are missing from the payload
        KeyError: If expected payload structure is malformed
    """
    try:
        if not body:
            raise ValueError("Event payload cannot be empty")
        
        repository = body.get('repository', {})
        repo_name = repository.get('full_name', repository.get('name', 'unknown'))
        
        # Handle comment events first (they may also have pullrequest field)
        if event_type in ['pullrequest:comment_created', 'repo:commit_comment_created']:
            return _parse_comment_event(body, event_type, repo_name)
        
        # Handle pull request events
        elif event_type.startswith('pullrequest:'):
            return _parse_pull_request_event(body, event_type, repo_name)
        
        # Handle push events
        elif event_type == 'repo:push':
            return _parse_push_event(body, event_type, repo_name)
        
        # Handle pipeline/commit status events
        elif event_type in ['repo:commit_status_updated', 'repo:commit_status_created']:
            return _parse_commit_status_event(body, event_type, repo_name)
        
        # Unsupported event type - return None to indicate no processing needed
        else:
            logger.info(f"Unsupported event type: {event_type}")
            return None
            
    except (KeyError, ValueError, TypeError) as e:
        logger.error(f"Error parsing event {event_type}: {str(e)}")
        raise ValueError(f"Malformed payload for event type {event_type}: {str(e)}")


def _parse_pull_request_event(body: Dict[str, Any], event_type: str, repo_name: str) -> ParsedEvent:
    """Parse pull request events (created, merged, declined, updated)"""
    pullrequest = body.get('pullrequest', {})
    if not pullrequest:
        raise ValueError("Missing 'pullrequest' field in payload")
    
    # Extract action from event type
    action_map = {
        'pullrequest:created': 'created',
        'pullrequest:updated': 'updated',
        'pullrequest:fulfilled': 'merged',
        'pullrequest:rejected': 'declined',
        'pullrequest:approved': 'approved',
        'pullrequest:unapproved': 'unapproved'
    }
    action = action_map.get(event_type, event_type.split(':')[1] if ':' in event_type else 'unknown')
    
    # Extract author information
    author_info = pullrequest.get('author', {})
    author = author_info.get('display_name', author_info.get('username', 'unknown'))
    
    # Extract branch information
    source = pullrequest.get('source', {})
    destination = pullrequest.get('destination', {})
    source_branch = source.get('branch', {}).get('name', 'unknown')
    target_branch = destination.get('branch', {}).get('name', 'unknown')
    
    # Build metadata
    metadata = {
        'source_branch': source_branch,
        'target_branch': target_branch,
        'pr_id': pullrequest.get('id'),
        'state': pullrequest.get('state', 'unknown')
    }
    
    return ParsedEvent(
        event_category='pull_request',
        repository=repo_name,
        action=action,
        author=author,
        title=pullrequest.get('title', 'Untitled Pull Request'),
        description=pullrequest.get('description', ''),
        url=pullrequest.get('links', {}).get('html', {}).get('href', ''),
        metadata=metadata
    )


def _parse_push_event(body: Dict[str, Any], event_type: str, repo_name: str) -> ParsedEvent:
    """Parse push events with commit information"""
    push = body.get('push', {})
    if not push:
        raise ValueError("Missing 'push' field in payload")
    
    changes = push.get('changes', [])
    if not changes:
        raise ValueError("Missing 'changes' field in push payload")
    
    # Get the first change (most recent)
    change = changes[0]
    new_info = change.get('new', {})
    
    # Extract branch and commit information
    branch_name = new_info.get('name', 'unknown')
    commits = change.get('commits', [])
    commit_count = len(commits)
    
    # Extract pusher information
    actor = body.get('actor', {})
    author = actor.get('display_name', actor.get('username', 'unknown'))
    
    # Get latest commit for URL
    latest_commit = commits[0] if commits else {}
    commit_url = latest_commit.get('links', {}).get('html', {}).get('href', '')
    
    # Build metadata
    metadata = {
        'branch': branch_name,
        'commit_count': commit_count,
        'commits': [
            {
                'hash': commit.get('hash', '')[:8],  # Short hash
                'message': commit.get('message', '').split('\n')[0],  # First line only
                'author': commit.get('author', {}).get('user', {}).get('display_name', 'unknown')
            }
            for commit in commits[:5]  # Limit to 5 most recent commits
        ]
    }
    
    return ParsedEvent(
        event_category='push',
        repository=repo_name,
        action='pushed',
        author=author,
        title=f"Push to {branch_name}",
        description=f"{commit_count} commit{'s' if commit_count != 1 else ''} pushed",
        url=commit_url,
        metadata=metadata
    )


def _parse_comment_event(body: Dict[str, Any], event_type: str, repo_name: str) -> ParsedEvent:
    """Parse comment events with context"""
    comment = body.get('comment', {})
    if not comment:
        raise ValueError("Missing 'comment' field in payload")
    
    # Extract comment author
    author_info = comment.get('user', {})
    author = author_info.get('display_name', author_info.get('username', 'unknown'))
    
    # Extract comment content
    comment_text = comment.get('content', {}).get('raw', comment.get('raw', ''))
    
    # Determine context (PR or commit)
    context_type = 'unknown'
    context_title = 'Unknown'
    context_url = ''
    
    if 'pullrequest' in body:
        # Comment on pull request
        pr = body['pullrequest']
        context_type = 'pull_request'
        context_title = f"PR #{pr.get('id', 'unknown')}: {pr.get('title', 'Untitled')}"
        context_url = pr.get('links', {}).get('html', {}).get('href', '')
    elif 'commit' in body:
        # Comment on commit
        commit = body['commit']
        context_type = 'commit'
        commit_hash = commit.get('hash', 'unknown')[:8]
        context_title = f"Commit {commit_hash}"
        context_url = commit.get('links', {}).get('html', {}).get('href', '')
    
    # Build metadata
    metadata = {
        'context_type': context_type,
        'context_title': context_title,
        'comment_id': comment.get('id'),
        'comment_length': len(comment_text)
    }
    
    return ParsedEvent(
        event_category='comment',
        repository=repo_name,
        action='commented',
        author=author,
        title=f"Comment on {context_title}",
        description=comment_text[:200] + ('...' if len(comment_text) > 200 else ''),  # Truncate long comments
        url=context_url,
        metadata=metadata
    )


def _parse_commit_status_event(body: Dict[str, Any], event_type: str, repo_name: str) -> ParsedEvent:
    """Parse pipeline/commit status events"""
    commit_status = body.get('commit_status', {})
    if not commit_status:
        raise ValueError("Missing 'commit_status' field in payload")
    
    # Extract status information
    state = commit_status.get('state', 'unknown').upper()
    name = commit_status.get('name', 'Build')
    description = commit_status.get('description', '')
    
    # Extract commit information
    commit = commit_status.get('commit', {})
    commit_hash = commit.get('hash', 'unknown')[:8]
    
    # Extract branch information from refname
    branch = commit_status.get('refname', 'unknown')
    
    # Determine action based on state
    action_map = {
        'SUCCESSFUL': 'succeeded',
        'FAILED': 'failed',
        'INPROGRESS': 'in_progress',
        'STOPPED': 'stopped'
    }
    action = action_map.get(state, state.lower())
    
    # Build metadata
    metadata = {
        'state': state,
        'commit_hash': commit_hash,
        'build_name': name,
        'build_url': commit_status.get('url', ''),
        'branch': branch
    }
    
    return ParsedEvent(
        event_category='commit_status',
        repository=repo_name,
        action=action,
        author='System',  # Pipeline events don't have a specific author
        title=f"{name} {action}",
        description=description,
        url=commit_status.get('url', ''),
        metadata=metadata
    )