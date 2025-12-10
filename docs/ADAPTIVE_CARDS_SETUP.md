# Adaptive Cards Setup Guide

This guide explains how to set up Microsoft Teams to receive Adaptive Cards from your Bitbucket webhook Lambda function.

## Overview

The Lambda function now sends Adaptive Cards instead of legacy MessageCards. Adaptive Cards provide a richer, more interactive experience and are the modern standard for Teams integrations.

## Setup Steps

### Step 1: Create a Power Automate Workflow

1. Go to [Power Automate](https://flow.microsoft.com/)
2. Click "Create" → "Instant cloud flow"
3. Name it "Bitbucket Webhook Handler"
4. Choose "When a HTTP request is received" as the trigger
5. Click "Create"

### Step 2: Configure the HTTP Trigger

1. In the HTTP trigger, click "Use sample payload to generate schema"
2. Paste this sample JSON:

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
            "text": "Sample message"
          }
        ]
      }
    }
  ]
}
```

3. Click "Done"

### Step 3: Add Teams Action

1. Click "New step"
2. Search for "Teams" and select "Microsoft Teams"
3. Choose "Post adaptive card in a chat or channel"
4. Sign in to Teams if prompted
5. Select your Team and Channel
6. In the "Adaptive Card" field, click in the text box and select "content" from the dynamic content (under "attachments item")

### Step 4: Save and Get Webhook URL

1. Click "Save" at the top
2. Go back to the HTTP trigger step
3. Copy the "HTTP POST URL" - this is your webhook URL
4. Update your `teams_webhook_url` secret with this URL

## Adaptive Card Features

The new Adaptive Cards include:

### Visual Elements
- **Bitbucket logo** for brand recognition
- **Color-coded headers** based on event type:
  - 🔴 Red for failures/declined PRs
  - 🟢 Green for successful builds/merged PRs
  - 🔵 Blue for pull requests
  - 🟣 Purple for push events
  - ⚪ Gray for comments

### Event-Specific Information

#### Pull Request Events
- PR ID and title
- Source → Target branch flow
- Author information
- Current state

#### Push Events
- Branch name
- Commit count
- Recent commit details (up to 3)
- Pusher information

#### Comment Events
- Context (PR or commit)
- Comment preview
- Author information

#### Build/Pipeline Events
- Build name and status
- Commit hash
- Status description

### Interactive Elements
- **"View in Bitbucket" button** - Opens the relevant Bitbucket page
- **Responsive design** - Adapts to different screen sizes
- **Rich formatting** - Bold headers, subtle text, proper spacing

## Testing

You can test the setup by:

1. Making a test commit to your Bitbucket repository
2. Creating a test pull request
3. Checking that the Adaptive Card appears in your Teams channel

## Troubleshooting

### Common Issues

1. **Workflow not triggering**
   - Verify the webhook URL is correct in your secrets
   - Check that the Lambda function is deployed and accessible

2. **Card not displaying properly**
   - Ensure you selected "content" from dynamic content, not the entire attachments array
   - Verify the Teams connector permissions

3. **Missing information in cards**
   - Check Lambda logs for parsing errors
   - Verify the Bitbucket webhook is sending expected payload structure

### Debug Steps

1. Check Power Automate run history for errors
2. Review Lambda CloudWatch logs
3. Test with a simple webhook payload first
4. Verify Teams channel permissions

## Migration from MessageCards

If you were previously using MessageCards (legacy format), the new Adaptive Cards provide:

- Better mobile experience
- More flexible layouts
- Richer formatting options
- Future-proof design
- Better accessibility

The Lambda function automatically handles the conversion from Bitbucket events to Adaptive Card format.