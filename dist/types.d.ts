/**
 * Core TypeScript interfaces for the Bitbucket to Teams webhook integration
 */
/**
 * Represents a failure event detected from Bitbucket webhooks
 */
export interface FailureEvent {
    type: 'pr_rejected' | 'build_failed';
    repository: string;
    branch?: string;
    pipelineName?: string;
    author: string;
    reason: string;
    link: string;
    status: string;
}
/**
 * Configuration loaded from environment variables
 */
export interface Config {
    teamsWebhookUrlSecretArn: string;
    bitbucketSecretArn: string;
    ipRestrictionEnabled: boolean;
    bitbucketIpRanges: string[];
}
/**
 * Bitbucket webhook payload for commit status updates
 */
export interface BitbucketCommitStatusPayload {
    repository: {
        name: string;
        full_slug: string;
    };
    commit_status: {
        state: 'SUCCESSFUL' | 'FAILED' | 'INPROGRESS';
        key: string;
        url: string;
        description: string;
        name?: string;
        created_on?: string;
        updated_on?: string;
    };
    commit?: {
        hash?: string;
        branch?: string;
    };
    actor: {
        username: string;
    };
}
/**
 * Bitbucket webhook payload for pull request events
 */
export interface BitbucketPullRequestPayload {
    repository: {
        name: string;
        full_slug: string;
    };
    pullrequest: {
        id: number;
        title: string;
        source?: {
            branch?: {
                name: string;
            };
        };
        links: {
            html: {
                href: string;
            };
        };
    };
    actor: {
        username: string;
    };
}
/**
 * Teams message payload
 */
export interface TeamsMessage {
    title: string;
    description: string;
    link: string;
    color: string;
}
/**
 * AWS Lambda API Gateway event
 */
export interface APIGatewayProxyEvent {
    headers: Record<string, string | undefined>;
    body: string | null;
    isBase64Encoded: boolean;
    requestContext: {
        requestId: string;
        identity: {
            sourceIp: string;
        };
    };
}
/**
 * AWS Lambda context
 */
export interface LambdaContext {
    requestId: string;
    functionName: string;
    functionVersion: string;
    invokedFunctionArn: string;
    memoryLimitInMB: string;
    awsRequestId: string;
    logGroupName: string;
    logStreamName: string;
    getRemainingTimeInMillis: () => number;
}
/**
 * AWS Lambda API Gateway response
 */
export interface APIGatewayProxyResult {
    statusCode: number;
    body: string;
    headers?: Record<string, string>;
}
//# sourceMappingURL=types.d.ts.map