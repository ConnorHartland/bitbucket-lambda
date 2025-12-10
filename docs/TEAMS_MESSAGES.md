# Teams Message Examples

This document shows examples of how different Bitbucket events appear as Microsoft Teams messages, including screenshots and message card JSON structures.

## Message Card Format

All Teams messages use the MessageCard format with the following structure:

- **Theme Color**: Event-specific color coding
- **Summary**: Brief description for notifications
- **Activity Title**: Main event description
- **Activity Subtitle**: Author and context information
- **Facts**: Key-value pairs with event details
- **Potential Actions**: Clickable buttons linking to Bitbucket

## Color Coding

| Event Type | Color | Hex Code | Usage |
|------------|-------|----------|-------|
| Pull Request Created/Updated | Blue | `#0078D4` | New PR activity |
| Pull Request Merged/Approved | Green | `#28A745` | Successful completion |
| Pull Request Declined | Red | `#DC3545` | Rejection or failure |
| Push Events | Purple | `#6264A7` | Code changes |
| Comments | Gray | `#6C757D` | Discussion activity |
| Build Success | Green | `#28A745` | Successful builds |
| Build Failure | Red | `#DC3545` | Failed builds |
| Build In Progress | Yellow | `#FFC107` | Running builds |

## Pull Request Events

### Pull Request Created

**Event**: `pullrequest:created`

**Teams Message Appearance**:
```
🔵 [Blue Card]
Add user authentication API
by John Developer

Repository: my-org/backend-api
Action: Created
Author: John Developer
Source Branch: feature/auth-api
Target Branch: main
PR ID: 42

[View in Bitbucket] (Button)
```

**JSON Structure**:
```json
{
  "@type": "MessageCard",
  "@context": "https://schema.org/extensions",
  "themeColor": "#0078D4",
  "summary": "my-org/backend-api: Add user authentication API",
  "sections": [
    {
      "activityTitle": "Add user authentication API",
      "activitySubtitle": "by John Developer",
      "facts": [
        {"name": "Repository", "value": "my-org/backend-api"},
        {"name": "Action", "value": "Created"},
        {"name": "Author", "value": "John Developer"},
        {"name": "Source Branch", "value": "feature/auth-api"},
        {"name": "Target Branch", "value": "main"},
        {"name": "PR ID", "value": "42"}
      ],
      "markdown": true
    }
  ],
  "potentialAction": [
    {
      "@type": "OpenUri",
      "name": "View in Bitbucket",
      "targets": [
        {"os": "default", "uri": "https://bitbucket.org/my-org/backend-api/pull-requests/42"}
      ]
    }
  ]
}
```

### Pull Request Merged

**Event**: `pullrequest:fulfilled`

**Teams Message Appearance**:
```
🟢 [Green Card]
Add user authentication API
by John Developer

Repository: my-org/backend-api
Action: Merged
Author: John Developer
Source Branch: feature/auth-api
Target Branch: main
PR ID: 42

[View in Bitbucket] (Button)
```

### Pull Request Declined

**Event**: `pullrequest:rejected`

**Teams Message Appearance**:
```
🔴 [Red Card]
Add experimental feature
by Jane Developer

Repository: my-org/frontend-app
Action: Declined
Author: Jane Developer
Source Branch: experimental/new-ui
Target Branch: main
PR ID: 43

[View in Bitbucket] (Button)
```

## Push Events

### Code Push

**Event**: `repo:push`

**Teams Message Appearance**:
```
🟣 [Purple Card]
Push to main
by Alice Developer

Repository: my-org/mobile-app
Branch: main
Pusher: Alice Developer
Commits: 3
Recent Commits:
a1b2c3d4: Fix login validation bug
e5f6g7h8: Update dependencies to latest versions
i9j0k1l2: Add unit tests for auth module

[View in Bitbucket] (Button)
```

**JSON Structure**:
```json
{
  "@type": "MessageCard",
  "@context": "https://schema.org/extensions",
  "themeColor": "#6264A7",
  "summary": "my-org/mobile-app: Push to main",
  "sections": [
    {
      "activityTitle": "Push to main",
      "activitySubtitle": "by Alice Developer",
      "facts": [
        {"name": "Repository", "value": "my-org/mobile-app"},
        {"name": "Branch", "value": "main"},
        {"name": "Pusher", "value": "Alice Developer"},
        {"name": "Commits", "value": "3"},
        {"name": "Recent Commits", "value": "a1b2c3d4: Fix login validation bug\ne5f6g7h8: Update dependencies to latest versions\ni9j0k1l2: Add unit tests for auth module"}
      ],
      "markdown": true
    }
  ],
  "potentialAction": [
    {
      "@type": "OpenUri",
      "name": "View in Bitbucket",
      "targets": [
        {"os": "default", "uri": "https://bitbucket.org/my-org/mobile-app/commits/a1b2c3d4"}
      ]
    }
  ]
}
```

