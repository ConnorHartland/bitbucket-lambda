import json
import urllib3
import os
import hmac
import hashlib
import logging
import boto3
from botocore.exceptions import ClientError, BotoCoreError
from typing import Dict, Any, Optional, Tuple, List
from dataclasses import dataclass
import time

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Custom metrics module for CloudWatch
class CustomMetrics:
    """
    Custom metrics emission using CloudWatch Embedded Metric Format (EMF).
    This allows us to emit custom metrics directly from logs without additional API calls.
    """
    
    @staticmethod
    def emit_metric(metric_name: str, value: float = 1.0, unit: str = "Count", 
                   namespace: str = "BitbucketTeamsWebhook", dimensions: Dict[str, str] = None):
        """
        Emit a custom metric using CloudWatch Embedded Metric Format.
        
        Args:
            metric_name: Name of the metric
            value: Metric value (default 1.0 for counters)
            unit: Metric unit (Count, Milliseconds, etc.)
            namespace: CloudWatch namespace
            dimensions: Additional dimensions for the metric
        """
        if dimensions is None:
            dimensions = {}
        
        # Create EMF log entry
        emf_log = {
            "_aws": {
                "Timestamp": int(time.time() * 1000),  # Milliseconds since epoch
                "CloudWatchMetrics": [
                    {
                        "Namespace": namespace,
                        "Dimensions": [list(dimensions.keys())] if dimensions else [[]],
                        "Metrics": [
                            {
                                "Name": metric_name,
                                "Unit": unit
                            }
                        ]
                    }
                ]
            },
            metric_name: value
        }
        
        # Add dimensions to the log entry
        emf_log.update(dimensions)
        
        # Emit as structured log (CloudWatch will parse this automatically)
        print(json.dumps(emf_log))
    
    @staticmethod
    def emit_event_type_metric(event_type: str):
        """Emit metric for specific event type"""
        CustomMetrics.emit_metric(
            f"EventType-{event_type.replace(':', '-')}",
            namespace="BitbucketTeamsWebhook/EventTypes",
            dimensions={"EventType": event_type}
        )
    
    @staticmethod
    def emit_signature_failure():
        """Emit metric for signature verification failure"""
        CustomMetrics.emit_metric("SignatureVerificationFailures")
    
    @staticmethod
    def emit_teams_api_failure():
        """Emit metric for Teams API failure"""
        CustomMetrics.emit_metric("TeamsAPIFailures")
    
    @staticmethod
    def emit_unsupported_event():
        """Emit metric for unsupported event type"""
        CustomMetrics.emit_metric("UnsupportedEventTypes")
    
    @staticmethod
    def emit_processing_duration(duration_ms: float):
        """Emit metric for processing duration"""
        CustomMetrics.emit_metric(
            "ProcessingDuration",
            value=duration_ms,
            unit="Milliseconds"
        )

def sanitize_log_message(message: str, sensitive_patterns: List[str] = None) -> str:
    """
    Sanitize log messages to prevent exposure of sensitive information.
    
    Args:
        message: The log message to sanitize
        sensitive_patterns: List of patterns to redact (defaults to common sensitive patterns)
    
    Returns:
        str: Sanitized log message
    """
    if sensitive_patterns is None:
        sensitive_patterns = [
            r'sha256=[a-f0-9]{64}',  # Webhook signatures
            r'Bearer [A-Za-z0-9\-._~+/]+=*',  # Bearer tokens
            r'password["\']?\s*[:=]\s*["\']?[^"\'\s]+',  # Passwords
            r'secret["\']?\s*[:=]\s*["\']?[^"\'\s]+',  # Secrets
            r'token["\']?\s*[:=]\s*["\']?[^"\'\s]+',  # Tokens
        ]
    
    import re
    sanitized = message
    for pattern in sensitive_patterns:
        sanitized = re.sub(pattern, '[REDACTED]', sanitized, flags=re.IGNORECASE)
    
    return sanitized

def log_with_context(level: int, message: str, request_id: str = None, event_type: str = None, **kwargs):
    """
    Log message with standardized context information.
    
    Args:
        level: Logging level (logging.INFO, logging.ERROR, etc.)
        message: Log message
        request_id: AWS request ID for correlation
        event_type: Bitbucket event type
        **kwargs: Additional context fields
    """
    # Build context string
    context_parts = []
    if request_id:
        context_parts.append(f"request_id={request_id}")
    if event_type:
        context_parts.append(f"event_type={event_type}")
    
    for key, value in kwargs.items():
        if value is not None:
            context_parts.append(f"{key}={value}")
    
    context_str = f"[{', '.join(context_parts)}]" if context_parts else ""
    
    # Sanitize the full message
    full_message = f"{context_str} {message}" if context_str else message
    sanitized_message = sanitize_log_message(full_message)
    
    logger.log(level, sanitized_message)

