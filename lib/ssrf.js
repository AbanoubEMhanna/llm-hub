'use strict';

/**
 * Returns true if the given hostname resolves to a private/loopback/reserved
 * address that should be blocked for SSRF protection.
 *
 * @param {string} host - hostname or IP address
 * @returns {boolean}
 */
function isPrivateHost(host) {
  if (!host) return true;
  const h = host.toLowerCase();
  if (h === 'localhost' || h === '0.0.0.0') return true;
  // IPv6 loopback / link-local / unique-local (fc00::/7)
  // Strip brackets from [::1] notation before testing
  const ipv6 = h.startsWith('[') && h.endsWith(']') ? h.slice(1, -1) : h;
  if (ipv6 === '::1') return true;
  if (ipv6.startsWith('fe80:')) return true;
  if (/^f[c-d][0-9a-f]{2}:/.test(ipv6)) return true;
  // Known cloud metadata endpoints
  if (h === '169.254.169.254' || h === 'metadata.google.internal') return true;
  // IPv4 private/reserved ranges
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = +m[1], b = +m[2];
    if (a === 10 || a === 127) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true;
    if (a === 0) return true;
  }
  return false;
}

module.exports = { isPrivateHost };
