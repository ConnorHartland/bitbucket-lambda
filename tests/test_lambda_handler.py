"""
Unit tests for the main Lambda handler function.
"""
import json
import os
import pytest
from unittest.mock import patch, MagicMock

# Import the lambda function module
import sys
sys.path.append('lambda')
from lambda_function import lambda_handler, Configuration


def test_lambda_handler_with_valid_configuration():
    """Test that lambda handler works with valid configuration"""
    # Import signature computation function
    from lambda_function import compute_signature
    
    # Mock a valid configuration
    mock_config = Configuration(
        teams_webhook_url_secret_arn='arn:aws:secretsmanager:us-east-1:123456789012:secret:teams-url',
        bitbucket_secret_arn='arn:aws:secretsmanager:us-east-1:123456789012:secret:bitbucket-secret',
        event_filter='pullrequest:created,repo:push',
        filter_mode='all'
    )
    
    # Create test payload
    test_payload = json.dumps({
        'pullrequest': {
            'title': 'Test PR',
            'author': {'display_name': 'Test User'}
        }
    })
    
    # Generate valid signature using the placeholder secret
    test_secret = 'placeholder_secret'
    valid_signature = compute_signature(test_payload, test_secret)
    
    # Mock event from API Gateway
    event = {
        'headers': {
            'X-Event-Key': 'pullrequest:created',
            'X-Hub-Signature': f'sha256={valid_signature}'
        },
        'body': test_payload
    }
    
    # Mock context
    context = MagicMock()
    context.aws_request_id = 'test-request-123'
    
    # Create mock filter config
    from lambda_function import FilterConfig
    mock_filter_config = FilterConfig.from_environment(mock_config.event_filter, mock_config.filter_mode)
    
    # Patch the global CONFIG and FILTER_CONFIG variables and mock secrets retrieval
    with patch('lambda_function.CONFIG', mock_config), \
         patch('lambda_function.FILTER_CONFIG', mock_filter_config), \
         patch('lambda_function.retrieve_webhook_secret', return_value=test_secret), \
         patch('lambda_function.retrieve_teams_url', return_value='https://teams.webhook.url'), \
         patch('lambda_function.post_to_teams', return_value=True):
        response = lambda_handler(event, context)
    
    # Verify response structure
    assert response['statusCode'] == 200
    response_body = json.loads(response['body'])
    assert 'message' in response_body
    assert response_body['event_type'] == 'pullrequest:created'
    assert response_body['request_id'] == 'test-request-123'


def test_lambda_handler_with_missing_configuration():
    """Test that lambda handler fails fast with missing configuration"""
    # Mock event
    event = {
        'headers': {'X-Event-Key': 'pullrequest:created'},
        'body': '{}'
    }
    
    # Mock context
    context = MagicMock()
    context.aws_request_id = 'test-request-456'
    
    # Patch CONFIG to None (simulating failed configuration loading)
    with patch('lambda_function.CONFIG', None):
        response = lambda_handler(event, context)
    
    # Verify error response
    assert response['statusCode'] == 500
    response_body = json.loads(response['body'])
    assert 'error' in response_body
    assert response_body['error'] == 'Server configuration error'


def test_lambda_handler_with_invalid_json():
    """Test that lambda handler handles invalid JSON gracefully"""
    # Mock a valid configuration
    mock_config = Configuration(
        teams_webhook_url_secret_arn='arn:aws:secretsmanager:us-east-1:123456789012:secret:teams-url',
        bitbucket_secret_arn='arn:aws:secretsmanager:us-east-1:123456789012:secret:bitbucket-secret',
        event_filter='',
        filter_mode='all'
    )
    
    # Mock event with invalid JSON
    event = {
        'headers': {'X-Event-Key': 'pullrequest:created'},
        'body': '{"invalid": json}'  # Invalid JSON
    }
    
    # Mock context
    context = MagicMock()
    context.aws_request_id = 'test-request-789'
    
    # Patch the global CONFIG variable
    with patch('lambda_function.CONFIG', mock_config):
        response = lambda_handler(event, context)
    
    # Verify error response
    assert response['statusCode'] == 400
    response_body = json.loads(response['body'])
    assert 'error' in response_body
    assert response_body['error'] == 'Invalid JSON payload'


