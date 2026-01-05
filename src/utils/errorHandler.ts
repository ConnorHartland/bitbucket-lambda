/**
 * Error Handling Module
 * Handles all error types and returns appropriate HTTP responses
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7
 */

import { logWithContext } from './logging';

export interface APIGatewayProxyResult {
  statusCode: number;
  body: string;
}

export interface ErrorResponse {
  statusCode: number;
  message: string;
  requestId?: string;
}

// Custom error classes
export class JsonParsingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JsonParsingError';
  }
}

export class SignatureVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SignatureVerificationError';
  }
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

export class AwsServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AwsServiceError';
  }
}

export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

// Error handler configuration
const errorHandlers: Record<string, { statusCode: number; message: string }> = {
  JsonParsingError: { statusCode: 400, message: 'Invalid JSON payload' },
  SignatureVerificationError: { statusCode: 401, message: 'Unauthorized' },
  ConfigurationError: { statusCode: 500, message: 'Server configuration error' },
  AwsServiceError: { statusCode: 500, message: 'Service configuration error' },
  NetworkError: { statusCode: 500, message: 'Service temporarily unavailable' }
};

/**
 * Generic error handler that routes based on error type
 */
function handleTypedError(
  error: Error,
  requestId?: string,
  eventType?: string
): APIGatewayProxyResult | null {
  const handler = errorHandlers[error.name];
  if (!handler) return null;

  const context: Record<string, any> = {
    errorType: error.name,
    errorMessage: error.message
  };

  if ((error as any).Code) {
    context.errorCode = (error as any).Code;
  }

  logWithContext('error', `${error.name}: ${error.message}`, requestId, eventType, context);
  return createErrorResponse(handler.statusCode, handler.message, requestId);
}

export function createErrorResponse(
  statusCode: number,
  message: string,
  requestId?: string
): APIGatewayProxyResult {
  const errorResponse: ErrorResponse = {
    statusCode,
    message,
    ...(requestId && { requestId })
  };

  return {
    statusCode,
    body: JSON.stringify(errorResponse)
  };
}

/**
 * Main error handler that routes to appropriate handler based on error type
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7
 */
export function handleError(
  error: Error,
  requestId?: string,
  eventType?: string
): APIGatewayProxyResult {
  // Try typed error handler first
  const typedResult = handleTypedError(error, requestId, eventType);
  if (typedResult) return typedResult;

  // Check for AWS service errors by Code property
  if ((error as any).Code) {
    logWithContext('error', `AWS service error: ${error.message}`, requestId, eventType, {
      errorType: 'AwsServiceError',
      errorCode: (error as any).Code
    });
    return createErrorResponse(500, 'Service configuration error', requestId);
  }

  // Check for network errors by message patterns
  const networkPatterns = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'timeout'];
  if (networkPatterns.some(pattern => error.message.includes(pattern))) {
    logWithContext('error', `Network error: ${error.message}`, requestId, eventType, {
      errorType: 'NetworkError'
    });
    return createErrorResponse(500, 'Service temporarily unavailable', requestId);
  }

  // Default to unexpected error
  logWithContext('error', `Unexpected error: ${error.message}`, requestId, eventType, {
    errorType: error.name || 'UnexpectedError',
    stack: error.stack
  });
  return createErrorResponse(500, 'Internal server error', requestId);
}

/**
 * Validate JSON payload and throw JsonParsingError if invalid
 * Requirement 9.1: JSON parsing errors → 400
 */
export function validateJsonPayload(body: string): Record<string, any> {
  try {
    return JSON.parse(body);
  } catch (error) {
    throw new JsonParsingError(`Invalid JSON: ${(error as Error).message}`);
  }
}
