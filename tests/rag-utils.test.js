'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chunkText, cosine } = require('../lib/rag-utils.js');

// ── cosine similarity ──────────────────────────────────────────────────────

test('cosine: identical vectors → 1', () => {
  const v = [1, 2, 3];
  assert.ok(Math.abs(cosine(v, v) - 1) < 1e-10);
});

test('cosine: orthogonal vectors → 0', () => {
  assert.ok(Math.abs(cosine([1, 0], [0, 1])) < 1e-10);
});

test('cosine: opposite vectors → -1', () => {
  assert.ok(Math.abs(cosine([1, 0], [-1, 0]) - (-1)) < 1e-10);
});

test('cosine: zero vector → 0', () => {
  assert.equal(cosine([0, 0, 0], [1, 2, 3]), 0);
  assert.equal(cosine([1, 2, 3], [0, 0, 0]), 0);
});

test('cosine: handles vectors of different length (uses min)', () => {
  // Only the first dimension overlaps: [1]·[1] = 1, norms = 1
  const result = cosine([1, 100, 100], [1]);
  assert.ok(result > 0);
});

test('cosine: known values', () => {
  // [3,4] vs [4,3]: dot=24, |a|=5, |b|=5 → 24/25 = 0.96
  assert.ok(Math.abs(cosine([3, 4], [4, 3]) - 0.96) < 1e-10);
});

// ── chunkText ─────────────────────────────────────────────────────────────

test('chunkText: empty string → []', () => {
  assert.deepEqual(chunkText('', 800, 100), []);
  assert.deepEqual(chunkText('   ', 800, 100), []);
});

test('chunkText: short text → single chunk', () => {
  const text = 'Hello world.';
  const result = chunkText(text, 800, 100);
  assert.equal(result.length, 1);
  assert.equal(result[0], text);
});

test('chunkText: text at exactly chunk size → single chunk', () => {
  const text = 'a'.repeat(800);
  const result = chunkText(text, 800, 100);
  assert.equal(result.length, 1);
});

test('chunkText: multiple paragraphs split correctly', () => {
  const para1 = 'First paragraph with some content.';
  const para2 = 'Second paragraph with different content.';
  const para3 = 'Third paragraph.';
  const text = `${para1}\n\n${para2}\n\n${para3}`;

  // Small chunk size forces splits
  const result = chunkText(text, 50, 10);
  assert.ok(result.length > 1, 'Should produce multiple chunks');
  // Every character of the original text appears in at least one chunk
  for (const para of [para1, para2, para3]) {
    const found = result.some(c => c.includes(para.slice(0, 10)));
    assert.ok(found, `Chunk should contain text from: ${para.slice(0, 20)}`);
  }
});

test('chunkText: huge single paragraph gets hard-split', () => {
  // 3000-char single paragraph with no double-newlines
  const text = 'x'.repeat(3000);
  const result = chunkText(text, 800, 100);
  assert.ok(result.length > 1, 'Should hard-split oversized paragraph');
  // Each chunk should be at most 1.5× chunk size
  for (const c of result) {
    assert.ok(c.length <= 800 * 1.5, `Chunk too large: ${c.length}`);
  }
});

test('chunkText: normalises \\r\\n to \\n', () => {
  const text = 'Line one\r\n\r\nLine two';
  const result = chunkText(text, 800, 100);
  assert.equal(result.length, 1);
  assert.ok(result[0].includes('Line one'));
  assert.ok(result[0].includes('Line two'));
});
