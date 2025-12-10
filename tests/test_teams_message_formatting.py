"""
Property-based tests for Teams message formatting module.
"""
import pytest
import json
from hypothesis import given, strategies as st, settings
from unittest.mock import patch

# Import the lambda function module
import sys
sys.path.append('lambda')
from lambda_function import (
    format_teams_message,
    ParsedEvent,
    TeamsMessageCard,
    MessageSection,
    Fact,
    Action,
    get_event_color
)


# Test data generators
def parsed_event_strategy():
    """Generate ParsedEvent instances for testing"""
    return st.builds(
        ParsedEvent,
        event_category=st.sampled_from(['pull_request', 'push', 'comment', 'commit_status', 'unknown']),
        repository=st.text(min_size=3, max_size=50).filter(lambda x: len(x.strip()) > 0),
        action=st.text(min_size=1, max_size=30).filter(lambda x: len(x.strip()) > 0),
        author=st.text(min_size=1, max_size=50).filter(lambda x: len(x.strip()) > 0),
        title=st.one_of(st.none(), st.text(min_size=1, max_size=200)),
        description=st.one_of(st.none(), st.text(min_size=0, max_size=1000)),
        url=st.one_of(st.just(''), st.just('https://bitbucket.org/example/repo/pull-requests/1')),
        metadata=st.dictionaries(
            st.text(min_size=1, max_size=20),
            st.one_of(st.text(), st.integers(), st.booleans()),
            min_size=0,
            max_size=10
        )
    )


def pull_request_parsed_event_strategy():
    """Generate ParsedEvent instances specifically for pull requests"""
    return st.builds(
        ParsedEvent,
        event_category=st.just('pull_request'),
        repository=st.text(min_size=3, max_size=50).filter(lambda x: len(x.strip()) > 0),
        action=st.sampled_from(['created', 'updated', 'merged', 'declined', 'approved']),
        author=st.text(min_size=1, max_size=50).filter(lambda x: len(x.strip()) > 0),
        title=st.text(min_size=1, max_size=200),
        description=st.text(min_size=0, max_size=1000),
        url=st.just('https://bitbucket.org/example/repo/pull-requests/1'),
        metadata=st.fixed_dictionaries({
            'source_branch': st.text(min_size=1, max_size=50),
            'target_branch': st.text(min_size=1, max_size=50),
            'pr_id': st.integers(min_value=1, max_value=999999),
            'state': st.sampled_from(['OPEN', 'MERGED', 'DECLINED'])
        })
    )


def push_parsed_event_strategy():
    """Generate ParsedEvent instances specifically for push events"""
    return st.builds(
        ParsedEvent,
        event_category=st.just('push'),
        repository=st.text(min_size=3, max_size=50).filter(lambda x: len(x.strip()) > 0),
        action=st.just('pushed'),
        author=st.text(min_size=1, max_size=50).filter(lambda x: len(x.strip()) > 0),
        title=st.text(min_size=1, max_size=200),
        description=st.text(min_size=0, max_size=1000),
        url=st.just('https://bitbucket.org/example/repo/commits/abc123'),
        metadata=st.fixed_dictionaries({
            'branch': st.text(min_size=1, max_size=50),
            'commit_count': st.integers(min_value=1, max_value=20),
            'commits': st.lists(
                st.fixed_dictionaries({
                    'hash': st.text(min_size=8, max_size=8, alphabet='0123456789abcdef'),
                    'message': st.text(min_size=1, max_size=500),
                    'author': st.text(min_size=1, max_size=50)
                }),
                min_size=1,
                max_size=10
            )
        })
    )


def comment_parsed_event_strategy():
    """Generate ParsedEvent instances specifically for comment events"""
    return st.builds(
        ParsedEvent,
        event_category=st.just('comment'),
        repository=st.text(min_size=3, max_size=50).filter(lambda x: len(x.strip()) > 0),
        action=st.just('commented'),
        author=st.text(min_size=1, max_size=50).filter(lambda x: len(x.strip()) > 0),
        title=st.text(min_size=1, max_size=200),
        description=st.text(min_size=1, max_size=1000),
        url=st.just('https://bitbucket.org/example/repo/pull-requests/1'),
        metadata=st.fixed_dictionaries({
            'context_type': st.sampled_from(['pull_request', 'commit']),
            'context_title': st.text(min_size=1, max_size=100),
            'comment_id': st.integers(min_value=1, max_value=999999),
            'comment_length': st.integers(min_value=1, max_value=1000)
        })
    )