def test_lambda_handler_with_invalid_signature():
    """Test that lambda handler rejects requests with invalid signatures"""
    # Mock a valid configuration
    mock_config = Configuration(
        teams_webhook_url_secret_arn='arn:aws:secretsmanager:us-east-1:123456789012:secret:teams-url',
        bitbucket_secret_arn='arn:aws:secretsmanager:us-east-1:123456789012:secret:bitbucket-secret',
        event_filter='',
        filter_mode='all'
    )
    
    # Mock event with invalid signature
    event = {
        'headers': {
            'X-Event-Key': 'pullrequest:created',
            'X-Hub-Signature': 'sha256=invalid-signature'
        },
        'body': json.dumps({'test': 'data'})
    }
    
    # Mock context
    context = MagicMock()
    context.aws_request_id = 'test-request-invalid-sig'
    
    # Patch the global CONFIG variable and mock secrets retrieval
    with patch('lambda_function.CONFIG', mock_config), \
         patch('lambda_function.retrieve_webhook_secret', return_value='test_secret'):
        response = lambda_handler(event, context)
    
    # Verify unauthorized response
    assert response['statusCode'] == 401
    response_body = json.loads(response['body'])
    assert 'error' in response_body
    assert response_body['error'] == 'Unauthorized'


# End-to-end flow tests for subtask 11.1
def test_end_to_end_pullrequest_created_flow():
    """Test complete flow from webhook receipt to Teams posting for PR created event"""
    from lambda_function import compute_signature, FilterConfig
    
    # Mock configuration
    mock_config = Configuration(
        teams_webhook_url_secret_arn='arn:aws:secretsmanager:us-east-1:123456789012:secret:teams-url',
        bitbucket_secret_arn='arn:aws:secretsmanager:us-east-1:123456789012:secret:bitbucket-secret',
        event_filter='',
        filter_mode='all'
    )
    
    mock_filter_config = FilterConfig.from_environment(mock_config.event_filter, mock_config.filter_mode)
    
    # Create realistic PR created payload
    test_payload = json.dumps({
        'pullrequest': {
            'id': 123,
            'title': 'Add new feature',
            'description': 'This PR adds a new feature to the application',
            'author': {
                'display_name': 'John Doe',
                'username': 'johndoe'
            },
            'source': {
                'branch': {'name': 'feature/new-feature'}
            },
            'destination': {
                'branch': {'name': 'main'}
            },
            'state': 'OPEN',
            'links': {
                'html': {'href': 'https://bitbucket.org/user/repo/pull-requests/123'}
            }
        },
        'repository': {
            'name': 'test-repo',
            'full_name': 'user/test-repo'
        }
    })
    
    # Generate valid signature
    test_secret = 'webhook_secret_123'
    valid_signature = compute_signature(test_payload, test_secret)
    
    # Mock API Gateway event
    event = {
        'headers': {
            'X-Event-Key': 'pullrequest:created',
            'X-Hub-Signature': f'sha256={valid_signature}',
            'Content-Type': 'application/json'
        },
        'body': test_payload
    }
    
    # Mock context
    context = MagicMock()
    context.aws_request_id = 'test-e2e-pr-created'
    
    # Mock Teams posting to capture the message
    posted_message = None
    posted_url = None
    
    def mock_post_to_teams(message, url):
        nonlocal posted_message, posted_url
        posted_message = message
        posted_url = url
        return True
    
    # Execute complete flow
    with patch('lambda_function.CONFIG', mock_config), \
         patch('lambda_function.FILTER_CONFIG', mock_filter_config), \
         patch('lambda_function.retrieve_webhook_secret', return_value=test_secret), \
         patch('lambda_function.retrieve_teams_url', return_value='https://outlook.office.com/webhook/test-teams'), \
         patch('lambda_function.post_to_teams', side_effect=mock_post_to_teams):
        
        response = lambda_handler(event, context)
    
    # Verify successful response
    assert response['statusCode'] == 200
    response_body = json.loads(response['body'])
    assert 'Webhook processed and posted to Teams successfully' in response_body['message']
    assert response_body['event_type'] == 'pullrequest:created'
    assert response_body['event_category'] == 'pull_request'
    assert response_body['repository'] == 'user/test-repo'
    assert response_body['request_id'] == 'test-e2e-pr-created'
    
    # Verify Teams message was posted
    assert posted_message is not None
    assert posted_url == 'https://outlook.office.com/webhook/test-teams'
    
    # Verify Teams message structure
    assert posted_message['@type'] == 'MessageCard'
    assert posted_message['summary'] == 'user/test-repo: Add new feature'
    assert posted_message['themeColor'] == '#0078D4'  # Blue for PR
    
    # Verify message sections contain expected data
    sections = posted_message['sections']
    assert len(sections) == 1
    section = sections[0]
    assert section['activityTitle'] == 'Add new feature'
    assert section['activitySubtitle'] == 'by John Doe'
    
    # Verify facts contain PR details
    facts = {fact['name']: fact['value'] for fact in section['facts']}
    assert facts['Repository'] == 'user/test-repo'
    assert facts['Action'] == 'Created'
    assert facts['Author'] == 'John Doe'
    assert facts['Source Branch'] == 'feature/new-feature'
    assert facts['Target Branch'] == 'main'
    assert facts['PR ID'] == '123'
    
    # Verify action button
    actions = posted_message['potentialAction']
    assert len(actions) == 1
    assert actions[0]['name'] == 'View in Bitbucket'
    assert actions[0]['targets'][0]['uri'] == 'https://bitbucket.org/user/repo/pull-requests/123'


