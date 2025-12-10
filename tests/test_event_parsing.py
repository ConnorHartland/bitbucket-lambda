"""
Property-based tests for event parsing module.
"""
import pytest
from hypothesis import given, strategies as st, settings
from unittest.mock import patch

# Import the lambda function module
import sys
sys.path.append('lambda')
from event_parser import (
    parse_bitbucket_event,
    ParsedEvent,
    _parse_pull_request_event,
    _parse_push_event,
    _parse_comment_event,
    _parse_commit_status_event
)


# Test data generators
def bitbucket_repository_strategy():
    """Generate repository data"""
    return st.fixed_dictionaries({
        'full_name': st.text(min_size=3, max_size=50).filter(lambda x: len(x.strip()) > 0),
        'name': st.text(min_size=1, max_size=30).filter(lambda x: len(x.strip()) > 0)
    })


def bitbucket_user_strategy():
    """Generate user data"""
    return st.fixed_dictionaries({
        'display_name': st.text(min_size=1, max_size=50).filter(lambda x: len(x.strip()) > 0),
        'username': st.text(min_size=1, max_size=30).filter(lambda x: len(x.strip()) > 0)
    })


def bitbucket_pullrequest_strategy():
    """Generate pull request event data"""
    return st.fixed_dictionaries({
        'repository': bitbucket_repository_strategy(),
        'pullrequest': st.fixed_dictionaries({
            'id': st.integers(min_value=1, max_value=999999),
            'title': st.text(min_size=1, max_size=200),
            'description': st.text(min_size=0, max_size=1000),
            'state': st.sampled_from(['OPEN', 'MERGED', 'DECLINED']),
            'author': bitbucket_user_strategy(),
            'source': st.fixed_dictionaries({
                'branch': st.fixed_dictionaries({
                    'name': st.text(min_size=1, max_size=50).filter(lambda x: len(x.strip()) > 0)
                })
            }),
            'destination': st.fixed_dictionaries({
                'branch': st.fixed_dictionaries({
                    'name': st.text(min_size=1, max_size=50).filter(lambda x: len(x.strip()) > 0)
                })
            }),
            'links': st.fixed_dictionaries({
                'html': st.fixed_dictionaries({
                    'href': st.just('https://bitbucket.org/example/repo/pull-requests/1')
                })
            })
        })
    })


def bitbucket_push_strategy():
    """Generate push event data"""
    return st.fixed_dictionaries({
        'repository': bitbucket_repository_strategy(),
        'actor': bitbucket_user_strategy(),
        'push': st.fixed_dictionaries({
            'changes': st.lists(
                st.fixed_dictionaries({
                    'new': st.fixed_dictionaries({
                        'name': st.text(min_size=1, max_size=50).filter(lambda x: len(x.strip()) > 0)
                    }),
                    'commits': st.lists(
                        st.fixed_dictionaries({
                            'hash': st.text(min_size=40, max_size=40, alphabet='0123456789abcdef'),
                            'message': st.text(min_size=1, max_size=500),
                            'author': st.fixed_dictionaries({
                                'user': bitbucket_user_strategy()
                            }),
                            'links': st.fixed_dictionaries({
                                'html': st.fixed_dictionaries({
                                    'href': st.just('https://bitbucket.org/example/repo/commits/abc123')
                                })
                            })
                        }),
                        min_size=1,
                        max_size=10
                    )
                }),
                min_size=1,
                max_size=5
            )
        })
    })


def bitbucket_comment_strategy():
    """Generate comment event data"""
    return st.fixed_dictionaries({
        'repository': bitbucket_repository_strategy(),
        'comment': st.fixed_dictionaries({
            'id': st.integers(min_value=1, max_value=999999),
            'user': bitbucket_user_strategy(),
            'content': st.fixed_dictionaries({
                'raw': st.text(min_size=1, max_size=1000)
            })
        }),
        'pullrequest': st.fixed_dictionaries({
            'id': st.integers(min_value=1, max_value=999999),
            'title': st.text(min_size=1, max_size=200),
            'links': st.fixed_dictionaries({
                'html': st.fixed_dictionaries({
                    'href': st.just('https://bitbucket.org/example/repo/pull-requests/1')
                })
            })
        })
    })


