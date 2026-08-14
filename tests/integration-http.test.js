'use strict';

// Integration tests — spawn the real proxy.js as a child process and hit its
// HTTP endpoints over the network. Unlike the other tests/*.test.js files
// (which unit-test lib/*.js in-process), proxy.js has no exported app/handler
// and starts listening as a side effect of being required, so a child process
// is the only clean way to exercise the actual router end-to-end.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const http = require('node:http');
const net = require('node:net');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');

const REPO_ROOT = path.join(__dirname, '..');
const REQUEST_TIMEOUT_MS = 10000;
const STORAGE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-hub-inttest-'));

let PORT;
let BASE_URL;
let child;

// Ask the OS for a free ephemeral port instead of guessing one — a port
// derived from process.pid isn't reserved and can collide with another
// process. There's a small window between close() and the child binding it,
// but that's the standard "find a free port" pattern and far more reliable
// than a fixed/derived guess.
function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

// Every fetch in this file goes through this helper so a stuck response
// (child accepts the connection but never replies) can't hang the test run
// indefinitely — it aborts and the test fails instead of timing out node:test.
async function request(pathname, opts = {}) {
  const res = await fetch(`${BASE_URL}${pathname}`, {
    ...opts,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  return res;
}

async function requestJSON(pathname, opts = {}) {
  const res = await request(pathname, opts);
  const body = await res.json();
  return { res, body };
}

function postJSON(pathname, body) {
  return requestJSON(pathname, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function waitForReady(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await request('/health', { signal: AbortSignal.timeout(2000) });
      if (res.status === 200) { await res.body?.cancel?.(); return; }
      await res.body?.cancel?.();
    } catch { /* server not up yet, or this particular probe timed out */ }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error('proxy.js did not become ready in time');
}

before(async () => {
  PORT = await getFreePort();
  BASE_URL = `http://127.0.0.1:${PORT}`;
  child = spawn(process.execPath, ['proxy.js'], {
    cwd: REPO_ROOT,
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', STORAGE_DIR },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  // Drain both pipes so the child never blocks writing to them; content isn't
  // asserted on, it's just there to inspect manually if a test run misbehaves.
  child.stdout.on('data', () => {});
  child.stderr.on('data', () => {});
  await waitForReady();
});

after(async () => {
  if (child && child.exitCode === null && child.signalCode === null) {
    await new Promise((resolve) => {
      child.once('close', resolve);
      child.kill();
    });
  }
  fs.rmSync(STORAGE_DIR, { recursive: true, force: true });
});

// ── Read-only endpoints — no provider configuration required ──────────────

test('GET /health returns proxy status', async () => {
  const { res, body } = await requestJSON('/health');
  assert.equal(res.status, 200);
  assert.equal(body.proxy, 'running');
  assert.equal(typeof body.providers, 'object');
  assert.equal(typeof body.tools, 'object');
  assert.equal(typeof body.rag, 'object');
});

test('GET /v1/models returns a model list envelope', async () => {
  const { res, body } = await requestJSON('/v1/models');
  assert.equal(res.status, 200);
  assert.equal(body.object, 'list');
  assert.ok(Array.isArray(body.data));
});

// ── AI21: no /models discovery endpoint, so its catalog is a static list
// injected only when a key is configured — never fetched over the network.

test('GET /v1/models omits AI21 models with no API key configured', async () => {
  const { body } = await requestJSON('/v1/models');
  assert.ok(!body.data.some((m) => m.id.startsWith('ai21/')));
});

test('GET /v1/models includes the static AI21 catalog once a key is configured', async () => {
  const { res, body } = await requestJSON('/v1/models', {
    headers: { 'X-Api-Keys': JSON.stringify({ ai21: 'fake-key' }) },
  });
  assert.equal(res.status, 200);
  const ids = body.data.map((m) => m.id);
  assert.ok(ids.includes('ai21/jamba-large'));
  assert.ok(ids.includes('ai21/jamba-mini'));
});

test('GET /health reports AI21 as no-key with no key, online once one is configured', async () => {
  const noKey = await requestJSON('/health');
  assert.equal(noKey.body.providers.ai21, 'no-key');

  const withKey = await requestJSON('/health', {
    headers: { 'X-Api-Keys': JSON.stringify({ ai21: 'fake-key' }) },
  });
  // AI21 has no free endpoint to verify the key against every 30s, so a
  // configured key is reported "online" without a live network check.
  assert.equal(withKey.body.providers.ai21, 'online');
});

test('GET /v1/tools returns the tool registry status', async () => {
  const { res, body } = await requestJSON('/v1/tools');
  assert.equal(res.status, 200);
  assert.equal(typeof body.total, 'number');
  assert.ok(Array.isArray(body.tools));
});

test('GET /v1/system returns memory/cpu info and running models', async () => {
  const { res, body } = await requestJSON('/v1/system');
  assert.equal(res.status, 200);
  assert.equal(typeof body.system.memory.total, 'number');
  assert.equal(typeof body.system.cpus, 'number');
  assert.ok(Array.isArray(body.running_models));
});

test('GET /v1/models/running returns no models with no backend running', async () => {
  const { res, body } = await requestJSON('/v1/models/running');
  assert.equal(res.status, 200);
  assert.deepEqual(body.models, []);
});

test('GET /v1/models/updates reports the check as unrun (not "up to date") with no Ollama backend', async () => {
  // No local models to compare means no registry calls are made at all —
  // this stays offline-safe and doesn't depend on reaching registry.ollama.ai.
  // ollama_reachable: false / checked: 0 is what lets the UI distinguish this
  // from "checked N models, none need an update".
  const { res, body } = await requestJSON('/v1/models/updates');
  assert.equal(res.status, 200);
  assert.deepEqual(body.updates, []);
  assert.equal(body.checked, 0);
  assert.equal(body.lookup_failures, 0);
  assert.equal(body.ollama_reachable, false);
});

test('GET /v1/config echoes the loaded config', async () => {
  const { res, body } = await requestJSON('/v1/config');
  assert.equal(res.status, 200);
  assert.equal(typeof body.providers, 'object');
  assert.equal(typeof body.tools, 'object');
});

test('POST /v1/config rejects a body missing providers/tools', async () => {
  const { res, body } = await postJSON('/v1/config', { nonsense: true });
  assert.equal(res.status, 400);
  assert.match(body.error, /providers \+ tools required/);
});

test('GET /v1/openapi.json returns a valid OpenAPI document', async () => {
  const { res, body } = await requestJSON('/v1/openapi.json');
  assert.equal(res.status, 200);
  assert.ok(body.openapi);
  assert.equal(typeof body.paths, 'object');
});

test('GET /v1/docs serves the Swagger UI page', async () => {
  const res = await request('/v1/docs');
  const html = await res.text();
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /text\/html/);
  assert.match(html, /swagger-ui/);
});

test('GET /v1/logs is empty by default (logging.enabled is false)', async () => {
  const { res, body } = await requestJSON('/v1/logs');
  assert.equal(res.status, 200);
  assert.equal(body.enabled, false);
  assert.deepEqual(body.entries, []);
});

test('DELETE /v1/logs clears the request log', async () => {
  const { res, body } = await requestJSON('/v1/logs', { method: 'DELETE' });
  assert.equal(res.status, 200);
  assert.equal(body.cleared, true);
});

test('GET /v1/agent-runs is empty by default (agentHistory.enabled is false)', async () => {
  const { res, body } = await requestJSON('/v1/agent-runs');
  assert.equal(res.status, 200);
  assert.equal(body.enabled, false);
  assert.deepEqual(body.entries, []);
});

test('DELETE /v1/agent-runs clears the agent history', async () => {
  const res = await request('/v1/agent-runs', { method: 'DELETE' });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.cleared, true);
});

test('GET /v1/rag/collections returns an empty collection list', async () => {
  const { res, body } = await requestJSON('/v1/rag/collections');
  assert.equal(res.status, 200);
  assert.deepEqual(body.collections, []);
});

test('GET /v1/rag/stats returns zeroed stats for a fresh storage dir', async () => {
  const { res, body } = await requestJSON('/v1/rag/stats');
  assert.equal(res.status, 200);
  assert.equal(body.totalCollections, 0);
  assert.equal(body.totalChunks, 0);
  assert.equal(body.totalSources, 0);
  assert.equal(body.lastUpdated, null);
});

test('GET /v1/audio/status reports browser mode when Whisper is disabled', async () => {
  const { res, body } = await requestJSON('/v1/audio/status');
  assert.equal(res.status, 200);
  assert.deepEqual(body, { enabled: false, mode: 'browser' });
});

// ── RAG collection / chunk routes on a nonexistent id — no seed data needed ─

test('GET /v1/rag/collections/:id 404s for an unknown collection', async () => {
  const { res, body } = await requestJSON('/v1/rag/collections/no-such-collection');
  assert.equal(res.status, 404);
  assert.equal(body.error, 'not found');
});

test('DELETE /v1/rag/collections/:id is idempotent for an unknown collection', async () => {
  const { res, body } = await requestJSON('/v1/rag/collections/no-such-collection', { method: 'DELETE' });
  assert.equal(res.status, 200);
  assert.equal(body.ok, true);
});

test('GET /v1/rag/collections/:id/chunks/:chunkId 404s for an unknown chunk', async () => {
  const { res, body } = await requestJSON('/v1/rag/collections/no-such-collection/chunks/no-such-chunk');
  assert.equal(res.status, 404);
  assert.equal(body.error, 'chunk not found');
});

test('DELETE /v1/rag/collections/:id/chunks/:chunkId 404s for an unknown chunk', async () => {
  const { res, body } = await requestJSON('/v1/rag/collections/no-such-collection/chunks/no-such-chunk', { method: 'DELETE' });
  assert.equal(res.status, 404);
  assert.equal(body.error, 'chunk not found');
});

test('PUT /v1/rag/collections/:id/chunks/:chunkId rejects an empty text body', async () => {
  const { res, body } = await requestJSON('/v1/rag/collections/no-such-collection/chunks/no-such-chunk', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: '   ' }),
  });
  assert.equal(res.status, 400);
  assert.equal(body.error, 'text is required');
});

