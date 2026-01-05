/**
 * Tests for Teams Message Formatter Module
 * Property-based tests for simplified message formatting correctness
 */

import * as fc from 'fast-check';
import { formatMessage, FailureEvent } from '../teams/formatter';

describe('Teams Message Formatter', () => {
  // Helper function to create a valid FailureEvent
  const createFailureEvent = (overrides?: Partial<FailureEvent>): FailureEvent => {
    return {
      type: 'pr_declined',
      repository: 'test-repo',
      author: 'Test Author',
      reason: 'Code review failed',
      link: 'https://example.com/pr/123',
      ...overrides
    };
  };

  describe('formatMessage', () => {
    // Property 10: Failure Message Contains Required Fields
    // For any failure event, the message formatter SHALL create output containing failure type, repository, reason, and link
    it('Property 10: creates message with all required fields', () => {
      const failure = createFailureEvent();
      const message = formatMessage(failure);

      expect(message.title).toBeDefined();
      expect(message.description).toBeDefined();
      expect(message.link).toBeDefined();
      expect(message.color).toBeDefined();
    });

    it('Property 10: includes failure type in title', () => {
      fc.assert(
        fc.property(fc.constantFrom('pr_declined', 'build_failed'), (type) => {
          const failure = createFailureEvent({ type });
          const message = formatMessage(failure);

          expect(message.title).toContain(type);
        })
      );
    });

    it('Property 10: includes repository in title', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1 }), (repo) => {
          const failure = createFailureEvent({ repository: repo });
          const message = formatMessage(failure);

          expect(message.title).toContain(repo);
        })
      );
    });

    it('Property 10: includes reason in description', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1 }), (reason) => {
          const failure = createFailureEvent({ reason });
          const message = formatMessage(failure);

          expect(message.description).toContain(reason);
        })
      );
    });

    it('Property 10: includes author in description', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1 }), (author) => {
          const failure = createFailureEvent({ author });
          const message = formatMessage(failure);

          expect(message.description).toContain(author);
        })
      );
    });

    it('Property 10: includes link in message', () => {
      fc.assert(
        fc.property(fc.webUrl(), (link) => {
          const failure = createFailureEvent({ link });
          const message = formatMessage(failure);

          expect(message.link).toBe(link);
        })
      );
    });

    // Property 11: Failure Messages Use Red Color
    // For any failure event, the message formatter SHALL assign red color
    it('Property 11: assigns red color to all failure messages', () => {
      fc.assert(
        fc.property(
          fc.record({
            type: fc.constantFrom('pr_declined', 'build_failed'),
            repository: fc.string({ minLength: 1 }),
            author: fc.string({ minLength: 1 }),
            reason: fc.string({ minLength: 1 }),
            link: fc.webUrl()
          }),
          (failure) => {
            const message = formatMessage(failure);
            expect(message.color).toBe('#DC3545');
          }
        )
      );
    });

    it('Property 11: red color is consistent across all failures', () => {
      const failure1 = createFailureEvent({ type: 'pr_declined' });
      const failure2 = createFailureEvent({ type: 'build_failed' });

      const message1 = formatMessage(failure1);
      const message2 = formatMessage(failure2);

      expect(message1.color).toBe(message2.color);
      expect(message1.color).toBe('#DC3545');
    });

    // Error handling
    it('raises error for null event', () => {
      expect(() => {
        formatMessage(null as any);
      }).toThrow();
    });

    it('raises error for event without repository', () => {
      const failure = createFailureEvent({
        repository: ''
      });

      expect(() => {
        formatMessage(failure);
      }).toThrow();
    });

    it('handles events with special characters', () => {
      fc.assert(
        fc.property(fc.string(), (specialChars) => {
          const failure = createFailureEvent({
            reason: specialChars,
            author: specialChars
          });

          const message = formatMessage(failure);
          expect(message).toBeDefined();
          expect(message.description).toContain(specialChars);
        })
      );
    });

    it('handles very long repository names', () => {
      const longRepo = 'a'.repeat(500);
      const failure = createFailureEvent({ repository: longRepo });
      const message = formatMessage(failure);

      expect(message.title).toContain(longRepo);
    });

    it('handles very long reasons', () => {
      const longReason = 'b'.repeat(500);
      const failure = createFailureEvent({ reason: longReason });
      const message = formatMessage(failure);

      expect(message.description).toContain(longReason);
    });
  });
});
