#!/usr/bin/env node
/**
 * 🤖 Local LLM Hub — Proxy v3.1
 * ─────────────────────────────────────────────────────
 * v3.1 changes (security & reliability hardening):
 *   • fetch_url: timeout, size cap, SSRF deny-list, protocol allowlist, redirect guard
 *   • web_search: timeout
 *   • httpGet: timeout
 *   • calculator: replaced regex-based eval with safer vm sandbox
 *   • Binds to 127.0.0.1 by default (opt-in to LAN via HOST env var)
 *   • run_javascript: clearer "development only" disclaimer
 * ─────────────────────────────────────────────────────
 */

const http       = require('http');
const https      = require('https');
const { spawn }  = require('child_process');
const readline   = require('readline');
const fs         = require('fs');
const path       = require('path');
const vm         = require('vm');
const crypto     = require('crypto');
const os         = require('os');
const { URL }    = require('url');

const { isPrivateHost }    = require('./lib/ssrf');
const { chunkText, cosine: cosineSimilarity } = require('./lib/rag-utils');
const { evaluate: calcEvaluate } = require('./lib/calculator');
const { buildSpec }        = require('./lib/openapi');
const { parseStopSequences } = require('./lib/stop-sequences');
const { parseSeed }        = require('./lib/seed');
const { parseContextLength } = require('./lib/context-length');
const { ToolCallCache }    = require('./lib/tool-cache');

// ─────────────────────────────────────────────────────────────────────────────
// § CONFIG & STORAGE
// ─────────────────────────────────────────────────────────────────────────────

const CONFIG_PATH = path.join(__dirname, 'config.json');

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); }
  catch {
    return {
      proxy_port: 8765,
      storage_dir: '.llm-hub',
      providers: {
        ollama:   { host: 'localhost', port: 11434 },
        lmstudio: { host: 'localhost', port: 1234  },
      },
      tools: { enabled: true, built_in: ['datetime','calculator','web_search','fetch_url','run_javascript','rag_search'] },
      rag: { enabled: true, embedding_provider: 'ollama', embedding_model: 'nomic-embed-text', chunk_size: 800, chunk_overlap: 100, top_k: 5 },
      mcp_servers: [],
    };
  }
}

let CONFIG = loadConfig();
// Env vars take precedence over config.json so Docker / CI can override without editing files.
const PORT = parseInt(process.env.PORT || process.env.PROXY_PORT || CONFIG.proxy_port || 8765, 10);
// Default bind: 127.0.0.1 (localhost only). Set HOST=0.0.0.0 env to expose to LAN / container.
const HOST = process.env.HOST || '127.0.0.1';

// Provider host/port overrides — useful for Docker where services talk by container name.
if (process.env.OLLAMA_HOST)    CONFIG.providers.ollama.host    = process.env.OLLAMA_HOST;
if (process.env.OLLAMA_PORT)    CONFIG.providers.ollama.port    = parseInt(process.env.OLLAMA_PORT, 10);
if (process.env.LM_STUDIO_HOST) CONFIG.providers.lmstudio.host  = process.env.LM_STUDIO_HOST;
if (process.env.LM_STUDIO_PORT) CONFIG.providers.lmstudio.port  = parseInt(process.env.LM_STUDIO_PORT, 10);

const _storageCfg = process.env.STORAGE_DIR || CONFIG.storage_dir || '.llm-hub';
const STORAGE_DIR = path.isAbsolute(_storageCfg)
  ? _storageCfg
  : path.join(__dirname, _storageCfg);

const RAG_DIR = path.join(STORAGE_DIR, 'rag');
if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR, { recursive: true });
if (!fs.existsSync(RAG_DIR))     fs.mkdirSync(RAG_DIR,     { recursive: true });

// ─────────────────────────────────────────────────────────────────────────────
// § HTTP UTILS
// ─────────────────────────────────────────────────────────────────────────────

function httpPost(host, port, pathStr, body, timeout = 60000) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(
      { hostname: host, port, path: pathStr, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
        timeout },
      (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => {
          try { resolve({ status: res.statusCode, data: JSON.parse(buf) }); }
          catch { resolve({ status: res.statusCode, data: { error: buf } }); }
        });
      }
    );
    req.on('error',   reject);
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.write(data);
    req.end();
  });
}

function httpGet(host, port, pathStr, timeout = 5000) {
  return new Promise((resolve) => {
    const req = http.request(
      { hostname: host, port, path: pathStr, method: 'GET', timeout },
      (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => {
          try { resolve({ ok: res.statusCode < 400, data: JSON.parse(buf) }); }
          catch { resolve({ ok: false, data: null }); }
        });
      }
    );
    req.on('error', () => resolve({ ok: false, data: null }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, data: null }); });
    req.end();
  });
}

function httpsGet(hostname, pathStr, headers = {}, timeout = 8000) {
  return new Promise((resolve) => {
    const req = https.request(
      { hostname, path: pathStr, method: 'GET', headers, timeout },
      (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => {
          try { resolve({ ok: res.statusCode < 400, status: res.statusCode, data: JSON.parse(buf) }); }
          catch { resolve({ ok: res.statusCode < 400, status: res.statusCode, data: null }); }
        });
      }
    );
    req.on('error', () => resolve({ ok: false, status: 0, data: null }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, status: 0, data: null }); });
    req.end();
  });
}

function httpsPost(hostname, pathStr, body, headers = {}, timeout = 60000) {
  return new Promise((resolve) => {
    const data = JSON.stringify(body);
    const req = https.request(
      { hostname, path: pathStr, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers },
        timeout },
      (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => {
          try { resolve({ status: res.statusCode, data: JSON.parse(buf) }); }
          catch { resolve({ status: res.statusCode, data: { error: { message: buf.slice(0, 500) } } }); }
        });
      }
    );
    req.on('error',   (e) => resolve({ status: 0, data: { error: { message: e.message } } }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, data: { error: { message: 'timeout' } } }); });
    req.write(data);
    req.end();
  });
}

function streamHTTPS(hostname, pathStr, body, headers, { onChunk, onDone, onError, signal }) {
  const data = JSON.stringify({ ...body, stream: true });
  const req = https.request(
    { hostname, path: pathStr, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers } },
    (res) => {
      if (res.statusCode >= 400) {
        let buf = '';
        res.on('data', c => (buf += c));
        res.on('end', () => onError(`HTTP ${res.statusCode}: ${buf.slice(0, 300)}`));
        return;
      }
      let buffer = '';
      res.on('data', (chunk) => {
        if (signal?.aborted) { try { req.destroy(); } catch {} return; }
        buffer += chunk.toString();
        let idx;
        while ((idx = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try { onChunk(JSON.parse(payload)); } catch {}
        }
      });
      res.on('end',   () => onDone());
      res.on('error', (e) => onError(e.message));
    }
  );
  req.on('error', (e) => onError(e.message));
  if (signal) signal.onAbort = () => { try { req.destroy(); } catch {} };
  req.write(data);
  req.end();
  return req;
}

// Anthropic SSE → OpenAI-compatible chunk converter
function streamAnthropic(hostname, pathStr, body, headers, { onChunk, onDone, onError, signal }) {
  const data = JSON.stringify({ ...body, stream: true });
  const req = https.request(
    { hostname, path: pathStr, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers } },
    (res) => {
      if (res.statusCode >= 400) {
        let buf = '';
        res.on('data', c => (buf += c));
        res.on('end', () => onError(`HTTP ${res.statusCode}: ${buf.slice(0, 300)}`));
        return;
      }
      let buffer = '';
      const toolUseBlocks = {};
      res.on('data', (chunk) => {
        if (signal?.aborted) { try { req.destroy(); } catch {} return; }
        buffer += chunk.toString();
        let idx;
        while ((idx = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload) continue;
          try {
            const evt = JSON.parse(payload);
            if (evt.type === 'content_block_delta') {
              if (evt.delta?.type === 'text_delta') {
                onChunk({ choices: [{ index: 0, delta: { content: evt.delta.text }, finish_reason: null }] });
              } else if (evt.delta?.type === 'input_json_delta') {
                onChunk({ choices: [{ index: 0, delta: { tool_calls: [{ index: evt.index, function: { arguments: evt.delta.partial_json } }] }, finish_reason: null }] });
              }
            } else if (evt.type === 'content_block_start' && evt.content_block?.type === 'tool_use') {
              toolUseBlocks[evt.index] = evt.content_block;
              onChunk({ choices: [{ index: 0, delta: { tool_calls: [{ index: evt.index, id: evt.content_block.id, type: 'function', function: { name: evt.content_block.name, arguments: '' } }] }, finish_reason: null }] });
            } else if (evt.type === 'message_delta' && evt.usage) {
              onChunk({ usage: { prompt_tokens: 0, completion_tokens: evt.usage.output_tokens || 0 } });
            } else if (evt.type === 'message_start' && evt.message?.usage) {
              onChunk({ usage: { prompt_tokens: evt.message.usage.input_tokens || 0, completion_tokens: 0 } });
            }
          } catch {}
        }
      });
      res.on('end',   () => onDone());
      res.on('error', (e) => onError(e.message));
    }
  );
  req.on('error', (e) => onError(e.message));
  if (signal) signal.onAbort = () => { try { req.destroy(); } catch {} };
  req.write(data);
  req.end();
  return req;
}

// ─────────────────────────────────────────────────────────────────────────────
// § RAG ENGINE
// ─────────────────────────────────────────────────────────────────────────────

class RagEngine {
  constructor() {
    this.collections = new Map();
    this._loadAll();
  }

  _loadAll() {
    try {
      const files = fs.readdirSync(RAG_DIR).filter(f => f.endsWith('.json'));
      for (const f of files) {
        try {
          const col = JSON.parse(fs.readFileSync(path.join(RAG_DIR, f), 'utf8'));
          this.collections.set(col.id, col);
        } catch (e) { console.error('[RAG] failed to load', f, e.message); }
      }
      console.log(`[RAG] Loaded ${this.collections.size} collection(s)`);
    } catch { /* dir empty */ }
  }

