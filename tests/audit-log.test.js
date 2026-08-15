'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { formatAuditEntry, parseAuditLines } = require('../lib/audit-log.js');

// ── formatAuditEntry ─────────────────────────────────────────────────────────

test('formatAuditEntry: builds a normalized entry from full input', () => {
  const entry = formatAuditEntry({
    id: 'a1', timestamp: '2026-07-19T00:00:00.000Z', tool: 'web_search', provider: 'ollama', model: 'llama3.2:3b',
    args: { q: 'hi' }, result: 'ok', success: true, cached: false, durationMs: 12.7,
  });
  assert.deepEqual(entry, {
    id: 'a1', ts: '2026-07-19T00:00:00.000Z', tool: 'web_search', provider: 'ollama', model: 'llama3.2:3b',
    args: '{"q":"hi"}', result: 'ok', success: true, cached: false, ms: 13,
  });
});

test('formatAuditEntry: defaults success to true unless explicitly false', () => {
  assert.equal(formatAuditEntry({}).success, true);
  assert.equal(formatAuditEntry({ success: true }).success, true);
  assert.equal(formatAuditEntry({ success: false }).success, false);
});

test('formatAuditEntry: coerces cached to a strict boolean', () => {
  assert.equal(formatAuditEntry({ cached: 'yes' }).cached, false);
  assert.equal(formatAuditEntry({ cached: true }).cached, true);
});

test('formatAuditEntry: coerces a NaN/negative duration to 0', () => {
  assert.equal(formatAuditEntry({ durationMs: NaN }).ms, 0);
  assert.equal(formatAuditEntry({ durationMs: -50 }).ms, 0);
});

test('formatAuditEntry: truncates oversized args/result fields', () => {
  const huge = 'x'.repeat(5000);
  const entry = formatAuditEntry({ args: huge, result: huge });
  assert.ok(entry.args.length < 5000);
  assert.ok(entry.args.endsWith('…[truncated]'));
  assert.ok(entry.result.endsWith('…[truncated]'));
});

test('formatAuditEntry: stringifies non-string args/result', () => {
  const entry = formatAuditEntry({ args: { a: 1 }, result: { b: 2 } });
  assert.equal(entry.args, '{"a":1}');
  assert.equal(entry.result, '{"b":2}');
});

test('formatAuditEntry: fills in a timestamp when omitted', () => {
  const entry = formatAuditEntry({ id: 'a1' });
  assert.ok(entry.ts.length > 0);
});

// ── parseAuditLines ──────────────────────────────────────────────────────────

test('parseAuditLines: empty/undefined input → []', () => {
  assert.deepEqual(parseAuditLines(''), []);
  assert.deepEqual(parseAuditLines(undefined), []);
});

test('parseAuditLines: parses multiple JSONL entries in file order', () => {
  const raw = '{"id":"a"}\n{"id":"b"}\n{"id":"c"}\n';
  assert.deepEqual(parseAuditLines(raw), [{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
});

test('parseAuditLines: skips malformed lines without dropping valid ones', () => {
  const raw = '{"id":"a"}\nnot json\n{"id":"b"}\n';
  assert.deepEqual(parseAuditLines(raw), [{ id: 'a' }, { id: 'b' }]);
});

test('parseAuditLines: ignores blank lines', () => {
  const raw = '{"id":"a"}\n\n   \n{"id":"b"}\n';
  assert.deepEqual(parseAuditLines(raw), [{ id: 'a' }, { id: 'b' }]);
});