test('POST /v1/rag/query with no collections returns empty results', async () => {
  const { res, body } = await postJSON('/v1/rag/query', { query: 'anything' });
  assert.equal(res.status, 200);
  assert.deepEqual(body.results, []);
});

test('POST /v1/rag/upload rejects a body missing source/text', async () => {
  const { res, body } = await postJSON('/v1/rag/upload', { collection_name: 'x' });
  assert.equal(res.status, 400);
  assert.equal(body.error, 'source and text required');
});

test('POST /v1/rag/crawl rejects a missing url', async () => {
  const { res, body } = await postJSON('/v1/rag/crawl', {});
  assert.equal(res.status, 400);
  assert.equal(body.error, 'url required');
});

test('POST /v1/rag/crawl rejects an invalid url', async () => {
  const { res, body } = await postJSON('/v1/rag/crawl', { url: 'not a url' });
  assert.equal(res.status, 400);
  assert.equal(body.error, 'Invalid URL');
});

test('POST /v1/rag/crawl blocks private/local addresses (SSRF guard)', async () => {
  const { res, body } = await postJSON('/v1/rag/crawl', { url: 'http://127.0.0.1/secret' });
  assert.equal(res.status, 400);
  assert.match(body.error, /Blocked: cannot fetch private\/local addresses/);
});

