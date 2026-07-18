'use strict';

// Formats and parses the local request log (opt-in, see CONFIG.logging.enabled
// in proxy.js). Deliberately metadata-only — method, path, status, duration —
// never request/response bodies, headers, or API keys, so there is nothing
// sensitive to redact.

function formatLogEntry({ timestamp, method, path, status, durationMs }) {
  const ms = Number(durationMs);
  return {
    ts: timestamp || new Date().toISOString(),
    method: String(method || ''),
    path: String(path || ''),
    status: Number.isFinite(Number(status)) ? Number(status) : 0,
    ms: Number.isFinite(ms) ? Math.max(0, Math.round(ms)) : 0,
  };
}

function parseLogLines(raw) {
  if (!raw) return [];
  return raw
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      try { return JSON.parse(line); }
      catch { return null; }
    })
    .filter(Boolean);
}

module.exports = { formatLogEntry, parseLogLines };