  _persist(col) {
    fs.writeFileSync(path.join(RAG_DIR, `${col.id}.json`), JSON.stringify(col));
  }

  listCollections() {
    return [...this.collections.values()].map(c => ({
      id:        c.id,
      name:      c.name,
      chunks:    c.chunks?.length || 0,
      sources:   [...new Set((c.chunks||[]).map(ch => ch.source))].length,
      createdAt: c.createdAt,
    }));
  }

  getCollection(id) { return this.collections.get(id); }

  deleteCollection(id) {
    this.collections.delete(id);
    const p = path.join(RAG_DIR, `${id}.json`);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  /** Delegate to shared lib/rag-utils (single source of truth for tests) */
  chunkText(text, chunkSize, overlap) { return chunkText(text, chunkSize, overlap); }

  async embed(text) {
    const cfg = CONFIG.rag;
    if (cfg.embedding_provider !== 'ollama') {
      throw new Error(`Unsupported embedding_provider: ${cfg.embedding_provider}`);
    }
    const res = await httpPost(
      CONFIG.providers.ollama.host,
      CONFIG.providers.ollama.port,
      '/api/embeddings',
      { model: cfg.embedding_model, prompt: text },
      60000
    );
    if (res.status >= 400 || !res.data?.embedding) {
      throw new Error(`Embedding failed: ${JSON.stringify(res.data).slice(0, 200)}`);
    }
    return res.data.embedding;
  }

  /** Delegate to shared lib/rag-utils (single source of truth for tests) */
  static cosine(a, b) { return cosineSimilarity(a, b); }

  async addDocument({ collectionId, collectionName, source, text, onProgress }) {
    const cfg = CONFIG.rag;
    let col = this.collections.get(collectionId);
    if (!col) {
      col = {
        id: collectionId || crypto.randomBytes(8).toString('hex'),
        name: collectionName || 'Untitled',
        chunks: [],
        createdAt: Date.now(),
      };
      this.collections.set(col.id, col);
    }

    const chunks = this.chunkText(text, cfg.chunk_size, cfg.chunk_overlap);
    let done = 0;
    for (const chunk of chunks) {
      const embedding = await this.embed(chunk);
      col.chunks.push({
        id: crypto.randomBytes(6).toString('hex'),
        source,
        text: chunk,
        embedding,
      });
      done++;
      if (onProgress) onProgress({ done, total: chunks.length });
    }
    this._persist(col);
    return { collectionId: col.id, chunksAdded: chunks.length };
  }

  async query({ collectionId, query, topK }) {
    const col = this.collections.get(collectionId);
    if (!col) throw new Error(`Collection not found: ${collectionId}`);
    if (!col.chunks?.length) return [];

    const qEmbed = await this.embed(query);
    const scored = col.chunks.map(c => ({
      score:  RagEngine.cosine(qEmbed, c.embedding),
      source: c.source,
      text:   c.text,
      id:     c.id,
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK || CONFIG.rag.top_k || 5);
  }
}

const rag = new RagEngine();

// ─────────────────────────────────────────────────────────────────────────────
// § SSRF PROTECTION HELPER
// ─────────────────────────────────────────────────────────────────────────────
// isPrivateHost is imported from lib/ssrf.js (single source of truth for tests)

// ─────────────────────────────────────────────────────────────────────────────
// § BUILT-IN TOOLS
// ─────────────────────────────────────────────────────────────────────────────

const BUILT_IN_DEFS = {
  datetime: {
    name: 'datetime',
    description: 'Get the current date, time, and timezone information.',
    input_schema: {
      type: 'object',
      properties: { timezone: { type: 'string', description: 'IANA timezone (e.g. Africa/Cairo).' } },
      required: [],
    },
  },
  calculator: {
    name: 'calculator',
    description: 'Evaluate a math expression safely. Supports +,-,*,/,**,%, Math.* functions and constants.',
    input_schema: {
      type: 'object',
      properties: { expression: { type: 'string', description: 'Math expression, e.g. "Math.sqrt(144) + 2**10"' } },
      required: ['expression'],
    },
  },
  web_search: {
    name: 'web_search',
    description: 'Search the web via DuckDuckGo Instant Answer API.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
  fetch_url: {
    name: 'fetch_url',
    description: 'Fetch text content of a public URL. Private/local addresses are blocked.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Public http(s) URL.' },
        max_chars: { type: 'number', description: 'Max chars of extracted text (default 3000).' },
      },
      required: ['url'],
    },
  },
  run_javascript: {
    name: 'run_javascript',
    description: 'DEVELOPMENT USE ONLY: execute JavaScript in an isolated Node vm context (3s timeout, no fs, no network). NOTE: Node vm is not a true security sandbox — do not expose this to untrusted users. Last expression is returned.',
    input_schema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'JS code. Last expression is returned.' },
      },
      required: ['code'],
    },
  },
  rag_search: {
    name: 'rag_search',
    description: "Search the user's uploaded knowledge base (RAG). Returns top matching chunks with scores.",
    input_schema: {
      type: 'object',
      properties: {
        collection_id: { type: 'string', description: 'ID of the RAG collection to search.' },
        query:         { type: 'string', description: 'Search query.' },
        top_k:         { type: 'number', description: 'Number of results (default 5).' },
      },
      required: ['collection_id', 'query'],
    },
  },
};