test('POST /v1/rag/github rejects a missing repo_url', async () => {
  const { res, body } = await postJSON('/v1/rag/github', {});
  assert.equal(res.status, 400);
  assert.equal(body.error, 'repo_url required');
});

test('POST /v1/rag/github rejects an invalid repo_url', async () => {
  const { res, body } = await postJSON('/v1/rag/github', { repo_url: 'not a url' });
  assert.equal(res.status, 400);
  assert.equal(body.error, 'Invalid URL');
});

test('POST /v1/rag/github rejects non-http(s) schemes (e.g. file://, ssh://)', async () => {
  const { res, body } = await postJSON('/v1/rag/github', { repo_url: 'file:///etc/passwd' });
  assert.equal(res.status, 400);
  assert.match(body.error, /Unsupported protocol/);
});

test('POST /v1/rag/github blocks private/local addresses (SSRF guard)', async () => {
  const { res, body } = await postJSON('/v1/rag/github', { repo_url: 'http://127.0.0.1/owner/repo' });
  assert.equal(res.status, 400);
  assert.match(body.error, /Blocked: cannot clone from private\/local addresses/);
});

// ── Error paths — well-defined without a real LLM/Ollama/Whisper backend ──

test('POST /v1/chat without model/messages returns 400', async () => {
  const { res, body } = await postJSON('/v1/chat', {});
  assert.equal(res.status, 400);
  assert.match(body.error, /model and messages required/);
});

test('POST /v1/chat/completions with an unknown model returns 404', async () => {
  const { res, body } = await postJSON('/v1/chat/completions', { model: 'definitely-not-a-real-model', messages: [] });
  assert.equal(res.status, 404);
  assert.match(body.error.message, /not found/);
});

test('POST /v1/models/pull rejects a missing model name', async () => {
  const { res, body } = await postJSON('/v1/models/pull', {});
  assert.equal(res.status, 400);
  assert.match(body.error, /Valid model name required/);
});

