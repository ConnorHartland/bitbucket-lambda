/**
 * Tests for Teams Client Module
 * Property-based tests for Teams posting correctness
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 */

import { postToTeams } from '../teams/client';

// Mock fetch for testing
const originalFetch = global.fetch;

describe('Teams Client', () => {
  beforeEach(() => {
    // Clear any previous mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Restore original fetch
    global.fetch = originalFetch;
  });

  describe('postToTeams', () => {
    // Property 31: Teams Posting Success
    // For any valid event data and Teams webhook URL, the Teams client SHALL post the data
    // and return true on success (status 200 or 202)
    it('Property 31: returns true on successful posting with status 200', async () => {
      const eventData = { title: 'Test Event', repository: 'test-repo' };
      const webhookUrl = 'https://outlook.webhook.office.com/webhookb2/test';

      global.fetch = jest.fn().mockResolvedValueOnce({
        status: 200,
        text: jest.fn().mockResolvedValueOnce('')
      });

      const result = await postToTeams(eventData, webhookUrl);

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        webhookUrl,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          }
        })
      );
    });

    it('Property 31: returns true on successful posting with status 202', async () => {
      const eventData = { title: 'Test Event', repository: 'test-repo' };
      const webhookUrl = 'https://outlook.webhook.office.com/webhookb2/test';

      global.fetch = jest.fn().mockResolvedValueOnce({
        status: 202,
        text: jest.fn().mockResolvedValueOnce('')
      });

      const result = await postToTeams(eventData, webhookUrl);

      expect(result).toBe(true);
    });

    // Property 32: Teams Posting Failure
    // For any Teams API error response, the Teams client SHALL return false and log the error
    it('Property 32: returns false on API error with status 400', async () => {
      const eventData = { title: 'Test Event', repository: 'test-repo' };
      const webhookUrl = 'https://outlook.webhook.office.com/webhookb2/test';

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      global.fetch = jest.fn().mockResolvedValueOnce({
        status: 400,
        text: jest.fn().mockResolvedValueOnce('Bad Request')
      });

      const result = await postToTeams(eventData, webhookUrl);

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Teams API posting failed with status 400')
      );

      consoleErrorSpy.mockRestore();
    });

    it('Property 32: returns false on API error with status 500', async () => {
      const eventData = { title: 'Test Event', repository: 'test-repo' };
      const webhookUrl = 'https://outlook.webhook.office.com/webhookb2/test';

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      global.fetch = jest.fn().mockResolvedValueOnce({
        status: 500,
        text: jest.fn().mockResolvedValueOnce('Internal Server Error')
      });

      const result = await postToTeams(eventData, webhookUrl);

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Teams API posting failed with status 500')
      );

      consoleErrorSpy.mockRestore();
    });

    it('Property 32: returns false on network error', async () => {
      const eventData = { title: 'Test Event', repository: 'test-repo' };
      const webhookUrl = 'https://outlook.webhook.office.com/webhookb2/test';

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      global.fetch = jest.fn().mockRejectedValueOnce(new Error('Network error'));

      const result = await postToTeams(eventData, webhookUrl);

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Teams API posting failed with error')
      );

      consoleErrorSpy.mockRestore();
    });

    // Property 33: Teams Posting Headers
    // For any Teams posting request, the system SHALL include Content-Type: application/json header
    it('Property 33: includes Content-Type header in request', async () => {
      const eventData = { title: 'Test Event', repository: 'test-repo' };
      const webhookUrl = 'https://outlook.webhook.office.com/webhookb2/test';

      global.fetch = jest.fn().mockResolvedValueOnce({
        status: 200,
        text: jest.fn().mockResolvedValueOnce('')
      });

      await postToTeams(eventData, webhookUrl);

      expect(global.fetch).toHaveBeenCalledWith(
        webhookUrl,
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json'
          }
        })
      );
    });

    it('Property 33: sends JSON payload in request body', async () => {
      const eventData = { title: 'Test Event', repository: 'test-repo' };
      const webhookUrl = 'https://outlook.webhook.office.com/webhookb2/test';

      global.fetch = jest.fn().mockResolvedValueOnce({
        status: 200,
        text: jest.fn().mockResolvedValueOnce('')
      });

      await postToTeams(eventData, webhookUrl);

      expect(global.fetch).toHaveBeenCalledWith(
        webhookUrl,
        expect.objectContaining({
          body: JSON.stringify(eventData)
        })
      );
    });

    // Property 34: Teams Posting Timeout
    // For any Teams posting request, the system SHALL use a 10-second timeout
    it('Property 34: enforces 10-second timeout', async () => {
      const eventData = { title: 'Test Event', repository: 'test-repo' };
      const webhookUrl = 'https://outlook.webhook.office.com/webhookb2/test';

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      // Mock fetch to simulate timeout
      global.fetch = jest.fn().mockImplementationOnce(() => {
        return new Promise((_, reject) => {
          const error = new Error('Aborted');
          (error as any).name = 'AbortError';
          reject(error);
        });
      });

      const result = await postToTeams(eventData, webhookUrl);

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Teams API posting timeout after 10 seconds')
      );

      consoleErrorSpy.mockRestore();
    });

    it('handles empty event data', async () => {
      const eventData = {};
      const webhookUrl = 'https://outlook.webhook.office.com/webhookb2/test';

      global.fetch = jest.fn().mockResolvedValueOnce({
        status: 200,
        text: jest.fn().mockResolvedValueOnce('')
      });

      const result = await postToTeams(eventData, webhookUrl);

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        webhookUrl,
        expect.objectContaining({
          body: '{}'
        })
      );
    });

    it('handles complex nested event data', async () => {
      const eventData = {
        title: 'Complex Event',
        repository: 'test-repo',
        metadata: {
          nested: {
            deeply: {
              value: 'test'
            }
          },
          array: [1, 2, 3]
        }
      };
      const webhookUrl = 'https://outlook.webhook.office.com/webhookb2/test';

      global.fetch = jest.fn().mockResolvedValueOnce({
        status: 200,
        text: jest.fn().mockResolvedValueOnce('')
      });

      const result = await postToTeams(eventData, webhookUrl);

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        webhookUrl,
        expect.objectContaining({
          body: JSON.stringify(eventData)
        })
      );
    });

    it('handles special characters in event data', async () => {
      const eventData = {
        title: 'Event with special chars: <>&"\'',
        repository: 'test-repo'
      };
      const webhookUrl = 'https://outlook.webhook.office.com/webhookb2/test';

      global.fetch = jest.fn().mockResolvedValueOnce({
        status: 200,
        text: jest.fn().mockResolvedValueOnce('')
      });

      const result = await postToTeams(eventData, webhookUrl);

      expect(result).toBe(true);
    });

    it('handles various HTTP error codes', async () => {
      const errorCodes = [400, 401, 403, 404, 500, 502, 503];

      for (const code of errorCodes) {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        const eventData = { title: 'Test Event' };
        const webhookUrl = 'https://outlook.webhook.office.com/webhookb2/test';

        global.fetch = jest.fn().mockResolvedValueOnce({
          status: code,
          text: jest.fn().mockResolvedValueOnce('Error')
        });

        const result = await postToTeams(eventData, webhookUrl);

        expect(result).toBe(false);

        consoleErrorSpy.mockRestore();
      }
    });

    it('handles response body reading errors', async () => {
      const eventData = { title: 'Test Event' };
      const webhookUrl = 'https://outlook.webhook.office.com/webhookb2/test';

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      global.fetch = jest.fn().mockResolvedValueOnce({
        status: 400,
        text: jest.fn().mockRejectedValueOnce(new Error('Failed to read response'))
      });

      const result = await postToTeams(eventData, webhookUrl);

      expect(result).toBe(false);

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Edge cases', () => {
    it('handles very large event data', async () => {
      const largeArray = Array(1000).fill({ key: 'value' });
      const eventData = {
        title: 'Large Event',
        data: largeArray
      };
      const webhookUrl = 'https://outlook.webhook.office.com/webhookb2/test';

      global.fetch = jest.fn().mockResolvedValueOnce({
        status: 200,
        text: jest.fn().mockResolvedValueOnce('')
      });

      const result = await postToTeams(eventData, webhookUrl);

      expect(result).toBe(true);
    });

    it('handles webhook URL with query parameters', async () => {
      const eventData = { title: 'Test Event' };
      const webhookUrl =
        'https://outlook.webhook.office.com/webhookb2/test?param1=value1&param2=value2';

      global.fetch = jest.fn().mockResolvedValueOnce({
        status: 200,
        text: jest.fn().mockResolvedValueOnce('')
      });

      const result = await postToTeams(eventData, webhookUrl);

      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(webhookUrl, expect.any(Object));
    });

    it('handles webhook URL with special characters', async () => {
      const eventData = { title: 'Test Event' };
      const webhookUrl = 'https://outlook.webhook.office.com/webhookb2/test%20encoded';

      global.fetch = jest.fn().mockResolvedValueOnce({
        status: 200,
        text: jest.fn().mockResolvedValueOnce('')
      });

      const result = await postToTeams(eventData, webhookUrl);

      expect(result).toBe(true);
    });

    it('handles null values in event data', async () => {
      const eventData = {
        title: 'Test Event',
        description: null,
        metadata: null
      };
      const webhookUrl = 'https://outlook.webhook.office.com/webhookb2/test';

      global.fetch = jest.fn().mockResolvedValueOnce({
        status: 200,
        text: jest.fn().mockResolvedValueOnce('')
      });

      const result = await postToTeams(eventData, webhookUrl);

      expect(result).toBe(true);
    });

    it('handles undefined values in event data', async () => {
      const eventData = {
        title: 'Test Event',
        description: undefined,
        metadata: undefined
      };
      const webhookUrl = 'https://outlook.webhook.office.com/webhookb2/test';

      global.fetch = jest.fn().mockResolvedValueOnce({
        status: 200,
        text: jest.fn().mockResolvedValueOnce('')
      });

      const result = await postToTeams(eventData, webhookUrl);

      expect(result).toBe(true);
    });
  });
});
