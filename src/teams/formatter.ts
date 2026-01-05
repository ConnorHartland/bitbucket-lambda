/**
 * Teams Message Formatting Module
 * Formats parsed Bitbucket events into Teams Adaptive Card data
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8
 */

export interface ParsedEvent {
  eventCategory: string;
  repository: string;
  action: string;
  author: string;
  title: string | null;
  description: string | null;
  url: string;
  metadata: Record<string, any>;
}

interface MentionEntity {
  type: string;
  text: string;
  mentioned: { id: string; name: string };
}

const COLOR_MAP: Record<string, string> = {
  failure: '#DC3545',
  success: '#28A745',
  'in-progress': '#FFC107',
  pull_request: '#0078D4',
  push: '#6264A7',
  default: '#6C757D'
};

const TEXT_COLOR_MAP: Record<string, string> = {
  '#DC3545': 'Attention',
  '#28A745': 'Good',
  '#FFC107': 'Warning',
  '#0078D4': 'Accent',
  '#6264A7': 'Default',
  '#6C757D': 'Default'
};

export function getEventColor(
  eventCategory: string,
  action: string,
  metadata: Record<string, any>
): string {
  if (['failed', 'declined', 'stopped', 'rejected'].includes(action)) {
    return COLOR_MAP.failure;
  }

  if (['merged', 'succeeded', 'approved'].includes(action)) {
    return COLOR_MAP.success;
  }

  if (eventCategory === 'commit_status') {
    const state = (metadata.state || '').toUpperCase();
    if (['FAILED', 'STOPPED', 'ERROR'].includes(state)) return COLOR_MAP.failure;
    if (state === 'SUCCESSFUL') return COLOR_MAP.success;
    return COLOR_MAP['in-progress'];
  }

  return COLOR_MAP[eventCategory] || COLOR_MAP.default;
}

export function createMentionEntity(email: string, displayName: string): MentionEntity | null {
  return email
    ? {
        type: 'mention',
        text: `<at>${displayName}</at>`,
        mentioned: { id: email, name: displayName }
      }
    : null;
}

export function createAdaptiveCardData(parsedEvent: ParsedEvent): Record<string, any> {
  const authorEmail = parsedEvent.metadata.author_email || '';
  const mentionEntity = createMentionEntity(authorEmail, parsedEvent.author);

  const data: Record<string, any> = {
    title:
      parsedEvent.title ||
      `${parsedEvent.action.charAt(0).toUpperCase() + parsedEvent.action.slice(1)} in ${parsedEvent.repository}`,
    subtitle: mentionEntity
      ? `by <at>${parsedEvent.author}</at>`
      : parsedEvent.author
        ? `by ${parsedEvent.author}`
        : null,
    repository: parsedEvent.repository,
    action: parsedEvent.action.charAt(0).toUpperCase() + parsedEvent.action.slice(1),
    author: parsedEvent.author,
    author_mention: mentionEntity ? `<at>${parsedEvent.author}</at>` : parsedEvent.author,
    event_category: parsedEvent.eventCategory,
    description: parsedEvent.description,
    url: parsedEvent.url,
    mention_entities: mentionEntity ? [mentionEntity] : []
  };

  // Add event-specific data
  if (parsedEvent.eventCategory === 'pull_request') {
    Object.assign(data, {
      pr_id: String(parsedEvent.metadata.pr_id || ''),
      source_branch: parsedEvent.metadata.source_branch || 'unknown',
      target_branch: parsedEvent.metadata.target_branch || 'unknown',
      state: parsedEvent.metadata.state || 'unknown'
    });
  } else if (parsedEvent.eventCategory === 'push') {
    Object.assign(data, {
      branch: parsedEvent.metadata.branch || 'unknown',
      commit_count: String(parsedEvent.metadata.commit_count || 0),
      commits: parsedEvent.metadata.commits || []
    });
  } else if (parsedEvent.eventCategory === 'comment') {
    data.context_title = parsedEvent.metadata.context_title || 'unknown';
  } else if (parsedEvent.eventCategory === 'commit_status') {
    Object.assign(data, {
      build_name: parsedEvent.metadata.build_name || 'Build',
      build_status: parsedEvent.metadata.state || 'unknown',
      commit_hash: parsedEvent.metadata.commit_hash || 'unknown',
      branch: parsedEvent.metadata.branch || 'unknown'
    });
  }

  return data;
}

export function formatTeamsMessage(parsedEvent: ParsedEvent): Record<string, any> {
  if (!parsedEvent || !parsedEvent.repository) {
    throw new Error(parsedEvent ? 'ParsedEvent must have a repository' : 'ParsedEvent cannot be null');
  }

  const eventData = createAdaptiveCardData(parsedEvent);
  const themeColor = getEventColor(parsedEvent.eventCategory, parsedEvent.action, parsedEvent.metadata);

  Object.assign(eventData, {
    theme_color: themeColor,
    text_color: TEXT_COLOR_MAP[themeColor] || 'Default'
  });

  // Add formatted commit details for push events
  if (parsedEvent.eventCategory === 'push') {
    const commits = eventData.commits || [];
    if (commits.length > 0) {
      eventData.commit_details = commits
        .slice(0, 3)
        .map((c: Record<string, any>) => {
          let msg = (c.message || 'No message').substring(0, 50);
          if ((c.message || '').length > 50) msg += '...';
          return `• ${c.hash || 'unknown'}: ${msg}`;
        })
        .join('\n');
    }
  }

  // Add branch flow for pull requests
  if (parsedEvent.eventCategory === 'pull_request') {
    eventData.branch_flow = `${eventData.source_branch || 'unknown'} → ${eventData.target_branch || 'unknown'}`;
  }

  eventData.mention_entities = (eventData.mention_entities || []).filter(
    (e: MentionEntity | null) => e !== null
  );

  return eventData;
}