const builtInExecutors = {
  datetime({ timezone }) {
    const opts = timezone ? { timeZone: timezone } : {};
    const now  = new Date();
    return JSON.stringify({
      iso:      now.toISOString(),
      local:    now.toLocaleString('en-US', { ...opts, dateStyle: 'full', timeStyle: 'long' }),
      unix:     Math.floor(now.getTime() / 1000),
      timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  },

  // Delegate to lib/calculator.js (single source of truth for tests).
  calculator({ expression }) { return JSON.stringify(calcEvaluate(expression)); },

  web_search({ query }) {
    return new Promise((resolve) => {
      const TIMEOUT_MS = 8000;
      const reqUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
      const req = https.get(reqUrl, { headers: { 'User-Agent': 'LocalLLMHub/3.1' }, timeout: TIMEOUT_MS }, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            const results = [];
            if (json.Abstract) results.push({ title: json.Heading, snippet: json.Abstract, url: json.AbstractURL });
            if (json.RelatedTopics) {
              for (const t of json.RelatedTopics.slice(0, 5)) {
                if (t.Text && t.FirstURL) results.push({ title: t.Text.split(' - ')[0], snippet: t.Text, url: t.FirstURL });
              }
            }
            resolve(JSON.stringify({ query, results: results.slice(0, 6) }));
          } catch {
            resolve(JSON.stringify({ query, error: 'Failed to parse results' }));
          }
        });
      });
      req.on('timeout', () => { req.destroy(new Error('timeout')); resolve(JSON.stringify({ error: `web_search timed out after ${TIMEOUT_MS}ms` })); });
      req.on('error', (e) => resolve(JSON.stringify({ error: e.message })));
    });
  },

  fetch_url({ url, max_chars = 3000 }) {
    return new Promise((resolve) => {
      const TIMEOUT_MS = 10000;
      const MAX_BYTES  = 2 * 1024 * 1024; // 2MB

      try {
        const parsed = new URL(url);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          resolve(JSON.stringify({ error: `Unsupported protocol: ${parsed.protocol}` }));
          return;
        }
        if (isPrivateHost(parsed.hostname)) {
          resolve(JSON.stringify({ error: `Blocked: cannot fetch private/local addresses (${parsed.hostname})` }));
          return;
        }
        const mod = parsed.protocol === 'https:' ? https : http;
        const req = mod.get(url, { headers: { 'User-Agent': 'LocalLLMHub/3.1' }, timeout: TIMEOUT_MS }, (res) => {
          // Reject redirect to private address. Don't follow automatically — too risky.
          if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
            try {
              const next = new URL(res.headers.location, url);
              if (isPrivateHost(next.hostname)) {
                resolve(JSON.stringify({ error: 'Blocked: redirect pointed to a private address' }));
                return;
              }
            } catch { /* fall through */ }
            resolve(JSON.stringify({ url, redirect_to: res.headers.location, note: 'Redirect not followed. Call fetch_url again with the new URL if you trust it.' }));
            return;
          }

          let body = '';
          let bytes = 0;
          let aborted = false;
          res.on('data', (c) => {
            if (aborted) return;
            bytes += c.length;
            if (bytes > MAX_BYTES) {
              aborted = true;
              req.destroy();
              resolve(JSON.stringify({ error: `Response exceeded ${MAX_BYTES} bytes — aborted` }));
              return;
            }
            body += c;
          });
          res.on('end', () => {
            if (aborted) return;
            const text = body.replace(/<script[\s\S]*?<\/script>/gi, '')
                             .replace(/<style[\s\S]*?<\/style>/gi, '')
                             .replace(/<[^>]+>/g, ' ')
                             .replace(/\s+/g, ' ').trim().slice(0, max_chars);
            resolve(JSON.stringify({ url, content: text, truncated: body.length > max_chars }));
          });
        });
        req.on('timeout', () => { req.destroy(); resolve(JSON.stringify({ error: `fetch_url timed out after ${TIMEOUT_MS}ms` })); });
        req.on('error', (e) => resolve(JSON.stringify({ error: e.message })));
      } catch (e) {
        resolve(JSON.stringify({ error: `Invalid URL: ${e.message}` }));
      }
    });
  },

  run_javascript({ code }) {
    try {
      const sandbox = {
        console: { log: (...args) => { sandbox.__log.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')); } },
        Math, Date, JSON, Array, Object, String, Number, Boolean, RegExp,
        parseInt, parseFloat, isNaN, isFinite,
        __log: [],
      };
      const ctx    = vm.createContext(sandbox);
      const script = new vm.Script(code);
      const result = script.runInContext(ctx, { timeout: 3000 });
      return JSON.stringify({
        result: result === undefined ? null : (typeof result === 'object' ? result : String(result)),
        logs:   sandbox.__log,
      });
    } catch (e) {
      return JSON.stringify({ error: e.message });
    }
  },

  async rag_search({ collection_id, query, top_k }) {
    try {
      const results = await rag.query({ collectionId: collection_id, query, topK: top_k });
      return JSON.stringify({
        query,
        results: results.map(r => ({
          source: r.source,
          score:  r.score.toFixed(3),
          text:   r.text.slice(0, 600),
        })),
      });
    } catch (e) {
      return JSON.stringify({ error: e.message });
    }
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// § MCP STDIO CLIENT
// ─────────────────────────────────────────────────────────────────────────────

class MCPStdioClient {
  constructor(config) {
    this.config  = config;
    this.proc    = null;
    this.rl      = null;
    this.msgId   = 0;
    this.pending = new Map();
    this.tools   = [];
  }

  async connect() {
    const env = { ...process.env, ...(this.config.env || {}) };
    this.proc = spawn(this.config.command, this.config.args || [], { env, stdio: ['pipe','pipe','pipe'] });
    this.rl = readline.createInterface({ input: this.proc.stdout });
    this.rl.on('line', (line) => {
      try {
        const msg = JSON.parse(line);
        if (msg.id !== undefined && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
        }
      } catch { /* */ }
    });
    this.proc.on('error', (e) => console.error(`[MCP:${this.config.name}]`, e.message));

    await this._rpc('initialize', {
      protocolVersion: '2024-11-05',
      capabilities:    {},
      clientInfo:      { name: 'local-llm-hub', version: '3.1' },
    });
    this._notify('notifications/initialized');
    const result = await this._rpc('tools/list', {});
    this.tools = (result.tools || []).map(t => ({ ...t, _mcp_server: this.config.name }));
    return this.tools;
  }

  async callTool(name, args) {
    const result = await this._rpc('tools/call', { name, arguments: args });
    const content = result.content || [];
    return content.map(c => c.text || JSON.stringify(c)).join('\n');
  }

  _rpc(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++this.msgId;
      this.pending.set(id, { resolve, reject });
      this.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
      setTimeout(() => {
        if (this.pending.has(id)) { this.pending.delete(id); reject(new Error(`MCP timeout: ${method}`)); }
      }, 10000);
    });
  }

  _notify(method, params = {}) {
    this.proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
  }

  disconnect() { try { this.proc?.kill(); } catch {} }
}

// ─────────────────────────────────────────────────────────────────────────────
// § TOOL REGISTRY
// ─────────────────────────────────────────────────────────────────────────────

class ToolRegistry {
  constructor() {
    this.mcpClients  = new Map();
    this.mcpToolMap  = new Map();
    this.allToolDefs = [];
  }

  async init() {
    this.allToolDefs = [];
    this.mcpClients.clear();
    this.mcpToolMap.clear();

    const enabled = CONFIG.tools?.built_in || Object.keys(BUILT_IN_DEFS);
    for (const name of enabled) {
      if (BUILT_IN_DEFS[name]) this.allToolDefs.push(BUILT_IN_DEFS[name]);
    }

    for (const srv of CONFIG.mcp_servers || []) {
      if (!srv.enabled) continue;
      try {
        console.log(`[MCP] Connecting: ${srv.name}…`);
        const client = new MCPStdioClient(srv);
        const tools  = await client.connect();
        this.mcpClients.set(srv.name, client);
        for (const t of tools) {
          this.mcpToolMap.set(t.name, srv.name);
          this.allToolDefs.push({
            name:         t.name,
            description:  t.description,
            input_schema: t.inputSchema || { type: 'object', properties: {} },
            _source:      `mcp:${srv.name}`,
          });
        }
        console.log(`[MCP] ✅ ${srv.name} — ${tools.length} tools`);
      } catch (e) {
        console.error(`[MCP] ❌ ${srv.name}: ${e.message}`);
      }
    }
    console.log(`[Tools] ${this.allToolDefs.length} total`);
  }

  getOpenAITools() {
    return this.allToolDefs.map(t => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.input_schema || { type: 'object', properties: {} } },
    }));
  }

  async execute(name, args) {
    const srvName = this.mcpToolMap.get(name);
    if (srvName) return await this.mcpClients.get(srvName).callTool(name, args);
    if (builtInExecutors[name]) {
      const r = await builtInExecutors[name](args);
      return typeof r === 'string' ? r : JSON.stringify(r);
    }
    return JSON.stringify({ error: `Tool "${name}" not found` });
  }

  async reload() {
    for (const c of this.mcpClients.values()) c.disconnect();
    await this.init();
  }

  getStatus() {
    return {
      total:    this.allToolDefs.length,
      built_in: this.allToolDefs.filter(t => !t._source).length,
      mcp:      [...this.mcpClients.keys()].map(n => ({ name: n, tools: this.allToolDefs.filter(t => t._source === `mcp:${n}`).length })),
      tools: this.allToolDefs.map(t => ({
        name:   t.name,
        source: t._source || 'built-in',
        desc:   t.description?.slice(0, 120),
      })),
    };
  }
}

const registry = new ToolRegistry();

// ─────────────────────────────────────────────────────────────────────────────
// § PROVIDER UTILS
// ─────────────────────────────────────────────────────────────────────────────

const CLOUD_PROVIDERS = {
  openai:     { hostname: 'api.openai.com',   modelsPath: '/v1/models',          chatPath: '/v1/chat/completions',        keyProp: 'openai' },
  anthropic:  { hostname: 'api.anthropic.com', modelsPath: '/v1/models',          chatPath: '/v1/messages',               keyProp: 'anthropic' },
  groq:       { hostname: 'api.groq.com',     modelsPath: '/openai/v1/models',   chatPath: '/openai/v1/chat/completions', keyProp: 'groq' },
  openrouter: { hostname: 'openrouter.ai',    modelsPath: '/api/v1/models',      chatPath: '/api/v1/chat/completions',    keyProp: 'openrouter' },
  mistral:    { hostname: 'api.mistral.ai',         modelsPath: '/v1/models',                chatPath: '/v1/chat/completions',                  keyProp: 'mistral' },
  together:   { hostname: 'api.together.xyz',       modelsPath: '/v1/models',                chatPath: '/v1/chat/completions',                  keyProp: 'together' },
  fireworks:  { hostname: 'api.fireworks.ai',        modelsPath: '/inference/v1/models',      chatPath: '/inference/v1/chat/completions',         keyProp: 'fireworks' },
  cohere:     { hostname: 'api.cohere.com',          modelsPath: '/compatibility/v1/models',  chatPath: '/compatibility/v1/chat/completions',     keyProp: 'cohere' },
};


function convertToAnthropicMessages(messages) {
  let system = '';
  const converted = [];
  for (const m of messages) {
    if (m.role === 'system') {
      system += (system ? '\n' : '') + (typeof m.content === 'string' ? m.content : (m.content || []).map(c => c.text || '').join(''));
    } else if (m.role === 'tool') {
      converted.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: m.tool_call_id, content: m.content }] });
    } else if (m.role === 'assistant' && m.tool_calls?.length) {
      const content = [];
      if (m.content) content.push({ type: 'text', text: m.content });
      for (const tc of m.tool_calls) {
        let input = {};
        try { input = JSON.parse(tc.function.arguments || '{}'); } catch {}
        content.push({ type: 'tool_use', id: tc.id, name: tc.function.name, input });
      }
      converted.push({ role: 'assistant', content });
    } else {
      let content;
      if (typeof m.content === 'string') {
        content = m.content;
      } else {
        content = (m.content || []).map(c => {
          if (c.type === 'image_url') {
            const url = c.image_url?.url || '';
            if (url.startsWith('data:')) {
              const [meta, b64] = url.split(',');
              return { type: 'image', source: { type: 'base64', media_type: meta.replace('data:', '').replace(';base64', ''), data: b64 } };
            }
            return { type: 'image', source: { type: 'url', url } };
          }
          return { type: 'text', text: c.text || '' };
        });
      }
      converted.push({ role: m.role, content });
    }
  }
  return { system: system || undefined, messages: converted };
}

function convertAnthropicResponseToOpenAI(resp, modelId) {
  const blocks = Array.isArray(resp?.content) ? resp.content : [];
  const text = blocks.filter(b => b.type === 'text').map(b => b.text).join('');
  const toolCalls = blocks.filter(b => b.type === 'tool_use').map((b, i) => ({
    index: i,
    id:    b.id,
    type:  'function',
    function: { name: b.name, arguments: JSON.stringify(b.input || {}) },
  }));
  const finish = resp?.stop_reason === 'tool_use' ? 'tool_calls'
               : resp?.stop_reason === 'max_tokens' ? 'length' : 'stop';
  const message = { role: 'assistant', content: text || null };
  if (toolCalls.length) message.tool_calls = toolCalls;
  return {
    id:      resp?.id || `chatcmpl-${Date.now()}`,
    object:  'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model:   modelId,
    choices: [{ index: 0, message, finish_reason: finish }],
    usage: {
      prompt_tokens:     resp?.usage?.input_tokens  || 0,
      completion_tokens: resp?.usage?.output_tokens || 0,
      total_tokens:     (resp?.usage?.input_tokens  || 0) + (resp?.usage?.output_tokens || 0),
    },
  };
}

function buildCloudHeaders(provider, apiKey) {
  if (provider === 'anthropic') {
    return { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'tools-2024-04-04' };
  }
  const h = { Authorization: `Bearer ${apiKey}` };
  if (provider === 'openrouter') {
    h['HTTP-Referer'] = 'http://localhost:8765';
    h['X-Title'] = 'LLM Hub';
  }
  return h;
}

function getApiKeys(req) {
  try {
    const h = req.headers['x-api-keys'];
    if (!h) return {};
    return JSON.parse(h);
  } catch { return {}; }
}

const modelRegistry = new Map();
const customProviderConfigs = new Map(); // providerKey -> { id, name, url, key }

function getCustomProviders(req) {
  try {
    const h = req.headers['x-custom-providers'];
    if (!h) return [];
    const parsed = JSON.parse(h);
    return Array.isArray(parsed) ? parsed.filter(cp => cp.id && cp.url) : [];
  } catch { return []; }
}