# Global variables for connection pooling and secret caching
http = urllib3.PoolManager()
_cached_secrets: Dict[str, str] = {}
_secrets_client = None

@dataclass
class Configuration:
    """Configuration loaded from environment variables"""
    teams_webhook_url_secret_arn: str
    bitbucket_secret_arn: str
    event_filter: str
    filter_mode: str
    
    @classmethod
    def load_from_environment(cls) -> 'Configuration':
        """Load configuration from environment variables with validation"""
        teams_url_arn = os.environ.get('TEAMS_WEBHOOK_URL_SECRET_ARN')
        bitbucket_secret_arn = os.environ.get('BITBUCKET_SECRET_ARN')
        event_filter = os.environ.get('EVENT_FILTER', '')
        filter_mode = os.environ.get('FILTER_MODE', 'all')
        
        # Fail fast for missing required configuration
        missing_configs = []
        if not teams_url_arn:
            missing_configs.append('TEAMS_WEBHOOK_URL_SECRET_ARN')
        if not bitbucket_secret_arn:
            missing_configs.append('BITBUCKET_SECRET_ARN')
            
        if missing_configs:
            error_msg = f"Missing required environment variables: {', '.join(missing_configs)}"
            logger.error(error_msg)
            raise ValueError(error_msg)
        
        return cls(
            teams_webhook_url_secret_arn=teams_url_arn,
            bitbucket_secret_arn=bitbucket_secret_arn,
            event_filter=event_filter,
            filter_mode=filter_mode
        )


# Secrets retrieval module
def get_secrets_client():
    """
    Get or create a Secrets Manager client with global caching.
    
    Returns:
        boto3.client: Secrets Manager client
    """
    global _secrets_client
    if _secrets_client is None:
        _secrets_client = boto3.client('secretsmanager')
    return _secrets_client


def get_secret(secret_arn: str) -> str:
    """
    Retrieve secret from AWS Secrets Manager with caching for warm invocations.
    
    Args:
        secret_arn: The ARN of the secret to retrieve
    
    Returns:
        str: The secret value
    
    Raises:
        ValueError: If secret_arn is empty or None
        ClientError: If AWS Secrets Manager API call fails
        Exception: For other unexpected errors during secret retrieval
    """
    if not secret_arn:
        raise ValueError("Secret ARN cannot be empty or None")
    
    # Check cache first for warm invocations
    if secret_arn in _cached_secrets:
        logger.debug(f"Retrieved secret from cache: {secret_arn}")
        return _cached_secrets[secret_arn]
    
    try:
        # Get the secret from AWS Secrets Manager
        client = get_secrets_client()
        logger.info(f"Retrieving secret from Secrets Manager: {secret_arn}")
        
        response = client.get_secret_value(SecretId=secret_arn)
        
        # Extract the secret string
        secret_value = response.get('SecretString')
        if secret_value is None:
            raise ValueError(f"Secret {secret_arn} does not contain a SecretString")
        
        # Cache the secret for subsequent warm invocations
        _cached_secrets[secret_arn] = secret_value
        logger.info(f"Successfully retrieved and cached secret: {secret_arn}")
        
        return secret_value
        
    except ClientError as e:
        error_code = e.response.get('Error', {}).get('Code', 'Unknown')
        error_message = e.response.get('Error', {}).get('Message', str(e))
        logger.error(f"AWS Secrets Manager error retrieving {secret_arn}: {error_code} - {error_message}")
        raise
    except BotoCoreError as e:
        logger.error(f"BotoCore error retrieving secret {secret_arn}: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error retrieving secret {secret_arn}: {str(e)}")
        raise


def retrieve_webhook_secret(config: Configuration) -> str:
    """
    Retrieve the Bitbucket webhook secret for signature verification.
    
    Args:
        config: Configuration object containing secret ARN
    
    Returns:
        str: The webhook secret value
    
    Raises:
        Exception: If secret retrieval fails
    """
    return get_secret(config.bitbucket_secret_arn)


