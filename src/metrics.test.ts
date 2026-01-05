/**
 * Tests for Metrics Emitter Module
 * Property-based tests using fast-check
 */

import fc from 'fast-check';
import {
  emitMetric,
  emitEventTypeMetric,
  emitSignatureFailure,
  emitTeamsAPIFailure,
  emitUnsupportedEvent,
  emitProcessingDuration
} from './metrics';

describe('emitMetric', () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('should emit a metric with default values', () => {
    emitMetric('TestMetric');

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);

    expect(output._aws).toBeDefined();
    expect(output._aws.CloudWatchMetrics).toBeDefined();
    expect(output._aws.CloudWatchMetrics[0].Namespace).toBe('BitbucketTeamsWebhook');
    expect(output._aws.CloudWatchMetrics[0].Metrics[0].Name).toBe('TestMetric');
    expect(output._aws.CloudWatchMetrics[0].Metrics[0].Unit).toBe('Count');
    expect(output.TestMetric).toBe(1);
  });

  it('should emit a metric with custom value and unit', () => {
    emitMetric('ProcessingDuration', 150, 'Milliseconds');

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);

    expect(output._aws.CloudWatchMetrics[0].Metrics[0].Name).toBe('ProcessingDuration');
    expect(output._aws.CloudWatchMetrics[0].Metrics[0].Unit).toBe('Milliseconds');
    expect(output.ProcessingDuration).toBe(150);
  });

  it('should emit a metric with dimensions', () => {
    emitMetric('EventType-repo:push', 1, 'Count', 'BitbucketTeamsWebhook', {
      EventType: 'repo:push'
    });

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);

    expect(output._aws.CloudWatchMetrics[0].Dimensions).toEqual([['EventType']]);
    expect(output.EventType).toBe('repo:push');
  });

  // Property 48: Metrics Emission
  // For any webhook processing, the system SHALL emit custom CloudWatch metrics
  it('Property 48: Metrics Emission', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }),
        fc.integer({ min: 0, max: 10000 }),
        (metricName: string, value: number) => {
          emitMetric(metricName, value);

          expect(consoleLogSpy).toHaveBeenCalled();
          const output = JSON.parse(consoleLogSpy.mock.calls[consoleLogSpy.mock.calls.length - 1][0]);

          expect(output._aws).toBeDefined();
          expect(output._aws.Timestamp).toBeDefined();
          expect(output._aws.CloudWatchMetrics).toBeDefined();
          expect(output._aws.CloudWatchMetrics[0].Namespace).toBe('BitbucketTeamsWebhook');
          expect(output[metricName]).toBe(value);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('emitEventTypeMetric', () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('should emit event type metric', () => {
    emitEventTypeMetric('repo:push');

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);

    expect(output._aws.CloudWatchMetrics[0].Metrics[0].Name).toBe('EventType-repo:push');
    expect(output.EventType).toBe('repo:push');
  });

  it('should emit metric for different event types', () => {
    const eventTypes = [
      'repo:push',
      'pullrequest:created',
      'pullrequest:updated',
      'repo:commit_status_updated'
    ];

    eventTypes.forEach((eventType) => {
      consoleLogSpy.mockClear();
      emitEventTypeMetric(eventType);

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);
      expect(output._aws.CloudWatchMetrics[0].Metrics[0].Name).toBe(`EventType-${eventType}`);
    });
  });
});

describe('emitSignatureFailure', () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('should emit signature failure metric', () => {
    emitSignatureFailure();

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);

    expect(output._aws.CloudWatchMetrics[0].Metrics[0].Name).toBe('SignatureVerificationFailures');
    expect(output.ErrorType).toBe('SignatureVerificationFailure');
  });
});

describe('emitTeamsAPIFailure', () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('should emit Teams API failure metric', () => {
    emitTeamsAPIFailure();

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);

    expect(output._aws.CloudWatchMetrics[0].Metrics[0].Name).toBe('TeamsAPIFailures');
    expect(output.ErrorType).toBe('TeamsAPIFailure');
  });
});

describe('emitUnsupportedEvent', () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('should emit unsupported event metric', () => {
    emitUnsupportedEvent();

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);

    expect(output._aws.CloudWatchMetrics[0].Metrics[0].Name).toBe('UnsupportedEventTypes');
    expect(output.ErrorType).toBe('UnsupportedEventType');
  });
});

describe('emitProcessingDuration', () => {
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  it('should emit processing duration metric', () => {
    emitProcessingDuration(150);

    expect(consoleLogSpy).toHaveBeenCalled();
    const output = JSON.parse(consoleLogSpy.mock.calls[0][0]);

    expect(output._aws.CloudWatchMetrics[0].Metrics[0].Name).toBe('ProcessingDuration');
    expect(output._aws.CloudWatchMetrics[0].Metrics[0].Unit).toBe('Milliseconds');
    expect(output.ProcessingDuration).toBe(150);
  });

  // Property 52: Processing Duration Tracking
  // For any webhook processing, the system SHALL track the processing duration
  it('Property 52: Processing Duration Tracking', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 30000 }), (durationMs: number) => {
        emitProcessingDuration(durationMs);

        expect(consoleLogSpy).toHaveBeenCalled();
        const output = JSON.parse(consoleLogSpy.mock.calls[consoleLogSpy.mock.calls.length - 1][0]);

        expect(output.ProcessingDuration).toBe(durationMs);
        expect(output._aws.CloudWatchMetrics[0].Metrics[0].Unit).toBe('Milliseconds');
      }),
      { numRuns: 100 }
    );
  });
});


