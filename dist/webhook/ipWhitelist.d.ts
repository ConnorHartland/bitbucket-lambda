/**
 * IP whitelist validation for Bitbucket webhook requests
 * Validates that webhook requests come from known Bitbucket IP ranges
 */
import { APIGatewayProxyEvent } from '../types';
/**
 * Set the IP ranges to use for validation
 * @param ranges Array of CIDR ranges
 */
export declare function setIpRanges(ranges: string[]): void;
/**
 * Extract the source IP from an API Gateway event
 * Tries X-Forwarded-For header first, then falls back to event context
 *
 * @param event The API Gateway proxy event
 * @returns The source IP address, or undefined if not found
 */
export declare function extractSourceIp(event: APIGatewayProxyEvent): string | undefined;
/**
 * Check if a source IP is whitelisted (in Bitbucket IP ranges)
 *
 * @param sourceIp The source IP address to check
 * @returns True if the IP is whitelisted, false otherwise
 */
export declare function isIpWhitelisted(sourceIp: string): boolean;
//# sourceMappingURL=ipWhitelist.d.ts.map