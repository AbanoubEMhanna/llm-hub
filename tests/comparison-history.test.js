'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { formatSession, formatRound, pruneHistory, upsertSession, MAX_ENTRIES, MAX_ROUNDS, MAX_TEXT_LEN } = require('../lib/comparison-history.js');

test('formatRound normalizes grades and coerces missing text to empty strings', () => {
  const r = formatRound({ prompt: 'hi', textA: 'a', textB: undefined, gradeA: 'up', gradeB: 'bogus' });
  assert.equal(r.prompt, 'hi');
  assert.equal(r.textA, 'a');
  assert.equal(r.textB, '');
  assert.equal(r.gradeA, 'up');
  assert.equal(r.gradeB, null);
});

test('formatRound truncates very long text fields', () => {
  const long = 'x'.repeat(MAX_TEXT_LEN + 500);
  const r = formatRound({ prompt: long, textA: long, textB: 'short' });
  assert.equal(r.prompt.length, MAX_TEXT_LEN + '…[truncated]'.length);
  assert.ok(r.prompt.endsWith('…[truncated]'));
  assert.equal(r.textB, 'short');
});

test('formatSession fills defaults and stamps a timestamp when missing', () => {
  const s = formatSession({ modelA: 'llama3', modelB: 'qwen2' });
  assert.equal(s.modelA, 'llama3');
  assert.equal(s.modelB, 'qwen2');
  assert.equal(s.abMode, false);
  assert.deepEqual(s.rounds, []);
  assert.ok(s.id === '');
  assert.ok(typeof s.ts === 'string' && s.ts.length > 0);
});

test('formatSession keeps only the most recent MAX_ROUNDS rounds', () => {
  const rounds = Array.from({ length: MAX_ROUNDS + 10 }, (_, i) => ({ prompt: `p${i}`, textA: 'a', textB: 'b' }));
  const s = formatSession({ id: 's1', modelA: 'a', modelB: 'b', rounds });
  assert.equal(s.rounds.length, MAX_ROUNDS);
  assert.equal(s.rounds[0].prompt, `p${10}`); // oldest 10 dropped
  assert.equal(s.rounds[s.rounds.length - 1].prompt, `p${MAX_ROUNDS + 9}`);
});

test('pruneHistory caps the list to MAX_ENTRIES, keeping the front (newest-first)', () => {
  const list = Array.from({ length: MAX_ENTRIES + 5 }, (_, i) => ({ id: String(i) }));
  const pruned = pruneHistory(list);
  assert.equal(pruned.length, MAX_ENTRIES);
  assert.equal(pruned[0].id, '0');
});

test('pruneHistory treats a non-array as empty', () => {
  assert.deepEqual(pruneHistory(null), []);
  assert.deepEqual(pruneHistory(undefined), []);
});

test('upsertSession moves an existing session to the front instead of duplicating it', () => {
  const list = [{ id: 'a', v: 1 }, { id: 'b', v: 1 }, { id: 'c', v: 1 }];
  const updated = upsertSession(list, { id: 'b', v: 2 });
  assert.equal(updated.length, 3);
  assert.deepEqual(updated[0], { id: 'b', v: 2 });
  assert.deepEqual(updated.map(s => s.id).sort(), ['a', 'b', 'c']);
});

test('upsertSession inserts a brand-new session at the front', () => {
  const list = [{ id: 'a' }];
  const updated = upsertSession(list, { id: 'z' });
  assert.deepEqual(updated.map(s => s.id), ['z', 'a']);
});

test('upsertSession enforces MAX_ENTRIES', () => {
  const list = Array.from({ length: MAX_ENTRIES }, (_, i) => ({ id: `old${i}` }));
  const updated = upsertSession(list, { id: 'new' });
  assert.equal(updated.length, MAX_ENTRIES);
  assert.equal(updated[0].id, 'new');
  assert.ok(!updated.some(s => s.id === `old${MAX_ENTRIES - 1}`));
});
