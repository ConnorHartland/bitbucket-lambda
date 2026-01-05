/**
 * Metrics Emitter Module
 * Emits custom metrics to CloudWatch using EMF (Embedded Metric Format)
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6
 */

const NAMESPACE = 'BitbucketTeamsWebhook';

interface EMFMetric {
  _aws: {
    Timestamp: number;
    CloudWatchMetrics: Array<{
      Namespace: string;
      Dimensions: string[][];
      Metrics: Array<{ Name: string; Unit: string }>;
    }>;
  };
  [key: string]: any;
}

function buildEMFMetric(
  metricName: string,
  value: number = 1,
  unit: string = 'Count',
  dimensions?: Record<string, string>
): EMFMetric {
  const dimensionEntries = dimensions ? Object.entries(dimensions) : [];
  const dimensionNames = dimensionEntries.map(([key]) => key);

  const metric: EMFMetric = {
    _aws: {
      Timestamp: Date.now(),
      CloudWatchMetrics: [
        {
          Namespace: NAMESPACE,
          Dimensions: dimensionNames.length > 0 ? [dimensionNames] : [[]],
          Metrics: [{ Name: metricName, Unit: unit }]
        }
      ]
    },
    [metricName]: value
  };

  dimensionEntries.forEach(([key, val]) => {
    metric[key] = val;
  });

  return metric;
}

export function emitMetric(
  metricName: string,
  value: number = 1,
  unit: string = 'Count',
  _namespace?: string,
  dimensions?: Record<string, string>
): void {
  console.log(JSON.stringify(buildEMFMetric(metricName, value, unit, dimensions)));
}

export const emitEventTypeMetric = (eventType: string) =>
  emitMetric(`EventType-${eventType}`, 1, 'Count', NAMESPACE, { EventType: eventType });

export const emitSignatureFailure = () =>
  emitMetric('SignatureVerificationFailures', 1, 'Count', NAMESPACE, {
    ErrorType: 'SignatureVerificationFailure'
  });

export const emitTeamsAPIFailure = () =>
  emitMetric('TeamsAPIFailures', 1, 'Count', NAMESPACE, { ErrorType: 'TeamsAPIFailure' });

export const emitUnsupportedEvent = () =>
  emitMetric('UnsupportedEventTypes', 1, 'Count', NAMESPACE, { ErrorType: 'UnsupportedEventType' });

export const emitProcessingDuration = (durationMs: number) =>
  emitMetric('ProcessingDuration', durationMs, 'Milliseconds', NAMESPACE, {
    MetricType: 'ProcessingDuration'
  });
