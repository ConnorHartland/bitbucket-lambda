/**
 * IP whitelist validation for Bitbucket webhook requests
 * Validates that webhook requests come from known Bitbucket IP ranges
 */

import { APIGatewayProxyEvent } from '../types';
import { BITBUCKET_IP_RANGES } from '../constants';

/**
 * Bitbucket IP ranges - will be set from configuration
 */
let ipRanges: string[] = BITBUCKET_IP_RANGES;

/**
 * Set the IP ranges to use for validation
 * @param ranges Array of CIDR ranges
 */
export function setIpRanges(ranges: string[]): void {
  ipRanges = ranges;
}

/**
 * Convert an IP address string to a 32-bit integer
 * @param ip The IP address string (e.g., "192.168.1.1")
 * @returns The IP address as a 32-bit integer
 */
function ipToInt(ip: string): number {
  const parts = ip.split('.');
  if (parts.length !== 4) {
    throw new Error(`Invalid IP address: ${ip}`);
  }

  let result = 0;
  for (let i = 0; i < 4; i++) {
    const part = parseInt(parts[i], 10);
    if (isNaN(part) || part < 0 || part > 255) {
      throw new Error(`Invalid IP address: ${ip}`);
    }
    result = (result << 8) | part;
  }

  return result >>> 0; // Convert to unsigned 32-bit integer
}

/**
 * Parse a CIDR notation (e.g., "192.168.1.0/24") into network and mask
 * @param cidr The CIDR notation string
 * @returns Object with network and mask as 32-bit integers
 */
function parseCIDR(cidr: string): { network: number; mask: number } {
  const [ip, prefixStr] = cidr.split('/');
  if (!ip || !prefixStr) {
    throw new Error(`Invalid CIDR notation: ${cidr}`);
  }

  const prefix = parseInt(prefixStr, 10);
  if (isNaN(prefix) || prefix < 0 || prefix > 32) {
    throw new Error(`Invalid CIDR prefix: ${prefixStr}`);
  }

  const network = ipToInt(ip);
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;

  return { network, mask };
}

/**
 * Check if an IP address is within a CIDR range
 * @param ip The IP address to check
 * @param cidr The CIDR range (e.g., "192.168.1.0/24")
 * @returns True if the IP is within the CIDR range, false otherwise
 */
function isIpInCIDR(ip: string, cidr: string): boolean {
  try {
    const ipInt = ipToInt(ip);
    const { network, mask } = parseCIDR(cidr);
    return (ipInt & mask) === (network & mask);
  } catch {
    return false;
  }
}

/**
 * Extract the source IP from an API Gateway event
 * Tries X-Forwarded-For header first, then falls back to event context
 *
 * @param event The API Gateway proxy event
 * @returns The source IP address, or undefined if not found
 */
export function extractSourceIp(event: APIGatewayProxyEvent): string | undefined {
  // Try X-Forwarded-For header first (set by API Gateway)
  const xForwardedFor = event.headers['X-Forwarded-For'] || event.headers['x-forwarded-for'];
  if (xForwardedFor) {
    // X-Forwarded-For can contain multiple IPs, take the first one
    const ips = xForwardedFor.split(',');
    const firstIp = ips[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  // Fall back to event context sourceIp
  if (event.requestContext?.identity?.sourceIp) {
    return event.requestContext.identity.sourceIp;
  }

  return undefined;
}

/**
 * Check if a source IP is whitelisted (in Bitbucket IP ranges)
 *
 * @param sourceIp The source IP address to check
 * @returns True if the IP is whitelisted, false otherwise
 */
export function isIpWhitelisted(sourceIp: string): boolean {
  for (const cidr of ipRanges) {
    if (isIpInCIDR(sourceIp, cidr)) {
      return true;
    }
  }
  return false;
}

