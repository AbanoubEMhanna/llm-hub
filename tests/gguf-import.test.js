'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const http = require('http');
const { PassThrough } = require('stream');

const {
  isValidModelName,
  isValidGgufFilename,
  streamToFileWithHash,
  uploadBlob,
  createModel,
} = require('../lib/gguf-import.js');

// ── isValidModelName ─────────────────────────────────────────────────────────

test('isValidModelName: accepts plain names and name:tag', () => {
  assert.equal(isValidModelName('my-model'), true);
  assert.equal(isValidModelName('my-model:latest'), true);
  assert.equal(isValidModelName('ns/my-model:q4_K_M'), true);
});

test('isValidModelName: rejects empty/whitespace-only names', () => {
  assert.equal(isValidModelName(''), false);
  assert.equal(isValidModelName('   '), false);
  assert.equal(isValidModelName(undefined), false);
});

test('isValidModelName: rejects names with spaces or shell-unsafe characters', () => {
  assert.equal(isValidModelName('my model'), false);
  assert.equal(isValidModelName('my;model'), false);
  assert.equal(isValidModelName('$(rm -rf /)'), false);
});

// ── isValidGgufFilename ──────────────────────────────────────────────────────

test('isValidGgufFilename: accepts a plain .gguf filename', () => {
  assert.equal(isValidGgufFilename('model.Q4_K_M.gguf'), true);
});

test('isValidGgufFilename: is case-insensitive on the extension', () => {
  assert.equal(isValidGgufFilename('model.GGUF'), true);
});

test('isValidGgufFilename: rejects non-.gguf filenames', () => {
  assert.equal(isValidGgufFilename('model.bin'), false);
  assert.equal(isValidGgufFilename('model.gguf.exe'), false);
});

test('isValidGgufFilename: rejects path traversal / embedded path separators', () => {
  assert.equal(isValidGgufFilename('../../etc/passwd.gguf'), false);
  assert.equal(isValidGgufFilename('sub/dir/model.gguf'), false);
});

test('isValidGgufFilename: rejects empty string', () => {
  assert.equal(isValidGgufFilename(''), false);
  assert.equal(isValidGgufFilename('   '), false);
});

// ── streamToFileWithHash ─────────────────────────────────────────────────────

test('streamToFileWithHash: writes the file and computes a matching sha256 digest', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gguf-hash-'));
  const dest = path.join(dir, 'out.bin');
  try {
    const content = crypto.randomBytes(1024 * 64); // 64KB of random data
    const expectedDigest = crypto.createHash('sha256').update(content).digest('hex');

    const src = new PassThrough();
    const resultPromise = streamToFileWithHash(src, dest);
    src.end(content);
    const { bytes, digest } = await resultPromise;

    assert.equal(bytes, content.length);
    assert.equal(digest, expectedDigest);
    assert.ok(fs.existsSync(dest));
    assert.ok(fs.readFileSync(dest).equals(content));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('streamToFileWithHash: rejects and cleans up the partial file once maxBytes is exceeded', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gguf-hash-cap-'));
  const dest = path.join(dir, 'out.bin');
  try {
    const src = new PassThrough();
    const resultPromise = streamToFileWithHash(src, dest, { maxBytes: 100 });
    src.write(Buffer.alloc(50));
    src.write(Buffer.alloc(100)); // pushes total past the 100-byte cap
    src.end();

    await assert.rejects(resultPromise, /exceeds the .*import limit/);
    assert.equal(fs.existsSync(dest), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('streamToFileWithHash: propagates a mid-stream source error and cleans up', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gguf-hash-err-'));
  const dest = path.join(dir, 'out.bin');
  try {
    const src = new PassThrough();
    const resultPromise = streamToFileWithHash(src, dest);
    src.write(Buffer.alloc(10));
    src.destroy(new Error('boom'));

    await assert.rejects(resultPromise, /boom/);
    assert.equal(fs.existsSync(dest), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── uploadBlob / createModel (against a stub HTTP server standing in for
// Ollama's REST API — same "no network, real HTTP round trip" approach as
// the integration-http tests use for the real proxy.js) ────────────────────

function startStubOllama(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function stubCfg(server) {
  return { host: '127.0.0.1', port: server.address().port };
}

test('uploadBlob: resolves when the stub blob endpoint returns 201', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gguf-blob-'));
  const filePath = path.join(dir, 'model.gguf');
  fs.writeFileSync(filePath, 'fake gguf bytes');
  const digest = crypto.createHash('sha256').update('fake gguf bytes').digest('hex');

  let receivedPath;
  const server = await startStubOllama((req, res) => {
    receivedPath = req.url;
    req.on('data', () => {});
    req.on('end', () => { res.writeHead(201); res.end(); });
  });
  try {
    await uploadBlob(stubCfg(server), filePath, digest);
    assert.equal(receivedPath, `/api/blobs/sha256:${digest}`);
  } finally {
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('uploadBlob: rejects when the stub blob endpoint returns a non-2xx status', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gguf-blob-bad-'));
  const filePath = path.join(dir, 'model.gguf');
  fs.writeFileSync(filePath, 'x');
  const server = await startStubOllama((req, res) => {
    req.on('data', () => {});
    req.on('end', () => { res.writeHead(400); res.end('digest mismatch'); });
  });
  try {
    await assert.rejects(
      uploadBlob(stubCfg(server), filePath, 'deadbeef'),
      /HTTP 400/
    );
  } finally {
    server.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('uploadBlob: rejects when Ollama is unreachable', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gguf-blob-unreach-'));
  const filePath = path.join(dir, 'model.gguf');
  fs.writeFileSync(filePath, 'x');
  try {
    // Port 1 is a privileged/unassigned port nothing will be listening on.
    await assert.rejects(
      uploadBlob({ host: '127.0.0.1', port: 1 }, filePath, 'deadbeef'),
      /Cannot reach Ollama/
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('createModel: resolves on a successful stub /api/create response', async () => {
  let receivedBody = '';
  const server = await startStubOllama((req, res) => {
    req.on('data', (c) => (receivedBody += c));
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'success' }));
    });
  });
  try {
    await createModel(stubCfg(server), 'my-model', 'model.gguf', 'deadbeef');
    const parsed = JSON.parse(receivedBody);
    assert.equal(parsed.model, 'my-model');
    assert.deepEqual(parsed.files, { 'model.gguf': 'sha256:deadbeef' });
    assert.equal(parsed.stream, false);
  } finally {
    server.close();
  }
});

test('createModel: rejects when the response body has an error field', async () => {
  const server = await startStubOllama((req, res) => {
    req.on('data', () => {});
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid GGUF file' }));
    });
  });
  try {
    await assert.rejects(
      createModel(stubCfg(server), 'my-model', 'model.gguf', 'deadbeef'),
      /invalid GGUF file/
    );
  } finally {
    server.close();
  }
});
