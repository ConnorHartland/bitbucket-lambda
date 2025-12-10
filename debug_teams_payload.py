#!/usr/bin/env python3
"""
Debug script to test the exact payload being sent to Teams.
This helps troubleshoot the template variable issue.
"""

import json
import sys
import os

# Add the lambda directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'lambda'))

from lambda_function import ParsedEvent, format_teams_message

def create_simple_test_event():
    """Create a simple test event to debug"""
    return ParsedEvent(
        event_category='pull_request',
        repository='test/repo',
        action='created',
        author='Test User',
        title='Test Pull Request',
        description='This is a test PR',
        url='https://bitbucket.org/test/repo/pull-requests/1',
        metadata={
            'source_branch': 'feature/test',
            'target_branch': 'main',
            'pr_id': 1,
            'state': 'OPEN'
        }
    )

def debug_payload():
    """Debug the exact payload being sent"""
    print("=== DEBUGGING TEAMS PAYLOAD ===")
    
    # Create test event
    test_event = create_simple_test_event()
    print(f"Test Event: {test_event.title} by {test_event.author}")
    
    # Generate event data
    try:
        event_data = format_teams_message(test_event)
        print("\n✅ Event data generated successfully")
        
        # Show the actual values being sent
        print(f"\n=== EVENT DATA BEING SENT ===")
        for key, value in event_data.items():
            print(f"{key}: {value}")
        
        # Show the full JSON
        print(f"\n=== FULL EVENT DATA JSON ===")
        print(json.dumps(event_data, indent=2))
        
        # Save the event data for manual testing
        with open('debug_payload.json', 'w') as f:
            json.dump(event_data, f, indent=2)
        
        print(f"\n📁 Debug payload saved to 'debug_payload.json'")
        print("You can manually test this payload in your Teams Workflow")
        print("\nNOTE: This is now just the data - your Teams Workflow template will create the Adaptive Card")
        
    except Exception as e:
        print(f"❌ Error generating Adaptive Card: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    debug_payload()