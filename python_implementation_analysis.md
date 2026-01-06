# Python Implementation Analysis: Bitbucket Lambda Teams Webhook Integration

## Overview
This document provides a detailed analysis of the Python implementation in the `feature/python` branch of the bitbucket-lambda repository, focusing on how commit status events are processed and how branch information is extracted.

---

## 1. Branch Information Extraction from Commit Status Events

### Key Finding: Branch Source
**The branch information for commit status updates comes from the `refname` field in the `commit_status` object.**

### Location in Code
**File:** `lambda/event_parser.py`  
**Function:** `_parse_commit_status_event()`  
**Lines:** Approximately 200-240

### Extraction Logic

```python
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
    
    # Extract branch information from refname
    branch = commit_status.get('refname', 'unknown')  # <-- BRANCH EXTRACTION
```

### Webhook Payload Structure
The commit status webhook payload has this structure:
```json
{
  "commit_status": {
    "state": "SUCCESSFUL|FAILED|INPROGRESS|STOPPED",
    "name": "Build Name",
    "description": "Build description",
    "url": "https://...",
    "refname": "refs/heads/branch-name",  // <-- BRANCH SOURCE
    "commit": {
      "hash": "abc123def456...",
      "links": { ... }
    }
  },
  "repository": { ... }
}
```

### Important Note
The `refname` field typically contains the full reference path (e.g., `refs/heads/main` or `refs/heads/feature/my-feature`). The current implementation stores this full path as-is without parsing it to extract just the branch name.

---

## 2. Commit Status Event Parsing Details

### Event Type Handling
The parser handles two commit status event types:
- `repo:commit_status_updated`
- `repo:commit_status_created`

### Parsed Event Structure
The `_parse_commit_status_event()` function returns a `ParsedEvent` object with:

| Field | Source | Value |
|-------|--------|-------|
| `event_category` | Hardcoded | `'commit_status'` |
| `repository` | `body['repository']['full_name']` or `body['repository']['name']` | Repository name |
| `action` | Mapped from `state` | `'succeeded'`, `'failed'`, `'in_progress'`, `'stopped'` |
| `author` | Hardcoded | `'System'` (pipeline events don't have a specific author) |
| `title` | Formatted | `"{name} {action}"` (e.g., "Build succeeded") |
| `description` | `commit_status['description']` | Build description |
| `url` | `commit_status['url']` | Build URL |
| `metadata` | Dictionary | Contains additional fields (see below) |

### Metadata Fields
The metadata dictionary contains:
```python
metadata = {
    'state': state,                    # 'SUCCESSFUL', 'FAILED', etc.
    'commit_hash': commit_hash,        # First 8 chars of commit hash
    'build_name': name,                # Build name from commit_status
    'build_url': commit_status.get('url', ''),  # Build URL
    'branch': branch                   # Branch from refname (FULL PATH)
}
```

### Action Mapping
```python
action_map = {
    'SUCCESSFUL': 'succeeded',
    'FAILED': 'failed',
    'INPROGRESS': 'in_progress',
    'STOPPED': 'stopped'
}
```

---

## 3. Teams Message Formatting

### Location in Code
**File:** `lambda/teams_formatter.py`  
**Function:** `format_teams_message()` and `create_adaptive_card_data()`

### Fields Sent to Teams for Commit Status Events

The `create_adaptive_card_data()` function extracts and formats the following fields for commit status events:

```python
elif parsed_event.event_category == 'commit_status':
    data.update({
        "build_name": parsed_event.metadata.get('build_name', 'Build'),
        "build_status": parsed_event.metadata.get('state', 'unknown'),
        "commit_hash": parsed_event.metadata.get('commit_hash', 'unknown'),
        "branch": parsed_event.metadata.get('branch', 'unknown')  # <-- BRANCH FIELD
    })
```

### Complete Teams Message Payload Structure

The final Teams message includes:

**Base Fields (All Events):**
- `title` - Event title
- `subtitle` - Author information with mention
- `repository` - Repository name
- `action` - Action in title case
- `author` - Author name
- `author_mention` - Author mention for Teams
- `event_category` - Event category
- `description` - Event description
- `url` - Event URL
- `mention_entities` - Array of mention entities for Teams
- `theme_color` - Hex color code based on event type/action
- `text_color` - Text color for visibility

**Commit Status Specific Fields:**
- `build_name` - Name of the build/pipeline
- `build_status` - Current status (SUCCESSFUL, FAILED, etc.)
- `commit_hash` - Short commit hash (8 characters)
- `branch` - Branch reference (from `refname`)

### Color Coding for Commit Status
```python
def get_event_color(event_category: str, action: str, metadata: Dict[str, Any]) -> str:
    # For commit_status events:
    if event_category == 'commit_status':
        state = metadata.get('state', '').upper()
        if state in ['FAILED', 'STOPPED', 'ERROR']:
            return "#DC3545"  # Red
        elif state == 'SUCCESSFUL':
            return "#28A745"  # Green
        else:
            return "#FFC107"  # Yellow (in-progress)
```

---

## 4. Processing Flow

### Lambda Handler Flow
**File:** `lambda/lambda_function.py`

The main `lambda_handler()` function follows this flow:

1. **Extract Event Metadata**
   - Get `X-Event-Key` header for event type
   - Get `X-Hub-Signature` header for signature verification
   - Parse JSON body

2. **Signature Verification**
   - Validate webhook signature using AWS Secrets Manager
   - Fallback to minified JSON if initial verification fails

3. **Event Filtering**
   - Check if event should be processed based on configuration

4. **Event Parsing**
   - Call `parse_bitbucket_event(body, event_type)`
   - For commit status events, calls `_parse_commit_status_event()`

5. **Message Formatting**
   - Call `format_teams_message(parsed_event)`
   - Creates Teams Adaptive Card data

6. **Teams Posting**
   - Retrieve Teams webhook URL from AWS Secrets Manager
   - Post formatted message to Teams

7. **Response**
   - Return success/error response with processing duration

---

## 5. Data Flow Diagram

```
Bitbucket Webhook
    ↓
Lambda Handler (lambda_function.py)
    ↓
Event Parser (event_parser.py)
    ├─ Extract commit_status object
    ├─ Get branch from commit_status.refname
    ├─ Get state and map to action
    └─ Create ParsedEvent with metadata
    ↓
Teams Formatter (teams_formatter.py)
    ├─ Extract metadata fields
    ├─ Create adaptive card data
    ├─ Add theme color based on state
    └─ Return formatted message
    ↓
Teams Client (teams_client.py)
    └─ POST to Teams webhook URL
```

---

## 6. Key Implementation Details

### Branch Field Handling
- **Source:** `commit_status.refname` from webhook payload
- **Format:** Full reference path (e.g., `refs/heads/main`)
- **Storage:** Stored as-is in metadata without parsing
- **Usage:** Passed directly to Teams message

### Commit Hash Handling
- **Source:** `commit_status.commit.hash`
- **Processing:** Truncated to first 8 characters for display
- **Storage:** Stored as `commit_hash` in metadata

### State/Action Mapping
- **SUCCESSFUL** → `succeeded` (Green #28A745)
- **FAILED** → `failed` (Red #DC3545)
- **INPROGRESS** → `in_progress` (Yellow #FFC107)
- **STOPPED** → `stopped` (Red #DC3545)

### Author Handling
- Commit status events don't have a specific author
- Author is hardcoded as `'System'`
- No author email is extracted for commit status events

---

## 7. Comparison with Other Event Types

### Pull Request Events
- Branch info comes from `pullrequest.source.branch.name` and `pullrequest.destination.branch.name`
- Stores both `source_branch` and `target_branch`

### Push Events
- Branch info comes from `push.changes[0].new.name`
- Stores as `branch` in metadata

### Commit Status Events
- Branch info comes from `commit_status.refname`
- Stores as `branch` in metadata (full reference path)

---

## 8. Potential Issues and Observations

### Issue 1: Branch Reference Format
The `refname` field contains the full reference path (e.g., `refs/heads/main`), not just the branch name. This might need parsing to extract just the branch name for display purposes.

### Issue 2: No Author Email for Commit Status
Unlike other event types, commit status events don't extract author email, so mentions won't work for these events.

### Issue 3: Missing Commit Status in Webhook
If the `commit_status` field is missing from the payload, a `ValueError` is raised with message: `"Missing 'commit_status' field in payload"`

### Issue 4: Fallback Values
Multiple fallback values are used:
- Branch: `'unknown'` if `refname` is missing
- Commit hash: `'unknown'` if `commit.hash` is missing
- Build name: `'Build'` if `name` is missing

---

## 9. Configuration and Filtering

### Event Type Filtering
The configuration system can filter which event types are processed:
- Whitelist mode: Only process specified event types
- Blacklist mode: Process all except specified event types

### Supported Event Types
- `repo:commit_status_updated`
- `repo:commit_status_created`

---

## 10. Summary

### Branch Extraction for Commit Status Events
1. **Source:** `commit_status.refname` field in webhook payload
2. **Format:** Full reference path (e.g., `refs/heads/branch-name`)
3. **Storage:** Stored in `ParsedEvent.metadata['branch']`
4. **Transmission:** Sent to Teams as `branch` field in adaptive card data
5. **Display:** Shown in Teams message as-is (full reference path)

### Key Fields Sent to Teams
- `build_name` - Pipeline/build name
- `build_status` - Current state (SUCCESSFUL, FAILED, etc.)
- `commit_hash` - Short commit hash (8 chars)
- `branch` - Branch reference from refname
- `theme_color` - Color based on status
- Standard fields: title, author, repository, description, URL

### Processing Pipeline
Webhook → Lambda Handler → Event Parser → Teams Formatter → Teams Client → Teams Channel