def bitbucket_commit_status_strategy():
    """Generate commit status event data"""
    return st.fixed_dictionaries({
        'repository': bitbucket_repository_strategy(),
        'commit_status': st.fixed_dictionaries({
            'state': st.sampled_from(['SUCCESSFUL', 'FAILED', 'INPROGRESS', 'STOPPED']),
            'name': st.text(min_size=1, max_size=100),
            'description': st.text(min_size=0, max_size=500),
            'url': st.just('https://bitbucket.org/example/repo/addon/pipelines/home#!/results/123'),
            'commit': st.fixed_dictionaries({
                'hash': st.text(min_size=40, max_size=40, alphabet='0123456789abcdef')
            })
        })
    })


@given(
    event_combo=st.one_of(
        st.tuples(bitbucket_pullrequest_strategy(), st.sampled_from(['pullrequest:created', 'pullrequest:updated', 'pullrequest:fulfilled', 'pullrequest:rejected'])),
        st.tuples(bitbucket_push_strategy(), st.just('repo:push')),
        st.tuples(bitbucket_comment_strategy(), st.just('pullrequest:comment_created')),
        st.tuples(bitbucket_commit_status_strategy(), st.just('repo:commit_status_updated'))
    )
)
@settings(max_examples=100)
def test_property_1_event_parsing_completeness(event_combo):
    """
    **Feature: bitbucket-teams-webhook, Property 1: Event parsing completeness**
    
    For any valid Bitbucket webhook JSON payload, parsing should successfully extract 
    all event-specific required fields without errors
    **Validates: Requirements 1.2**
    """
    event_data, event_type = event_combo
    
    # Parse the event
    parsed_event = parse_bitbucket_event(event_data, event_type)
    
    # Should successfully parse supported event types
    assert parsed_event is not None
    assert isinstance(parsed_event, ParsedEvent)
    
    # Verify all required fields are present and non-empty
    assert parsed_event.event_category is not None
    assert parsed_event.repository is not None
    assert parsed_event.action is not None
    assert parsed_event.author is not None
    assert parsed_event.url is not None
    assert isinstance(parsed_event.metadata, dict)
    
    # Verify event category matches expected values
    expected_categories = {
        'pullrequest:created': 'pull_request',
        'pullrequest:updated': 'pull_request',
        'pullrequest:fulfilled': 'pull_request',
        'pullrequest:rejected': 'pull_request',
        'repo:push': 'push',
        'pullrequest:comment_created': 'comment',
        'repo:commit_status_updated': 'commit_status'
    }
    
    if event_type in expected_categories:
        assert parsed_event.event_category == expected_categories[event_type]


@given(
    pr_data=bitbucket_pullrequest_strategy(),
    event_type=st.sampled_from(['pullrequest:created', 'pullrequest:updated', 'pullrequest:fulfilled', 'pullrequest:rejected'])
)
@settings(max_examples=100)
def test_property_8_pull_request_message_completeness(pr_data, event_type):
    """
    **Feature: bitbucket-teams-webhook, Property 8: Pull request message completeness**
    
    For any pull request event (created, updated, merged, declined), the formatted message 
    should contain PR title, author, source branch, target branch, and action
    **Validates: Requirements 4.1**
    """
    parsed_event = parse_bitbucket_event(pr_data, event_type)
    
    assert parsed_event is not None
    assert parsed_event.event_category == 'pull_request'
    
    # Verify PR-specific fields are present
    assert parsed_event.title is not None
    assert parsed_event.author is not None
    
    # Verify metadata contains PR-specific information
    assert 'source_branch' in parsed_event.metadata
    assert 'target_branch' in parsed_event.metadata
    assert 'pr_id' in parsed_event.metadata
    assert 'state' in parsed_event.metadata
    
    # Verify action is correctly mapped
    action_map = {
        'pullrequest:created': 'created',
        'pullrequest:updated': 'updated',
        'pullrequest:fulfilled': 'merged',
        'pullrequest:rejected': 'declined'
    }
    assert parsed_event.action == action_map[event_type]


