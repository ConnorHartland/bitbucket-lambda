/**
 * Tests for Teams client
 */

import * as https from 'https';
import * as fc from 'fast-check';
import { postToTeams } from './teamsClient';
import { TeamsMessage } from '../types';
import { Logger } from '../logger';

// Mock the https module
jest.mock('https');

describe('Teams Client', () => {
  let mockRequest: any;
  let mockResponse: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup mock response
    mockResponse = {
      statusCode: 200,
      on: jest.fn(),
      once: jest.fn(),
    };

    // Setup mock request
    mockRequest = {
      on: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
      destroy: jest.fn(),
    };

    // Mock https.request to return our mock request
    (https.request as jest.Mock).mockImplementation((_options: any, callback: any) => {
      // Call the callback with our mock response
      callback(mockResponse);
      return mockRequest;
    });
  });

  describe('postToTeams', () => {
    it('should post a message to Teams webhook URL', async () => {
      const message: TeamsMessage = {
        title: 'Build Failed - team/repo',
        description: 'Author: bot\nReason: Test failed',
        link: 'https://example.com/build/123',
        color: '#FF0000',
      };
      const webhookUrl = 'https://outlook.webhook.office.com/webhookb2/test';
      const logger = new Logger('test-request-id', 'test-event');

      // Setup mock to trigger success
      mockResponse.on.mockImplementation((event: string, callback: any) => {
        if (event === 'data') {
          callback('');
        } else if (event === 'end') {
          callback();
        }
      });

      const result = await postToTeams(message, webhookUrl, logger);

      expect(result).toBe(true);
      expect(https.request).toHaveBeenCalled();
      expect(mockRequest.write).toHaveBeenCalled();
      expect(mockRequest.end).toHaveBeenCalled();
    });

    it('should handle HTTP 200 response as success', async () => {
      const message: TeamsMessage = {
        title: 'Build Failed',
        description: 'Test',
        link: 'https://example.com',
        color: '#FF0000',
      };
      const webhookUrl = 'https://outlook.webhook.office.com/webhookb2/test';
      const logger = new Logger('test-request-id', 'test-event');

      mockResponse.statusCode = 200;
      mockResponse.on.mockImplementation((event: string, callback: any) => {
        if (event === 'data') {
          callback('');
        } else if (event === 'end') {
          callback();
        }
      });

      const result = await postToTeams(message, webhookUrl, logger);

      expect(result).toBe(true);
    });

    it('should handle HTTP 202 response as success', async () => {
      const message: TeamsMessage = {
        title: 'Build Failed',
        description: 'Test',
        link: 'https://example.com',
        color: '#FF0000',
      };
      const webhookUrl = 'https://outlook.webhook.office.com/webhookb2/test';
      const logger = new Logger('test-request-id', 'test-event');

      mockResponse.statusCode = 202;
      mockResponse.on.mockImplementation((event: string, callback: any) => {
        if (event === 'data') {
          callback('');
        } else if (event === 'end') {
          callback();
        }
      });

      const result = await postToTeams(message, webhookUrl, logger);

      expect(result).toBe(true);
    });

    it('should handle HTTP error responses as failure', async () => {
      const message: TeamsMessage = {
        title: 'Build Failed',
        description: 'Test',
        link: 'https://example.com',
        color: '#FF0000',
      };
      const webhookUrl = 'https://outlook.webhook.office.com/webhookb2/test';
      const logger = new Logger('test-request-id', 'test-event');

      mockResponse.statusCode = 400;
      mockResponse.on.mockImplementation((event: string, callback: any) => {
        if (event === 'data') {
          callback('Bad Request');
        } else if (event === 'end') {
          callback();
        }
      });

      const loggerErrorSpy = jest.spyOn(logger, 'error');

      const result = await postToTeams(message, webhookUrl, logger);

      expect(result).toBe(false);
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Teams API returned error',
        expect.objectContaining({
          statusCode: 400,
        })
      );
    });

    it('should handle request errors', async () => {
      const message: TeamsMessage = {
        title: 'Build Failed',
        description: 'Test',
        link: 'https://example.com',
        color: '#FF0000',
      };
      const webhookUrl = 'https://outlook.webhook.office.com/webhookb2/test';
      const logger = new Logger('test-request-id', 'test-event');

      const loggerErrorSpy = jest.spyOn(logger, 'error');

      // Mock request to trigger error
      (https.request as jest.Mock).mockImplementation((_options: any, _callback: any) => {
        const req = {
          on: jest.fn((event: string, callback: any) => {
            if (event === 'error') {
              callback(new Error('Connection refused'));
            }
          }),
          write: jest.fn(),
          end: jest.fn(),
          destroy: jest.fn(),
        };
        return req;
      });

      const result = await postToTeams(message, webhookUrl, logger);

      expect(result).toBe(false);
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Failed to post message to Teams',
        expect.objectContaining({
          error: 'Connection refused',
        })
      );
    });

    it('should handle request timeout', async () => {
      const message: TeamsMessage = {
        title: 'Build Failed',
        description: 'Test',
        link: 'https://example.com',
        color: '#FF0000',
      };
      const webhookUrl = 'https://outlook.webhook.office.com/webhookb2/test';
      const logger = new Logger('test-request-id', 'test-event');

      const loggerErrorSpy = jest.spyOn(logger, 'error');

      // Mock request to trigger timeout
      (https.request as jest.Mock).mockImplementation((_options: any, _callback: any) => {
        const req = {
          on: jest.fn((event: string, callback: any) => {
            if (event === 'timeout') {
              callback();
            }
          }),
          write: jest.fn(),
          end: jest.fn(),
          destroy: jest.fn(),
        };
        return req;
      });

      const result = await postToTeams(message, webhookUrl, logger);

      expect(result).toBe(false);
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Teams API request timed out',
        expect.objectContaining({
          timeout: 10000,
        })
      );
    });

    it('should handle invalid webhook URL', async () => {
      const message: TeamsMessage = {
        title: 'Build Failed',
        description: 'Test',
        link: 'https://example.com',
        color: '#FF0000',
      };
      const webhookUrl = 'not-a-valid-url';
      const logger = new Logger('test-request-id', 'test-event');

      const loggerErrorSpy = jest.spyOn(logger, 'error');

      const result = await postToTeams(message, webhookUrl, logger);

      expect(result).toBe(false);
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        'Error posting to Teams',
        expect.objectContaining({
          error: expect.any(String),
        })
      );
    });

    it('should send correct payload format', async () => {
      const message: TeamsMessage = {
        title: 'Build Failed - team/repo',
        description: 'Author: bot\nReason: Test failed',
        link: 'https://example.com/build/123',
        color: '#FF0000',
      };
      const webhookUrl = 'https://outlook.webhook.office.com/webhookb2/test';
      const logger = new Logger('test-request-id', 'test-event');

      mockResponse.on.mockImplementation((event: string, callback: any) => {
        if (event === 'data') {
          callback('');
        } else if (event === 'end') {
          callback();
        }
      });

      await postToTeams(message, webhookUrl, logger);

      // Verify the payload was written
      expect(mockRequest.write).toHaveBeenCalled();
      const payload = mockRequest.write.mock.calls[0][0];
      const parsedPayload = JSON.parse(payload);

      // Verify the payload is wrapped in Teams Workflows format
      expect(parsedPayload.type).toBe('message');
      expect(parsedPayload.attachments).toBeDefined();
      expect(parsedPayload.attachments[0].contentType).toBe('application/vnd.microsoft.card.adaptive');
      
      // Verify flat fields are included for Power Automate expressions
      expect(parsedPayload.repository).toBeDefined();
      expect(parsedPayload.branch).toBeDefined();
      expect(parsedPayload.build_name).toBeDefined();
      expect(parsedPayload.author).toBeDefined();
      expect(parsedPayload.build_status).toBeDefined();
      expect(parsedPayload.description).toBeDefined();
      expect(parsedPayload.url).toBeDefined();
    });

    it('should set correct headers', async () => {
      const message: TeamsMessage = {
        title: 'Build Failed',
        description: 'Test',
        link: 'https://example.com',
        color: '#FF0000',
      };
      const webhookUrl = 'https://outlook.webhook.office.com/webhookb2/test';
      const logger = new Logger('test-request-id', 'test-event');

      mockResponse.on.mockImplementation((event: string, callback: any) => {
        if (event === 'data') {
          callback('');
        } else if (event === 'end') {
          callback();
        }
      });

      await postToTeams(message, webhookUrl, logger);

      const options = (https.request as jest.Mock).mock.calls[0][0];
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(options.headers['Content-Length']).toBeGreaterThan(0);
    });

    it('should log success when message is posted', async () => {
      const message: TeamsMessage = {
        title: 'Build Failed',
        description: 'Test',
        link: 'https://example.com',
        color: '#FF0000',
      };
      const webhookUrl = 'https://outlook.webhook.office.com/webhookb2/test';
      const logger = new Logger('test-request-id', 'test-event');

      const loggerInfoSpy = jest.spyOn(logger, 'info');

      mockResponse.statusCode = 200;
      mockResponse.on.mockImplementation((event: string, callback: any) => {
        if (event === 'data') {
          callback('');
        } else if (event === 'end') {
          callback();
        }
      });

      await postToTeams(message, webhookUrl, logger);

      expect(loggerInfoSpy).toHaveBeenCalledWith(
        'Successfully posted message to Teams',
        expect.objectContaining({
          statusCode: 200,
        })
      );
    });
  });

  describe('Property Tests', () => {
    // Property 12: Teams Posting Success
    // **Validates: Requirements 5.1, 5.2**
    it('should successfully post any valid failure message to Teams', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.oneof(fc.constant('#FF0000'), fc.constant('#FF0000')),
          async (title, description, link, color) => {
            jest.clearAllMocks();

            const message: TeamsMessage = {
              title,
              description,
              link,
              color,
            };
            const webhookUrl = 'https://outlook.webhook.office.com/webhookb2/test';
            const logger = new Logger('test-request-id', 'test-event');

            mockResponse.statusCode = 200;
            mockResponse.on.mockImplementation((event: string, callback: any) => {
              if (event === 'data') {
                callback('');
              } else if (event === 'end') {
                callback();
              }
            });

            (https.request as jest.Mock).mockImplementation((_options: any, callback: any) => {
              callback(mockResponse);
              return mockRequest;
            });

            const result = await postToTeams(message, webhookUrl, logger);

            expect(result).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    // Property 13: Teams Posting Failure Logged
    // **Validates: Requirements 5.3**
    it('should log errors for all Teams API failures', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 400, max: 599 }),
          async (statusCode) => {
            jest.clearAllMocks();

            const message: TeamsMessage = {
              title: 'Build Failed',
              description: 'Test',
              link: 'https://example.com',
              color: '#FF0000',
            };
            const webhookUrl = 'https://outlook.webhook.office.com/webhookb2/test';
            const logger = new Logger('test-request-id', 'test-event');

            const loggerErrorSpy = jest.spyOn(logger, 'error');

            mockResponse.statusCode = statusCode;
            mockResponse.on.mockImplementation((event: string, callback: any) => {
              if (event === 'data') {
                callback('');
              } else if (event === 'end') {
                callback();
              }
            });

            (https.request as jest.Mock).mockImplementation((_options: any, callback: any) => {
              callback(mockResponse);
              return mockRequest;
            });

            const result = await postToTeams(message, webhookUrl, logger);

            expect(result).toBe(false);
            expect(loggerErrorSpy).toHaveBeenCalledWith(
              'Teams API returned error',
              expect.objectContaining({
                statusCode,
              })
            );
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