def test_end_to_end_push_event_flow():
    """Test complete flow from webhook receipt to Teams posting for push event"""
    from lambda_function import compute_signature, FilterConfig
    
    # Mock configuration
    mock_config = Configuration(
        teams_webhook_url_secret_arn='arn:aws:secretsmanager:us-east-1:123456789012:secret:teams-url',
        bitbucket_secret_arn='arn:aws:secretsmanager:us-east-1:123456789012:secret:bitbucket-secret',
        event_filter='',
        filter_mode='all'
    )
    
    mock_filter_config = FilterConfig.from_environment(mock_config.event_filter, mock_config.filter_mode)
    
    # Create realistic push payload
    test_payload = json.dumps({
        'push': {
            'changes': [{
                'new': {
                    'name': 'main',
                    'type': 'branch'
                },
                'commits': [
                    {
                        'hash': 'abc123def456',
                        'message': 'Fix bug in authentication\n\nThis commit fixes the authentication issue',
                        'author': {
                            'user': {
                                'display_name': 'Jane Smith'
                            }
                        },
                        'links': {
                            'html': {'href': 'https://bitbucket.org/user/repo/commits/abc123def456'}
                        }
                    },
                    {
                        'hash': 'def456ghi789',
                        'message': 'Update documentation',
                        'author': {
                            'user': {
                                'display_name': 'Jane Smith'
                            }
                        },
                        'links': {
                            'html': {'href': 'https://bitbucket.org/user/repo/commits/def456ghi789'}
                        }
                    }
                ]
            }]
        },
        'actor': {
            'display_name': 'Jane Smith',
            'username': 'janesmith'
        },
        'repository': {
            'name': 'test-repo',
            'full_name': 'user/test-repo'
        }
    })
    
    # Generate valid signature
    test_secret = 'webhook_secret_456'
    valid_signature = compute_signature(test_payload, test_secret)
    
    # Mock API Gateway event
    event = {
        'headers': {
            'X-Event-Key': 'repo:push',
            'X-Hub-Signature': f'sha256={valid_signature}'
        },
        'body': test_payload
    }
    
    # Mock context
    context = MagicMock()
    context.aws_request_id = 'test-e2e-push'
    
    # Mock Teams posting
    posted_message = None
    
    def mock_post_to_teams(message, url):
        nonlocal posted_message
        posted_message = message
        return True
    
    # Execute complete flow
    with patch('lambda_function.CONFIG', mock_config), \
         patch('lambda_function.FILTER_CONFIG', mock_filter_config), \
         patch('lambda_function.retrieve_webhook_secret', return_value=test_secret), \
         patch('lambda_function.retrieve_teams_url', return_value='https://outlook.office.com/webhook/test'), \
         patch('lambda_function.post_to_teams', side_effect=mock_post_to_teams):
        
        response = lambda_handler(event, context)
    
    # Verify successful response
    assert response['statusCode'] == 200
    response_body = json.loads(response['body'])
    assert response_body['event_category'] == 'push'
    assert response_body['repository'] == 'user/test-repo'
    
    # Verify Teams message
    assert posted_message is not None
    assert posted_message['themeColor'] == '#6264A7'  # Purple for push
    
    # Verify push-specific facts
    facts = {fact['name']: fact['value'] for fact in posted_message['sections'][0]['facts']}
    assert facts['Branch'] == 'main'
    assert facts['Pusher'] == 'Jane Smith'
    assert facts['Commits'] == '2'
    assert 'Recent Commits' in facts


