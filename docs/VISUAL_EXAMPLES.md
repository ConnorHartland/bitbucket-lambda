# Visual Examples of Teams Messages

This document provides visual representations of how Bitbucket webhook events appear as Microsoft Teams messages.

## Message Layout

All Teams messages follow this general layout:

```
┌─────────────────────────────────────────────────────────┐
│ [Color Bar] Event Title                                 │
│             by Author Name                              │
│                                                         │
│ Field Name 1:    Value 1                               │
│ Field Name 2:    Value 2                               │
│ Field Name 3:    Value 3                               │
│                                                         │
│ [View in Bitbucket] (Button)                           │
└─────────────────────────────────────────────────────────┘
```

## Pull Request Events

### Pull Request Created (Blue Theme)

```
┌─────────────────────────────────────────────────────────┐
│ 🔵 Add user authentication API                          │
│    by John Developer                                    │
│                                                         │
│ Repository:      my-org/backend-api                     │
│ Action:          Created                                │
│ Author:          John Developer                         │
│ Source Branch:   feature/auth-api                       │
│ Target Branch:   main                                   │
│ PR ID:           42                                     │
│                                                         │
│ [View in Bitbucket]                                     │
└─────────────────────────────────────────────────────────┘
```

### Pull Request Merged (Green Theme)

```
┌─────────────────────────────────────────────────────────┐
│ 🟢 Add user authentication API                          │
│    by John Developer                                    │
│                                                         │
│ Repository:      my-org/backend-api                     │
│ Action:          Merged                                 │
│ Author:          John Developer                         │
│ Source Branch:   feature/auth-api                       │
│ Target Branch:   main                                   │
│ PR ID:           42                                     │
│                                                         │
│ [View in Bitbucket]                                     │
└─────────────────────────────────────────────────────────┘
```

### Pull Request Declined (Red Theme)

```
┌─────────────────────────────────────────────────────────┐
│ 🔴 Experimental UI redesign                             │
│    by Jane Developer                                    │
│                                                         │
│ Repository:      my-org/frontend-app                    │
│ Action:          Declined                               │
│ Author:          Jane Developer                         │
│ Source Branch:   experimental/new-ui                    │
│ Target Branch:   main                                   │
│ PR ID:           43                                     │
│                                                         │
│ [View in Bitbucket]                                     │
└─────────────────────────────────────────────────────────┘
```

## Push Events (Purple Theme)

### Single Commit Push

```
┌─────────────────────────────────────────────────────────┐
│ 🟣 Push to main                                         │
│    by Alice Developer                                   │
│                                                         │
│ Repository:      my-org/mobile-app                      │
│ Branch:          main                                   │
│ Pusher:          Alice Developer                        │
│ Commits:         1                                      │
│ Recent Commits:  a1b2c3d4: Fix login validation bug    │
│                                                         │
│ [View in Bitbucket]                                     │
└─────────────────────────────────────────────────────────┘
```

### Multiple Commits Push

```
┌─────────────────────────────────────────────────────────┐
│ 🟣 Push to develop                                      │
│    by Bob Developer                                     │
│                                                         │
│ Repository:      my-org/web-service                     │
│ Branch:          develop                                │
│ Pusher:          Bob Developer                          │
│ Commits:         3                                      │
│ Recent Commits:  e5f6g7h8: Update API documentation    │
│                  i9j0k1l2: Add input validation        │
│                  m3n4o5p6: Fix memory leak in parser   │
│                                                         │
│ [View in Bitbucket]                                     │
└─────────────────────────────────────────────────────────┘
```

## Comment Events (Gray Theme)

### Pull Request Comment

```
┌─────────────────────────────────────────────────────────┐
│ ⚪ Comment on PR #42: Add user authentication API       │
│    by Carol Reviewer                                    │
│                                                         │
│ Repository:      my-org/backend-api                     │
│ Author:          Carol Reviewer                         │
│ Context:         PR #42: Add user authentication API   │
│ Comment:         Looks good overall! Just a few minor  │
│                  suggestions: 1. Consider adding input │
│                  validation for email format 2. The... │
│                                                         │
│ [View in Bitbucket]                                     │
└─────────────────────────────────────────────────────────┘
```

