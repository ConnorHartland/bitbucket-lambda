# Power Automate Workflow Fix

## Problem
Your Teams notifications are showing template variables like `${author}` instead of actual values.

## Root Cause
The Power Automate workflow is not configured correctly to handle the Adaptive Card JSON.

## Solution Steps

### Step 1: Check Your Current Workflow

1. Go to [Power Automate](https://flow.microsoft.com/)
2. Find your Bitbucket webhook workflow
3. Click "Edit"

### Step 2: Fix the HTTP Trigger Schema

1. Click on your HTTP trigger step
2. Click "Use sample payload to generate schema"
3. **Replace the existing schema** with this exact JSON:

```json
{
  "type": "AdaptiveCard",
  "version": "1.4",
  "body": [
    {
      "type": "Container",
      "style": "emphasis",
      "items": [
        {
          "type": "ColumnSet",
          "columns": [
            {
              "type": "Column",
              "width": "auto",
              "items": [
                {
                  "type": "Image",
                  "url": "https://example.com/image.png",
                  "size": "Small"
                }
              ]
            },
            {
              "type": "Column",
              "width": "stretch",
              "items": [
                {
                  "type": "TextBlock",
                  "text": "Sample Title",
                  "weight": "Bolder"
                }
              ]
            }
          ]
        }
      ]
    }
  ],
  "actions": [
    {
      "type": "Action.OpenUrl",
      "title": "View in Bitbucket",
      "url": "https://example.com"
    }
  ]
}
```

4. Click "Done"

### Step 3: Fix the Teams Action

1. Click on your "Post adaptive card in a chat or channel" step
2. **CRITICAL**: In the "Adaptive Card" field, you need to select the **entire HTTP request body**
3. Click in the "Adaptive Card" text box
4. From the Dynamic content panel, select **"body"** (the entire request body)
5. **DO NOT** select individual fields like "content" or anything nested

### Step 4: Test the Fix

1. Save your workflow
2. Trigger a test event from Bitbucket (make a commit or create a PR)
3. Check if the card now shows real values instead of template variables

## Alternative: Create New Workflow

If the above doesn't work, create a completely new workflow:

### New Workflow Steps

1. **Create Flow**: "Instant cloud flow" → "When a HTTP request is received"
2. **HTTP Trigger**: Use the schema from Step 2 above
3. **Teams Action**: "Post adaptive card in a chat or channel"
   - Team: Select your team
   - Channel: Select your channel  
   - Adaptive Card: Select "body" from dynamic content
4. **Save** and copy the new HTTP POST URL
5. **Update** your `teams_webhook_url` secret with the new URL

## Troubleshooting

### If you still see template variables:

1. **Check the workflow run history**:
   - Go to your workflow → "Run history"
   - Click on a recent run
   - Check what data is being received in the HTTP trigger
   - Verify the Teams action is using the right field

2. **Verify the Lambda is sending correct data**:
   - Check CloudWatch logs for your Lambda function
   - Look for "Posting Adaptive Card to Teams" log entries
   - Verify the title shows real values, not templates

3. **Test with the debug payload**:
   - Use the `debug_payload.json` file created by the debug script
   - Manually trigger your workflow with this payload
   - This will help isolate if the issue is in the Lambda or workflow

### Common Mistakes to Avoid:

❌ **Wrong**: Selecting "content" from attachments array  
✅ **Correct**: Selecting "body" (entire request)

❌ **Wrong**: Using template processing in Power Automate  
✅ **Correct**: Passing the Adaptive Card JSON directly

❌ **Wrong**: Wrapping the card in additional JSON structure  
✅ **Correct**: Using the card as-is from the Lambda

## Verification

After fixing, your cards should show:
- ✅ Real repository names (e.g., "mycompany/awesome-project")
- ✅ Real author names (e.g., "John Doe") 
- ✅ Real PR titles (e.g., "Add authentication feature")
- ✅ Real branch names (e.g., "feature/oauth2-auth → main")

Instead of:
- ❌ Template variables (e.g., "${author}", "${repository}")