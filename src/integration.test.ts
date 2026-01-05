/**
 * Integration Tests for Bitbucket Teams Webhook Lambda
 * Tests end-to-end flows from webhook reception to Teams posting
 * Requirements: 1.1, 1.2, 1.3, 1.6, 1.7, 2.1, 2.3, 3.1, 3.2, 4.1, 4.2, 5.5, 5.6, 6.1, 6.2, 7.1, 8.1, 12.1, 12.8, 12.9
 */

// Set environment variables BEFORE importing the handler
process.env.TEAMS_WEBHOOK_URL_SECRET_ARN =
  'arn:aws:secretsmanager:us-east-1:123456789012:secret:teams-url';
process.env.BITBUCKET_SECRET_ARN =
  'arn:aws:secretsmanager:us-east-1:123456789012:secret:bitbucket-secret';
process.env.FILTER_MODE = 'all';
process.env.EVENT_FILTER = '';

import { handler } from './index';
import { computeSignature } from './signature';
import { clearSecretCache, closeSecretsClient } from './awsSecrets';
import { APIGatewayProxyEvent } from './webhookReception';

// Mock AWS Secrets Manager
jest.mock('@aws-sdk/client-secrets-manager', () => {
  return {
    SecretsManagerClient: jest.fn().mockImplementation(() => ({
      send: jest.fn().mockImplementation(async (command: any) => {
        const secretId = command.input.SecretId;
        if (secretId === 'arn:aws:secretsmanager:us-east-1:123456789012:secret:bitbucket-secret') {
          return { SecretString: 'test-webhook-secret' };
        }
        if (secretId === 'arn:aws:secretsmanager:us-east-1:123456789012:secret:teams-url') {
          return { SecretString: 'https://outlook.webhook.office.com/webhookb2/test' };
        }
        throw new Error('Secret not found');
      }),
      destroy: jest.fn()
    })),
    GetSecretValueCommand: jest.fn().mockImplementation((input: any) => ({
      input
    }))
  };
});

// Mock fetch for Teams posting
const originalFetch = global.fetch;