### Commit Comment

```
┌─────────────────────────────────────────────────────────┐
│ ⚪ Comment on Commit a1b2c3d4                           │
│    by David Reviewer                                    │
│                                                         │
│ Repository:      my-org/data-service                    │
│ Author:          David Reviewer                         │
│ Context:         Commit a1b2c3d4                        │
│ Comment:         This commit introduces a potential     │
│                  security vulnerability in the auth... │
│                                                         │
│ [View in Bitbucket]                                     │
└─────────────────────────────────────────────────────────┘
```

## Build/Pipeline Events

### Build Success (Green Theme)

```
┌─────────────────────────────────────────────────────────┐
│ 🟢 CI Pipeline succeeded                                │
│    by System                                            │
│                                                         │
│ Repository:      my-org/web-app                         │
│ Build:           CI Pipeline                            │
│ Status:          SUCCESSFUL                             │
│ Commit:          f9e8d7c6                               │
│ Description:     All tests passed: 127 passing, 0 fail │
│                                                         │
│ [View in Bitbucket]                                     │
└─────────────────────────────────────────────────────────┘
```

### Build Failure (Red Theme)

```
┌─────────────────────────────────────────────────────────┐
│ 🔴 CI Pipeline failed                                   │
│    by System                                            │
│                                                         │
│ Repository:      my-org/api-service                     │
│ Build:           CI Pipeline                            │
│ Status:          FAILED                                 │
│ Commit:          b2c3d4e5                               │
│ Description:     Tests failed: 3 failing, 124 passing. │
│                  Build failed due to linting errors.   │
│                                                         │
│ [View in Bitbucket]                                     │
└─────────────────────────────────────────────────────────┘
```

### Build In Progress (Yellow Theme)

```
┌─────────────────────────────────────────────────────────┐
│ 🟡 CI Pipeline in_progress                              │
│    by System                                            │
│                                                         │
│ Repository:      my-org/data-service                    │
│ Build:           CI Pipeline                            │
│ Status:          INPROGRESS                             │
│ Commit:          c4d5e6f7                               │
│ Description:     Running tests and security scans...   │
│                                                         │
│ [View in Bitbucket]                                     │
└─────────────────────────────────────────────────────────┘
```

## Event Filtering Examples

### Filter Mode: "all" (All Configured Events)

**Configuration**: `filter_mode = "all"`, `event_filter = "pullrequest:created,repo:push"`

**Teams Channel Activity**:
```
🔵 Add authentication feature (PR Created)
🟣 Push to feature/auth (Code Push)
🔵 Update documentation (PR Created)  
🟣 Push to main (Code Push)
🟢 Add authentication feature (PR Merged)
```

**Filtered Out**: Comments, build status, PR declined

### Filter Mode: "deployments" (Deployment Events Only)

**Configuration**: `filter_mode = "deployments"`

**Teams Channel Activity**:
```
🟡 CI Pipeline in_progress (Build Started)
🟢 CI Pipeline succeeded (Build Success)
🔴 Deploy Pipeline failed (Deploy Failure)
🟢 Deploy Pipeline succeeded (Deploy Success)
```

**Filtered Out**: PR events, code pushes, comments

### Filter Mode: "failures" (Failures Only)

**Configuration**: `filter_mode = "failures"`

**Teams Channel Activity**:
```
🔴 CI Pipeline failed (Build Failure)
🔴 Experimental feature (PR Declined)
🔴 Deploy Pipeline failed (Deploy Failure)
```

**Filtered Out**: Successful builds, PR created/merged, code pushes

## Teams Client Variations

### Desktop Teams Client

