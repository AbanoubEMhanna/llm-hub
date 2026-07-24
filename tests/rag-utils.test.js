'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chunkText, cosine, computeStats, rankChunks, removeChunk, replaceChunkText, tokenize, bm25Scores, hybridRankChunks } = require('../lib/rag-utils.js');

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

// ── removeChunk ─────────────────────────────────────────────────────────────

test('removeChunk: removes the matching chunk by id', () => {
  const chunks = [{ id: '1', text: 'a' }, { id: '2', text: 'b' }, { id: '3', text: 'c' }];
  const { found, chunks: next } = removeChunk(chunks, '2');
  assert.equal(found, true);
  assert.deepEqual(next.map(c => c.id), ['1', '3']);
});

test('removeChunk: does not mutate the input array', () => {
  const chunks = [{ id: '1' }, { id: '2' }];
  const original = chunks.slice();
  removeChunk(chunks, '1');
  assert.deepEqual(chunks, original);
});

test('removeChunk: not found → found:false, same chunks returned', () => {
  const chunks = [{ id: '1' }];
  const result = removeChunk(chunks, 'missing');
  assert.equal(result.found, false);
  assert.equal(result.chunks, chunks);
});

test('removeChunk: handles undefined/empty chunk list', () => {
  assert.equal(removeChunk(undefined, '1').found, false);
  assert.deepEqual(removeChunk(undefined, '1').chunks, []);
  assert.equal(removeChunk([], '1').found, false);
});

// ── replaceChunkText ────────────────────────────────────────────────────────

test('replaceChunkText: updates text of the matching chunk, preserves other fields', () => {
  const chunks = [{ id: '1', source: 'a.md', text: 'old', embedding: [1, 2] }];
  const { found, chunks: next } = replaceChunkText(chunks, '1', 'new text');
  assert.equal(found, true);
  assert.equal(next[0].text, 'new text');
  assert.equal(next[0].source, 'a.md');
  assert.deepEqual(next[0].embedding, [1, 2]);
});

test('replaceChunkText: does not mutate the input array or chunk objects', () => {
  const original = { id: '1', text: 'old' };
  const chunks = [original];
  replaceChunkText(chunks, '1', 'new');
  assert.equal(chunks[0].text, 'old');
  assert.equal(original.text, 'old');
});

test('replaceChunkText: not found → found:false, same chunks returned', () => {
  const chunks = [{ id: '1', text: 'old' }];
  const result = replaceChunkText(chunks, 'missing', 'new');
  assert.equal(result.found, false);
  assert.equal(result.chunks, chunks);
});

test('replaceChunkText: only the targeted chunk changes among many', () => {
  const chunks = [{ id: '1', text: 'a' }, { id: '2', text: 'b' }, { id: '3', text: 'c' }];
  const { chunks: next } = replaceChunkText(chunks, '2', 'B!');
  assert.deepEqual(next.map(c => c.text), ['a', 'B!', 'c']);
});

// ── tokenize ─────────────────────────────────────────────────────────────────

test('tokenize: lowercases and splits on non-alphanumeric', () => {
  assert.deepEqual(tokenize('Hello, World! v2.0'), ['hello', 'world', 'v2', '0']);
});

test('tokenize: null/undefined/empty → []', () => {
  assert.deepEqual(tokenize(null), []);
  assert.deepEqual(tokenize(undefined), []);
  assert.deepEqual(tokenize(''), []);
});

// ── bm25Scores ───────────────────────────────────────────────────────────────

test('bm25Scores: doc containing the query term outranks one without it', () => {
  const docs = ['the quick brown fox', 'a lazy dog sleeps'];
  const scores = bm25Scores('fox', docs);
  assert.ok(scores[0] > 0);
  assert.equal(scores[1], 0);
});

test('bm25Scores: no query terms → all zero', () => {
  const docs = ['alpha beta', 'gamma delta'];
  assert.deepEqual(bm25Scores('', docs), [0, 0]);
});

test('bm25Scores: empty doc list → []', () => {
  assert.deepEqual(bm25Scores('fox', []), []);
});

test('bm25Scores: rarer matched term scores higher than a term common to every doc', () => {
  const docs = ['common word apple', 'common word banana', 'common word cherry unique'];
  const [common, , unique] = [
    bm25Scores('common', docs)[0],
    null,
    bm25Scores('unique', docs)[2],
  ];
  assert.ok(unique > common);
});

// ── hybridRankChunks ─────────────────────────────────────────────────────────

function makeCol(id, chunks) {
  return { id, name: id, chunks };
}

test('hybridRankChunks: keyword match surfaces a chunk that pure vector search would miss', () => {
  const collections = [makeCol('c1', [
    { id: 'a', source: 's', text: 'completely unrelated filler text', embedding: [1, 0] },
    { id: 'b', source: 's', text: 'the answer contains the word xylophone', embedding: [0, 1] },
  ])];
  // Query embedding points at chunk 'a', but the query text keyword-matches chunk 'b'.
  const results = hybridRankChunks(collections, [1, 0], 'xylophone', 5, 0.3);
  assert.equal(results[0].id, 'b');
});

test('hybridRankChunks: alpha=1 behaves like pure vector rankChunks', () => {
  const collections = [makeCol('c1', [
    { id: 'a', source: 's', text: 'xylophone xylophone xylophone', embedding: [1, 0] },
    { id: 'b', source: 's', text: 'no keyword here', embedding: [0, 1] },
  ])];
  const results = hybridRankChunks(collections, [1, 0], 'xylophone', 5, 1);
  assert.equal(results[0].id, 'a');
  assert.equal(results[0].score, 1); // pure cosine, no BM25 contribution
});

test('hybridRankChunks: skips chunks with mismatched embedding dimensions', () => {
  const collections = [makeCol('c1', [
    { id: 'a', source: 's', text: 'match', embedding: [1, 0, 0] },
    { id: 'b', source: 's', text: 'match', embedding: [1, 0] },
  ])];
  const results = hybridRankChunks(collections, [1, 0], 'match', 5);
  assert.equal(results.length, 1);
  assert.equal(results[0].id, 'b');
});

test('hybridRankChunks: no candidates → []', () => {
  assert.deepEqual(hybridRankChunks([makeCol('c1', [])], [1, 0], 'query', 5), []);
});

test('hybridRankChunks: respects topK', () => {
  const collections = [makeCol('c1', [
    { id: '1', source: 's', text: 'a', embedding: [1, 0] },
    { id: '2', source: 's', text: 'b', embedding: [0.9, 0.1] },
    { id: '3', source: 's', text: 'c', embedding: [0.1, 0.9] },
  ])];
  const results = hybridRankChunks(collections, [1, 0], 'query with no matches', 2);
  assert.equal(results.length, 2);
});

test('hybridRankChunks: output shape matches rankChunks (no leaked internal vectorScore field)', () => {
  const collections = [makeCol('c1', [{ id: '1', source: 's', text: 'text', embedding: [1, 0] }])];
  const [result] = hybridRankChunks(collections, [1, 0], 'text', 5);
  assert.deepEqual(Object.keys(result).sort(), ['collectionId', 'collectionName', 'id', 'score', 'source', 'text'].sort());
});
