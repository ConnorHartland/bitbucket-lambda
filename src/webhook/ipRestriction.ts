/**
 * IP Restriction Module
 * Validates incoming webhook requests against allowed Bitbucket IP ranges
 */

import { getSecret } from '../aws/secrets';
import { logger } from '../utils/logging';
import ipaddr from 'ipaddr.js';

interface IPRangesSecret {
  ip_ranges: string[];
}

let cachedIpRanges: string[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 3600000; // 1 hour

/**
 * Clear the IP ranges cache (for testing)
 */
export function clearIpRangesCache(): void {
  cachedIpRanges = null;
  cacheTimestamp = 0;
}

/**
 * Retrieve and cache Bitbucket IP ranges from Secrets Manager
 */
async function getIpRanges(secretArn: string): Promise<string[]> {
  const now = Date.now();

  // Return cached ranges if still valid
  if (cachedIpRanges && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedIpRanges;
  }

  try {
    const secretValue = await getSecret(secretArn);
    const secret = JSON.parse(secretValue) as IPRangesSecret;
    cachedIpRanges = secret.ip_ranges;
    cacheTimestamp = now;
    logger.info('IP ranges retrieved and cached from Secrets Manager');
    return cachedIpRanges;
  } catch (error) {
    logger.error(`Failed to retrieve IP ranges: ${(error as Error).message}`);
    throw new Error('Failed to retrieve allowed IP ranges');
  }
}

/**
 * Check if an IP address is within any of the allowed CIDR ranges
 */
function isIpInRanges(ip: string, ranges: string[]): boolean {
  try {
    const addr = ipaddr.process(ip);

    for (const range of ranges) {
      try {
        const [rangeIp, prefixLength] = range.split('/');
        const rangeAddr = ipaddr.process(rangeIp);

        if (addr.kind() !== rangeAddr.kind()) {
          continue; // Skip if IP versions don't match
        }

        if (addr.match(rangeAddr, parseInt(prefixLength, 10))) {
          return true;
        }
      } catch (error) {
        logger.warn(`Invalid CIDR range: ${range}`);
        continue;
      }
    }

    return false;
  } catch (error) {
    logger.error(`Failed to parse IP address: ${ip}`);
    return false;
  }
}

/**
 * Extract source IP from API Gateway event
 */
export function getSourceIp(event: any): string | null {
  // Try requestContext first (most reliable)
  if (event.requestContext?.identity?.sourceIp) {
    return event.requestContext.identity.sourceIp;
  }

  // Fallback to X-Forwarded-For header
  const xForwardedFor = event.headers?.['x-forwarded-for'];
  if (xForwardedFor) {
    // X-Forwarded-For can contain multiple IPs, take the first one
    return xForwardedFor.split(',')[0].trim();
  }

  return null;
}

/**
 * Validate that the request source IP is in the allowed Bitbucket ranges
 */
export async function validateSourceIp(
  event: any,
  secretArn: string,
  requestId: string
): Promise<{ isValid: boolean; reason?: string }> {
  const sourceIp = getSourceIp(event);

  if (!sourceIp) {
    logger.warn('Could not determine source IP', requestId);
    return { isValid: false, reason: 'Could not determine source IP' };
  }

  try {
    const allowedRanges = await getIpRanges(secretArn);
    const isAllowed = isIpInRanges(sourceIp, allowedRanges);

    if (!isAllowed) {
      logger.warn(`Request from unauthorized IP: ${sourceIp}`, requestId);
      return { isValid: false, reason: `IP ${sourceIp} not in allowed ranges` };
    }

    logger.info(`Request from authorized IP: ${sourceIp}`, requestId);
    return { isValid: true };
  } catch (error) {
    logger.error(`IP validation error: ${(error as Error).message}`, requestId);
    // Fail open on error - log but don't block
    return { isValid: true };
  }
}
