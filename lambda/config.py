"""Configuration management for the Bitbucket Teams webhook Lambda."""

import os
from dataclasses import dataclass
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)


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