/* ═══════════════════════════════════════════════════════════════════════════
   Local LLM Hub v3 — app.js
   Full frontend logic: streaming, tools, RAG, compare, templates,
   config editor, message actions, artifacts, syntax highlighting,
   search, theme, hotkeys, token counter.
   ═══════════════════════════════════════════════════════════════════════════ */

const PROXY = 'http://localhost:8765';

// ─────────────────────────────────────────────────────────────────────────────
// § STATE
// ─────────────────────────────────────────────────────────────────────────────

let conversations  = JSON.parse(localStorage.getItem('llm-convs')     || '[]');
let userPresets    = JSON.parse(localStorage.getItem('llm-presets')   || '{}');
let templates      = JSON.parse(localStorage.getItem('llm-templates') || 'null') || defaultTemplates();
let userSettings   = JSON.parse(localStorage.getItem('llm-settings')  || '{"theme":"dark"}');

// ── API key helpers (stored in localStorage, sent to proxy via header only)
function getStoredApiKeys() {
  try { return JSON.parse(localStorage.getItem('llm-api-keys') || '{}'); } catch { return {}; }
}
function apiKeyHeader() {
  const keys = getStoredApiKeys();
  if (!Object.keys(keys).length) return {};
  return { 'X-Api-Keys': JSON.stringify(keys) };
}

let currentConvId        = null;
let selectedModel        = null;
let availableModels      = [];
let modelMetadata        = {};  // { modelId: { context_length, parameter_size, size_label, ... } }
let runningModels        = [];  // models currently loaded in RAM/VRAM
let availableRagCollections = [];
let isLoading            = false;
let activeAbortController = null;
let attachments          = [];                   // [{ dataUrl, name }]

// Compare mode
let compareMode          = false;
let compareModelA        = null;
let compareModelB        = null;
let compareActiveCount   = 0;
let compareAbortA        = null;
let compareAbortB        = null;

// Template edit state
let editingTemplateId    = null;
let activeRunTemplateId  = null;

// Search state
let searchSelectedIdx    = 0;
let searchMatches        = [];

// Edit state
let editingMessageIdx    = null;

// ─────────────────────────────────────────────────────────────────────────────
// § DEFAULTS
// ─────────────────────────────────────────────────────────────────────────────

const BUILT_IN_PRESETS = {
  'Code Assistant':  'You are an expert senior software engineer. Help with code, explain trade-offs clearly, and write clean, production-ready solutions. Prefer correctness and clarity over cleverness.',
  'Code Reviewer':   'You are a principal-level code reviewer. Find bugs, security issues, race conditions, and design smells. Suggest concrete improvements with examples. Be direct but constructive.',
  'Translator':      'You are a professional translator fluent in Arabic and English. Translate accurately while preserving tone, register, and cultural context. Explain only when absolutely necessary.',
  'Concise':         'Respond concisely and directly. No fluff, no restating the question, no filler phrases. Get to the point.',
  'Brainstorm':      'You are a creative thinking partner. Generate diverse, unexpected ideas. Build on directions the user shows interest in. Ask one sharp follow-up per turn, max.',
  'Rubber Duck':     'You are a patient debugging partner. Let the user think out loud. Ask clarifying questions that help them discover the answer themselves. Do not jump to solutions.',
};

