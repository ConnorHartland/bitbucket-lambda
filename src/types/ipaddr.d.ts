/**
 * Type definitions for ipaddr.js
 */

declare module 'ipaddr.js' {
  interface IPv4 {
    kind(): 'ipv4';
    match(other: IPv4 | IPv6, prefixLength: number): boolean;
  }

  interface IPv6 {
    kind(): 'ipv6';
    match(other: IPv4 | IPv6, prefixLength: number): boolean;
  }

  type Address = IPv4 | IPv6;

  function process(addr: string): Address;
}