function resolveProvider(m) {
  if (m?.startsWith('ollama/'))     return 'ollama';
  if (m?.startsWith('lmstudio/'))   return 'lmstudio';
  if (m?.startsWith('openai/'))     return 'openai';
  if (m?.startsWith('anthropic/'))  return 'anthropic';
  if (m?.startsWith('groq/'))       return 'groq';
  if (m?.startsWith('openrouter/')) return 'openrouter';
  if (m?.startsWith('mistral/'))    return 'mistral';
  if (m?.startsWith('together/'))   return 'together';
  if (m?.startsWith('fireworks/'))  return 'fireworks';
  if (m?.startsWith('cohere/'))     return 'cohere';
  const customMatch = m?.match(/^(custom_[^/]+)\//);
  if (customMatch && customProviderConfigs.has(customMatch[1])) return customMatch[1];
  return modelRegistry.get(m) || null;
}
function stripPrefix(m) { return m?.replace(/^(ollama|lmstudio|openai|anthropic|groq|openrouter|mistral|together|fireworks|cohere|custom_[^/]+)\//, '') || m; }

async function fetchAllModels(apiKeys = {}, customProviders = []) {
  modelRegistry.clear();
  customProviderConfigs.clear();
  const all = [];

  // === STEP 1: Fetch model lists from local + cloud providers IN PARALLEL ===
  const cloudFetches = {};
  for (const [name, cfg] of Object.entries(CLOUD_PROVIDERS)) {
    const key = apiKeys[cfg.keyProp];
    if (!key || !cfg.modelsPath) continue;
    cloudFetches[name] = httpsGet(cfg.hostname, cfg.modelsPath, buildCloudHeaders(name, key), 8000);
  }

  const [olResult, lmResult, ...cloudResults] = await Promise.allSettled([
    httpGet(CONFIG.providers.ollama.host, CONFIG.providers.ollama.port, '/api/tags', 8000),
    httpGet(CONFIG.providers.lmstudio.host, CONFIG.providers.lmstudio.port, '/v1/models', 8000),
    ...Object.values(cloudFetches),
  ]);
  const cloudNames = Object.keys(cloudFetches);

  // --- Ollama models ---
  const ol = olResult.status === 'fulfilled' ? olResult.value : { ok: false };
  if (ol.ok && ol.data?.models) {
    for (const m of ol.data.models) {
      const id = `ollama/${m.name}`;
      modelRegistry.set(id, 'ollama'); modelRegistry.set(m.name, 'ollama');
      all.push({
        id, object: 'model', owned_by: 'ollama', created: Date.now(),
        size_bytes: m.size || 0,
        size_label: m.size ? formatBytes(m.size) : '?',
        details: m.details || {},
      });
    }
    console.log(`[Models] Ollama: ${ol.data.models.length} model(s)`);
  } else {
    console.warn('[Models] Ollama: offline or no models');
  }

  // --- LM Studio models ---
  const lm = lmResult.status === 'fulfilled' ? lmResult.value : { ok: false };
  if (lm.ok && lm.data?.data) {
    for (const m of lm.data.data) {
      const id = `lmstudio/${m.id}`;
      modelRegistry.set(id, 'lmstudio'); modelRegistry.set(m.id, 'lmstudio');
      all.push({
        id, object: 'model', owned_by: 'lmstudio', created: m.created || Date.now(),
        size_label:     m.max_tokens ? null : null,
        context_length: m.context_length || m.max_context_length || null,
      });
    }
    console.log(`[Models] LM Studio: ${lm.data.data.length} model(s)`);
  } else {
    const port = CONFIG.providers.lmstudio.port;
    console.warn(`[Models] LM Studio: cannot reach port ${port}. Make sure Developer → Server is started in LM Studio.`);
  }

  // === STEP 2: Cloud provider models ===
  cloudNames.forEach((name, i) => {
    const result = cloudResults[i];
    const r = result.status === 'fulfilled' ? result.value : { ok: false };
    const cfg = CLOUD_PROVIDERS[name];
    if (r.ok && r.data?.data) {
      for (const m of r.data.data) {
        const id = `${name}/${m.id}`;
        modelRegistry.set(id, name);
        all.push({
          id, object: 'model', owned_by: name, created: m.created || Date.now(),
          context_length: m.context_length || m.max_input_tokens || null,
        });
      }
      console.log(`[Models] ${name}: ${r.data.data.length} model(s)`);
    } else if (result.status === 'fulfilled') {
      console.warn(`[Models] ${name}: HTTP ${r.status}`);
    }
  });

  // === STEP 3: Custom OpenAI-compatible provider models ===
  for (const cp of customProviders) {
    if (!cp.id || !cp.url) continue;
    const providerKey = `custom_${cp.id}`;
    customProviderConfigs.set(providerKey, cp);
    try {
      const parsedUrl = new URL(cp.url);
      const isHttps = parsedUrl.protocol === 'https:';
      const cpHeaders = cp.key ? { Authorization: `Bearer ${cp.key}` } : {};
      const cpPort = parsedUrl.port ? parseInt(parsedUrl.port) : (isHttps ? 443 : 80);
      const result = isHttps
        ? await httpsGet(parsedUrl.hostname, '/v1/models', cpHeaders, 8000)
        : await httpGet(parsedUrl.hostname, cpPort, '/v1/models', 8000);
      if (result.ok && result.data?.data) {
        for (const m of result.data.data) {
          const id = `${providerKey}/${m.id}`;
          modelRegistry.set(id, providerKey);
          all.push({ id, object: 'model', owned_by: providerKey, created: m.created || Date.now(),
            provider_name: cp.name, context_length: m.context_length || null });
        }
        console.log(`[Models] Custom(${cp.name}): ${result.data.data.length} model(s)`);
      } else {
        console.warn(`[Models] Custom(${cp.name}): offline or no models`);
      }
    } catch (e) {
      console.warn(`[Models] Custom(${cp.name}): ${e.message}`);
    }
  }

  // === STEP 4: Enrich Ollama models with metadata (in background, non-blocking) ===
  // This runs AFTER both model lists are already returned to the UI
  if (ol.ok && ol.data?.models) {
    const enrichPromises = all.filter(m => m.owned_by === 'ollama').map(async (m) => {
      try {
        const show = await httpPost(
          CONFIG.providers.ollama.host, CONFIG.providers.ollama.port,
          '/api/show', { model: stripPrefix(m.id) }, 5000
        );
        if (show.status < 400 && show.data) {
          const info = show.data.model_info || {};
          const params = show.data.details?.parameter_size || info['general.parameter_count'] || null;
          let contextLength = null;
          for (const [key, val] of Object.entries(info)) {
            if (key.includes('context_length') && typeof val === 'number') {
              contextLength = val; break;
            }
          }
          m.context_length = contextLength;
          m.parameter_size = params;
          m.quantization = show.data.details?.quantization_level || null;
          m.family = show.data.details?.family || null;
        }
      } catch { /* skip enrichment for this model */ }
    });
    await Promise.allSettled(enrichPromises);
  }

  console.log(`[Models] Total: ${all.length}`);
  return all;
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
  return (bytes / 1073741824).toFixed(1) + ' GB';
}

/** Get currently loaded/running models from Ollama + LM Studio */
async function getRunningModels() {
  const results = [];

  // Ollama running models
  try {
    const res = await httpGet(CONFIG.providers.ollama.host, CONFIG.providers.ollama.port, '/api/ps');
    if (res.ok && res.data?.models) {
      for (const m of res.data.models) {
        results.push({
          name:         m.name,
          id:           `ollama/${m.name}`,
          provider:     'ollama',
          size:         m.size || 0,
          size_label:   formatBytes(m.size || 0),
          vram:         m.size_vram || 0,
          vram_label:   formatBytes(m.size_vram || 0),
          expires_at:   m.expires_at,
          details:      m.details || {},
        });
      }
    }
  } catch {}

  // LM Studio running models — try /lms/server/status
  try {
    const lmCfg = CONFIG.providers.lmstudio;
    const lmsStatus = await httpGet(lmCfg.host, lmCfg.port, '/lms/server/status', 3000);
    if (lmsStatus.ok && lmsStatus.data) {
      const loaded = lmsStatus.data.loadedModels || lmsStatus.data.models || [];
      for (const m of loaded) {
        const name = typeof m === 'string' ? m : (m.id || m.name || m.model || 'unknown');
        results.push({
          name,
          id:           `lmstudio/${name}`,
          provider:     'lmstudio',
          size:         m.sizeBytes || m.size || 0,
          size_label:   formatBytes(m.sizeBytes || m.size || 0),
          vram:         m.gpuBytes || m.gpu_memory || 0,
          vram_label:   formatBytes(m.gpuBytes || m.gpu_memory || 0),
        });
      }
    }
  } catch {}

  return results;
}

/** Get system resource info */
function getSystemInfo() {
  const totalMem = os.totalmem();
  const freeMem  = os.freemem();
  const usedMem  = totalMem - freeMem;
  return {
    memory: {
      total:       totalMem,
      free:        freeMem,
      used:        usedMem,
      total_label: formatBytes(totalMem),
      free_label:  formatBytes(freeMem),
      used_label:  formatBytes(usedMem),
      usage_pct:   Math.round((usedMem / totalMem) * 100),
    },
    cpus:     os.cpus().length,
    platform: os.platform(),
    arch:     os.arch(),
    uptime:   Math.floor(os.uptime()),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// § STREAMING PROVIDER
// ─────────────────────────────────────────────────────────────────────────────

function streamProvider(host, port, pathStr, body, { onChunk, onDone, onError, signal }) {
  const data = JSON.stringify({ ...body, stream: true });
  const req  = http.request(
    { hostname: host, port, path: pathStr, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } },
    (res) => {
      if (res.statusCode >= 400) {
        let buf = '';
        res.on('data', c => buf += c);
        res.on('end', () => onError(`HTTP ${res.statusCode}: ${buf.slice(0, 200)}`));
        return;
      }
      let buffer = '';
      res.on('data', (chunk) => {
        if (signal?.aborted) { try { req.destroy(); } catch {} return; }
        buffer += chunk.toString();
        let idx;
        while ((idx = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try { onChunk(JSON.parse(payload)); } catch {}
        }
      });
      res.on('end',   () => onDone());
      res.on('error', (e) => onError(e.message));
    }
  );
  req.on('error', (e) => onError(e.message));
  if (signal) signal.onAbort = () => { try { req.destroy(); } catch {} };
  req.write(data);
  req.end();
  return req;
}

function streamCustom(baseUrl, body, extraHeaders, { onChunk, onDone, onError, signal }) {
  let parsedUrl;
  try { parsedUrl = new URL(baseUrl); } catch { onError('Invalid custom provider URL: ' + baseUrl); return; }
  const isHttps = parsedUrl.protocol === 'https:';
  const transport = isHttps ? https : http;
  const port = parsedUrl.port ? parseInt(parsedUrl.port) : (isHttps ? 443 : 80);
  const data = JSON.stringify({ ...body, stream: true });
  const req = transport.request(
    { hostname: parsedUrl.hostname, port, path: '/v1/chat/completions', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...extraHeaders } },
    (res) => {
      if (res.statusCode >= 400) {
        let buf = '';
        res.on('data', c => buf += c);
        res.on('end', () => onError(`HTTP ${res.statusCode}: ${buf.slice(0, 200)}`));
        return;
      }
      let buffer = '';
      res.on('data', (chunk) => {
        if (signal?.aborted) { try { req.destroy(); } catch {} return; }
        buffer += chunk.toString();
        let idx;
        while ((idx = buffer.indexOf('\n')) >= 0) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line.startsWith('data:')) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === '[DONE]') continue;
          try { onChunk(JSON.parse(payload)); } catch {}
        }
      });
      res.on('end',   () => onDone());
      res.on('error', (e) => onError(e.message));
    }
  );
  req.on('error', (e) => onError(e.message));
  if (signal) signal.onAbort = () => { try { req.destroy(); } catch {} };
  req.write(data);
  req.end();
  return req;
}

// ─────────────────────────────────────────────────────────────────────────────
// § AGENT LOOP
// ─────────────────────────────────────────────────────────────────────────────

async function runAgentLoop({ model, messages, temperature, max_tokens, top_p, top_k, repeat_penalty, frequency_penalty, stop = [], seed, numCtx, useTools, apiKeys = {}, customProviders = [], emit, signal }) {
  const provider = resolveProvider(model);
  if (!provider) { emit('error', { message: `Model "${model}" not found` }); return; }

  const isCustom    = provider?.startsWith('custom_');
  const isCloud     = !isCustom && (provider in CLOUD_PROVIDERS);
  const cfg         = isCloud ? CLOUD_PROVIDERS[provider] : (!isCustom ? CONFIG.providers[provider] : null);
  const actualModel = stripPrefix(model);
  const tools       = useTools ? registry.getOpenAITools() : [];
  let   history     = [...messages];
  const MAX_ROUNDS  = 8;
  const t0          = Date.now();
  const usage       = { prompt_tokens: 0, completion_tokens: 0 };
  const toolCache   = new ToolCallCache();

  if (isCustom) {
    const cpConfig = customProviderConfigs.get(provider);
    if (!cpConfig) { emit('error', { message: `Custom provider "${provider}" not found. Re-open Settings to reload.` }); return; }
    const cpHeaders = cpConfig.key ? { Authorization: `Bearer ${cpConfig.key}` } : {};
    for (let round = 0; round < MAX_ROUNDS; round++) {
      if (signal?.aborted) return;
      const body = { model: actualModel, messages: history, temperature: temperature ?? 0.7, max_tokens: max_tokens ?? 2048 };
      if (top_p !== undefined) body.top_p = top_p;
      if (top_k !== undefined) body.top_k = top_k;
      if (repeat_penalty !== undefined) body.repeat_penalty = repeat_penalty;
      if (frequency_penalty !== undefined) body.frequency_penalty = frequency_penalty;
      if (stop.length > 0) body.stop = stop;
      if (seed !== undefined) body.seed = seed;
      if (tools.length > 0) body.tools = tools;
      const roundResult = await new Promise((resolve) => {
        let content = '';
        const toolCalls = [];
        streamCustom(cpConfig.url, body, cpHeaders, {
          signal,
          onChunk(chunk) {
            const delta = chunk.choices?.[0]?.delta || {};
            if (typeof delta.content === 'string' && delta.content.length) { content += delta.content; emit('text_delta', { delta: delta.content }); }
            if (Array.isArray(delta.tool_calls)) {
              for (const tc of delta.tool_calls) {
                const i = tc.index ?? 0;
                if (!toolCalls[i]) toolCalls[i] = { id: '', type: 'function', function: { name: '', arguments: '' } };
                if (tc.id) toolCalls[i].id = tc.id;
                if (tc.function?.name) toolCalls[i].function.name += tc.function.name;
                if (tc.function?.arguments) toolCalls[i].function.arguments += tc.function.arguments;
              }
            }
            if (chunk.usage) { usage.prompt_tokens += chunk.usage.prompt_tokens || 0; usage.completion_tokens += chunk.usage.completion_tokens || 0; }
          },
          onDone()  { resolve({ ok: true, content, toolCalls: toolCalls.filter(tc => tc?.function?.name) }); },
          onError(e){ resolve({ ok: false, error: e }); },
        });
      });
      if (signal?.aborted) return;
      if (!roundResult.ok) { emit('error', { message: roundResult.error }); return; }
      if (roundResult.toolCalls.length > 0) {
        history.push({ role: 'assistant', content: roundResult.content || null, tool_calls: roundResult.toolCalls });
        for (const tc of roundResult.toolCalls) {
          if (signal?.aborted) return;
          const toolName = tc.function.name;
          let toolArgs = {};
          try { toolArgs = JSON.parse(tc.function.arguments || '{}'); } catch {}
          emit('tool_call', { id: tc.id, name: toolName, args: toolArgs });
          let toolResult;
          const cached = toolCache.has(toolName, toolArgs);
          if (cached) {
            toolResult = toolCache.get(toolName, toolArgs);
          } else {
            try { toolResult = await registry.execute(toolName, toolArgs); } catch (e) { toolResult = JSON.stringify({ error: e.message }); }
            toolCache.set(toolName, toolArgs, toolResult);
          }
          emit('tool_result', { id: tc.id, name: toolName, result: toolResult, cached });
          history.push({ role: 'tool', tool_call_id: tc.id, content: toolResult });
        }
        continue;
      }
      history.push({ role: 'assistant', content: roundResult.content });
      emit('done', { model: actualModel, provider, elapsed: Date.now() - t0, ...usage });
      return;
    }
    emit('done', { model: actualModel, provider, elapsed: Date.now() - t0, ...usage });
    return;
  }

  if (isCloud) {
    const apiKey = apiKeys[cfg.keyProp];
    if (!apiKey) { emit('error', { message: `No API key for ${provider}. Add it in Settings → Providers.` }); return; }
    const headers = buildCloudHeaders(provider, apiKey);

    for (let round = 0; round < MAX_ROUNDS; round++) {
      if (signal?.aborted) return;

      let body, streamFn;
      if (provider === 'anthropic') {
        const { system, messages: anthropicMsgs } = convertToAnthropicMessages(history);
        body = { model: actualModel, messages: anthropicMsgs, max_tokens: max_tokens ?? 2048 };
        if (system) body.system = system;
        if (temperature !== undefined) body.temperature = temperature;
        if (stop.length > 0) body.stop_sequences = stop;
        if (tools.length > 0) {
          body.tools = tools.map(t => ({
            name: t.function.name,
            description: t.function.description,
            input_schema: t.function.parameters,
          }));
        }
        streamFn = (cb) => streamAnthropic(cfg.hostname, cfg.chatPath, body, headers, cb);
      } else {
        body = {
          model:       actualModel,
          messages:    history,
          temperature: temperature ?? 0.7,
          max_tokens:  max_tokens  ?? 2048,
        };
        if (top_p !== undefined)  body.top_p  = top_p;
        if (stop.length > 0)      body.stop   = stop;
        if (seed !== undefined)   body.seed   = seed;
        if (tools.length > 0)     body.tools  = tools;
        streamFn = (cb) => streamHTTPS(cfg.hostname, cfg.chatPath, body, headers, cb);
      }

      const roundResult = await new Promise((resolve) => {
        let content = '';
        const toolCalls = [];
        streamFn({
          signal,
          onChunk(chunk) {
            const delta = chunk.choices?.[0]?.delta || {};
            if (typeof delta.content === 'string' && delta.content.length) {
              content += delta.content;
              emit('text_delta', { delta: delta.content });
            }
            if (Array.isArray(delta.tool_calls)) {
              for (const tc of delta.tool_calls) {
                const i = tc.index ?? 0;
                if (!toolCalls[i]) toolCalls[i] = { id: '', type: 'function', function: { name: '', arguments: '' } };
                if (tc.id)                  toolCalls[i].id = tc.id;
                if (tc.function?.name)      toolCalls[i].function.name      += tc.function.name;
                if (tc.function?.arguments) toolCalls[i].function.arguments += tc.function.arguments;
              }
            }
            if (chunk.usage) {
              usage.prompt_tokens     += chunk.usage.prompt_tokens     || 0;
              usage.completion_tokens += chunk.usage.completion_tokens || 0;
            }
          },
          onDone()  { resolve({ ok: true, content, toolCalls: toolCalls.filter(tc => tc?.function?.name) }); },
          onError(e){ resolve({ ok: false, error: e }); },
        });
      });

      if (signal?.aborted) return;
      if (!roundResult.ok) { emit('error', { message: roundResult.error }); return; }

      if (roundResult.toolCalls.length > 0) {
        history.push({ role: 'assistant', content: roundResult.content || null, tool_calls: roundResult.toolCalls });
        for (const tc of roundResult.toolCalls) {
          if (signal?.aborted) return;
          const toolName = tc.function.name;
          let toolArgs = {};
          try { toolArgs = JSON.parse(tc.function.arguments || '{}'); } catch {}
          emit('tool_call', { id: tc.id, name: toolName, args: toolArgs });
          let toolResult;
          const cached = toolCache.has(toolName, toolArgs);
          if (cached) {
            toolResult = toolCache.get(toolName, toolArgs);
          } else {
            try { toolResult = await registry.execute(toolName, toolArgs); }
            catch (e) { toolResult = JSON.stringify({ error: e.message }); }
            toolCache.set(toolName, toolArgs, toolResult);
          }
          emit('tool_result', { id: tc.id, name: toolName, result: toolResult, cached });
          history.push({ role: 'tool', tool_call_id: tc.id, name: toolName, content: toolResult });
        }
        continue;
      }

      emit('done', { model: actualModel, provider, elapsed: Date.now() - t0, ...usage });
      return;
    }
    emit('error', { message: 'Max tool-calling rounds reached' });
    return;
  }

  // ── Local provider (Ollama / LM Studio) ──
  for (let round = 0; round < MAX_ROUNDS; round++) {
    if (signal?.aborted) return;

    const body = {
      model:       actualModel,
      messages:    history,
      temperature: temperature ?? 0.7,
      max_tokens:  max_tokens  ?? 2048,
    };
    if (top_p !== undefined)             body.top_p             = top_p;
    if (top_k !== undefined)             body.top_k             = top_k;
    if (repeat_penalty !== undefined)    body.repeat_penalty    = repeat_penalty;
    if (frequency_penalty !== undefined) body.frequency_penalty = frequency_penalty;
    if (stop.length > 0) body.stop = stop;
    if (seed !== undefined) body.seed = seed;
    // num_ctx is an Ollama-specific runtime option; LM Studio treats context length
    // as a load-time setting, so sending it there would be a silent no-op.
    if (numCtx !== undefined && provider === 'ollama') body.options = { num_ctx: numCtx };
    if (tools.length > 0) body.tools = tools;

    const roundResult = await new Promise((resolve) => {
      let content = '';
      const toolCalls = [];
      streamProvider(cfg.host, cfg.port, '/v1/chat/completions', body, {
        signal,
        onChunk(chunk) {
          const delta = chunk.choices?.[0]?.delta || {};
          if (typeof delta.content === 'string' && delta.content.length) {
            content += delta.content;
            emit('text_delta', { delta: delta.content });
          }
          if (Array.isArray(delta.tool_calls)) {
            for (const tc of delta.tool_calls) {
              const i = tc.index ?? 0;
              if (!toolCalls[i]) toolCalls[i] = { id: '', type: 'function', function: { name: '', arguments: '' } };
              if (tc.id)                  toolCalls[i].id = tc.id;
              if (tc.function?.name)      toolCalls[i].function.name      += tc.function.name;
              if (tc.function?.arguments) toolCalls[i].function.arguments += tc.function.arguments;
            }
          }
          if (chunk.usage) {
            usage.prompt_tokens     += chunk.usage.prompt_tokens     || 0;
            usage.completion_tokens += chunk.usage.completion_tokens || 0;
          }
        },
        onDone()  { resolve({ ok: true, content, toolCalls: toolCalls.filter(tc => tc?.function?.name) }); },
        onError(e){ resolve({ ok: false, error: e }); },
      });
    });

    if (signal?.aborted) return;
    if (!roundResult.ok) { emit('error', { message: roundResult.error }); return; }

    if (roundResult.toolCalls.length > 0) {
      history.push({ role: 'assistant', content: roundResult.content || null, tool_calls: roundResult.toolCalls });

      for (const tc of roundResult.toolCalls) {
        if (signal?.aborted) return;
        const toolName = tc.function.name;
        let   toolArgs = {};
        try { toolArgs = JSON.parse(tc.function.arguments || '{}'); } catch {}
        emit('tool_call', { id: tc.id, name: toolName, args: toolArgs });
        let toolResult;
        const cached = toolCache.has(toolName, toolArgs);
        if (cached) {
          toolResult = toolCache.get(toolName, toolArgs);
        } else {
          try { toolResult = await registry.execute(toolName, toolArgs); }
          catch (e) { toolResult = JSON.stringify({ error: e.message }); }
          toolCache.set(toolName, toolArgs, toolResult);
        }
        emit('tool_result', { id: tc.id, name: toolName, result: toolResult, cached });
        history.push({ role: 'tool', tool_call_id: tc.id, name: toolName, content: toolResult });
      }
      continue;
    }

    emit('done', { model: actualModel, provider, elapsed: Date.now() - t0, ...usage });
    return;
  }
  emit('error', { message: 'Max tool-calling rounds reached' });
}

// ─────────────────────────────────────────────────────────────────────────────
// § HTTP SERVER
// ─────────────────────────────────────────────────────────────────────────────

function setCORS(res) {
  // Note: permissive CORS because the UI is served from file:// or a different origin.
  // The server binds to localhost by default (see HOST env var).
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Api-Keys');
}
function sendJSON(res, status, data) {
  setCORS(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}
function readBody(req, maxBytes = 50 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > maxBytes) { req.destroy(); reject(new Error('Payload too large')); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { resolve({}); }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'OPTIONS') { setCORS(res); res.writeHead(204); res.end(); return; }

  try {
    // ── HEALTH
    if (req.method === 'GET' && url.pathname === '/health') {
      const apiKeys = getApiKeys(req);
      const customProviders = getCustomProviders(req);
      const cloudChecks = {};
      for (const [name, cfg] of Object.entries(CLOUD_PROVIDERS)) {
        const key = apiKeys[cfg.keyProp];
        if (key) {
          cloudChecks[name] = httpsGet(cfg.hostname, cfg.modelsPath || '/v1/models', buildCloudHeaders(name, key), 5000);
        }
      }
      const [ol, lm] = await Promise.allSettled([
        httpGet(CONFIG.providers.ollama.host,   CONFIG.providers.ollama.port,   '/api/tags'),
        httpGet(CONFIG.providers.lmstudio.host, CONFIG.providers.lmstudio.port, '/v1/models'),
      ]);
      const cloudStatuses = {};
      for (const [name, promise] of Object.entries(cloudChecks)) {
        try { const r = await promise; cloudStatuses[name] = (r.ok || r.status === 200) ? 'online' : 'offline'; }
        catch { cloudStatuses[name] = 'offline'; }
      }
      for (const name of Object.keys(CLOUD_PROVIDERS)) {
        if (!(name in cloudStatuses)) cloudStatuses[name] = apiKeys[CLOUD_PROVIDERS[name].keyProp] ? 'offline' : 'no-key';
      }
      // Custom provider health checks
      const customStatuses = {};
      for (const cp of customProviders) {
        if (!cp.id || !cp.url) continue;
        try {
          const parsedUrl = new URL(cp.url);
          const isHttps = parsedUrl.protocol === 'https:';
          const cpHeaders = cp.key ? { Authorization: `Bearer ${cp.key}` } : {};
          const cpPort = parsedUrl.port ? parseInt(parsedUrl.port) : (isHttps ? 443 : 80);
          const r = isHttps
            ? await httpsGet(parsedUrl.hostname, '/v1/models', cpHeaders, 4000)
            : await httpGet(parsedUrl.hostname, cpPort, '/v1/models', 4000);
          customStatuses[`custom_${cp.id}`] = r.ok ? 'online' : 'offline';
        } catch { customStatuses[`custom_${cp.id}`] = 'offline'; }
      }
      sendJSON(res, 200, {
        proxy: 'running', version: '3.1', port: PORT,
        providers: {
          ollama:   ol.status === 'fulfilled' && ol.value.ok ? 'online' : 'offline',
          lmstudio: lm.status === 'fulfilled' && lm.value.ok ? 'online' : 'offline',
          ...cloudStatuses,
          ...customStatuses,
        },
        tools: registry.getStatus(),
        rag:   { enabled: CONFIG.rag?.enabled, collections: rag.listCollections().length },
      });
      return;
    }

    // ── MODELS
    if (req.method === 'GET' && url.pathname === '/v1/models') {
      const apiKeys = getApiKeys(req);
      const customProviders = getCustomProviders(req);
      sendJSON(res, 200, { object: 'list', data: await fetchAllModels(apiKeys, customProviders) }); return;
    }

    // ── TOOLS
    if (req.method === 'GET' && url.pathname === '/v1/tools') {
      sendJSON(res, 200, registry.getStatus()); return;
    }

    // ── SYSTEM INFO (memory, CPU)
    if (req.method === 'GET' && url.pathname === '/v1/system') {
      const sysInfo = getSystemInfo();
      const running = await getRunningModels();
      sendJSON(res, 200, { system: sysInfo, running_models: running });
      return;
    }

    // ── RUNNING MODELS (what's loaded in RAM/VRAM)
    if (req.method === 'GET' && url.pathname === '/v1/models/running') {
      sendJSON(res, 200, { models: await getRunningModels() });
      return;
    }

    // ── CHAT (SSE)
    if (req.method === 'POST' && url.pathname === '/v1/chat') {
      const apiKeys = getApiKeys(req);
      const customProviders = getCustomProviders(req);
      const body = await readBody(req);
      const { model, messages, temperature, max_tokens, use_tools = true, top_p, top_k, repeat_penalty, frequency_penalty, stop, seed, ctx_len } = body;
      if (!model || !messages) { sendJSON(res, 400, { error: 'model and messages required' }); return; }
      if (!resolveProvider(model)) await fetchAllModels(apiKeys, customProviders);
      const stopSequences = parseStopSequences(stop);
      const seedValue = parseSeed(seed);
      const numCtx = parseContextLength(ctx_len);

      setCORS(res);
      res.writeHead(200, {
        'Content-Type':  'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection':    'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      const signal = { aborted: false, onAbort: null };
      req.on('close', () => { signal.aborted = true; if (signal.onAbort) try { signal.onAbort(); } catch {} });
      const emit = (type, payload) => {
        if (signal.aborted) return;
        try { res.write(`data: ${JSON.stringify({ type, ...payload })}\n\n`); } catch {}
      };
      console.log(`[Chat] ${model} | provider:${resolveProvider(model)} | tools:${use_tools} | msgs:${messages.length}`);
      await runAgentLoop({ model, messages, temperature, max_tokens, top_p, top_k, repeat_penalty, frequency_penalty, stop: stopSequences, seed: seedValue, numCtx, useTools: use_tools, apiKeys, customProviders, emit, signal });
      try { res.end(); } catch {}
      return;
    }

    // ── PASSTHROUGH (non-streaming OpenAI-compatible passthrough)
    if (req.method === 'POST' && url.pathname === '/v1/chat/completions') {
      const apiKeys = getApiKeys(req);
      const customProviders = getCustomProviders(req);
      const body = await readBody(req);
      const { model } = body;
      if (!resolveProvider(model)) await fetchAllModels(apiKeys, customProviders);
      const provider = resolveProvider(model);
      if (!provider) { sendJSON(res, 404, { error: { message: `Model "${model}" not found` } }); return; }

      // Strip stream:true — passthrough is non-streaming. Streaming clients should use /v1/chat.
      const { stream: _stream, ...rest } = body;
      const upstreamBody = { ...rest, model: stripPrefix(model) };

      if (provider?.startsWith('custom_')) {
        const cpConfig = customProviderConfigs.get(provider);
        if (!cpConfig) { sendJSON(res, 404, { error: { message: `Custom provider "${provider}" not found` } }); return; }
        const cpHeaders = { 'Content-Type': 'application/json', ...(cpConfig.key ? { Authorization: `Bearer ${cpConfig.key}` } : {}) };
        try {
          const parsedUrl = new URL(cpConfig.url);
          const isHttps = parsedUrl.protocol === 'https:';
          const cpPort = parsedUrl.port ? parseInt(parsedUrl.port) : (isHttps ? 443 : 80);
          let result;
          if (isHttps) {
            result = await httpsPost(parsedUrl.hostname, '/v1/chat/completions', upstreamBody, cpHeaders);
          } else {
            result = await httpPost(parsedUrl.hostname, cpPort, '/v1/chat/completions', upstreamBody);
          }
          sendJSON(res, result.status, result.data);
        } catch (e) { sendJSON(res, 502, { error: { message: e.message } }); }
        return;
      }

      if (provider in CLOUD_PROVIDERS) {
        const cfg = CLOUD_PROVIDERS[provider];
        const apiKey = apiKeys[cfg.keyProp];
        if (!apiKey) {
          sendJSON(res, 401, { error: { message: `No API key for ${provider}. Add it in Settings → API Keys.` } });
          return;
        }
        const headers = buildCloudHeaders(provider, apiKey);

        if (provider === 'anthropic') {
          const { system, messages: anthropicMsgs } = convertToAnthropicMessages(upstreamBody.messages || []);
          const anthBody = { model: upstreamBody.model, messages: anthropicMsgs, max_tokens: upstreamBody.max_tokens ?? 2048 };
          if (system)                          anthBody.system      = system;
          if (upstreamBody.temperature != null) anthBody.temperature = upstreamBody.temperature;
          if (upstreamBody.top_p       != null) anthBody.top_p       = upstreamBody.top_p;
          const passthroughStop = parseStopSequences(upstreamBody.stop);
          if (passthroughStop.length) anthBody.stop_sequences = passthroughStop;
          if (Array.isArray(upstreamBody.tools) && upstreamBody.tools.length) {
            anthBody.tools = upstreamBody.tools.map(t => ({
              name: t.function.name,
              description: t.function.description,
              input_schema: t.function.parameters,
            }));
          }
          const r = await httpsPost(cfg.hostname, cfg.chatPath, anthBody, headers);
          if (r.status >= 400 || !r.data) { sendJSON(res, r.status || 502, r.data || { error: { message: 'upstream error' } }); return; }
          sendJSON(res, 200, convertAnthropicResponseToOpenAI(r.data, model));
          return;
        }

        const r = await httpsPost(cfg.hostname, cfg.chatPath, upstreamBody, headers);
        sendJSON(res, r.status || 502, r.data);
        return;
      }

      const cfg = CONFIG.providers[provider];
      const result = await httpPost(cfg.host, cfg.port, '/v1/chat/completions', upstreamBody);
      sendJSON(res, result.status, result.data);
      return;
    }

    // ── RAG: list
    if (req.method === 'GET' && url.pathname === '/v1/rag/collections') {
      sendJSON(res, 200, { collections: rag.listCollections() }); return;
    }

    // ── RAG: upload (SSE progress)
    if (req.method === 'POST' && url.pathname === '/v1/rag/upload') {
      const body = await readBody(req);
      const { collection_id, collection_name, source, text } = body;
      if (!text || !source) { sendJSON(res, 400, { error: 'source and text required' }); return; }

      setCORS(res);
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });
      const emit = (type, payload) => {
        try { res.write(`data: ${JSON.stringify({ type, ...payload })}\n\n`); } catch {}
      };
      try {
        const result = await rag.addDocument({
          collectionId:   collection_id,
          collectionName: collection_name,
          source,
          text,
          onProgress: ({ done, total }) => emit('progress', { done, total }),
        });
        emit('done', result);
      } catch (e) {
        emit('error', { message: e.message });
      }
      try { res.end(); } catch {}
      return;
    }

    // ── RAG: crawl URL and embed into collection
    if (req.method === 'POST' && url.pathname === '/v1/rag/crawl') {
      const body = await readBody(req);
      const { url: crawlUrl, collection_id, collection_name } = body;
      if (!crawlUrl) { sendJSON(res, 400, { error: 'url required' }); return; }

      let parsed;
      try { parsed = new URL(crawlUrl); } catch { sendJSON(res, 400, { error: 'Invalid URL' }); return; }
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        sendJSON(res, 400, { error: `Unsupported protocol: ${parsed.protocol}` }); return;
      }
      if (isPrivateHost(parsed.hostname)) {
        sendJSON(res, 400, { error: `Blocked: cannot fetch private/local addresses (${parsed.hostname})` }); return;
      }

      setCORS(res);
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      });
      const emit = (type, payload) => {
        try { res.write(`data: ${JSON.stringify({ type, ...payload })}\n\n`); } catch {}
      };

      try {
        emit('status', { message: `Fetching ${crawlUrl}…` });

        const rawHtml = await new Promise((resolve, reject) => {
          const TIMEOUT_MS = 15000;
          const MAX_BYTES  = 4 * 1024 * 1024;
          const mod = parsed.protocol === 'https:' ? https : http;
          const r = mod.get(crawlUrl, {
            headers: { 'User-Agent': 'LocalLLMHub/3.1', 'Accept': 'text/html,text/plain,*/*' },
            timeout: TIMEOUT_MS,
          }, (httpRes) => {
            if ([301, 302, 303, 307, 308].includes(httpRes.statusCode) && httpRes.headers.location) {
              try {
                const next = new URL(httpRes.headers.location, crawlUrl);
                if (isPrivateHost(next.hostname)) return reject(new Error('Redirect to private address blocked'));
              } catch { /* ignore */ }
              return reject(new Error(`Redirect to ${httpRes.headers.location} — retry with the final URL`));
            }
            let buf = '', bytes = 0, aborted = false;
            httpRes.on('data', (c) => {
              if (aborted) return;
              bytes += c.length;
              if (bytes > MAX_BYTES) { aborted = true; r.destroy(); return reject(new Error('Page too large (>4 MB)')); }
              buf += c;
            });
            httpRes.on('end', () => { if (!aborted) resolve(buf); });
          });
          r.on('timeout', () => { r.destroy(); reject(new Error('Fetch timed out after 15 s')); });
          r.on('error', reject);
        });

        emit('status', { message: 'Extracting text…' });

        const text = rawHtml
          .replace(/<script[\s\S]*?<\/script>/gi, '')
          .replace(/<style[\s\S]*?<\/style>/gi, '')
          .replace(/<nav[\s\S]*?<\/nav>/gi, '')
          .replace(/<footer[\s\S]*?<\/footer>/gi, '')
          .replace(/<header[\s\S]*?<\/header>/gi, '')
          .replace(/<!--[\s\S]*?-->/g, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/\s{2,}/g, ' ')
          .trim();

        if (!text || text.length < 50) {
          emit('error', { message: 'Could not extract readable text from this page' });
          try { res.end(); } catch {}
          return;
        }

        emit('status', { message: `Embedding ${text.length.toLocaleString()} characters…` });

        const result = await rag.addDocument({
          collectionId:   collection_id || null,
          collectionName: collection_name || (parsed.hostname + parsed.pathname).slice(0, 60),
          source:         crawlUrl,
          text,
          onProgress: ({ done, total }) => emit('progress', { done, total }),
        });
        emit('done', result);
      } catch (e) {
        emit('error', { message: e.message });
      }
      try { res.end(); } catch {}
      return;
    }

    // ── RAG: get collection
    if (req.method === 'GET' && url.pathname.startsWith('/v1/rag/collections/')) {
      const id = url.pathname.split('/').pop();
      const col = rag.getCollection(id);
      if (!col) { sendJSON(res, 404, { error: 'not found' }); return; }
      sendJSON(res, 200, {
        id: col.id, name: col.name, createdAt: col.createdAt,
        chunks: (col.chunks || []).map(c => ({ id: c.id, source: c.source, preview: c.text.slice(0, 200) })),
      });
      return;
    }

    // ── RAG: delete
    if (req.method === 'DELETE' && url.pathname.startsWith('/v1/rag/collections/')) {
      const id = url.pathname.split('/').pop();
      rag.deleteCollection(id);
      sendJSON(res, 200, { ok: true }); return;
    }

    // ── RAG: query
    if (req.method === 'POST' && url.pathname === '/v1/rag/query') {
      const body = await readBody(req);
      const { collection_id, query, top_k } = body;
      try {
        const results = await rag.query({ collectionId: collection_id, query, topK: top_k });
        sendJSON(res, 200, { results });
      } catch (e) { sendJSON(res, 500, { error: e.message }); }
      return;
    }

    // ── WHISPER: audio transcription
    if (req.method === 'POST' && url.pathname === '/v1/audio/transcribe') {
      const whisperCfg = CONFIG.whisper;
      if (!whisperCfg?.enabled) {
        sendJSON(res, 400, { error: 'Whisper not enabled. Set whisper.enabled=true in config.json and run a local Whisper server.' });
        return;
      }

      // Read raw body (multipart audio data) and forward to Whisper server
      const chunks = [];
      let totalSize = 0;
      const MAX_AUDIO = 25 * 1024 * 1024; // 25MB max
      await new Promise((resolve, reject) => {
        req.on('data', (c) => {
          totalSize += c.length;
          if (totalSize > MAX_AUDIO) { reject(new Error('Audio too large (max 25MB)')); return; }
          chunks.push(c);
        });
        req.on('end', resolve);
        req.on('error', reject);
      });
      const rawBody = Buffer.concat(chunks);

      // Forward to Whisper server (OpenAI-compatible /v1/audio/transcriptions endpoint)
      const whisperHost = whisperCfg.host || 'localhost';
      const whisperPort = whisperCfg.port || 8000;
      const whisperPath = '/v1/audio/transcriptions';

      // We need to forward the Content-Type header (multipart/form-data with boundary)
      const contentType = req.headers['content-type'] || '';

      try {
        const result = await new Promise((resolve, reject) => {
          const whisperReq = http.request({
            hostname: whisperHost, port: whisperPort, path: whisperPath,
            method: 'POST',
            headers: {
              'Content-Type': contentType,
              'Content-Length': rawBody.length,
            },
            timeout: 60000, // 60s timeout for transcription
          }, (whisperRes) => {
            let buf = '';
            whisperRes.on('data', (c) => (buf += c));
            whisperRes.on('end', () => {
              try { resolve({ status: whisperRes.statusCode, data: JSON.parse(buf) }); }
              catch { resolve({ status: whisperRes.statusCode, data: { text: buf } }); }
            });
          });
          whisperReq.on('error', (e) => reject(new Error(`Whisper connection failed: ${e.message}. Is the server running on ${whisperHost}:${whisperPort}?`)));
          whisperReq.on('timeout', () => { whisperReq.destroy(); reject(new Error('Whisper transcription timed out (60s)')); });
          whisperReq.write(rawBody);
          whisperReq.end();
        });

        sendJSON(res, result.status, result.data);
      } catch (e) {
        sendJSON(res, 502, { error: e.message });
      }
      return;
    }

    // ── WHISPER: check status
    if (req.method === 'GET' && url.pathname === '/v1/audio/status') {
      const whisperCfg = CONFIG.whisper;
      if (!whisperCfg?.enabled) {
        sendJSON(res, 200, { enabled: false, mode: 'browser' });
        return;
      }
      // Ping the Whisper server
      try {
        const ping = await httpGet(whisperCfg.host || 'localhost', whisperCfg.port || 8000, '/health', 3000);
        sendJSON(res, 200, {
          enabled: true, mode: 'whisper',
          server: `${whisperCfg.host}:${whisperCfg.port}`,
          model: whisperCfg.model || 'large-v3',
          online: ping.ok,
        });
      } catch {
        sendJSON(res, 200, { enabled: true, mode: 'whisper', online: false });
      }
      return;
    }

    // ── CONFIG: read
    if (req.method === 'GET' && url.pathname === '/v1/config') {
      sendJSON(res, 200, CONFIG); return;
    }

    // ── CONFIG: write
    if (req.method === 'POST' && url.pathname === '/v1/config') {
      const body = await readBody(req);
      try {
        if (!body.providers || !body.tools) { sendJSON(res, 400, { error: 'invalid config: providers + tools required' }); return; }
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(body, null, 2));
        CONFIG = body;
        await registry.reload();
        sendJSON(res, 200, { ok: true, reloaded: true, tools: registry.getStatus() });
      } catch (e) {
        sendJSON(res, 500, { error: e.message });
      }
      return;
    }

    // ── MODELS: pull (SSE progress stream from Ollama)
    if (req.method === 'POST' && url.pathname === '/v1/models/pull') {
      const body = await readBody(req);
      const { name } = body;
      if (!name || typeof name !== 'string' || !/^[a-zA-Z0-9_.:/\-]+$/.test(name.trim())) {
        sendJSON(res, 400, { error: 'Valid model name required (e.g. llama3.2, mistral:7b)' });
        return;
      }
      const modelName = name.trim();
      const ollamaCfg = CONFIG.providers.ollama;

      setCORS(res);
      res.writeHead(200, {
        'Content-Type':  'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection':    'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      const emit = (type, payload) => {
        try { res.write(`data: ${JSON.stringify({ type, ...payload })}\n\n`); } catch {}
      };

      console.log(`[Models] Pulling: ${modelName}`);
      const pullBody = JSON.stringify({ name: modelName, stream: true });
      const pullReq = http.request(
        {
          hostname: ollamaCfg.host, port: ollamaCfg.port,
          path: '/api/pull', method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(pullBody) },
        },
        (pullRes) => {
          let lineBuf = '';
          pullRes.on('data', (chunk) => {
            lineBuf += chunk.toString();
            const lines = lineBuf.split('\n');
            lineBuf = lines.pop();
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              try {
                const evt = JSON.parse(trimmed);
                if (evt.error) {
                  emit('error', { message: evt.error });
                } else if (evt.status === 'success') {
                  emit('done', { model: modelName });
                } else {
                  emit('progress', {
                    status:    evt.status    || '',
                    digest:    evt.digest    || '',
                    completed: evt.completed || 0,
                    total:     evt.total     || 0,
                  });
                }
              } catch {}
            }
          });
          pullRes.on('end', () => {
            if (lineBuf.trim()) {
              try {
                const evt = JSON.parse(lineBuf.trim());
                if (evt.status === 'success') emit('done', { model: modelName });
                else if (evt.error)           emit('error', { message: evt.error });
              } catch {}
            }
            try { res.end(); } catch {}
          });
        }
      );
      pullReq.on('error', (e) => {
        emit('error', { message: `Cannot reach Ollama: ${e.message}` });
        try { res.end(); } catch {}
      });
      req.on('close', () => { try { pullReq.destroy(); } catch {} });
      pullReq.write(pullBody);
      pullReq.end();
      return;
    }

    // ── MODELS: delete (Ollama only)
    if (req.method === 'DELETE' && url.pathname.startsWith('/v1/models/')) {
      const rawName = decodeURIComponent(url.pathname.replace('/v1/models/', ''));
      const modelName = rawName.replace(/^ollama\//, '');
      if (!modelName) { sendJSON(res, 400, { error: 'Model name required' }); return; }
      const ollamaCfg = CONFIG.providers.ollama;
      try {
        const deleteBody = JSON.stringify({ name: modelName });
        const result = await new Promise((resolve, reject) => {
          const dr = http.request(
            {
              hostname: ollamaCfg.host, port: ollamaCfg.port,
              path: '/api/delete', method: 'DELETE',
              headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(deleteBody) },
              timeout: 15000,
            },
            (dr2) => {
              let buf = '';
              dr2.on('data', (c) => (buf += c));
              dr2.on('end', () => resolve({ status: dr2.statusCode, body: buf }));
            }
          );
          dr.on('error', reject);
          dr.on('timeout', () => { dr.destroy(new Error('timeout')); });
          dr.write(deleteBody);
          dr.end();
        });
        if (result.status === 200 || result.status === 404) {
          console.log(`[Models] Deleted: ${modelName}`);
          sendJSON(res, 200, { ok: true, model: modelName });
        } else {
          sendJSON(res, result.status, { error: result.body || 'Delete failed' });
        }
      } catch (e) {
        sendJSON(res, 502, { error: `Cannot reach Ollama: ${e.message}` });
      }
      return;
    }

    // ── OPENAPI SPEC
    if (req.method === 'GET' && url.pathname === '/v1/openapi.json') {
      sendJSON(res, 200, buildSpec(PORT)); return;
    }

    // ── SWAGGER UI
    if (req.method === 'GET' && url.pathname === '/v1/docs') {
      const specUrl = `/v1/openapi.json`;
      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>LLM Hub API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css"/>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '${specUrl}',
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: 'BaseLayout',
      deepLinking: true,
      tryItOutEnabled: true,
    });
  </script>
