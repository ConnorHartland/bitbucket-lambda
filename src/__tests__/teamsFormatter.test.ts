/**
 * Tests for Teams Message Formatter Module
 * Property-based tests for message formatting correctness
 */

import * as fc from 'fast-check';
import {
  getEventColor,
  createMentionEntity,
  createAdaptiveCardData,
  formatTeamsMessage,
  ParsedEvent
} from '../teams/formatter';

describe('Teams Message Formatter', () => {
  // Helper function to create a valid ParsedEvent
  const createParsedEvent = (overrides?: Partial<ParsedEvent>): ParsedEvent => {
    return {
      eventCategory: 'pull_request',
      repository: 'test-repo',
      action: 'created',
      author: 'Test Author',
      title: 'Test Title',
      description: 'Test Description',
      url: 'https://example.com',
      metadata: {},
      ...overrides
    };
  };

  describe('getEventColor', () => {
    // Property 28: Theme Color Assignment
    // For any event type and action, the system SHALL assign an appropriate theme color
    it('Property 28: assigns red color for failure actions', () => {
      fc.assert(
        fc.property(fc.constantFrom('failed', 'declined', 'stopped', 'rejected'), (action) => {
          const color = getEventColor('pull_request', action, {});
          expect(color).toBe('#DC3545');
        })
      );
    });

    it('Property 28: assigns green color for success actions', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('merged', 'succeeded', 'approved'),
          (action) => {
            const color = getEventColor('pull_request', action, {});
            expect(color).toBe('#28A745');
          }
        )
      );
    });

    it('Property 28: assigns blue color for pull request events', () => {
      const color = getEventColor('pull_request', 'created', {});
      expect(color).toBe('#0078D4');
    });

    it('Property 28: assigns purple color for push events', () => {
      const color = getEventColor('push', 'pushed', {});
      expect(color).toBe('#6264A7');
    });

    it('Property 28: assigns gray color for comment events', () => {
      const color = getEventColor('comment', 'commented', {});
      expect(color).toBe('#6C757D');
    });

    it('Property 28: handles commit status FAILED state', () => {
      const color = getEventColor('commit_status', 'failed', { state: 'FAILED' });
      expect(color).toBe('#DC3545');
    });

    it('Property 28: handles commit status SUCCESSFUL state', () => {
      const color = getEventColor('commit_status', 'succeeded', { state: 'SUCCESSFUL' });
      expect(color).toBe('#28A745');
    });

    it('Property 28: handles commit status in-progress state', () => {
      const color = getEventColor('commit_status', 'in_progress', { state: 'INPROGRESS' });
      expect(color).toBe('#FFC107');
    });
  });

  describe('createMentionEntity', () => {
    // Property 29: Mention Entity Creation
    // For any author with email information, the system SHALL create a mention entity for Teams
    it('Property 29: creates mention entity with valid email and name', () => {
      const entity = createMentionEntity('test@example.com', 'Test User');
      expect(entity).not.toBeNull();
      expect(entity?.type).toBe('mention');
      expect(entity?.text).toBe('<at>Test User</at>');
      expect(entity?.mentioned.id).toBe('test@example.com');
      expect(entity?.mentioned.name).toBe('Test User');
    });

    it('Property 29: returns null for empty email', () => {
      const entity = createMentionEntity('', 'Test User');
      expect(entity).toBeNull();
    });

    it('Property 29: handles various email formats', () => {
      fc.assert(
        fc.property(fc.emailAddress(), fc.string({ minLength: 1 }), (email, name) => {
          const entity = createMentionEntity(email, name);
          expect(entity).not.toBeNull();
          expect(entity?.mentioned.id).toBe(email);
          expect(entity?.mentioned.name).toBe(name);
        })
      );
    });
  });

  describe('createAdaptiveCardData', () => {
    // Property 23: Message Formatting Includes Required Fields
    // For any parsed event, the message formatter SHALL create output containing title, description, and repository information
    it('Property 23: includes required fields for all events', () => {
      const event = createParsedEvent();
      const data = createAdaptiveCardData(event);

      expect(data.title).toBeDefined();
      expect(data.repository).toBe('test-repo');
      expect(data.author).toBe('Test Author');
      expect(data.event_category).toBe('pull_request');
      expect(data.url).toBe('https://example.com');
    });

    // Property 24: Pull Request Message Formatting
    // For any parsed pull request event, the message formatter SHALL include PR ID, source branch, target branch, and state
    it('Property 24: includes PR-specific fields for pull request events', () => {
      const event = createParsedEvent({
        eventCategory: 'pull_request',
        metadata: {
          pr_id: 123,
          source_branch: 'feature/test',
          target_branch: 'main',
          state: 'OPEN'
        }
      });

      const data = createAdaptiveCardData(event);
      expect(data.pr_id).toBe('123');
      expect(data.source_branch).toBe('feature/test');
      expect(data.target_branch).toBe('main');
      expect(data.state).toBe('OPEN');
    });

    // Property 25: Push Message Formatting
    // For any parsed push event, the message formatter SHALL include branch name, commit count, and recent commits
    it('Property 25: includes push-specific fields for push events', () => {
      const event = createParsedEvent({
        eventCategory: 'push',
        metadata: {
          branch: 'main',
          commit_count: 3,
          commits: [
            { hash: 'abc123', message: 'First commit' },
            { hash: 'def456', message: 'Second commit' }
          ]
        }
      });

      const data = createAdaptiveCardData(event);
      expect(data.branch).toBe('main');
      expect(data.commit_count).toBe('3');
      expect(data.commits).toHaveLength(2);
    });

    // Property 26: Comment Message Formatting
    // For any parsed comment event, the message formatter SHALL include context and comment text
    it('Property 26: includes comment-specific fields for comment events', () => {
      const event = createParsedEvent({
        eventCategory: 'comment',
        metadata: {
          context_title: 'PR #42: Fix bug'
        }
      });

      const data = createAdaptiveCardData(event);
      expect(data.context_title).toBe('PR #42: Fix bug');
    });

    // Property 27: Commit Status Message Formatting
    // For any parsed commit status event, the message formatter SHALL include build name, status, and commit hash
    it('Property 27: includes commit status-specific fields for commit status events', () => {
      const event = createParsedEvent({
        eventCategory: 'commit_status',
        metadata: {
          build_name: 'CI Pipeline',
          state: 'SUCCESSFUL',
          commit_hash: 'abc123def456',
          branch: 'main'
        }
      });

      const data = createAdaptiveCardData(event);
      expect(data.build_name).toBe('CI Pipeline');
      expect(data.build_status).toBe('SUCCESSFUL');
      expect(data.commit_hash).toBe('abc123def456');
      expect(data.branch).toBe('main');
    });

    // Property 29: Mention Entity Creation
    // For any author with email information, the message formatter SHALL create a mention entity for Teams
    it('Property 29: creates mention entities when email is available', () => {
      const event = createParsedEvent({
        metadata: {
          author_email: 'test@example.com'
        }
      });

      const data = createAdaptiveCardData(event);
      expect(data.mention_entities).toHaveLength(1);
      expect(data.mention_entities[0].mentioned.id).toBe('test@example.com');
    });

    it('Property 29: handles missing email gracefully', () => {
      const event = createParsedEvent({
        metadata: {}
      });

      const data = createAdaptiveCardData(event);
      expect(data.mention_entities).toHaveLength(0);
    });
  });

  describe('formatTeamsMessage', () => {
    // Property 23: Message Formatting Includes Required Fields
    // For any parsed event, the message formatter SHALL create output containing title, description, and repository information
    it('Property 23: creates valid Teams message with required fields', () => {
      const event = createParsedEvent();
      const message = formatTeamsMessage(event);

      expect(message.title).toBeDefined();
      expect(message.repository).toBe('test-repo');
      expect(message.theme_color).toBeDefined();
      expect(message.text_color).toBeDefined();
    });

    // Property 28: Theme Color Assignment
    // For any event type and action, the message formatter SHALL assign an appropriate theme color
    it('Property 28: assigns theme color based on event type', () => {
      const event = createParsedEvent({
        eventCategory: 'pull_request',
        action: 'created'
      });

      const message = formatTeamsMessage(event);
      expect(message.theme_color).toBe('#0078D4'); // Blue for PR
    });

    // Property 30: Null Event Formatting Raises Error
    // For any null parsed event, the message formatter SHALL raise an error
    it('Property 30: raises error for null event', () => {
      expect(() => {
        formatTeamsMessage(null as any);
      }).toThrow();
    });

    it('Property 30: raises error for event without repository', () => {
      const event = createParsedEvent({
        repository: ''
      });

      expect(() => {
        formatTeamsMessage(event);
      }).toThrow();
    });

    // Property 25: Push Message Formatting
    // For any parsed push event, the message formatter SHALL include branch name, commit count, and recent commits
    it('Property 25: formats push event with commit details', () => {
      const event = createParsedEvent({
        eventCategory: 'push',
        action: 'pushed',
        metadata: {
          branch: 'main',
          commit_count: 2,
          commits: [
            { hash: 'abc1234', message: 'First commit message' },
            { hash: 'def5678', message: 'Second commit message' }
          ]
        }
      });

      const message = formatTeamsMessage(event);
      expect(message.commit_details).toBeDefined();
      expect(message.commit_details).toContain('abc1234');
      expect(message.commit_details).toContain('First commit message');
    });

    // Property 24: Pull Request Message Formatting
    // For any parsed pull request event, the message formatter SHALL include PR ID, source branch, target branch, and state
    it('Property 24: formats pull request event with branch flow', () => {
      const event = createParsedEvent({
        eventCategory: 'pull_request',
        metadata: {
          pr_id: 42,
          source_branch: 'feature/new-feature',
          target_branch: 'main',
          state: 'OPEN'
        }
      });

      const message = formatTeamsMessage(event);
      expect(message.branch_flow).toBe('feature/new-feature → main');
    });

    // Property 23: Message Formatting Includes Required Fields
    // Ensure mention_entities is always a list
    it('Property 23: ensures mention_entities is always a list', () => {
      const event = createParsedEvent();
      const message = formatTeamsMessage(event);

      expect(Array.isArray(message.mention_entities)).toBe(true);
    });

    // Test with various event categories
    it('handles all event categories correctly', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('pull_request', 'push', 'comment', 'commit_status'),
          (category) => {
            const event = createParsedEvent({
              eventCategory: category
            });

            const message = formatTeamsMessage(event);
            expect(message.event_category).toBe(category);
            expect(message.theme_color).toBeDefined();
          }
        )
      );
    });
  });

  describe('Edge cases and error handling', () => {
    it('handles events with minimal metadata', () => {
      const event = createParsedEvent({
        metadata: {}
      });

      const message = formatTeamsMessage(event);
      expect(message).toBeDefined();
      expect(message.repository).toBe('test-repo');
    });

    it('handles events with special characters in title', () => {
      fc.assert(
        fc.property(fc.string(), (title) => {
          const event = createParsedEvent({
            title: title
          });

          const message = formatTeamsMessage(event);
          expect(message.title).toBeDefined();
        })
      );
    });

    it('truncates long commit messages in push events', () => {
      const event = createParsedEvent({
        eventCategory: 'push',
        metadata: {
          branch: 'main',
          commit_count: 1,
          commits: [
            {
              hash: 'abc1234',
              message: 'This is a very long commit message that should be truncated to 50 characters'
            }
          ]
        }
      });

      const message = formatTeamsMessage(event);
      expect(message.commit_details).toContain('...');
    });

    it('limits commit details to 3 commits in push events', () => {
      const event = createParsedEvent({
        eventCategory: 'push',
        metadata: {
          branch: 'main',
          commit_count: 5,
          commits: [
            { hash: 'abc1', message: 'Commit 1' },
            { hash: 'abc2', message: 'Commit 2' },
            { hash: 'abc3', message: 'Commit 3' },
            { hash: 'abc4', message: 'Commit 4' },
            { hash: 'abc5', message: 'Commit 5' }
          ]
        }
      });

      const message = formatTeamsMessage(event);
      const commitLines = message.commit_details.split('\n');
      expect(commitLines.length).toBeLessThanOrEqual(3);
    });
  });
});