describe('Integration Tests - Bitbucket Teams Webhook', () => {
  beforeEach(() => {
    // Clear caches
    clearSecretCache();

    // Mock fetch
    global.fetch = jest.fn();

    // Clear console mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore fetch
    global.fetch = originalFetch;
    closeSecretsClient();
  });

  describe('13.1 End-to-end test for pull request created flow', () => {
    it('should process a valid pull request created event and post to Teams', async () => {
      // Create realistic PR event payload
      const prPayload = {
        pullrequest: {
          id: 123,
          title: 'Add new feature',
          description: 'This PR adds a new feature',
          author: {
            display_name: 'John Doe',
            email_address: 'john@example.com'
          },
          source: {
            branch: {
              name: 'feature/new-feature'
            }
          },
          destination: {
            branch: {
              name: 'main'
            }
          },
          state: 'OPEN',
          links: {
            html: {
              href: 'https://bitbucket.org/repo/pull-requests/123'
            }
          }
        },
        repository: {
          full_name: 'myorg/myrepo'
        }
      };

      const body = JSON.stringify(prPayload);
      const secret = 'test-webhook-secret';
      const signature = computeSignature(body, secret);

      // Create API Gateway event
      const event: APIGatewayProxyEvent = {
        headers: {
          'X-Event-Key': 'pullrequest:created',
          'X-Hub-Signature': `sha256=${signature}`,
          'Content-Type': 'application/json'
        },
        body,
        isBase64Encoded: false,
        requestContext: {
          requestId: 'test-request-123'
        }
      };

      // Mock Teams posting
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        text: jest.fn().mockResolvedValueOnce('')
      });

      // Execute handler
      const response = await handler(event, {});

      // Verify response
      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toBe('Webhook processed successfully');
      expect(responseBody.requestId).toBe('test-request-123');
      expect(responseBody.eventType).toBe('pullrequest:created');
      expect(responseBody.eventCategory).toBe('pull_request');
      expect(responseBody.processingDurationMs).toBeGreaterThanOrEqual(0);

      // Verify Teams was called
      expect(global.fetch).toHaveBeenCalledWith(
        'https://outlook.webhook.office.com/webhookb2/test',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        })
      );
    });

    it('should include PR details in Teams message', async () => {
      const prPayload = {
        pullrequest: {
          id: 456,
          title: 'Fix bug',
          description: 'Fixes critical bug',
          author: {
            display_name: 'Jane Smith',
            email_address: 'jane@example.com'
          },
          source: {
            branch: {
              name: 'bugfix/critical'
            }
          },
          destination: {
            branch: {
              name: 'main'
            }
          },
          state: 'OPEN',
          links: {
            html: {
              href: 'https://bitbucket.org/repo/pull-requests/456'
            }
          }
        },
        repository: {
          full_name: 'myorg/myrepo'
        }
      };

      const body = JSON.stringify(prPayload);
      const secret = 'test-webhook-secret';
      const signature = computeSignature(body, secret);

      const event: APIGatewayProxyEvent = {
        headers: {
          'X-Event-Key': 'pullrequest:created',
          'X-Hub-Signature': `sha256=${signature}`
        },
        body,
        isBase64Encoded: false,
        requestContext: {
          requestId: 'test-request-456'
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 202,
        text: jest.fn().mockResolvedValueOnce('')
      });

      const response = await handler(event, {});

      expect(response.statusCode).toBe(200);

      // Verify Teams was called with message containing PR details
      expect(global.fetch).toHaveBeenCalled();
      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const messageBody = JSON.parse(callArgs[1].body);

      // Verify message contains PR information
      expect(messageBody).toHaveProperty('title');
      expect(messageBody).toHaveProperty('repository');
    });
  });

  describe('13.2 End-to-end test for push event flow', () => {
    it('should process a valid push event and post to Teams', async () => {
      // Create realistic push event payload
      const pushPayload = {
        push: {
          changes: [
            {
              new: {
                name: 'main'
              },
              commits: [
                {
                  hash: 'abc123def456',
                  message: 'Add new feature',
                  author: {
                    user: {
                      display_name: 'John Doe'
                    }
                  },
                  links: {
                    html: {
                      href: 'https://bitbucket.org/repo/commits/abc123def456'
                    }
                  }
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
          full_name: 'myorg/myrepo'
        }
      };

      const body = JSON.stringify(pushPayload);
      const secret = 'test-webhook-secret';
      const signature = computeSignature(body, secret);

      const event: APIGatewayProxyEvent = {
        headers: {
          'X-Event-Key': 'repo:push',
          'X-Hub-Signature': `sha256=${signature}`
        },
        body,
        isBase64Encoded: false,
        requestContext: {
          requestId: 'test-request-push-1'
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        text: jest.fn().mockResolvedValueOnce('')
      });

      const response = await handler(event, {});

      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toBe('Webhook processed successfully');
      expect(responseBody.eventType).toBe('repo:push');
      expect(responseBody.eventCategory).toBe('push');

      // Verify Teams was called
      expect(global.fetch).toHaveBeenCalledWith(
        'https://outlook.webhook.office.com/webhookb2/test',
        expect.any(Object)
      );
    });

    it('should include push details in Teams message', async () => {
      const pushPayload = {
        push: {
          changes: [
            {
              new: {
                name: 'develop'
              },
              commits: [
                {
                  hash: 'xyz789abc123',
                  message: 'Update dependencies',
                  author: {
                    user: {
                      display_name: 'Jane Smith'
                    }
                  },
                  links: {
                    html: {
                      href: 'https://bitbucket.org/repo/commits/xyz789abc123'
                    }
                  }
                },
                {
                  hash: 'def456ghi789',
                  message: 'Fix tests',
                  author: {
                    user: {
                      display_name: 'Jane Smith'
                    }
                  },
                  links: {
                    html: {
                      href: 'https://bitbucket.org/repo/commits/def456ghi789'
                    }
                  }
                }
              ]
            }
          ]
        },
        actor: {
          display_name: 'Jane Smith',
          email_address: 'jane@example.com'
        },
        repository: {
          full_name: 'myorg/myrepo'
        }
      };

      const body = JSON.stringify(pushPayload);
      const secret = 'test-webhook-secret';
      const signature = computeSignature(body, secret);

      const event: APIGatewayProxyEvent = {
        headers: {
          'X-Event-Key': 'repo:push',
          'X-Hub-Signature': `sha256=${signature}`
        },
        body,
        isBase64Encoded: false,
        requestContext: {
          requestId: 'test-request-push-2'
        }
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 200,
        text: jest.fn().mockResolvedValueOnce('')
      });

      const response = await handler(event, {});

      expect(response.statusCode).toBe(200);

      // Verify Teams was called
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('13.3 End-to-end test for filtered event', () => {
    it('should filter out unsupported events', async () => {
      // Create an unsupported event type
      const unsupportedPayload = {
        repository: {
          full_name: 'myorg/myrepo'
        }
      };

      const body = JSON.stringify(unsupportedPayload);
      const secret = 'test-webhook-secret';
      const signature = computeSignature(body, secret);

      const event: APIGatewayProxyEvent = {
        headers: {
          'X-Event-Key': 'repo:unknown_event',
          'X-Hub-Signature': `sha256=${signature}`
        },
        body,
        isBase64Encoded: false,
        requestContext: {
          requestId: 'test-request-unsupported'
        }
      };

      const response = await handler(event, {});

      // Verify event was not processed (unsupported)
      expect(response.statusCode).toBe(200);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toBe('Unsupported event type');
      expect(responseBody.eventCategory).toBe('unsupported');

      // Verify Teams was NOT called
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('13.4 End-to-end test for signature failure', () => {
    it('should reject event with invalid signature', async () => {
      const prPayload = {
        pullrequest: {
          id: 999,
          title: 'Malicious PR',
          author: {
            display_name: 'Attacker'
          },
          source: {
            branch: {
              name: 'attack'
            }
          },
          destination: {
            branch: {
              name: 'main'
            }
          },
          state: 'OPEN',
          links: {
            html: {
              href: 'https://bitbucket.org/repo/pull-requests/999'
            }
          }
        },
        repository: {
          full_name: 'myorg/myrepo'
        }
      };

      const body = JSON.stringify(prPayload);
      // Use wrong secret to generate invalid signature
      const invalidSignature = computeSignature(body, 'wrong-secret');

      const event: APIGatewayProxyEvent = {
        headers: {
          'X-Event-Key': 'pullrequest:created',
          'X-Hub-Signature': `sha256=${invalidSignature}`
        },
        body,
        isBase64Encoded: false,
        requestContext: {
          requestId: 'test-request-invalid-sig'
        }
      };

      const response = await handler(event, {});

      // Verify 401 response
      expect(response.statusCode).toBe(401);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toContain('Unauthorized');

      // Verify Teams was NOT called
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('should reject event with missing signature header', async () => {
      const prPayload = {
        pullrequest: {
          id: 888,
          title: 'No signature PR',
          author: {
            display_name: 'User'
          },
          source: {
            branch: {
              name: 'feature'
            }
          },
          destination: {
            branch: {
              name: 'main'
            }
          },
          state: 'OPEN',
          links: {
            html: {
              href: 'https://bitbucket.org/repo/pull-requests/888'
            }
          }
        },
        repository: {
          full_name: 'myorg/myrepo'
        }
      };

      const body = JSON.stringify(prPayload);

      const event: APIGatewayProxyEvent = {
        headers: {
          'X-Event-Key': 'pullrequest:created'
          // Missing X-Hub-Signature header
        },
        body,
        isBase64Encoded: false,
        requestContext: {
          requestId: 'test-request-no-sig'
        }
      };

      const response = await handler(event, {});

      // Verify 401 response
      expect(response.statusCode).toBe(401);

      // Verify Teams was NOT called
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('13.5 End-to-end test for Teams posting failure', () => {
    it('should return 500 when Teams API fails', async () => {
      const prPayload = {
        pullrequest: {
          id: 555,
          title: 'Test PR',
          author: {
            display_name: 'User'
          },
          source: {
            branch: {
              name: 'feature'
            }
          },
          destination: {
            branch: {
              name: 'main'
            }
          },
          state: 'OPEN',
          links: {
            html: {
              href: 'https://bitbucket.org/repo/pull-requests/555'
            }
          }
        },
        repository: {
          full_name: 'myorg/myrepo'
        }
      };

      const body = JSON.stringify(prPayload);
      const secret = 'test-webhook-secret';
      const signature = computeSignature(body, secret);

      const event: APIGatewayProxyEvent = {
        headers: {
          'X-Event-Key': 'pullrequest:created',
          'X-Hub-Signature': `sha256=${signature}`
        },
        body,
        isBase64Encoded: false,
        requestContext: {
          requestId: 'test-request-teams-fail'
        }
      };

      // Mock Teams posting to fail
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 500,
        text: jest.fn().mockResolvedValueOnce('Internal Server Error')
      });

      const response = await handler(event, {});

      // Verify 500 response
      expect(response.statusCode).toBe(500);
      const responseBody = JSON.parse(response.body);
      expect(responseBody.message).toContain('error');

      // Verify Teams was called
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should return 500 when Teams API times out', async () => {
      const prPayload = {
        pullrequest: {
          id: 666,
          title: 'Timeout PR',
          author: {
            display_name: 'User'
          },
          source: {
            branch: {
              name: 'feature'
            }
          },
          destination: {
            branch: {
              name: 'main'
            }
          },
          state: 'OPEN',
          links: {
            html: {
              href: 'https://bitbucket.org/repo/pull-requests/666'
            }
          }
        },
        repository: {
          full_name: 'myorg/myrepo'
        }
      };

      const body = JSON.stringify(prPayload);
      const secret = 'test-webhook-secret';
      const signature = computeSignature(body, secret);

      const event: APIGatewayProxyEvent = {
        headers: {
          'X-Event-Key': 'pullrequest:created',
          'X-Hub-Signature': `sha256=${signature}`
        },
        body,
        isBase64Encoded: false,
        requestContext: {
          requestId: 'test-request-teams-timeout'
        }
      };

      // Mock Teams posting to timeout
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        Object.assign(new Error('Aborted'), { name: 'AbortError' })
      );

      const response = await handler(event, {});

      // Verify 500 response
      expect(response.statusCode).toBe(500);

      // Verify Teams was called
      expect(global.fetch).toHaveBeenCalled();
    });

    it('should return 500 when Teams API returns 400 error', async () => {
      const prPayload = {
        pullrequest: {
          id: 777,
          title: 'Bad request PR',
          author: {
            display_name: 'User'
          },
          source: {
            branch: {
              name: 'feature'
            }
          },
          destination: {
            branch: {
              name: 'main'
            }
          },
          state: 'OPEN',
          links: {
            html: {
              href: 'https://bitbucket.org/repo/pull-requests/777'
            }
          }
        },
        repository: {
          full_name: 'myorg/myrepo'
        }
      };

      const body = JSON.stringify(prPayload);
      const secret = 'test-webhook-secret';
      const signature = computeSignature(body, secret);

      const event: APIGatewayProxyEvent = {
        headers: {
          'X-Event-Key': 'pullrequest:created',
          'X-Hub-Signature': `sha256=${signature}`
        },
        body,
        isBase64Encoded: false,
        requestContext: {
          requestId: 'test-request-teams-400'
        }
      };

      // Mock Teams posting to return 400
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        status: 400,
        text: jest.fn().mockResolvedValueOnce('Bad Request')
      });

      const response = await handler(event, {});

      // Verify 500 response
      expect(response.statusCode).toBe(500);

      // Verify Teams was called
      expect(global.fetch).toHaveBeenCalled();
    });
  });
});