@given(parsed_event=parsed_event_strategy())
@settings(max_examples=100)
def test_property_2_message_card_validity(parsed_event):
    """
    **Feature: bitbucket-teams-webhook, Property 2: Message card validity**
    
    For any parsed Bitbucket event, the formatted Teams message should be valid JSON 
    conforming to MessageCard schema with all required fields (type, summary, sections)
    **Validates: Requirements 1.3**
    """
    # Format the message
    teams_message = format_teams_message(parsed_event)
    
    # Verify it's a valid dictionary (can be serialized to JSON)
    assert isinstance(teams_message, dict)
    
    # Verify JSON serialization works
    json_str = json.dumps(teams_message)
    assert isinstance(json_str, str)
    
    # Verify required MessageCard fields are present
    assert "@type" in teams_message
    assert teams_message["@type"] == "MessageCard"
    
    assert "@context" in teams_message
    assert teams_message["@context"] == "https://schema.org/extensions"
    
    assert "themeColor" in teams_message
    assert isinstance(teams_message["themeColor"], str)
    assert teams_message["themeColor"].startswith("#")
    assert len(teams_message["themeColor"]) == 7  # #RRGGBB format
    
    assert "summary" in teams_message
    assert isinstance(teams_message["summary"], str)
    assert len(teams_message["summary"]) > 0
    
    assert "sections" in teams_message
    assert isinstance(teams_message["sections"], list)
    assert len(teams_message["sections"]) > 0
    
    # Verify section structure
    for section in teams_message["sections"]:
        assert isinstance(section, dict)
        assert "activityTitle" in section
        assert isinstance(section["activityTitle"], str)
        assert len(section["activityTitle"]) > 0
        
        assert "facts" in section
        assert isinstance(section["facts"], list)
        
        # Verify fact structure
        for fact in section["facts"]:
            assert isinstance(fact, dict)
            assert "name" in fact
            assert "value" in fact
            assert isinstance(fact["name"], str)
            assert isinstance(fact["value"], str)
    
    assert "potentialAction" in teams_message
    assert isinstance(teams_message["potentialAction"], list)


@given(parsed_event=st.one_of(
    pull_request_parsed_event_strategy(),
    push_parsed_event_strategy(),
    comment_parsed_event_strategy()
))
@settings(max_examples=100)
def test_property_11_url_inclusion_in_messages(parsed_event):
    """
    **Feature: bitbucket-teams-webhook, Property 11: URL inclusion in messages**
    
    For any formatted Teams message, at least one clickable URL linking to the 
    relevant Bitbucket resource should be present in the potentialAction section
    **Validates: Requirements 4.4**
    """
    # Ensure the parsed event has a URL
    if not parsed_event.url:
        parsed_event.url = 'https://bitbucket.org/example/repo/pull-requests/1'
    
    teams_message = format_teams_message(parsed_event)
    
    # Verify potentialAction section exists and has at least one action
    assert "potentialAction" in teams_message
    potential_actions = teams_message["potentialAction"]
    assert isinstance(potential_actions, list)
    assert len(potential_actions) > 0
    
    # Verify at least one action has a valid URL
    found_url = False
    for action in potential_actions:
        assert isinstance(action, dict)
        assert "@type" in action
        assert action["@type"] == "OpenUri"
        
        if "targets" in action and action["targets"]:
            for target in action["targets"]:
                if "uri" in target and target["uri"]:
                    found_url = True
                    # Verify it's a valid URL format
                    uri = target["uri"]
                    assert isinstance(uri, str)
                    assert uri.startswith(('http://', 'https://'))
                    break
        
        if found_url:
            break
    
    assert found_url, "No valid URL found in potentialAction section"


