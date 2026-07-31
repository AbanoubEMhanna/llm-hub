'use strict';

// Integration tests — spawn the real proxy.js as a child process and hit its
// HTTP endpoints over the network. Unlike the other tests/*.test.js files
// (which unit-test lib/*.js in-process), proxy.js has no exported app/handler
// and starts listening as a side effect of being required, so a child process
// is the only clean way to exercise the actual router end-to-end.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');

const REPO_ROOT = path.join(__dirname, '..');
// Distinct from the default 8765 so it never collides with a locally running instance.
const PORT = 18000 + (process.pid % 5000);
const BASE_URL = `http://127.0.0.1:${PORT}`;
const STORAGE_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'llm-hub-inttest-'));

let child;

async function waitForReady(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/health`);
      if (res.status === 200) return;
    } catch { /* server not up yet */ }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error('proxy.js did not become ready in time');
}

before(async () => {
  child = spawn(process.execPath, ['proxy.js'], {
    cwd: REPO_ROOT,
    env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', STORAGE_DIR },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stderr.on('data', () => {}); // avoid unhandled backpressure; not asserted on
  await waitForReady();
});

after(async () => {
  if (child) {
    child.kill();
    await new Promise((r) => child.once('exit', r));
  }
  fs.rmSync(STORAGE_DIR, { recursive: true, force: true });
});

// ── Read-only endpoints — no provider configuration required ──────────────

test('GET /health returns proxy status', async () => {
  const res = await fetch(`${BASE_URL}/health`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.proxy, 'running');
  assert.equal(typeof body.providers, 'object');
  assert.equal(typeof body.tools, 'object');
  assert.equal(typeof body.rag, 'object');
});

test('GET /v1/models returns a model list envelope', async () => {
  const res = await fetch(`${BASE_URL}/v1/models`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.object, 'list');
  assert.ok(Array.isArray(body.data));
});

test('GET /v1/tools returns the tool registry status', async () => {
  const res = await fetch(`${BASE_URL}/v1/tools`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(typeof body.total, 'number');
  assert.ok(Array.isArray(body.tools));
});

test('GET /v1/system returns memory/cpu info and running models', async () => {
  const res = await fetch(`${BASE_URL}/v1/system`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(typeof body.system.memory.total, 'number');
  assert.equal(typeof body.system.cpus, 'number');
  assert.ok(Array.isArray(body.running_models));
});

test('GET /v1/models/running returns an empty list with no backend running', async () => {
  const res = await fetch(`${BASE_URL}/v1/models/running`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(body.models));
});

test('GET /v1/config echoes the loaded config', async () => {
  const res = await fetch(`${BASE_URL}/v1/config`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(typeof body.providers, 'object');
  assert.equal(typeof body.tools, 'object');
});

test('POST /v1/config rejects a body missing providers/tools', async () => {
  const res = await fetch(`${BASE_URL}/v1/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nonsense: true }),
  });
  const body = await res.json();
  assert.equal(res.status, 400);
  assert.match(body.error, /providers \+ tools required/);
});

test('GET /v1/openapi.json returns a valid OpenAPI document', async () => {
  const res = await fetch(`${BASE_URL}/v1/openapi.json`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.ok(body.openapi);
  assert.equal(typeof body.paths, 'object');
});

test('GET /v1/docs serves the Swagger UI page', async () => {
  const res = await fetch(`${BASE_URL}/v1/docs`);
  const html = await res.text();
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type') || '', /text\/html/);
  assert.match(html, /swagger-ui/);
});

test('GET /v1/logs returns the (empty) request log', async () => {
  const res = await fetch(`${BASE_URL}/v1/logs`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(typeof body.enabled, 'boolean');
  assert.ok(Array.isArray(body.entries));
});

test('DELETE /v1/logs clears the request log', async () => {
  const res = await fetch(`${BASE_URL}/v1/logs`, { method: 'DELETE' });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.cleared, true);
});

test('GET /v1/agent-runs returns the (empty) agent history', async () => {
  const res = await fetch(`${BASE_URL}/v1/agent-runs`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(typeof body.enabled, 'boolean');
  assert.ok(Array.isArray(body.entries));
});

test('DELETE /v1/agent-runs clears the agent history', async () => {
  const res = await fetch(`${BASE_URL}/v1/agent-runs`, { method: 'DELETE' });
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.cleared, true);
});

test('GET /v1/rag/collections returns a collection list', async () => {
  const res = await fetch(`${BASE_URL}/v1/rag/collections`);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(body) || Array.isArray(body.collections));
});

test('GET /v1/rag/stats returns RAG stats', async () => {
  const res = await fetch(`${BASE_URL}/v1/rag/stats`);
  assert.equal(res.status, 200);
});

// ── Error paths — well-defined without a real LLM backend ─────────────────

test('POST /v1/chat without model/messages returns 400', async () => {
  const res = await fetch(`${BASE_URL}/v1/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const body = await res.json();
  assert.equal(res.status, 400);
  assert.match(body.error, /model and messages required/);
});

test('POST /v1/chat/completions with an unknown model returns 404', async () => {
  const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'definitely-not-a-real-model', messages: [] }),
  });
  const body = await res.json();
  assert.equal(res.status, 404);
  assert.match(body.error.message, /not found/);
});

// ── Cross-cutting behavior ──────────────────────────────────────────────────

test('OPTIONS preflight returns 204 with CORS headers', async () => {
  const res = await fetch(`${BASE_URL}/v1/models`, { method: 'OPTIONS' });
  assert.equal(res.status, 204);
  assert.equal(res.headers.get('access-control-allow-origin'), '*');
  assert.match(res.headers.get('access-control-allow-methods') || '', /GET/);
});

test('unknown route returns 404 JSON', async () => {
  const res = await fetch(`${BASE_URL}/v1/definitely-not-a-route`);
  const body = await res.json();
  assert.equal(res.status, 404);
  assert.equal(body.error, 'Not found');
});