def test_end_to_end_filtered_event_does_not_reach_teams():
    """Test that filtered events don't reach Teams posting"""
    from lambda_function import compute_signature, FilterConfig
    
    # Mock configuration with specific filtering (only allow PR events)
    mock_config = Configuration(
        teams_webhook_url_secret_arn='arn:aws:secretsmanager:us-east-1:123456789012:secret:teams-url',
        bitbucket_secret_arn='arn:aws:secretsmanager:us-east-1:123456789012:secret:bitbucket-secret',
        event_filter='pullrequest:created,pullrequest:merged',
        filter_mode='explicit'
    )
    
    mock_filter_config = FilterConfig.from_environment(mock_config.event_filter, 'explicit')
    
    # Create push event payload (should be filtered out)
    test_payload = json.dumps({
        'push': {
            'changes': [{
                'new': {'name': 'main'},
                'commits': [{'hash': 'abc123', 'message': 'Test commit'}]
            }]
        },
        'repository': {'full_name': 'user/test-repo'}
    })
    
    # Generate valid signature
    test_secret = 'webhook_secret_789'
    valid_signature = compute_signature(test_payload, test_secret)
    
    # Mock API Gateway event
    event = {
        'headers': {
            'X-Event-Key': 'repo:push',  # This should be filtered out
            'X-Hub-Signature': f'sha256={valid_signature}'
        },
        'body': test_payload
    }
    
    # Mock context
    context = MagicMock()
    context.aws_request_id = 'test-e2e-filtered'
    
    # Mock Teams posting - should NOT be called
    teams_called = False
    
    def mock_post_to_teams(message, url):
        nonlocal teams_called
        teams_called = True
        return True
    
    # Execute complete flow
    with patch('lambda_function.CONFIG', mock_config), \
         patch('lambda_function.FILTER_CONFIG', mock_filter_config), \
         patch('lambda_function.retrieve_webhook_secret', return_value=test_secret), \
         patch('lambda_function.retrieve_teams_url', return_value='https://outlook.office.com/webhook/test'), \
         patch('lambda_function.post_to_teams', side_effect=mock_post_to_teams):
        
        response = lambda_handler(event, context)
    
    # Verify response indicates filtering
    assert response['statusCode'] == 200
    response_body = json.loads(response['body'])
    assert 'Event filtered, not processed' in response_body['message']
    assert response_body['event_type'] == 'repo:push'
    
    # Verify Teams was NOT called
    assert teams_called is False


