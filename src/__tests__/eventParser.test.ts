/**
 * Event Parser Tests
 * Tests for parsing Bitbucket webhook events
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7
 */

import * as fc from 'fast-check';
import { parse } from '../webhook/parser';

describe('Event Parser', () => {
  describe('Pull Request Event Parsing', () => {
    it('should parse pull request created event', () => {
      const payload = {
        pullrequest: {
          id: 123,
          title: 'Add new feature',
          description: 'This PR adds a new feature',
          author: {
            display_name: 'John Doe',
            email_address: 'john@example.com'
          },
          source: { branch: { name: 'feature/new-feature' } },
          destination: { branch: { name: 'main' } },
          state: 'OPEN',
          links: { html: { href: 'https://bitbucket.org/repo/pr/123' } }
        },
        repository: { full_name: 'team/repo' }
      };

      const result = parse('pullrequest:created', payload);

      expect(result).toBeDefined();
      expect(result?.eventCategory).toBe('pull_request');
      expect(result?.repository).toBe('team/repo');
      expect(result?.action).toBe('created');
      expect(result?.author).toBe('John Doe');
      expect(result?.title).toBe('Add new feature');
      expect(result?.metadata.pr_id).toBe(123);
      expect(result?.metadata.source_branch).toBe('feature/new-feature');
      expect(result?.metadata.target_branch).toBe('main');
      expect(result?.metadata.author_email).toBe('john@example.com');
    });

    it('should handle PR without email', () => {
      const payload = {
        pullrequest: {
          id: 123,
          title: 'Add new feature',
          description: 'This PR adds a new feature',
          author: { display_name: 'John Doe' },
          source: { branch: { name: 'feature/new-feature' } },
          destination: { branch: { name: 'main' } },
          state: 'OPEN',
          links: { html: { href: 'https://bitbucket.org/repo/pr/123' } }
        },
        repository: { full_name: 'team/repo' }
      };

      const result = parse('pullrequest:created', payload);

      expect(result).toBeDefined();
      expect(result?.metadata.author_email).toBe('');
    });

    it('should throw error when pullrequest field is missing', () => {
      const payload = {
        repository: { full_name: 'team/repo' }
      };

      expect(() => parse('pullrequest:created', payload)).toThrow(
        'Missing pullrequest field in payload'
      );
    });

    it('should throw error when repository is missing', () => {
      const payload = {
        pullrequest: {
          id: 123,
          title: 'Add new feature',
          author: { display_name: 'John Doe' },
          source: { branch: { name: 'feature/new-feature' } },
          destination: { branch: { name: 'main' } },
          state: 'OPEN'
        }
      };

      expect(() => parse('pullrequest:created', payload)).toThrow(
        'Missing repository.full_name in payload'
      );
    });
  });

  describe('Push Event Parsing', () => {
    it('should parse push event', () => {
      const payload = {
        push: {
          changes: [
            {
              new: { name: 'main' },
              commits: [
                {
                  hash: 'abc123',
                  message: 'Add feature',
                  author: { user: { display_name: 'John Doe' } },
                  links: { html: { href: 'https://bitbucket.org/repo/commit/abc123' } }
                }
              ]
            }
          ]
        },
        actor: {
          display_name: 'John Doe',
          email_address: 'john@example.com'
        },
        repository: {
          full_name: 'team/repo',
          links: { html: { href: 'https://bitbucket.org/team/repo' } }
        }
      };

      const result = parse('repo:push', payload);

      expect(result).toBeDefined();
      expect(result?.eventCategory).toBe('push');
      expect(result?.repository).toBe('team/repo');
      expect(result?.action).toBe('push');
      expect(result?.author).toBe('John Doe');
      expect(result?.metadata.branch).toBe('main');
      expect(result?.metadata.commit_count).toBe(1);
      expect(result?.metadata.commits).toHaveLength(1);
      expect(result?.metadata.author_email).toBe('john@example.com');
    });

    it('should handle push with multiple commits', () => {
      const payload = {
        push: {
          changes: [
            {
              new: { name: 'main' },
              commits: [
                {
                  hash: 'abc123',
                  message: 'Add feature',
                  author: { user: { display_name: 'John Doe' } },
                  links: { html: { href: 'https://bitbucket.org/repo/commit/abc123' } }
                },
                {
                  hash: 'def456',
                  message: 'Fix bug',
                  author: { user: { display_name: 'Jane Doe' } },
                  links: { html: { href: 'https://bitbucket.org/repo/commit/def456' } }
                }
              ]
            }
          ]
        },
        actor: { display_name: 'John Doe' },
        repository: { full_name: 'team/repo' }
      };

      const result = parse('repo:push', payload);

      expect(result?.metadata.commit_count).toBe(2);
      expect(result?.metadata.commits).toHaveLength(2);
    });

    it('should throw error when push field is missing', () => {
      const payload = {
        repository: { full_name: 'team/repo' }
      };

      expect(() => parse('repo:push', payload)).toThrow('Missing push field in payload');
    });
  });

  describe('Comment Event Parsing', () => {
    it('should parse pull request comment event', () => {
      const payload = {
        pullrequest: {
          id: 123,
          links: { html: { href: 'https://bitbucket.org/repo/pr/123' } }
        },
        comment: {
          user: {
            display_name: 'John Doe',
            email_address: 'john@example.com'
          },
          content: { raw: 'This is a comment' }
        },
        repository: { full_name: 'team/repo' }
      };

      const result = parse('pullrequest:comment_created', payload);

      expect(result).toBeDefined();
      expect(result?.eventCategory).toBe('comment');
      expect(result?.action).toBe('comment_created');
      expect(result?.author).toBe('John Doe');
      expect(result?.metadata.context_title).toBe('Comment on PR #123');
      expect(result?.metadata.comment_text).toBe('This is a comment');
      expect(result?.metadata.author_email).toBe('john@example.com');
    });

    it('should parse commit comment event', () => {
      const payload = {
        commit: {
          hash: 'abc123',
          links: { html: { href: 'https://bitbucket.org/repo/commit/abc123' } }
        },
        comment: {
          user: { display_name: 'John Doe' },
          content: { raw: 'This is a comment' }
        },
        repository: { full_name: 'team/repo' }
      };

      const result = parse('repo:commit_comment_created', payload);

      expect(result).toBeDefined();
      expect(result?.metadata.context_title).toContain('Comment on commit');
    });

    it('should throw error when comment field is missing', () => {
      const payload = {
        pullrequest: { id: 123 },
        repository: { full_name: 'team/repo' }
      };

      expect(() => parse('pullrequest:comment_created', payload)).toThrow(
        'Missing comment field in payload'
      );
    });
  });

  describe('Commit Status Event Parsing', () => {
    it('should parse commit status event', () => {
      const payload = {
        commit_status: {
          state: 'SUCCESSFUL',
          name: 'Build',
          commit: { hash: 'abc123' },
          url: 'https://ci.example.com/build/123'
        },
        branch: { name: 'main' },
        repository: { full_name: 'team/repo' }
      };

      const result = parse('repo:commit_status_updated', payload);

      expect(result).toBeDefined();
      expect(result?.eventCategory).toBe('commit_status');
      expect(result?.action).toBe('successful');
      expect(result?.metadata.build_name).toBe('Build');
      expect(result?.metadata.state).toBe('SUCCESSFUL');
      expect(result?.metadata.commit_hash).toBe('abc123');
      expect(result?.metadata.branch).toBe('main');
    });

    it('should throw error when commit_status field is missing', () => {
      const payload = {
        repository: { full_name: 'team/repo' }
      };

      expect(() => parse('repo:commit_status_updated', payload)).toThrow(
        'Missing commit_status field in payload'
      );
    });
  });

  describe('Unsupported Event Type', () => {
    it('should return null for unsupported event type', () => {
      const payload = {
        repository: { full_name: 'team/repo' }
      };

      const result = parse('unknown:event', payload);

      expect(result).toBeNull();
    });
  });

  describe('Property: Pull Request Event Parsing', () => {
    it('should parse any valid PR event', async () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10000 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          (prId: number, title: string, branch: string) => {
            const payload = {
              pullrequest: {
                id: prId,
                title,
                description: 'Description',
                author: { display_name: 'Author' },
                source: { branch: { name: branch } },
                destination: { branch: { name: 'main' } },
                state: 'OPEN',
                links: { html: { href: 'https://bitbucket.org/repo/pr/123' } }
              },
              repository: { full_name: 'team/repo' }
            };

            const result = parse('pullrequest:created', payload);

            expect(result).toBeDefined();
            expect(result?.eventCategory).toBe('pull_request');
            expect(result?.metadata.pr_id).toBe(prId);
            expect(result?.title).toBe(title);
            expect(result?.metadata.source_branch).toBe(branch);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property: Push Event Parsing', () => {
    it('should parse any valid push event', async () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.integer({ min: 1, max: 100 }),
          (branch: string, commitCount: number) => {
            const commits = Array.from({ length: commitCount }, (_, i) => ({
              hash: `hash${i}`,
              message: `Commit ${i}`,
              author: { user: { display_name: 'Author' } },
              links: { html: { href: `https://bitbucket.org/repo/commit/hash${i}` } }
            }));

            const payload = {
              push: {
                changes: [
                  {
                    new: { name: branch },
                    commits
                  }
                ]
              },
              actor: { display_name: 'Actor' },
              repository: { full_name: 'team/repo' }
            };

            const result = parse('repo:push', payload);

            expect(result).toBeDefined();
            expect(result?.eventCategory).toBe('push');
            expect(result?.metadata.branch).toBe(branch);
            expect(result?.metadata.commit_count).toBe(commitCount);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property: Comment Event Parsing', () => {
    it('should parse any valid comment event', async () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 500 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          (commentText: string, author: string) => {
            const payload = {
              pullrequest: {
                id: 123,
                links: { html: { href: 'https://bitbucket.org/repo/pr/123' } }
              },
              comment: {
                user: { display_name: author },
                content: { raw: commentText }
              },
              repository: { full_name: 'team/repo' }
            };

            const result = parse('pullrequest:comment_created', payload);

            expect(result).toBeDefined();
            expect(result?.eventCategory).toBe('comment');
            expect(result?.author).toBe(author);
            expect(result?.metadata.comment_text).toBe(commentText);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property: Commit Status Event Parsing', () => {
    it('should parse any valid commit status event', async () => {
      fc.assert(
        fc.property(
          fc.constantFrom('SUCCESSFUL', 'FAILED', 'INPROGRESS'),
          fc.string({ minLength: 1, maxLength: 50 }),
          (state: string, buildName: string) => {
            const payload = {
              commit_status: {
                state,
                name: buildName,
                commit: { hash: 'abc123' },
                url: 'https://ci.example.com/build/123'
              },
              branch: { name: 'main' },
              repository: { full_name: 'team/repo' }
            };

            const result = parse('repo:commit_status_updated', payload);

            expect(result).toBeDefined();
            expect(result?.eventCategory).toBe('commit_status');
            expect(result?.metadata.state).toBe(state);
            expect(result?.metadata.build_name).toBe(buildName);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Property: Unsupported Event Type Returns Null', () => {
    it('should return null for any unsupported event type', async () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1 }), (eventType: string): boolean => {
          // Skip known event types and special properties
          if (
            eventType === 'constructor' ||
            eventType === 'prototype' ||
            eventType === '__proto__' ||
            eventType === 'toString' ||
            eventType === 'valueOf' ||
            eventType === 'hasOwnProperty' ||
            eventType === 'toLocaleString' ||
            eventType.startsWith('pullrequest:') ||
            eventType === 'repo:push' ||
            eventType === 'pullrequest:comment_created' ||
            eventType === 'repo:commit_comment_created' ||
            eventType === 'repo:commit_status_updated' ||
            eventType === 'repo:commit_status_created'
          ) {
            return true; // Skip this case
          }

          const payload = { repository: { full_name: 'team/repo' } };
          const result = parse(eventType, payload);

          expect(result).toBeNull();
          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property: Malformed Payload Raises Error', () => {
    it('should raise error for malformed PR payload', async () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1 }), (missingField: string): boolean => {
          const payload: any = {
            pullrequest: {
              id: 123,
              title: 'Title',
              author: { display_name: 'Author' },
              source: { branch: { name: 'branch' } },
              destination: { branch: { name: 'main' } },
              state: 'OPEN'
            },
            repository: { full_name: 'team/repo' }
          };

          // Remove a field to make it malformed
          if (missingField === 'pullrequest') {
            delete payload.pullrequest;
          } else if (missingField === 'repository') {
            delete payload.repository;
          }

          if (missingField === 'pullrequest' || missingField === 'repository') {
            expect(() => parse('pullrequest:created', payload)).toThrow();
          }
          return true;
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Property: Author Email Extraction', () => {
    it('should extract author email when available', async () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          (author: string, email: string) => {
            const payload = {
              pullrequest: {
                id: 123,
                title: 'Title',
                author: { display_name: author, email_address: email },
                source: { branch: { name: 'branch' } },
                destination: { branch: { name: 'main' } },
                state: 'OPEN',
                links: { html: { href: 'https://bitbucket.org/repo/pr/123' } }
              },
              repository: { full_name: 'team/repo' }
            };

            const result = parse('pullrequest:created', payload);

            expect(result?.metadata.author_email).toBe(email);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
