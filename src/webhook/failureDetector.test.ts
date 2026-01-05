/**
 * Tests for failure detection
 */

import { detectFailure } from './failureDetector';
import { BitbucketCommitStatusPayload, BitbucketPullRequestPayload } from '../types';
import * as fc from 'fast-check';

describe('Failure Detection', () => {
  describe('Pull Request Rejection', () => {
    it('should detect a pull request rejection event', () => {
      const payload: BitbucketPullRequestPayload = {
        repository: {
          name: 'my-repo',
          full_slug: 'team/my-repo',
        },
        pullrequest: {
          id: 123,
          title: 'Add new feature',
          links: {
            html: {
              href: 'https://bitbucket.org/team/my-repo/pull-requests/123',
            },
          },
        },
        actor: {
          username: 'reviewer',
        },
      };

      const result = detectFailure('pullrequest:rejected', payload);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('pr_rejected');
      expect(result?.repository).toBe('team/my-repo');
      expect(result?.author).toBe('reviewer');
      expect(result?.reason).toContain('Add new feature');
      expect(result?.link).toBe('https://bitbucket.org/team/my-repo/pull-requests/123');
    });

    it('should use repository name if full_slug is not available', () => {
      const payload: BitbucketPullRequestPayload = {
        repository: {
          name: 'my-repo',
          full_slug: '',
        },
        pullrequest: {
          id: 123,
          title: 'Add new feature',
          links: {
            html: {
              href: 'https://bitbucket.org/team/my-repo/pull-requests/123',
            },
          },
        },
        actor: {
          username: 'reviewer',
        },
      };

      const result = detectFailure('pullrequest:rejected', payload);

      expect(result?.repository).toBe('my-repo');
    });

    it('should handle missing PR title', () => {
      const payload: BitbucketPullRequestPayload = {
        repository: {
          name: 'my-repo',
          full_slug: 'team/my-repo',
        },
        pullrequest: {
          id: 456,
          title: '',
          links: {
            html: {
              href: 'https://bitbucket.org/team/my-repo/pull-requests/456',
            },
          },
        },
        actor: {
          username: 'reviewer',
        },
      };

      const result = detectFailure('pullrequest:rejected', payload);

      expect(result?.reason).toContain('PR #456');
    });

    it('should handle missing link', () => {
      const payload: BitbucketPullRequestPayload = {
        repository: {
          name: 'my-repo',
          full_slug: 'team/my-repo',
        },
        pullrequest: {
          id: 123,
          title: 'Add new feature',
          links: {
            html: {
              href: '',
            },
          },
        },
        actor: {
          username: 'reviewer',
        },
      };

      const result = detectFailure('pullrequest:rejected', payload);

      expect(result?.link).toBe('');
    });

    it('should return null if required fields are missing', () => {
      const payload = {
        repository: {
          name: 'my-repo',
          full_slug: 'team/my-repo',
        },
        pullrequest: {
          id: 123,
          title: 'Add new feature',
          links: {
            html: {
              href: 'https://bitbucket.org/team/my-repo/pull-requests/123',
            },
          },
        },
        // Missing actor
      };

      const result = detectFailure('pullrequest:rejected', payload);

      expect(result).toBeNull();
    });
  });

  describe('Commit Status Failure', () => {
    it('should detect a commit status failure event', () => {
      const payload: BitbucketCommitStatusPayload = {
        repository: {
          name: 'my-repo',
          full_slug: 'team/my-repo',
        },
        commit_status: {
          state: 'FAILED',
          key: 'build',
          url: 'https://ci.example.com/builds/123',
          description: 'Build failed: test suite error',
        },
        actor: {
          username: 'ci-bot',
        },
      };

      const result = detectFailure('repo:commit_status_updated', payload);

      expect(result).not.toBeNull();
      expect(result?.type).toBe('build_failed');
      expect(result?.repository).toBe('team/my-repo');
      expect(result?.author).toBe('ci-bot');
      expect(result?.reason).toBe('Build failed: test suite error');
      expect(result?.link).toBe('https://ci.example.com/builds/123');
    });

    it('should not detect a successful commit status', () => {
      const payload: BitbucketCommitStatusPayload = {
        repository: {
          name: 'my-repo',
          full_slug: 'team/my-repo',
        },
        commit_status: {
          state: 'SUCCESSFUL',
          key: 'build',
          url: 'https://ci.example.com/builds/123',
          description: 'Build passed',
        },
        actor: {
          username: 'ci-bot',
        },
      };

      const result = detectFailure('repo:commit_status_updated', payload);

      expect(result).toBeNull();
    });

    it('should not detect an in-progress commit status', () => {
      const payload: BitbucketCommitStatusPayload = {
        repository: {
          name: 'my-repo',
          full_slug: 'team/my-repo',
        },
        commit_status: {
          state: 'INPROGRESS',
          key: 'build',
          url: 'https://ci.example.com/builds/123',
          description: 'Build in progress',
        },
        actor: {
          username: 'ci-bot',
        },
      };

      const result = detectFailure('repo:commit_status_updated', payload);

      expect(result).toBeNull();
    });

    it('should use repository name if full_slug is not available', () => {
      const payload: BitbucketCommitStatusPayload = {
        repository: {
          name: 'my-repo',
          full_slug: '',
        },
        commit_status: {
          state: 'FAILED',
          key: 'build',
          url: 'https://ci.example.com/builds/123',
          description: 'Build failed',
        },
        actor: {
          username: 'ci-bot',
        },
      };

      const result = detectFailure('repo:commit_status_updated', payload);

      expect(result?.repository).toBe('my-repo');
    });

    it('should use default reason if description is missing', () => {
      const payload: BitbucketCommitStatusPayload = {
        repository: {
          name: 'my-repo',
          full_slug: 'team/my-repo',
        },
        commit_status: {
          state: 'FAILED',
          key: 'build',
          url: 'https://ci.example.com/builds/123',
          description: '',
        },
        actor: {
          username: 'ci-bot',
        },
      };

      const result = detectFailure('repo:commit_status_updated', payload);

      expect(result?.reason).toBe('Build failed');
    });

    it('should handle missing link', () => {
      const payload: BitbucketCommitStatusPayload = {
        repository: {
          name: 'my-repo',
          full_slug: 'team/my-repo',
        },
        commit_status: {
          state: 'FAILED',
          key: 'build',
          url: '',
          description: 'Build failed',
        },
        actor: {
          username: 'ci-bot',
        },
      };

      const result = detectFailure('repo:commit_status_updated', payload);

      expect(result?.link).toBe('');
    });

    it('should use commit hash as fallback for branch when branch is missing', () => {
      const payload: BitbucketCommitStatusPayload = {
        repository: {
          name: 'my-repo',
          full_slug: 'team/my-repo',
        },
        commit_status: {
          state: 'FAILED',
          key: 'build',
          url: 'https://ci.example.com/builds/123',
          description: 'Build failed',
        },
        commit: {
          hash: '9fec847784abb10b2fa567ee63b85bd238955d0e',
        },
        actor: {
          username: 'ci-bot',
        },
      };

      const result = detectFailure('repo:commit_status_updated', payload);

      expect(result?.branch).toBe('9fec847');
    });

    it('should return null if required fields are missing', () => {
      const payload = {
        repository: {
          name: 'my-repo',
          full_slug: 'team/my-repo',
        },
        commit_status: {
          state: 'FAILED',
          key: 'build',
          url: 'https://ci.example.com/builds/123',
          description: 'Build failed',
        },
        // Missing actor
      };

      const result = detectFailure('repo:commit_status_updated', payload);

      expect(result).toBeNull();
    });
  });

  describe('Non-Failure Events', () => {
    it('should return null for unknown event types', () => {
      const payload = {
        repository: {
          name: 'my-repo',
          full_slug: 'team/my-repo',
        },
      };

      const result = detectFailure('repo:push', payload);

      expect(result).toBeNull();
    });

    it('should return null for pullrequest:created events', () => {
      const payload: BitbucketPullRequestPayload = {
        repository: {
          name: 'my-repo',
          full_slug: 'team/my-repo',
        },
        pullrequest: {
          id: 123,
          title: 'Add new feature',
          links: {
            html: {
              href: 'https://bitbucket.org/team/my-repo/pull-requests/123',
            },
          },
        },
        actor: {
          username: 'developer',
        },
      };

      const result = detectFailure('pullrequest:created', payload);

      expect(result).toBeNull();
    });

    it('should return null for pullrequest:updated events', () => {
      const payload: BitbucketPullRequestPayload = {
        repository: {
          name: 'my-repo',
          full_slug: 'team/my-repo',
        },
        pullrequest: {
          id: 123,
          title: 'Add new feature',
          links: {
            html: {
              href: 'https://bitbucket.org/team/my-repo/pull-requests/123',
            },
          },
        },
        actor: {
          username: 'developer',
        },
      };

      const result = detectFailure('pullrequest:updated', payload);

      expect(result).toBeNull();
    });

    it('should return null for pullrequest:approved events', () => {
      const payload: BitbucketPullRequestPayload = {
        repository: {
          name: 'my-repo',
          full_slug: 'team/my-repo',
        },
        pullrequest: {
          id: 123,
          title: 'Add new feature',
          links: {
            html: {
              href: 'https://bitbucket.org/team/my-repo/pull-requests/123',
            },
          },
        },
        actor: {
          username: 'reviewer',
        },
      };

      const result = detectFailure('pullrequest:approved', payload);

      expect(result).toBeNull();
    });

    it('should return null for repo:push events', () => {
      const payload = {
        repository: {
          name: 'my-repo',
          full_slug: 'team/my-repo',
        },
        push: {
          changes: [],
        },
      };

      const result = detectFailure('repo:push', payload);

      expect(result).toBeNull();
    });
  });

  describe('Property Tests', () => {
    // Property 6: PR Rejected Detected as Failure
    it('should detect all pullrequest:rejected events as failures', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.integer({ min: 1, max: 100000 }),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          (repoName, prId, prTitle, author, link) => {
            const payload: BitbucketPullRequestPayload = {
              repository: {
                name: repoName,
                full_slug: `team/${repoName}`,
              },
              pullrequest: {
                id: prId,
                title: prTitle,
                links: {
                  html: {
                    href: link,
                  },
                },
              },
              actor: {
                username: author,
              },
            };

            const result = detectFailure('pullrequest:rejected', payload);

            expect(result).not.toBeNull();
            expect(result?.type).toBe('pr_rejected');
            expect(result?.repository).toBe(`team/${repoName}`);
            expect(result?.author).toBe(author);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property 7: Commit Status Failed Detected as Failure
    it('should detect all repo:commit_status_updated events with state=FAILED as failures', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          (repoName, description, author, link) => {
            const payload: BitbucketCommitStatusPayload = {
              repository: {
                name: repoName,
                full_slug: `team/${repoName}`,
              },
              commit_status: {
                state: 'FAILED',
                key: 'build',
                url: link,
                description,
              },
              actor: {
                username: author,
              },
            };

            const result = detectFailure('repo:commit_status_updated', payload);

            expect(result).not.toBeNull();
            expect(result?.type).toBe('build_failed');
            expect(result?.repository).toBe(`team/${repoName}`);
            expect(result?.author).toBe(author);
            expect(result?.reason).toBe(description);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property 8: Non-Failure Events Ignored
    it('should return null for non-failure commit status states', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          (repoName, description, author, link) => {
            const states = ['SUCCESSFUL', 'INPROGRESS'];
            const state = states[Math.floor(Math.random() * states.length)];

            const payload: BitbucketCommitStatusPayload = {
              repository: {
                name: repoName,
                full_slug: `team/${repoName}`,
              },
              commit_status: {
                state: state as 'SUCCESSFUL' | 'INPROGRESS',
                key: 'build',
                url: link,
                description,
              },
              actor: {
                username: author,
              },
            };

            const result = detectFailure('repo:commit_status_updated', payload);

            expect(result).toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property 9: Failure Details Extracted
    it('should extract all required failure details from PR rejection events', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.integer({ min: 1, max: 100000 }),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          (repoName, prId, prTitle, author, link) => {
            const payload: BitbucketPullRequestPayload = {
              repository: {
                name: repoName,
                full_slug: `team/${repoName}`,
              },
              pullrequest: {
                id: prId,
                title: prTitle,
                links: {
                  html: {
                    href: link,
                  },
                },
              },
              actor: {
                username: author,
              },
            };

            const result = detectFailure('pullrequest:rejected', payload);

            expect(result).not.toBeNull();
            expect(result?.repository).toBeTruthy();
            expect(result?.author).toBeTruthy();
            expect(result?.reason).toBeTruthy();
            expect(result?.link).toBeTruthy();
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property 9: Failure Details Extracted (continued)
    it('should extract all required failure details from commit status failure events', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          (repoName, description, author, link) => {
            const payload: BitbucketCommitStatusPayload = {
              repository: {
                name: repoName,
                full_slug: `team/${repoName}`,
              },
              commit_status: {
                state: 'FAILED',
                key: 'build',
                url: link,
                description,
              },
              actor: {
                username: author,
              },
            };

            const result = detectFailure('repo:commit_status_updated', payload);

            expect(result).not.toBeNull();
            expect(result?.repository).toBeTruthy();
            expect(result?.author).toBeTruthy();
            expect(result?.reason).toBeTruthy();
            expect(result?.link).toBeTruthy();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
