"""
Integration tests for event filtering in the Lambda handler.
"""
import json
from unittest.mock import patch, MagicMock

# Import the lambda function module
import sys
sys.path.append('lambda')
from lambda_function import lambda_handler, Configuration, FilterConfig


def test_event_filtering_integration_filtered_event():
    """Test that filtered events return success without processing"""
    # Import signature computation function
    from lambda_function import compute_signature
    
    # Mock a configuration with explicit filtering
    mock_config = Configuration(
        teams_webhook_url_secret_arn='arn:aws:secretsmanager:us-east-1:123456789012:secret:teams-url',
        bitbucket_secret_arn='arn:aws:secretsmanager:us-east-1:123456789012:secret:bitbucket-secret',
        event_filter='pullrequest:created',  # Only allow PR created events
        filter_mode='explicit'
    )
    
    # Create filter config that only allows pullrequest:created
    mock_filter_config = FilterConfig.from_environment(mock_config.event_filter, 'explicit')
    
    # Create test payload for a different event type (repo:push)
    test_payload = json.dumps({
        'repository': {
            'name': 'test-repo',
            'full_name': 'user/test-repo'
        }
    })
    
    # Generate valid signature
    test_secret = 'placeholder_secret'
    valid_signature = compute_signature(test_payload, test_secret)
    
    # Mock event from API Gateway with repo:push (should be filtered out)
    event = {
        'headers': {
            'X-Event-Key': 'repo:push',
            'X-Hub-Signature': f'sha256={valid_signature}'
        },
        'body': test_payload
    }
    
    # Mock context
    context = MagicMock()
    context.aws_request_id = 'test-request-filtered'
    
    # Patch the global variables and mock secrets retrieval
    with patch('lambda_function.CONFIG', mock_config), \
         patch('lambda_function.FILTER_CONFIG', mock_filter_config), \
         patch('lambda_function.retrieve_webhook_secret', return_value=test_secret):
        response = lambda_handler(event, context)
    
    # Verify response - should be 200 but indicate event was filtered
    assert response['statusCode'] == 200
    response_body = json.loads(response['body'])
    assert 'Event filtered, not processed' in response_body['message']
    assert response_body['event_type'] == 'repo:push'


def test_event_filtering_integration_allowed_event():
    """Test that allowed events proceed with processing"""
    # Import signature computation function
    from lambda_function import compute_signature
    
    # Mock a configuration with explicit filtering
    mock_config = Configuration(
        teams_webhook_url_secret_arn='arn:aws:secretsmanager:us-east-1:123456789012:secret:teams-url',
        bitbucket_secret_arn='arn:aws:secretsmanager:us-east-1:123456789012:secret:bitbucket-secret',
        event_filter='pullrequest:created',  # Only allow PR created events
        filter_mode='explicit'
    )
    
    # Create filter config that allows pullrequest:created
    mock_filter_config = FilterConfig.from_environment(mock_config.event_filter, 'explicit')
    
    # Create test payload for allowed event type (pullrequest:created)
    test_payload = json.dumps({
        'pullrequest': {
            'title': 'Test PR',
            'author': {'display_name': 'Test User'}
        }
    })
    
    # Generate valid signature
    test_secret = 'placeholder_secret'
    valid_signature = compute_signature(test_payload, test_secret)
    
    # Mock event from API Gateway with pullrequest:created (should be allowed)
    event = {
        'headers': {
            'X-Event-Key': 'pullrequest:created',
            'X-Hub-Signature': f'sha256={valid_signature}'
        },
        'body': test_payload
    }
    
    # Mock context
    context = MagicMock()
    context.aws_request_id = 'test-request-allowed'
    
    # Patch the global variables and mock secrets retrieval and Teams posting
    with patch('lambda_function.CONFIG', mock_config), \
         patch('lambda_function.FILTER_CONFIG', mock_filter_config), \
         patch('lambda_function.retrieve_webhook_secret', return_value=test_secret), \
         patch('lambda_function.retrieve_teams_url', return_value='https://outlook.office.com/webhook/test'), \
         patch('lambda_function.post_to_teams', return_value=True):
        response = lambda_handler(event, context)
    
    # Verify response - should be 200 and proceed with processing
    assert response['statusCode'] == 200
    response_body = json.loads(response['body'])
    # Should NOT contain "Event filtered" message
    assert 'Event filtered' not in response_body['message']
    assert response_body['event_type'] == 'pullrequest:created'


def test_event_filtering_integration_failures_mode():
    """Test that failures mode correctly identifies and processes failure events"""
    # Import signature computation function
    from lambda_function import compute_signature
    
    # Mock a configuration with failures filtering
    mock_config = Configuration(
        teams_webhook_url_secret_arn='arn:aws:secretsmanager:us-east-1:123456789012:secret:teams-url',
        bitbucket_secret_arn='arn:aws:secretsmanager:us-east-1:123456789012:secret:bitbucket-secret',
        event_filter='',
        filter_mode='failures'
    )
    
    # Create filter config for failures mode
    mock_filter_config = FilterConfig.from_environment(mock_config.event_filter, 'failures')
    
    # Create test payload for a failure event (commit status failed)
    test_payload = json.dumps({
        'commit_status': {
            'state': 'FAILED',
            'key': 'test-build',
            'name': 'Test Build'
        }
    })
    
    # Generate valid signature
    test_secret = 'placeholder_secret'
    valid_signature = compute_signature(test_payload, test_secret)
    
    # Mock event from API Gateway with commit status failure
    event = {
        'headers': {
            'X-Event-Key': 'repo:commit_status_updated',
            'X-Hub-Signature': f'sha256={valid_signature}'
        },
        'body': test_payload
    }
    
    # Mock context
    context = MagicMock()
    context.aws_request_id = 'test-request-failure'
    
    # Patch the global variables and mock secrets retrieval and Teams posting
    with patch('lambda_function.CONFIG', mock_config), \
         patch('lambda_function.FILTER_CONFIG', mock_filter_config), \
         patch('lambda_function.retrieve_webhook_secret', return_value=test_secret), \
         patch('lambda_function.retrieve_teams_url', return_value='https://outlook.office.com/webhook/test'), \
         patch('lambda_function.post_to_teams', return_value=True):
        response = lambda_handler(event, context)
    
    # Verify response - should be 200 and proceed with processing (failure event should be allowed)
    assert response['statusCode'] == 200
    response_body = json.loads(response['body'])
    # Should NOT contain "Event filtered" message since this is a failure event
    assert 'Event filtered' not in response_body['message']
    assert response_body['event_type'] == 'repo:commit_status_updated'