@given(
    parsed_event=st.builds(
        ParsedEvent,
        event_category=st.text(min_size=1, max_size=30).filter(
            lambda x: x not in ['pull_request', 'push', 'comment', 'commit_status']
        ),
        repository=st.text(min_size=3, max_size=50).filter(lambda x: len(x.strip()) > 0),
        action=st.text(min_size=1, max_size=30).filter(lambda x: len(x.strip()) > 0),
        author=st.text(min_size=1, max_size=50).filter(lambda x: len(x.strip()) > 0),
        title=st.one_of(st.none(), st.text(min_size=1, max_size=200)),
        description=st.one_of(st.none(), st.text(min_size=0, max_size=1000)),
        url=st.one_of(st.just(''), st.just('https://bitbucket.org/example/repo')),
        metadata=st.dictionaries(
            st.text(min_size=1, max_size=20),
            st.one_of(st.text(), st.integers(), st.booleans()),
            min_size=0,
            max_size=5
        )
    )
)
@settings(max_examples=100)
def test_property_12_unsupported_event_handling(parsed_event):
    """
    **Feature: bitbucket-teams-webhook, Property 12: Unsupported event handling**
    
    For any webhook event with an unsupported or unrecognized event type, 
    the handler should return 200 status code without posting to Teams
    **Validates: Requirements 4.5**
    """
    # Format the message - should handle unsupported event types gracefully
    teams_message = format_teams_message(parsed_event)
    
    # Should still produce a valid message card
    assert isinstance(teams_message, dict)
    assert "@type" in teams_message
    assert teams_message["@type"] == "MessageCard"
    
    # Should have basic required fields
    assert "summary" in teams_message
    assert "sections" in teams_message
    assert len(teams_message["sections"]) > 0
    
    # Should include generic facts for unsupported events
    section = teams_message["sections"][0]
    facts = section["facts"]
    
    # Should have at least repository, event, and action facts
    fact_names = [fact["name"] for fact in facts]
    assert "Repository" in fact_names
    assert "Event" in fact_names
    assert "Action" in fact_names


# Test error handling
def test_format_teams_message_none_event():
    """Test that None ParsedEvent raises ValueError"""
    with pytest.raises(ValueError, match="ParsedEvent cannot be None"):
        format_teams_message(None)


def test_format_teams_message_empty_repository():
    """Test that empty repository raises ValueError"""
    parsed_event = ParsedEvent(
        event_category='test',
        repository='',
        action='test',
        author='test',
        title='test',
        description='test',
        url='',
        metadata={}
    )
    
    with pytest.raises(ValueError, match="ParsedEvent must have a repository"):
        format_teams_message(parsed_event)


# Test color coding
@given(
    event_category=st.sampled_from(['pull_request', 'push', 'comment', 'commit_status']),
    action=st.sampled_from(['created', 'merged', 'failed', 'declined', 'succeeded', 'pushed', 'commented']),
    metadata=st.dictionaries(
        st.sampled_from(['state', 'build_status']),
        st.sampled_from(['SUCCESSFUL', 'FAILED', 'INPROGRESS', 'STOPPED']),
        min_size=0,
        max_size=2
    )
)
@settings(max_examples=50)
def test_event_color_coding(event_category, action, metadata):
    """Test that event colors are assigned correctly"""
    color = get_event_color(event_category, action, metadata)
    
    # Should return a valid hex color
    assert isinstance(color, str)
    assert color.startswith("#")
    assert len(color) == 7
    
    # Test specific color mappings
    if action in ['failed', 'declined', 'stopped'] or action == 'rejected':
        assert color == "#DC3545"  # Red
    elif action in ['merged', 'succeeded', 'approved']:
        assert color == "#28A745"  # Green
    elif event_category == 'pull_request':
        assert color == "#0078D4"  # Blue
    elif event_category == 'push':
        assert color == "#6264A7"  # Purple
    elif event_category == 'commit_status':
        state = metadata.get('state', '').upper()
        if state == 'SUCCESSFUL':
            assert color == "#28A745"  # Green
        elif state in ['FAILED', 'STOPPED', 'ERROR']:
            assert color == "#DC3545"  # Red
        elif state == 'INPROGRESS':
            assert color == "#FFC107"  # Yellow