'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chunkText, cosine, computeStats, rankChunks } = require('../lib/rag-utils.js');

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

// ── computeStats ────────────────────────────────────────────────────────────

test('computeStats: empty collections list', () => {
  assert.deepEqual(computeStats([]), {
    totalCollections: 0, totalChunks: 0, totalSources: 0, lastUpdated: null,
  });
});

test('computeStats: sums chunks and de-dupes sources within and across collections', () => {
  const collections = [
    { chunks: [{ source: 'a.md' }, { source: 'a.md' }, { source: 'b.md' }], updatedAt: 100 },
    { chunks: [{ source: 'b.md' }, { source: 'c.md' }], updatedAt: 200 },
  ];
  const stats = computeStats(collections);
  assert.equal(stats.totalCollections, 2);
  assert.equal(stats.totalChunks, 5);
  assert.equal(stats.totalSources, 3); // a.md, b.md, c.md
  assert.equal(stats.lastUpdated, 200);
});

test('computeStats: falls back to createdAt when updatedAt is missing', () => {
  const collections = [{ chunks: [], createdAt: 50 }, { chunks: [], createdAt: 75 }];
  assert.equal(computeStats(collections).lastUpdated, 75);
});

test('computeStats: collection with no chunks contributes zero, not NaN', () => {
  const stats = computeStats([{ chunks: [] }, { chunks: undefined }]);
  assert.equal(stats.totalChunks, 0);
  assert.equal(stats.totalSources, 0);
});

test('computeStats: chunks without a source are not counted as sources', () => {
  const stats = computeStats([{ chunks: [{}, { source: '' }, { source: 'x' }] }]);
  assert.equal(stats.totalChunks, 3);
  assert.equal(stats.totalSources, 1);
});

// ── rankChunks ──────────────────────────────────────────────────────────────

test('rankChunks: empty collections → []', () => {
  assert.deepEqual(rankChunks([], [1, 0], 5), []);
});

test('rankChunks: merges and sorts chunks across multiple collections by score', () => {
  const collections = [
    { id: 'a', name: 'Alpha', chunks: [
      { id: 'a1', source: 'a.md', text: 'low match', embedding: [0, 1] },
    ] },
    { id: 'b', name: 'Beta', chunks: [
      { id: 'b1', source: 'b.md', text: 'high match', embedding: [1, 0] },
      { id: 'b2', source: 'b2.md', text: 'mid match', embedding: [1, 1] },
    ] },
  ];
  const results = rankChunks(collections, [1, 0], 5);
  assert.equal(results.length, 3);
  assert.equal(results[0].id, 'b1');
  assert.equal(results[0].collectionId, 'b');
  assert.equal(results[0].collectionName, 'Beta');
  // Descending score order
  for (let i = 1; i < results.length; i++) {
    assert.ok(results[i - 1].score >= results[i].score);
  }
});

test('rankChunks: respects topK across the merged set, not per collection', () => {
  const collections = [
    { id: 'a', chunks: [{ id: '1', embedding: [1, 0] }, { id: '2', embedding: [1, 0] }] },
    { id: 'b', chunks: [{ id: '3', embedding: [1, 0] }, { id: '4', embedding: [1, 0] }] },
  ];
  const results = rankChunks(collections, [1, 0], 2);
  assert.equal(results.length, 2);
});

test('rankChunks: collection with no chunks contributes nothing', () => {
  const collections = [{ id: 'a', chunks: [] }, { id: 'b', chunks: undefined }];
  assert.deepEqual(rankChunks(collections, [1, 0], 5), []);
});

test('rankChunks: skips chunks whose embedding dimension does not match the query (mixed embedding models)', () => {
  const collections = [
    { id: 'a', name: 'OldModel', chunks: [
      { id: 'a1', source: 'a.md', text: 'stale dims', embedding: [1, 0, 0] }, // 3-dim, incompatible
    ] },
    { id: 'b', name: 'NewModel', chunks: [
      { id: 'b1', source: 'b.md', text: 'matching dims', embedding: [1, 0] },
    ] },
  ];
  const results = rankChunks(collections, [1, 0], 5); // 2-dim query
  assert.equal(results.length, 1);
  assert.equal(results[0].id, 'b1');
});

test('rankChunks: skips chunks with a missing or malformed embedding', () => {
  const collections = [{ id: 'a', chunks: [{ id: '1', embedding: null }, { id: '2' }, { id: '3', embedding: [1, 0] }] }];
  const results = rankChunks(collections, [1, 0], 5);
  assert.equal(results.length, 1);
  assert.equal(results[0].id, '3');
});
