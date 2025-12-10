# Teams Workflow Setup Instructions

## Overview
Now the Lambda sends **data only**, and your Teams Workflow creates the Adaptive Card using a template.

## Setup Steps

### Step 1: Edit Your Teams Workflow
1. In Teams, go to your channel
2. Click "..." → "Workflows"
3. Find your Bitbucket webhook workflow
4. Click "Edit workflow"

### Step 2: Configure the "Post card in a chat or channel" Step
1. Click on the "Post card in a chat or channel" step
2. In the **"Adaptive card json"** field, paste the entire contents of `teams_workflow_adaptive_card.json`

### Step 3: Save and Test
1. Save your workflow
2. Make a test commit or create a PR in Bitbucket
3. Check that the card shows real values (not template variables)

## What Changed

### Before (Not Working)
- Lambda sent complete Adaptive Card
- Teams Workflow tried to extract it from attachments
- Template variables like `${author}` weren't being replaced

### Now (Should Work)
- Lambda sends just the data: `{"title": "Add feature", "author": "John Doe", ...}`
- Teams Workflow uses template with expressions: `@{triggerBody()?['author']}`
- Teams automatically replaces expressions with real values

## Sample Data Format

The Lambda now sends data like this:
```json
{
  "title": "Add new authentication feature",
  "subtitle": "by John Doe",
  "repository": "mycompany/awesome-project",
  "action": "Created",
  "author": "John Doe",
  "event_category": "pull_request",
  "description": "This PR adds OAuth2 authentication...",
  "url": "https://bitbucket.org/mycompany/awesome-project/pull-requests/123",
  "theme_color": "#0078D4",
  "pr_id": "123",
  "source_branch": "feature/oauth2-auth",
  "target_branch": "main",
  "state": "OPEN",
  "branch_flow": "feature/oauth2-auth → main"
}
```

## Template Expressions Used

The Adaptive Card template uses these expressions:
- `@{triggerBody()?['title']}` - Gets the title
- `@{triggerBody()?['author']}` - Gets the author
- `@{triggerBody()?['repository']}` - Gets the repository
- `@{equals(triggerBody()?['event_category'], 'pull_request')}` - Conditional sections
- `@{not(empty(triggerBody()?['description']))}` - Show only if not empty

## Troubleshooting

### If you still see template expressions:
1. Make sure you pasted the **entire** JSON from `teams_workflow_adaptive_card.json`
2. Check that the expressions use `@{...}` not `${...}`
3. Verify the workflow is receiving data (check run history)

### If cards don't appear:
1. Check Teams Workflow run history for errors
2. Verify Lambda is sending data (check CloudWatch logs)
3. Test with a simple commit first

### If some fields are empty:
1. Check the event type (PR vs push vs comment)
2. Some fields only appear for specific event types
3. Verify the Lambda is parsing the Bitbucket payload correctly

## Testing

You can test the new format by running:
```bash
python debug_teams_payload.py
```

This will show you the exact data format being sent to Teams.