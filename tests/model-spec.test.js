'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildSpecRows, formatContextLength } = require('../lib/model-spec.js');

// ── formatContextLength ─────────────────────────────────────────────────────

test('formatContextLength: null/undefined → null', () => {
  assert.equal(formatContextLength(null), null);
  assert.equal(formatContextLength(undefined), null);
});

test('formatContextLength: non-number → null', () => {
  assert.equal(formatContextLength('128000'), null);
});

test('formatContextLength: >=1024 formats in K', () => {
  assert.equal(formatContextLength(131072), '128K tokens');
  assert.equal(formatContextLength(4096), '4K tokens');
});

test('formatContextLength: <1024 formats raw', () => {
  assert.equal(formatContextLength(512), '512 tokens');
});

// ── buildSpecRows ────────────────────────────────────────────────────────────

test('buildSpecRows: both empty → []', () => {
  assert.deepEqual(buildSpecRows(null, null), []);
  assert.deepEqual(buildSpecRows({}, {}), []);
  assert.deepEqual(buildSpecRows(undefined, undefined), []);
});

test('buildSpecRows: omits rows where neither side has a value', () => {
  const rows = buildSpecRows({ parameter_size: '7B' }, {});
  assert.equal(rows.length, 1);
  assert.equal(rows[0].label, 'Parameters');
});

test('buildSpecRows: fills missing side with em dash', () => {
  const rows = buildSpecRows({ parameter_size: '7B' }, {});
  assert.equal(rows[0].a, '7B');
  assert.equal(rows[0].b, '—');
});

test('buildSpecRows: marks differing values', () => {
  const rows = buildSpecRows({ quantization: 'Q4_K_M' }, { quantization: 'Q8_0' });
  const row = rows.find(r => r.label === 'Quantization');
  assert.equal(row.differs, true);
});

test('buildSpecRows: marks identical values as not differing', () => {
  const rows = buildSpecRows({ family: 'Llama' }, { family: 'Llama' });
  const row = rows.find(r => r.label === 'Family');
  assert.equal(row.differs, false);
});

test('buildSpecRows: formats context length for both sides', () => {
  const rows = buildSpecRows({ context_length: 8192 }, { context_length: 131072 });
  const row = rows.find(r => r.label === 'Context window');
  assert.equal(row.a, '8K tokens');
  assert.equal(row.b, '128K tokens');
});

test('buildSpecRows: preserves declared field order', () => {
  const rows = buildSpecRows(
    { owned_by: 'ollama', parameter_size: '7B', context_length: 8192, quantization: 'Q4_K_M', size_label: '4.1GB', family: 'Llama', license: 'Apache 2.0' },
    {}
  );
  assert.deepEqual(rows.map(r => r.label), [
    'Provider', 'Parameters', 'Context window', 'Quantization', 'Size on disk', 'Family', 'License',
  ]);
});

test('buildSpecRows: handles missing metadata objects gracefully', () => {
  assert.doesNotThrow(() => buildSpecRows(undefined, { parameter_size: '3B' }));
});
