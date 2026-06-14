'use strict';

/**
 * Split text into overlapping chunks by paragraph/sentence heuristic.
 *
 * @param {string} text
 * @param {number} chunkSize   - target max chars per chunk
 * @param {number} overlap     - chars to carry over between chunks
 * @returns {string[]}
 */
function chunkText(text, chunkSize, overlap) {
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
  const finalChunks = [];
  for (const c of chunks) {
    if (c.length <= chunkSize * 1.5) {
      finalChunks.push(c);
    } else {
      for (let i = 0; i < c.length; i += chunkSize - overlap) {
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

module.exports = { chunkText, cosine };