## Comment Events

### Pull Request Comment

**Event**: `pullrequest:comment_created`

**Teams Message Appearance**:
```
⚪ [Gray Card]
Comment on PR #42: Add user authentication API
by Bob Reviewer

Repository: my-org/backend-api
Author: Bob Reviewer
Context: PR #42: Add user authentication API
Comment: Looks good overall! Just a few minor suggestions:
1. Consider adding input validation for email format
2. The password strength requirements should be documented
3. Add rate limiting for login attempts...

[View in Bitbucket] (Button)
```

### Commit Comment

**Event**: `repo:commit_comment_created`

**Teams Message Appearance**:
```
⚪ [Gray Card]
Comment on Commit a1b2c3d4
by Carol Reviewer

Repository: my-org/backend-api
Author: Carol Reviewer
Context: Commit a1b2c3d4
Comment: This commit introduces a potential security vulnerability in the authentication logic. Please review the token validation...

[View in Bitbucket] (Button)
```

## Build/Pipeline Events

### Build Success

**Event**: `repo:commit_status_updated` (state: SUCCESSFUL)

**Teams Message Appearance**:
```
🟢 [Green Card]
CI Pipeline succeeded
by System

Repository: my-org/web-app
Build: CI Pipeline
Status: SUCCESSFUL
Commit: f9e8d7c6
Description: All tests passed: 127 passing, 0 failing

[View in Bitbucket] (Button)
```

**JSON Structure**:
```json
{
  "@type": "MessageCard",
  "@context": "https://schema.org/extensions",
  "themeColor": "#28A745",
  "summary": "my-org/web-app: CI Pipeline succeeded",
  "sections": [
    {
      "activityTitle": "CI Pipeline succeeded",
      "activitySubtitle": "by System",
      "facts": [
        {"name": "Repository", "value": "my-org/web-app"},
        {"name": "Build", "value": "CI Pipeline"},
        {"name": "Status", "value": "SUCCESSFUL"},
        {"name": "Commit", "value": "f9e8d7c6"},
        {"name": "Description", "value": "All tests passed: 127 passing, 0 failing"}
      ],
      "markdown": true
    }
  ],
  "potentialAction": [
    {
      "@type": "OpenUri",
      "name": "View in Bitbucket",
      "targets": [
        {"os": "default", "uri": "https://bitbucket.org/my-org/web-app/addon/pipelines/home#!/results/456"}
      ]
    }
  ]
}
```

### Build Failure

**Event**: `repo:commit_status_updated` (state: FAILED)

**Teams Message Appearance**:
```
🔴 [Red Card]
CI Pipeline failed
by System

Repository: my-org/api-service
Build: CI Pipeline
Status: FAILED
Commit: b2c3d4e5
Description: Tests failed: 3 failing, 124 passing. Build failed due to linting errors.

[View in Bitbucket] (Button)
```

### Build In Progress

**Event**: `repo:commit_status_updated` (state: INPROGRESS)

**Teams Message Appearance**:
```
🟡 [Yellow Card]
CI Pipeline in_progress
by System

Repository: my-org/data-service
Build: CI Pipeline
Status: INPROGRESS
Commit: c4d5e6f7
Description: Running tests and security scans...

[View in Bitbucket] (Button)
```

## Event Filtering Examples

### Filter Mode: "all"

With `event_filter = "pullrequest:created,pullrequest:fulfilled,repo:push"`:

**Processed Events**:
- ✅ Pull request created → Blue message
- ✅ Pull request merged → Green message  
- ✅ Code pushed → Purple message

**Filtered Out**:
- ❌ Pull request declined (not in filter)
- ❌ Comments (not in filter)
- ❌ Build status (not in filter)

### Filter Mode: "deployments"

**Processed Events**:
- ✅ Build success → Green message
- ✅ Build failure → Red message
- ✅ PR approved → Blue message

**Filtered Out**:
- ❌ PR created (not deployment-related)
- ❌ Code pushed (not deployment-related)
- ❌ Comments (not deployment-related)

### Filter Mode: "failures"

