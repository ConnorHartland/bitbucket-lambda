/**
 * Lambda handler entry point for Bitbucket to Teams webhook integration
 * Orchestrates the complete webhook processing pipeline:
 * 1. Load configuration
 * 2. Extract headers and body from event
 * 3. Check IP whitelist (if enabled)
 * 4. Verify signature
 * 5. Load secrets
 * 6. Detect failure
 * 7. Format and post to Teams if failure
 * 8. Return 200 OK for all outcomes
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult, LambdaContext } from './types';
/**
 * Lambda handler for Bitbucket to Teams webhook integration
 * Processes incoming Bitbucket webhooks and posts failure notifications to Teams
 *
 * @param event The API Gateway proxy event
 * @param context The Lambda context
 * @returns Promise<APIGatewayProxyResult> Always returns 200 OK
 */
export declare function handler(event: APIGatewayProxyEvent, context: LambdaContext): Promise<APIGatewayProxyResult>;
//# sourceMappingURL=index.d.ts.map