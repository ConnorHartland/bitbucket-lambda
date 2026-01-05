/**
 * Tests for message formatting
 */

import { formatMessage } from './formatter';
import { FailureEvent } from '../types';
import * as fc from 'fast-check';

describe('Message Formatting', () => {
  describe('Pull Request Rejection', () => {
    it('should format a PR rejection failure event', () => {
      const failure: FailureEvent = {
        type: 'pr_rejected',
        repository: 'team/my-repo',
        author: 'reviewer',
        reason: 'Pull request rejected: Add new feature',
        link: 'https://bitbucket.org/team/my-repo/pull-requests/123',
      };

      const message = formatMessage(failure);

      expect(message.title).toBe('Pull Request Rejected - team/my-repo');
      expect(message.description).toContain('Author: reviewer');
      expect(message.description).toContain('Reason: Pull request rejected: Add new feature');
      expect(message.link).toBe('https://bitbucket.org/team/my-repo/pull-requests/123');
      expect(message.color).toBe('#FF0000');
    });

    it('should include repository name in title', () => {
      const failure: FailureEvent = {
        type: 'pr_rejected',
        repository: 'my-org/my-project',
        author: 'dev',
        reason: 'Code review failed',
        link: 'https://example.com',
      };

      const message = formatMessage(failure);

      expect(message.title).toContain('my-org/my-project');
    });

    it('should include author in description', () => {
      const failure: FailureEvent = {
        type: 'pr_rejected',
        repository: 'team/repo',
        author: 'john-doe',
        reason: 'Rejected',
        link: 'https://example.com',
      };

      const message = formatMessage(failure);

      expect(message.description).toContain('john-doe');
    });

    it('should include reason in description', () => {
      const failure: FailureEvent = {
        type: 'pr_rejected',
        repository: 'team/repo',
        author: 'reviewer',
        reason: 'Code quality issues detected',
        link: 'https://example.com',
      };

      const message = formatMessage(failure);

      expect(message.description).toContain('Code quality issues detected');
    });
  });

  describe('Build Failure', () => {
    it('should format a build failure event', () => {
      const failure: FailureEvent = {
        type: 'build_failed',
        repository: 'team/my-repo',
        author: 'ci-bot',
        reason: 'Build failed: test suite error',
        link: 'https://ci.example.com/builds/123',
      };

      const message = formatMessage(failure);

      expect(message.title).toBe('Build Failed - team/my-repo');
      expect(message.description).toContain('Author: ci-bot');
      expect(message.description).toContain('Reason: Build failed: test suite error');
      expect(message.link).toBe('https://ci.example.com/builds/123');
      expect(message.color).toBe('#FF0000');
    });

    it('should use correct type label for build failures', () => {
      const failure: FailureEvent = {
        type: 'build_failed',
        repository: 'team/repo',
        author: 'bot',
        reason: 'Tests failed',
        link: 'https://example.com',
      };

      const message = formatMessage(failure);

      expect(message.title).toContain('Build Failed');
    });
  });

  describe('Color Formatting', () => {
    it('should always use red color for failures', () => {
      const prFailure: FailureEvent = {
        type: 'pr_rejected',
        repository: 'team/repo',
        author: 'reviewer',
        reason: 'Rejected',
        link: 'https://example.com',
      };

      const buildFailure: FailureEvent = {
        type: 'build_failed',
        repository: 'team/repo',
        author: 'bot',
        reason: 'Failed',
        link: 'https://example.com',
      };

      const prMessage = formatMessage(prFailure);
      const buildMessage = formatMessage(buildFailure);

      expect(prMessage.color).toBe('#FF0000');
      expect(buildMessage.color).toBe('#FF0000');
    });
  });

  describe('Property Tests', () => {
    // Property 10: Failure Message Contains Required Fields
    it('should include all required fields in formatted message', () => {
      fc.assert(
        fc.property(
          fc.oneof(fc.constant('pr_rejected'), fc.constant('build_failed')),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          (type, repository, author, reason, link) => {
            const failure: FailureEvent = {
              type: type as 'pr_rejected' | 'build_failed',
              repository,
              author,
              reason,
              link,
            };

            const message = formatMessage(failure);

            expect(message.title).toBeTruthy();
            expect(message.description).toBeTruthy();
            expect(message.link).toBe(link);
            expect(message.color).toBeTruthy();
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property 11: Failure Messages Use Red Color
    it('should always use red color for all failure types', () => {
      fc.assert(
        fc.property(
          fc.oneof(fc.constant('pr_rejected'), fc.constant('build_failed')),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          (type, repository, author, reason, link) => {
            const failure: FailureEvent = {
              type: type as 'pr_rejected' | 'build_failed',
              repository,
              author,
              reason,
              link,
            };

            const message = formatMessage(failure);

            expect(message.color).toBe('#FF0000');
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