**Processed Events**:
- ✅ Build failure → Red message
- ✅ PR declined → Red message
- ✅ Build stopped → Red message

**Filtered Out**:
- ❌ Build success (not a failure)
- ❌ PR created (not a failure)
- ❌ PR merged (not a failure)

## Message Customization

### Repository-Specific Formatting

For different repositories, you can customize the message appearance:

```python
def get_custom_color_for_repo(repository_name, event_category, action):
    """Custom color scheme based on repository"""
    
    repo_colors = {
        'frontend-app': {
            'pull_request': '#FF6B35',  # Orange for frontend
            'push': '#4ECDC4',          # Teal for frontend
        },
        'backend-api': {
            'pull_request': '#45B7D1',  # Light blue for backend
            'push': '#96CEB4',          # Light green for backend
        }
    }
    
    return repo_colors.get(repository_name, {}).get(event_category, '#6C757D')
```

### Custom Facts

Add custom facts based on event type:

```python
def add_custom_facts(parsed_event, section):
    """Add repository-specific facts"""
    
    # Add environment information for deployment repos
    if 'deploy' in parsed_event.repository:
        section.facts.append(Fact("Environment", "Production"))
        section.facts.append(Fact("Deployment Window", "Business Hours Only"))
    
    # Add team information
    team_mapping = {
        'frontend-app': 'Frontend Team',
        'backend-api': 'Backend Team',
        'mobile-app': 'Mobile Team'
    }
    
    team = team_mapping.get(parsed_event.repository.split('/')[-1])
    if team:
        section.facts.append(Fact("Team", team))
```

## Teams Channel Setup

### Creating Incoming Webhooks

1. **Navigate to Teams Channel**:
   - Open Microsoft Teams
   - Go to the target channel
   - Click the three dots (⋯) next to the channel name

2. **Add Connector**:
   - Select **Connectors**
   - Find **Incoming Webhook**
   - Click **Configure**

3. **Configure Webhook**:
   - **Name**: `Bitbucket Notifications`
   - **Upload Image**: Optional custom icon
   - Click **Create**
   - Copy the webhook URL

4. **Test Webhook**:
   ```bash
   curl -X POST "YOUR_TEAMS_WEBHOOK_URL" \
     -H "Content-Type: application/json" \
     -d '{
       "@type": "MessageCard",
       "@context": "https://schema.org/extensions",
       "summary": "Test message",
       "text": "This is a test message from the Bitbucket webhook integration."
     }'
   ```

### Multiple Channels

For different types of notifications in separate channels:

**Development Channel** (`#dev-notifications`):
- Pull request events
- Code push events
- Comments

**DevOps Channel** (`#devops-alerts`):
- Build successes and failures
- Deployment events
- Pipeline status

**Management Channel** (`#exec-summary`):
- Critical failures only
- Security alerts
- Production incidents

## Message Appearance in Teams

### Desktop Teams Client

Messages appear as rich cards with:
- Colored left border indicating event type
- Bold activity title
- Subtitle with author information
- Structured facts in two-column layout
- Clickable action buttons at the bottom

### Mobile Teams App

Messages are optimized for mobile with:
- Condensed fact layout
- Touch-friendly action buttons
- Readable text sizing
- Proper color contrast

### Teams Web Client

Web client shows full message cards with:
- Full-width fact display
- Hover effects on action buttons
- Proper responsive layout
- Accessibility features

## Troubleshooting Message Issues

### Messages Not Appearing

1. **Check Teams Webhook URL**:
   - Verify URL is correct and active
   - Test with manual curl request
   - Check if webhook was deleted in Teams

2. **Verify Message Format**:
   - Ensure JSON is valid MessageCard format
   - Check for required fields (@type, @context)
   - Validate color codes are valid hex

3. **Check Teams Permissions**:
   - Verify webhook has permission to post
   - Check if channel still exists
   - Ensure Teams service is available

### Message Formatting Issues

1. **Colors Not Showing**:
   - Verify hex color codes are valid
   - Check themeColor field is set correctly
   - Some Teams clients may not show colors

2. **Links Not Working**:
   - Ensure URLs are properly formatted
   - Check potentialAction structure
   - Verify Bitbucket URLs are accessible

3. **Facts Not Displaying**:
   - Check facts array structure
   - Ensure name/value pairs are strings
   - Verify markdown field is set correctly

This comprehensive guide shows how Bitbucket events are transformed into rich, informative Teams messages that help teams stay informed about repository activity.