```
┌─────────────────────────────────────────────────────────┐
│ ████ [Colored left border - 4px wide]                  │
│                                                         │
│ 📋 Add user authentication API                          │
│ 👤 by John Developer                                    │
│                                                         │
│ Repository      │ my-org/backend-api                    │
│ Action          │ Created                               │
│ Source Branch   │ feature/auth-api                      │
│ Target Branch   │ main                                  │
│                                                         │
│ ┌─────────────────────┐                                │
│ │  View in Bitbucket  │                                │
│ └─────────────────────┘                                │
└─────────────────────────────────────────────────────────┘
```

### Mobile Teams App

```
┌─────────────────────────────┐
│ ████                        │
│                             │
│ 📋 Add user authentication  │
│    API                      │
│ 👤 by John Developer        │
│                             │
│ Repository:                 │
│ my-org/backend-api          │
│                             │
│ Action: Created             │
│ Source: feature/auth-api    │
│ Target: main                │
│                             │
│ ┌─────────────────────────┐ │
│ │   View in Bitbucket     │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

### Teams Web Client

```
┌─────────────────────────────────────────────────────────┐
│ ████ [Colored accent bar]                               │
│                                                         │
│ 🔔 Add user authentication API                          │
│ 👤 by John Developer • 📅 2024-12-09 14:30            │
│                                                         │
│ ┌─────────────────┬─────────────────────────────────────┐
│ │ Repository      │ my-org/backend-api                  │
│ ├─────────────────┼─────────────────────────────────────┤
│ │ Action          │ Created                             │
│ ├─────────────────┼─────────────────────────────────────┤
│ │ Source Branch   │ feature/auth-api                    │
│ ├─────────────────┼─────────────────────────────────────┤
│ │ Target Branch   │ main                                │
│ └─────────────────┴─────────────────────────────────────┘
│                                                         │
│ ┌─────────────────────┐                                │
│ │  View in Bitbucket  │ 🔗                             │
│ └─────────────────────┘                                │
└─────────────────────────────────────────────────────────┘
```

## Notification Behavior

### Desktop Notifications

When a Teams message is received:

```
┌─────────────────────────────────────────┐
│ 🔔 Microsoft Teams                      │
│                                         │
│ 📋 Bitbucket Notifications             │
│ Add user authentication API             │
│ by John Developer                       │
│                                         │
│ [View] [Dismiss]                        │
└─────────────────────────────────────────┘
```

### Mobile Push Notifications

```
┌─────────────────────────────────────────┐
│ 📱 Teams                                │
│ Bitbucket Notifications                 │
│ my-org/backend-api: Add user auth...    │
│                                    Now  │
└─────────────────────────────────────────┘
```

## Message Interaction

### Clicking "View in Bitbucket" Button

Opens the relevant Bitbucket page in a new browser tab/window:

- **Pull Request**: Opens the PR page with full details
- **Push Event**: Opens the commit view with changes
- **Comment**: Opens the PR or commit with comment highlighted
- **Build Event**: Opens the pipeline results page

### Message Threading

Teams messages appear in chronological order in the channel:

```
Channel: #dev-notifications

🟣 Push to main by Alice (2 minutes ago)
🔵 Add auth API by John (5 minutes ago)  
🟢 Fix bug #123 by Bob (10 minutes ago)
🔴 Build failed by System (15 minutes ago)
```

## Accessibility Features

### Screen Reader Support

Teams messages include proper ARIA labels and semantic structure:

- Activity titles are marked as headings
- Facts are presented as definition lists
- Action buttons have descriptive labels
- Color information is supplemented with icons

### High Contrast Mode

In high contrast mode, Teams automatically adjusts:

- Color themes become high contrast black/white
- Icons remain visible and clear
- Text maintains proper contrast ratios
- Buttons have clear focus indicators

### Keyboard Navigation

All message elements are keyboard accessible:

- Tab through facts and action buttons
- Enter/Space to activate "View in Bitbucket" button
- Arrow keys to navigate between messages
- Screen reader shortcuts for message content

This visual guide helps understand how Bitbucket webhook events are transformed into rich, accessible Teams messages that provide clear information about repository activity.