def retrieve_teams_url(config: Configuration) -> str:
    """
    Retrieve the Teams Workflow URL for posting messages.
    
    Args:
        config: Configuration object containing secret ARN
    
    Returns:
        str: The Teams Workflow URL
    
    Raises:
        Exception: If secret retrieval fails
    """
    return get_secret(config.teams_webhook_url_secret_arn)

# Signature verification module
def extract_signature_from_headers(headers: Dict[str, str]) -> Optional[str]:
    """
    Extract signature from request headers.
    
    Args:
        headers: HTTP headers dictionary (case-insensitive)
    
    Returns:
        str: The signature value without the 'sha256=' prefix, or None if not found
    """
    # Check both cases since API Gateway may normalize headers
    signature_header = headers.get('X-Hub-Signature', headers.get('x-hub-signature', ''))
    
    if not signature_header:
        return None
    
    # Bitbucket sends signatures in format 'sha256=<hex_digest>'
    if signature_header.startswith('sha256='):
        return signature_header[7:]  # Remove 'sha256=' prefix
    
    return None


def compute_signature(payload: str, secret: str) -> str:
    """
    Compute HMAC-SHA256 signature for the given payload and secret.
    
    Args:
        payload: The request body as a string
        secret: The shared secret for signature computation
    
    Returns:
        str: Hex digest of the HMAC-SHA256 signature
    """
    # Convert strings to bytes for HMAC computation
    secret_bytes = secret.encode('utf-8')
    payload_bytes = payload.encode('utf-8')
    
    # Compute HMAC-SHA256
    signature = hmac.new(secret_bytes, payload_bytes, hashlib.sha256)
    return signature.hexdigest()


def verify_signature(payload: str, received_signature: str, secret: str) -> bool:
    """
    Verify webhook signature using constant-time comparison.
    
    Args:
        payload: The request body as a string
        received_signature: The signature from the request header (without 'sha256=' prefix)
        secret: The shared secret for verification
    
    Returns:
        bool: True if signature is valid, False otherwise
    """
    if not received_signature or not secret:
        return False
    
    # Compute expected signature
    expected_signature = compute_signature(payload, secret)
    
    # Use constant-time comparison to prevent timing attacks
    return hmac.compare_digest(expected_signature, received_signature)


def validate_webhook_signature(headers: Dict[str, str], body: str, secret: str) -> Tuple[bool, Optional[str]]:
    """
    Complete signature validation workflow with error handling.
    
    Args:
        headers: HTTP headers dictionary
        body: Request body as string
        secret: Webhook secret for verification
    
    Returns:
        Tuple[bool, Optional[str]]: (is_valid, error_message)
            - is_valid: True if signature is valid
            - error_message: Error description if validation fails, None if successful
    """
    try:
        # Extract signature from headers
        signature = extract_signature_from_headers(headers)
        if signature is None:
            return False, "Missing or invalid X-Hub-Signature header"
        
        # Verify signature
        is_valid = verify_signature(body, signature, secret)
        if not is_valid:
            return False, "Invalid signature"
        
        return True, None
        
    except Exception as e:
        logger.error(f"Signature validation error: {str(e)}")
        return False, f"Signature validation failed: {str(e)}"


# Event filtering module
@dataclass
class FilterConfig:
    """Configuration for event filtering"""
    mode: str  # "all", "deployments", "failures"
    event_types: list  # Explicit event types to include
    
    @classmethod
    def from_environment(cls, event_filter: str, filter_mode: str) -> 'FilterConfig':
        """
        Create FilterConfig from environment variables.
        
        Args:
            event_filter: Comma-separated list of event types
            filter_mode: Filter mode ("all", "deployments", "failures")
        
        Returns:
            FilterConfig: Parsed filter configuration
        """
        # Parse event types from comma-separated string
        event_types = []
        if event_filter:
            event_types = [event_type.strip() for event_type in event_filter.split(',') if event_type.strip()]
        
        return cls(mode=filter_mode, event_types=event_types)
    
    def should_process(self, event_type: str, event_data: dict) -> bool:
        """
        Determine if event should be processed based on filter configuration.
        
        Args:
            event_type: The event type from X-Event-Key header
            event_data: The parsed webhook payload
        
        Returns:
            bool: True if event should be processed, False otherwise
        """
        if self.mode == "all":
            return True
        elif self.mode == "deployments":
            return self._is_deployment_event(event_type)
        elif self.mode == "failures":
            return self._is_failure_event(event_type, event_data)
        else:
            # Explicit event type list mode
            return event_type in self.event_types
    
    def _is_deployment_event(self, event_type: str) -> bool:
        """Check if event is deployment-related"""
        deployment_events = [
            "repo:commit_status_updated",
            "repo:commit_status_created",
            "pullrequest:approved",
            "pullrequest:unapproved"
        ]
        return event_type in deployment_events or "pipeline" in event_type or "commit_status" in event_type
    
    def _is_failure_event(self, event_type: str, event_data: dict) -> bool:
        """
        Check if event represents a failure.
        
        Args:
            event_type: The event type from X-Event-Key header
            event_data: The parsed webhook payload
        
        Returns:
            bool: True if this is a failure event
        """
        # Pipeline/commit status failures
        if "commit_status" in event_type:
            commit_status = event_data.get("commit_status", {})
            state = commit_status.get("state", "").upper()
            return state in ["FAILED", "STOPPED", "ERROR"]
        
        # Pull request declined
        if event_type == "pullrequest:rejected":
            return True
        
        # Build failures (alternative event structure)
        if event_type == "repo:commit_status_updated":
            # Check for build status in the payload
            if "commit_status" in event_data:
                status = event_data["commit_status"].get("state", "").upper()
                return status in ["FAILED", "STOPPED", "ERROR"]
        
        return False