function defaultTemplates() {
  return [
    {
      id: 't_refactor',
      name: 'Refactor Code',
      description: 'Refactor code for clarity and maintainability',
      tags: ['code', 'refactor'],
      body: 'Refactor this {{language}} code for clarity and maintainability. Keep behavior identical. Explain the key changes afterwards.\n\n```{{language}}\n{{code}}\n```',
    },
    {
      id: 't_explain',
      name: 'Explain Code',
      description: 'Walk me through what this code does',
      tags: ['code', 'learn'],
      body: 'Explain what this code does, step by step. Focus on anything non-obvious.\n\n```\n{{code}}\n```',
    },
    {
      id: 't_bugfix',
      name: 'Debug Issue',
      description: 'Help find and fix a bug',
      tags: ['code', 'debug'],
      body: 'I have this bug:\n\n**Error:**\n{{error}}\n\n**Code:**\n```\n{{code}}\n```\n\n**What I tried:**\n{{tried}}\n\nFind the root cause and suggest a fix.',
    },
    {
      id: 't_pr',
      name: 'PR Review',
      description: 'Senior review of a pull request diff',
      tags: ['code', 'review'],
      body: 'Review this pull request diff as a senior engineer would. Call out bugs, security risks, design smells, and missing tests. Be direct.\n\n```diff\n{{diff}}\n```',
    },
    {
      id: 't_translate',
      name: 'Translate AR↔EN',
      description: 'Translate between Arabic and English',
      tags: ['language'],
      body: 'Translate the following to {{target_lang}}, keeping tone and nuance:\n\n{{text}}',
    },
    {
      id: 't_summarize',
      name: 'Summarize',
      description: 'Concise summary with key points',
      tags: ['writing'],
      body: 'Summarize the following into a concise bullet list of key points. No preamble.\n\n{{text}}',
    },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// § INIT
// ─────────────────────────────────────────────────────────────────────────────

async function init() {
  applyTheme(userSettings.theme || 'dark');
  await checkHealth();
  await loadModels();
  await loadTools();
  await loadRagCollections();
  await loadSystemInfo();
  initPresets();
  initDragDrop();
  initHotkeys();
  initVoice();
  renderConvList();
  if (!conversations.length) newConversation();
  else loadConversation(conversations[0].id);
  updateInputTokenCount();
  setInterval(checkHealth, 30000);
  setInterval(loadSystemInfo, 15000);  // Refresh system RAM + running models
}

async function checkHealth() {
  try {
    const res  = await fetch(`${PROXY}/health`, { headers: apiKeyHeader() });
    const data = await res.json();
    setStatus('b-ollama',   data.providers?.ollama   === 'online');
    setStatus('b-lmstudio', data.providers?.lmstudio === 'online');
    setCloudStatus('b-openai',     data.providers?.openai);
    setCloudStatus('b-anthropic',  data.providers?.anthropic);
    setCloudStatus('b-groq',       data.providers?.groq);
    setCloudStatus('b-openrouter', data.providers?.openrouter);
    document.getElementById('proxy-alert').style.display = 'none';
  } catch {
    document.getElementById('proxy-alert').style.display = 'block';
  }
}
function setStatus(id, online) {
  const el = document.getElementById(id);
  if (el) el.className = `status-dot ${online ? 'online' : 'offline'}`;
}
function setCloudStatus(id, status) {
  const el = document.getElementById(id);
  if (!el) return;
  const cls = status === 'online' ? 'online' : status === 'offline' ? 'offline' : 'no-key';
  el.className = `status-dot cloud-dot ${cls}`;
  const hint = status === 'no-key' ? 'Add API key in Settings' : status === 'online' ? 'Connected' : 'Key invalid or offline';
  el.title = `${el.querySelector('span')?.textContent || ''} — ${hint}`;
}

async function loadModels() {
  try {
    const res  = await fetch(`${PROXY}/v1/models`, { headers: apiKeyHeader() });
    const data = await res.json();
    availableModels = data.data || [];

    // Store metadata for each model
    modelMetadata = {};
    for (const m of availableModels) {
      modelMetadata[m.id] = {
        context_length: m.context_length || null,
        parameter_size: m.parameter_size || null,
        quantization:   m.quantization || null,
        size_label:     m.size_label || null,
        family:         m.family || null,
      };
    }

    fillModelSelect(document.getElementById('model-select'));
    fillModelSelect(document.getElementById('compare-model-a'));
    fillModelSelect(document.getElementById('compare-model-b'));
    document.getElementById('model-loading').style.display = 'none';
    document.getElementById('model-select').style.display  = 'block';

    // Also check running models
    await checkRunningModels();
  } catch {
    document.getElementById('model-loading').innerHTML =
      '<span style="color:var(--orange)">Cannot reach proxy</span>';
  }
}

async function checkRunningModels() {
  try {
    const res = await fetch(`${PROXY}/v1/models/running`);
    const data = await res.json();
    runningModels = (data.models || []).map(m => m.id || m.name);
  } catch {
    runningModels = [];
  }
}

const MODEL_ID_PREFIX_RE = /^(ollama|lmstudio|openai|anthropic|groq|openrouter)\//;

function parseModelId(modelId) {
  const provider = modelId?.split('/')[0] || null;
  const name     = (modelId || '').replace(MODEL_ID_PREFIX_RE, '');
  return { provider, name };
}

const PROVIDER_LABELS = {
  ollama:     '🟠 Ollama',
  lmstudio:   '🟣 LM Studio',
  openai:     '🟢 OpenAI',
  anthropic:  '🟡 Anthropic',
  groq:       '🔵 Groq',
  openrouter: '🔴 OpenRouter',
};

// ─────────────────────────────────────────────────────────────────────────────
// § MODEL CAPABILITY & FAMILY DETECTION
// ─────────────────────────────────────────────────────────────────────────────

const CAP_LABELS = {
  vision:     { label: 'vision',   title: 'Accepts image/vision input' },
  code:       { label: 'code',     title: 'Code-specialist model' },
  'long-ctx': { label: 'long-ctx', title: 'Long context window (≥32K tokens)' },
  tools:      { label: 'tools',    title: 'Supports function/tool calling' },
};

function detectModelCapabilities(modelId, meta) {
  const n = (modelId || '').toLowerCase().replace(/^(ollama|lmstudio|openai|anthropic|groq|openrouter)\//, '');
  const caps = [];
  if (/\b(vision|vl|llava|bakllava|pixtral|moondream|cogvlm|internvl|minicpm-v)\b/.test(n) ||
      /qwen[^/]*vl|llama[^/]*vision|mistral[^/]*pixtral/.test(n)) {
    caps.push('vision');
  }
  if (/\b(code|coder|starcoder|codellama|devstral)\b/.test(n) ||
      /qwen[^/]*coder|deepseek[^/]*code/.test(n)) {
    caps.push('code');
  }
  if ((meta?.context_length || 0) >= 32768) {
    caps.push('long-ctx');
  }
  if (/\b(llama-?3|qwen2|mistral|mixtral|command-r|gemma2?|phi-?[34]|hermes|functionary|nous)\b/.test(n)) {
    caps.push('tools');
  }
  return caps;
}

function detectModelFamily(modelId) {
  const n = (modelId || '').toLowerCase().replace(/^(ollama|lmstudio|openai|anthropic|groq|openrouter)\//, '');
  if (/llama/.test(n))              return 'Llama';
  if (/qwen/.test(n))               return 'Qwen';
  if (/mistral|mixtral|devstral/.test(n)) return 'Mistral';
  if (/gemma/.test(n))              return 'Gemma';
  if (/phi/.test(n))                return 'Phi';
  if (/deepseek/.test(n))           return 'DeepSeek';
  if (/starcoder|codellama/.test(n)) return 'Code';
  if (/command-r/.test(n))          return 'Command-R';
  if (/claude/.test(n))             return 'Claude';
  if (/gpt/.test(n))                return 'GPT';
  if (/\bo[1-9]/.test(n))           return 'o-series';
  if (/nomic|bge|embed|whisper/.test(n)) return 'Embedding';
  return 'Other';
}

const CAP_ICONS = { vision: '👁', code: '⌨', 'long-ctx': '∞', tools: '⚙' };

// ── Cloud API pricing (USD per 1M tokens, input / output)
const MODEL_PRICING = {
  // OpenAI
  'gpt-4o-mini':            { in: 0.15,  out: 0.60  },
  'gpt-4o':                 { in: 2.50,  out: 10.00 },
  'gpt-4.1-nano':           { in: 0.10,  out: 0.40  },
  'gpt-4.1-mini':           { in: 0.40,  out: 1.60  },
  'gpt-4.1':                { in: 2.00,  out: 8.00  },
  'o1-mini':                { in: 1.10,  out: 4.40  },
  'o1':                     { in: 15.00, out: 60.00 },
  'o3-mini':                { in: 1.10,  out: 4.40  },
  'o3':                     { in: 10.00, out: 40.00 },
  'o4-mini':                { in: 1.10,  out: 4.40  },
  // Anthropic
  'claude-opus-4':          { in: 15.00, out: 75.00 },
  'claude-sonnet-4':        { in: 3.00,  out: 15.00 },
  'claude-haiku-4':         { in: 0.80,  out: 4.00  },
  'claude-3-5-sonnet':      { in: 3.00,  out: 15.00 },
  'claude-3-5-haiku':       { in: 0.80,  out: 4.00  },
  'claude-3-opus':          { in: 15.00, out: 75.00 },
  'claude-3-sonnet':        { in: 3.00,  out: 15.00 },
  'claude-3-haiku':         { in: 0.25,  out: 1.25  },
  // Groq
  'llama-3.3-70b':          { in: 0.59,  out: 0.79  },
  'llama-3.1-70b':          { in: 0.59,  out: 0.79  },
  'llama-3.1-8b':           { in: 0.05,  out: 0.08  },
  'llama-3.2-90b':          { in: 0.90,  out: 0.90  },
  'llama-3.2-11b':          { in: 0.18,  out: 0.18  },
  'llama-3.2-3b':           { in: 0.06,  out: 0.06  },
  'llama-3.2-1b':           { in: 0.04,  out: 0.04  },
  'deepseek-r1-distill':    { in: 0.75,  out: 0.99  },
  'deepseek-r1':            { in: 0.75,  out: 0.99  },
  'mixtral-8x7b':           { in: 0.24,  out: 0.24  },
  'gemma2-9b':              { in: 0.20,  out: 0.20  },
  'qwen-qwq-32b':           { in: 0.29,  out: 0.39  },
};

function lookupPricing(modelName) {
  const lower = (modelName || '').toLowerCase();
  if (MODEL_PRICING[lower]) return MODEL_PRICING[lower];
  let best = null, bestLen = 0;
  for (const key of Object.keys(MODEL_PRICING)) {
    if (lower.includes(key) && key.length > bestLen) {
      best = MODEL_PRICING[key];
      bestLen = key.length;
    }
  }
  return best;
}

function estimateCost(provider, modelName, promptTokens, completionTokens) {
  const SUPPORTED = new Set(['openai', 'anthropic', 'groq']);
  if (!provider || !SUPPORTED.has(provider)) return null;
  if (!promptTokens && !completionTokens) return null;
  const pricing = lookupPricing(modelName);
  if (!pricing) return null;
  return ((promptTokens || 0) * pricing.in + (completionTokens || 0) * pricing.out) / 1_000_000;
}


function fillModelSelect(sel) {
  if (!sel) return;
  sel.innerHTML = '<option value="">— select model —</option>';
  const groups = {};
  for (const m of availableModels) {
    (groups[m.owned_by] = groups[m.owned_by] || []).push(m);
  }
  const ORDER = ['ollama', 'lmstudio', 'openai', 'anthropic', 'groq', 'openrouter'];
  const sorted = ORDER.filter(p => groups[p]).concat(Object.keys(groups).filter(p => !ORDER.includes(p)));
  for (const p of sorted) {
    const og = document.createElement('optgroup');
    og.label = PROVIDER_LABELS[p] || p;
    // Sort within each provider group by detected family name, then alphabetically
    const sortedModels = [...groups[p]].sort((a, b) => {
      const fa = detectModelFamily(a.id), fb = detectModelFamily(b.id);
      return fa !== fb ? fa.localeCompare(fb) : a.id.localeCompare(b.id);
    });
    for (const m of sortedModels) {
      const o = document.createElement('option');
      o.value = m.id;
      const name = m.id.replace(/^(ollama|lmstudio|openai|anthropic|groq|openrouter)\//, '');
      const meta = modelMetadata[m.id] || {};
      const caps = detectModelCapabilities(m.id, meta);
      const parts = [name];
      if (meta.parameter_size) parts.push(`(${meta.parameter_size})`);
      if (meta.size_label)     parts.push(`[${meta.size_label}]`);
      if (meta.context_length) parts.push(`ctx:${(meta.context_length/1024).toFixed(0)}K`);
      if (caps.length)         parts.push(caps.map(c => CAP_ICONS[c] || c).join(''));
      o.text = parts.join(' ');
      og.appendChild(o);
    }
    sel.appendChild(og);
  }
}

async function loadTools() {
  try {
    const res  = await fetch(`${PROXY}/v1/tools`);
    const data = await res.json();
    const list = document.getElementById('tools-list');
    const countBadge = document.getElementById('tools-count');
    if (!data.tools?.length) {
      list.innerHTML = '<div style="color:var(--muted);font-size:11px;font-family:var(--mono)">No tools loaded</div>';
      if (countBadge) countBadge.textContent = '0';
      return;
    }
    if (countBadge) countBadge.textContent = data.tools.length;
    list.innerHTML = data.tools.map(t => `
      <div class="tool-entry" title="${escHtml(t.desc || '')}">
        ${escHtml(t.name)}
        <span class="tsrc ${t.source === 'built-in' ? 'built-in' : 'mcp'}">${escHtml(t.source)}</span>
      </div>`).join('');
  } catch { /* */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// § MODEL SELECTION
// ─────────────────────────────────────────────────────────────────────────────

async function onModelChange() {
  const prev = selectedModel;
  selectedModel = document.getElementById('model-select').value || null;
  if (prev) saveModelParams(prev);
  await checkRunningModels();
  updateModelHeader();
  updateModelInfoCard();
  loadModelParams(selectedModel);
  document.getElementById('send-btn').disabled = !selectedModel || isLoading;
  updateInputTokenCount();
}

function updateModelHeader() {
  const tag = document.getElementById('chat-model-tag');
  if (!selectedModel) {
    tag.innerHTML = '<span style="color:var(--muted);font-family:var(--mono);font-size:12px">No model selected</span>';
    return;
  }
  const { provider: prov, name } = parseModelId(selectedModel);
  const meta = modelMetadata[selectedModel] || {};
  const isLoaded = runningModels.some(r => r === selectedModel || r === `ollama/${name}` || r.includes(name));

  let infoHtml = `<span style="font-weight:500">${escHtml(name)}</span>`;
  infoHtml += `<span class="provider-pill" data-p="${prov}">${prov}</span>`;

  // Show model info badges
  if (meta.parameter_size) infoHtml += `<span style="font-family:var(--mono);font-size:10px;color:var(--muted);margin-left:4px">${meta.parameter_size}</span>`;
  if (meta.context_length) infoHtml += `<span style="font-family:var(--mono);font-size:10px;color:var(--muted)">ctx:${(meta.context_length/1024).toFixed(0)}K</span>`;

  // Loading status indicator
  if (prov === 'ollama') {
    if (isLoaded) {
      infoHtml += `<span style="font-family:var(--mono);font-size:9px;color:var(--green);background:color-mix(in srgb,var(--green) 12%,transparent);padding:1px 6px;border-radius:3px">● loaded</span>`;
    } else {
      infoHtml += `<span style="font-family:var(--mono);font-size:9px;color:var(--orange);background:color-mix(in srgb,var(--orange) 12%,transparent);padding:1px 6px;border-radius:3px">○ not loaded</span>`;
    }
  }
  tag.innerHTML = infoHtml;
}

// ─────────────────────────────────────────────────────────────────────────────
// § PRESETS
// ─────────────────────────────────────────────────────────────────────────────

function initPresets() {
  const sel = document.getElementById('preset-select');
  sel.innerHTML = '<option value="">— presets —</option>';

  const ogB = document.createElement('optgroup');
  ogB.label = 'Built-in';
  for (const name of Object.keys(BUILT_IN_PRESETS)) {
    const o = document.createElement('option');
    o.value = 'b:' + name; o.text = name;
    ogB.appendChild(o);
  }
  sel.appendChild(ogB);

  if (Object.keys(userPresets).length) {
    const ogU = document.createElement('optgroup');
    ogU.label = 'Custom';
    for (const name of Object.keys(userPresets)) {
      const o = document.createElement('option');
      o.value = 'u:' + name; o.text = name;
      ogU.appendChild(o);
    }
    sel.appendChild(ogU);
  }
}

function applyPreset() {
  const v = document.getElementById('preset-select').value;
  if (!v) return;
  const kind = v.slice(0, 1);
  const name = v.slice(2);
  const content = kind === 'b' ? BUILT_IN_PRESETS[name] : userPresets[name];
  if (content) document.getElementById('sys-input').value = content;
}

function savePreset() {
  const content = document.getElementById('sys-input').value.trim();
  if (!content) return toast('System prompt is empty', 'error');
  const name = prompt('Preset name:');
  if (!name) return;
  userPresets[name.trim()] = content;
  localStorage.setItem('llm-presets', JSON.stringify(userPresets));
  initPresets();
  document.getElementById('preset-select').value = 'u:' + name.trim();
  toast(`Saved preset "${name}"`, 'success');
}

// ─────────────────────────────────────────────────────────────────────────────
// § SAMPLING PRESETS (Precise / Balanced / Creative)
// ─────────────────────────────────────────────────────────────────────────────

const SAMPLING_PROFILES = {
  precise:  { temp: 0.2, topP: 0.9,  topK: 10,  repeat: 1.1, freq: 0.0 },
  balanced: { temp: 0.7, topP: 0.9,  topK: 40,  repeat: 1.0, freq: 0.0 },
  creative: { temp: 1.2, topP: 0.95, topK: 80,  repeat: 0.9, freq: 0.1 },
};

function applySamplingPreset(name) {
  const p = SAMPLING_PROFILES[name];
  if (!p) return;

  const tempSlider = document.getElementById('temp-slider');
  const topPSlider = document.getElementById('top-p-slider');
  const topKSlider = document.getElementById('top-k-slider');
  const repeatSlider = document.getElementById('repeat-slider');
  const freqSlider = document.getElementById('freq-slider');

  tempSlider.value   = p.temp;
  document.getElementById('temp-val').textContent = p.temp.toFixed(2);
  topPSlider.value   = p.topP;
  document.getElementById('top-p-val').textContent = p.topP.toFixed(2);
  topKSlider.value   = p.topK;
  document.getElementById('top-k-val').textContent = p.topK;
  repeatSlider.value = p.repeat;
  document.getElementById('repeat-val').textContent = p.repeat.toFixed(2);
  freqSlider.value   = p.freq;
  document.getElementById('freq-val').textContent = p.freq.toFixed(1);

  document.querySelectorAll('.preset-chip').forEach(b => b.classList.remove('active'));
  document.getElementById(`pchip-${name}`)?.classList.add('active');
}

// ─────────────────────────────────────────────────────────────────────────────
// § PER-MODEL PARAMETER PROFILES
// ─────────────────────────────────────────────────────────────────────────────

const MODEL_PARAMS_STORE = 'llm-hub-model-params';

function getModelParamsStore() {
  try { return JSON.parse(localStorage.getItem(MODEL_PARAMS_STORE) || '{}'); } catch { return {}; }
}

function readCurrentParams() {
  return {
    temp:   parseFloat(document.getElementById('temp-slider')?.value   ?? 0.7),
    maxTok: parseInt(document.getElementById('max-tokens')?.value      ?? 2048, 10),
    topP:   parseFloat(document.getElementById('top-p-slider')?.value  ?? 0.9),
    topK:   parseInt(document.getElementById('top-k-slider')?.value    ?? 40, 10),
    repeat: parseFloat(document.getElementById('repeat-slider')?.value ?? 1.0),
    freq:   parseFloat(document.getElementById('freq-slider')?.value   ?? 0.0),
  };
}

function saveModelParams(modelId) {
  if (!modelId) return;
  const store = getModelParamsStore();
  store[modelId] = readCurrentParams();
  localStorage.setItem(MODEL_PARAMS_STORE, JSON.stringify(store));
}

function loadModelParams(modelId) {
  if (!modelId) return;
  const store = getModelParamsStore();
  const p = store[modelId];
  if (!p) return;

  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

  if (p.temp   !== undefined) { setVal('temp-slider',   p.temp);          setTxt('temp-val',    p.temp.toFixed(2)); }
  if (p.maxTok !== undefined) { setVal('max-tokens',    p.maxTok); }
  if (p.topP   !== undefined) { setVal('top-p-slider',  p.topP);          setTxt('top-p-val',   p.topP.toFixed(2)); }
  if (p.topK   !== undefined) { setVal('top-k-slider',  p.topK);          setTxt('top-k-val',   p.topK); }
  if (p.repeat !== undefined) { setVal('repeat-slider', p.repeat);        setTxt('repeat-val',  p.repeat.toFixed(2)); }
  if (p.freq   !== undefined) { setVal('freq-slider',   p.freq);          setTxt('freq-val',    p.freq.toFixed(1)); }

  // Clear preset chip highlights — restored state may not match any preset
  document.querySelectorAll('.preset-chip').forEach(b => b.classList.remove('active'));
}

// ─────────────────────────────────────────────────────────────────────────────
// § FOCUS MODE
// ─────────────────────────────────────────────────────────────────────────────

function toggleFocusMode() {
  const active = document.body.classList.toggle('focus-mode');
  const btn = document.getElementById('focus-btn');
  if (btn) btn.classList.toggle('active', active);
}

// ─────────────────────────────────────────────────────────────────────────────
// § MOBILE SIDEBAR
// ─────────────────────────────────────────────────────────────────────────────

function toggleMobileSidebar(side) {
  const sidebar = document.querySelector(side === 'left' ? '.sidebar-left' : '.sidebar-right');
  const overlay = document.getElementById('sidebar-overlay');
  if (!sidebar) return;
  const other = document.querySelector(side === 'left' ? '.sidebar-right' : '.sidebar-left');
  if (other) other.classList.remove('mobile-open');
  const opening = sidebar.classList.toggle('mobile-open');
  overlay.classList.toggle('active', opening);
}

function closeMobileSidebars() {
  document.querySelectorAll('.sidebar-left, .sidebar-right').forEach(el => el.classList.remove('mobile-open'));
  const overlay = document.getElementById('sidebar-overlay');
  if (overlay) overlay.classList.remove('active');
}

// ─────────────────────────────────────────────────────────────────────────────
// § ATTACHMENTS
// ─────────────────────────────────────────────────────────────────────────────

function handleFiles(files) {
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    const reader = new FileReader();
    reader.onload = () => {
      attachments.push({ dataUrl: reader.result, name: file.name });
      renderAttachments();
    };
    reader.readAsDataURL(file);
  }
}

function handlePaste(e) {
  const items = e.clipboardData?.items || [];
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault();
      const f = item.getAsFile();
      if (f) handleFiles([f]);
    }
  }
}

function renderAttachments() {
  const c = document.getElementById('attachments-preview');
  if (!attachments.length) { c.style.display = 'none'; c.innerHTML = ''; return; }
  c.style.display = 'flex';
  c.innerHTML = attachments.map((a, i) => `
    <div class="att-thumb">
      <img src="${a.dataUrl}" alt=""/>
      <button class="att-remove" onclick="removeAttachment(${i})" title="Remove">×</button>
    </div>`).join('');
}

function removeAttachment(i) { attachments.splice(i, 1); renderAttachments(); }

function initDragDrop() {
  const overlay = document.getElementById('drag-overlay');
  let counter = 0;
  document.addEventListener('dragenter', (e) => {
    if (!e.dataTransfer?.types?.includes('Files')) return;
    counter++;
    overlay.classList.add('active');
  });
  document.addEventListener('dragleave', () => {
    counter--;
    if (counter <= 0) { counter = 0; overlay.classList.remove('active'); }
  });
  document.addEventListener('dragover', (e) => {
    if (e.dataTransfer?.types?.includes('Files')) e.preventDefault();
  });
  document.addEventListener('drop', (e) => {
    counter = 0;
    overlay.classList.remove('active');
    if (e.dataTransfer?.files?.length) {
      e.preventDefault();
      if (document.getElementById('rag-modal').classList.contains('active')) {
        onRagFiles(e.dataTransfer.files);
      } else {
        handleFiles(e.dataTransfer.files);
      }
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// § CONVERSATIONS
// ─────────────────────────────────────────────────────────────────────────────

function saveConvs()   { localStorage.setItem('llm-convs', JSON.stringify(conversations)); }
function currentConv() { return conversations.find(c => c.id === currentConvId); }

function newConversation() {
  const id = Date.now().toString();
  conversations.unshift({ id, title: 'New chat', messages: [], ts: Date.now(), pinned: false });
  saveConvs();
  loadConversation(id);
  renderConvList();
}

function loadConversation(id) {
  currentConvId = id;
  const conv = currentConv();
  if (!conv) return;
  renderMessages(conv.messages);
  renderConvList();
  document.getElementById('stats-bar').style.display = 'none';
  updateInputTokenCount();
  closeMobileSidebars();
}

function deleteConversation(id, e) {
  e?.stopPropagation();
  if (!confirm('Delete this conversation?')) return;
  conversations = conversations.filter(c => c.id !== id);
  saveConvs();
  if (currentConvId === id) {
    if (conversations.length) loadConversation(conversations[0].id);
    else newConversation();
  }
  renderConvList();
}

function togglePin(id, e) {
  e?.stopPropagation();
  const conv = conversations.find(c => c.id === id);
  if (!conv) return;
  conv.pinned = !conv.pinned;
  saveConvs();
  renderConvList();
}

function renderConvList() {
  const list = document.getElementById('conv-list');
  const sorted = [...conversations].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    return b.ts - a.ts;
  });
  list.innerHTML = sorted.map(c => `
    <div class="conv-item ${c.id === currentConvId ? 'active' : ''} ${c.pinned ? 'pinned' : ''}" data-id="${c.id}"
         onclick="loadConversation('${c.id}')">
      <div class="conv-title" ondblclick="startRenameConv('${c.id}',event)" title="Double-click to rename">${escHtml(c.title)}</div>
      <div class="conv-meta">${c.messages.length} msgs · ${timeAgo(c.ts)}</div>
      <div class="conv-actions">
        <button onclick="togglePin('${c.id}',event)" title="${c.pinned ? 'Unpin' : 'Pin'}">${c.pinned ? '📌' : '📍'}</button>
        <button class="danger" onclick="deleteConversation('${c.id}',event)" title="Delete">×</button>
      </div>
    </div>`).join('');
}

function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)    return 'just now';
  if (s < 3600)  return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

function startRenameConv(id, e) {
  e.stopPropagation();
  const titleEl = e.currentTarget;
  const conv = conversations.find(c => c.id === id);
  if (!conv) return;

  const input = document.createElement('input');
  input.className = 'conv-title-input';
  input.value = conv.title;
  titleEl.replaceWith(input);
  input.focus();
  input.select();

  const commit = () => {
    const newTitle = input.value.trim();
    if (newTitle && newTitle !== conv.title) {
      conv.title = newTitle.slice(0, 60);
      saveConvs();
    }
    renderConvList();
  };

  input.addEventListener('blur', commit);
  input.addEventListener('keydown', ev => {
    if (ev.key === 'Enter')  { ev.preventDefault(); input.blur(); }
    if (ev.key === 'Escape') { input.value = conv.title; input.blur(); }
    ev.stopPropagation();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// § SEND / STOP / STREAMING
// ─────────────────────────────────────────────────────────────────────────────

function onSendClick() {
  if (compareMode) { sendCompare(); return; }
  if (isLoading)   stopGeneration();
  else             send();
}

function stopGeneration() {
  if (compareMode) {
    try { compareAbortA?.abort(); } catch {}
    try { compareAbortB?.abort(); } catch {}
  }
  if (activeAbortController) { try { activeAbortController.abort(); } catch {} }
  activeAbortController = null;
}

function setLoadingState(loading) {
  isLoading = loading;
  const btn = document.getElementById('send-btn');
  if (loading) {
    btn.classList.add('stopping');
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>';
    btn.disabled = false;
  } else {
    btn.classList.remove('stopping');
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
    btn.disabled = !selectedModel;
  }
}

async function send() {
  if (isLoading || !selectedModel) return;
  const input = document.getElementById('msg-input');
  const text  = input.value.trim();
  if (!text && !attachments.length) return;

  input.value = '';
  autoResize(input);
  updateInputTokenCount();

  const conv = currentConv();
  if (!conv) return;
  document.getElementById('empty-state')?.remove();

  let userContent;
  if (attachments.length > 0) {
    userContent = [];
    if (text) userContent.push({ type: 'text', text });
    for (const a of attachments) userContent.push({ type: 'image_url', image_url: { url: a.dataUrl } });
  } else {
    userContent = text;
  }

  conv.messages.push({ role: 'user', content: userContent });
  if (conv.messages.length === 1 && text) {
    conv.title = text.slice(0, 40) + (text.length > 40 ? '…' : '');
  }
  conv.ts = Date.now();
  saveConvs();
  renderConvList();

  const imgsForBubble = attachments.slice();
  appendUserBubble(conv.messages.length - 1, text, imgsForBubble);
  attachments = []; renderAttachments();

  await streamAssistantReply(conv);
}

async function streamAssistantReply(conv) {
  let sysPrompt = document.getElementById('sys-input').value.trim();
  // Inject plan mode instructions if active
  if (planMode) {
    sysPrompt = sysPrompt
      ? sysPrompt + '\n\n' + PLAN_SYSTEM_PROMPT
      : PLAN_SYSTEM_PROMPT;
  }
  const apiMsgs   = sysPrompt
    ? [{ role: 'system', content: sysPrompt }, ...conv.messages]
    : [...conv.messages];

  const useTools  = document.getElementById('tools-toggle').classList.contains('on');
  const temp      = parseFloat(document.getElementById('temp-slider').value);
  const maxTok    = parseInt(document.getElementById('max-tokens').value) || 2048;
  const topP      = parseFloat(document.getElementById('top-p-slider').value);
  const topK      = parseInt(document.getElementById('top-k-slider').value);
  const repeatPen = parseFloat(document.getElementById('repeat-slider').value);
  const freqPen   = parseFloat(document.getElementById('freq-slider').value);

  setLoadingState(true);

  const assistantWrap  = createAssistantWrap();
  const bubble         = assistantWrap.querySelector('.bubble');
  bubble.innerHTML     = '<div class="typing"><span></span><span></span><span></span></div>';

  activeAbortController = new AbortController();
  let fullText = '';
  let cleared  = false;
  let textDiv  = null;
  const toolEls = {};

  // Live tokens/sec tracking
  let genStart     = null;
  let deltaCount   = 0;
  let speedEl      = null;
  let speedInterval = null;

  // Show model loading banner if model not loaded yet
  const modelName = parseModelId(selectedModel).name || '';
  const modelIsLoaded = runningModels.some(r => r === selectedModel || r.includes(modelName));
  if (!modelIsLoaded && selectedModel?.startsWith('ollama/')) {
    showModelLoadingBanner(modelName);
  }

  const ensureCleared = () => {
    if (cleared) return;
    bubble.innerHTML = '';
    textDiv = document.createElement('div');
    textDiv.className = 'msg-text';
    bubble.appendChild(textDiv);
    cleared = true;
  };

  try {
    const res = await fetch(`${PROXY}/v1/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...apiKeyHeader() },
      body: JSON.stringify({
        model: selectedModel, messages: apiMsgs,
        temperature: temp, max_tokens: maxTok, use_tools: useTools,
        top_p: topP, top_k: topK, repeat_penalty: repeatPen, frequency_penalty: freqPen,
      }),
      signal: activeAbortController.signal,
    });

    if (!res.ok) {
      bubble.innerHTML = `<span style="color:var(--orange)">❌ HTTP ${res.status}</span>`;
      return;
    }

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();
    let   buffer  = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx;
      while ((idx = buffer.indexOf('\n\n')) >= 0) {
        const eventStr = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        for (const line of eventStr.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          let evt;
          try { evt = JSON.parse(line.slice(6)); } catch { continue; }

          if (evt.type === 'text_delta') {
            hideModelLoadingBanner();  // First token arrived — model is loaded
            ensureCleared();
            fullText += evt.delta;
            deltaCount++;

            if (!genStart) {
              genStart = Date.now();
              // Create live speed badge inside the bubble
              speedEl = document.createElement('div');
              speedEl.className = 'gen-speed';
              speedEl.textContent = '…';
              bubble.appendChild(speedEl);
              speedInterval = setInterval(() => {
                const secs = (Date.now() - genStart) / 1000;
                if (secs > 0.2 && speedEl) {
                  speedEl.textContent = `${(deltaCount / secs).toFixed(1)} tok/s`;
                }
              }, 400);
            }

            textDiv.innerHTML = renderMarkdown(fullText);
            scrollBottom();
          } else if (evt.type === 'tool_call') {
            ensureCleared();
            const el = createToolBlock(evt.name, evt.args, evt.id);
            bubble.insertBefore(el, textDiv);
            toolEls[evt.id] = el;
            fullText = '';
            textDiv.innerHTML = '';
            scrollBottom();
          } else if (evt.type === 'tool_result') {
            const el = toolEls[evt.id];
            if (el) updateToolResult(el, evt.result);
          } else if (evt.type === 'done') {
            if (speedInterval) { clearInterval(speedInterval); speedInterval = null; }
            if (speedEl) { speedEl.remove(); speedEl = null; }
            updateStats({ ...evt, completion_tokens: evt.completion_tokens ?? deltaCount });
            conv.messages.push({ role: 'assistant', content: fullText });
            saveConvs();
            reRenderLastAssistant(conv, fullText);
            // Refresh running models + system info (model is now loaded)
            checkRunningModels().then(() => { updateModelHeader(); updateModelInfoCard(); });
            loadSystemInfo();
          } else if (evt.type === 'error') {
            bubble.innerHTML = `<span style="color:var(--orange)">❌ ${escHtml(evt.message)}</span>`;
          }
        }
      }
    }
  } catch (e) {
    if (speedInterval) { clearInterval(speedInterval); speedInterval = null; }
    if (speedEl) { speedEl.remove(); speedEl = null; }
    if (e.name === 'AbortError') {
      if (fullText) {
        textDiv.innerHTML = renderMarkdown(fullText) + '<div class="stopped-marker">⏹ Stopped</div>';
        conv.messages.push({ role: 'assistant', content: fullText, stopped: true });
        saveConvs();
        reRenderLastAssistant(conv, fullText, true);
      } else {
        bubble.innerHTML = '<span style="color:var(--muted)">⏹ Stopped</span>';
      }
    } else {
      bubble.innerHTML = `<span style="color:var(--orange)">❌ ${escHtml(e.message)}</span>`;
    }
  } finally {
    setLoadingState(false);
    activeAbortController = null;
    hideModelLoadingBanner();
    scrollBottom();
    highlightNewCode();
  }
}

function reRenderLastAssistant(conv, text, stopped = false) {
  const container = document.getElementById('messages');
  const wraps = container.querySelectorAll('.msg-wrap');
  const last  = wraps[wraps.length - 1];
  if (!last) return;
  const idx = conv.messages.length - 1;
  const replacement = buildAssistantWrap(idx, text, stopped);
  last.replaceWith(replacement);
  applyCollapse(replacement);
  highlightNewCode();
}

// ─────────────────────────────────────────────────────────────────────────────
// § MESSAGE ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

async function regenerateMessage(idx) {
  const conv = currentConv();
  if (!conv || !selectedModel || isLoading) return;
  if (conv.messages[idx]?.role !== 'assistant') return;
  conv.messages = conv.messages.slice(0, idx);
  saveConvs();
  renderMessages(conv.messages);
  await streamAssistantReply(conv);
}

async function continueMessage(idx) {
  const conv = currentConv();
  if (!conv || !selectedModel || isLoading) return;
  if (conv.messages[idx]?.role !== 'assistant') return;
  conv.messages.push({ role: 'user', content: 'Continue from where you left off.' });
  saveConvs();
  renderMessages(conv.messages);
  await streamAssistantReply(conv);
}

function copyMessage(idx) {
  const conv = currentConv();
  if (!conv) return;
  const m = conv.messages[idx];
  const text = typeof m.content === 'string'
    ? m.content
    : Array.isArray(m.content)
      ? m.content.filter(p => p.type === 'text').map(p => p.text).join('\n')
      : JSON.stringify(m.content);
  navigator.clipboard.writeText(text);
  toast('Copied to clipboard', 'success');
}

function deleteMessage(idx) {
  const conv = currentConv();
  if (!conv) return;
  if (!confirm('Delete this message?')) return;
  conv.messages.splice(idx, 1);
  saveConvs();
  renderMessages(conv.messages);
}

function openEditMessage(idx) {
  const conv = currentConv();
  if (!conv) return;
  const m = conv.messages[idx];
  if (!m || m.role !== 'user') return;
  editingMessageIdx = idx;
  const text = typeof m.content === 'string'
    ? m.content
    : Array.isArray(m.content)
      ? m.content.filter(p => p.type === 'text').map(p => p.text).join('\n')
      : '';
  document.getElementById('edit-textarea').value = text;
  openModal('edit-modal');
}

async function saveEditAndRegenerate() {
  if (editingMessageIdx == null) return;
  const conv = currentConv();
  if (!conv) return;
  const newText = document.getElementById('edit-textarea').value.trim();
  if (!newText) return;

  const m = conv.messages[editingMessageIdx];
  if (Array.isArray(m.content)) {
    const imgs = m.content.filter(p => p.type === 'image_url');
    m.content = imgs.length ? [{ type: 'text', text: newText }, ...imgs] : newText;
  } else {
    m.content = newText;
  }
  conv.messages = conv.messages.slice(0, editingMessageIdx + 1);
  saveConvs();
  renderMessages(conv.messages);
  closeModal('edit-modal');
  editingMessageIdx = null;
  await streamAssistantReply(conv);
}

// ─────────────────────────────────────────────────────────────────────────────
// § RENDERING
// ─────────────────────────────────────────────────────────────────────────────

function renderMessages(msgs) {
  const container = document.getElementById('messages');
  container.innerHTML = '';
  if (!msgs.length) {
    container.innerHTML = `
      <div class="welcome" id="empty-state">
        <div class="welcome-icon">⚡</div>
        <h2 class="welcome-title">Local LLM Hub</h2>
        <p class="welcome-sub">Chat with your local models. Everything runs on your machine.</p>
        <div class="welcome-grid">
          <button class="welcome-card" onclick="useWelcomePrompt('Explain how async/await works in JavaScript with a practical example')">
            <span class="wc-icon">💡</span><span class="wc-text">Explain a concept</span>
          </button>
          <button class="welcome-card" onclick="useWelcomePrompt('Write a Python script that reads a CSV file and generates a summary report with statistics')">
            <span class="wc-icon">🔧</span><span class="wc-text">Write some code</span>
          </button>
          <button class="welcome-card" onclick="useWelcomePrompt('Review this code for bugs, security issues, and suggest improvements')">
            <span class="wc-icon">🔍</span><span class="wc-text">Review my code</span>
          </button>
          <button class="welcome-card" onclick="useWelcomePrompt('Help me brainstorm ideas for a weekend side project using local AI models')">
            <span class="wc-icon">🧠</span><span class="wc-text">Brainstorm ideas</span>
          </button>
        </div>
      </div>`;
    return;
  }
  msgs.forEach((m, i) => {
    if (m.role === 'user') {
      let text = '';
      const imgs = [];
      if (typeof m.content === 'string') text = m.content;
      else if (Array.isArray(m.content)) {
        for (const p of m.content) {
          if (p.type === 'text') text = p.text;
          else if (p.type === 'image_url') imgs.push({ dataUrl: p.image_url?.url });
        }
      }
      appendUserBubble(i, text, imgs);
    } else if (m.role === 'assistant') {
      const w = buildAssistantWrap(i, m.content || '', m.stopped);
      container.appendChild(w);
      applyCollapse(w);
    }
  });
  highlightNewCode();
  scrollBottom();
}

// ─────────────────────────────────────────────────────────────────────────────
// § COLLAPSIBLE LONG MESSAGES
// ─────────────────────────────────────────────────────────────────────────────

const COLLAPSE_THRESHOLD = 500; // px — ~22 lines at default line-height

function applyCollapse(wrap) {
  if (wrap.dataset.collapseChecked) return;
  wrap.dataset.collapseChecked = '1';
  const bubble = wrap.querySelector('.bubble');
  if (!bubble) return;
  requestAnimationFrame(() => {
    if (bubble.scrollHeight <= COLLAPSE_THRESHOLD + 10) return;
    bubble.classList.add('collapsed');
    const btn = document.createElement('button');
    btn.className = 'msg-collapse-btn';
    btn.textContent = '▾ Show more';
    btn.onclick = () => {
      const nowCollapsed = bubble.classList.toggle('collapsed');
      btn.textContent = nowCollapsed ? '▾ Show more' : '▴ Show less';
    };
    bubble.after(btn);
  });
}

function appendUserBubble(idx, text, imgs = []) {
  const container = document.getElementById('messages');
  const wrap = document.createElement('div');
  wrap.className = 'msg-wrap';
  const imagesHtml = imgs.length
    ? `<div class="bubble-images">${imgs.map(a =>
        `<img class="bubble-img" src="${a.dataUrl}" onclick="window.open(this.src)"/>`).join('')}</div>`
    : '';
  wrap.innerHTML = `
    <div class="msg user">
      <div class="avatar">👤</div>
      <div class="bubble">
        ${imagesHtml}
        ${text ? `<div>${renderMarkdown(text)}</div>` : ''}
      </div>
    </div>
    ${idx >= 0 ? `<div class="msg-actions" style="justify-content:flex-end">
      <button onclick="openEditMessage(${idx})" title="Edit & regenerate">✏️ Edit</button>
      <button onclick="copyMessage(${idx})" title="Copy">📋 Copy</button>
      <button class="danger" onclick="deleteMessage(${idx})" title="Delete">🗑 Delete</button>
    </div>` : ''}`;
  container.appendChild(wrap);
  applyCollapse(wrap);
}

function buildAssistantWrap(idx, content, stopped = false) {
  const wrap = document.createElement('div');
  wrap.className = 'msg-wrap';
  const name = parseModelId(selectedModel).name || '';

  // Parse plan blocks from content
  const parsed = parsePlanFromText(content || '');
  const displayContent = parsed.response || '';

  wrap.innerHTML = `
    <div class="msg assistant">
      <div class="avatar">🤖</div>
      <div class="bubble"></div>
    </div>
    <div class="msg-meta"><span>${escHtml(name)}</span></div>
    ${idx >= 0 ? `<div class="msg-actions">
      <button onclick="regenerateMessage(${idx})" title="Regenerate (⌘R)">🔄 Regenerate</button>
      <button onclick="continueMessage(${idx})" title="Continue">▶ Continue</button>
      <button onclick="copyMessage(${idx})" title="Copy">📋 Copy</button>
      <button class="danger" onclick="deleteMessage(${idx})" title="Delete">🗑 Delete</button>
    </div>` : ''}`;

  const bubble = wrap.querySelector('.bubble');

  // Add plan block if present
  if (parsed.plan) {
    bubble.appendChild(createPlanBlock(parsed.plan));
  }

  // Add the actual response
  const responseDiv = document.createElement('div');
  responseDiv.innerHTML = renderMarkdown(displayContent);
  if (stopped) responseDiv.innerHTML += '<div class="stopped-marker">⏹ Stopped</div>';
  bubble.appendChild(responseDiv);

  enhanceCodeBlocks(wrap);
  return wrap;
}

function createAssistantWrap() {
  const container = document.getElementById('messages');
  const wrap = document.createElement('div');
  wrap.className = 'msg-wrap';
  const name = parseModelId(selectedModel).name || '';
  wrap.innerHTML = `
    <div class="msg assistant">
      <div class="avatar">🤖</div>
      <div class="bubble"></div>
    </div>
    <div class="msg-meta"><span>${escHtml(name)}</span></div>`;
  container.appendChild(wrap);
  scrollBottom();
  return wrap;
}

function createToolBlock(name, args, id) {
  const div = document.createElement('div');
  div.className = 'tool-block';
  div.dataset.id = id;
  div.innerHTML = `
    <div class="tool-header" onclick="this.nextElementSibling.classList.toggle('open')">
      <span>🔧</span>
      <span class="tool-name">${escHtml(name)}</span>
      <span class="tool-status running" id="ts-${id}">running…</span>
    </div>
    <div class="tool-body">
      <div class="tool-label">INPUT</div>
      <div class="tool-pre">${escHtml(JSON.stringify(args, null, 2))}</div>
      <div class="tool-label" style="margin-top:8px">RESULT</div>
      <div class="tool-pre" id="tr-${id}">waiting…</div>
    </div>`;
  scrollBottom();
  return div;
}

function updateToolResult(el, result) {
  const statusEl = el.querySelector('[id^="ts-"]');
  const resultEl = el.querySelector('[id^="tr-"]');
  if (statusEl) { statusEl.textContent = 'done ✓'; statusEl.className = 'tool-status done'; }
  if (resultEl) {
    try { resultEl.textContent = JSON.stringify(JSON.parse(result), null, 2); }
    catch { resultEl.textContent = result; }
  }
}

function updateStats({ model, elapsed, prompt_tokens, completion_tokens }) {
  const bar = document.getElementById('stats-bar');
  bar.style.display = 'flex';
  document.getElementById('stat-model').textContent  = model || '—';
  document.getElementById('stat-tokens').textContent =
    prompt_tokens != null ? `${prompt_tokens} → ${completion_tokens ?? 0}` : '—';
  const tps = (elapsed && completion_tokens)
    ? `${(completion_tokens / (elapsed / 1000)).toFixed(1)} tok/s`
    : '—';
  document.getElementById('stat-speed').textContent = tps;
  document.getElementById('stat-time').textContent   = elapsed ? `${elapsed}ms` : '—';

  // Use real context_length from model metadata, fallback to 8192
  const modelId = selectedModel;
  const meta = modelId ? (modelMetadata[modelId] || {}) : {};
  const ctxLimit = meta.context_length || 8192;
  const used = (prompt_tokens || 0) + (completion_tokens || 0);
  const pct  = Math.round((used / ctxLimit) * 100);
  document.getElementById('stat-ctx').textContent   = `${used} / ${ctxLimit.toLocaleString()} (${pct}%)`;
  document.getElementById('stat-ctx-wrap').classList.toggle('warn', pct > 75);

  // Update sidebar context bar too
  updateContextBar(prompt_tokens, completion_tokens);

  // Cost estimate — cloud models only
  const { provider: cProv, name: cName } = parseModelId(selectedModel || model || '');
  const cost = estimateCost(cProv, cName, prompt_tokens, completion_tokens);
  const costWrap = document.getElementById('stat-cost-wrap');
  if (costWrap) {
    if (cost !== null) {
      costWrap.style.display = '';
      document.getElementById('stat-cost').textContent =
        cost < 0.0001 ? '<$0.0001' : `$${cost.toFixed(4)}`;
    } else {
      costWrap.style.display = 'none';
    }
  }
}

function clearMessages() {
  const conv = currentConv();
  if (!conv) return;
  conv.messages = [];
  conv.title    = 'New chat';
  saveConvs();
  renderMessages([]);
  renderConvList();
  document.getElementById('stats-bar').style.display = 'none';
  updateInputTokenCount();
}

function toggleExportMenu() {
  const menu = document.getElementById('export-menu');
  const isOpen = menu.style.display !== 'none';
  menu.style.display = isOpen ? 'none' : 'block';
  if (!isOpen) {
    const close = e => {
      if (!document.getElementById('export-drop').contains(e.target)) {
        menu.style.display = 'none';
        document.removeEventListener('click', close);
      }
    };
    setTimeout(() => document.addEventListener('click', close), 0);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § MARKDOWN + HIGHLIGHTING + ARTIFACTS
// ─────────────────────────────────────────────────────────────────────────────

function renderMarkdown(text) {
  if (!text) return '';
  if (typeof marked === 'undefined') {
    // Fallback if CDN fails
    return escHtml(text).replace(/\n/g, '<br/>');
  }

  let html;
  try {
    html = marked.parse(text, { breaks: true, gfm: true, headerIds: false, mangle: false });
  } catch {
    return escHtml(text).replace(/\n/g, '<br/>');
  }

  // Sanitize: marked v11 does not strip raw HTML. Without this, model output like
  // <img src=x onerror=...> would execute on innerHTML assignment and could
  // exfiltrate localStorage['llm-api-keys'].
  if (typeof DOMPurify !== 'undefined') {
    html = DOMPurify.sanitize(html, { ADD_ATTR: ['target'] });
  } else {
    return escHtml(text).replace(/\n/g, '<br/>');
  }

  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const wrap = doc.body.firstChild;

  // Add data-lang + copy button to <pre><code> blocks
  wrap.querySelectorAll('pre').forEach(pre => {
    const code = pre.querySelector('code');
    if (!code) return;
    let lang = '';
    const m = (code.className || '').match(/language-(\S+)/);
    if (m) lang = m[1].toLowerCase();
    pre.setAttribute('data-lang', lang);
    const btn = doc.createElement('button');
    btn.className = 'copy-code-btn';
    btn.setAttribute('onclick', 'copyCodeBtn(this)');
    btn.textContent = 'Copy';
    pre.insertBefore(btn, pre.firstChild);
  });

  // Make links open in new tab safely
  wrap.querySelectorAll('a').forEach(a => {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
    a.style.color = 'var(--accent)';
  });

  return wrap.innerHTML;
}

function copyCodeBtn(btn) {
  const code = btn.parentElement.querySelector('code')?.innerText || '';
  navigator.clipboard.writeText(code);
  const old = btn.textContent;
  btn.textContent = 'Copied ✓';
  setTimeout(() => { btn.textContent = old; }, 1200);
}

function highlightNewCode() {
  if (typeof Prism !== 'undefined') {
    document.querySelectorAll('pre code:not(.prism-done)').forEach(el => {
      try { Prism.highlightElement(el); el.classList.add('prism-done'); } catch {}
    });
  }
}

function enhanceCodeBlocks(scope = document) {
  scope.querySelectorAll('pre[data-lang]').forEach(pre => {
    if (pre.dataset.enhanced) return;
    const lang = (pre.dataset.lang || '').toLowerCase();
    if (!['html', 'svg', 'jsx', 'tsx', 'react'].includes(lang)) return;
    const code = pre.querySelector('code')?.innerText || '';
    if (!code.trim()) return;

    const wrap = document.createElement('div');
    wrap.className = 'artifact-wrap';

    const tabs = document.createElement('div');
    tabs.className = 'artifact-tabs';
    tabs.innerHTML = `
      <button class="artifact-tab active" data-tab="preview">🖼 Preview</button>
      <button class="artifact-tab" data-tab="code">💻 Code</button>`;
    wrap.appendChild(tabs);

    const previewPane = document.createElement('div');
    previewPane.className = 'artifact-pane active';
    previewPane.appendChild(buildPreviewEl(lang, code));

    const codePane = document.createElement('div');
    codePane.className = 'artifact-pane';
    const preClone = pre.cloneNode(true);
    preClone.style.margin = '0';
    preClone.style.border = 'none';
    preClone.style.borderRadius = '0';
    codePane.appendChild(preClone);

    wrap.appendChild(previewPane);
    wrap.appendChild(codePane);

    tabs.querySelectorAll('.artifact-tab').forEach(btn => {
      btn.onclick = () => {
        tabs.querySelectorAll('.artifact-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const showPreview = btn.dataset.tab === 'preview';
        previewPane.classList.toggle('active', showPreview);
        codePane.classList.toggle('active', !showPreview);
      };
    });

    pre.dataset.enhanced = '1';
    pre.replaceWith(wrap);
  });
}

function buildPreviewEl(lang, code) {
  if (lang === 'svg') {
    const container = document.createElement('div');
    container.className = 'artifact-preview artifact-svg';
    container.innerHTML = code;
    return container;
  }
  const iframe = document.createElement('iframe');
  iframe.className = 'artifact-preview';
  iframe.sandbox   = 'allow-scripts';
  let doc;
  if (lang === 'html') {
    doc = code.includes('<html') ? code :
      `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:system-ui;padding:12px;color:#111}</style></head><body>${code}</body></html>`;
  } else {
    doc = `<!DOCTYPE html><html><head><meta charset="utf-8">
<script src="https://unpkg.com/react@18/umd/react.production.min.js"><\/script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"><\/script>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>
<style>body{font-family:system-ui;padding:12px;color:#111;margin:0}</style>
</head><body>
<div id="root"></div>
<script type="text/babel" data-presets="${lang === 'tsx' ? 'typescript,react' : 'react'}">
${code}

try {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  if (typeof App !== 'undefined') root.render(React.createElement(App));
  else if (typeof Component !== 'undefined') root.render(React.createElement(Component));
} catch (e) {
  document.body.innerHTML = '<pre style="color:#c00">' + e.message + '</pre>';
}
<\/script>
</body></html>`;
  }
  iframe.srcdoc = doc;
  return iframe;
}

// ─────────────────────────────────────────────────────────────────────────────
// § SEARCH
// ─────────────────────────────────────────────────────────────────────────────

function openSearch() {
  openModal('search-modal');
  document.getElementById('search-input').value = '';
  setTimeout(() => document.getElementById('search-input').focus(), 50);
  renderSearchResults([]);
}

function onSearchInput() {
  const q = document.getElementById('search-input').value.trim().toLowerCase();
  if (!q) { searchMatches = []; renderSearchResults([]); return; }
  const results = [];
  for (const c of conversations) {
    if (c.title.toLowerCase().includes(q)) {
      results.push({ convId: c.id, title: c.title, snippet: 'Conversation title', q });
      continue;
    }
    for (const m of c.messages) {
      const txt = typeof m.content === 'string' ? m.content
               : Array.isArray(m.content) ? m.content.map(p => p.text || '').join(' ') : '';
      const lower = txt.toLowerCase();
      const i = lower.indexOf(q);
      if (i >= 0) {
        const start = Math.max(0, i - 30);
        const end   = Math.min(txt.length, i + q.length + 60);
        results.push({
          convId: c.id, title: c.title,
          snippet: (start > 0 ? '…' : '') + txt.slice(start, end) + (end < txt.length ? '…' : ''),
          q,
        });
        break;
      }
    }
  }
  searchMatches     = results.slice(0, 30);
  searchSelectedIdx = 0;
  renderSearchResults(searchMatches);
}

function renderSearchResults(results) {
  const container = document.getElementById('search-results');
  if (!results.length) {
    container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:12px">No matches</div>';
    return;
  }
  container.innerHTML = results.map((r, i) => `
    <div class="search-result ${i === searchSelectedIdx ? 'selected' : ''}" onclick="pickSearch(${i})">
      <div class="search-result-title">${escHtml(r.title)}</div>
      <div class="search-result-snippet">${highlightMatch(r.snippet, r.q)}</div>
    </div>`).join('');
}

function highlightMatch(text, q) {
  if (!q) return escHtml(text);
  const safe = escHtml(text);
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig');
  return safe.replace(re, '<mark>$1</mark>');
}

function pickSearch(i) {
  const r = searchMatches[i];
  if (!r) return;
  closeModal('search-modal');
  loadConversation(r.convId);
}

function onSearchKeydown(e) {
  if (!searchMatches.length) return;
  if (e.key === 'ArrowDown') {
    searchSelectedIdx = Math.min(searchMatches.length - 1, searchSelectedIdx + 1);
    renderSearchResults(searchMatches); e.preventDefault();
  } else if (e.key === 'ArrowUp') {
    searchSelectedIdx = Math.max(0, searchSelectedIdx - 1);
    renderSearchResults(searchMatches); e.preventDefault();
  } else if (e.key === 'Enter') {
    pickSearch(searchSelectedIdx); e.preventDefault();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────

function saveTemplates() { localStorage.setItem('llm-templates', JSON.stringify(templates)); }

function openTemplates() {
  openModal('templates-modal');
  renderTemplateList();
}

function renderTemplateList() {
  const list = document.getElementById('template-list');
  if (!templates.length) {
    list.innerHTML = '<div style="padding:20px;color:var(--muted);text-align:center">No templates yet</div>';
    return;
  }
  list.innerHTML = templates.map(t => `
    <div class="template-card" onclick="runTemplateOpen('${t.id}')">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6px">
        <div class="template-name">${escHtml(t.name)}</div>
        <button class="icon-btn" onclick="event.stopPropagation();editTemplate('${t.id}')" title="Edit">✏️</button>
      </div>
      <div class="template-desc">${escHtml(t.description || '')}</div>
      ${t.tags?.length ? `<div class="template-tags">${t.tags.map(tg => `<span class="template-tag">${escHtml(tg)}</span>`).join('')}</div>` : ''}
    </div>`).join('');
}

function openNewTemplate() {
  editingTemplateId = null;
  document.getElementById('template-edit-title').textContent = 'New Template';
  document.getElementById('tpl-name').value = '';
  document.getElementById('tpl-desc').value = '';
  document.getElementById('tpl-tags').value = '';
  document.getElementById('tpl-body').value = '';
  document.getElementById('tpl-delete-btn').style.display = 'none';
  openModal('template-edit-modal');
}

function editTemplate(id) {
  const t = templates.find(x => x.id === id);
  if (!t) return;
  editingTemplateId = id;
  document.getElementById('template-edit-title').textContent = 'Edit Template';
  document.getElementById('tpl-name').value = t.name;
  document.getElementById('tpl-desc').value = t.description || '';
  document.getElementById('tpl-tags').value = (t.tags || []).join(', ');
  document.getElementById('tpl-body').value = t.body;
  document.getElementById('tpl-delete-btn').style.display = 'inline-block';
  closeModal('templates-modal');
  openModal('template-edit-modal');
}

function saveTemplate() {
  const name = document.getElementById('tpl-name').value.trim();
  const body = document.getElementById('tpl-body').value.trim();
  if (!name || !body) return toast('Name and body required', 'error');
  const desc = document.getElementById('tpl-desc').value.trim();
  const tags = document.getElementById('tpl-tags').value.split(',').map(s => s.trim()).filter(Boolean);
  if (editingTemplateId) {
    const t = templates.find(x => x.id === editingTemplateId);
    Object.assign(t, { name, description: desc, tags, body });
  } else {
    templates.push({ id: 't_' + Date.now(), name, description: desc, tags, body });
  }
  saveTemplates();
  closeModal('template-edit-modal');
  toast('Template saved', 'success');
}

function deleteCurrentTemplate() {
  if (!editingTemplateId) return;
  if (!confirm('Delete this template?')) return;
  templates = templates.filter(t => t.id !== editingTemplateId);
  saveTemplates();
  closeModal('template-edit-modal');
}

function runTemplateOpen(id) {
  const t = templates.find(x => x.id === id);
  if (!t) return;
  activeRunTemplateId = id;
  const vars = [...new Set([...t.body.matchAll(/\{\{([\w_]+)\}\}/g)].map(m => m[1]))];
  document.getElementById('template-run-title').textContent = t.name;
  const body = document.getElementById('template-run-body');
  if (!vars.length) {
    body.innerHTML = '<div style="color:var(--muted);font-size:12px;font-family:var(--mono)">No variables — will insert as-is.</div>';
  } else {
    body.innerHTML = vars.map(v => `
      <label>${escHtml(v)}</label>
      <textarea data-var="${escHtml(v)}" style="min-height:${v === 'code' || v === 'diff' ? '140' : '60'}px"></textarea>
    `).join('');
  }
  closeModal('templates-modal');
  openModal('template-run-modal');
}

function runTemplate() {
  const t = templates.find(x => x.id === activeRunTemplateId);
  if (!t) return;
  let output = t.body;
  document.querySelectorAll('#template-run-body [data-var]').forEach(el => {
    output = output.replaceAll(`{{${el.dataset.var}}}`, el.value);
  });
  document.getElementById('msg-input').value = output;
  autoResize(document.getElementById('msg-input'));
  closeModal('template-run-modal');
  document.getElementById('msg-input').focus();
  updateInputTokenCount();
}

// ─────────────────────────────────────────────────────────────────────────────
// § CONFIG EDITOR
// ─────────────────────────────────────────────────────────────────────────────

async function openConfigEditor() {
  switchSettingsTab('config');
  try {
    const res  = await fetch(`${PROXY}/v1/config`);
    const data = await res.json();
    document.getElementById('config-editor').value = JSON.stringify(data, null, 2);
    document.getElementById('config-error').textContent = '';
    openModal('config-modal');
  } catch (e) {
    toast('Failed to load config: ' + e.message, 'error');
  }
}

function openApiKeySettings() {
  switchSettingsTab('apikeys');
  const keys = getStoredApiKeys();
  ['openai', 'anthropic', 'groq', 'openrouter'].forEach(p => {
    const el = document.getElementById(`key-${p}`);
    if (el) el.value = keys[p] || '';
  });
  document.getElementById('apikey-status').textContent = '';
  openModal('config-modal');
}

function switchSettingsTab(tab) {
  ['config', 'apikeys', 'backup'].forEach(t => {
    document.getElementById(`settings-panel-${t}`).style.display = t === tab ? '' : 'none';
    document.getElementById(`settings-footer-${t}`).style.display = t === tab ? '' : 'none';
    const btn = document.getElementById(`tab-${t}`);
    if (btn) btn.classList.toggle('active', t === tab);
  });
  if (tab === 'backup') renderBackupSummary();
}

function renderBackupSummary() {
  const convs   = JSON.parse(localStorage.getItem('llm-convs')     || '[]');
  const presets  = JSON.parse(localStorage.getItem('llm-presets')   || '{}');
  const tpls     = JSON.parse(localStorage.getItem('llm-templates') || '[]');
  const totalMsg = convs.reduce((n, c) => n + (c.messages?.length || 0), 0);
  const el = document.getElementById('backup-summary');
  if (el) el.innerHTML = `
    <div class="backup-stat"><span class="backup-stat-val">${convs.length}</span><span class="backup-stat-label">Conversations</span></div>
    <div class="backup-stat"><span class="backup-stat-val">${totalMsg}</span><span class="backup-stat-label">Messages</span></div>
    <div class="backup-stat"><span class="backup-stat-val">${Object.keys(presets).length}</span><span class="backup-stat-label">Presets</span></div>
    <div class="backup-stat"><span class="backup-stat-val">${Array.isArray(tpls) ? tpls.length : 0}</span><span class="backup-stat-label">Templates</span></div>
  `;
}

function openBackupSettings() {
  switchSettingsTab('backup');
  const convs   = JSON.parse(localStorage.getItem('llm-convs')     || '[]');
  const presets  = JSON.parse(localStorage.getItem('llm-presets')   || '{}');
  const tpls     = JSON.parse(localStorage.getItem('llm-templates') || '[]');
  const totalMsg = convs.reduce((n, c) => n + (c.messages?.length || 0), 0);
  const el = document.getElementById('backup-summary');
  if (el) el.innerHTML = `
    <div class="backup-stat"><span class="backup-stat-val">${convs.length}</span><span class="backup-stat-label">Conversations</span></div>
    <div class="backup-stat"><span class="backup-stat-val">${totalMsg}</span><span class="backup-stat-label">Messages</span></div>
    <div class="backup-stat"><span class="backup-stat-val">${Object.keys(presets).length}</span><span class="backup-stat-label">Presets</span></div>
    <div class="backup-stat"><span class="backup-stat-val">${Array.isArray(tpls) ? tpls.length : 0}</span><span class="backup-stat-label">Templates</span></div>
  `;
  const statusEl = document.getElementById('backup-status');
  if (statusEl) { statusEl.textContent = ''; statusEl.style.color = 'var(--muted)'; }
  openModal('config-modal');
}

function exportBackup() {
  const payload = {
    version: 1,
    app: 'llm-hub',
    exportedAt: new Date().toISOString(),
    data: {
      conversations: JSON.parse(localStorage.getItem('llm-convs')     || '[]'),
      presets:       JSON.parse(localStorage.getItem('llm-presets')   || '{}'),
      templates:     JSON.parse(localStorage.getItem('llm-templates') || '[]'),
      settings:      JSON.parse(localStorage.getItem('llm-settings')  || '{}'),
    },
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `llm-hub-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Backup downloaded', 'success');
}

function onBackupDrop(e) {
  e.preventDefault();
  const file = e.dataTransfer?.files?.[0];
  if (file) applyBackupFile(file);
}

function importBackup(input) {
  const file = input.files?.[0];
  input.value = '';
  if (file) applyBackupFile(file);
}

function applyBackupFile(file) {
  const statusEl = document.getElementById('backup-status');
  const reader   = new FileReader();
  reader.onload  = (e) => {
    try {
      const payload = JSON.parse(e.target.result);
      if (payload.app !== 'llm-hub' || payload.version !== 1 || !payload.data) {
        throw new Error('Not a valid LLM Hub backup file.');
      }
      const { conversations: convs, presets, templates: tpls, settings } = payload.data;
      if (!Array.isArray(convs)) throw new Error('Invalid conversations payload.');
      if (!presets || typeof presets !== 'object' || Array.isArray(presets)) throw new Error('Invalid presets payload.');
      if (!Array.isArray(tpls)) throw new Error('Invalid templates payload.');
      if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new Error('Invalid settings payload.');
      if (!confirm('Restore backup? This will overwrite your current conversations and settings.')) return;
      localStorage.setItem('llm-convs',     JSON.stringify(convs));
      localStorage.setItem('llm-presets',   JSON.stringify(presets));
      localStorage.setItem('llm-templates', JSON.stringify(tpls));
      localStorage.setItem('llm-settings',  JSON.stringify(settings));
      closeModal('config-modal');
      toast('Backup restored — reloading…', 'success');
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      statusEl.textContent = '✗ ' + err.message;
      statusEl.style.color = 'var(--red)';
    }
  };
  reader.readAsText(file);
}

function toggleKeyVisibility(inputId, btn) {
  const el = document.getElementById(inputId);
  if (!el) return;
  el.type = el.type === 'password' ? 'text' : 'password';
  if (btn) btn.textContent = el.type === 'password' ? 'Show' : 'Hide';
}

async function saveApiKeys() {
  const keys = {};
  ['openai', 'anthropic', 'groq', 'openrouter'].forEach(p => {
    const v = (document.getElementById(`key-${p}`)?.value || '').trim();
    if (v) keys[p] = v;
  });
  localStorage.setItem('llm-api-keys', JSON.stringify(keys));
  const count = Object.keys(keys).length;
  document.getElementById('apikey-status').textContent =
    count ? `Saved ${count} key(s). Refreshing models…` : 'All keys cleared.';
  closeModal('config-modal');
  await Promise.all([checkHealth(), loadModels()]);
  // Clear any selected model that no longer exists after provider change
  const available = new Set(availableModels.map(m => m.id));
  if (selectedModel && !available.has(selectedModel)) {
    selectedModel = null;
    document.getElementById('model-select').value = '';
    updateModelHeader();
    updateModelInfoCard();
    document.getElementById('send-btn').disabled = true;
  }
  if (compareModelA && !available.has(compareModelA)) {
    compareModelA = null;
    document.getElementById('compare-model-a').value = '';
  }
  if (compareModelB && !available.has(compareModelB)) {
    compareModelB = null;
    document.getElementById('compare-model-b').value = '';
  }
  updateCompareSendState();
  toast(`API keys saved — ${count} provider(s) configured`, 'success');
}

function clearAllApiKeys() {
  localStorage.removeItem('llm-api-keys');
  ['openai', 'anthropic', 'groq', 'openrouter'].forEach(p => {
    const el = document.getElementById(`key-${p}`);
    if (el) el.value = '';
  });
  document.getElementById('apikey-status').textContent = 'All keys cleared.';
}

async function saveConfig() {
  const raw = document.getElementById('config-editor').value;
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (e) { document.getElementById('config-error').textContent = 'Invalid JSON: ' + e.message; return; }
  try {
    const res  = await fetch(`${PROXY}/v1/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'save failed');
    toast('Config saved, tools reloaded', 'success');
    closeModal('config-modal');
    await loadTools();
  } catch (e) {
    document.getElementById('config-error').textContent = e.message;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § RAG
// ─────────────────────────────────────────────────────────────────────────────

async function loadRagCollections() {
  try {
    const res  = await fetch(`${PROXY}/v1/rag/collections`);
    const data = await res.json();
    availableRagCollections = data.collections || [];
    renderRagList();
  } catch {
    availableRagCollections = [];
    renderRagList();
  }
}

function renderRagList() {
  const el = document.getElementById('rag-list');
  if (!availableRagCollections.length) {
    el.innerHTML = '<div style="color:var(--muted);font-size:11px;font-family:var(--mono);margin-bottom:6px">No collections yet</div>';
  } else {
    el.innerHTML = availableRagCollections.map(c => `
      <div class="rag-item" title="${escHtml(c.name)}">
        📚 <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(c.name)}</span>
        <span class="rag-meta">${c.chunks ?? c.chunkCount ?? 0} ch</span>
        <button class="icon-btn" onclick="deleteRag('${c.id}')" title="Delete" style="margin-left:4px">×</button>
      </div>`).join('');
  }
}

async function deleteRag(id) {
  if (!confirm('Delete this knowledge collection?')) return;
  await fetch(`${PROXY}/v1/rag/collections/${id}`, { method: 'DELETE' });
  await loadRagCollections();
  toast('Collection deleted', 'success');
}

let pendingRagFiles = [];
function openRagUpload() {
  pendingRagFiles = [];
  document.getElementById('rag-file-list').innerHTML = '';
  document.getElementById('rag-progress').style.display = 'none';
  document.getElementById('rag-status').textContent = '';
  document.getElementById('rag-new-name').value = '';

  const sel = document.getElementById('rag-collection-select');
  sel.innerHTML = '<option value="__new__">+ New collection</option>';
  for (const c of availableRagCollections) {
    const o = document.createElement('option');
    o.value = c.id; o.text = c.name;
    sel.appendChild(o);
  }
  onRagCollectionChange();
  openModal('rag-modal');
}

function onRagCollectionChange() {
  const v = document.getElementById('rag-collection-select').value;
  document.getElementById('rag-new-name-wrap').style.display = v === '__new__' ? 'block' : 'none';
}

function onRagFiles(files) {
  for (const f of files) pendingRagFiles.push(f);
  renderRagFileList();
}

function renderRagFileList() {
  document.getElementById('rag-file-list').innerHTML =
    pendingRagFiles.map(f => `• ${escHtml(f.name)} <span style="color:var(--muted)">(${(f.size/1024).toFixed(1)} KB)</span>`).join('<br/>');
}

async function uploadRagFiles() {
  if (!pendingRagFiles.length) return toast('Pick files first', 'error');
  const sel = document.getElementById('rag-collection-select');
  const colId   = sel.value === '__new__' ? null : sel.value;
  const newName = document.getElementById('rag-new-name').value.trim();
  if (!colId && !newName) return toast('Name the new collection', 'error');

  document.getElementById('rag-progress').style.display = 'block';
  const btn = document.getElementById('rag-upload-btn');
  btn.disabled = true;

  let lastCollectionId = colId;
  try {
    for (let i = 0; i < pendingRagFiles.length; i++) {
      const f = pendingRagFiles[i];
      document.getElementById('rag-status').textContent =
        `Uploading ${i+1}/${pendingRagFiles.length}: ${f.name}`;
      const text = await f.text();
      const body = {
        source: f.name, text,
        ...(lastCollectionId ? { collection_id: lastCollectionId } : { collection_name: newName }),
      };

      await new Promise((resolve, reject) => {
        fetch(`${PROXY}/v1/rag/upload`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }).then(async res => {
          const reader  = res.body.getReader();
          const decoder = new TextDecoder();
          let buf = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            let idx;
            while ((idx = buf.indexOf('\n\n')) >= 0) {
              const line = buf.slice(0, idx);
              buf = buf.slice(idx + 2);
              if (!line.startsWith('data: ')) continue;
              let evt; try { evt = JSON.parse(line.slice(6)); } catch { continue; }
              if (evt.type === 'progress') {
                const pct = Math.round((evt.done / evt.total) * 100);
                document.getElementById('rag-progress-fill').style.width = pct + '%';
              } else if (evt.type === 'done') {
                if (evt.collectionId) lastCollectionId = evt.collectionId;
                resolve();
              } else if (evt.type === 'error') {
                reject(new Error(evt.message));
              }
            }
          }
          resolve();
        }).catch(reject);
      });
    }
    document.getElementById('rag-status').textContent = '✓ Done';
    await loadRagCollections();
    setTimeout(() => closeModal('rag-modal'), 600);
    toast(`Uploaded ${pendingRagFiles.length} file(s)`, 'success');
  } catch (e) {
    document.getElementById('rag-status').textContent = '❌ ' + e.message;
  } finally {
    btn.disabled = false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § EXPORT
// ─────────────────────────────────────────────────────────────────────────────

function exportConv(format) {
  const conv = currentConv();
  if (!conv) return;
  let blob, ext;
  if (format === 'md') {
    let md = `# ${conv.title}\n\n_${new Date(conv.ts).toISOString()}_\n\n---\n\n`;
    for (const m of conv.messages) {
      const role = m.role === 'user' ? '👤 You' : m.role === 'assistant' ? '🤖 Assistant' : m.role;
      const txt = typeof m.content === 'string' ? m.content
                : Array.isArray(m.content) ? m.content.filter(p => p.type === 'text').map(p => p.text).join('\n') +
                    (m.content.some(p => p.type === 'image_url') ? '\n\n_[images attached]_' : '')
                : JSON.stringify(m.content);
      md += `### ${role}\n\n${txt}\n\n`;
    }
    blob = new Blob([md], { type: 'text/markdown' });
    ext  = 'md';
  } else {
    blob = new Blob([JSON.stringify(conv, null, 2)], { type: 'application/json' });
    ext  = 'json';
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${conv.title.slice(0, 40).replace(/[^\w-]+/g, '-')}.${ext}`;
  a.click();
}

function exportConvHtml() {
  const conv = currentConv();
  if (!conv) return;

  const date = new Date(conv.ts).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const msgCount = conv.messages.filter(m => m.role !== 'system').length;

  const msgsHtml = conv.messages
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => {
      const isUser = m.role === 'user';
      let text = '';
      const imgTags = [];

      if (typeof m.content === 'string') {
        text = m.content;
      } else if (Array.isArray(m.content)) {
        for (const p of m.content) {
          if (p.type === 'text') text = p.text;
          else if (p.type === 'image_url' && p.image_url?.url?.startsWith('data:')) {
            imgTags.push(`<img src="${escHtml(p.image_url.url)}" class="bubble-img" alt="attached image">`);
          }
        }
      }

      const bodyHtml = renderMarkdown(text);
      return `
    <div class="msg-wrap">
      <div class="msg ${isUser ? 'user' : 'assistant'}">
        <div class="avatar">${isUser ? '👤' : '🤖'}</div>
        <div class="bubble">
          ${imgTags.join('')}
          ${bodyHtml}
        </div>
      </div>
    </div>`;
    }).join('\n');

  const slug = conv.title.slice(0, 40).replace(/[^\w-]+/g, '-');
  const safeTitle = escHtml(conv.title);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeTitle} — LLM Hub</title>
<style>
:root {
  --bg:#09090b; --s1:#18181b; --s2:#27272a; --text:#fafafa; --text2:#d4d4d8;
  --muted:#71717a; --accent:#3b82f6; --border:#27272a;
  --mono:'JetBrains Mono',ui-monospace,'SF Mono',monospace;
  --sans:'Inter',system-ui,-apple-system,sans-serif;
  --radius:12px;
}
@media (prefers-color-scheme:light) {
  :root {
    --bg:#ffffff; --s1:#f4f4f5; --s2:#e4e4e7; --text:#09090b; --text2:#3f3f46;
    --muted:#71717a; --accent:#2563eb; --border:#e4e4e7;
  }
}
*,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }
body { background:var(--bg); color:var(--text); font-family:var(--sans); font-size:14px; line-height:1.6; min-height:100vh; }
a { color:var(--accent); text-decoration:none; }
a:hover { text-decoration:underline; }
.page-header { border-bottom:1px solid var(--border); padding:16px 24px; display:flex; align-items:center; gap:12px; flex-wrap:wrap; }
.header-brand { font-family:var(--mono); font-size:13px; color:var(--muted); flex-shrink:0; }
.header-brand span { color:var(--accent); }
.header-title { font-size:15px; font-weight:600; flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.header-meta { font-family:var(--mono); font-size:11px; color:var(--muted); flex-shrink:0; }
.chat { max-width:780px; margin:0 auto; padding:24px 16px 48px; display:flex; flex-direction:column; gap:4px; }
.msg-wrap { display:flex; flex-direction:column; gap:4px; }
.msg { display:flex; gap:12px; padding:4px 0; }
.msg.user { flex-direction:row-reverse; }
.avatar { width:32px; height:32px; border-radius:50%; background:var(--s2); display:flex; align-items:center; justify-content:center; font-size:15px; flex-shrink:0; }
.bubble { padding:12px 16px; border-radius:var(--radius); max-width:82%; word-wrap:break-word; overflow-wrap:break-word; }
.msg.user .bubble { background:var(--accent); color:#fff; border-bottom-right-radius:4px; }
.msg.user .bubble a { color:rgba(255,255,255,.85); }
.msg.assistant .bubble { background:var(--s1); border:1px solid var(--border); border-bottom-left-radius:4px; }
.bubble-img { max-width:100%; border-radius:8px; margin-bottom:8px; display:block; }
.bubble p { margin:0 0 8px; } .bubble p:last-child { margin-bottom:0; }
.bubble h1,.bubble h2,.bubble h3,.bubble h4 { margin:16px 0 8px; font-weight:600; line-height:1.3; }
.bubble h1 { font-size:1.25em; } .bubble h2 { font-size:1.1em; } .bubble h3,.bubble h4 { font-size:1em; }
.bubble ul,.bubble ol { margin:8px 0; padding-left:20px; }
.bubble li { margin:4px 0; }
.bubble blockquote { border-left:3px solid var(--border); margin:8px 0; padding:4px 12px; color:var(--text2); }
.bubble code { font-family:var(--mono); font-size:12px; background:var(--s2); border-radius:4px; padding:1px 5px; }
.bubble pre { background:var(--s2); border:1px solid var(--border); border-radius:8px; padding:12px 14px; overflow-x:auto; margin:10px 0; }
.bubble pre code { background:none; padding:0; font-size:12px; line-height:1.5; }
.bubble table { border-collapse:collapse; width:100%; margin:10px 0; font-size:13px; }
.bubble th,.bubble td { border:1px solid var(--border); padding:6px 10px; text-align:left; }
.bubble th { background:var(--s2); font-weight:600; }
.bubble hr { border:none; border-top:1px solid var(--border); margin:12px 0; }
.page-footer { text-align:center; padding:24px; font-family:var(--mono); font-size:11px; color:var(--muted); border-top:1px solid var(--border); }
</style>
</head>
<body>
<header class="page-header">
  <div class="header-brand">⚡ <span>LLM Hub</span></div>
  <div class="header-title">${safeTitle}</div>
  <div class="header-meta">${escHtml(date)} · ${msgCount} messages</div>
</header>
<main class="chat">
${msgsHtml}
</main>
<footer class="page-footer">Exported from <a href="https://github.com/abanoubEMhanna/local-llm-hub" target="_blank" rel="noopener">LLM Hub</a></footer>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${slug}.html`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Conversation exported as HTML', 'success');
}

// ─────────────────────────────────────────────────────────────────────────────
// § COMPARE MODE
// ─────────────────────────────────────────────────────────────────────────────

function toggleCompareMode() {
  compareMode = !compareMode;
  document.getElementById('compare-btn').classList.toggle('active', compareMode);
  document.getElementById('chat-area-single').style.display = compareMode ? 'none' : 'flex';
  document.getElementById('compare-area').style.display     = compareMode ? 'flex' : 'none';
  if (compareMode) {
    const selA = document.getElementById('compare-model-a');
    const selB = document.getElementById('compare-model-b');
    // Pre-select the current chat model on the left if nothing is picked yet.
    if (!selA.value && selectedModel) selA.value = selectedModel;
    onCompareModelChange();
    updateCompareEmptyState();
    updateCompareSendState();
    setTimeout(() => document.getElementById('compare-input')?.focus(), 50);
  }
}

function onCompareModelChange() {
  compareModelA = document.getElementById('compare-model-a').value || null;
  compareModelB = document.getElementById('compare-model-b').value || null;
  updateCompareEmptyState();
  updateCompareSendState();
}

function updateCompareEmptyState() {
  const paneA = document.getElementById('compare-msgs-a');
  const paneB = document.getElementById('compare-msgs-b');
  // Only repaint empty state when the pane is empty or already showing one.
  const renderEmpty = (pane, hasModel, side) => {
    if (pane.children.length && !pane.querySelector('.empty')) return;
    if (!hasModel) {
      pane.innerHTML =
        `<div class="empty"><div class="empty-icon">⚖️</div>` +
        `<div class="empty-title">Pick ${side} model ↑</div>` +
        `<div class="empty-sub">Choose a model in the dropdown above</div></div>`;
    } else if (!compareModelA || !compareModelB) {
      pane.innerHTML =
        `<div class="empty"><div class="empty-icon">⚖️</div>` +
        `<div class="empty-title">Waiting for the other model</div>` +
        `<div class="empty-sub">Pick the other side, then send a prompt below</div></div>`;
    } else {
      pane.innerHTML =
        `<div class="empty"><div class="empty-icon">💬</div>` +
        `<div class="empty-title">Ready to compare</div>` +
        `<div class="empty-sub">Type a prompt below ↓</div></div>`;
    }
  };
  renderEmpty(paneA, !!compareModelA, 'left');
  renderEmpty(paneB, !!compareModelB, 'right');
}

function updateCompareSendState() {
  const btn   = document.getElementById('compare-send-btn');
  const input = document.getElementById('compare-input');
  const status = document.getElementById('compare-status');
  if (!btn || !input || !status) return;
  const hasText  = input.value.trim().length > 0;
  const ready    = !!(compareModelA && compareModelB);
  // While generating, keep the button enabled so it can act as Stop.
  btn.disabled = isLoading ? false : !(ready && hasText);
  status.classList.remove('ready', 'warn');
  if (!compareModelA && !compareModelB)      { status.textContent = 'Pick both models to start'; }
  else if (!compareModelA)                   { status.textContent = 'Pick the left model';  status.classList.add('warn'); }
  else if (!compareModelB)                   { status.textContent = 'Pick the right model'; status.classList.add('warn'); }
  else if (compareModelA === compareModelB)  { status.textContent = 'Same model on both sides — pick a different one to compare'; status.classList.add('warn'); }
  else if (isLoading)                        { status.textContent = 'Generating… press the stop button to cancel'; }
  else                                       { status.textContent = 'Ready — ↵ to send'; status.classList.add('ready'); }
}

function onCompareSendClick() {
  if (isLoading) { stopGeneration(); return; }
  sendCompare();
}

function handleCompareKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onCompareSendClick(); }
}

function swapCompareModels() {
  const selA = document.getElementById('compare-model-a');
  const selB = document.getElementById('compare-model-b');
  [selA.value, selB.value] = [selB.value, selA.value];
  onCompareModelChange();
}

function clearCompare() {
  if (isLoading) stopGeneration();
  document.getElementById('compare-msgs-a').innerHTML = '';
  document.getElementById('compare-msgs-b').innerHTML = '';
  updateCompareEmptyState();
}

function setCompareLoadingState(loading) {
  isLoading = loading;
  const btn = document.getElementById('compare-send-btn');
  if (!btn) return;
  if (loading) {
    btn.classList.add('stopping');
    btn.title = 'Stop generation';
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="1"/></svg>';
    btn.disabled = false;
  } else {
    btn.classList.remove('stopping');
    btn.title = 'Send to both models';
    btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>';
  }
  updateCompareSendState();
}

async function sendCompare() {
  if (!compareModelA || !compareModelB) return toast('Pick both models', 'error');
  const input = document.getElementById('compare-input');
  const text  = input.value.trim();
  if (!text) return;
  input.value = '';
  autoResize(input);

  // Include system prompt if set
  const sysPrompt = document.getElementById('sys-input').value.trim();
  const apiMsgs = sysPrompt
    ? [{ role: 'system', content: sysPrompt }, { role: 'user', content: text }]
    : [{ role: 'user', content: text }];

  const paneA = document.getElementById('compare-msgs-a');
  const paneB = document.getElementById('compare-msgs-b');

  for (const pane of [paneA, paneB]) {
    if (pane.querySelector('.empty')) pane.innerHTML = '';
    const u = document.createElement('div');
    u.className = 'msg-wrap';
    u.innerHTML = `<div class="msg user"><div class="avatar">👤</div><div class="bubble">${renderMarkdown(text)}</div></div>`;
    pane.appendChild(u);
  }

  setCompareLoadingState(true);
  compareActiveCount = 2;
  compareAbortA = new AbortController();
  compareAbortB = new AbortController();

  const runOne = async (model, pane, controller) => {
    const wrap = document.createElement('div');
    wrap.className = 'msg-wrap';
    wrap.innerHTML = `
      <div class="msg assistant">
        <div class="avatar">🤖</div>
        <div class="bubble"><div class="typing"><span></span><span></span><span></span></div></div>
      </div>
      <div class="msg-meta"><span>${escHtml(model.replace(/^(ollama|lmstudio)\//, ''))}</span></div>`;
    pane.appendChild(wrap);
    const bubble = wrap.querySelector('.bubble');

    const t0 = Date.now();
    let full = '';
    let cleared = false;
    let textDiv = null;

    try {
      const res = await fetch(`${PROXY}/v1/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...apiKeyHeader() },
        body: JSON.stringify({
          model, messages: apiMsgs,
          temperature: parseFloat(document.getElementById('temp-slider').value),
          max_tokens: parseInt(document.getElementById('max-tokens').value) || 2048,
          use_tools: false,
        }),
        signal: controller.signal,
      });
      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buf.indexOf('\n\n')) >= 0) {
          const chunk = buf.slice(0, idx); buf = buf.slice(idx + 2);
          for (const line of chunk.split('\n')) {
            if (!line.startsWith('data: ')) continue;
            let evt; try { evt = JSON.parse(line.slice(6)); } catch { continue; }
            if (evt.type === 'text_delta') {
              if (!cleared) { bubble.innerHTML = ''; textDiv = document.createElement('div'); bubble.appendChild(textDiv); cleared = true; }
              full += evt.delta;
              textDiv.innerHTML = renderMarkdown(full);
              pane.scrollTop = pane.scrollHeight;
            } else if (evt.type === 'done') {
              const meta = wrap.querySelector('.msg-meta');
              meta.innerHTML += ` · <span style="color:var(--accent)">${Date.now() - t0}ms</span>` +
                (evt.completion_tokens != null ? ` · ${evt.completion_tokens} tok` : '');
            } else if (evt.type === 'error') {
              bubble.innerHTML = `<span style="color:var(--orange)">❌ ${escHtml(evt.message)}</span>`;
            }
          }
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') bubble.innerHTML = `<span style="color:var(--orange)">❌ ${escHtml(e.message)}</span>`;
      else if (full) bubble.innerHTML = renderMarkdown(full) + '<div class="stopped-marker">⏹ Stopped</div>';
    }
    compareActiveCount--;
    if (compareActiveCount <= 0) setCompareLoadingState(false);
    highlightNewCode();
  };

  runOne(compareModelA, paneA, compareAbortA);
  runOne(compareModelB, paneB, compareAbortB);
}

// ─────────────────────────────────────────────────────────────────────────────
// § TOKEN COUNTER
// ─────────────────────────────────────────────────────────────────────────────

function approxTokens(text) {
  if (!text) return 0;
  const hasCJK_AR = /[\u0600-\u06FF\u4E00-\u9FFF\u3040-\u30FF]/.test(text);
  return Math.ceil(text.length / (hasCJK_AR ? 2.5 : 4));
}

function updateInputTokenCount() {
  const input = document.getElementById('msg-input');
  const sys   = document.getElementById('sys-input').value;
  const conv  = currentConv();
  let total = approxTokens(sys) + approxTokens(input.value);
  if (conv) {
    for (const m of conv.messages) {
      const t = typeof m.content === 'string' ? m.content
              : Array.isArray(m.content) ? m.content.map(p => p.text || '').join(' ') : '';
      total += approxTokens(t);
    }
  }
  document.getElementById('input-token-count').textContent =
    total > 0 ? `~${total.toLocaleString()} tok` : '';
}

function onInputChange() {
  autoResize(document.getElementById('msg-input'));
  updateInputTokenCount();
}

// ─────────────────────────────────────────────────────────────────────────────
// § THEME
// ─────────────────────────────────────────────────────────────────────────────

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const btn = document.getElementById('theme-btn');
  if (btn) btn.textContent = theme === 'dark' ? '🌙' : '☀️';
}
function toggleTheme() {
  const cur = userSettings.theme === 'dark' ? 'light' : 'dark';
  userSettings.theme = cur;
  localStorage.setItem('llm-settings', JSON.stringify(userSettings));
  applyTheme(cur);
}

// ─────────────────────────────────────────────────────────────────────────────
// § MODALS
// ─────────────────────────────────────────────────────────────────────────────

function openModal(id)  { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

document.addEventListener('click', (e) => {
  if (e.target.classList?.contains('modal-overlay')) {
    e.target.classList.remove('active');
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// § COMMAND PALETTE
// ─────────────────────────────────────────────────────────────────────────────

let paletteSelectedIdx = 0;
let paletteItems       = [];

function buildPaletteCommands() {
  const conv = currentConv();
  return [
    { group: 'Actions',   icon: '✏️',  label: 'New Conversation',         kbd: '⌘J',   action: () => newConversation() },
    { group: 'Actions',   icon: '🔍',  label: 'Search Conversations',      kbd: '⌘K',   action: () => openSearch() },
    { group: 'Actions',   icon: '⛶',   label: 'Toggle Focus Mode',         kbd: '⌘⇧F', action: () => toggleFocusMode() },
    { group: 'Actions',   icon: '🎨',  label: 'Toggle Theme',                            action: () => toggleTheme() },
    ...(conv ? [
      { group: 'Chat',    icon: '📋',  label: 'Export Chat as Markdown',                 action: () => exportConv('md') },
      { group: 'Chat',    icon: '📋',  label: 'Export Chat as JSON',                     action: () => exportConv('json') },
    ] : []),
    { group: 'Models',    icon: '📦',  label: 'Model Manager',                           action: () => openModelManager() },
    { group: 'Models',    icon: '🔄',  label: 'Reload Models',                           action: () => loadModels() },
    { group: 'Settings',  icon: '⚙️',  label: 'Open Settings',                           action: () => openConfigEditor() },
    { group: 'Settings',  icon: '🔑',  label: 'API Keys',                                action: () => openApiKeySettings() },
    { group: 'Tools',     icon: '🔧',  label: 'Toggle Agent Tools',        kbd: '⌘/',   action: () => document.getElementById('tools-toggle').click() },
    { group: 'Tools',     icon: '📄',  label: 'Prompt Templates',                        action: () => openTemplates() },
    { group: 'Tools',     icon: '📚',  label: 'Add to Knowledge Base',                   action: () => openRagUpload() },
    { group: 'Help',      icon: '⌨️',  label: 'Keyboard Shortcuts',        kbd: '?',    action: () => openModal('shortcuts-modal') },
  ];
}

function openPalette() {
  openModal('palette-modal');
  const input = document.getElementById('palette-input');
  input.value = '';
  setTimeout(() => input.focus(), 50);
  filterPalette('');
}

function filterPalette(q) {
  const all = buildPaletteCommands();
  if (!q) {
    paletteItems = all;
  } else {
    const lq = q.toLowerCase();
    paletteItems = all.filter(c =>
      c.label.toLowerCase().includes(lq) || c.group.toLowerCase().includes(lq)
    );
  }
  paletteSelectedIdx = 0;
  renderPalette();
}

function renderPalette() {
  const el = document.getElementById('palette-results');
  if (!paletteItems.length) {
    el.innerHTML = '<div class="palette-empty">No matching commands</div>';
    return;
  }
  let html = '';
  let lastGroup = null;
  paletteItems.forEach((item, i) => {
    if (item.group !== lastGroup) {
      html += `<div class="palette-group-label">${escHtml(item.group)}</div>`;
      lastGroup = item.group;
    }
    html += `<div class="palette-item ${i === paletteSelectedIdx ? 'selected' : ''}" onclick="runPaletteItem(${i})">
      <span class="palette-item-icon">${item.icon}</span>
      <span class="palette-item-label">${escHtml(item.label)}</span>
      ${item.kbd ? `<kbd class="palette-item-kbd">${escHtml(item.kbd)}</kbd>` : ''}
    </div>`;
  });
  el.innerHTML = html;
  const selected = el.querySelector('.palette-item.selected');
  if (selected) selected.scrollIntoView({ block: 'nearest' });
}

function onPaletteInput() {
  filterPalette(document.getElementById('palette-input').value.trim());
}

function onPaletteKeydown(e) {
  if (e.key === 'ArrowDown') {
    paletteSelectedIdx = Math.min(paletteItems.length - 1, paletteSelectedIdx + 1);
    renderPalette(); e.preventDefault();
  } else if (e.key === 'ArrowUp') {
    paletteSelectedIdx = Math.max(0, paletteSelectedIdx - 1);
    renderPalette(); e.preventDefault();
  } else if (e.key === 'Enter') {
    runPaletteItem(paletteSelectedIdx); e.preventDefault();
  }
}

function runPaletteItem(idx) {
  const item = paletteItems[idx];
  if (!item) return;
  closeModal('palette-modal');
  setTimeout(() => item.action(), 50);
}

// ─────────────────────────────────────────────────────────────────────────────
// § HOTKEYS
// ─────────────────────────────────────────────────────────────────────────────

function initHotkeys() {
  document.addEventListener('keydown', (e) => {
    const meta = e.metaKey || e.ctrlKey;

    // Escape closes modals
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
      return;
    }

    // ? shows keyboard shortcuts (only if not typing in an input)
    if (e.key === '?' && !meta && document.activeElement?.tagName !== 'TEXTAREA' && document.activeElement?.tagName !== 'INPUT') {
      openModal('shortcuts-modal');
      return;
    }

    if (!meta) return;

    if (e.key === 'p' || e.key === 'P') { e.preventDefault(); openPalette(); return; }
    if (e.key === 'k' || e.key === 'K') { e.preventDefault(); openSearch(); return; }
    if (e.key === 'j' || e.key === 'J') { e.preventDefault(); newConversation(); return; }
    if ((e.key === 'f' || e.key === 'F') && e.shiftKey) { e.preventDefault(); toggleFocusMode(); return; }

    if (e.key === '/') { e.preventDefault(); document.getElementById('tools-toggle').classList.toggle('on'); return; }

    if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      const conv = currentConv(); if (!conv) return;
      for (let i = conv.messages.length - 1; i >= 0; i--) {
        if (conv.messages[i].role === 'assistant') { regenerateMessage(i); break; }
      }
      return;
    }
    if (e.key === 'e' || e.key === 'E') {
      // Don't steal ⌘E while typing
      if (document.activeElement?.tagName === 'TEXTAREA' || document.activeElement?.tagName === 'INPUT') return;
      e.preventDefault();
      const conv = currentConv(); if (!conv) return;
      for (let i = conv.messages.length - 1; i >= 0; i--) {
        if (conv.messages[i].role === 'user') { openEditMessage(i); break; }
      }
      return;
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// § TOAST
// ─────────────────────────────────────────────────────────────────────────────

function toast(msg, kind = '') {
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 200); }, 2500);
}
function showToast(msg, kind = '') { return toast(msg, kind); }

// ─────────────────────────────────────────────────────────────────────────────
// § UTILS
// ─────────────────────────────────────────────────────────────────────────────

function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function scrollBottom() {
  const el = document.getElementById('messages');
  el.scrollTop = el.scrollHeight;
}

function handleKey(e) {
  // Don't send while composing (IME: Arabic/Chinese/Japanese/Korean input)
  if (e.isComposing || e.keyCode === 229) return;
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onSendClick(); }
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 180) + 'px';
}

// System prompt triggers token-count update too
document.addEventListener('DOMContentLoaded', () => {
  const sys = document.getElementById('sys-input');
  if (sys) sys.addEventListener('input', updateInputTokenCount);
});

// ─────────────────────────────────────────────────────────────────────────────
// § PLAN MODE
// ─────────────────────────────────────────────────────────────────────────────

let planMode = false;

const PLAN_SYSTEM_PROMPT = `Before responding to the user, you MUST first think through the problem step by step inside <plan> tags.
In your plan, analyze the request, consider approaches, identify edge cases, and outline your solution.
After closing </plan>, provide your actual response.

Example format:
<plan>
1. The user wants X
2. I should consider Y and Z
3. Best approach: ...
4. Edge cases: ...
</plan>

Here is my response: ...`;

function togglePlanMode() {
  planMode = !planMode;
  document.getElementById('plan-btn').classList.toggle('active', planMode);
  document.getElementById('plan-indicator').classList.toggle('active', planMode);
  toast(planMode ? 'Plan mode ON — model will think first' : 'Plan mode OFF', 'success');
}

/**
 * Parse <plan>...</plan> from the streamed text.
 * Returns { plan: string|null, response: string }
 */
function parsePlanFromText(text) {
  const planMatch = text.match(/<plan>([\s\S]*?)<\/plan>/);
  if (planMatch) {
    const plan = planMatch[1].trim();
    const response = text.replace(/<plan>[\s\S]*?<\/plan>/, '').trim();
    return { plan, response };
  }
  // Check for incomplete plan (still streaming)
  const openTag = text.indexOf('<plan>');
  if (openTag >= 0) {
    const afterOpen = text.slice(openTag + 6);
    // Plan is still streaming, no close tag yet
    return { plan: afterOpen, response: null, incomplete: true };
  }
  return { plan: null, response: text };
}

/**
 * Create a plan block element for the chat bubble
 */
function createPlanBlock(planText, elapsed = null) {
  const div = document.createElement('div');
  div.className = 'plan-block';
  div.innerHTML = `
    <div class="plan-header" onclick="this.classList.toggle('collapsed');this.nextElementSibling.classList.toggle('hidden')">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
      <span class="plan-label">Thinking</span>
      ${elapsed ? `<span class="plan-elapsed">${elapsed}</span>` : ''}
    </div>
    <div class="plan-body">${escHtml(planText)}</div>`;
  return div;
}

// ─────────────────────────────────────────────────────────────────────────────
// § VOICE INPUT — Dual-mode: Whisper (multilingual) or Browser (Web Speech API)
// ─────────────────────────────────────────────────────────────────────────────

let voiceMode = 'browser'; // 'browser' = Web Speech API, 'whisper' = local Whisper server
let voiceRecognition = null;
let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];

async function initVoice() {
  // Check if Whisper server is available
  try {
    const res = await fetch(`${PROXY}/v1/audio/status`);
    const data = await res.json();
    if (data.enabled && data.online) {
      voiceMode = 'whisper';
      console.log(`[Voice] Whisper mode — server: ${data.server}, model: ${data.model}`);
      const btn = document.getElementById('mic-btn');
      if (btn) btn.title = 'Voice input (Whisper — multilingual, supports Arabic + English)';
      return;
    } else if (data.enabled && !data.online) {
      console.warn('[Voice] Whisper configured but server offline. Falling back to browser mode.');
    }
  } catch { /* proxy might be offline at init, fall through */ }

  // Fallback: Web Speech API
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    const btn = document.getElementById('mic-btn');
    if (btn) btn.style.display = 'none';
    return;
  }
  voiceMode = 'browser';
  voiceRecognition = new SpeechRecognition();
  voiceRecognition.continuous = true;
  voiceRecognition.interimResults = true;
  voiceRecognition.lang = 'en-US';

  let finalTranscript = '';

  voiceRecognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const transcript = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += transcript + ' ';
      } else {
        interim += transcript;
      }
    }
    const input = document.getElementById('msg-input');
    const baseText = input.dataset.preVoice || '';
    input.value = baseText + finalTranscript + interim;
    autoResize(input);
    updateInputTokenCount();
  };

  voiceRecognition.onend = () => {
    if (isRecording) {
      try { voiceRecognition.start(); } catch {}
    } else {
      finalTranscript = '';
      setVoiceUI(false);
    }
  };

  voiceRecognition.onerror = (event) => {
    if (event.error === 'no-speech') return;
    if (event.error === 'not-allowed') {
      toast('Microphone access denied. Check browser permissions.', 'error');
    } else {
      toast('Voice error: ' + event.error, 'error');
    }
    stopVoice();
  };
}

function toggleVoice() {
  if (isRecording) {
    stopVoice();
  } else {
    startVoice();
  }
}

function startVoice() {
  const input = document.getElementById('msg-input');
  input.dataset.preVoice = input.value;
  isRecording = true;
  setVoiceUI(true);

  if (voiceMode === 'whisper') {
    startWhisperRecording();
  } else {
    // Web Speech API
    if (!voiceRecognition) { toast('Voice not supported in this browser.', 'error'); stopVoice(); return; }
    const hasArabic = /[\u0600-\u06FF]/.test(input.value);
    voiceRecognition.lang = hasArabic ? 'ar-EG' : 'en-US';
    try { voiceRecognition.start(); }
    catch (e) { toast('Voice error: ' + e.message, 'error'); stopVoice(); }
  }
}

function stopVoice() {
  isRecording = false;
  if (voiceMode === 'whisper') {
    stopWhisperRecording();
  } else {
    if (voiceRecognition) try { voiceRecognition.stop(); } catch {}
  }
  setVoiceUI(false);
  const input = document.getElementById('msg-input');
  delete input.dataset.preVoice;
  input.focus();
}

function setVoiceUI(active) {
  document.getElementById('mic-btn')?.classList.toggle('recording', active);
  document.getElementById('voice-status')?.classList.toggle('active', active);
  // Update status text based on mode
  const statusEl = document.getElementById('voice-status');
  if (statusEl && active) {
    const span = statusEl.querySelector('span');
    if (span) span.textContent = voiceMode === 'whisper'
      ? 'Recording… (Whisper — speak Arabic + English freely)'
      : 'Listening… (Browser — single language)';
  }
}

// ---- Whisper recording via MediaRecorder ----

async function startWhisperRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        sampleRate: 16000,
        echoCancellation: true,
        noiseSuppression: true,
      }
    });
    audioChunks = [];
    // Prefer webm/opus, fallback to whatever is available
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

    mediaRecorder = new MediaRecorder(stream, { mimeType });
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };
    mediaRecorder.onstop = async () => {
      // Stop all tracks to release the microphone
      stream.getTracks().forEach(t => t.stop());

      if (audioChunks.length === 0) return;

      const audioBlob = new Blob(audioChunks, { type: mimeType });
      audioChunks = [];

      // Send to Whisper for transcription
      await transcribeWithWhisper(audioBlob, mimeType);
    };
    mediaRecorder.start(1000); // Collect in 1s chunks
  } catch (e) {
    if (e.name === 'NotAllowedError') {
      toast('Microphone access denied. Check browser permissions.', 'error');
    } else {
      toast('Mic error: ' + e.message, 'error');
    }
    stopVoice();
  }
}

function stopWhisperRecording() {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
}

async function transcribeWithWhisper(audioBlob, mimeType) {
  const input = document.getElementById('msg-input');
  const baseText = input.dataset.preVoice || '';

  // Show processing state
  const statusSpan = document.getElementById('voice-status')?.querySelector('span');
  if (statusSpan) statusSpan.textContent = 'Transcribing…';

  try {
    // Build multipart/form-data (OpenAI-compatible)
    const formData = new FormData();
    const ext = mimeType.includes('webm') ? 'webm' : mimeType.includes('mp4') ? 'mp4' : 'wav';
    formData.append('file', audioBlob, `recording.${ext}`);
    formData.append('model', 'large-v3'); // Will be overridden by server config
    formData.append('response_format', 'json');
    // Don't set language — let Whisper auto-detect (this is what enables code-switching)

    const res = await fetch(`${PROXY}/v1/audio/transcribe`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(err.error || `Transcription failed: ${res.status}`);
    }

    const data = await res.json();
    const text = data.text || '';

    if (text.trim()) {
      input.value = baseText + (baseText && !baseText.endsWith(' ') ? ' ' : '') + text.trim();
      autoResize(input);
      updateInputTokenCount();
      toast('Transcribed ✓', 'success');
    } else {
      toast('No speech detected', 'error');
    }
  } catch (e) {
    toast('Whisper: ' + e.message, 'error');
    console.error('[Whisper]', e);
  } finally {
    setVoiceUI(false);
    delete input.dataset.preVoice;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § SIDEBAR ACCORDION
// ─────────────────────────────────────────────────────────────────────────────

function togglePanel(btn) {
  const panel = btn.closest('.sidebar-panel');
  if (!panel) return;
  const isOpen = panel.getAttribute('data-open') === 'true';
  panel.setAttribute('data-open', isOpen ? 'false' : 'true');
}

// ─────────────────────────────────────────────────────────────────────────────
// § SYSTEM RESOURCES & MODEL INFO
// ─────────────────────────────────────────────────────────────────────────────

let systemInfo = null;
let runningModelsDetailed = [];  // full objects from /v1/models/running

async function loadSystemInfo() {
  try {
    const res = await fetch(`${PROXY}/v1/system`);
    const data = await res.json();
    systemInfo = data.system || null;
    runningModelsDetailed = data.running_models || [];
    runningModels = runningModelsDetailed.map(m => m.id || `ollama/${m.name}`);
    updateSystemDisplay();
    updateModelInfoCard();
  } catch {
    systemInfo = null;
  }
}

function updateSystemDisplay() {
  if (!systemInfo) return;
  const m = systemInfo.memory;
  const textEl = document.getElementById('sys-ram-text');
  const fillEl = document.getElementById('sys-ram-fill');
  if (textEl) textEl.textContent = `${m.used_label} / ${m.total_label} (${m.usage_pct}%)`;
  if (fillEl) {
    fillEl.style.width = m.usage_pct + '%';
    fillEl.className = 'sys-mem-fill' + (m.usage_pct > 90 ? ' danger' : m.usage_pct > 75 ? ' warn' : '');
  }

  // GPU VRAM — show only when models are actually loaded in GPU memory
  const vramSection = document.getElementById('sys-vram-section');
  const vramText    = document.getElementById('sys-vram-text');
  const vramModels  = document.getElementById('sys-vram-models');
  const gpuModels   = runningModelsDetailed.filter(r => r.vram > 0);
  if (vramSection) {
    if (gpuModels.length > 0) {
      vramSection.style.display = 'block';
      const totalVram = gpuModels.reduce((sum, r) => sum + r.vram, 0);
      if (vramText) vramText.textContent = formatMM(totalVram);
      if (vramModels) {
        vramModels.innerHTML = gpuModels.map(r => {
          const shortName = r.name.replace(/:latest$/, '');
          return `<div class="sys-vram-row">
            <span class="sys-vram-name" title="${r.name}">${shortName}</span>
            <span class="sys-vram-size">${r.vram_label}</span>
          </div>`;
        }).join('');
      }
    } else {
      vramSection.style.display = 'none';
    }
  }
}

function updateModelInfoCard() {
  const card = document.getElementById('model-info-card');
  if (!card) return;

  if (!selectedModel) {
    card.style.display = 'none';
    return;
  }

  const meta = modelMetadata[selectedModel] || {};
  const name = selectedModel.replace(/^(ollama|lmstudio)\//, '');
  const prov = selectedModel.startsWith('ollama/') ? 'ollama' : 'lmstudio';

  // Check loaded status
  const runningMatch = runningModelsDetailed.find(r =>
    r.id === selectedModel || r.name === name || (r.id || '').includes(name)
  );
  const isLoaded = !!runningMatch;

  card.style.display = 'block';

  // Status
  const statusEl = document.getElementById('mic-status');
  if (prov === 'ollama') {
    if (isLoaded) {
      statusEl.textContent = '● Loaded in memory';
      statusEl.className = 'mic-value loaded';
    } else {
      statusEl.textContent = '○ Not loaded — will load on first message';
      statusEl.className = 'mic-value not-loaded';
    }
  } else {
    statusEl.textContent = 'Managed by LM Studio';
    statusEl.className = 'mic-value';
  }

  // Size
  document.getElementById('mic-size').textContent = meta.size_label || '—';

  // Params
  document.getElementById('mic-params').textContent = meta.parameter_size
    ? `${meta.parameter_size}${meta.quantization ? ' (' + meta.quantization + ')' : ''}`
    : '—';

  // Context
  const ctxLen = meta.context_length;
  document.getElementById('mic-context').textContent = ctxLen
    ? `${(ctxLen).toLocaleString()} tokens (${(ctxLen/1024).toFixed(0)}K)`
    : '—';

  // Capabilities
  const caps = detectModelCapabilities(selectedModel, meta);
  const capsRow = document.getElementById('mic-caps-row');
  const capsEl  = document.getElementById('mic-caps');
  if (capsRow && capsEl) {
    if (caps.length) {
      capsRow.style.display = 'flex';
      capsEl.innerHTML = caps.map(c => {
        const info = CAP_LABELS[c] || { label: c, title: c };
        return `<span class="cap-badge ${c}" title="${info.title}">${info.label}</span>`;
      }).join('');
    } else {
      capsRow.style.display = 'none';
    }
  }

  // VRAM (only if loaded)
  const vramRow = document.getElementById('mic-vram-row');
  if (runningMatch && runningMatch.vram > 0) {
    vramRow.style.display = 'flex';
    document.getElementById('mic-vram').textContent = runningMatch.vram_label;
  } else {
    vramRow.style.display = 'none';
  }

  // Context usage bar
  updateContextBar();
}

function updateContextBar(promptTokens, completionTokens) {
  const meta = modelMetadata[selectedModel] || {};
  const ctxLimit = meta.context_length || 8192;
  const used = (promptTokens || 0) + (completionTokens || 0);
  const pct = ctxLimit > 0 ? Math.round((used / ctxLimit) * 100) : 0;

  const fill = document.getElementById('mic-ctx-fill');
  if (fill) {
    fill.style.width = Math.min(pct, 100) + '%';
    fill.className = 'mic-ctx-fill' + (pct > 90 ? ' danger' : pct > 75 ? ' warn' : '');
  }
}

// Show/hide model loading banner with smart progress
let loadingProgress = null; // { interval, pollInterval, startTime, estimatedMs, modelName }

function showModelLoadingBanner(modelName) {
  const banner  = document.getElementById('model-loading-banner');
  const title   = document.getElementById('mlb-title');
  const sub     = document.getElementById('mlb-sub');
  const pctEl   = document.getElementById('mlb-pct');
  const fillEl  = document.getElementById('mlb-fill');
  const detail  = document.getElementById('mlb-detail');
  if (!banner) return;

  // Estimate loading time based on model size
  const meta = modelMetadata[selectedModel] || {};
  const sizeGB = meta.size_label
    ? parseFloat(meta.size_label.replace(/[^\d.]/g, '')) * (meta.size_label.includes('MB') ? 0.001 : 1)
    : 4; // fallback guess
  // Rough estimate: ~2s per GB on Apple Silicon, ~5s per GB on CPU-only
  const estimatedSec = Math.max(3, Math.ceil(sizeGB * 3));
  const estimatedMs  = estimatedSec * 1000;

  title.textContent = `Loading ${modelName} into memory…`;
  sub.textContent   = `~${estimatedSec}s estimated · ${meta.size_label || '?'} · ${meta.parameter_size || '?'}`;
  pctEl.textContent = '0%';
  fillEl.style.width = '0%';
  detail.innerHTML = [
    meta.size_label     ? `<span>💾 ${meta.size_label}</span>` : '',
    meta.parameter_size ? `<span>🧠 ${meta.parameter_size}</span>` : '',
    meta.quantization   ? `<span>🎯 ${meta.quantization}</span>` : '',
  ].filter(Boolean).join('');

  banner.style.display = 'block';

  // Start progress animation
  const startTime = Date.now();

  // Smooth progress: ease-out curve that reaches ~85% at estimated time
  // Then polls /api/ps to detect actual load completion
  const progressInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    // Ease-out curve: fast start, slows down as it approaches target
    // Caps at 85% (remaining 15% is "detecting model" + "first token")
    const ratio = Math.min(elapsed / estimatedMs, 1);
    const easedPct = Math.round(85 * (1 - Math.pow(1 - ratio, 2.5)));
    pctEl.textContent = easedPct + '%';
    fillEl.style.width = easedPct + '%';

    // Update elapsed time display
    const elapsedSec = (elapsed / 1000).toFixed(1);
    sub.textContent = `${elapsedSec}s elapsed · ~${estimatedSec}s estimated`;
  }, 200);

  // Poll /api/ps to detect when model actually appears in running models
  const pollInterval = setInterval(async () => {
    try {
      const res  = await fetch(`${PROXY}/v1/models/running`);
      const data = await res.json();
      const loaded = (data.models || []).some(m =>
        m.name === modelName || (m.id || '').includes(modelName)
      );
      if (loaded) {
        // Model detected in RAM! Jump to 90%
        const pct = document.getElementById('mlb-pct');
        const fill = document.getElementById('mlb-fill');
        if (pct) pct.textContent = '90%';
        if (fill) fill.style.width = '90%';
        const subEl = document.getElementById('mlb-sub');
        if (subEl) subEl.textContent = 'Model loaded — waiting for first token…';
        clearInterval(pollInterval);
      }
    } catch { /* proxy might be busy, ignore */ }
  }, 1500);

  loadingProgress = { progressInterval, pollInterval, startTime, estimatedMs, modelName };
}

function hideModelLoadingBanner() {
  const banner = document.getElementById('model-loading-banner');
  if (!banner) return;

  if (loadingProgress) {
    clearInterval(loadingProgress.progressInterval);
    clearInterval(loadingProgress.pollInterval);

    // Show 100% briefly before hiding
    const pctEl  = document.getElementById('mlb-pct');
    const fillEl = document.getElementById('mlb-fill');
    const subEl  = document.getElementById('mlb-sub');
    const elapsed = ((Date.now() - loadingProgress.startTime) / 1000).toFixed(1);

    if (pctEl)  pctEl.textContent = '100%';
    if (fillEl) fillEl.style.width = '100%';
    if (subEl)  subEl.textContent = `Done in ${elapsed}s ✓`;

    // Fade out after 800ms
    setTimeout(() => {
      banner.style.display = 'none';
      // Reset
      if (pctEl)  pctEl.textContent = '0%';
      if (fillEl) fillEl.style.width = '0%';
    }, 800);

    loadingProgress = null;
  } else {
    banner.style.display = 'none';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § WELCOME PROMPTS
// ─────────────────────────────────────────────────────────────────────────────

function useWelcomePrompt(text) {
  const input = document.getElementById('msg-input');
  input.value = text;
  autoResize(input);
  input.focus();
  updateInputTokenCount();
}

// ─────────────────────────────────────────────────────────────────────────────
// § MODEL MANAGER (pull / delete Ollama models)
// ─────────────────────────────────────────────────────────────────────────────

async function openModelManager() {
  document.getElementById('model-manager-modal').classList.add('open');
  await refreshModelManagerList();
}

async function refreshModelManagerList() {
  const listEl = document.getElementById('mm-model-list');
  listEl.innerHTML = '<div class="loading-row"><div class="spinner"></div> Loading…</div>';

  try {
    const [modelsRes, runningRes] = await Promise.all([
      fetch(`${PROXY}/v1/models`),
      fetch(`${PROXY}/v1/models/running`),
    ]);
    const modelsData  = await modelsRes.json();
    const runningData = await runningRes.json();

    const allModels  = (modelsData.data  || []).filter(m => m.owned_by === 'ollama' || m.id?.startsWith('ollama/'));
    const runningIds = new Set((runningData.models || []).map(m => m.id || m.name));

    if (allModels.length === 0) {
      listEl.innerHTML = '<div class="mm-empty">No Ollama models installed. Pull one above.</div>';
      return;
    }

    listEl.innerHTML = '';
    for (const m of allModels) {
      const shortName = m.id.replace(/^ollama\//, '');
      const isLoaded  = runningIds.has(m.id) || runningIds.has(shortName);
      const meta = modelMetadata[m.id] || {};
      const parts = [];
      if (meta.parameter_size) parts.push(meta.parameter_size);
      if (meta.quantization)   parts.push(meta.quantization);
      if (m.size_label)        parts.push(m.size_label);

      const row = document.createElement('div');
      row.className = 'mm-model-row';
      row.dataset.modelId = m.id;
      row.innerHTML = `
        <div class="mm-model-icon">&#x1F9E0;</div>
        <div class="mm-model-info">
          <div class="mm-model-name">${shortName}</div>
          <div class="mm-model-meta">${parts.length ? parts.join(' &middot; ') : 'Ollama'}</div>
        </div>
        <div class="mm-model-actions">
          ${isLoaded ? '<span class="mm-loaded-badge">loaded</span>' : ''}
          <button class="mm-delete-btn" onclick="deleteModelFromManager('${shortName}', this)" title="Delete model from disk">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
              <path d="M10 11v6"/><path d="M14 11v6"/>
            </svg>
            Delete
          </button>
        </div>`;
      listEl.appendChild(row);
    }
  } catch (e) {
    listEl.innerHTML = `<div class="mm-empty">Could not reach proxy — is it running?</div>`;
  }
}

async function pullModel() {
  const input  = document.getElementById('mm-pull-input');
  const btn    = document.getElementById('mm-pull-btn');
  const prog   = document.getElementById('mm-pull-progress');
  const label  = document.getElementById('mm-progress-label');
  const fill   = document.getElementById('mm-progress-fill');
  const detail = document.getElementById('mm-progress-detail');

  const name = input.value.trim();
  if (!name) { input.focus(); return; }

  btn.disabled   = true;
  input.disabled = true;
  prog.style.display = 'block';
  label.textContent  = `Pulling ${name}…`;
  fill.style.width   = '0%';
  detail.textContent = '';

  try {
    const res = await fetch(`${PROXY}/v1/models/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    const reader = res.body.getReader();
    const dec    = new TextDecoder();
    let   buf    = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const evt = JSON.parse(line.slice(6));
          if (evt.type === 'progress') {
            label.textContent = evt.status || 'Working…';
            if (evt.total > 0) {
              const pct = Math.round((evt.completed / evt.total) * 100);
              fill.style.width = pct + '%';
              detail.textContent = `${formatMM(evt.completed)} / ${formatMM(evt.total)}`;
            } else {
              fill.style.width = '0%';
              detail.textContent = '';
            }
          } else if (evt.type === 'done') {
            label.textContent  = `${name} pulled successfully!`;
            fill.style.width   = '100%';
            detail.textContent = '';
            input.value        = '';
            showToast(`${name} is ready`, 'success');
            await loadModels();
            await refreshModelManagerList();
          } else if (evt.type === 'error') {
            label.textContent  = `Error: ${evt.message}`;
            fill.style.width   = '0%';
            detail.textContent = '';
            showToast(evt.message, 'error');
          }
        } catch {}
      }
    }
  } catch (e) {
    label.textContent = `Failed: ${e.message}`;
    showToast('Pull failed — is Ollama running?', 'error');
  } finally {
    btn.disabled   = false;
    input.disabled = false;
  }
}

async function deleteModelFromManager(modelName, btnEl) {
  if (!confirm(`Delete "${modelName}" from disk? This cannot be undone.`)) return;

  btnEl.disabled = true;
  btnEl.textContent = 'Deleting…';

  try {
    const res  = await fetch(`${PROXY}/v1/models/${encodeURIComponent(modelName)}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.ok) {
      showToast(`${modelName} deleted`, 'success');
      await loadModels();
      await refreshModelManagerList();
    } else {
      showToast(data.error || 'Delete failed', 'error');
      btnEl.disabled = false;
      btnEl.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
        <path d="M10 11v6"/><path d="M14 11v6"/>
      </svg> Delete`;
    }
  } catch (e) {
    showToast('Delete failed — is Ollama running?', 'error');
    btnEl.disabled = false;
  }
}

function formatMM(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
  return (bytes / 1073741824).toFixed(2) + ' GB';
}

// ─────────────────────────────────────────────────────────────────────────────
// § BOOT
// ─────────────────────────────────────────────────────────────────────────────

init();
