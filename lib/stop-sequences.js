'use strict';

const MAX_STOP_SEQUENCES = 4;

// Accepts a comma-separated string or an array of strings and returns a
// deduped, trimmed, non-empty list capped at MAX_STOP_SEQUENCES (the limit
// most OpenAI-compatible providers enforce).
function parseStopSequences(input) {
  const list = Array.isArray(input)
    ? input.map(String)
    : typeof input === 'string'
      ? input.split(',')
      : [];

  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const s = raw.trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= MAX_STOP_SEQUENCES) break;
  }
  return out;
}

module.exports = { parseStopSequences, MAX_STOP_SEQUENCES };
