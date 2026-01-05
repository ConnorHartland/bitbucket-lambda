/**
 * Webhook Reception Module
 * Handles extraction of headers and body from API Gateway events
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */

export interface WebhookEvent {
  eventType: string;
  signature: string;
  body: string;
  headers: Record<string, string>;
}

export interface APIGatewayProxyEvent {
  headers: Record<string, string>;
  body: string | null;
  isBase64Encoded: boolean;
  requestContext?: {
    requestId?: string;
    identity?: {
      sourceIp?: string;
    };
  };
}

export function extractWebhookEvent(event: APIGatewayProxyEvent): WebhookEvent {
  const normalizedHeaders: Record<string, string> = {};
  Object.entries(event.headers || {}).forEach(([key, value]) => {
    normalizedHeaders[key.toLowerCase()] = value;
  });

  const eventType = normalizedHeaders['x-event-key'] || '';
  if (!eventType) throw new Error('Missing X-Event-Key header');

  const signature = normalizedHeaders['x-hub-signature'] || '';
  if (!signature) throw new Error('Missing X-Hub-Signature header');

  let body = event.body || '';
  if (event.isBase64Encoded) {
    body = Buffer.from(body, 'base64').toString('utf-8');
  }

  return { eventType, signature, body, headers: normalizedHeaders };
}

export function getRequestId(event: APIGatewayProxyEvent): string {
  return event.requestContext?.requestId || 'unknown';
}
