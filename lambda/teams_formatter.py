"""Teams message formatting and adaptive card creation."""

import logging
from typing import Dict, Any
try:
    from .event_parser import ParsedEvent
except ImportError:
    from event_parser import ParsedEvent

logger = logging.getLogger(__name__)


def get_event_color(event_category: str, action: str, metadata: Dict[str, Any]) -> str:
    """
    Get theme color based on event type and action.
    
    Args:
        event_category: The event category (pull_request, push, comment, etc.)
        action: The specific action (created, merged, failed, etc.)
        metadata: Event metadata for additional context
    
    Returns:
        str: Hex color code for the event
    """
    # Red for failures
    if action in ['failed', 'declined', 'stopped'] or action == 'rejected':
        return "#DC3545"
    
    # Green for success actions
    if action in ['merged', 'succeeded', 'approved']:
        return "#28A745"
    
    # Check for failure states in commit status
    if event_category == 'commit_status':
        state = metadata.get('state', '').upper()
        if state in ['FAILED', 'STOPPED', 'ERROR']:
            return "#DC3545"
        elif state == 'SUCCESSFUL':
            return "#28A745"  # Green for success
        else:
            return "#FFC107"  # Yellow for in-progress
    
    # Blue for pull requests
    if event_category == 'pull_request':
        return "#0078D4"
    
    # Purple for push events
    if event_category == 'push':
        return "#6264A7"
    
    # Gray for comments and other events
    return "#6C757D"


def create_adaptive_card_data(parsed_event: ParsedEvent) -> Dict[str, Any]:
    """
    Create data payload for Adaptive Card template.
    
    Args:
        parsed_event: The parsed Bitbucket event
    
    Returns:
        dict: Data payload for Teams Workflow Adaptive Card template
    """
    # Base data that all events have
    data = {
        "title": parsed_event.title or f"{parsed_event.action.title()} in {parsed_event.repository}",
        "subtitle": f"by {parsed_event.author}" if parsed_event.author else None,
        "repository": parsed_event.repository,
        "action": parsed_event.action.title(),
        "author": parsed_event.author,
        "event_category": parsed_event.event_category,
        "description": parsed_event.description,
        "url": parsed_event.url
    }
    
    # Add event-specific data
    if parsed_event.event_category == 'pull_request':
        data.update({
            "pr_id": str(parsed_event.metadata.get('pr_id', '')),
            "source_branch": parsed_event.metadata.get('source_branch', 'unknown'),
            "target_branch": parsed_event.metadata.get('target_branch', 'unknown'),
            "state": parsed_event.metadata.get('state', 'unknown')
        })
    
    elif parsed_event.event_category == 'push':
        data.update({
            "branch": parsed_event.metadata.get('branch', 'unknown'),
            "commit_count": str(parsed_event.metadata.get('commit_count', 0)),
            "commits": parsed_event.metadata.get('commits', [])
        })
    
    elif parsed_event.event_category == 'comment':
        data.update({
            "context_title": parsed_event.metadata.get('context_title', 'unknown')
        })
    
    elif parsed_event.event_category == 'commit_status':
        data.update({
            "build_name": parsed_event.metadata.get('build_name', 'Build'),
            "build_status": parsed_event.metadata.get('state', 'unknown'),
            "commit_hash": parsed_event.metadata.get('commit_hash', 'unknown'),
            "branch": parsed_event.metadata.get('branch', 'unknown')
        })
    
    return data


def _get_text_color_for_theme(theme_color: str) -> str:
    """
    Get appropriate text color based on theme color.
    
    Args:
        theme_color: Hex color code
    
    Returns:
        str: Text color for Adaptive Card
    """
    # Map theme colors to text colors for better visibility
    color_map = {
        "#DC3545": "Attention",  # Red for failures
        "#28A745": "Good",       # Green for success
        "#FFC107": "Warning",    # Yellow for in-progress
        "#0078D4": "Accent",     # Blue for pull requests
        "#6264A7": "Default",    # Purple for push events
        "#6C757D": "Default"     # Gray for comments
    }
    
    return color_map.get(theme_color, "Default")


def format_teams_message(parsed_event: ParsedEvent) -> Dict[str, Any]:
    """
    Convert ParsedEvent to data payload for Teams Workflow.
    
    Args:
        parsed_event: The parsed Bitbucket event
    
    Returns:
        dict: Data payload for Teams Workflow Adaptive Card template
    
    Raises:
        ValueError: If parsed_event is None or has invalid data
    """
    if parsed_event is None:
        raise ValueError("ParsedEvent cannot be None")
    
    if not parsed_event.repository:
        raise ValueError("ParsedEvent must have a repository")
    
    # Create the data payload that the Teams Workflow template will use
    event_data = create_adaptive_card_data(parsed_event)
    
    # Add theme color for the template
    theme_color = get_event_color(parsed_event.event_category, parsed_event.action, parsed_event.metadata)
    event_data["theme_color"] = theme_color
    event_data["text_color"] = _get_text_color_for_theme(theme_color)
    
    # Add formatted commit details for push events
    if parsed_event.event_category == 'push':
        commits = event_data.get("commits", [])
        if commits:
            commit_details = []
            for commit in commits[:3]:  # Show max 3 commits
                commit_msg = commit.get('message', 'No message')[:50]
                if len(commit.get('message', '')) > 50:
                    commit_msg += '...'
                commit_details.append(f"• {commit.get('hash', 'unknown')}: {commit_msg}")
            event_data["commit_details"] = "\\n".join(commit_details)
    
    # Add branch flow for pull requests
    if parsed_event.event_category == 'pull_request':
        source = event_data.get('source_branch', 'unknown')
        target = event_data.get('target_branch', 'unknown')
        event_data["branch_flow"] = f"{source} → {target}"
    
    return event_data