def should_process_event(event_type: str, event_data: dict, filter_config: FilterConfig) -> bool:
    """
    Determine if event should be processed based on filter configuration.
    
    Args:
        event_type: The event type from X-Event-Key header
        event_data: The parsed webhook payload
        filter_config: Filter configuration
    
    Returns:
        bool: True if event should be processed, False otherwise
    """
    return filter_config.should_process(event_type, event_data)


# Event parsing module
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
        'build_url': commit_status.get('url', '')
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


# Teams Adaptive Card formatting module
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


def get_adaptive_card_template() -> Dict[str, Any]:
    """
    Get the Adaptive Card template structure.
    
    Returns:
        dict: Adaptive Card template
    """
    return {
        "type": "AdaptiveCard",
        "version": "1.4",
        "body": [
            {
                "type": "Container",
                "style": "emphasis",
                "items": [
                    {
                        "type": "ColumnSet",
                        "columns": [
                            {
                                "type": "Column",
                                "width": "auto",
                                "items": [
                                    {
                                        "type": "Image",
                                        "url": "https://wac-cdn.atlassian.com/dam/jcr:e2a6f06f-b3d5-4002-aed3-73539c56a2eb/bitbucket_rgb_blue.png",
                                        "size": "Small",
                                        "style": "Person"
                                    }
                                ]
                            },
                            {
                                "type": "Column",
                                "width": "stretch",
                                "items": [
                                    {
                                        "type": "TextBlock",
                                        "text": "{{title}}",
                                        "weight": "Bolder",
                                        "size": "Medium",
                                        "wrap": True
                                    },
                                    {
                                        "type": "TextBlock",
                                        "text": "{{subtitle}}",
                                        "spacing": "None",
                                        "isSubtle": True,
                                        "wrap": True
                                    }
                                ]
                            }
                        ]
                    }
                ]
            }
        ],
        "actions": [
            {
                "type": "Action.OpenUrl",
                "title": "View in Bitbucket",
                "url": "{{url}}"
            }
        ],
        "msteams": {
            "width": "Full"
        }
    }


