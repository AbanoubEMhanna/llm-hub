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
 * Chunks whose embedding dimension doesn't match the query embedding are
 * skipped rather than compared — mixing embeddings from different models
 * (e.g. after an `embedding_model` config change) would otherwise silently
 * score against a truncated vector prefix and corrupt the ranking.
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
      if (!Array.isArray(chunk.embedding) || chunk.embedding.length !== queryEmbedding.length) continue;
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
 * Lowercase alphanumeric tokenizer shared by the BM25 scorer.
 *
 * @param {string} text
 * @returns {string[]}
 */
function tokenize(text) {
  return (text || '').toLowerCase().match(/[a-z0-9]+/g) || [];
}

/**
 * Okapi BM25 keyword-relevance score for a query against a list of documents.
 *
 * @param {string} queryText
 * @param {string[]} docs
 * @param {{k1?: number, b?: number}} [opts]
 * @returns {number[]} one score per doc, same order as `docs` (0 if no query terms match)
 */
function bm25Scores(queryText, docs, { k1 = 1.5, b = 0.75 } = {}) {
  const N = docs.length;
  const queryTerms = [...new Set(tokenize(queryText))];
  if (N === 0 || queryTerms.length === 0) return docs.map(() => 0);

  const tfMaps = docs.map(doc => {
    const map = new Map();
    for (const term of tokenize(doc)) map.set(term, (map.get(term) || 0) + 1);
    return map;
  });
  const docLens = tfMaps.map(m => [...m.values()].reduce((a, c) => a + c, 0));
  const avgdl = (docLens.reduce((a, c) => a + c, 0) / N) || 1;

  const idf = {};
  for (const term of queryTerms) {
    const df = tfMaps.filter(m => m.has(term)).length;
    idf[term] = Math.log((N - df + 0.5) / (df + 0.5) + 1);
  }

  return tfMaps.map((tf, i) => {
    const dl = docLens[i];
    let score = 0;
    for (const term of queryTerms) {
      const f = tf.get(term) || 0;
      if (f === 0) continue;
      score += idf[term] * (f * (k1 + 1)) / (f + k1 * (1 - b + b * (dl / avgdl)));
    }
    return score;
  });
}

/**
 * Rank chunks by a blend of vector similarity and BM25 keyword relevance, so
 * exact-term matches surface even when the embedding alone ranks them lower.
 * BM25 scores are min-max normalized against the candidate set (they have no
 * natural upper bound) before being combined with cosine similarity, which is
 * already in [0, 1] for typical embeddings.
 *
 * @param {Array<{id?: string, name?: string, chunks?: Array<{id, source, text, embedding}>}>} collections
 * @param {number[]} queryEmbedding
 * @param {string} queryText
 * @param {number} topK
 * @param {number} [alpha=0.5] - weight given to vector score; (1 - alpha) goes to BM25
 * @returns {Array<{id, source, text, score, collectionId, collectionName}>}
 */
function hybridRankChunks(collections, queryEmbedding, queryText, topK, alpha = 0.5) {
  const candidates = [];
  for (const col of collections) {
    for (const chunk of col.chunks || []) {
      if (!Array.isArray(chunk.embedding) || chunk.embedding.length !== queryEmbedding.length) continue;
      candidates.push({
        id:             chunk.id,
        source:         chunk.source,
        text:           chunk.text,
        vectorScore:    cosine(queryEmbedding, chunk.embedding),
        collectionId:   col.id,
        collectionName: col.name,
      });
    }
  }
  if (!candidates.length) return [];

  const bm25Raw = bm25Scores(queryText, candidates.map(c => c.text));
  const maxBm25 = Math.max(0, ...bm25Raw);
  const scored = candidates.map((c, i) => {
    const keywordScore = maxBm25 > 0 ? bm25Raw[i] / maxBm25 : 0;
    const { vectorScore, ...rest } = c;
    return { ...rest, score: alpha * vectorScore + (1 - alpha) * keywordScore };
  });
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

/**
 * Remove a chunk by id from a chunk list, without mutating the input array.
 *
 * @param {Array<{id: string}>} chunks
 * @param {string} chunkId
 * @returns {{found: boolean, chunks: Array}} the resulting array (unchanged reference if not found)
 */
function removeChunk(chunks, chunkId) {
  const list = chunks || [];
  const idx = list.findIndex(c => c.id === chunkId);
  if (idx === -1) return { found: false, chunks: list };
  const next = list.slice();
  next.splice(idx, 1);
  return { found: true, chunks: next };
}

/**
 * Replace the text of a chunk by id, without mutating the input array.
 * Leaves other fields (id, source, embedding) untouched — callers that change
 * the text are responsible for re-embedding it, since embedding requires an
 * async call to the configured provider.
 *
 * @param {Array<{id: string, text: string}>} chunks
 * @param {string} chunkId
 * @param {string} text
 * @returns {{found: boolean, chunks: Array}} the resulting array (unchanged reference if not found)
 */
function replaceChunkText(chunks, chunkId, text) {
  const list = chunks || [];
  const idx = list.findIndex(c => c.id === chunkId);
  if (idx === -1) return { found: false, chunks: list };
  const next = list.slice();
  next[idx] = { ...next[idx], text };
  return { found: true, chunks: next };
}

/**
 * Whether a collection's chunks were embedded with a different model than
 * the one currently configured for RAG — meaning its vectors live in a
 * different embedding space and comparisons against fresh query embeddings
 * would be meaningless until it's re-embedded.
 *
 * A collection with no recorded embedding model (created before this field
 * existed) is never reported stale — there's nothing to compare against.
 *
 * @param {string|null|undefined} collectionEmbeddingModel
 * @param {string} currentEmbeddingModel
 * @returns {boolean}
 */
function isCollectionStale(collectionEmbeddingModel, currentEmbeddingModel) {
  return !!collectionEmbeddingModel && collectionEmbeddingModel !== currentEmbeddingModel;
}

module.exports = { chunkText, cosine, computeStats, rankChunks, removeChunk, replaceChunkText, tokenize, bm25Scores, hybridRankChunks, isCollectionStale };
