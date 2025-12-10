# Teams Workflows Configuration Fix

## Problem
Your Teams notifications are showing template variables like `${author}` instead of actual values.

## Root Cause
Teams Workflows require a specific configuration to properly extract and display Adaptive Cards.

## Teams Workflows vs Power Automate
You're using **Teams Workflows** (native Teams feature), not Power Automate. This requires a different approach.

## Solution Steps

### Step 1: Check Your Current Workflow Configuration

1. In Teams, go to your channel
2. Click "..." → "Workflows" 
3. Find your Bitbucket webhook workflow
4. Click "Edit workflow"

### Step 2: Verify the Trigger Configuration

Your first node should be:
- **Trigger**: "When a Teams webhook request is received"
- This should automatically generate a webhook URL

### Step 3: Fix the "Post card" Configuration

In your second node "Post card in a chat or channel":

1. **Team**: Select your team
2. **Channel**: Select your channel
3. **Adaptive Card**: This is the critical part!

#### Option A: Use Dynamic Content (Recommended)
1. Click in the "Adaptive Card" field
2. From the dynamic content, select: **`attachments[0].content`**
3. This extracts the Adaptive Card from the message attachments

#### Option B: Use Expression (Alternative)
If dynamic content doesn't work, use this expression:
```
triggerBody()?['attachments']?[0]?['content']
```

### Step 4: Test the Configuration

1. Save your workflow
2. Make a test commit or create a PR in Bitbucket
3. Check if the card now shows real values

## Expected Payload Format

Your Lambda is now sending this format (which is correct for Teams Workflows):

```json
{
  "type": "message",
  "attachments": [
    {
      "contentType": "application/vnd.microsoft.card.adaptive",
      "content": {
        "type": "AdaptiveCard",
        "version": "1.4",
        "body": [
          // Actual Adaptive Card with real values
        ]
      }
    }
  ]
}
```

## Troubleshooting

### If you still see template variables:

1. **Check the workflow run history**:
   - In Teams, go to your workflow
   - Check recent runs to see what data is being received
   - Verify the "Post card" step is getting the right data

2. **Verify the dynamic content selection**:
   - Make sure you selected `attachments[0].content`
   - NOT just `attachments` or `content` alone

3. **Test with manual trigger**:
   - Use the debug payload to manually test your workflow
   - This helps isolate if the issue is in Lambda or workflow

### Common Teams Workflows Mistakes:

❌ **Wrong**: Selecting just `attachments` (this gives you the array)  
✅ **Correct**: Selecting `attachments[0].content` (this gives you the Adaptive Card)

❌ **Wrong**: Selecting `content` directly (this doesn't exist at root level)  
✅ **Correct**: Navigating through the attachments array first

❌ **Wrong**: Using the entire `triggerBody()` as the card  
✅ **Correct**: Extracting the nested content from attachments

## Manual Test Payload

You can manually test your workflow with this payload:

```json
{
  "type": "message",
  "attachments": [
    {
      "contentType": "application/vnd.microsoft.card.adaptive",
      "content": {
        "type": "AdaptiveCard",
        "version": "1.4",
        "body": [
          {
            "type": "TextBlock",
            "text": "Test Pull Request",
            "weight": "Bolder",
            "size": "Medium"
          },
          {
            "type": "TextBlock",
            "text": "by Test User",
            "isSubtle": true
          },
          {
            "type": "FactSet",
            "facts": [
              {
                "title": "Repository",
                "value": "test/repo"
              },
              {
                "title": "Author",
                "value": "Test User"
              }
            ]
          }
        ]
      }
    }
  ]
}
```

## Verification

After fixing, your cards should show:
- ✅ Real repository names (e.g., "mycompany/awesome-project")
- ✅ Real author names (e.g., "John Doe") 
- ✅ Real PR titles (e.g., "Add authentication feature")
- ✅ Proper formatting with Bitbucket logo and colors

## Alternative: Recreate the Workflow

If the above doesn't work, try creating a new workflow:

1. **Delete** the existing workflow
2. **Create new** workflow in Teams
3. **Add trigger**: "When a Teams webhook request is received"
4. **Add action**: "Post card in a chat or channel"
   - Team: Your team
   - Channel: Your channel
   - Adaptive Card: `attachments[0].content`
5. **Copy** the new webhook URL
6. **Update** your `teams_webhook_url` secret

This ensures you have the latest workflow format and configuration.