def create_adaptive_card_data(parsed_event: ParsedEvent) -> Dict[str, Any]:
    """
    Create data payload for Adaptive Card template.
    
    Args:
        parsed_event: The parsed Bitbucket event
    
    Returns:
        dict: Data payload for the Adaptive Card
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
            "commit_hash": parsed_event.metadata.get('commit_hash', 'unknown')
        })
    
    return data


def format_teams_message(parsed_event: ParsedEvent) -> Dict[str, Any]:
    """
    Convert ParsedEvent to Teams Adaptive Card JSON.
    
    Args:
        parsed_event: The parsed Bitbucket event
    
    Returns:
        dict: Teams Adaptive Card JSON structure
    
    Raises:
        ValueError: If parsed_event is None or has invalid data
    """
    if parsed_event is None:
        raise ValueError("ParsedEvent cannot be None")
    
    if not parsed_event.repository:
        raise ValueError("ParsedEvent must have a repository")
    
    # Create the data payload for the Adaptive Card
    card_data = create_adaptive_card_data(parsed_event)
    
    # Get theme color for styling
    theme_color = get_event_color(parsed_event.event_category, parsed_event.action, parsed_event.metadata)
    
    # Create the Adaptive Card structure
    adaptive_card = {
        "type": "AdaptiveCard",
        "version": "1.4",
        "body": [
            {
                "type": "Container",
                "style": "emphasis",
                "items": [
                    {
                        "type": "ColumnSet",
                        "columns": [
                            {
                                "type": "Column",
                                "width": "auto",
                                "items": [
                                    {
                                        "type": "Image",
                                        "url": "https://wac-cdn.atlassian.com/dam/jcr:e2a6f06f-b3d5-4002-aed3-73539c56a2eb/bitbucket_rgb_blue.png",
                                        "size": "Small",
                                        "style": "Person"
                                    }
                                ]
                            },
                            {
                                "type": "Column",
                                "width": "stretch",
                                "items": [
                                    {
                                        "type": "TextBlock",
                                        "text": card_data["title"],
                                        "weight": "Bolder",
                                        "size": "Medium",
                                        "wrap": True,
                                        "color": _get_text_color_for_theme(theme_color)
                                    }
                                ]
                            }
                        ]
                    }
                ]
            },
            {
                "type": "Container",
                "items": [
                    {
                        "type": "TextBlock",
                        "text": card_data.get("subtitle", ""),
                        "isSubtle": True,
                        "wrap": True,
                        "spacing": "Small"
                    } if card_data.get("subtitle") else None
                ]
            }
        ],
        "msteams": {
            "width": "Full"
        }
    }
    
    # Remove None items from body
    adaptive_card["body"] = [item for item in adaptive_card["body"] if item is not None]
    adaptive_card["body"][1]["items"] = [item for item in adaptive_card["body"][1]["items"] if item is not None]
    
    # Add event-specific content
    facts = []
    facts.extend([
        {"title": "Repository", "value": card_data["repository"]},
        {"title": "Event", "value": card_data["action"]},
        {"title": "Author", "value": card_data["author"]}
    ])
    
    # Add event-specific facts
    if parsed_event.event_category == 'pull_request':
        facts.extend([
            {"title": "PR ID", "value": card_data.get("pr_id", "")},
            {"title": "Source → Target", "value": f"{card_data.get('source_branch', 'unknown')} → {card_data.get('target_branch', 'unknown')}"},
            {"title": "State", "value": card_data.get("state", "unknown")}
        ])
    
    elif parsed_event.event_category == 'push':
        facts.extend([
            {"title": "Branch", "value": card_data.get("branch", "unknown")},
            {"title": "Commits", "value": card_data.get("commit_count", "0")}
        ])
        
        # Add commit details
        commits = card_data.get("commits", [])
        if commits:
            commit_text = []
            for commit in commits[:3]:  # Show max 3 commits
                commit_msg = commit.get('message', 'No message')[:50]
                if len(commit.get('message', '')) > 50:
                    commit_msg += '...'
                commit_text.append(f"• {commit.get('hash', 'unknown')}: {commit_msg}")
            
            adaptive_card["body"].append({
                "type": "Container",
                "items": [
                    {
                        "type": "TextBlock",
                        "text": "Recent Commits:",
                        "weight": "Bolder",
                        "size": "Small"
                    },
                    {
                        "type": "TextBlock",
                        "text": "\n".join(commit_text),
                        "wrap": True,
                        "size": "Small",
                        "spacing": "Small"
                    }
                ]
            })
    
    elif parsed_event.event_category == 'comment':
        facts.append({"title": "Context", "value": card_data.get("context_title", "unknown")})
        
        # Add comment content
        if card_data.get("description"):
            adaptive_card["body"].append({
                "type": "Container",
                "items": [
                    {
                        "type": "TextBlock",
                        "text": "Comment:",
                        "weight": "Bolder",
                        "size": "Small"
                    },
                    {
                        "type": "TextBlock",
                        "text": card_data["description"],
                        "wrap": True,
                        "size": "Small",
                        "spacing": "Small",
                        "style": "emphasis"
                    }
                ]
            })
    
    elif parsed_event.event_category == 'commit_status':
        facts.extend([
            {"title": "Build", "value": card_data.get("build_name", "Build")},
            {"title": "Status", "value": card_data.get("build_status", "unknown")},
            {"title": "Commit", "value": card_data.get("commit_hash", "unknown")}
        ])
        
        if card_data.get("description"):
            adaptive_card["body"].append({
                "type": "Container",
                "items": [
                    {
                        "type": "TextBlock",
                        "text": card_data["description"],
                        "wrap": True,
                        "size": "Small",
                        "isSubtle": True
                    }
                ]
            })
    
    # Add facts section
    adaptive_card["body"].append({
        "type": "Container",
        "items": [
            {
                "type": "FactSet",
                "facts": facts
            }
        ]
    })
    
    # Add action button if URL is available
    if card_data.get("url"):
        adaptive_card["actions"] = [
            {
                "type": "Action.OpenUrl",
                "title": "View in Bitbucket",
                "url": card_data["url"]
            }
        ]
    
    return adaptive_card


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


# Teams posting module
def post_to_teams(adaptive_card: Dict[str, Any], webhook_url: str) -> bool:
    """
    Post Adaptive Card to Microsoft Teams via Power Automate workflow.
    
    Args:
        adaptive_card: Teams Adaptive Card JSON structure
        webhook_url: Teams Power Automate workflow URL
    
    Returns:
        bool: True if posting succeeded, False otherwise
    """
    if not adaptive_card:
        logger.error("Cannot post empty adaptive card to Teams")
        return False
    
    if not webhook_url:
        logger.error("Teams webhook URL is required")
        return False
    
    try:
        # For Power Automate workflows, we need to wrap the Adaptive Card
        # in a payload that the workflow can process
        payload = {
            "type": "message",
            "attachments": [
                {
                    "contentType": "application/vnd.microsoft.card.adaptive",
                    "content": adaptive_card
                }
            ]
        }
        
        # Convert payload to JSON string
        payload_json = json.dumps(payload)
        
        # Prepare headers
        headers = {
            'Content-Type': 'application/json',
            'User-Agent': 'Bitbucket-Teams-Webhook/2.0'
        }
        
        # Extract title for logging
        title = "Unknown"
        if adaptive_card.get("body") and len(adaptive_card["body"]) > 0:
            first_container = adaptive_card["body"][0]
            if first_container.get("items") and len(first_container["items"]) > 0:
                column_set = first_container["items"][0]
                if column_set.get("columns") and len(column_set["columns"]) > 1:
                    text_column = column_set["columns"][1]
                    if text_column.get("items") and len(text_column["items"]) > 0:
                        title_block = text_column["items"][0]
                        title = title_block.get("text", "Unknown")
        
        logger.info(f"Posting Adaptive Card to Teams: {title}")
        
        response = http.request(
            'POST',
            webhook_url,
            body=payload_json,
            headers=headers,
            timeout=10.0  # 10 second timeout
        )
        
        # Power Automate workflows typically return 202 (Accepted) for successful posts
        if response.status in [200, 202]:
            logger.info("Successfully posted Adaptive Card to Teams")
            return True
        else:
            # Log the error response for debugging (with status code and response body)
            error_body = response.data.decode('utf-8') if response.data else 'No response body'
            logger.error(f"Teams workflow returned status {response.status}: {error_body}")
            return False
            
    except Exception as e:
        logger.error(f"Error posting Adaptive Card to Teams: {str(e)}")
        return False


# Load configuration on module import (fail fast)
try:
    CONFIG = Configuration.load_from_environment()
    FILTER_CONFIG = FilterConfig.from_environment(CONFIG.event_filter, CONFIG.filter_mode)
    logger.info("Configuration loaded successfully")
except ValueError as e:
    logger.error(f"Configuration loading failed: {e}")
    CONFIG = None
    FILTER_CONFIG = None

def lambda_handler(event: Dict[str, Any], context) -> Dict[str, Any]:
    """
    Main Lambda handler for processing Bitbucket webhook events.
    
    Args:
        event: API Gateway proxy event containing:
            - body: JSON string of webhook payload
            - headers: HTTP headers including X-Hub-Signature and X-Event-Key
            - requestContext: Request metadata
        context: Lambda execution context
    
    Returns:
        dict: API Gateway proxy response with statusCode and body
    """
    request_id = context.aws_request_id if context else 'unknown'
    event_type = None  # Initialize for error logging context
    start_time = time.time()  # Track processing duration
    
    try:
        log_with_context(logging.INFO, "Processing webhook request", request_id=request_id)
        
        # Fail fast if configuration is not loaded
        if CONFIG is None:
            log_with_context(logging.ERROR, "Configuration not loaded, failing fast", request_id=request_id)
            return {
                'statusCode': 500,
                'body': json.dumps({'error': 'Server configuration error'})
            }
        
        # Parse API Gateway proxy event
        headers = event.get('headers', {})
        body_str = event.get('body', '{}')
        is_base64_encoded = event.get('isBase64Encoded', False)
        
        # Handle base64 encoded body if needed
        if is_base64_encoded:
            import base64
            body_str = base64.b64decode(body_str).decode('utf-8')
        
        # Extract event type from headers
        event_type = headers.get('X-Event-Key', headers.get('x-event-key', ''))
        signature = headers.get('X-Hub-Signature', headers.get('x-hub-signature', ''))
        
        log_with_context(logging.INFO, f"Received event type: {event_type}", 
                        request_id=request_id, event_type=event_type)
        
        # Debug logging for signature verification
        log_with_context(logging.INFO, f"Body length: {len(body_str)}, Base64 encoded: {is_base64_encoded}", 
                        request_id=request_id, event_type=event_type)
        
        # Emit metric for event type if valid
        if event_type:
            CustomMetrics.emit_event_type_metric(event_type)
        
        # Parse JSON payload
        try:
            body = json.loads(body_str) if body_str else {}
        except json.JSONDecodeError as e:
            log_with_context(logging.ERROR, f"Invalid JSON payload: {str(e)}", 
                           request_id=request_id, event_type=event_type, 
                           payload_size=len(body_str))
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Invalid JSON payload'})
            }
        
        # Signature verification (task 4)
        # Retrieve webhook secret from Secrets Manager (task 5)
        try:
            webhook_secret = retrieve_webhook_secret(CONFIG)
        except Exception as e:
            log_with_context(logging.ERROR, f"Failed to retrieve webhook secret: {str(e)}", 
                           request_id=request_id, event_type=event_type)
            return {
                'statusCode': 500,
                'body': json.dumps({'error': 'Server configuration error'})
            }
        
        is_valid, error_msg = validate_webhook_signature(headers, body_str, webhook_secret)
        
        # If signature verification fails with original body, try with minified JSON
        if not is_valid:
            try:
                # Try to parse and minify the JSON
                parsed_json = json.loads(body_str)
                minified_body = json.dumps(parsed_json, separators=(',', ':'))
                is_valid, error_msg = validate_webhook_signature(headers, minified_body, webhook_secret)
                
                if is_valid:
                    log_with_context(logging.INFO, "Signature verified with minified JSON", 
                                   request_id=request_id, event_type=event_type)
                    # Use the minified body for further processing
                    body_str = minified_body
                else:
                    log_with_context(logging.WARNING, f"Signature verification failed with both original and minified JSON: {error_msg}", 
                                   request_id=request_id, event_type=event_type,
                                   has_signature=bool(signature), payload_size=len(body_str))
            except json.JSONDecodeError:
                log_with_context(logging.WARNING, f"Could not parse JSON for minification, signature verification failed: {error_msg}", 
                               request_id=request_id, event_type=event_type,
                               has_signature=bool(signature), payload_size=len(body_str))
        
        if not is_valid:
            # Emit custom metric for signature failure
            CustomMetrics.emit_signature_failure()
            
            return {
                'statusCode': 401,
                'body': json.dumps({'error': 'Unauthorized'})
            }
        
        log_with_context(logging.INFO, "Signature verification successful", 
                        request_id=request_id, event_type=event_type)
        
        # Event filtering (task 6)
        if FILTER_CONFIG is None:
            log_with_context(logging.ERROR, "Filter configuration not loaded, failing fast", 
                           request_id=request_id, event_type=event_type)
            return {
                'statusCode': 500,
                'body': json.dumps({'error': 'Server configuration error'})
            }
        
        should_process = should_process_event(event_type, body, FILTER_CONFIG)
        if not should_process:
            log_with_context(logging.INFO, "Event filtered out by configuration", 
                           request_id=request_id, event_type=event_type,
                           filter_mode=FILTER_CONFIG.mode)
            return {
                'statusCode': 200,
                'body': json.dumps({
                    'message': 'Event filtered, not processed',
                    'event_type': event_type,
                    'request_id': request_id
                })
            }
        
        log_with_context(logging.INFO, "Event passed filter, proceeding with processing", 
                        request_id=request_id, event_type=event_type)
        
        # Event parsing (task 7)
        try:
            parsed_event = parse_bitbucket_event(body, event_type)
            if parsed_event is None:
                log_with_context(logging.INFO, "Unsupported event type, returning success without processing", 
                               request_id=request_id, event_type=event_type)
                
                # Emit custom metric for unsupported event
                CustomMetrics.emit_unsupported_event()
                
                return {
                    'statusCode': 200,
                    'body': json.dumps({
                        'message': 'Unsupported event type, not processed',
                        'event_type': event_type,
                        'request_id': request_id
                    })
                }
            
            log_with_context(logging.INFO, f"Successfully parsed event for {parsed_event.repository}", 
                           request_id=request_id, event_type=event_type, 
                           repository=parsed_event.repository, action=parsed_event.action)
            
        except ValueError as e:
            log_with_context(logging.ERROR, f"Failed to parse event: {str(e)}", 
                           request_id=request_id, event_type=event_type)
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Malformed event payload'})
            }
        
        # Message formatting (task 8)
        try:
            teams_message = format_teams_message(parsed_event)
            log_with_context(logging.INFO, f"Successfully formatted Teams message", 
                           request_id=request_id, event_type=event_type,
                           event_category=parsed_event.event_category, 
                           repository=parsed_event.repository)
        except ValueError as e:
            log_with_context(logging.ERROR, f"Failed to format Teams message: {str(e)}", 
                           request_id=request_id, event_type=event_type,
                           repository=parsed_event.repository if parsed_event else None)
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Failed to format message'})
            }
        
        # Teams posting (task 9)
        try:
            teams_url = retrieve_teams_url(CONFIG)
        except Exception as e:
            log_with_context(logging.ERROR, f"Failed to retrieve Teams URL: {str(e)}", 
                           request_id=request_id, event_type=event_type)
            return {
                'statusCode': 500,
                'body': json.dumps({'error': 'Server configuration error'})
            }
        
        success = post_to_teams(teams_message, teams_url)
        if not success:
            log_with_context(logging.ERROR, "Failed to post message to Teams", 
                           request_id=request_id, event_type=event_type,
                           repository=parsed_event.repository)
            
            # Emit custom metric for Teams API failure
            CustomMetrics.emit_teams_api_failure()
            
            return {
                'statusCode': 500,
                'body': json.dumps({'error': 'Failed to post to Teams'})
            }
        
        log_with_context(logging.INFO, f"Successfully posted message to Teams", 
                        request_id=request_id, event_type=event_type,
                        event_category=parsed_event.event_category, 
                        repository=parsed_event.repository)
        
        # Emit processing duration metric
        processing_duration = (time.time() - start_time) * 1000  # Convert to milliseconds
        CustomMetrics.emit_processing_duration(processing_duration)
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Webhook processed and posted to Teams successfully',
                'event_type': event_type,
                'event_category': parsed_event.event_category,
                'repository': parsed_event.repository,
                'request_id': request_id,
                'processing_duration_ms': round(processing_duration, 2)
            })
        }
        
    except json.JSONDecodeError as e:
        log_with_context(logging.ERROR, f"Invalid JSON payload: {str(e)}", 
                        request_id=request_id, event_type=event_type,
                        error_type="JSONDecodeError")
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'Invalid JSON payload'})
        }
    except ValueError as e:
        # Client errors - malformed data, invalid configuration
        log_with_context(logging.ERROR, f"Client error: {str(e)}", 
                        request_id=request_id, event_type=event_type,
                        error_type="ValueError")
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'Bad request'})
        }
    except KeyError as e:
        # Missing required fields in payload
        log_with_context(logging.ERROR, f"Missing required field in payload: {str(e)}", 
                        request_id=request_id, event_type=event_type,
                        error_type="KeyError")
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'Missing required field in payload'})
        }
    except TypeError as e:
        # Type errors - usually client data issues
        log_with_context(logging.ERROR, f"Type error: {str(e)}", 
                        request_id=request_id, event_type=event_type,
                        error_type="TypeError")
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'Invalid data type in payload'})
        }
    except (ConnectionError, TimeoutError) as e:
        # Network/infrastructure errors
        log_with_context(logging.ERROR, f"Network error: {str(e)}", 
                        request_id=request_id, event_type=event_type,
                        error_type=type(e).__name__)
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Service temporarily unavailable'})
        }
    except ClientError as e:
        # AWS service errors
        error_code = e.response.get('Error', {}).get('Code', 'Unknown')
        log_with_context(logging.ERROR, f"AWS service error: {error_code} - {str(e)}", 
                        request_id=request_id, event_type=event_type,
                        error_type="ClientError", aws_error_code=error_code)
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Service configuration error'})
        }
    except Exception as e:
        # Catch-all for unexpected errors
        log_with_context(logging.ERROR, f"Unexpected error: {str(e)}", 
                        request_id=request_id, event_type=event_type,
                        error_type=type(e).__name__)
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Internal server error'})
        }
