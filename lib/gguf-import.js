'use strict';

const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');
const http   = require('http');

const MODEL_NAME_RE = /^[a-zA-Z0-9_.:/\-]+$/;
const DEFAULT_MAX_GGUF_BYTES = 100 * 1024 * 1024 * 1024; // 100 GiB — GGUF quants of 70B+ models can be 40-70GB
const DEFAULT_UPLOAD_TIMEOUT_MS = 30 * 60 * 1000;         // blob upload of a huge file needs a long timeout
const DEFAULT_CREATE_TIMEOUT_MS = 5 * 60 * 1000;           // Ollama parsing GGUF metadata + writing a manifest

/**
 * Same shape as the existing `/v1/models/pull` name validator — Ollama model
 * names are `name[:tag]`, optionally namespaced.
 *
 * @param {string} name
 * @returns {boolean}
 */
function isValidModelName(name) {
  return typeof name === 'string' && name.trim().length > 0 && MODEL_NAME_RE.test(name.trim());
}

/**
 * A GGUF filename is only ever used as a map key sent to Ollama's
 * `/api/create` — it never touches the filesystem as a path — but it's
 * still validated and reduced to a safe basename so a client can't smuggle
 * `../` segments or control characters into that map.
 *
 * @param {string} filename
 * @returns {boolean}
 */
function isValidGgufFilename(filename) {
  if (typeof filename !== 'string') return false;
  const base = path.basename(filename.trim());
  return base.length > 0 && base === filename.trim() && /\.gguf$/i.test(base);
}

/**
 * Stream an incoming request body to a temp file on disk while incrementally
 * hashing it, so a multi-gigabyte GGUF upload never has to sit in memory.
 * Enforces `maxBytes` mid-stream (destroys the request and cleans up the
 * partial file rather than buffering an unbounded upload to disk).
 *
 * @param {NodeJS.ReadableStream} readable - the incoming request stream
 * @param {string} destPath - path to write the file to
 * @param {{maxBytes?: number}} [opts]
 * @returns {Promise<{bytes: number, digest: string}>} digest is a bare hex sha256 (no `sha256:` prefix)
 */
function streamToFileWithHash(readable, destPath, opts = {}) {
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_GGUF_BYTES;
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const out  = fs.createWriteStream(destPath);
    let bytes  = 0;
    let settled = false;

    const cleanupAndReject = (err) => {
      if (settled) return;
      settled = true;
      try { readable.destroy(); } catch {}
      try { out.destroy(); } catch {}
      fs.rm(destPath, { force: true }, () => reject(err));
    };

    readable.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > maxBytes) {
        cleanupAndReject(new Error(`File exceeds the ${Math.round(maxBytes / (1024 * 1024 * 1024))}GB import limit`));
        return;
      }
      hash.update(chunk);
    });
    readable.on('error', cleanupAndReject);
    out.on('error', cleanupAndReject);
    out.on('close', () => {
      if (settled) return;
      settled = true;
      resolve({ bytes, digest: hash.digest('hex') });
    });

    readable.pipe(out);
  });
}

/**
 * Upload a blob to Ollama's content-addressed blob store ahead of
 * `/api/create` — this is how Ollama accepts a raw GGUF file rather than a
 * model name to pull. Streams the file from disk rather than buffering it.
 *
 * @param {{host: string, port: number}} ollamaCfg
 * @param {string} filePath
 * @param {string} digest - bare hex sha256, as returned by streamToFileWithHash
 * @param {{timeoutMs?: number}} [opts]
 * @returns {Promise<void>}
 */
function uploadBlob(ollamaCfg, filePath, digest, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_UPLOAD_TIMEOUT_MS;
  return new Promise((resolve, reject) => {
    const size = fs.statSync(filePath).size;
    const req = http.request({
      hostname: ollamaCfg.host, port: ollamaCfg.port,
      path: `/api/blobs/sha256:${digest}`, method: 'POST',
      headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': size },
      timeout: timeoutMs,
    }, (res) => {
      let buf = '';
      res.on('data', (c) => (buf += c));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve();
        else reject(new Error(`Ollama rejected the blob upload (HTTP ${res.statusCode}): ${buf.slice(0, 300)}`));
      });
    });
    req.on('error', (e) => reject(new Error(`Cannot reach Ollama: ${e.message}`)));
    req.on('timeout', () => { req.destroy(new Error('Blob upload to Ollama timed out')); });
    const readStream = fs.createReadStream(filePath);
    readStream.on('error', reject);
    readStream.pipe(req);
  });
}

/**
 * Register the uploaded blob as a named Ollama model via `POST /api/create`.
 * Uses `stream: false` so this resolves with a single JSON object instead of
 * needing to parse an NDJSON progress stream — the blob upload above is
 * already the slow part; model creation from an already-uploaded blob is
 * comparatively fast (metadata parsing + manifest write).
 *
 * @param {{host: string, port: number}} ollamaCfg
 * @param {string} modelName
 * @param {string} filename
 * @param {string} digest - bare hex sha256
 * @param {{timeoutMs?: number}} [opts]
 * @returns {Promise<void>}
 */
function createModel(ollamaCfg, modelName, filename, digest, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_CREATE_TIMEOUT_MS;
  const body = JSON.stringify({
    model: modelName,
    files: { [filename]: `sha256:${digest}` },
    stream: false,
  });
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: ollamaCfg.host, port: ollamaCfg.port,
      path: '/api/create', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
      timeout: timeoutMs,
    }, (res) => {
      let buf = '';
      res.on('data', (c) => (buf += c));
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(buf); } catch { parsed = { status: buf }; }
        if (parsed.error) { reject(new Error(parsed.error)); return; }
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(parsed);
        else reject(new Error(`Ollama model creation failed (HTTP ${res.statusCode}): ${buf.slice(0, 300)}`));
      });
    });
    req.on('error', (e) => reject(new Error(`Cannot reach Ollama: ${e.message}`)));
    req.on('timeout', () => { req.destroy(new Error('Model creation timed out')); });
    req.write(body);
    req.end();
  });
}

module.exports = {
  isValidModelName,
  isValidGgufFilename,
  streamToFileWithHash,
  uploadBlob,
  createModel,
  DEFAULT_MAX_GGUF_BYTES,
};