@given(push_data=bitbucket_push_strategy())
@settings(max_examples=100)
def test_property_9_push_event_message_completeness(push_data):
    """
    **Feature: bitbucket-teams-webhook, Property 9: Push event message completeness**
    
    For any push event, the formatted message should contain repository name, 
    branch name, commit count, and pusher username
    **Validates: Requirements 4.2**
    """
    parsed_event = parse_bitbucket_event(push_data, 'repo:push')
    
    assert parsed_event is not None
    assert parsed_event.event_category == 'push'
    assert parsed_event.action == 'pushed'
    
    # Verify push-specific fields are present
    assert parsed_event.repository is not None
    assert parsed_event.author is not None
    
    # Verify metadata contains push-specific information
    assert 'branch' in parsed_event.metadata
    assert 'commit_count' in parsed_event.metadata
    assert 'commits' in parsed_event.metadata
    
    # Verify commit count matches actual commits
    expected_commit_count = len(push_data['push']['changes'][0]['commits'])
    assert parsed_event.metadata['commit_count'] == expected_commit_count
    
    # Verify title includes branch name
    branch_name = push_data['push']['changes'][0]['new']['name']
    assert branch_name in parsed_event.title


@given(comment_data=bitbucket_comment_strategy())
@settings(max_examples=100)
def test_property_10_comment_event_message_completeness(comment_data):
    """
    **Feature: bitbucket-teams-webhook, Property 10: Comment event message completeness**
    
    For any comment event, the formatted message should contain comment text, 
    author, and the context (PR or commit) where the comment was made
    **Validates: Requirements 4.3**
    """
    parsed_event = parse_bitbucket_event(comment_data, 'pullrequest:comment_created')
    
    assert parsed_event is not None
    assert parsed_event.event_category == 'comment'
    assert parsed_event.action == 'commented'
    
    # Verify comment-specific fields are present
    assert parsed_event.author is not None
    assert parsed_event.description is not None  # Contains comment text
    
    # Verify metadata contains comment-specific information
    assert 'context_type' in parsed_event.metadata
    assert 'context_title' in parsed_event.metadata
    assert 'comment_id' in parsed_event.metadata
    assert 'comment_length' in parsed_event.metadata
    
    # Verify context is correctly identified
    if 'pullrequest' in comment_data:
        assert parsed_event.metadata['context_type'] == 'pull_request'
        pr_id = comment_data['pullrequest']['id']
        assert str(pr_id) in parsed_event.metadata['context_title']


# Test error handling for malformed payloads
@given(
    malformed_data=st.one_of(
        st.none(),
        st.dictionaries(st.text(), st.text(), max_size=3),  # Random dict without required fields
        st.fixed_dictionaries({})  # Empty dict
    ),
    event_type=st.sampled_from(['pullrequest:created', 'repo:push', 'pullrequest:comment_created', 'repo:commit_status_updated'])
)
@settings(max_examples=50)
def test_malformed_payload_handling(malformed_data, event_type):
    """Test that malformed payloads raise appropriate errors"""
    with pytest.raises(ValueError):
        parse_bitbucket_event(malformed_data, event_type)


# Test unsupported event types
@given(
    valid_data=bitbucket_pullrequest_strategy(),
    unsupported_event=st.text(min_size=1, max_size=50).filter(
        lambda x: not x.startswith(('pullrequest:', 'repo:push', 'repo:commit_status'))
    )
)
@settings(max_examples=50)
def test_unsupported_event_types(valid_data, unsupported_event):
    """Test that unsupported event types return None"""
    result = parse_bitbucket_event(valid_data, unsupported_event)
    assert result is None