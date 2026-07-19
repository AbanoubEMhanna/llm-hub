'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { formatRunEntry, formatStep, parseRunLines } = require('../lib/agent-history.js');

// ── formatStep ───────────────────────────────────────────────────────────────

test('formatStep: builds a normalized step from full input', () => {
  const step = formatStep({ id: 'call_1', name: 'web_search', args: { q: 'hi' }, result: 'ok', cached: false, durationMs: 12.7 });
  assert.deepEqual(step, { id: 'call_1', name: 'web_search', args: '{"q":"hi"}', result: 'ok', cached: false, ms: 13 });
});

test('formatStep: coerces cached to a strict boolean', () => {
  assert.equal(formatStep({ cached: 'yes' }).cached, false);
  assert.equal(formatStep({ cached: true }).cached, true);
});

test('formatStep: coerces a NaN/negative duration to 0', () => {
  assert.equal(formatStep({ durationMs: NaN }).ms, 0);
  assert.equal(formatStep({ durationMs: -50 }).ms, 0);
});

test('formatStep: truncates oversized args/result fields', () => {
  const huge = 'x'.repeat(5000);
  const step = formatStep({ args: huge, result: huge });
  assert.ok(step.args.length < 5000);
  assert.ok(step.args.endsWith('…[truncated]'));
  assert.ok(step.result.endsWith('…[truncated]'));
});

test('formatStep: stringifies non-string args/result', () => {
  const step = formatStep({ args: { a: 1 }, result: { b: 2 } });
  assert.equal(step.args, '{"a":1}');
  assert.equal(step.result, '{"b":2}');
});

// ── formatRunEntry ───────────────────────────────────────────────────────────

test('formatRunEntry: builds a normalized run from full input', () => {
  const run = formatRunEntry({
    id: 'run_1', timestamp: '2026-07-19T00:00:00.000Z', provider: 'ollama', model: 'llama3.2:3b',
    status: 'done', elapsedMs: 500, steps: [{ id: 'c1', name: 'datetime', args: {}, result: 'now', cached: false, durationMs: 5 }],
  });
  assert.equal(run.id, 'run_1');
  assert.equal(run.ts, '2026-07-19T00:00:00.000Z');
  assert.equal(run.provider, 'ollama');
  assert.equal(run.model, 'llama3.2:3b');
  assert.equal(run.status, 'done');
  assert.equal(run.error, null);
  assert.equal(run.ms, 500);
  assert.equal(run.steps.length, 1);
  assert.equal(run.steps[0].name, 'datetime');
});

test('formatRunEntry: normalizes status to one of done/error/stopped', () => {
  assert.equal(formatRunEntry({ status: 'error' }).status, 'error');
  assert.equal(formatRunEntry({ status: 'stopped' }).status, 'stopped');
  assert.equal(formatRunEntry({ status: 'bogus' }).status, 'done');
  assert.equal(formatRunEntry({}).status, 'done');
});

test('formatRunEntry: fills in a timestamp when omitted', () => {
  const run = formatRunEntry({ id: 'r1' });
  assert.ok(run.ts.length > 0);
});

test('formatRunEntry: defaults steps to an empty array', () => {
  assert.deepEqual(formatRunEntry({}).steps, []);
  assert.deepEqual(formatRunEntry({ steps: 'not-an-array' }).steps, []);
});

test('formatRunEntry: truncates an oversized error message', () => {
  const run = formatRunEntry({ status: 'error', error: 'x'.repeat(5000) });
  assert.ok(run.error.endsWith('…[truncated]'));
});

// ── parseRunLines ────────────────────────────────────────────────────────────

test('parseRunLines: empty/undefined input → []', () => {
  assert.deepEqual(parseRunLines(''), []);
  assert.deepEqual(parseRunLines(undefined), []);
});

test('parseRunLines: parses multiple JSONL entries in file order', () => {
  const raw = '{"id":"a"}\n{"id":"b"}\n{"id":"c"}\n';
  assert.deepEqual(parseRunLines(raw), [{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
});

test('parseRunLines: skips malformed lines without dropping valid ones', () => {
  const raw = '{"id":"a"}\nnot json\n{"id":"b"}\n';
  assert.deepEqual(parseRunLines(raw), [{ id: 'a' }, { id: 'b' }]);
});

test('parseRunLines: ignores blank lines', () => {
  const raw = '{"id":"a"}\n\n   \n{"id":"b"}\n';
  assert.deepEqual(parseRunLines(raw), [{ id: 'a' }, { id: 'b' }]);
});
