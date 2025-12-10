"""
Property-based tests for configuration loading and validation.
"""
import os
import pytest
from hypothesis import given, strategies as st, settings
from unittest.mock import patch

# Import the lambda function module
import sys
sys.path.append('lambda')
from lambda_function import lambda_handler
from config import Configuration, FilterConfig
from signature import compute_signature, extract_signature_from_headers, verify_signature, validate_webhook_signature
from aws_secrets import retrieve_webhook_secret, retrieve_teams_url
from event_parser import parse_bitbucket_event, ParsedEvent, _parse_pull_request_event, _parse_push_event, _parse_comment_event, _parse_commit_status_event
from teams_formatter import format_teams_message, get_event_color, create_adaptive_card_data
from teams_client import post_to_teams



@given(
    teams_arn=st.text(min_size=1, max_size=100, alphabet=st.characters(min_codepoint=1, max_codepoint=127)),
    bitbucket_arn=st.text(min_size=1, max_size=100, alphabet=st.characters(min_codepoint=1, max_codepoint=127)),
    event_filter=st.text(max_size=200, alphabet=st.characters(min_codepoint=1, max_codepoint=127)),
    filter_mode=st.sampled_from(['all', 'deployments', 'failures'])
)
@settings(max_examples=100)
def test_property_16_configuration_retrieval_on_startup(teams_arn, bitbucket_arn, event_filter, filter_mode):
    """
    **Feature: bitbucket-teams-webhook, Property 16: Configuration retrieval on startup**
    
    For any Lambda cold start, both Teams Workflow URL and Bitbucket webhook secret 
    should be retrieved from their configured sources (environment variables or Secrets Manager)
    **Validates: Requirements 8.1, 8.2**
    """
    # Mock environment variables with valid configuration
    env_vars = {
        'TEAMS_WEBHOOK_URL_SECRET_ARN': teams_arn,
        'BITBUCKET_SECRET_ARN': bitbucket_arn,
        'EVENT_FILTER': event_filter,
        'FILTER_MODE': filter_mode
    }
    
    with patch.dict(os.environ, env_vars, clear=True):
        # Configuration should load successfully with all required fields
        config = Configuration.load_from_environment()
        
        # Verify all configuration fields are properly loaded
        assert config.teams_webhook_url_secret_arn == teams_arn
        assert config.bitbucket_secret_arn == bitbucket_arn
        assert config.event_filter == event_filter
        assert config.filter_mode == filter_mode


@given(
    missing_config=st.sampled_from(['teams_arn', 'bitbucket_arn', 'both']),
    present_teams_arn=st.text(min_size=1, max_size=100, alphabet=st.characters(min_codepoint=1, max_codepoint=127)),
    present_bitbucket_arn=st.text(min_size=1, max_size=100, alphabet=st.characters(min_codepoint=1, max_codepoint=127))
)
@settings(max_examples=100)
def test_property_17_missing_configuration_failure(missing_config, present_teams_arn, present_bitbucket_arn):
    """
    **Feature: bitbucket-teams-webhook, Property 17: Missing configuration failure**
    
    For any Lambda invocation where required configuration (Teams URL or webhook secret) 
    is missing, the handler should fail immediately with a clear error message before processing events
    **Validates: Requirements 8.3**
    """
    # Set up environment based on what should be missing
    env_vars = {}
    
    if missing_config == 'teams_arn':
        # Only bitbucket ARN present
        env_vars['BITBUCKET_SECRET_ARN'] = present_bitbucket_arn
    elif missing_config == 'bitbucket_arn':
        # Only teams ARN present  
        env_vars['TEAMS_WEBHOOK_URL_SECRET_ARN'] = present_teams_arn
    # For 'both', leave env_vars empty
    
    with patch.dict(os.environ, env_vars, clear=True):
        # Configuration loading should fail with ValueError
        with pytest.raises(ValueError) as exc_info:
            Configuration.load_from_environment()
        
        # Error message should mention missing configuration
        error_msg = str(exc_info.value)
        assert 'Missing required environment variables' in error_msg
        
        # Verify specific missing variables are mentioned
        if missing_config == 'teams_arn':
            assert 'TEAMS_WEBHOOK_URL_SECRET_ARN' in error_msg
        elif missing_config == 'bitbucket_arn':
            assert 'BITBUCKET_SECRET_ARN' in error_msg
        else:  # both missing
            assert 'TEAMS_WEBHOOK_URL_SECRET_ARN' in error_msg
            assert 'BITBUCKET_SECRET_ARN' in error_msg