</body>
</html>`;
      setCORS(res);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(html);
      return;
    }

    sendJSON(res, 404, { error: 'Not found' });
  } catch (e) {
    console.error('[Server error]', e);
    try { sendJSON(res, 500, { error: e.message }); } catch {}
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// § STARTUP
// ─────────────────────────────────────────────────────────────────────────────

(async () => {
  await registry.init();

  server.listen(PORT, HOST, () => {
    console.log('\n🤖 Local LLM Hub v3.1');
    console.log('═══════════════════════════════════════════════');
    console.log(`✅ Proxy     → http://${HOST}:${PORT}`);
    console.log(`📡 Ollama    → http://${CONFIG.providers.ollama.host}:${CONFIG.providers.ollama.port}`);
    console.log(`📡 LM Studio → http://${CONFIG.providers.lmstudio.host}:${CONFIG.providers.lmstudio.port}`);
    console.log(`📚 Storage   → ${STORAGE_DIR}`);
    console.log(`🔧 Tools     → ${registry.getStatus().total}`);
    console.log(`🧠 RAG       → ${rag.listCollections().length} collection(s)`);
    if (HOST === '127.0.0.1') {
      console.log(`ℹ️  Bound to localhost only. Set HOST=0.0.0.0 to expose to LAN.`);
    } else {
      console.log(`⚠️  Bound to ${HOST} — accessible from other hosts.`);
    }
    console.log('═══════════════════════════════════════════════\n');
  });

  process.on('SIGINT', () => {
    console.log('\nShutting down…');
    for (const c of registry.mcpClients.values()) c.disconnect();
    process.exit(0);
  });
})();
