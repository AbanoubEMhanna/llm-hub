'use strict';

// Formats and parses the local agent-run history (opt-in, see
// CONFIG.agentHistory.enabled in proxy.js). Captures each agent loop's
// tool calls, results, and timing so a past run can be replayed step by
// step. Tool args/results are size-capped so one run can't blow up the
// JSONL file.

const MAX_FIELD_LEN = 4000;

function truncate(value) {
  const str = typeof value === 'string' ? value : JSON.stringify(value ?? null);
  return str.length > MAX_FIELD_LEN ? str.slice(0, MAX_FIELD_LEN) + '…[truncated]' : str;
}

function formatStep({ id, name, args, result, cached, durationMs }) {
  const ms = Number(durationMs);
  return {
    id: String(id || ''),
    name: String(name || ''),
    args: truncate(args),
    result: truncate(result),
    cached: cached === true,
    ms: Number.isFinite(ms) ? Math.max(0, Math.round(ms)) : 0,
  };
}

function formatRunEntry({ id, timestamp, provider, model, status, error, elapsedMs, steps = [] }) {
  const ms = Number(elapsedMs);
  return {
    id: String(id || ''),
    ts: timestamp || new Date().toISOString(),
    provider: String(provider || ''),
    model: String(model || ''),
    status: status === 'error' ? 'error' : (status === 'stopped' ? 'stopped' : 'done'),
    error: error ? truncate(error) : null,
    ms: Number.isFinite(ms) ? Math.max(0, Math.round(ms)) : 0,
    steps: Array.isArray(steps) ? steps.map(formatStep) : [],
  };
}

function parseRunLines(raw) {
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

module.exports = { formatRunEntry, formatStep, parseRunLines };