def test_end_to_end_signature_failure_rejected_early():
    """Test that signature failures are rejected early without processing"""
    from lambda_function import FilterConfig
    
    # Mock configuration
    mock_config = Configuration(
        teams_webhook_url_secret_arn='arn:aws:secretsmanager:us-east-1:123456789012:secret:teams-url',
        bitbucket_secret_arn='arn:aws:secretsmanager:us-east-1:123456789012:secret:bitbucket-secret',
        event_filter='',
        filter_mode='all'
    )
    
    mock_filter_config = FilterConfig.from_environment(mock_config.event_filter, mock_config.filter_mode)
    
    # Create valid payload but with wrong signature
    test_payload = json.dumps({
        'pullrequest': {
            'title': 'Test PR',
            'author': {'display_name': 'Test User'}
        },
        'repository': {'full_name': 'user/test-repo'}
    })
    
    # Mock API Gateway event with INVALID signature
    event = {
        'headers': {
            'X-Event-Key': 'pullrequest:created',
            'X-Hub-Signature': 'sha256=completely-wrong-signature'
        },
        'body': test_payload
    }
    
    # Mock context
    context = MagicMock()
    context.aws_request_id = 'test-e2e-sig-fail'
    
    # Mock functions that should NOT be called due to early rejection
    teams_called = False
    parse_called = False
    format_called = False
    
    def mock_post_to_teams(message, url):
        nonlocal teams_called
        teams_called = True
        return True
    
    def mock_parse_event(body, event_type):
        nonlocal parse_called
        parse_called = True
        return None
    
    def mock_format_message(parsed_event):
        nonlocal format_called
        format_called = True
        return {}
    
    # Execute flow - should fail at signature verification
    with patch('lambda_function.CONFIG', mock_config), \
         patch('lambda_function.FILTER_CONFIG', mock_filter_config), \
         patch('lambda_function.retrieve_webhook_secret', return_value='correct_secret'), \
         patch('lambda_function.post_to_teams', side_effect=mock_post_to_teams), \
         patch('lambda_function.parse_bitbucket_event', side_effect=mock_parse_event), \
         patch('lambda_function.format_teams_message', side_effect=mock_format_message):
        
        response = lambda_handler(event, context)
    
    # Verify early rejection with 401
    assert response['statusCode'] == 401
    response_body = json.loads(response['body'])
    assert response_body['error'] == 'Unauthorized'
    
    # Verify that downstream functions were NOT called
    assert teams_called is False
    assert parse_called is False
    assert format_called is False


def test_end_to_end_teams_posting_failure():
    """Test complete flow when Teams posting fails"""
    from lambda_function import compute_signature, FilterConfig
    
    # Mock configuration
    mock_config = Configuration(
        teams_webhook_url_secret_arn='arn:aws:secretsmanager:us-east-1:123456789012:secret:teams-url',
        bitbucket_secret_arn='arn:aws:secretsmanager:us-east-1:123456789012:secret:bitbucket-secret',
        event_filter='',
        filter_mode='all'
    )
    
    mock_filter_config = FilterConfig.from_environment(mock_config.event_filter, mock_config.filter_mode)
    
    # Create valid payload
    test_payload = json.dumps({
        'pullrequest': {
            'title': 'Test PR',
            'author': {'display_name': 'Test User'},
            'links': {'html': {'href': 'https://bitbucket.org/user/repo/pull-requests/1'}}
        },
        'repository': {'full_name': 'user/test-repo'}
    })
    
    # Generate valid signature
    test_secret = 'webhook_secret_fail'
    valid_signature = compute_signature(test_payload, test_secret)
    
    # Mock API Gateway event
    event = {
        'headers': {
            'X-Event-Key': 'pullrequest:created',
            'X-Hub-Signature': f'sha256={valid_signature}'
        },
        'body': test_payload
    }
    
    # Mock context
    context = MagicMock()
    context.aws_request_id = 'test-e2e-teams-fail'
    
    # Mock Teams posting to fail
    def mock_post_to_teams_fail(message, url):
        return False  # Simulate Teams API failure
    
    # Execute complete flow
    with patch('lambda_function.CONFIG', mock_config), \
         patch('lambda_function.FILTER_CONFIG', mock_filter_config), \
         patch('lambda_function.retrieve_webhook_secret', return_value=test_secret), \
         patch('lambda_function.retrieve_teams_url', return_value='https://outlook.office.com/webhook/test'), \
         patch('lambda_function.post_to_teams', side_effect=mock_post_to_teams_fail):
        
        response = lambda_handler(event, context)
    
    # Verify error response when Teams posting fails
    assert response['statusCode'] == 500
    response_body = json.loads(response['body'])
    assert response_body['error'] == 'Failed to post to Teams'