test('POST /v1/models/import-gguf rejects a missing/invalid model name', async () => {
  const { res, body } = await requestJSON('/v1/models/import-gguf?filename=model.gguf', {
    method: 'POST',
    body: 'irrelevant for this validation path',
  });
  assert.equal(res.status, 400);
  assert.match(body.error, /Valid model name required/);
});

test('POST /v1/models/import-gguf rejects a filename not ending in .gguf', async () => {
  const { res, body } = await requestJSON('/v1/models/import-gguf?name=my-model&filename=model.bin', {
    method: 'POST',
    body: 'irrelevant for this validation path',
  });
  assert.equal(res.status, 400);
  assert.match(body.error, /filename ending in \.gguf/);
});

test('POST /v1/models/import-gguf fails cleanly with no Ollama running', async () => {
  const { res, body } = await requestJSON('/v1/models/import-gguf?name=my-model&filename=model.gguf', {
    method: 'POST',
    body: 'fake gguf bytes for a validation-only upload',
  });
  assert.equal(res.status, 502);
  assert.match(body.error, /Cannot reach Ollama/);
});

// This one needs a real (stub) Ollama to reach, so it spawns its own proxy.js
// child pointed at a throwaway HTTP server via OLLAMA_HOST/OLLAMA_PORT — the
// module-level `child` above deliberately has no Ollama to reach, so every
// other test in this file can rely on that "unreachable" behavior.
test('POST /v1/models/import-gguf succeeds end-to-end against a stub Ollama', async () => {
  const fileContent = 'fake gguf bytes for an end-to-end import test';
  const stubOllama = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      if (req.method === 'POST' && req.url.startsWith('/api/blobs/sha256:')) {
        res.writeHead(201); res.end(); return;
      }
      if (req.method === 'POST' && req.url === '/api/create') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'success' }));
        return;
      }
      res.writeHead(404); res.end();
    });
  });
  await new Promise((resolve) => stubOllama.listen(0, '127.0.0.1', resolve));
  const stubPort = stubOllama.address().port;

  const port2 = await getFreePort();
  const base2 = `http://127.0.0.1:${port2}`;
  const storageDir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-hub-inttest-gguf-'));
  const child2 = spawn(process.execPath, ['proxy.js'], {
    cwd: REPO_ROOT,
    env: {
      ...process.env, PORT: String(port2), HOST: '127.0.0.1', STORAGE_DIR: storageDir2,
      OLLAMA_HOST: '127.0.0.1', OLLAMA_PORT: String(stubPort),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child2.stdout.on('data', () => {});
  child2.stderr.on('data', () => {});

  try {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      try {
        const r = await fetch(`${base2}/health`, { signal: AbortSignal.timeout(2000) });
        await r.body?.cancel?.();
        if (r.status === 200) break;
      } catch { /* not up yet */ }
      await new Promise((r) => setTimeout(r, 150));
    }

    const res = await fetch(`${base2}/v1/models/import-gguf?name=my-model&filename=model.gguf`, {
      method: 'POST',
      body: fileContent,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.deepEqual(body, { ok: true, model: 'my-model', bytes: fileContent.length });
  } finally {
    stubOllama.close();
    if (child2.exitCode === null && child2.signalCode === null) {
      await new Promise((resolve) => { child2.once('close', resolve); child2.kill(); });
    }
    fs.rmSync(storageDir2, { recursive: true, force: true });
  }
});

test('DELETE /v1/models/:name fails cleanly with no Ollama running', async () => {
  const { res, body } = await requestJSON('/v1/models/no-such-model', { method: 'DELETE' });
  assert.equal(res.status, 502);
  assert.match(body.error, /Cannot reach Ollama/);
});

test('POST /v1/audio/transcribe rejects when Whisper is disabled', async () => {
  const { res, body } = await postJSON('/v1/audio/transcribe', {});
  assert.equal(res.status, 400);
  assert.match(body.error, /Whisper not enabled/);
});

// ── Cross-cutting behavior ──────────────────────────────────────────────────

test('OPTIONS preflight returns 204 with CORS headers', async () => {
  const res = await request('/v1/models', { method: 'OPTIONS' });
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('access-control-allow-origin'), '*');
  assert.match(res.headers.get('access-control-allow-methods') || '', /GET/);
});

test('unknown route returns 404 JSON', async () => {
  const { res, body } = await requestJSON('/v1/definitely-not-a-route');
  assert.equal(res.status, 404);
  assert.equal(body.error, 'Not found');
});
