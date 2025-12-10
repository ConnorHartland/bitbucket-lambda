"""
Property-based tests for event filtering functionality.
"""
import pytest
from hypothesis import given, strategies as st, settings
from unittest.mock import patch

# Import the lambda function module
import sys
sys.path.append('lambda')
from lambda_function import FilterConfig, should_process_event


# Test data strategies
@st.composite
def filter_config_strategy(draw):
    """Generate FilterConfig instances with various configurations"""
    mode = draw(st.sampled_from(['all', 'deployments', 'failures', 'explicit']))
    
    if mode == 'explicit':
        # Generate explicit event type lists
        event_types = draw(st.lists(
            st.sampled_from([
                'pullrequest:created', 'pullrequest:updated', 'pullrequest:fulfilled',
                'pullrequest:rejected', 'repo:push', 'repo:commit_status_updated',
                'pullrequest:comment_created', 'issue:created'
            ]),
            min_size=0, max_size=5, unique=True
        ))
    else:
        event_types = []
    
    return FilterConfig(mode=mode, event_types=event_types)


@st.composite
def bitbucket_event_strategy(draw):
    """Generate Bitbucket event data with various event types and payloads"""
    event_type = draw(st.sampled_from([
        'pullrequest:created', 'pullrequest:updated', 'pullrequest:fulfilled',
        'pullrequest:rejected', 'repo:push', 'repo:commit_status_updated',
        'pullrequest:comment_created', 'issue:created', 'repo:commit_status_created'
    ]))
    
    # Generate event data based on event type
    if 'commit_status' in event_type:
        # Generate commit status events with various states
        state = draw(st.sampled_from(['SUCCESSFUL', 'FAILED', 'INPROGRESS', 'STOPPED', 'ERROR']))
        event_data = {
            'commit_status': {
                'state': state,
                'key': draw(st.text(min_size=1, max_size=50)),
                'name': draw(st.text(min_size=1, max_size=50))
            }
        }
    elif event_type == 'pullrequest:rejected':
        event_data = {
            'pullrequest': {
                'id': draw(st.integers(min_value=1, max_value=10000)),
                'title': draw(st.text(min_size=1, max_size=100)),
                'state': 'DECLINED'
            }
        }
    else:
        # Generic event data
        event_data = {
            'repository': {
                'name': draw(st.text(min_size=1, max_size=50)),
                'full_name': draw(st.text(min_size=1, max_size=100))
            }
        }
    
    return event_type, event_data


@given(
    event_filter=st.text(max_size=200, alphabet=st.characters(min_codepoint=32, max_codepoint=126)),
    filter_mode=st.sampled_from(['all', 'deployments', 'failures'])
)
@settings(max_examples=100)
def test_property_19_filter_configuration_loading(event_filter, filter_mode):
    """
    **Feature: bitbucket-teams-webhook, Property 19: Filter configuration loading**
    
    For any Lambda cold start, the event filter configuration should be loaded 
    from environment variables and parsed into a FilterConfig object
    **Validates: Requirements 9.1**
    """
    # Create FilterConfig from environment variables
    filter_config = FilterConfig.from_environment(event_filter, filter_mode)
    
    # Verify configuration is properly loaded
    assert filter_config.mode == filter_mode
    
    # Verify event types are properly parsed
    if event_filter.strip():
        expected_types = [t.strip() for t in event_filter.split(',') if t.strip()]
        assert filter_config.event_types == expected_types
    else:
        assert filter_config.event_types == []


@given(
    event_data=bitbucket_event_strategy(),
    filter_config=filter_config_strategy()
)
@settings(max_examples=100)
def test_property_20_event_filter_matching(event_data, filter_config):
    """
    **Feature: bitbucket-teams-webhook, Property 20: Event filter matching**
    
    For any webhook event and filter configuration, the handler should correctly 
    determine whether the event type matches the filter criteria
    **Validates: Requirements 9.2**
    """
    event_type, event_payload = event_data
    
    # Test the filtering logic
    result = should_process_event(event_type, event_payload, filter_config)
    
    # Verify result is boolean
    assert isinstance(result, bool)
    
    # Verify filtering logic based on mode
    if filter_config.mode == 'all':
        assert result is True
    elif filter_config.mode == 'deployments':
        # Should match deployment-related events
        expected = filter_config._is_deployment_event(event_type)
        assert result == expected
    elif filter_config.mode == 'failures':
        # Should match failure events
        expected = filter_config._is_failure_event(event_type, event_payload)
        assert result == expected
    else:
        # Explicit mode - should match if event type is in the list
        expected = event_type in filter_config.event_types
        assert result == expected


@given(
    event_data=bitbucket_event_strategy()
)
@settings(max_examples=100)
def test_property_21_filtered_event_rejection(event_data):
    """
    **Feature: bitbucket-teams-webhook, Property 21: Filtered event rejection**
    
    For any webhook event that does not match the configured filter, the handler 
    should return 200 status code without posting to Teams
    **Validates: Requirements 9.3**
    """
    event_type, event_payload = event_data
    
    # Create a filter that excludes this event type
    # Use explicit mode with empty event types list
    filter_config = FilterConfig(mode='explicit', event_types=[])
    
    # This should always return False for explicit mode with empty list
    result = should_process_event(event_type, event_payload, filter_config)
    assert result is False
    
    # Test with a filter that includes a different event type
    different_event_types = ['different:event', 'another:event']
    filter_config = FilterConfig(mode='explicit', event_types=different_event_types)
    
    # Should return False if event_type is not in the list
    if event_type not in different_event_types:
        result = should_process_event(event_type, event_payload, filter_config)
        assert result is False


@given(
    failure_state=st.sampled_from(['FAILED', 'STOPPED', 'ERROR']),
    event_key=st.sampled_from(['repo:commit_status_updated', 'repo:commit_status_created'])
)
@settings(max_examples=100)
def test_property_22_failure_event_identification(failure_state, event_key):
    """
    **Feature: bitbucket-teams-webhook, Property 22: Failure event identification**
    
    For any webhook event in "failures" filter mode, the handler should correctly 
    identify failure events (failed pipelines, declined PRs) and process only those
    **Validates: Requirements 9.5**
    """
    # Create failure event data
    event_data = {
        'commit_status': {
            'state': failure_state,
            'key': 'test-build',
            'name': 'Test Build'
        }
    }
    
    # Create failures filter
    filter_config = FilterConfig(mode='failures', event_types=[])
    
    # Should identify this as a failure event
    result = should_process_event(event_key, event_data, filter_config)
    assert result is True
    
    # Test with successful state - should not be processed
    success_event_data = {
        'commit_status': {
            'state': 'SUCCESSFUL',
            'key': 'test-build',
            'name': 'Test Build'
        }
    }
    
    result = should_process_event(event_key, success_event_data, filter_config)
    assert result is False
    
    # Test pullrequest:rejected - should always be processed in failures mode
    pr_rejected_data = {
        'pullrequest': {
            'id': 123,
            'title': 'Test PR',
            'state': 'DECLINED'
        }
    }
    
    result = should_process_event('pullrequest:rejected', pr_rejected_data, filter_config)
    assert result is True