'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { formatLogEntry, parseLogLines } = require('../lib/request-log.js');

// ── formatLogEntry ──────────────────────────────────────────────────────────

test('formatLogEntry: builds a normalized entry from full input', () => {
  const entry = formatLogEntry({ timestamp: '2026-07-18T00:00:00.000Z', method: 'GET', path: '/v1/models', status: 200, durationMs: 12.7 });
  assert.deepEqual(entry, { ts: '2026-07-18T00:00:00.000Z', method: 'GET', path: '/v1/models', status: 200, ms: 13 });
});

test('formatLogEntry: coerces a missing status to 0', () => {
  const entry = formatLogEntry({ timestamp: 't', method: 'POST', path: '/v1/chat', durationMs: 5 });
  assert.equal(entry.status, 0);
});

test('formatLogEntry: coerces a NaN/negative duration to 0', () => {
  assert.equal(formatLogEntry({ durationMs: NaN }).ms, 0);
  assert.equal(formatLogEntry({ durationMs: -50 }).ms, 0);
});

test('formatLogEntry: fills in a timestamp when omitted', () => {
  const entry = formatLogEntry({ method: 'GET', path: '/health', status: 200, durationMs: 1 });
  assert.ok(entry.ts.length > 0);
});

// ── parseLogLines ────────────────────────────────────────────────────────────

test('parseLogLines: empty/undefined input → []', () => {
  assert.deepEqual(parseLogLines(''), []);
  assert.deepEqual(parseLogLines(undefined), []);
});

test('parseLogLines: parses multiple JSONL entries in file order', () => {
  const raw = '{"a":1}\n{"a":2}\n{"a":3}\n';
  assert.deepEqual(parseLogLines(raw), [{ a: 1 }, { a: 2 }, { a: 3 }]);
});

test('parseLogLines: skips malformed lines without dropping valid ones', () => {
  const raw = '{"a":1}\nnot json\n{"a":2}\n';
  assert.deepEqual(parseLogLines(raw), [{ a: 1 }, { a: 2 }]);
});

test('parseLogLines: ignores blank lines', () => {
  const raw = '{"a":1}\n\n   \n{"a":2}\n';
  assert.deepEqual(parseLogLines(raw), [{ a: 1 }, { a: 2 }]);
});
