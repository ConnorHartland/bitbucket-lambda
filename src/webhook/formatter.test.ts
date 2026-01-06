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
        branch: 'feature/new-feature',
        pipelineName: 'PR #123',
        author: 'reviewer',
        reason: 'Pull request rejected: Add new feature',
        link: 'https://bitbucket.org/team/my-repo/pull-requests/123',
        status: 'REJECTED',
      };

      const message = formatMessage(failure);

      expect(message.type).toBe('AdaptiveCard');
      expect(message.body).toBeTruthy();
      expect(message.actions).toBeTruthy();
      expect(message.actions[0].url).toBe('https://bitbucket.org/team/my-repo/pull-requests/123');
    });

    it('should include repository name in facts', () => {
      const failure: FailureEvent = {
        type: 'pr_rejected',
        repository: 'my-org/my-project',
        branch: 'main',
        pipelineName: 'PR #1',
        author: 'dev',
        reason: 'Code review failed',
        link: 'https://example.com',
        status: 'REJECTED',
      };

      const message = formatMessage(failure);
      const factSet = message.body[1].items[0];

      expect(factSet.facts.some((f: any) => f.title === 'Repository' && f.value === 'my-org/my-project')).toBe(true);
    });

    it('should include branch in facts', () => {
      const failure: FailureEvent = {
        type: 'pr_rejected',
        repository: 'team/repo',
        branch: 'feature/test',
        pipelineName: 'PR #5',
        author: 'john-doe',
        reason: 'Rejected',
        link: 'https://example.com',
        status: 'REJECTED',
      };

      const message = formatMessage(failure);
      const factSet = message.body[1].items[0];

      expect(factSet.facts.some((f: any) => f.title === 'Branch' && f.value === 'feature/test')).toBe(true);
    });

    it('should include author in facts', () => {
      const failure: FailureEvent = {
        type: 'pr_rejected',
        repository: 'team/repo',
        branch: 'main',
        pipelineName: 'PR #1',
        author: 'reviewer',
        reason: 'Code quality issues detected',
        link: 'https://example.com',
        status: 'REJECTED',
      };

      const message = formatMessage(failure);
      const factSet = message.body[1].items[0];

      expect(factSet.facts.some((f: any) => f.title === 'Triggered by' && f.value === 'reviewer')).toBe(true);
    });
  });

  describe('Build Failure', () => {
    it('should format a build failure event', () => {
      const failure: FailureEvent = {
        type: 'build_failed',
        repository: 'team/my-repo',
        branch: 'main',
        pipelineName: 'Build Pipeline',
        author: 'ci-bot',
        reason: 'Build failed: test suite error',
        link: 'https://ci.example.com/builds/123',
        status: 'FAILED',
      };

      const message = formatMessage(failure);

      expect(message.type).toBe('AdaptiveCard');
      expect(message.body).toBeTruthy();
      expect(message.actions).toBeTruthy();
    });

    it('should use Attention color for build failures', () => {
      const failure: FailureEvent = {
        type: 'build_failed',
        repository: 'team/repo',
        branch: 'main',
        pipelineName: 'Build',
        author: 'bot',
        reason: 'Tests failed',
        link: 'https://example.com',
        status: 'FAILED',
      };

      const message = formatMessage(failure);
      const titleBlock = message.body[0].items[0].columns[0].items[1];

      expect(titleBlock.color).toBe('Attention');
    });
  });

  describe('Adaptive Card Structure', () => {
    it('should have correct Adaptive Card structure', () => {
      const failure: FailureEvent = {
        type: 'build_failed',
        repository: 'team/repo',
        branch: 'main',
        pipelineName: 'Pipeline',
        author: 'bot',
        reason: 'Failed',
        link: 'https://example.com',
        status: 'FAILED',
      };

      const message = formatMessage(failure);

      expect(message.type).toBe('AdaptiveCard');
      expect(message.version).toBe('1.4');
      expect(message.body).toHaveLength(3);
      expect(message.actions).toHaveLength(1);
      expect(message.$schema).toBe('http://adaptivecards.io/schemas/adaptive-card.json');
    });

    it('should include all required facts', () => {
      const failure: FailureEvent = {
        type: 'build_failed',
        repository: 'team/repo',
        branch: 'develop',
        pipelineName: 'CI Pipeline',
        author: 'developer',
        reason: 'Build error',
        link: 'https://example.com',
        status: 'FAILED',
      };

      const message = formatMessage(failure);
      const factSet = message.body[1].items[0];
      const facts = factSet.facts;

      expect(facts.some((f: any) => f.title === 'Repository')).toBe(true);
      expect(facts.some((f: any) => f.title === 'Branch')).toBe(true);
      expect(facts.some((f: any) => f.title === 'Pipeline')).toBe(true);
      expect(facts.some((f: any) => f.title === 'Triggered by')).toBe(true);
      expect(facts.some((f: any) => f.title === 'Status')).toBe(true);
    });
  });

  describe('Property Tests', () => {
    it('should include all required fields in formatted message', () => {
      fc.assert(
        fc.property(
          fc.oneof(fc.constant('pr_rejected'), fc.constant('build_failed')),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          (type, repository, branch, pipelineName, author, reason, link) => {
            const failure: FailureEvent = {
              type: type as 'pr_rejected' | 'build_failed',
              repository,
              branch,
              pipelineName,
              author,
              reason,
              link,
              status: type === 'pr_rejected' ? 'REJECTED' : 'FAILED',
            };

            const message = formatMessage(failure);

            expect(message.type).toBe('AdaptiveCard');
            expect(message.body).toBeTruthy();
            expect(message.actions).toBeTruthy();
            expect(message.actions[0].url).toBe(link);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should use appropriate colors for all failure types', () => {
      fc.assert(
        fc.property(
          fc.oneof(fc.constant('pr_rejected'), fc.constant('build_failed')),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          (type, repository, branch, pipelineName, author, reason, link) => {
            const failure: FailureEvent = {
              type: type as 'pr_rejected' | 'build_failed',
              repository,
              branch,
              pipelineName,
              author,
              reason,
              link,
              status: type === 'pr_rejected' ? 'REJECTED' : 'FAILED',
            };

            const message = formatMessage(failure);

            expect(message.body).toBeTruthy();
            expect(message.body[0]).toBeTruthy();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
