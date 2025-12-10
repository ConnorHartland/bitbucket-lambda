#!/usr/bin/env python3
"""
Test script for Adaptive Card generation.
This script helps you test the Adaptive Card format without deploying to AWS.
"""

import json
import sys
import os

# Add the lambda directory to the path so we can import the function
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'lambda'))

from lambda_function import ParsedEvent, format_teams_message

def create_test_pull_request_event():
    """Create a test pull request event"""
    return ParsedEvent(
        event_category='pull_request',
        repository='mycompany/awesome-project',
        action='created',
        author='John Doe',
        title='Add new authentication feature',
        description='This PR adds OAuth2 authentication support with proper error handling and tests.',
        url='https://bitbucket.org/mycompany/awesome-project/pull-requests/123',
        metadata={
            'source_branch': 'feature/oauth2-auth',
            'target_branch': 'main',
            'pr_id': 123,
            'state': 'OPEN'
        }
    )

def create_test_push_event():
    """Create a test push event"""
    return ParsedEvent(
        event_category='push',
        repository='mycompany/awesome-project',
        action='pushed',
        author='Jane Smith',
        title='Push to main',
        description='3 commits pushed',
        url='https://bitbucket.org/mycompany/awesome-project/commits/abc123',
        metadata={
            'branch': 'main',
            'commit_count': 3,
            'commits': [
                {
                    'hash': 'abc12345',
                    'message': 'Fix authentication bug in login flow',
                    'author': 'Jane Smith'
                },
                {
                    'hash': 'def67890',
                    'message': 'Update documentation for new API endpoints',
                    'author': 'Jane Smith'
                },
                {
                    'hash': 'ghi11121',
                    'message': 'Add unit tests for user service',
                    'author': 'Jane Smith'
                }
            ]
        }
    )

def create_test_comment_event():
    """Create a test comment event"""
    return ParsedEvent(
        event_category='comment',
        repository='mycompany/awesome-project',
        action='commented',
        author='Bob Wilson',
        title='Comment on PR #123: Add new authentication feature',
        description='This looks great! Just a few minor suggestions: 1) Consider adding rate limiting, 2) Maybe add some integration tests',
        url='https://bitbucket.org/mycompany/awesome-project/pull-requests/123',
        metadata={
            'context_type': 'pull_request',
            'context_title': 'PR #123: Add new authentication feature',
            'comment_id': 456
        }
    )

def create_test_build_success_event():
    """Create a test successful build event"""
    return ParsedEvent(
        event_category='commit_status',
        repository='mycompany/awesome-project',
        action='succeeded',
        author='System',
        title='Build succeeded',
        description='All tests passed. Deployment ready.',
        url='https://bitbucket.org/mycompany/awesome-project/addon/pipelines/home#!/results/789',
        metadata={
            'state': 'SUCCESSFUL',
            'commit_hash': 'abc12345',
            'build_name': 'CI/CD Pipeline'
        }
    )

def create_test_build_failure_event():
    """Create a test failed build event"""
    return ParsedEvent(
        event_category='commit_status',
        repository='mycompany/awesome-project',
        action='failed',
        author='System',
        title='Build failed',
        description='Tests failed: 3 unit tests failing in authentication module',
        url='https://bitbucket.org/mycompany/awesome-project/addon/pipelines/home#!/results/790',
        metadata={
            'state': 'FAILED',
            'commit_hash': 'def67890',
            'build_name': 'CI/CD Pipeline'
        }
    )

def test_adaptive_card_generation():
    """Test Adaptive Card generation for different event types"""
    
    test_events = [
        ("Pull Request Created", create_test_pull_request_event()),
        ("Push Event", create_test_push_event()),
        ("Comment Event", create_test_comment_event()),
        ("Build Success", create_test_build_success_event()),
        ("Build Failure", create_test_build_failure_event())
    ]
    
    print("Testing Adaptive Card Generation")
    print("=" * 50)
    
    for event_name, test_event in test_events:
        print(f"\n{event_name}:")
        print("-" * len(event_name))
        
        try:
            adaptive_card = format_teams_message(test_event)
            
            # Pretty print the JSON
            print(json.dumps(adaptive_card, indent=2))
            
            # Validate basic structure
            assert adaptive_card["type"] == "AdaptiveCard"
            assert adaptive_card["version"] == "1.4"
            assert "body" in adaptive_card
            assert len(adaptive_card["body"]) > 0
            
            print("✅ Adaptive Card generated successfully")
            
        except Exception as e:
            print(f"❌ Error generating Adaptive Card: {e}")
            return False
    
    return True

def create_teams_payload(adaptive_card):
    """Create the full payload that would be sent to Teams Workflows"""
    # For Teams Workflows, we wrap the Adaptive Card in message attachments
    return {
        "type": "message",
        "attachments": [
            {
                "contentType": "application/vnd.microsoft.card.adaptive",
                "content": adaptive_card
            }
        ]
    }

def main():
    """Main test function"""
    print("Bitbucket Teams Webhook - Adaptive Card Test")
    print("=" * 50)
    
    if test_adaptive_card_generation():
        print("\n🎉 All tests passed!")
        
        # Generate a sample payload for Teams workflow testing
        print("\nSample Teams Workflow Payload:")
        print("-" * 30)
        
        sample_event = create_test_pull_request_event()
        sample_card = format_teams_message(sample_event)
        teams_payload = create_teams_payload(sample_card)
        
        print(json.dumps(teams_payload, indent=2))
        
        # Save to file for easy testing
        with open('sample_teams_payload.json', 'w') as f:
            json.dump(teams_payload, f, indent=2)
        
        print("\n📁 Sample payload saved to 'sample_teams_payload.json'")
        print("You can use this file to test your Teams workflow manually.")
        
    else:
        print("\n❌ Some tests failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()