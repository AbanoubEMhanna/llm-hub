'use strict';

// Formats and parses the security-focused tool/agent execution audit log
// (opt-in, see CONFIG.audit.enabled in proxy.js). Unlike the agent-run
// history feature (UI replay, scoped to /v1/chat sessions, skips runs with
// zero tool calls), this hooks the single executeWithCache() choke point
// that every provider branch of runAgentLoop calls through, so it records
// every tool execution — including cache hits — with a success/failure
// verdict, regardless of which endpoint triggered the agent loop.

const MAX_FIELD_LEN = 4000;

function truncate(value) {
  const str = typeof value === 'string' ? value : JSON.stringify(value ?? null);
  return str.length > MAX_FIELD_LEN ? str.slice(0, MAX_FIELD_LEN) + '…[truncated]' : str;
}

function formatAuditEntry({ id, timestamp, tool, provider, model, args, result, success, cached, durationMs }) {
  const ms = Number(durationMs);
  return {
    id: String(id || ''),
    ts: timestamp || new Date().toISOString(),
    tool: String(tool || ''),
    provider: String(provider || ''),
    model: String(model || ''),
    args: truncate(args),
    result: truncate(result),
    success: success !== false,
    cached: cached === true,
    ms: Number.isFinite(ms) ? Math.max(0, Math.round(ms)) : 0,
  };
}

function parseAuditLines(raw) {
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

module.exports = { formatAuditEntry, parseAuditLines };
