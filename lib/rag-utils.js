'use strict';

/**
 * Split text into overlapping chunks by paragraph/sentence heuristic.
 *
 * @param {string} text
 * @param {number} chunkSize   - target max chars per chunk (positive integer)
 * @param {number} overlap     - chars to carry over between chunks (0 <= overlap < chunkSize)
 * @returns {string[]}
 */
function chunkText(text, chunkSize, overlap) {
  if (!Number.isInteger(chunkSize) || chunkSize <= 0) {
    throw new Error('chunkSize must be a positive integer');
  }
  if (!Number.isInteger(overlap) || overlap < 0 || overlap >= chunkSize) {
    throw new Error('overlap must be an integer in [0, chunkSize)');
  }
  const clean = text.replace(/\r\n/g, '\n').trim();
  if (!clean) return [];
  if (clean.length <= chunkSize) return [clean];

  const paragraphs = clean.split(/\n\n+/);
  const chunks = [];
  let current = '';

  for (const p of paragraphs) {
    if ((current + '\n\n' + p).length > chunkSize && current) {
      chunks.push(current.trim());
      current = current.slice(Math.max(0, current.length - overlap)) + '\n\n' + p;
    } else {
      current = current ? current + '\n\n' + p : p;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  // Hard-split any chunk that's still too big
  const step = chunkSize - overlap;
  const finalChunks = [];
  for (const c of chunks) {
    if (c.length <= chunkSize * 1.5) {
      finalChunks.push(c);
    } else {
      for (let i = 0; i < c.length; i += step) {
        finalChunks.push(c.slice(i, i + chunkSize));
      }
    }
  }
  return finalChunks;
}

/**
 * Cosine similarity between two numeric vectors.
 *
 * @param {number[]} a
 * @param {number[]} b
 * @returns {number} similarity in [0, 1], or 0 if either vector is zero-length
 */
function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Rank chunks from one or more collections against a query embedding, merging
 * and re-sorting by score so results can span multiple collections at once.
 *
 * @param {Array<{id?: string, name?: string, chunks?: Array<{id, source, text, embedding}>}>} collections
 * @param {number[]} queryEmbedding
 * @param {number} topK
 * @returns {Array<{id, source, text, score, collectionId, collectionName}>}
 */
function rankChunks(collections, queryEmbedding, topK) {
  const scored = [];
  for (const col of collections) {
    for (const chunk of col.chunks || []) {
      scored.push({
        id:             chunk.id,
        source:         chunk.source,
        text:           chunk.text,
        score:          cosine(queryEmbedding, chunk.embedding),
        collectionId:   col.id,
        collectionName: col.name,
      });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

/**
 * Aggregate knowledge-base stats across all RAG collections.
 *
 * @param {Array<{chunks?: Array<{source?: string}>, updatedAt?: number, createdAt?: number}>} collections
 * @returns {{ totalCollections: number, totalChunks: number, totalSources: number, lastUpdated: number|null }}
 */
function computeStats(collections) {
  const sources = new Set();
  let totalChunks = 0;
  let lastUpdated = null;

  for (const col of collections) {
    const chunks = col.chunks || [];
    totalChunks += chunks.length;
    for (const chunk of chunks) {
      if (chunk.source) sources.add(chunk.source);
    }
    const stamp = col.updatedAt ?? col.createdAt;
    if (typeof stamp === 'number' && (lastUpdated === null || stamp > lastUpdated)) {
      lastUpdated = stamp;
    }
  }

  return {
    totalCollections: collections.length,
    totalChunks,
    totalSources: sources.size,
    lastUpdated,
  };
}

module.exports = { chunkText, cosine, computeStats, rankChunks };
