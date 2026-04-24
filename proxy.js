#!/usr/bin/env node
/**
 * 🤖 Local LLM Hub — Proxy v3
 * ─────────────────────────────────────────────────────
 * v3 additions:
 *   • RAG (upload/query/list/delete) with ollama embeddings
 *   • run_javascript tool (sandboxed via vm.Script, 3s timeout)
 *   • rag_search tool (model can query its own knowledge base)
 *   • Persistent storage in .llm-hub/
 *   • Config read/write endpoints
 * ─────────────────────────────────────────────────────
 */

const http       = require('http');
const https      = require('https');
const { spawn }  = require('child_process');
const readline   = require('readline');
const fs         = require('fs');
const fsp        = require('fs').promises;
const path       = require('path');
const vm         = require('vm');
const crypto     = require('crypto');
const { URL }    = require('url');

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
const PORT = CONFIG.proxy_port || 8765;

const STORAGE_DIR = path.isAbsolute(CONFIG.storage_dir || '.llm-hub')
  ? CONFIG.storage_dir
  : path.join(__dirname, CONFIG.storage_dir || '.llm-hub');

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

function httpGet(host, port, pathStr) {
  return new Promise((resolve) => {
    const req = http.request({ hostname: host, port, path: pathStr, method: 'GET' }, (res) => {
      let buf = '';
      res.on('data', (c) => (buf += c));
      res.on('end', () => {
        try { resolve({ ok: res.statusCode < 400, data: JSON.parse(buf) }); }
        catch { resolve({ ok: false, data: null }); }
      });
    });
    req.on('error', () => resolve({ ok: false, data: null }));
    req.end();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// § RAG ENGINE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Simple file-based RAG:
 *   • Each collection = one JSON file: { id, name, chunks: [{id, text, embedding, source}], createdAt }
 *   • Embeddings via Ollama /api/embeddings
 *   • Search = cosine similarity over loaded chunks
 */
class RagEngine {
  constructor() {
    this.collections = new Map(); // id → collection object
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
      size:      JSON.stringify(c).length,
    }));
  }

  getCollection(id) { return this.collections.get(id); }

  deleteCollection(id) {
    this.collections.delete(id);
    const p = path.join(RAG_DIR, `${id}.json`);
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  /** Split text into overlapping chunks by paragraph/sentence heuristic */
  chunkText(text, chunkSize, overlap) {
    const clean = text.replace(/\r\n/g, '\n').trim();
    if (!clean) return [];
    if (clean.length <= chunkSize) return [clean];

    // Split on double newlines, then greedily pack
    const paragraphs = clean.split(/\n\n+/);
    const chunks = [];
    let current = '';

    for (const p of paragraphs) {
      if ((current + '\n\n' + p).length > chunkSize && current) {
        chunks.push(current.trim());
        // overlap: keep tail of previous chunk
        current = current.slice(Math.max(0, current.length - overlap)) + '\n\n' + p;
      } else {
        current = current ? current + '\n\n' + p : p;
      }
    }
    if (current.trim()) chunks.push(current.trim());

    // If a single paragraph is still too big, hard-split it
    const finalChunks = [];
    for (const c of chunks) {
      if (c.length <= chunkSize * 1.5) finalChunks.push(c);
      else {
        for (let i = 0; i < c.length; i += chunkSize - overlap) {
          finalChunks.push(c.slice(i, i + chunkSize));
        }
      }
    }
    return finalChunks;
  }

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

  static cosine(a, b) {
    let dot = 0, na = 0, nb = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) { dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
    const denom = Math.sqrt(na) * Math.sqrt(nb);
    return denom === 0 ? 0 : dot / denom;
  }

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
    description: 'Evaluate a math expression. Supports +,-,*,/,**,%, Math.*',
    input_schema: {
      type: 'object',
      properties: { expression: { type: 'string', description: 'Math expression' } },
      required: ['expression'],
    },
  },
  web_search: {
    name: 'web_search',
    description: 'Search the web via DuckDuckGo.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
  fetch_url: {
    name: 'fetch_url',
    description: 'Fetch plain text content of a URL.',
    input_schema: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        max_chars: { type: 'number', description: 'default 3000' },
      },
      required: ['url'],
    },
  },
  run_javascript: {
    name: 'run_javascript',
    description: 'Execute JavaScript in a sandboxed VM (3s timeout, no network, no fs). Returns the final expression value.',
    input_schema: {
      type: 'object',
      properties: {
        code: { type: 'string', description: 'JS code to execute. Last expression is returned.' },
      },
      required: ['code'],
    },
  },
  rag_search: {
    name: 'rag_search',
    description: 'Search the user\'s uploaded knowledge base (RAG). Returns top matching chunks.',
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

  calculator({ expression }) {
    try {
      const safe = expression.replace(/[^0-9+\-*/%.()Math.,a-zA-Z\s]/g, '');
      const result = new Function(`"use strict"; return (${safe})`)();
      return JSON.stringify({ expression, result });
    } catch (e) {
      return JSON.stringify({ error: `Cannot evaluate: ${e.message}` });
    }
  },

  web_search({ query }) {
    return new Promise((resolve) => {
      const reqUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
      https.get(reqUrl, { headers: { 'User-Agent': 'LocalLLMHub/3.0' } }, (res) => {
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
      }).on('error', (e) => resolve(JSON.stringify({ error: e.message })));
    });
  },

  fetch_url({ url, max_chars = 3000 }) {
    return new Promise((resolve) => {
      try {
        const parsed = new URL(url);
        const mod = parsed.protocol === 'https:' ? https : http;
        mod.get(url, { headers: { 'User-Agent': 'LocalLLMHub/3.0' } }, (res) => {
          let body = '';
          res.on('data', (c) => (body += c));
          res.on('end', () => {
            const text = body.replace(/<script[\s\S]*?<\/script>/gi, '')
                             .replace(/<style[\s\S]*?<\/style>/gi, '')
                             .replace(/<[^>]+>/g, ' ')
                             .replace(/\s+/g, ' ').trim().slice(0, max_chars);
            resolve(JSON.stringify({ url, content: text, truncated: body.length > max_chars }));
          });
        }).on('error', (e) => resolve(JSON.stringify({ error: e.message })));
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
      clientInfo:      { name: 'local-llm-hub', version: '3.0' },
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

const modelRegistry = new Map();

function resolveProvider(m) {
  if (m?.startsWith('ollama/'))   return 'ollama';
  if (m?.startsWith('lmstudio/')) return 'lmstudio';
  return modelRegistry.get(m) || null;
}
function stripPrefix(m) { return m?.replace(/^(ollama|lmstudio)\//, '') || m; }

async function fetchAllModels() {
  modelRegistry.clear();
  const all = [];
  const ol = await httpGet(CONFIG.providers.ollama.host, CONFIG.providers.ollama.port, '/api/tags');
  if (ol.ok && ol.data?.models) for (const m of ol.data.models) {
    const id = `ollama/${m.name}`;
    modelRegistry.set(id, 'ollama'); modelRegistry.set(m.name, 'ollama');
    all.push({ id, object: 'model', owned_by: 'ollama', created: Date.now() });
  }
  const lm = await httpGet(CONFIG.providers.lmstudio.host, CONFIG.providers.lmstudio.port, '/v1/models');
  if (lm.ok && lm.data?.data) for (const m of lm.data.data) {
    const id = `lmstudio/${m.id}`;
    modelRegistry.set(id, 'lmstudio'); modelRegistry.set(m.id, 'lmstudio');
    all.push({ id, object: 'model', owned_by: 'lmstudio', created: m.created || Date.now() });
  }
  return all;
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

// ─────────────────────────────────────────────────────────────────────────────
// § AGENT LOOP
// ─────────────────────────────────────────────────────────────────────────────

async function runAgentLoop({ model, messages, temperature, max_tokens, useTools, emit, signal }) {
  const provider = resolveProvider(model);
  if (!provider) { emit('error', { message: `Model "${model}" not found` }); return; }

  const cfg         = CONFIG.providers[provider];
  const actualModel = stripPrefix(model);
  const tools       = useTools ? registry.getOpenAITools() : [];
  let   history     = [...messages];
  const MAX_ROUNDS  = 8;
  const t0          = Date.now();
  const usage       = { prompt_tokens: 0, completion_tokens: 0 };

  for (let round = 0; round < MAX_ROUNDS; round++) {
    if (signal?.aborted) return;

    const body = {
      model:       actualModel,
      messages:    history,
      temperature: temperature ?? 0.7,
      max_tokens:  max_tokens  ?? 2048,
    };
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
        try { toolResult = await registry.execute(toolName, toolArgs); }
        catch (e) { toolResult = JSON.stringify({ error: e.message }); }
        emit('tool_result', { id: tc.id, name: toolName, result: toolResult });
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
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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
      const [ol, lm] = await Promise.allSettled([
        httpGet(CONFIG.providers.ollama.host,   CONFIG.providers.ollama.port,   '/api/tags'),
        httpGet(CONFIG.providers.lmstudio.host, CONFIG.providers.lmstudio.port, '/v1/models'),
      ]);
      sendJSON(res, 200, {
        proxy: 'running', version: '3.0', port: PORT,
        providers: {
          ollama:   ol.status === 'fulfilled' && ol.value.ok ? 'online' : 'offline',
          lmstudio: lm.status === 'fulfilled' && lm.value.ok ? 'online' : 'offline',
        },
        tools: registry.getStatus(),
        rag:   { enabled: CONFIG.rag?.enabled, collections: rag.listCollections().length },
      });
      return;
    }

    // ── MODELS
    if (req.method === 'GET' && url.pathname === '/v1/models') {
      sendJSON(res, 200, { object: 'list', data: await fetchAllModels() }); return;
    }

    // ── TOOLS
    if (req.method === 'GET' && url.pathname === '/v1/tools') {
      sendJSON(res, 200, registry.getStatus()); return;
    }

    // ── CHAT (SSE)
    if (req.method === 'POST' && url.pathname === '/v1/chat') {
      const body = await readBody(req);
      const { model, messages, temperature, max_tokens, use_tools = true } = body;
      if (!model || !messages) { sendJSON(res, 400, { error: 'model and messages required' }); return; }
      if (!resolveProvider(model)) await fetchAllModels();

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
      console.log(`[Chat] ${model} | tools:${use_tools} | msgs:${messages.length}`);
      await runAgentLoop({ model, messages, temperature, max_tokens, useTools: use_tools, emit, signal });
      try { res.end(); } catch {}
      return;
    }

    // ── PASSTHROUGH
    if (req.method === 'POST' && url.pathname === '/v1/chat/completions') {
      const body = await readBody(req);
      const { model } = body;
      if (!resolveProvider(model)) await fetchAllModels();
      const provider = resolveProvider(model);
      if (!provider) { sendJSON(res, 404, { error: { message: `Model "${model}" not found` } }); return; }
      const cfg = CONFIG.providers[provider];
      const result = await httpPost(cfg.host, cfg.port, '/v1/chat/completions', { ...body, model: stripPrefix(model) });
      sendJSON(res, result.status, result.data);
      return;
    }

    // ── RAG: list
    if (req.method === 'GET' && url.pathname === '/v1/rag/collections') {
      sendJSON(res, 200, { collections: rag.listCollections() }); return;
    }

    // ── RAG: upload (supports streaming progress via SSE)
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

    // ── CONFIG: read
    if (req.method === 'GET' && url.pathname === '/v1/config') {
      sendJSON(res, 200, CONFIG); return;
    }

    // ── CONFIG: write (and reload MCP/tools)
    if (req.method === 'POST' && url.pathname === '/v1/config') {
      const body = await readBody(req);
      try {
        // Basic validation
        if (!body.providers || !body.tools) { sendJSON(res, 400, { error: 'invalid config' }); return; }
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(body, null, 2));
        CONFIG = body;
        await registry.reload();
        sendJSON(res, 200, { ok: true, reloaded: true, tools: registry.getStatus() });
      } catch (e) {
        sendJSON(res, 500, { error: e.message });
      }
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

  server.listen(PORT, () => {
    console.log('\n🤖 Local LLM Hub v3');
    console.log('═══════════════════════════════════════════════');
    console.log(`✅ Proxy     → http://localhost:${PORT}`);
    console.log(`📡 Ollama    → http://localhost:${CONFIG.providers.ollama.port}`);
    console.log(`📡 LM Studio → http://localhost:${CONFIG.providers.lmstudio.port}`);
    console.log(`📚 Storage   → ${STORAGE_DIR}`);
    console.log(`🔧 Tools     → ${registry.getStatus().total}`);
    console.log(`🧠 RAG       → ${rag.listCollections().length} collection(s)`);
    console.log('═══════════════════════════════════════════════');
    console.log('Routes:');
    console.log('  GET/POST  /v1/chat            (SSE, agent loop)');
    console.log('  GET       /v1/models');
    console.log('  GET       /v1/tools');
    console.log('  GET/POST  /v1/config          (reload MCP)');
    console.log('  GET       /v1/rag/collections');
    console.log('  POST      /v1/rag/upload      (SSE progress)');
    console.log('  POST      /v1/rag/query');
    console.log('  DELETE    /v1/rag/collections/:id');
    console.log('═══════════════════════════════════════════════\n');
  });

  process.on('SIGINT', () => {
    console.log('\nShutting down…');
    for (const c of registry.mcpClients.values()) c.disconnect();
    process.exit(0);
  });
})();
