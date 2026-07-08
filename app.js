/* ═══════════════════════════════════════════════════════════════════════════
   Local LLM Hub v3 — app.js
   Full frontend logic: streaming, tools, RAG, compare, templates,
   config editor, message actions, artifacts, syntax highlighting,
   search, theme, hotkeys, token counter.
   ═══════════════════════════════════════════════════════════════════════════ */

const PROXY = localStorage.getItem('general_proxy_url') || 'http://localhost:8765';

// ─────────────────────────────────────────────────────────────────────────────
// § STATE
// ─────────────────────────────────────────────────────────────────────────────

let conversations  = JSON.parse(localStorage.getItem('llm-convs')     || '[]');
let folders        = JSON.parse(localStorage.getItem('llm-folders')   || '[]');
let favoriteModels = JSON.parse(localStorage.getItem('llm-fav-models') || '[]');
let modelAliases   = JSON.parse(localStorage.getItem('llm-model-aliases') || '{}');
let showTimestamps = localStorage.getItem('llm-show-ts') === '1';
let userPresets    = JSON.parse(localStorage.getItem('llm-presets')   || '{}');
let templates      = JSON.parse(localStorage.getItem('llm-templates') || 'null') || defaultTemplates();
let userSettings   = JSON.parse(localStorage.getItem('llm-settings')  || '{"theme":"dark"}');
let toastHistory = [];
let toastHistoryOpen = false;

// ── API key helpers (stored in localStorage, sent to proxy via header only)
function getStoredApiKeys() {
  try { return JSON.parse(localStorage.getItem('llm-api-keys') || '{}'); } catch { return {}; }
}
function getCustomProviders() {
  try { return JSON.parse(localStorage.getItem('llm-custom-providers') || '[]'); } catch { return []; }
}
function saveCustomProviders(providers) {
  localStorage.setItem('llm-custom-providers', JSON.stringify(providers));
}
function apiKeyHeader() {
  const headers = {};
  const keys = getStoredApiKeys();
  if (Object.keys(keys).length) headers['X-Api-Keys'] = JSON.stringify(keys);
  const cp = getCustomProviders();
  if (cp.length) headers['X-Custom-Providers'] = JSON.stringify(cp);
  return headers;
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
let activeConvFilter     = null;                 // active label filter for conv list

// Compare mode
let compareMode          = false;
let compareModelA        = null;
let compareModelB        = null;
let compareActiveCount   = 0;
let compareAbortA        = null;
let compareAbortB        = null;
let compareAbMode        = false;   // blind A/B test — hides model names until revealed
let compareAbActualA     = null;    // which model ended up in pane A this round
let compareAbActualB     = null;    // which model ended up in pane B this round

// Compare grading (reset on clearCompare / mode toggle)
// Grades are stored as data-cmp-grade attributes on each assistant msg-wrap

// Template edit state
let editingTemplateId    = null;
let activeRunTemplateId  = null;

// Search state
let searchSelectedIdx    = 0;
let searchMatches        = [];

// In-conversation search state
let convSearchMatches    = [];
let convSearchIdx        = 0;

// Bulk selection state
let bulkSelectMode = false;
const bulkSelected = new Set();

// Session cost accumulator (resets on page reload)
let sessionCostTotal = 0;

// Edit state
let editingMessageIdx    = null;

// ─────────────────────────────────────────────────────────────────────────────
// § DEFAULTS
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// § CONVERSATION LABELS
// ─────────────────────────────────────────────────────────────────────────────

const CONV_LABELS = {
  work:     { color: '#3b82f6', name: 'Work' },
  code:     { color: '#22c55e', name: 'Code' },
  research: { color: '#a78bfa', name: 'Research' },
  ideas:    { color: '#f97316', name: 'Ideas' },
  personal: { color: '#ec4899', name: 'Personal' },
};

function setConvLabel(id, label, e) {
  e?.stopPropagation();
  const conv = conversations.find(c => c.id === id);
  if (!conv) return;
  conv.label = conv.label === label ? null : label;
  saveConvs();
  renderConvList();
  document.getElementById('label-picker')?.remove();
}

function openLabelPicker(id, e) {
  e.stopPropagation();
  document.getElementById('label-picker')?.remove();
  const conv = conversations.find(c => c.id === id);
  if (!conv) return;

  const picker = document.createElement('div');
  picker.id = 'label-picker';
  picker.className = 'label-picker';
  picker.innerHTML = `
    <div class="label-picker-title">Label</div>
    ${Object.entries(CONV_LABELS).map(([key, lbl]) => `
      <button class="label-picker-opt ${conv.label === key ? 'active' : ''}"
              onclick="setConvLabel('${id}','${key}',event)"
              style="--lc:${lbl.color}">
        <span class="label-dot" style="background:${lbl.color}"></span>${lbl.name}
      </button>`).join('')}
    ${conv.label ? `<button class="label-picker-clear" onclick="setConvLabel('${id}',null,event)">Clear</button>` : ''}
  `;

  const rect = e.currentTarget.getBoundingClientRect();
  picker.style.top  = rect.bottom + 4 + 'px';
  picker.style.left = rect.left + 'px';
  document.body.appendChild(picker);

  const dismiss = (ev) => {
    if (!picker.contains(ev.target)) { picker.remove(); document.removeEventListener('click', dismiss, true); }
  };
  setTimeout(() => document.addEventListener('click', dismiss, true), 0);
}

function toggleLabelFilter(label) {
  activeConvFilter = activeConvFilter === label ? null : label;
  renderConvFilter();
  renderConvList();
}

function renderConvFilter() {
  const area = document.getElementById('conv-filter-area');
  if (!area) return;
  area.innerHTML = Object.entries(CONV_LABELS).map(([key, lbl]) => `
    <button class="conv-filter-chip ${activeConvFilter === key ? 'active' : ''}"
            onclick="toggleLabelFilter('${key}')"
            style="--lc:${lbl.color}"
            title="Filter: ${lbl.name}">
      <span class="label-dot-sm" style="background:${lbl.color}"></span>${lbl.name}
    </button>`).join('');
}

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
  applyAppearance();
  if (showTimestamps) document.body.classList.add('show-timestamps');
  document.getElementById('ts-btn')?.classList.toggle('active', showTimestamps);
  _initSchemaEditor();
  await checkHealth();
  await loadModels();
  await loadTools();
  await loadRagCollections();
  await loadSystemInfo();
  initPresets();
  initDragDrop();
  initHotkeys();
  initVoice();
  renderConvFilter();
  renderConvList();
  if (!conversations.length) newConversation();
  else loadConversation(conversations[0].id);
  updateInputTokenCount();
  scheduleHealthCheck(_healthRetryDelay);
  setInterval(loadSystemInfo, 15000);  // Refresh system RAM + running models
  setInterval(refreshTimestamps, 60000);
  if (!localStorage.getItem('llm-onboarded')) openOnboardingWizard();
}

// ── Health check with exponential backoff + reconnect detection ──────────────
let _healthCheckTimer   = null;
let _healthRetryDelay   = 30000;   // ms; doubles on failure, caps at 60s
let _proxyWasOffline    = false;
const HEALTH_NORMAL_MS  = 30000;
const HEALTH_RETRY_BASE = 5000;
const HEALTH_RETRY_MAX  = 60000;

function scheduleHealthCheck(delayMs = 0) {
  clearTimeout(_healthCheckTimer);
  _healthCheckTimer = setTimeout(async () => {
    await checkHealth();
    scheduleHealthCheck(_healthRetryDelay);
  }, delayMs);
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
    setCloudStatus('b-mistral',    data.providers?.mistral);
    setCloudStatus('b-together',   data.providers?.together);
    setCloudStatus('b-fireworks',  data.providers?.fireworks);
    setCloudStatus('b-cohere',     data.providers?.cohere);
    document.getElementById('proxy-alert').style.display = 'none';
    if (_proxyWasOffline) {
      toast('Proxy reconnected ✓', 'success');
      _proxyWasOffline = false;
    }
    _healthRetryDelay = HEALTH_NORMAL_MS;
  } catch {
    document.getElementById('proxy-alert').style.display = 'block';
    const wasOffline = _proxyWasOffline;
    _proxyWasOffline = true;
    _healthRetryDelay = wasOffline
      ? Math.min(_healthRetryDelay * 2, HEALTH_RETRY_MAX)
      : HEALTH_RETRY_BASE;
  }
}
function setStatus(id, online) {
  const el = document.getElementById(id);
  if (el) el.className = `status-dot ${online ? 'online' : 'offline'}`;
}

// ── Desktop notifications ────────────────────────────────────────────────────
function notifyGenerationComplete(conv, text) {
  if (!document.hidden) return;
  if (localStorage.getItem('general_desktop_notif') === '0') return;
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  const title = conv.title || 'LLM Hub';
  const body  = text.replace(/```[\s\S]*?```/g, '[code]').replace(/[#*`_~[\]]/g, '').trim().slice(0, 120);
  new Notification(title, { body: body || 'Response ready', icon: '/favicon.ico' });
}

async function requestDesktopNotifPermission() {
  if (!('Notification' in window)) { toast('Desktop notifications not supported in this browser.', 'warn'); return; }
  const perm = await Notification.requestPermission();
  if (perm === 'granted') {
    localStorage.setItem('general_desktop_notif', '1');
    document.getElementById('general-desktop-notif')?.setAttribute('checked', true);
    document.getElementById('general-desktop-notif').checked = true;
    toast('Desktop notifications enabled ✓', 'success');
  } else {
    toast('Notification permission denied — check browser settings.', 'warn');
  }
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
    const mSearch = document.getElementById('model-search');
    if (mSearch) mSearch.style.display = 'block';
    updateFavModelBtn();
    updateAliasModelBtn();

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

const MODEL_ID_PREFIX_RE = /^(ollama|lmstudio|openai|anthropic|groq|openrouter|mistral|together|fireworks|cohere|custom_[^/]+)\//;

function parseModelId(modelId) {
  const match    = (modelId || '').match(/^(ollama|lmstudio|openai|anthropic|groq|openrouter|mistral|together|fireworks|cohere|custom_[^/]+)\//);
  const provider = match ? match[1] : (modelId?.split('/')[0] || null);
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
  mistral:    '🟤 Mistral',
  together:   '🟣 Together AI',
  fireworks:  '🔶 Fireworks',
  cohere:     '🟢 Cohere',
};

function getProviderLabel(provider) {
  if (PROVIDER_LABELS[provider]) return PROVIDER_LABELS[provider];
  if (provider?.startsWith('custom_')) {
    const id = provider.replace('custom_', '');
    const cp = getCustomProviders().find(c => c.id === id);
    return cp ? `⚙️ ${cp.name}` : `⚙️ Custom`;
  }
  return provider;
}

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
  const n = (modelId || '').toLowerCase().replace(MODEL_ID_PREFIX_RE, '');
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
  const n = (modelId || '').toLowerCase().replace(MODEL_ID_PREFIX_RE, '');
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


function parseModelSizeBytes(sizeLabel) {
  if (!sizeLabel) return null;
  const m = sizeLabel.match(/^([\d.]+)\s*(TB|GB|MB|KB|B)$/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const units = { tb: 1e12, gb: 1e9, mb: 1e6, kb: 1e3, b: 1 };
  return n * (units[m[2].toLowerCase()] || 1);
}

function getHardwareFit(m) {
  if (!systemInfo) return null;
  const meta = modelMetadata[m.id] || {};
  const sizeBytes = parseModelSizeBytes(meta.size_label);
  if (!sizeBytes) return null;
  if (!['ollama', 'lmstudio'].includes(m.owned_by)) return null;
  const freeBytes = systemInfo.memory.free;
  if (sizeBytes <= freeBytes * 0.85) return 'fit';
  if (sizeBytes <= freeBytes * 1.1)  return 'warn';
  return 'no';
}

function buildModelOption(m) {
  const o = document.createElement('option');
  o.value = m.id;
  const name = modelAliases[m.id] || m.id.replace(MODEL_ID_PREFIX_RE, '');
  const meta = modelMetadata[m.id] || {};
  const caps = detectModelCapabilities(m.id, meta);
  const parts = [name];
  if (meta.parameter_size) parts.push(`(${meta.parameter_size})`);
  if (meta.size_label)     parts.push(`[${meta.size_label}]`);
  if (meta.context_length) parts.push(`ctx:${(meta.context_length/1024).toFixed(0)}K`);
  if (caps.length)         parts.push(caps.map(c => CAP_ICONS[c] || c).join(''));
  const fit = getHardwareFit(m);
  if (fit === 'fit')  parts.unshift('🟢');
  else if (fit === 'warn') parts.unshift('🟡');
  else if (fit === 'no')   parts.unshift('🔴');
  o.text = parts.join(' ');
  return o;
}

function fillModelSelect(sel) {
  if (!sel) return;
  const prevVal = sel.value;
  sel.innerHTML = '<option value="">— select model —</option>';

  // Hardware-fit group — local models that fit in available RAM
  if (systemInfo && availableModels.length) {
    const fitModels = availableModels.filter(m => getHardwareFit(m) === 'fit');
    if (fitModels.length) {
      const ogFit = document.createElement('optgroup');
      ogFit.label = `🖥 Fits your system (${systemInfo.memory.free_label} free RAM)`;
      fitModels.forEach(m => ogFit.appendChild(buildModelOption(m)));
      sel.appendChild(ogFit);
    }
  }

  // Pinned models at the top
  const pinnedAvailable = favoriteModels.map(id => availableModels.find(x => x.id === id)).filter(Boolean);
  if (pinnedAvailable.length) {
    const ogPin = document.createElement('optgroup');
    ogPin.label = '★ Pinned';
    pinnedAvailable.forEach(m => ogPin.appendChild(buildModelOption(m)));
    sel.appendChild(ogPin);
  }

  const groups = {};
  for (const m of availableModels) {
    (groups[m.owned_by] = groups[m.owned_by] || []).push(m);
  }
  const ORDER = ['ollama', 'lmstudio', 'openai', 'anthropic', 'groq', 'openrouter', 'mistral', 'together', 'fireworks', 'cohere'];
  const sorted = ORDER.filter(p => groups[p]).concat(Object.keys(groups).filter(p => !ORDER.includes(p)));
  for (const p of sorted) {
    const og = document.createElement('optgroup');
    og.label = getProviderLabel(p);
    // Sort within each provider group by detected family name, then alphabetically
    const sortedModels = [...groups[p]].sort((a, b) => {
      const fa = detectModelFamily(a.id), fb = detectModelFamily(b.id);
      return fa !== fb ? fa.localeCompare(fb) : a.id.localeCompare(b.id);
    });
    for (const m of sortedModels) {
      og.appendChild(buildModelOption(m));
    }
    sel.appendChild(og);
  }
  if (prevVal) sel.value = prevVal;
}

function filterModels(query) {
  const sel = document.getElementById('model-select');
  if (!sel) return;
  const q = (query || '').trim().toLowerCase();
  for (const og of sel.querySelectorAll('optgroup')) {
    let visible = 0;
    for (const opt of og.querySelectorAll('option')) {
      const match = !q || opt.text.toLowerCase().includes(q) || opt.value.toLowerCase().includes(q);
      opt.style.display = match ? '' : 'none';
      if (match) visible++;
    }
    og.style.display = visible ? '' : 'none';
  }
  for (const opt of sel.children) {
    if (opt.tagName === 'OPTION') {
      opt.style.display = !q || opt.text.toLowerCase().includes(q) ? '' : 'none';
    }
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
  updateParamProfileBadge();
  updateFavModelBtn();
  updateAliasModelBtn();
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
  const alias = modelAliases[selectedModel];

  let infoHtml = `<span style="font-weight:500" title="${escHtml(name)}">${escHtml(alias || name)}</span>`;
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
const DEFAULT_PARAMS = { ...SAMPLING_PROFILES.balanced, maxTok: 2048, stop: '', seed: '' };
// parseStopSequences() comes from lib/stop-sequences.js, parseSeed() from lib/seed.js — both loaded via <script> before this file.

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
  const n = (v, d) => Number.isFinite(v) ? v : d;
  return {
    temp:   n(parseFloat(document.getElementById('temp-slider')?.value),   DEFAULT_PARAMS.temp),
    maxTok: n(parseInt(document.getElementById('max-tokens')?.value, 10),  DEFAULT_PARAMS.maxTok),
    topP:   n(parseFloat(document.getElementById('top-p-slider')?.value),  DEFAULT_PARAMS.topP),
    topK:   n(parseInt(document.getElementById('top-k-slider')?.value, 10),DEFAULT_PARAMS.topK),
    repeat: n(parseFloat(document.getElementById('repeat-slider')?.value), DEFAULT_PARAMS.repeat),
    freq:   n(parseFloat(document.getElementById('freq-slider')?.value),   DEFAULT_PARAMS.freq),
    stop:   document.getElementById('stop-sequences')?.value ?? DEFAULT_PARAMS.stop,
    seed:   document.getElementById('seed-input')?.value ?? DEFAULT_PARAMS.seed,
  };
}

function applyParams(p) {
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
  const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

  if (p.temp   !== undefined) { setVal('temp-slider',   p.temp);   setTxt('temp-val',   p.temp.toFixed(2)); }
  if (p.maxTok !== undefined)   setVal('max-tokens',    p.maxTok);
  if (p.topP   !== undefined) { setVal('top-p-slider',  p.topP);   setTxt('top-p-val',  p.topP.toFixed(2)); }
  if (p.topK   !== undefined) { setVal('top-k-slider',  p.topK);   setTxt('top-k-val',  p.topK); }
  if (p.repeat !== undefined) { setVal('repeat-slider', p.repeat); setTxt('repeat-val', p.repeat.toFixed(2)); }
  if (p.freq   !== undefined) { setVal('freq-slider',   p.freq);   setTxt('freq-val',   p.freq.toFixed(1)); }
  setVal('stop-sequences', p.stop ?? '');
  setVal('seed-input', p.seed ?? '');

  document.querySelectorAll('.preset-chip').forEach(b => b.classList.remove('active'));
  const match = Object.entries(SAMPLING_PROFILES).find(([, v]) =>
    p.temp   !== undefined && Math.abs(v.temp   - p.temp)   < 0.01 &&
    p.topP   !== undefined && Math.abs(v.topP   - p.topP)   < 0.01 &&
    p.topK   !== undefined && v.topK === p.topK &&
    p.repeat !== undefined && Math.abs(v.repeat - p.repeat) < 0.01 &&
    p.freq   !== undefined && Math.abs(v.freq   - p.freq)   < 0.01
  );
  if (match) document.getElementById(`pchip-${match[0]}`)?.classList.add('active');
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
  applyParams(p);
}

function updateParamProfileBadge() {
  const bar = document.getElementById('param-profile-bar');
  const lbl = document.getElementById('param-profile-label');
  if (!bar) return;
  const hasProfile = !!(selectedModel && getModelParamsStore()[selectedModel]);
  bar.style.display = hasProfile ? 'flex' : 'none';
  if (hasProfile && lbl) {
    const { name } = parseModelId(selectedModel);
    lbl.textContent = `Saved for ${name}`;
  }
}

function resetModelParams() {
  if (!selectedModel) return;
  const store = getModelParamsStore();
  delete store[selectedModel];
  localStorage.setItem(MODEL_PARAMS_STORE, JSON.stringify(store));
  applyParams(DEFAULT_PARAMS);
  updateParamProfileBadge();
  toast('Parameter profile cleared', 'info');
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

// ─── Text / code file support ────────────────────────────────────────────────
const TEXT_EXTS = new Set([
  'js','mjs','cjs','ts','tsx','jsx','py','rb','php','java','kt','swift',
  'go','rs','c','cpp','h','hpp','cs','m','sh','zsh','bash','fish',
  'md','mdx','txt','csv','json','yaml','yml','toml','xml','html','htm',
  'css','scss','sass','less','sql','graphql','gql','lua','r','jl',
  'ex','exs','hs','elm','clj','erl','dart','vue','svelte',
  'env','gitignore','eslintrc','prettierrc','babelrc','editorconfig',
]);

function detectLanguage(filename) {
  const name = filename.toLowerCase();
  const ext  = name.split('.').pop();
  if (name === 'dockerfile' || name.startsWith('dockerfile.')) return 'dockerfile';
  if (name === 'makefile' || name === 'rakefile') return 'makefile';
  const map = {
    js:'javascript', mjs:'javascript', cjs:'javascript',
    ts:'typescript', tsx:'tsx', jsx:'jsx',
    py:'python', rb:'ruby', php:'php',
    java:'java', kt:'kotlin', swift:'swift',
    go:'go', rs:'rust', c:'c', cpp:'cpp', h:'c', hpp:'cpp', cs:'csharp',
    m:'objc', sh:'bash', zsh:'bash', bash:'bash', fish:'fish',
    md:'markdown', mdx:'markdown', txt:'text', csv:'csv',
    json:'json', yaml:'yaml', yml:'yaml', toml:'toml', xml:'xml',
    html:'html', htm:'html', css:'css', scss:'scss', sass:'sass', less:'less',
    sql:'sql', graphql:'graphql', gql:'graphql',
    lua:'lua', r:'r', jl:'julia', ex:'elixir', exs:'elixir',
    hs:'haskell', elm:'elm', clj:'clojure', erl:'erlang', dart:'dart',
    vue:'vue', svelte:'svelte', env:'dotenv',
  };
  return map[ext] || 'text';
}

const SPECIAL_TEXT_FILENAMES = new Set(['dockerfile', 'makefile', 'rakefile']);

function isTextFile(file) {
  const name = file.name.toLowerCase();
  if (file.type.startsWith('text/')) return true;
  if (SPECIAL_TEXT_FILENAMES.has(name)) return true;
  const ext = name.includes('.') ? name.split('.').pop() : '';
  return TEXT_EXTS.has(ext) || TEXT_EXTS.has(name);
}

// ─── Audio file transcription (drag-and-drop) ────────────────────────────────
const AUDIO_EXTS = new Set(['mp3', 'wav', 'm4a', 'ogg', 'oga', 'flac', 'webm', 'mp4', 'mpeg', 'mpga']);

function isAudioFile(file) {
  if (file.type.startsWith('audio/')) return true;
  const name = file.name.toLowerCase();
  const ext = name.includes('.') ? name.split('.').pop() : '';
  return AUDIO_EXTS.has(ext);
}

let audioTranscribeQueue = Promise.resolve();

function transcribeAudioFile(file) {
  audioTranscribeQueue = audioTranscribeQueue.then(() => doTranscribeAudioFile(file));
  return audioTranscribeQueue;
}

async function doTranscribeAudioFile(file) {
  const input = document.getElementById('msg-input');
  toast(`Transcribing ${file.name}…`, '');

  try {
    const formData = new FormData();
    formData.append('file', file, file.name);
    formData.append('model', 'large-v3'); // Overridden by server config
    formData.append('response_format', 'json');

    const res = await fetch(`${PROXY}/v1/audio/transcribe`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      throw new Error(err.error || `Transcription failed: ${res.status}`);
    }

    const data = await res.json();
    const text = (data.text || '').trim();

    if (text) {
      const baseText = input.value;
      input.value = baseText + (baseText && !baseText.endsWith(' ') && !baseText.endsWith('\n') ? ' ' : '') + text;
      autoResize(input);
      updateInputTokenCount();
      toast(`Transcribed ${file.name} ✓`, 'success');
    } else {
      toast(`No speech detected in ${file.name}`, 'error');
    }
  } catch (e) {
    toast('Transcription: ' + e.message, 'error');
    console.error('[Audio transcribe]', e);
  }
}

function handleFiles(files) {
  for (const file of files) {
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      handlePdfFile(file);
    } else if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = () => {
        attachments.push({ type: 'image', dataUrl: reader.result, name: file.name });
        renderAttachments();
      };
      reader.readAsDataURL(file);
    } else if (isTextFile(file)) {
      const reader = new FileReader();
      reader.onload = () => {
        attachments.push({
          type: 'text',
          name: file.name,
          content: reader.result,
          language: detectLanguage(file.name),
        });
        renderAttachments();
      };
      reader.readAsText(file, 'utf-8');
    } else if (isAudioFile(file)) {
      transcribeAudioFile(file);
    }
  }
}

function handlePdfFiles(files) {
  for (const file of files) handlePdfFile(file);
}

async function handlePdfFile(file) {
  if (typeof pdfjsLib === 'undefined') {
    alert('PDF.js is not loaded. Please refresh the page.');
    return;
  }
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  const attachmentId = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID()
    : `pdf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  attachments.push({ id: attachmentId, type: 'pdf', name: file.name, text: null, pageCount: 0, loading: true });
  renderAttachments();

  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const parts = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      parts.push(content.items.map(item => item.str).join(' '));
    }
    const idx = attachments.findIndex(a => a.id === attachmentId);
    if (idx !== -1) {
      attachments[idx] = {
        id: attachmentId,
        type: 'pdf',
        name: file.name,
        text: parts.join('\n\n'),
        pageCount: pdf.numPages,
        loading: false,
      };
    }
  } catch (err) {
    console.error('PDF extraction failed:', err);
    const idx = attachments.findIndex(a => a.id === attachmentId);
    if (idx !== -1) attachments.splice(idx, 1);
  }
  renderAttachments();
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
  c.innerHTML = attachments.map((a, i) => {
    if (a.type === 'pdf') {
      const label = a.loading
        ? `${escHtml(a.name)} — extracting…`
        : `${escHtml(a.name)} (${a.pageCount}p, ${Math.round((a.text?.length || 0) / 1000)}k chars)`;
      return `<div class="att-doc${a.loading ? ' att-doc-loading' : ''}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <span>${label}</span>
        <button class="att-remove" style="position:static;width:14px;height:14px" onclick="removeAttachment(${i})" title="Remove">×</button>
      </div>`;
    }
    if (a.type === 'text') {
      const lines = (a.content || '').split('\n').length;
      const size  = a.content ? (a.content.length > 1024
        ? `${Math.round(a.content.length / 1024)}k chars`
        : `${a.content.length} chars`) : '';
      return `<div class="att-doc att-code">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
        <span>${escHtml(a.name)} <em class="att-meta">${lines} lines · ${a.language} · ${size}</em></span>
        <button class="att-remove" style="position:static;width:14px;height:14px" onclick="removeAttachment(${i})" title="Remove">×</button>
      </div>`;
    }
    return `<div class="att-thumb">
      <img src="${escHtml(a.dataUrl)}" alt=""/>
      <button class="att-remove" onclick="removeAttachment(${i})" title="Remove">×</button>
    </div>`;
  }).join('');
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
// § FOLDERS
// ─────────────────────────────────────────────────────────────────────────────

function saveFolders()        { localStorage.setItem('llm-folders',    JSON.stringify(folders)); }
function saveFavoriteModels() { localStorage.setItem('llm-fav-models', JSON.stringify(favoriteModels)); }
function saveModelAliases()   { localStorage.setItem('llm-model-aliases', JSON.stringify(modelAliases)); }

function refreshModelSelects() {
  for (const id of ['model-select', 'compare-model-a', 'compare-model-b']) {
    const sel = document.getElementById(id);
    if (!sel) continue;
    const prev = sel.value;
    fillModelSelect(sel);
    sel.value = prev;
  }
}

function renameModelAlias() {
  if (!selectedModel) return;
  const current = modelAliases[selectedModel] || '';
  const input = prompt('Friendly name for this model (leave blank to reset):', current);
  if (input === null) return;
  const trimmed = input.trim().slice(0, 40);
  if (trimmed) modelAliases[selectedModel] = trimmed;
  else         delete modelAliases[selectedModel];
  saveModelAliases();
  refreshModelSelects();
  updateModelHeader();
  updateAliasModelBtn();
  showToast(trimmed ? `Renamed to "${trimmed}"` : 'Alias reset', 'success');
}

function updateAliasModelBtn() {
  const btn = document.getElementById('alias-model-btn');
  if (!btn) return;
  if (!selectedModel) { btn.style.display = 'none'; return; }
  btn.style.display = 'flex';
  const alias = modelAliases[selectedModel];
  btn.textContent = alias ? `✏️ ${alias}` : '✏️ Rename';
  btn.classList.toggle('is-fav', !!alias);
  btn.title = alias ? 'Click to change or clear the friendly name' : 'Give this model a friendly name';
}

function toggleFavoriteModel() {
  if (!selectedModel) return;
  const idx = favoriteModels.indexOf(selectedModel);
  if (idx === -1) favoriteModels.push(selectedModel);
  else            favoriteModels.splice(idx, 1);
  saveFavoriteModels();
  refreshModelSelects();
  updateFavModelBtn();
}

function updateFavModelBtn() {
  const btn = document.getElementById('fav-model-btn');
  if (!btn) return;
  if (!selectedModel) { btn.style.display = 'none'; return; }
  btn.style.display = 'flex';
  const isFav = favoriteModels.includes(selectedModel);
  btn.textContent = isFav ? '★ Pinned' : '☆ Pin to top';
  btn.classList.toggle('is-fav', isFav);
  btn.title = isFav ? 'Remove from pinned models' : 'Pin to top of model list';
}

function createFolder() {
  const name = prompt('Folder name:');
  if (!name?.trim()) return;
  folders.push({ id: `f-${Date.now()}`, name: name.trim().slice(0, 40), collapsed: false });
  saveFolders();
  renderConvList();
}

function renameFolder(id, e) {
  e.stopPropagation();
  const folder = folders.find(f => f.id === id);
  if (!folder) return;
  const name = prompt('Rename folder:', folder.name);
  if (!name?.trim() || name.trim() === folder.name) return;
  folder.name = name.trim().slice(0, 40);
  saveFolders();
  renderConvList();
}

function deleteFolder(id, e) {
  e.stopPropagation();
  const folder = folders.find(f => f.id === id);
  if (!folder) return;
  if (!confirm(`Delete folder "${folder.name}"? Conversations will move to the main list.`)) return;
  folders = folders.filter(f => f.id !== id);
  conversations.forEach(c => { if (c.folderId === id) c.folderId = null; });
  saveFolders();
  saveConvs();
  renderConvList();
}

function toggleFolderCollapse(id) {
  const folder = folders.find(f => f.id === id);
  if (!folder) return;
  folder.collapsed = !folder.collapsed;
  saveFolders();
  renderConvList();
}

function openFolderPicker(convId, e) {
  e.stopPropagation();
  document.getElementById('folder-picker')?.remove();
  document.getElementById('label-picker')?.remove();
  const conv = conversations.find(c => c.id === convId);
  if (!conv) return;
  const btn = e.currentTarget;
  const rect = btn.getBoundingClientRect();
  const picker = document.createElement('div');
  picker.id = 'folder-picker';
  picker.className = 'label-picker';
  picker.innerHTML = `
    <div class="label-picker-title">Move to folder</div>
    <button class="label-picker-opt ${!conv.folderId ? 'active' : ''}"
      onclick="setConvFolder('${convId}',null)">
      <span style="font-size:11px;opacity:.5">— No folder</span>
    </button>
    ${folders.map(f => `
      <button class="label-picker-opt ${conv.folderId === f.id ? 'active' : ''}"
        onclick="setConvFolder('${convId}','${f.id}')">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style="opacity:.6;flex-shrink:0"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
        ${escHtml(f.name)}
      </button>`).join('')}
    ${folders.length === 0 ? `<div style="font-size:10px;color:var(--muted);padding:6px 8px 2px">No folders yet — create one first</div>` : ''}
  `;
  picker.style.top  = `${rect.bottom + 4}px`;
  picker.style.left = `${Math.min(rect.left, window.innerWidth - 160)}px`;
  document.body.appendChild(picker);
  setTimeout(() => document.addEventListener('click', () => document.getElementById('folder-picker')?.remove(), { once: true }), 0);
}

function setConvFolder(convId, folderId) {
  document.getElementById('folder-picker')?.remove();
  const conv = conversations.find(c => c.id === convId);
  if (!conv) return;
  conv.folderId = folderId || null;
  saveConvs();
  renderConvList();
}

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
  // Persist system prompt and context length override to the conversation we're leaving
  const prev = currentConv();
  if (prev) {
    prev.sysPrompt = document.getElementById('sys-input').value;
    prev.ctxLen    = document.getElementById('ctx-length-input')?.value ?? '';
    saveConvs();
  }

  currentConvId = id;
  const conv = currentConv();
  if (!conv) return;
  closeConvSearch();

  // Restore this conversation's system prompt (empty string is valid)
  document.getElementById('sys-input').value = conv.sysPrompt ?? '';
  const ctxLenInput = document.getElementById('ctx-length-input');
  if (ctxLenInput) ctxLenInput.value = conv.ctxLen ?? '';

  renderMessages(conv.messages);
  renderConvList();
  document.getElementById('stats-bar').style.display = 'none';
  updateInputTokenCount();
  closeMobileSidebars();
  updateRagActiveBadge();
  renderRagList();
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

// ─────────────────────────────────────────────────────────────────────────────
// § CONVERSATION BRANCHING
// ─────────────────────────────────────────────────────────────────────────────

function branchFromMessage(idx) {
  const conv = currentConv();
  if (!conv) return;

  // Include messages 0..idx (the user message at idx becomes the branch point)
  const branchMsgs = JSON.parse(JSON.stringify(conv.messages.slice(0, idx + 1)));

  const id = Date.now().toString();
  const newConv = {
    id,
    title: `Branch: ${conv.title}`,
    messages: branchMsgs,
    ts: Date.now(),
    pinned: false,
    sysPrompt: conv.sysPrompt || '',
    ctxLen: conv.ctxLen || '',
    folderId: conv.folderId || null,
    label: conv.label || null,
    parentId: conv.id,
    branchIdx: idx,
  };

  conversations.unshift(newConv);
  try {
    saveConvs();
  } catch (err) {
    conversations.shift();
    toast('Could not create branch: local storage is full.', 'error');
    return;
  }
  loadConversation(id);
  renderConvList();
  toast(`Branched from message ${idx + 1} — explore a different path!`, 'success');
}

function jumpToParentConv(parentId, e) {
  e?.stopPropagation();
  const parent = conversations.find(c => c.id === parentId);
  if (!parent) { toast('Parent conversation not found.', 'error'); return; }
  loadConversation(parentId);
}

// ── Bulk Conversation Management ────────────────────────────────────────────

function toggleBulkMode() {
  bulkSelectMode = !bulkSelectMode;
  if (!bulkSelectMode) bulkSelected.clear();
  document.getElementById('bulk-bar').classList.toggle('visible', bulkSelectMode);
  document.getElementById('bulk-select-btn').classList.toggle('active', bulkSelectMode);
  updateBulkCount();
  renderConvList();
}

function exitBulkMode() {
  bulkSelectMode = false;
  bulkSelected.clear();
  document.getElementById('bulk-bar').classList.remove('visible');
  document.getElementById('bulk-select-btn').classList.remove('active');
  renderConvList();
}

function bulkToggleConv(id, e) {
  e.stopPropagation();
  if (bulkSelected.has(id)) bulkSelected.delete(id); else bulkSelected.add(id);
  updateBulkCount();
  const item = document.querySelector(`.conv-item[data-id="${id}"]`);
  if (item) {
    item.classList.toggle('bulk-selected', bulkSelected.has(id));
    const chk = item.querySelector('.conv-check');
    if (chk) chk.classList.toggle('checked', bulkSelected.has(id));
  }
}

function updateBulkCount() {
  const n = bulkSelected.size;
  const el = document.getElementById('bulk-count');
  if (el) el.textContent = n === 0 ? 'None' : `${n} selected`;
  const allBtn = document.getElementById('bulk-all-btn');
  if (allBtn) allBtn.textContent = (bulkSelected.size === conversations.length && conversations.length > 0) ? 'Deselect all' : 'Select all';
}

function bulkSelectAll() {
  if (bulkSelected.size === conversations.length && conversations.length > 0) {
    bulkSelected.clear();
  } else {
    conversations.forEach(c => bulkSelected.add(c.id));
  }
  updateBulkCount();
  renderConvList();
}

function bulkDeleteSelected() {
  const n = bulkSelected.size;
  if (!n) { toast('No conversations selected.', 'info'); return; }
  if (!confirm(`Delete ${n} conversation${n !== 1 ? 's' : ''}? This cannot be undone.`)) return;
  const hadCurrent = currentConvId && bulkSelected.has(currentConvId);
  conversations = conversations.filter(c => !bulkSelected.has(c.id));
  if (hadCurrent) {
    currentConvId = null;
    const msgs = document.getElementById('messages');
    if (msgs) msgs.innerHTML = '';
    const hdr = document.getElementById('chat-header-title');
    if (hdr) hdr.innerHTML = '';
  }
  saveConvs();
  toast(`Deleted ${n} conversation${n !== 1 ? 's' : ''}.`, 'success');
  exitBulkMode();
}

function bulkExportSelected() {
  const n = bulkSelected.size;
  if (!n) { toast('No conversations selected.', 'info'); return; }
  const selected = conversations.filter(c => bulkSelected.has(c.id));
  const blob = new Blob([JSON.stringify({ app: 'llm-hub', exported: new Date().toISOString(), conversations: selected }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `llm-hub-${n}-conversations.json`;
  a.click(); URL.revokeObjectURL(url);
  toast(`Exported ${n} conversation${n !== 1 ? 's' : ''}.`, 'success');
}

let _convListFirstRender = true;

function renderConvList() {
  const list = document.getElementById('conv-list');
  let sorted = [...conversations].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    return b.ts - a.ts;
  });
  if (activeConvFilter) sorted = sorted.filter(c => c.label === activeConvFilter);

  const stagger = _convListFirstRender;
  _convListFirstRender = false;

  function convItemHtml(c, i) {
    const lbl = c.label ? CONV_LABELS[c.label] : null;
    const labelDot = lbl
      ? `<span class="conv-label-dot" style="background:${lbl.color}" title="${lbl.name}"></span>`
      : '';
    const branchDot = c.parentId
      ? `<span class="conv-branch-dot" onclick="jumpToParentConv('${c.parentId}',event)" title="Branched conversation — click to go to parent">⑂</span>`
      : '';
    const enterCls   = stagger ? ' conv-item-enter' : '';
    const staggerStyle = stagger ? ` style="--stagger-i:${Math.min(i, 8) * 35}ms"` : '';

    if (bulkSelectMode) {
      const isSel = bulkSelected.has(c.id);
      return `
      <div class="conv-item${enterCls}${isSel ? ' bulk-selected' : ''}" data-id="${c.id}"${staggerStyle}
           onclick="bulkToggleConv('${c.id}',event)">
        <span class="conv-check${isSel ? ' checked' : ''}" aria-hidden="true">
          ${isSel ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
        </span>
        <div class="conv-title">${branchDot}${labelDot}${escHtml(c.title)}</div>
        <div class="conv-meta">${c.messages.length} msgs · ${timeAgo(c.ts)}</div>
      </div>`;
    }

    return `
    <div class="conv-item${enterCls} ${c.id === currentConvId ? 'active' : ''} ${c.pinned ? 'pinned' : ''}" data-id="${c.id}"${staggerStyle}
         onclick="loadConversation('${c.id}')">
      <div class="conv-title" ondblclick="startRenameConv('${c.id}',event)" title="Double-click to rename">
        ${branchDot}${labelDot}${escHtml(c.title)}
      </div>
      <div class="conv-meta">${c.messages.length} msgs · ${timeAgo(c.ts)}</div>
      <div class="conv-actions">
        <button onclick="openLabelPicker('${c.id}',event)" title="Label" class="${c.label ? 'labeled' : ''}">🏷</button>
        <button onclick="openFolderPicker('${c.id}',event)" title="Move to folder" class="${c.folderId ? 'labeled' : ''}">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
        </button>
        <button onclick="togglePin('${c.id}',event)" title="${c.pinned ? 'Unpin' : 'Pin'}">${c.pinned ? '📌' : '📍'}</button>
        <button class="danger" onclick="deleteConversation('${c.id}',event)" title="Delete">×</button>
      </div>
    </div>`;
  }

  const pinned   = sorted.filter(c => c.pinned);
  const unpinned = sorted.filter(c => !c.pinned);
  let html = '';
  let idx  = 0;

  // Pinned convs (always on top, no folder grouping)
  html += pinned.map((c, i) => convItemHtml(c, i)).join('');
  idx += pinned.length;

  // Folder sections
  folders.forEach(folder => {
    const fConvs = unpinned.filter(c => c.folderId === folder.id);
    html += `
    <div class="folder-header" onclick="toggleFolderCollapse('${folder.id}')">
      <svg class="folder-chevron ${folder.collapsed ? 'collapsed' : ''}" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0;opacity:.7"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
      <span class="folder-name">${escHtml(folder.name)}</span>
      <span class="folder-count">${fConvs.length}</span>
      <div class="folder-actions">
        <button onclick="renameFolder('${folder.id}',event)" title="Rename folder">✎</button>
        <button class="danger" onclick="deleteFolder('${folder.id}',event)" title="Delete folder">×</button>
      </div>
    </div>`;
    if (!folder.collapsed) {
      if (fConvs.length) {
        html += fConvs.map((c, i) => convItemHtml(c, idx + i)).join('');
        idx += fConvs.length;
      } else {
        html += `<div class="folder-empty">No chats in this folder</div>`;
      }
    }
  });

  // Unfiled conversations
  const unfiled = unpinned.filter(c => !c.folderId || !folders.find(f => f.id === c.folderId));
  html += unfiled.map((c, i) => convItemHtml(c, idx + i)).join('');

  list.innerHTML = html;
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

  if (attachments.some(a => a.type === 'pdf' && a.loading)) {
    toast('Please wait until PDF extraction finishes.', 'info');
    return;
  }

  input.value = '';
  autoResize(input);
  updateInputTokenCount();

  const conv = currentConv();
  if (!conv) return;
  document.getElementById('empty-state')?.remove();

  let userContent;
  if (attachments.length > 0) {
    userContent = [];
    // PDFs go first as document context blocks
    for (const a of attachments) {
      if (a.type === 'pdf' && a.text && !a.loading) {
        const MAX_CHARS = 80000;
        const body = a.text.length > MAX_CHARS
          ? a.text.slice(0, MAX_CHARS) + '\n\n[… document truncated at 80 000 characters]'
          : a.text;
        userContent.push({ type: 'text', text: `📄 Document: ${a.name} (${a.pageCount} pages)\n\n${body}` });
      }
    }
    // Code/text files as fenced code blocks
    for (const a of attachments) {
      if (a.type === 'text' && a.content) {
        const MAX_CHARS = 100000;
        const body = a.content.length > MAX_CHARS
          ? a.content.slice(0, MAX_CHARS) + '\n\n[… file truncated at 100 000 characters]'
          : a.content;
        const backtickRuns = body.match(/`+/g) || [];
        const fence = '`'.repeat(Math.max(3, ...backtickRuns.map(run => run.length + 1)));
        userContent.push({ type: 'text', text: `💻 File: ${a.name}\n${fence}${a.language}\n${body}\n${fence}` });
      }
    }
    if (text) userContent.push({ type: 'text', text });
    for (const a of attachments) {
      if (a.type === 'image') userContent.push({ type: 'image_url', image_url: { url: a.dataUrl } });
    }
    if (!userContent.length) userContent = text;
  } else {
    userContent = text;
  }

  const msgTs = Date.now();
  conv.messages.push({ role: 'user', content: userContent, ts: msgTs });
  if (conv.messages.length === 1 && text) {
    conv.title = text.slice(0, 40) + (text.length > 40 ? '…' : '');
  }
  conv.ts = msgTs;
  saveConvs();
  renderConvList();

  const imgsForBubble  = attachments.filter(a => a.type === 'image' && a.dataUrl);
  const pdfsForBubble  = attachments.filter(a => a.type === 'pdf' && a.text && !a.loading);
  const codeForBubble  = attachments.filter(a => a.type === 'text' && a.content);
  appendUserBubble(conv.messages.length - 1, text, imgsForBubble, pdfsForBubble, msgTs, codeForBubble);
  attachments = []; renderAttachments();

  await streamAssistantReply(conv);
}

function messageTextContent(msg) {
  if (typeof msg.content === 'string') return msg.content;
  if (Array.isArray(msg.content)) return msg.content.filter(p => p.type === 'text').map(p => p.text).join('\n');
  return '';
}

async function autoInjectRagContext(conv) {
  if (!conv.ragCollectionId) return null;
  const lastUserMsg = [...conv.messages].reverse().find(m => m.role === 'user');
  const query = lastUserMsg ? messageTextContent(lastUserMsg).trim() : '';
  if (!query) return null;
  try {
    const cfgRes = await fetch(`${PROXY}/v1/config`);
    const cfg    = await cfgRes.json();
    if (!cfg.rag?.auto_inject) return null;
    const res = await fetch(`${PROXY}/v1/rag/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ collection_id: conv.ragCollectionId, query, top_k: cfg.rag?.top_k || 5 }),
    });
    if (!res.ok) return null;
    const data    = await res.json();
    const results = data.results || [];
    if (!results.length) return null;
    const context = results.map(r => `Source: ${r.source} (relevance ${r.score.toFixed(3)})\n${r.text}`).join('\n\n---\n\n');
    return `The following excerpts were automatically retrieved from the active knowledge base collection and may help answer the user's latest message. Use them if relevant; ignore them if not.\n\n${context}`;
  } catch {
    return null;
  }
}

async function streamAssistantReply(conv) {
  let sysPrompt = document.getElementById('sys-input').value.trim();
  // Inject plan mode instructions if active
  if (planMode) {
    sysPrompt = sysPrompt
      ? sysPrompt + '\n\n' + PLAN_SYSTEM_PROMPT
      : PLAN_SYSTEM_PROMPT;
  }
  const ragContext = await autoInjectRagContext(conv);
  const apiMsgs = [];
  if (sysPrompt)   apiMsgs.push({ role: 'system', content: sysPrompt });
  if (ragContext)  apiMsgs.push({ role: 'system', content: ragContext });
  apiMsgs.push(...conv.messages);

  const useTools  = document.getElementById('tools-toggle').classList.contains('on');
  const temp      = parseFloat(document.getElementById('temp-slider').value);
  const maxTok    = parseInt(document.getElementById('max-tokens').value) || 2048;
  const topP      = parseFloat(document.getElementById('top-p-slider').value);
  const topK      = parseInt(document.getElementById('top-k-slider').value);
  const repeatPen = parseFloat(document.getElementById('repeat-slider').value);
  const freqPen   = parseFloat(document.getElementById('freq-slider').value);
  const stopSeqs  = parseStopSequences(document.getElementById('stop-sequences')?.value);
  const seedVal   = parseSeed(document.getElementById('seed-input')?.value);
  const ctxLenVal = parseContextLength(document.getElementById('ctx-length-input')?.value);

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
    const chatBody = {
      model: selectedModel, messages: apiMsgs,
      temperature: temp, max_tokens: maxTok, use_tools: useTools,
      top_p: topP, top_k: topK, repeat_penalty: repeatPen, frequency_penalty: freqPen,
    };
    if (stopSeqs.length) chatBody.stop = stopSeqs;
    if (seedVal !== undefined) chatBody.seed = seedVal;
    if (ctxLenVal !== undefined) chatBody.ctx_len = ctxLenVal;
    const rf = _buildResponseFormat();
    if (rf) chatBody.response_format = rf;

    const res = await fetch(`${PROXY}/v1/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...apiKeyHeader() },
      body: JSON.stringify(chatBody),
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
            conv.messages.push({ role: 'assistant', content: fullText, ts: Date.now() });
            saveConvs();
            reRenderLastAssistant(conv, fullText);
            notifyGenerationComplete(conv, fullText);
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
        conv.messages.push({ role: 'assistant', content: fullText, stopped: true, ts: Date.now() });
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

function rateMessage(idx, rating) {
  const conv = currentConv();
  if (!conv || !conv.messages[idx]) return;
  const msg = conv.messages[idx];
  msg.reaction = msg.reaction === rating ? null : rating;
  saveConvs();
  const wrap = document.querySelector(`.msg-wrap[data-msg-idx="${idx}"]`);
  if (!wrap) return;
  wrap.querySelector('.reaction-up')?.classList.toggle('active', msg.reaction === 'up');
  wrap.querySelector('.reaction-dn')?.classList.toggle('active', msg.reaction === 'down');
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
    const pdfBlocks = m.content.filter(p =>
      p.type === 'text' && /^📄 Document: .+ \(\d+ pages?\)\n/.test(p.text || '')
    );
    const imgs = m.content.filter(p => p.type === 'image_url');
    m.content = (pdfBlocks.length || imgs.length)
      ? [...pdfBlocks, { type: 'text', text: newText }, ...imgs]
      : newText;
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
        <div class="welcome-logo">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.9)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <h2 class="welcome-title">LLM Hub</h2>
        <p class="welcome-sub">Your local AI workspace — chat privately with models running on your machine. No cloud, no limits.</p>
        <div class="welcome-grid">
          <button class="welcome-card" onclick="useWelcomePrompt('Explain how async/await works in JavaScript with a practical example')">
            <span class="wc-icon">💡</span>
            <span class="wc-label">Explain a concept</span>
            <span class="wc-desc">Break down any topic clearly</span>
          </button>
          <button class="welcome-card" onclick="useWelcomePrompt('Write a Python script that reads a CSV file and generates a summary report with statistics')">
            <span class="wc-icon">🔧</span>
            <span class="wc-label">Write some code</span>
            <span class="wc-desc">Generate clean, working code</span>
          </button>
          <button class="welcome-card" onclick="useWelcomePrompt('Review this code for bugs, security issues, and suggest improvements')">
            <span class="wc-icon">🔍</span>
            <span class="wc-label">Review my code</span>
            <span class="wc-desc">Spot bugs and improvements</span>
          </button>
          <button class="welcome-card" onclick="useWelcomePrompt('Help me brainstorm ideas for a weekend side project using local AI models')">
            <span class="wc-icon">🧠</span>
            <span class="wc-label">Brainstorm ideas</span>
            <span class="wc-desc">Explore possibilities together</span>
          </button>
          <button class="welcome-card" onclick="useWelcomePrompt('Translate the following text to Arabic, preserving tone and nuance:')">
            <span class="wc-icon">🌐</span>
            <span class="wc-label">Translate text</span>
            <span class="wc-desc">Arabic ↔ English and more</span>
          </button>
          <button class="welcome-card" onclick="useWelcomePrompt('Summarize the following into concise bullet points:')">
            <span class="wc-icon">📝</span>
            <span class="wc-label">Summarize</span>
            <span class="wc-desc">Extract key points fast</span>
          </button>
        </div>
      </div>`;
    return;
  }
  msgs.forEach((m, i) => {
    if (m.role === 'user') {
      let text = '';
      const imgs = [];
      const pdfs = [];
      const codeFiles = [];
      if (typeof m.content === 'string') text = m.content;
      else if (Array.isArray(m.content)) {
        for (const p of m.content) {
          if (p.type === 'text') {
            const pdfMatch  = p.text.match(/^📄 Document: (.+) \((\d+) pages?\)\n/);
            const codeMatch = p.text.match(/^💻 File: (.+)\n```(\w+)\n/);
            if (pdfMatch) {
              pdfs.push({ name: pdfMatch[1], pageCount: parseInt(pdfMatch[2]) });
            } else if (codeMatch) {
              codeFiles.push({ name: codeMatch[1], language: codeMatch[2] });
            } else {
              text = p.text;
            }
          } else if (p.type === 'image_url') {
            imgs.push({ dataUrl: p.image_url?.url });
          }
        }
      }
      appendUserBubble(i, text, imgs, pdfs, m.ts || 0, codeFiles);
    } else if (m.role === 'assistant') {
      const w = buildAssistantWrap(i, m.content || '', m.stopped, m.ts || 0);
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

function appendUserBubble(idx, text, imgs = [], pdfs = [], ts = 0, codeFiles = []) {
  const container = document.getElementById('messages');
  const wrap = document.createElement('div');
  wrap.className = 'msg-wrap';
  const pdfsHtml = pdfs.length
    ? `<div class="bubble-docs">${pdfs.map(p =>
        `<div class="bubble-doc"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg><span>${escHtml(p.name)}${p.pageCount ? ` (${p.pageCount}p)` : ''}</span></div>`
      ).join('')}</div>`
    : '';
  const codeFilesHtml = codeFiles.length
    ? `<div class="bubble-docs">${codeFiles.map(f =>
        `<div class="bubble-doc bubble-code"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg><span>${escHtml(f.name)}${f.language ? ` <em class="att-meta">${f.language}</em>` : ''}</span></div>`
      ).join('')}</div>`
    : '';
  const imagesHtml = imgs.length
    ? `<div class="bubble-images">${imgs.map(a =>
        `<img class="bubble-img" src="${escHtml(a.dataUrl)}" onclick="window.open(this.src)"/>`).join('')}</div>`
    : '';
  wrap.innerHTML = `
    <div class="msg user">
      <div class="avatar">👤</div>
      <div class="bubble">
        ${pdfsHtml}
        ${codeFilesHtml}
        ${imagesHtml}
        ${text ? `<div>${renderMarkdown(text)}</div>` : ''}
      </div>
    </div>
    ${idx >= 0 ? `<div class="msg-actions" style="justify-content:flex-end">
      ${formatTs(ts, 'right')}
      <button onclick="branchFromMessage(${idx})" title="Branch conversation from here">⑂ Branch</button>
      <button onclick="openEditMessage(${idx})" title="Edit & regenerate">✏️ Edit</button>
      <button onclick="copyMessage(${idx})" title="Copy">📋 Copy</button>
      <button class="danger" onclick="deleteMessage(${idx})" title="Delete">🗑 Delete</button>
    </div>` : ''}`;
  container.appendChild(wrap);
  applyCollapse(wrap);
}

function buildAssistantWrap(idx, content, stopped = false, ts = 0) {
  const wrap = document.createElement('div');
  wrap.className = 'msg-wrap';
  if (idx >= 0) wrap.dataset.msgIdx = idx;
  const name = parseModelId(selectedModel).name || '';

  const conv = currentConv();
  const reaction = idx >= 0 ? (conv?.messages[idx]?.reaction || null) : null;

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
      <button class="reaction-btn reaction-up${reaction === 'up' ? ' active' : ''}" onclick="rateMessage(${idx},'up')" title="Good response">👍</button>
      <button class="reaction-btn reaction-dn${reaction === 'down' ? ' active' : ''}" onclick="rateMessage(${idx},'down')" title="Bad response">👎</button>
      <button onclick="regenerateMessage(${idx})" title="Regenerate (⌘R)">🔄 Regenerate</button>
      <button onclick="continueMessage(${idx})" title="Continue">▶ Continue</button>
      <button onclick="copyMessage(${idx})" title="Copy">📋 Copy</button>
      <button id="tts-btn-${idx}" onclick="speakMessage(${idx})" title="Read aloud">🔊 Read</button>
      <button class="danger" onclick="deleteMessage(${idx})" title="Delete">🗑 Delete</button>
      ${formatTs(ts, 'left')}
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
      sessionCostTotal += cost;
      updateSessionCostDisplay();
    } else {
      costWrap.style.display = 'none';
    }
  }
}

function updateSessionCostDisplay() {
  const wrap = document.getElementById('stat-session-cost-wrap');
  const el   = document.getElementById('stat-session-cost');
  if (!wrap || !el) return;
  wrap.style.display = '';
  el.textContent = sessionCostTotal < 0.0001 ? '<$0.0001' : `$${sessionCostTotal.toFixed(4)}`;
}

function resetSessionCost() {
  sessionCostTotal = 0;
  const wrap = document.getElementById('stat-session-cost-wrap');
  if (wrap) wrap.style.display = 'none';
  showToast('Session cost reset', 'success');
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
    const originalCode = pre.querySelector('code')?.innerText || '';
    if (!originalCode.trim()) return;

    const wrap = document.createElement('div');
    wrap.className = 'artifact-wrap';

    // ── Tab bar ──────────────────────────────────────────────────────────────
    const tabs = document.createElement('div');
    tabs.className = 'artifact-tabs';
    tabs.innerHTML = `
      <button class="artifact-tab active" data-tab="preview">🖼 Preview</button>
      <button class="artifact-tab" data-tab="code">✏️ Edit</button>`;
    wrap.appendChild(tabs);

    // ── Preview pane ──────────────────────────────────────────────────────────
    const previewPane = document.createElement('div');
    previewPane.className = 'artifact-pane active';
    let currentPreviewEl = buildPreviewEl(lang, originalCode);
    previewPane.appendChild(currentPreviewEl);

    // ── Code / editor pane ────────────────────────────────────────────────────
    const codePane = document.createElement('div');
    codePane.className = 'artifact-pane artifact-editor-pane';

    const editorToolbar = document.createElement('div');
    editorToolbar.className = 'artifact-editor-toolbar';
    editorToolbar.innerHTML = `
      <span class="artifact-lang-badge">${lang.toUpperCase()}</span>
      <button class="artifact-editor-btn artifact-run-btn" title="Run (Ctrl+Enter)">▶ Run</button>
      <button class="artifact-editor-btn artifact-reset-btn" title="Reset to original">↺ Reset</button>
      <button class="artifact-editor-btn artifact-copy-btn" title="Copy code">⎘ Copy</button>`;

    const textarea = document.createElement('textarea');
    textarea.className = 'artifact-editor-textarea';
    textarea.value = originalCode;
    textarea.spellcheck = false;
    textarea.setAttribute('autocomplete', 'off');
    textarea.setAttribute('autocorrect', 'off');
    textarea.setAttribute('autocapitalize', 'off');

    codePane.appendChild(editorToolbar);
    codePane.appendChild(textarea);

    wrap.appendChild(previewPane);
    wrap.appendChild(codePane);

    // ── Re-render helper ──────────────────────────────────────────────────────
    function rerender() {
      const newEl = buildPreviewEl(lang, textarea.value);
      previewPane.replaceChild(newEl, currentPreviewEl);
      currentPreviewEl = newEl;
    }

    // ── Tab switching — auto-run when going to Preview ────────────────────────
    tabs.querySelectorAll('.artifact-tab').forEach(btn => {
      btn.onclick = () => {
        tabs.querySelectorAll('.artifact-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const showPreview = btn.dataset.tab === 'preview';
        previewPane.classList.toggle('active', showPreview);
        codePane.classList.toggle('active', !showPreview);
        if (showPreview) rerender();
      };
    });

    // ── Toolbar actions ───────────────────────────────────────────────────────
    editorToolbar.querySelector('.artifact-run-btn').onclick = () => {
      rerender();
      tabs.querySelectorAll('.artifact-tab').forEach(b => b.classList.remove('active'));
      tabs.querySelector('[data-tab="preview"]').classList.add('active');
      previewPane.classList.add('active');
      codePane.classList.remove('active');
    };

    editorToolbar.querySelector('.artifact-reset-btn').onclick = () => {
      textarea.value = originalCode;
    };

    editorToolbar.querySelector('.artifact-copy-btn').onclick = (e) => {
      navigator.clipboard.writeText(textarea.value).then(() => {
        const btn = e.currentTarget;
        btn.textContent = '✓ Copied';
        setTimeout(() => { btn.textContent = '⎘ Copy'; }, 1500);
      });
    };

    // ── Ctrl+Enter shortcut to run ────────────────────────────────────────────
    textarea.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        editorToolbar.querySelector('.artifact-run-btn').click();
      }
      // Tab key inserts 2 spaces instead of losing focus
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        textarea.value = textarea.value.slice(0, start) + '  ' + textarea.value.slice(end);
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      }
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
// § IN-CONVERSATION SEARCH (⌘F)
// ─────────────────────────────────────────────────────────────────────────────

function openConvSearch() {
  const bar = document.getElementById('conv-search-bar');
  bar.style.display = 'flex';
  const inp = document.getElementById('conv-search-input');
  inp.value = '';
  document.getElementById('conv-search-count').textContent = '';
  clearConvSearchHighlights();
  setTimeout(() => inp.focus(), 30);
}

function closeConvSearch() {
  const bar = document.getElementById('conv-search-bar');
  if (!bar) return;
  bar.style.display = 'none';
  clearConvSearchHighlights();
}

function clearConvSearchHighlights() {
  document.querySelectorAll('.bubble.conv-search-match, .bubble.conv-search-current').forEach(el => {
    el.classList.remove('conv-search-match', 'conv-search-current');
  });
  convSearchMatches = [];
  convSearchIdx     = 0;
}

function onConvSearchInput() {
  clearConvSearchHighlights();
  const q       = document.getElementById('conv-search-input').value.trim().toLowerCase();
  const countEl = document.getElementById('conv-search-count');
  if (!q) { countEl.textContent = ''; return; }

  document.querySelectorAll('#messages .bubble').forEach(el => {
    if (el.textContent.toLowerCase().includes(q)) {
      el.classList.add('conv-search-match');
      convSearchMatches.push(el);
    }
  });

  if (!convSearchMatches.length) { countEl.textContent = 'No matches'; return; }

  convSearchIdx = 0;
  convSearchMatches[0].classList.add('conv-search-current');
  convSearchMatches[0].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  countEl.textContent = `1 / ${convSearchMatches.length}`;
}

function nextConvMatch() {
  if (!convSearchMatches.length) return;
  convSearchMatches[convSearchIdx].classList.remove('conv-search-current');
  convSearchIdx = (convSearchIdx + 1) % convSearchMatches.length;
  convSearchMatches[convSearchIdx].classList.add('conv-search-current');
  convSearchMatches[convSearchIdx].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  document.getElementById('conv-search-count').textContent = `${convSearchIdx + 1} / ${convSearchMatches.length}`;
}

function prevConvMatch() {
  if (!convSearchMatches.length) return;
  convSearchMatches[convSearchIdx].classList.remove('conv-search-current');
  convSearchIdx = (convSearchIdx - 1 + convSearchMatches.length) % convSearchMatches.length;
  convSearchMatches[convSearchIdx].classList.add('conv-search-current');
  convSearchMatches[convSearchIdx].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  document.getElementById('conv-search-count').textContent = `${convSearchIdx + 1} / ${convSearchMatches.length}`;
}

function onConvSearchKeydown(e) {
  if (e.key === 'Escape') { closeConvSearch(); e.preventDefault(); return; }
  if (e.key === 'Enter')  { e.shiftKey ? prevConvMatch() : nextConvMatch(); e.preventDefault(); }
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
  ['openai', 'anthropic', 'groq', 'openrouter', 'mistral', 'together', 'fireworks', 'cohere'].forEach(p => {
    const el = document.getElementById(`key-${p}`);
    if (el) el.value = keys[p] || '';
  });
  document.getElementById('apikey-status').textContent = '';
  renderCustomProvidersList();
  openModal('config-modal');
}

function switchSettingsTab(tab) {
  ['general', 'config', 'apikeys', 'appearance', 'backup', 'voice', 'tools', 'rag'].forEach(t => {
    document.getElementById(`settings-panel-${t}`).style.display = t === tab ? '' : 'none';
    document.getElementById(`settings-footer-${t}`).style.display = t === tab ? '' : 'none';
    const btn = document.getElementById(`tab-${t}`);
    if (btn) btn.classList.toggle('active', t === tab);
  });
  if (tab === 'backup')     renderBackupSummary();
  if (tab === 'appearance') _syncAppearanceUI();
  if (tab === 'apikeys')    renderCustomProvidersList();
  if (tab === 'voice')      initTtsVoiceSelect();
  if (tab === 'tools')      loadToolsSettings();
  if (tab === 'rag')        loadRagSettings();
  if (tab === 'general')    loadGeneralSettings();
}

function openGeneralSettings() {
  switchSettingsTab('general');
  openModal('config-modal');
}

function loadGeneralSettings() {
  const el = id => document.getElementById(id);
  if (el('general-proxy-url')) el('general-proxy-url').value = localStorage.getItem('general_proxy_url') || '';
  if (el('general-current-proxy')) el('general-current-proxy').textContent = PROXY;
  if (el('general-auto-connect')) el('general-auto-connect').checked = localStorage.getItem('general_auto_connect') !== '0';
  if (el('general-desktop-notif')) {
    el('general-desktop-notif').checked = localStorage.getItem('general_desktop_notif') === '1';
    // Reflect browser permission state
    const perm = ('Notification' in window) ? Notification.permission : 'unsupported';
    const hint = el('general-notif-hint');
    if (hint) hint.textContent = perm === 'denied' ? '⚠ Blocked in browser — allow in site settings.' : perm === 'default' ? 'Click "Request" to enable.' : '';
  }
  try {
    let total = 0;
    for (const k of Object.keys(localStorage)) total += (localStorage.getItem(k) || '').length;
    if (el('general-storage-used')) el('general-storage-used').textContent = `${(total / 1024).toFixed(1)} KB`;
  } catch { /* quota api not available */ }
}

function normalizeProxyUrl(raw) {
  const parsed = new URL(raw.trim());
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Proxy URL must use http or https');
  return parsed.href.replace(/\/+$/, '');
}

function saveGeneralSettings() {
  const rawProxyUrl = document.getElementById('general-proxy-url')?.value?.trim();
  let proxyUrl = '';
  if (rawProxyUrl) {
    try {
      proxyUrl = normalizeProxyUrl(rawProxyUrl);
      localStorage.setItem('general_proxy_url', proxyUrl);
    } catch (e) {
      toast(e.message, 'warn');
      return;
    }
  } else {
    localStorage.removeItem('general_proxy_url');
  }
  const autoConnect = !!document.getElementById('general-auto-connect')?.checked;
  localStorage.setItem('general_auto_connect', autoConnect ? '1' : '0');
  const desktopNotif = !!document.getElementById('general-desktop-notif')?.checked;
  localStorage.setItem('general_desktop_notif', desktopNotif ? '1' : '0');
  if (desktopNotif && 'Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
  closeModal('config-modal');
  if (proxyUrl && proxyUrl !== PROXY) {
    toast('Proxy URL saved — reload the page to connect to the new address.', 'info');
  } else {
    toast('General settings saved.', 'success');
  }
}

async function testGeneralProxyUrl() {
  const rawUrl = (document.getElementById('general-proxy-url')?.value?.trim()) || PROXY;
  try {
    const url = normalizeProxyUrl(rawUrl);
    const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) toast(`Connected to proxy at ${url}`, 'success');
    else         toast(`Proxy replied with HTTP ${res.status}`, 'warn');
  } catch (e) {
    toast(`Cannot reach ${rawUrl}: ${e.message}`, 'error');
  }
}

function confirmClearAllData() {
  if (!confirm('Clear ALL data including conversations, settings, and API keys? This cannot be undone.')) return;
  localStorage.clear();
  toast('All data cleared — reloading…', 'info');
  setTimeout(() => location.reload(), 1500);
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

// ── Import Conversations ────────────────────────────────────────────────────

function onConvImportDrop(e) {
  e.preventDefault();
  const file = e.dataTransfer?.files?.[0];
  if (file) applyConversationImport(file);
}

// No-arg: triggers hidden file picker (sidebar button). With-arg: processes file input.
function importConversations(input) {
  if (!input) { document.getElementById('import-convs-input').click(); return; }
  const file = input.files?.[0];
  input.value = '';
  if (file) applyConversationImport(file);
}

function applyConvImportFile(input) {
  const file = input.files?.[0];
  input.value = '';
  if (file) applyConversationImport(file);
}

function applyConversationImport(file) {
  const statusEl = document.getElementById('conv-import-status');
  const reader   = new FileReader();
  reader.onload  = (evt) => {
    try {
      const raw = JSON.parse(evt.target.result);
      let incoming = [];

      if (raw?.app === 'llm-hub' && Array.isArray(raw?.data?.conversations)) {
        incoming = raw.data.conversations;
      } else if (raw?.id && Array.isArray(raw?.messages)) {
        incoming = [raw];
      } else if (Array.isArray(raw) && raw.length && raw[0]?.mapping) {
        incoming = raw.map(convertChatGPTConv).filter(Boolean);
      } else if (Array.isArray(raw) && raw.length && raw[0]?.messages) {
        incoming = raw;
      } else {
        throw new Error('Unrecognized format. Expected LLM Hub backup/export or ChatGPT conversations.json.');
      }

      const existingIds = new Set(conversations.map(c => c.id));
      const toAdd = incoming.filter(c => c.id && Array.isArray(c.messages) && !existingIds.has(c.id));

      if (toAdd.length === 0) {
        if (statusEl) { statusEl.textContent = '✓ No new conversations found (all already imported).'; statusEl.style.color = 'var(--muted)'; }
        toast('No new conversations to import.', 'info');
        return;
      }

      conversations.push(...toAdd);
      conversations.sort((a, b) => (b.ts || 0) - (a.ts || 0));
      try {
        saveConvs();
      } catch (err) {
        conversations.splice(conversations.length - toAdd.length, toAdd.length);
        toast('Import failed: local storage is full.', 'error');
        return;
      }
      renderConvList();
      const msg = `✓ Imported ${toAdd.length} conversation${toAdd.length !== 1 ? 's' : ''}.`;
      if (statusEl) { statusEl.textContent = msg; statusEl.style.color = 'var(--green)'; }
      toast(`Imported ${toAdd.length} conversation${toAdd.length !== 1 ? 's' : ''}!`, 'success');
    } catch (err) {
      if (statusEl) { statusEl.textContent = '✗ ' + err.message; statusEl.style.color = 'var(--red)'; }
      toast('Import failed: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}

// Iterative walk — safe against circular references in ChatGPT exports
function convertChatGPTConv(chatGptConv) {
  if (!chatGptConv?.mapping) return null;
  const nodes = Object.values(chatGptConv.mapping);
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));
  let cur = nodes.find(n => !n.parent || !nodeMap[n.parent]);
  const messages = [];
  const visited = new Set();
  while (cur && !visited.has(cur.id)) {
    visited.add(cur.id);
    const msg = cur.message;
    if (msg?.content?.parts && (msg.author?.role === 'user' || msg.author?.role === 'assistant')) {
      const text = msg.content.parts.filter(p => typeof p === 'string').join('\n').trim();
      if (text) messages.push({ role: msg.author.role, content: text });
    }
    const childId = cur.children?.[0];
    cur = childId ? nodeMap[childId] : null;
  }
  if (!messages.length) return null;
  return {
    id: `chatgpt-${chatGptConv.id || Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: chatGptConv.title || 'Imported from ChatGPT',
    messages,
    ts: chatGptConv.create_time ? chatGptConv.create_time * 1000 : Date.now(),
    pinned: false,
    sysPrompt: '',
    folderId: null,
    label: null,
  };
}

function toggleKeyVisibility(inputId, btn) {
  const el = document.getElementById(inputId);
  if (!el) return;
  el.type = el.type === 'password' ? 'text' : 'password';
  if (btn) btn.textContent = el.type === 'password' ? 'Show' : 'Hide';
}

async function saveApiKeys() {
  const keys = {};
  ['openai', 'anthropic', 'groq', 'openrouter', 'mistral', 'together', 'fireworks', 'cohere'].forEach(p => {
    const v = (document.getElementById(`key-${p}`)?.value || '').trim();
    if (v) keys[p] = v;
  });
  localStorage.setItem('llm-api-keys', JSON.stringify(keys));
  const count = Object.keys(keys).length;
  const cpCount = getCustomProviders().length;
  document.getElementById('apikey-status').textContent =
    (count || cpCount) ? `Saved ${count} key(s), ${cpCount} custom server(s). Refreshing models…` : 'All keys cleared.';
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
  ['openai', 'anthropic', 'groq', 'openrouter', 'mistral', 'together', 'fireworks', 'cohere'].forEach(p => {
    const el = document.getElementById(`key-${p}`);
    if (el) el.value = '';
    const st = document.getElementById(`test-status-${p}`);
    if (st) { st.textContent = ''; st.className = 'provider-test-status'; }
  });
  document.getElementById('apikey-status').textContent = 'All keys cleared.';
}

async function testProvider(provider) {
  const statusEl = document.getElementById(`test-status-${provider}`);
  const btnEl    = document.getElementById(`test-${provider}`);
  if (!statusEl || !btnEl) return;

  const key = (document.getElementById(`key-${provider}`)?.value || '').trim();
  if (!key) {
    statusEl.textContent = 'no key';
    statusEl.className   = 'provider-test-status offline';
    return;
  }

  btnEl.disabled       = true;
  statusEl.textContent = 'testing…';
  statusEl.className   = 'provider-test-status checking';

  try {
    const tempKeys = { ...getStoredApiKeys(), [provider]: key };
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    let res;
    try {
      res = await fetch(`${PROXY}/health`, {
        headers: { 'X-Api-Keys': JSON.stringify(tempKeys) },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
    const data = await res.json();
    const status = data.providers?.[provider];
    if (status === 'online') {
      statusEl.textContent = '✓ online';
      statusEl.className   = 'provider-test-status online';
    } else {
      statusEl.textContent = '✗ offline';
      statusEl.className   = 'provider-test-status offline';
    }
  } catch {
    statusEl.textContent = '✗ unreachable';
    statusEl.className   = 'provider-test-status offline';
  } finally {
    btnEl.disabled = false;
  }
}

function renderCustomProvidersList() {
  const container = document.getElementById('custom-providers-list');
  if (!container) return;
  const providers = getCustomProviders();
  if (!providers.length) {
    container.innerHTML = '<div class="cp-empty">No custom servers added yet.</div>';
    return;
  }
  container.innerHTML = providers.map(cp => `
    <div class="cp-row">
      <div class="cp-info">
        <span class="cp-name">${escHtml(cp.name)}</span>
        <span class="cp-url">${escHtml(cp.url)}</span>
        ${cp.key ? '<span class="cp-badge key-set">key set</span>' : '<span class="cp-badge no-key">no key</span>'}
      </div>
      <button class="btn btn-sm" onclick="deleteCustomProvider('${escHtml(cp.id)}')">Remove</button>
    </div>`).join('');
}

function addCustomProvider() {
  const nameEl = document.getElementById('cp-name-input');
  const urlEl  = document.getElementById('cp-url-input');
  const keyEl  = document.getElementById('cp-key-input');
  const name = (nameEl?.value || '').trim();
  const url  = (urlEl?.value  || '').trim();
  const key  = (keyEl?.value  || '').trim();
  if (!name || !url) { toast('Name and URL are required', 'error'); return; }
  try { new URL(url); } catch { toast('Invalid URL — use http:// or https://', 'error'); return; }
  const providers = getCustomProviders();
  const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
    ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
    : Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  providers.push({ id, name, url, key });
  saveCustomProviders(providers);
  if (nameEl) nameEl.value = '';
  if (urlEl)  urlEl.value  = '';
  if (keyEl)  keyEl.value  = '';
  renderCustomProvidersList();
  toast(`Added "${name}" — save keys to load its models`, 'success');
}

function deleteCustomProvider(id) {
  saveCustomProviders(getCustomProviders().filter(cp => cp.id !== id));
  renderCustomProvidersList();
  toast('Custom server removed', 'success');
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
// § TOOLS SETTINGS TAB
// ─────────────────────────────────────────────────────────────────────────────

const BUILTIN_TOOL_META = {
  datetime:       { label: 'Datetime',       desc: 'Get current date and time' },
  calculator:     { label: 'Calculator',     desc: 'Evaluate mathematical expressions safely' },
  web_search:     { label: 'Web Search',     desc: 'Search the web via DuckDuckGo (no API key required)' },
  fetch_url:      { label: 'Fetch URL',      desc: 'Fetch and read any web page or REST endpoint' },
  run_javascript: { label: 'Run JavaScript', desc: 'Execute JS in a sandboxed Node.js vm (dev use only — not a true sandbox)' },
  rag_search:     { label: 'RAG Search',     desc: 'Search your local knowledge base collections' },
};

async function loadToolsSettings() {
  const statusEl = document.getElementById('tools-panel-status');
  try {
    const res   = await fetch(`${PROXY}/v1/config`);
    const cfg   = await res.json();
    const tools = cfg.tools || {};
    const masterOn  = tools.enabled !== false;
    const builtIn   = new Set(tools.built_in || Object.keys(BUILTIN_TOOL_META));

    const masterToggle = document.getElementById('tools-master-toggle');
    if (masterToggle) masterToggle.classList.toggle('on', masterOn);

    const container = document.getElementById('settings-builtin-tools');
    if (!container) return;
    container.innerHTML = Object.entries(BUILTIN_TOOL_META).map(([key, meta]) => `
      <label class="tool-toggle" style="padding:8px 0;border-bottom:1px solid var(--border);margin-bottom:0">
        <div class="toggle ${builtIn.has(key) ? 'on' : ''}" id="tool-toggle-${key}"
             onclick="this.classList.toggle('on')"></div>
        <span>
          <strong style="font-size:12px">${meta.label}</strong>
          <span style="color:var(--muted);font-size:11px;display:block">${meta.desc}</span>
        </span>
      </label>`).join('');
    if (statusEl) statusEl.textContent = '';
  } catch (e) {
    if (statusEl) statusEl.textContent = 'Failed to load config: ' + e.message;
  }
}

async function saveToolsSettings() {
  const statusEl = document.getElementById('tools-panel-status');
  try {
    const res = await fetch(`${PROXY}/v1/config`);
    const cfg = await res.json();

    cfg.tools = cfg.tools || {};
    cfg.tools.enabled  = document.getElementById('tools-master-toggle')?.classList.contains('on') ?? true;
    cfg.tools.built_in = Object.keys(BUILTIN_TOOL_META)
      .filter(k => document.getElementById(`tool-toggle-${k}`)?.classList.contains('on'));

    const saveRes = await fetch(`${PROXY}/v1/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg),
    });
    const data = await saveRes.json();
    if (!saveRes.ok) throw new Error(data.error || 'save failed');
    toast('Tools settings saved', 'success');
    closeModal('config-modal');
    await loadTools();
  } catch (e) {
    if (statusEl) { statusEl.textContent = e.message; statusEl.style.color = 'var(--red)'; }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § RAG SETTINGS TAB
// ─────────────────────────────────────────────────────────────────────────────

async function loadRagSettings() {
  const statusEl = document.getElementById('rag-panel-status');
  try {
    const res = await fetch(`${PROXY}/v1/config`);
    const cfg = await res.json();
    const rag = cfg.rag || {};

    const toggle = document.getElementById('rag-enabled-toggle');
    if (toggle) toggle.classList.toggle('on', rag.enabled !== false);

    const autoInjectToggle = document.getElementById('rag-auto-inject-toggle');
    if (autoInjectToggle) autoInjectToggle.classList.toggle('on', rag.auto_inject === true);

    const setVal = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
    setVal('rag-embed-provider', rag.embedding_provider || 'ollama');
    setVal('rag-embed-model',    rag.embedding_model    || 'nomic-embed-text');
    setVal('rag-chunk-size',     rag.chunk_size         ?? 800);
    setVal('rag-chunk-overlap',  rag.chunk_overlap      ?? 100);
    setVal('rag-top-k',          rag.top_k              ?? 5);
    if (statusEl) statusEl.textContent = '';
  } catch (e) {
    if (statusEl) statusEl.textContent = 'Failed to load config: ' + e.message;
  }
}

async function saveRagSettings() {
  const statusEl = document.getElementById('rag-panel-status');
  try {
    const res = await fetch(`${PROXY}/v1/config`);
    const cfg = await res.json();

    cfg.rag = {
      ...cfg.rag,
      enabled:            document.getElementById('rag-enabled-toggle')?.classList.contains('on') ?? true,
      auto_inject:        document.getElementById('rag-auto-inject-toggle')?.classList.contains('on') ?? false,
      embedding_provider: document.getElementById('rag-embed-provider')?.value  || 'ollama',
      embedding_model:    document.getElementById('rag-embed-model')?.value     || 'nomic-embed-text',
      chunk_size:         parseInt(document.getElementById('rag-chunk-size')?.value    || '800',  10),
      chunk_overlap:      parseInt(document.getElementById('rag-chunk-overlap')?.value || '100', 10),
      top_k:              parseInt(document.getElementById('rag-top-k')?.value         || '5',   10),
    };

    const saveRes = await fetch(`${PROXY}/v1/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg),
    });
    const data = await saveRes.json();
    if (!saveRes.ok) throw new Error(data.error || 'save failed');
    toast('RAG settings saved', 'success');
    closeModal('config-modal');
  } catch (e) {
    if (statusEl) { statusEl.textContent = e.message; statusEl.style.color = 'var(--red)'; }
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
    updateRagActiveBadge();
  } catch {
    availableRagCollections = [];
    renderRagList();
    updateRagActiveBadge();
  }
}

function renderRagList() {
  const el = document.getElementById('rag-list');
  const conv = currentConv();
  if (!availableRagCollections.length) {
    el.innerHTML = '<div style="color:var(--muted);font-size:11px;font-family:var(--mono);margin-bottom:6px">No collections yet</div>';
  } else {
    el.innerHTML = availableRagCollections.map(c => `
      <div class="rag-item${conv?.ragCollectionId === c.id ? ' active' : ''}" title="${escHtml(c.name)} — click to ${conv?.ragCollectionId === c.id ? 'deactivate' : 'auto-inject into this chat'}" onclick="setActiveRagCollection('${c.id}')">
        📚 <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escHtml(c.name)}</span>
        <span class="rag-meta">${c.chunks ?? c.chunkCount ?? 0} ch</span>
        <button class="icon-btn" onclick="event.stopPropagation();deleteRag('${c.id}')" title="Delete" style="margin-left:4px">×</button>
      </div>`).join('');
  }
}

// Marks a knowledge collection as "active" for the current conversation. When RAG
// auto-inject is enabled (Settings → RAG), the top matching chunks for the active
// collection are silently added as context to every message sent in this chat.
function setActiveRagCollection(id) {
  const conv = currentConv();
  if (!conv) return;
  conv.ragCollectionId = conv.ragCollectionId === id ? null : id;
  saveConvs();
  renderRagList();
  updateRagActiveBadge();
}

function updateRagActiveBadge() {
  const badge = document.getElementById('rag-active-badge');
  if (!badge) return;
  const conv = currentConv();
  const col  = conv?.ragCollectionId ? availableRagCollections.find(c => c.id === conv.ragCollectionId) : null;
  if (col) {
    document.getElementById('rag-active-badge-name').textContent = col.name;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

async function deleteRag(id) {
  if (!confirm('Delete this knowledge collection?')) return;
  await fetch(`${PROXY}/v1/rag/collections/${id}`, { method: 'DELETE' });
  await loadRagCollections();
  const conv = currentConv();
  if (conv?.ragCollectionId === id) { conv.ragCollectionId = null; saveConvs(); }
  updateRagActiveBadge();
  toast('Collection deleted', 'success');
}

let pendingRagFiles = [];
function openRagUpload() {
  pendingRagFiles = [];
  document.getElementById('rag-file-list').innerHTML = '';
  document.getElementById('rag-progress').style.display = 'none';
  document.getElementById('rag-status').textContent = '';
  document.getElementById('rag-new-name').value = '';
  document.getElementById('rag-url-input').value = '';
  switchRagTab('files');

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

function switchRagTab(tab) {
  const isFiles = tab === 'files';
  document.getElementById('rag-panel-files').style.display = isFiles ? '' : 'none';
  document.getElementById('rag-panel-url').style.display  = isFiles ? 'none' : '';
  document.getElementById('rag-upload-btn').style.display = isFiles ? '' : 'none';
  document.getElementById('rag-tab-files').classList.toggle('active', isFiles);
  document.getElementById('rag-tab-url').classList.toggle('active', !isFiles);
  document.getElementById('rag-progress').style.display = 'none';
  document.getElementById('rag-status').textContent = '';
}

async function crawlRagUrl() {
  const urlVal = document.getElementById('rag-url-input').value.trim();
  if (!urlVal) return toast('Enter a URL first', 'error');

  const sel     = document.getElementById('rag-collection-select');
  const colId   = sel.value === '__new__' ? null : sel.value;
  const newName = document.getElementById('rag-new-name').value.trim();
  if (!colId && !newName) return toast('Name the new collection', 'error');

  const btn = document.getElementById('rag-crawl-btn');
  btn.disabled = true;
  document.getElementById('rag-progress').style.display = 'block';
  document.getElementById('rag-progress-fill').style.width = '0%';
  document.getElementById('rag-status').textContent = 'Sending request…';

  try {
    const body = { url: urlVal, ...(colId ? { collection_id: colId } : { collection_name: newName }) };
    const res = await fetch(`${PROXY}/v1/rag/crawl`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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
        const line = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        if (!line.startsWith('data: ')) continue;
        let evt; try { evt = JSON.parse(line.slice(6)); } catch { continue; }
        if (evt.type === 'status') {
          document.getElementById('rag-status').textContent = evt.message;
        } else if (evt.type === 'progress') {
          const pct = Math.round((evt.done / evt.total) * 100);
          document.getElementById('rag-progress-fill').style.width = pct + '%';
        } else if (evt.type === 'done') {
          document.getElementById('rag-status').textContent = '✓ Crawled and embedded';
          await loadRagCollections();
          setTimeout(() => closeModal('rag-modal'), 700);
          toast('Page crawled and embedded', 'success');
        } else if (evt.type === 'error') {
          throw new Error(evt.message);
        }
      }
    }
  } catch (e) {
    document.getElementById('rag-status').textContent = '❌ ' + e.message;
    toast('Crawl failed: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
  }
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

function convMessagesMarkdown(conv) {
  let md = '';
  for (const m of conv.messages) {
    const role = m.role === 'user' ? '👤 You' : m.role === 'assistant' ? '🤖 Assistant' : m.role;
    const txt = typeof m.content === 'string' ? m.content
              : Array.isArray(m.content) ? m.content.filter(p => p.type === 'text').map(p => p.text).join('\n') +
                  (m.content.some(p => p.type === 'image_url') ? '\n\n_[images attached]_' : '')
              : JSON.stringify(m.content);
    md += `### ${role}\n\n${txt}\n\n`;
  }
  return md;
}

function yamlFrontmatterString(value) {
  return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function exportConv(format) {
  const conv = currentConv();
  if (!conv) return;
  let blob, ext;
  if (format === 'obsidian') {
    const frontmatter = [
      '---',
      `title: ${yamlFrontmatterString(conv.title)}`,
      `created: ${new Date(conv.ts).toISOString()}`,
      `tags: [llm-hub, ai-chat]`,
      '---',
      '',
    ].join('\n');
    const md = `${frontmatter}\n# ${conv.title}\n\n---\n\n${convMessagesMarkdown(conv)}`;
    blob = new Blob([md], { type: 'text/markdown' });
    ext  = 'md';
  } else if (format === 'md') {
    const md = `# ${conv.title}\n\n_${new Date(conv.ts).toISOString()}_\n\n---\n\n${convMessagesMarkdown(conv)}`;
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
  } else {
    clearCompare();
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
  const da = document.getElementById('compare-wins-a');
  const db = document.getElementById('compare-wins-b');
  const sc = document.getElementById('compare-score');
  if (da) da.textContent = '';
  if (db) db.textContent = '';
  if (sc) sc.textContent = '';
  // Reset A/B reveal state on clear
  compareAbActualA = compareAbActualB = null;
  const revealBtn = document.getElementById('compare-reveal-btn');
  if (revealBtn) revealBtn.disabled = true;
  // Reset AB label text to generic names
  const labA = document.getElementById('compare-ab-label-a');
  const labB = document.getElementById('compare-ab-label-b');
  if (labA) labA.textContent = 'Model A';
  if (labB) labB.textContent = 'Model B';
  updateCompareEmptyState();
  updateCompareDiffBtn();
  closeCompareDiff();
}

function toggleAbMode() {
  compareAbMode = !compareAbMode;
  document.getElementById('compare-ab-btn').classList.toggle('active', compareAbMode);
  const revealBtn = document.getElementById('compare-reveal-btn');
  revealBtn.style.display = compareAbMode ? '' : 'none';
  revealBtn.disabled = true;
  // In AB mode: hide the model selects inside pane headers, show static labels instead
  document.getElementById('compare-model-a').style.display = compareAbMode ? 'none' : '';
  document.getElementById('compare-model-b').style.display = compareAbMode ? 'none' : '';
  const labA = document.getElementById('compare-ab-label-a');
  const labB = document.getElementById('compare-ab-label-b');
  if (labA) { labA.textContent = 'Model A'; labA.style.display = compareAbMode ? '' : 'none'; }
  if (labB) { labB.textContent = 'Model B'; labB.style.display = compareAbMode ? '' : 'none'; }
  if (!compareAbMode) { compareAbActualA = compareAbActualB = null; }
}

function revealAbModels() {
  if (!compareAbActualA && !compareAbActualB) return;
  const fmt = m => (m || 'Model A/B').replace(/^(ollama|lmstudio)\//, '');
  const nameA = fmt(compareAbActualA);
  const nameB = fmt(compareAbActualB);
  // Update pane A/B header labels
  const labA = document.getElementById('compare-ab-label-a');
  const labB = document.getElementById('compare-ab-label-b');
  if (labA) labA.textContent = nameA;
  if (labB) labB.textContent = nameB;
  // Update model name spans in all assistant msg-meta bubbles
  document.getElementById('compare-msgs-a').querySelectorAll('.msg-wrap[data-role="assistant"] .msg-meta').forEach(m => {
    const s = m.querySelector('span:first-child');
    if (s && (s.textContent === 'Model A' || s.textContent.startsWith('?'))) s.textContent = nameA;
  });
  document.getElementById('compare-msgs-b').querySelectorAll('.msg-wrap[data-role="assistant"] .msg-meta').forEach(m => {
    const s = m.querySelector('span:first-child');
    if (s && (s.textContent === 'Model B' || s.textContent.startsWith('?'))) s.textContent = nameB;
  });
  document.getElementById('compare-reveal-btn').disabled = true;
  toast(`🔍 Revealed — Left: ${nameA} · Right: ${nameB}`, 'success');
}

function gradeCompareMsg(wrap, grade) {
  const current = wrap.dataset.cmpGrade;
  const newGrade = current === grade ? null : grade;
  wrap.dataset.cmpGrade = newGrade || '';
  wrap.querySelector('.cmp-grade-up')?.classList.toggle('active', newGrade === 'up');
  wrap.querySelector('.cmp-grade-dn')?.classList.toggle('active', newGrade === 'down');
  updateCompareWinDisplay();
}

function updateCompareWinDisplay() {
  const paneA = document.getElementById('compare-msgs-a');
  const paneB = document.getElementById('compare-msgs-b');
  const winsA = paneA ? paneA.querySelectorAll('[data-cmp-grade="up"]').length : 0;
  const winsB = paneB ? paneB.querySelectorAll('[data-cmp-grade="up"]').length : 0;
  const dispA = document.getElementById('compare-wins-a');
  const dispB = document.getElementById('compare-wins-b');
  const score = document.getElementById('compare-score');
  if (dispA) dispA.textContent = winsA > 0 ? `${winsA} 👍` : '';
  if (dispB) dispB.textContent = winsB > 0 ? `${winsB} 👍` : '';
  if (score) {
    const total = winsA + winsB;
    score.textContent = total > 0 ? `A: ${winsA}  B: ${winsB}` : '';
  }
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
    u.dataset.role = 'user';
    u.dataset.rawText = text;
    u.innerHTML = `<div class="msg user"><div class="avatar">👤</div><div class="bubble">${renderMarkdown(text)}</div></div>`;
    pane.appendChild(u);
  }

  // A/B mode: randomly assign which actual model goes to each pane
  let modelForPaneA = compareModelA;
  let modelForPaneB = compareModelB;
  if (compareAbMode && Math.random() < 0.5) [modelForPaneA, modelForPaneB] = [modelForPaneB, modelForPaneA];
  if (compareAbMode) { compareAbActualA = modelForPaneA; compareAbActualB = modelForPaneB; }

  setCompareLoadingState(true);
  compareActiveCount = 2;
  compareAbortA = new AbortController();
  compareAbortB = new AbortController();

  const runOne = async (model, pane, controller, side) => {
    const displayName = compareAbMode ? (side === 'a' ? 'Model A' : 'Model B') : escHtml(model.replace(/^(ollama|lmstudio)\//, ''));
    const wrap = document.createElement('div');
    wrap.className = 'msg-wrap';
    wrap.dataset.role = 'assistant';
    wrap.innerHTML = `
      <div class="msg assistant">
        <div class="avatar">🤖</div>
        <div class="bubble"><div class="typing"><span></span><span></span><span></span></div></div>
      </div>
      <div class="msg-meta"><span>${displayName}</span></div>`;
    pane.appendChild(wrap);
    const bubble = wrap.querySelector('.bubble');

    const t0 = Date.now();
    let full = '';
    let cleared = false;
    let textDiv = null;

    try {
      const compareBody = {
        model, messages: apiMsgs,
        temperature: parseFloat(document.getElementById('temp-slider').value),
        max_tokens: parseInt(document.getElementById('max-tokens').value) || 2048,
        use_tools: false,
      };
      const compareRf = _buildResponseFormat();
      if (compareRf) compareBody.response_format = compareRf;

      const res = await fetch(`${PROXY}/v1/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...apiKeyHeader() },
        body: JSON.stringify(compareBody),
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
              if (!cleared) { bubble.innerHTML = ''; textDiv = document.createElement('div'); textDiv.className = 'msg-content'; bubble.appendChild(textDiv); cleared = true; }
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
    wrap.dataset.rawText = full;
    compareActiveCount--;
    if (compareActiveCount <= 0) {
      setCompareLoadingState(false);
      if (compareAbMode) {
        const revealBtn = document.getElementById('compare-reveal-btn');
        if (revealBtn) revealBtn.disabled = false;
      }
    }
    highlightNewCode();
    // Grade buttons appear once generation is complete (only when there's content)
    if (full) {
      const meta = wrap.querySelector('.msg-meta');
      if (meta) {
        const gw = document.createElement('span');
        gw.className = 'cmp-grade-wrap';
        gw.innerHTML =
          '<button class="cmp-grade-btn cmp-grade-up" title="Good response">👍</button>' +
          '<button class="cmp-grade-btn cmp-grade-dn" title="Bad response">👎</button>';
        gw.querySelector('.cmp-grade-up').addEventListener('click', () => gradeCompareMsg(wrap, 'up'));
        gw.querySelector('.cmp-grade-dn').addEventListener('click', () => gradeCompareMsg(wrap, 'down'));
        meta.appendChild(gw);
      }
    }
    updateCompareDiffBtn();
  };

  runOne(modelForPaneA, paneA, compareAbortA, 'a');
  runOne(modelForPaneB, paneB, compareAbortB, 'b');
}

// ─────────────────────────────────────────────────────────────────────────────
// § COMPARE DIFF VIEW
// ─────────────────────────────────────────────────────────────────────────────

function getLastAssistantText(paneEl) {
  const msgs = paneEl.querySelectorAll('.msg-wrap[data-role="assistant"]');
  if (!msgs.length) return null;
  const last = msgs[msgs.length - 1];
  if (last.dataset.rawText) return last.dataset.rawText;
  const content = last.querySelector('.msg-content');
  return content ? content.innerText.trim() : null;
}

function wordTokenize(str) {
  return str.match(/\S+|\n+| +/g) || [];
}

function computeWordDiff(a, b) {
  const tokA = wordTokenize(a);
  const tokB = wordTokenize(b);
  const m = tokA.length, n = tokB.length;

  // Cap to avoid O(m*n) hanging on massive responses
  if (m * n > 400000) {
    return [{ type: 'del', text: a }, { type: 'add', text: b }];
  }

  // LCS via DP table
  const dp = new Uint32Array((m + 1) * (n + 1));
  const idx = (i, j) => i * (n + 1) + j;
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[idx(i, j)] = tokA[i] === tokB[j]
        ? dp[idx(i + 1, j + 1)] + 1
        : Math.max(dp[idx(i + 1, j)], dp[idx(i, j + 1)]);
    }
  }

  // Traceback
  const parts = [];
  let i = 0, j = 0;
  while (i < m || j < n) {
    if (i < m && j < n && tokA[i] === tokB[j]) {
      parts.push({ type: 'eq', text: tokA[i] }); i++; j++;
    } else if (j < n && (i >= m || dp[idx(i + 1, j)] <= dp[idx(i, j + 1)])) {
      parts.push({ type: 'add', text: tokB[j] }); j++;
    } else {
      parts.push({ type: 'del', text: tokA[i] }); i++;
    }
  }
  return parts;
}

function renderDiff(parts) {
  return parts.map(p => {
    const txt = p.text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    if (p.type === 'eq')  return `<span>${txt}</span>`;
    if (p.type === 'add') return `<ins class="diff-add">${txt}</ins>`;
    return `<del class="diff-del">${txt}</del>`;
  }).join('');
}

function updateCompareDiffBtn() {
  const btn     = document.getElementById('compare-diff-btn');
  const saveBtn = document.getElementById('compare-save-btn');
  if (!btn) return;
  const paneA = document.getElementById('compare-msgs-a');
  const paneB = document.getElementById('compare-msgs-b');
  const doneA = paneA ? [...paneA.querySelectorAll('.msg-wrap[data-role="assistant"]')]
    .some(w => w.dataset.rawText !== undefined && w.dataset.rawText.trim()) : false;
  const doneB = paneB ? [...paneB.querySelectorAll('.msg-wrap[data-role="assistant"]')]
    .some(w => w.dataset.rawText !== undefined && w.dataset.rawText.trim()) : false;
  btn.disabled = !(doneA && doneB);
  if (saveBtn) saveBtn.disabled = !(doneA || doneB);
}

function showCompareDiff() {
  const paneA = document.getElementById('compare-msgs-a');
  const paneB = document.getElementById('compare-msgs-b');
  const textA = getLastAssistantText(paneA);
  const textB = getLastAssistantText(paneB);
  if (!textA || !textB) {
    return toast('Both models need at least one response to diff', 'error');
  }

  const parts = computeWordDiff(textA, textB);
  const html = renderDiff(parts);

  const promptLabel = document.getElementById('diff-prompt-label');
  const modelsRow   = document.getElementById('diff-models-row');
  const diffBody    = document.getElementById('diff-body');

  // Find the prompt that triggered the last pair
  const lastUserA = paneA.querySelector('.msg-wrap[data-role="user"]:last-of-type');
  const promptText = lastUserA ? lastUserA.querySelector('.msg-content')?.innerText?.trim() : '';

  if (promptLabel) {
    promptLabel.textContent = promptText ? `Prompt: "${promptText.slice(0, 120)}${promptText.length > 120 ? '…' : ''}"` : '';
  }
  if (modelsRow) {
    const nameA = document.getElementById('compare-model-a')?.value || 'Model A';
    const nameB = document.getElementById('compare-model-b')?.value || 'Model B';
    modelsRow.innerHTML =
      `<span class="diff-model-tag diff-model-a"><span class="diff-del-dot"></span>${nameA}</span>` +
      `<span class="diff-model-tag diff-model-b"><span class="diff-add-dot"></span>${nameB}</span>`;
  }
  if (diffBody) diffBody.innerHTML = `<p class="diff-text">${html}</p>`;

  document.getElementById('compare-diff-modal').classList.add('active');
}

function closeCompareDiff() {
  document.getElementById('compare-diff-modal').classList.remove('active');
}

// ─────────────────────────────────────────────────────────────────────────────
// § COMPARE REPORT EXPORT
// ─────────────────────────────────────────────────────────────────────────────

function saveCompareReport() {
  const paneA  = document.getElementById('compare-msgs-a');
  const paneB  = document.getElementById('compare-msgs-b');
  const modelA = document.getElementById('compare-model-a')?.value || 'Model A';
  const modelB = document.getElementById('compare-model-b')?.value || 'Model B';

  const userWraps = [...(paneA?.querySelectorAll('.msg-wrap[data-role="user"]')  || [])];
  const aWraps    = [...(paneA?.querySelectorAll('.msg-wrap[data-role="assistant"]') || [])];
  const bWraps    = [...(paneB?.querySelectorAll('.msg-wrap[data-role="assistant"]') || [])];

  if (!aWraps.length && !bWraps.length) {
    return toast('Nothing to save — send a prompt to both models first', 'error');
  }

  const winsA  = aWraps.filter(w => w.dataset.cmpGrade === 'up').length;
  const winsB  = bWraps.filter(w => w.dataset.cmpGrade === 'up').length;
  const rounds = Math.max(aWraps.length, bWraps.length);
  const now    = new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC';

  let md = `# Model Comparison Report\n\n`;
  md += `**Date:** ${now}  \n`;
  md += `**Model A:** \`${modelA}\`  \n`;
  md += `**Model B:** \`${modelB}\`  \n`;
  md += `**Rounds:** ${rounds}  \n`;
  if (winsA + winsB > 0) {
    const winner = winsA > winsB ? modelA : winsB > winsA ? modelB : 'Tie';
    md += `**Score:** A ${winsA} 👍 : B ${winsB} 👍  \n`;
    md += `**Winner:** ${winner}  \n`;
  }
  md += `\n---\n\n`;

  for (let i = 0; i < rounds; i++) {
    const prompt = userWraps[i]?.dataset.rawText || '';
    const textA  = aWraps[i]?.dataset.rawText || '_No response_';
    const textB  = bWraps[i]?.dataset.rawText || '_No response_';
    const gradeA = aWraps[i]?.dataset.cmpGrade;
    const gradeB = bWraps[i]?.dataset.cmpGrade;
    const metaA  = aWraps[i]?.querySelector('.msg-meta')?.innerText?.replace(/👍|👎/g, '').trim() || '';
    const metaB  = bWraps[i]?.querySelector('.msg-meta')?.innerText?.replace(/👍|👎/g, '').trim() || '';

    md += `## Round ${i + 1}\n\n`;
    if (prompt) md += `**Prompt:** ${prompt}\n\n`;

    md += `### Model A — \`${modelA}\`${gradeA === 'up' ? ' 👍' : gradeA === 'down' ? ' 👎' : ''}\n\n`;
    if (metaA) md += `*${metaA}*\n\n`;
    md += `${textA}\n\n`;

    md += `### Model B — \`${modelB}\`${gradeB === 'up' ? ' 👍' : gradeB === 'down' ? ' 👎' : ''}\n\n`;
    if (metaB) md += `*${metaB}*\n\n`;
    md += `${textB}\n\n`;

    if (i < rounds - 1) md += `---\n\n`;
  }

  const slug = (s) => s.replace(/[^a-z0-9]/gi, '-').toLowerCase().slice(0, 40);
  const blob = new Blob([md], { type: 'text/markdown' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `compare-${slug(modelA)}-vs-${slug(modelB)}-${Date.now()}.md`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Report saved', 'success');
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
// § APPEARANCE — accent color, font size, chat density
// ─────────────────────────────────────────────────────────────────────────────

const ACCENT_DEFAULTS = { accent: '#3b82f6', accent2: '#2563eb' };

function _darkenHex(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((n >> 16) & 0xff) - 30);
  const g = Math.max(0, ((n >> 8)  & 0xff) - 30);
  const b = Math.max(0, (n & 0xff) - 30);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function applyAppearance() {
  const { accentColor, fontSize = 'normal', density = 'comfortable' } = userSettings;
  const root = document.documentElement;

  if (accentColor) {
    root.style.setProperty('--accent',  accentColor);
    root.style.setProperty('--accent2', _darkenHex(accentColor));
  } else {
    root.style.removeProperty('--accent');
    root.style.removeProperty('--accent2');
  }

  root.setAttribute('data-fontsize', fontSize);
  root.setAttribute('data-density',  density);
}

function setAccentColor(color) {
  userSettings.accentColor = color;
  localStorage.setItem('llm-settings', JSON.stringify(userSettings));
  applyAppearance();
  _syncAppearanceUI();
}

function setFontSize(size) {
  userSettings.fontSize = size;
  localStorage.setItem('llm-settings', JSON.stringify(userSettings));
  applyAppearance();
  _syncAppearanceUI();
}

function setChatDensity(density) {
  userSettings.density = density;
  localStorage.setItem('llm-settings', JSON.stringify(userSettings));
  applyAppearance();
  _syncAppearanceUI();
}

function resetAppearance() {
  delete userSettings.accentColor;
  delete userSettings.fontSize;
  delete userSettings.density;
  localStorage.setItem('llm-settings', JSON.stringify(userSettings));
  applyAppearance();
  _syncAppearanceUI();
  toast('Appearance reset to defaults');
}

function _syncAppearanceUI() {
  const { accentColor, fontSize = 'normal', density = 'comfortable' } = userSettings;

  document.querySelectorAll('.accent-swatch[data-color]').forEach(el => {
    el.classList.toggle('active', el.dataset.color === accentColor);
  });
  const customInput = document.getElementById('accent-custom-input');
  if (customInput && accentColor) customInput.value = accentColor;

  document.querySelectorAll('#fontsize-options .appearance-option').forEach(el => {
    el.classList.toggle('active', el.dataset.val === fontSize);
  });
  document.querySelectorAll('#density-options .appearance-option').forEach(el => {
    el.classList.toggle('active', el.dataset.val === density);
  });
}

function openAppearanceSettings() {
  switchSettingsTab('appearance');
  _syncAppearanceUI();
  openModal('config-modal');
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
    { group: 'Actions',   icon: '🔎',  label: 'Search in Conversation',    kbd: '⌘F',   action: () => openConvSearch() },
    { group: 'Actions',   icon: '⛶',   label: 'Toggle Focus Mode',         kbd: '⌘⇧F', action: () => toggleFocusMode() },
    { group: 'Actions',   icon: '🎨',  label: 'Toggle Theme',                            action: () => toggleTheme() },
    ...(conv ? [
      { group: 'Chat',    icon: '📋',  label: 'Export Chat as Markdown',                 action: () => exportConv('md') },
      { group: 'Chat',    icon: '📋',  label: 'Export Chat for Obsidian',                action: () => exportConv('obsidian') },
      { group: 'Chat',    icon: '📋',  label: 'Export Chat as JSON',                     action: () => exportConv('json') },
    ] : []),
    { group: 'Models',    icon: '📦',  label: 'Model Manager',                           action: () => openModelManager() },
    { group: 'Models',    icon: '🔄',  label: 'Reload Models',                           action: () => loadModels() },
    { group: 'Settings',  icon: '⚙️',  label: 'Open Settings',                           action: () => openConfigEditor() },
    { group: 'Settings',  icon: '🖥',  label: 'General — proxy URL, storage, startup',  action: () => openGeneralSettings() },
    { group: 'Settings',  icon: '📥',  label: 'Import Conversations (merge)',             action: () => { openConfigEditor(); setTimeout(() => { switchSettingsTab('backup'); document.getElementById('conv-import-file-input')?.click(); }, 300); } },
    { group: 'Settings',  icon: '🔑',  label: 'API Keys',                                action: () => openApiKeySettings() },
    { group: 'Settings',  icon: '🎨',  label: 'Appearance — accent color, font, density', action: () => openAppearanceSettings() },
    { group: 'Settings',  icon: '💰',  label: 'Reset session cost total',                action: () => resetSessionCost() },
    { group: 'Tools',     icon: '⚖️',  label: 'Compare Models',                          action: () => { if (!compareMode) toggleCompareMode(); } },
    { group: 'Tools',     icon: '🎲',  label: 'Compare — A/B Test Mode',                  action: () => { if (!compareMode) toggleCompareMode(); toggleAbMode(); } },
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

    // Escape closes modals / exits bulk mode
    if (e.key === 'Escape') {
      if (bulkSelectMode) { exitBulkMode(); return; }
      document.querySelectorAll('.modal-overlay.active').forEach(m => m.classList.remove('active'));
      return;
    }

    // ? shows keyboard shortcuts (only if not typing in an input)
    if (e.key === '?' && !meta && document.activeElement?.tagName !== 'TEXTAREA' && document.activeElement?.tagName !== 'INPUT') {
      openModal('shortcuts-modal');
      return;
    }

    // T toggles message timestamps (only if not typing)
    if ((e.key === 't' || e.key === 'T') && !meta && document.activeElement?.tagName !== 'TEXTAREA' && document.activeElement?.tagName !== 'INPUT') {
      toggleTimestamps();
      return;
    }

    if (!meta) return;

    if (e.key === 'p' || e.key === 'P') { e.preventDefault(); openPalette(); return; }
    if (e.key === 'k' || e.key === 'K') { e.preventDefault(); openSearch(); return; }
    if (e.key === 'j' || e.key === 'J') { e.preventDefault(); newConversation(); return; }
    if ((e.key === 'f' || e.key === 'F') && e.shiftKey) { e.preventDefault(); toggleFocusMode(); return; }
    if ((e.key === 'f' || e.key === 'F') && !e.shiftKey) { e.preventDefault(); openConvSearch(); return; }

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
  toastHistory.unshift({ msg, kind, ts: Date.now() });
  if (toastHistory.length > 100) toastHistory.pop();
  if (toastHistoryOpen) renderToastHistory();
  const el = document.createElement('div');
  el.className = `toast ${kind}`;
  el.textContent = msg;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 200); }, 2500);
}
function showToast(msg, kind = '') { return toast(msg, kind); }

// ─── Toast History Panel ────────────────────────────────────────────────────
function toggleToastHistory() {
  toastHistoryOpen ? closeToastHistory() : openToastHistory();
}
function openToastHistory() {
  toastHistoryOpen = true;
  document.getElementById('toast-history-drawer').classList.add('open');
  document.getElementById('notif-btn')?.classList.add('active');
  renderToastHistory();
}
function closeToastHistory() {
  toastHistoryOpen = false;
  document.getElementById('toast-history-drawer').classList.remove('open');
  document.getElementById('notif-btn')?.classList.remove('active');
}
function renderToastHistory() {
  const list = document.getElementById('toast-history-list');
  if (!list) return;
  if (!toastHistory.length) {
    list.innerHTML = '<div class="toast-history-empty">No notifications yet</div>';
    return;
  }
  list.innerHTML = toastHistory.map(t => {
    const d = new Date(t.ts);
    const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    return `<div class="toast-history-item ${t.kind || ''}">
      <div class="th-msg">${escHtml(t.msg)}</div>
      <div class="th-time">${time}</div>
    </div>`;
  }).join('');
}
function clearToastHistory() {
  toastHistory = [];
  renderToastHistory();
}

// ─── Onboarding Wizard ──────────────────────────────────────────────────────
let _wizardStep = 1;
const _WIZARD_STEPS = 3;
let _wizardPrevFocus = null;

function openOnboardingWizard() {
  _wizardStep = 1;
  _wizardPrevFocus = document.activeElement;
  const overlay = document.getElementById('onboarding-wizard');
  overlay.classList.add('active');
  _renderWizardStep();
  const firstBtn = overlay.querySelector('button, [href], input, [tabindex]:not([tabindex="-1"])');
  if (firstBtn) firstBtn.focus();
}
// persist=false when the user is merely navigating away mid-wizard (e.g. to Settings);
// persist=true (default) for an intentional skip or completion.
function closeOnboardingWizard(persist = true) {
  document.getElementById('onboarding-wizard').classList.remove('active');
  if (persist) localStorage.setItem('llm-onboarded', '1');
  if (_wizardPrevFocus) { _wizardPrevFocus.focus(); _wizardPrevFocus = null; }
}
function wizardNext() {
  if (_wizardStep < _WIZARD_STEPS) {
    _wizardStep++;
    _renderWizardStep();
    if (_wizardStep === 2) _runWizardDetection();
  } else {
    closeOnboardingWizard();
  }
}
function wizardBack() {
  if (_wizardStep > 1) { _wizardStep--; _renderWizardStep(); }
}
function _renderWizardStep() {
  document.querySelectorAll('.wizard-step-dot').forEach((d, i) => {
    d.classList.toggle('active', i < _wizardStep);
  });
  for (let i = 1; i <= _WIZARD_STEPS; i++) {
    const el = document.getElementById(`wizard-step-${i}`);
    if (el) el.style.display = i === _wizardStep ? 'block' : 'none';
  }
  const backBtn = document.getElementById('wizard-back-btn');
  const nextBtn = document.getElementById('wizard-next-btn');
  const skipBtn = document.getElementById('wizard-skip-btn');
  if (backBtn) backBtn.style.display = _wizardStep > 1 ? 'inline-flex' : 'none';
  if (nextBtn) {
    if (_wizardStep === 1) nextBtn.textContent = 'Get Started →';
    else if (_wizardStep === _WIZARD_STEPS) nextBtn.textContent = 'Start Chatting →';
    else nextBtn.textContent = 'Continue →';
  }
  if (skipBtn) skipBtn.style.display = _wizardStep === _WIZARD_STEPS ? 'none' : 'inline-block';
}
async function _runWizardDetection() {
  const status = document.getElementById('wizard-detect-status');
  if (!status) return;
  const KNOWN_LABELS = {
    ollama: '🖥️ Ollama', lmstudio: '🖥️ LM Studio',
    openai: '☁️ OpenAI', anthropic: '☁️ Anthropic',
    groq: '☁️ Groq', cohere: '☁️ Cohere',
    mistral: '☁️ Mistral', together: '☁️ Together AI',
    fireworks: '☁️ Fireworks', openrouter: '☁️ OpenRouter',
  };
  status.innerHTML = `<p style="color:var(--muted);font-size:13px">Checking providers…</p>`;
  try {
    const res  = await fetch(`${PROXY}/health`, { headers: apiKeyHeader() });
    const data = await res.json();
    const providerData = data.providers || {};
    const keys = Object.keys(providerData);
    if (!keys.length) {
      status.innerHTML = `<p style="color:var(--muted);font-size:13px">No providers reported. Start Ollama or add an API key.</p>`;
      return;
    }
    status.innerHTML = keys.map(key => {
      const label = KNOWN_LABELS[key] || `🔌 ${escHtml(key)}`;
      const online = providerData[key] === 'online';
      return `<div class="wizard-detect-row">
        <span>${label}</span>
        <span class="wizard-detect-status ${online ? 'online' : 'offline'}">${online ? '✓ Connected' : '○ Not found'}</span>
      </div>`;
    }).join('');
  } catch {
    status.innerHTML = `<p style="color:var(--red);font-size:13px">Could not reach proxy. Make sure <code>node proxy.js</code> is running.</p>`;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// § UTILS
// ─────────────────────────────────────────────────────────────────────────────

function formatTs(ts, margin = '') {
  if (!ts) return '';
  const d = new Date(ts), diff = Date.now() - ts;
  let rel;
  if      (diff < 60000)     rel = 'just now';
  else if (diff < 3600000)   rel = `${Math.floor(diff / 60000)}m ago`;
  else if (diff < 86400000)  rel = `${Math.floor(diff / 3600000)}h ago`;
  else if (diff < 172800000) rel = 'yesterday';
  else rel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const abs  = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const full = d.toLocaleString('en-US', { dateStyle: 'long', timeStyle: 'medium' });
  const sty  = margin ? ` style="margin-${margin}:auto"` : '';
  return `<time class="msg-timestamp" data-ts="${ts}" datetime="${d.toISOString()}" title="${escHtml(full)}"${sty}>${escHtml(rel)} · ${escHtml(abs)}</time>`;
}

function refreshTimestamps() {
  document.querySelectorAll('time.msg-timestamp[data-ts]').forEach(el => {
    const ts = +el.dataset.ts;
    if (!ts) return;
    const d = new Date(ts), diff = Date.now() - ts;
    let rel;
    if      (diff < 60000)     rel = 'just now';
    else if (diff < 3600000)   rel = `${Math.floor(diff / 60000)}m ago`;
    else if (diff < 86400000)  rel = `${Math.floor(diff / 3600000)}h ago`;
    else if (diff < 172800000) rel = 'yesterday';
    else rel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const abs = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    el.textContent = `${rel} · ${abs}`;
  });
}

function toggleTimestamps() {
  showTimestamps = !showTimestamps;
  localStorage.setItem('llm-show-ts', showTimestamps ? '1' : '0');
  document.body.classList.toggle('show-timestamps', showTimestamps);
  document.getElementById('ts-btn')?.classList.toggle('active', showTimestamps);
  toast(showTimestamps ? 'Timestamps on' : 'Timestamps off');
}

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

// Debounced localStorage flush — avoids JSON.stringify on every keystroke
let _saveConvsTimer = null;
function debouncedSaveConvs() {
  clearTimeout(_saveConvsTimer);
  _saveConvsTimer = setTimeout(() => saveConvs(), 500);
}

// System prompt — token count + auto-save to current conversation
document.addEventListener('DOMContentLoaded', () => {
  const sys = document.getElementById('sys-input');
  if (sys) sys.addEventListener('input', () => {
    updateInputTokenCount();
    const conv = currentConv();
    if (conv) { conv.sysPrompt = sys.value; debouncedSaveConvs(); }
  });

  // Context length override — auto-save to current conversation
  const ctxLenInput = document.getElementById('ctx-length-input');
  if (ctxLenInput) ctxLenInput.addEventListener('input', () => {
    const conv = currentConv();
    if (conv) { conv.ctxLen = ctxLenInput.value; debouncedSaveConvs(); }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// § JSON MODE
// ─────────────────────────────────────────────────────────────────────────────

let jsonMode = false;

function toggleJsonMode() {
  jsonMode = !jsonMode;
  document.getElementById('json-btn').classList.toggle('active', jsonMode);
  document.getElementById('json-indicator').classList.toggle('active', jsonMode);
  toast(jsonMode ? 'JSON mode ON — response will be valid JSON' : 'JSON mode OFF', 'success');
}

// ─────────────────────────────────────────────────────────────────────────────
// § JSON SCHEMA MODE
// ─────────────────────────────────────────────────────────────────────────────

let schemaMode = false;
let schemaContent = localStorage.getItem('llm-schema') || '';

const SCHEMA_PRESETS = {
  qa: {
    type: 'object',
    properties: {
      answer: { type: 'string', description: 'The direct answer to the question' },
      confidence: { type: 'number', description: 'Confidence 0–1' },
      sources: { type: 'array', items: { type: 'string' } }
    },
    required: ['answer', 'confidence']
  },
  list: {
    type: 'object',
    properties: {
      items: { type: 'array', items: { type: 'string' }, description: 'List of items' },
      total: { type: 'number' }
    },
    required: ['items']
  },
  step: {
    type: 'object',
    properties: {
      steps: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            step: { type: 'number' },
            title: { type: 'string' },
            description: { type: 'string' }
          },
          required: ['step', 'title']
        }
      },
      summary: { type: 'string' }
    },
    required: ['steps']
  },
  kv: {
    type: 'object',
    additionalProperties: { type: 'string' },
    description: 'Flexible key-value map'
  }
};

function toggleSchemaMode() {
  schemaMode = !schemaMode;
  document.getElementById('schema-btn')?.classList.toggle('active', schemaMode);
  document.getElementById('schema-indicator')?.classList.toggle('active', schemaMode);
  document.getElementById('schema-toggle')?.classList.toggle('on', schemaMode);
  const badge = document.getElementById('schema-panel-badge');
  if (badge) badge.style.display = schemaMode ? '' : 'none';
  _syncSchemaValidity();
  toast(schemaMode ? 'Schema mode ON — responses will follow your JSON schema' : 'Schema mode OFF');
  if (schemaMode) {
    const panel = document.getElementById('schema-panel');
    if (panel && panel.dataset.open === 'false') {
      const toggle = panel.querySelector('.panel-toggle');
      if (toggle) togglePanel(toggle);
    }
    setTimeout(() => document.getElementById('schema-editor')?.focus(), 80);
  }
}

function onSchemaEdit() {
  const el = document.getElementById('schema-editor');
  schemaContent = el?.value || '';
  localStorage.setItem('llm-schema', schemaContent);
  _syncSchemaValidity();
  if (el && schemaContent.trim()) {
    const valid = !!_parseSchema();
    el.classList.toggle('valid-schema', valid);
    el.classList.toggle('invalid-schema', !valid);
  } else if (el) {
    el.classList.remove('valid-schema', 'invalid-schema');
  }
}

function _syncSchemaValidity() {
  const valid = _parseSchema();
  const label = schemaMode ? (valid ? '✓ valid' : schemaContent.trim() ? '✗ invalid' : 'empty') : '';
  const cls   = schemaMode ? (valid ? 'ok' : schemaContent.trim() ? 'err' : 'empty') : '';
  ['schema-validity', 'schema-validity-panel'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.textContent = label; el.className = `schema-validity ${cls}`; }
  });
}

function _parseSchema() {
  if (!schemaContent.trim()) return null;
  try { return JSON.parse(schemaContent); } catch { return null; }
}

function formatSchema() {
  const parsed = _parseSchema();
  if (!parsed) { toast('Invalid JSON — fix the schema first', 'error'); return; }
  const pretty = JSON.stringify(parsed, null, 2);
  schemaContent = pretty;
  const el = document.getElementById('schema-editor');
  if (el) el.value = pretty;
  localStorage.setItem('llm-schema', pretty);
  _syncSchemaValidity();
}

function applySchemaPreset(key) {
  const preset = SCHEMA_PRESETS[key];
  if (!preset) return;
  schemaContent = JSON.stringify(preset, null, 2);
  const el = document.getElementById('schema-editor');
  if (el) el.value = schemaContent;
  localStorage.setItem('llm-schema', schemaContent);
  _syncSchemaValidity();
  if (!schemaMode) toggleSchemaMode();
  toast(`Schema preset "${key}" applied`);
}

function _buildResponseFormat() {
  if (schemaMode) {
    const schema = _parseSchema();
    if (schema) return { type: 'json_schema', json_schema: { name: 'output', strict: true, schema } };
  }
  if (jsonMode) return { type: 'json_object' };
  return null;
}

function _initSchemaEditor() {
  const el = document.getElementById('schema-editor');
  if (el && schemaContent) el.value = schemaContent;
  _syncSchemaValidity();
}

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
// § TEXT-TO-SPEECH OUTPUT
// ─────────────────────────────────────────────────────────────────────────────

let _ttsCurrentIdx = -1;

function stripMarkdownForSpeech(md) {
  if (!md) return '';
  return md
    .replace(/```[\s\S]*?```/g, ' code block ')
    .replace(/`[^`]+`/g, ' code ')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*+]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/^>\s+/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/\|[^\n]+\|/g, '')
    .replace(/[-]{3,}/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function speakMessage(idx) {
  if (!('speechSynthesis' in window)) {
    toast('Text-to-speech is not supported in this browser.', 'error');
    return;
  }
  if (_ttsCurrentIdx === idx) { stopSpeaking(); return; }
  stopSpeaking();

  const conv = currentConv();
  const msg  = conv?.messages[idx];
  if (!msg) return;
  const raw  = typeof msg.content === 'string' ? msg.content : '';
  const text = stripMarkdownForSpeech(raw);
  if (!text) return;

  const u = new SpeechSynthesisUtterance(text);
  const tts = userSettings.tts || {};
  if (tts.voiceURI) {
    const v = speechSynthesis.getVoices().find(v => v.voiceURI === tts.voiceURI);
    if (v) u.voice = v;
  }
  u.rate  = parseFloat(tts.rate  ?? 1.0);
  u.pitch = parseFloat(tts.pitch ?? 1.0);

  _ttsCurrentIdx = idx;
  _updateTtsButton(idx, true);

  u.onend   = () => { _ttsCurrentIdx = -1; _updateTtsButton(idx, false); };
  u.onerror = () => { _ttsCurrentIdx = -1; _updateTtsButton(idx, false); };
  speechSynthesis.speak(u);
}

function stopSpeaking() {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const prev = _ttsCurrentIdx;
  _ttsCurrentIdx = -1;
  if (prev >= 0) _updateTtsButton(prev, false);
}

function _updateTtsButton(idx, speaking) {
  const btn = document.getElementById(`tts-btn-${idx}`);
  if (!btn) return;
  btn.classList.toggle('tts-speaking', speaking);
  btn.title = speaking ? 'Stop reading' : 'Read aloud';
  btn.innerHTML = speaking
    ? `<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Stop`
    : '🔊 Read';
}

function initTtsVoiceSelect() {
  const sel = document.getElementById('tts-voice-select');
  if (!sel) return;
  const populate = () => {
    const voices = speechSynthesis.getVoices();
    const saved  = userSettings.tts?.voiceURI || '';
    sel.innerHTML = `<option value="">Default voice</option>` +
      voices.map(v =>
        `<option value="${escHtml(v.voiceURI)}"${v.voiceURI === saved ? ' selected' : ''}>
          ${escHtml(v.name)} (${v.lang})
        </option>`
      ).join('');
  };
  populate();
  if (speechSynthesis.onvoiceschanged !== undefined) speechSynthesis.onvoiceschanged = populate;
  const tts = userSettings.tts || {};
  const rateEl  = document.getElementById('tts-rate');
  const pitchEl = document.getElementById('tts-pitch');
  if (rateEl)  { rateEl.value  = tts.rate  ?? 1.0; _syncTtsLabel('rate',  rateEl.value); }
  if (pitchEl) { pitchEl.value = tts.pitch ?? 1.0; _syncTtsLabel('pitch', pitchEl.value); }
}

function _syncTtsLabel(key, val) {
  const el = document.getElementById(`tts-${key}-val`);
  if (el) el.textContent = parseFloat(val).toFixed(1);
}

function onTtsSliderChange(key, val) { _syncTtsLabel(key, val); }

function saveTtsSettings() {
  const sel   = document.getElementById('tts-voice-select');
  const rate  = document.getElementById('tts-rate');
  const pitch = document.getElementById('tts-pitch');
  userSettings.tts = {
    voiceURI: sel?.value  || '',
    rate:     parseFloat(rate?.value  ?? 1.0),
    pitch:    parseFloat(pitch?.value ?? 1.0),
  };
  localStorage.setItem('llm-settings', JSON.stringify(userSettings));
  toast('Voice settings saved.', 'success');
}

function testTtsSettings() {
  saveTtsSettings();
  const conv = currentConv();
  const msgs = conv?.messages || [];
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === 'assistant') { speakMessage(i); return; }
  }
  // No assistant message yet — play a short demo
  stopSpeaking();
  const u = new SpeechSynthesisUtterance('Hello. This is how your AI assistant sounds.');
  const tts = userSettings.tts || {};
  if (tts.voiceURI) {
    const v = speechSynthesis.getVoices().find(v => v.voiceURI === tts.voiceURI);
    if (v) u.voice = v;
  }
  u.rate  = parseFloat(tts.rate  ?? 1.0);
  u.pitch = parseFloat(tts.pitch ?? 1.0);
  speechSynthesis.speak(u);
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
    // Refresh model selects so hardware-fit indicators and optgroup reflect current RAM
    if (availableModels.length) {
      for (const id of ['model-select', 'compare-model-a', 'compare-model-b']) {
        const sel = document.getElementById(id);
        if (sel) fillModelSelect(sel);
      }
    }
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
// § MODEL LIBRARY BROWSER
// ─────────────────────────────────────────────────────────────────────────────

const OLLAMA_LIBRARY = [
  // ── Meta Llama ──────────────────────────────────────────────────────────────
  { name: 'llama3.3',         org: 'Meta',      icon: '🦙', size: '43 GB',  tags: ['large'],           desc: 'Llama 3.3 70B — Meta\'s latest flagship for reasoning and instruction following.' },
  { name: 'llama3.2',         org: 'Meta',      icon: '🦙', size: '2 GB',   tags: ['fast'],            desc: 'Llama 3.2 3B — fast, capable small model good for everyday tasks.' },
  { name: 'llama3.2:1b',      org: 'Meta',      icon: '🦙', size: '1.3 GB', tags: ['fast'],            desc: 'Llama 3.2 1B — ultra-light, runs on anything.' },
  { name: 'llama3.2-vision',  org: 'Meta',      icon: '🦙', size: '8 GB',   tags: ['vision'],          desc: 'Llama 3.2 11B Vision — multimodal model for image understanding.' },
  { name: 'llama3.1',         org: 'Meta',      icon: '🦙', size: '5 GB',   tags: [],                  desc: 'Llama 3.1 8B — solid all-rounder with 128K context.' },
  { name: 'llama3.1:70b',     org: 'Meta',      icon: '🦙', size: '40 GB',  tags: ['large'],           desc: 'Llama 3.1 70B — high-quality reasoning and instruction following.' },
  // ── Qwen ────────────────────────────────────────────────────────────────────
  { name: 'qwen2.5',          org: 'Alibaba',   icon: '🟣', size: '5 GB',   tags: [],                  desc: 'Qwen 2.5 7B — strong multilingual and coding performance.' },
  { name: 'qwen2.5:14b',      org: 'Alibaba',   icon: '🟣', size: '9 GB',   tags: [],                  desc: 'Qwen 2.5 14B — excellent balance of quality and speed.' },
  { name: 'qwen2.5:32b',      org: 'Alibaba',   icon: '🟣', size: '19 GB',  tags: ['large'],           desc: 'Qwen 2.5 32B — powerful, near-frontier quality.' },
  { name: 'qwen2.5-coder',    org: 'Alibaba',   icon: '🟣', size: '5 GB',   tags: ['code'],            desc: 'Qwen 2.5 Coder 7B — specialized for code generation and review.' },
  { name: 'qwen2.5-coder:14b',org: 'Alibaba',   icon: '🟣', size: '9 GB',   tags: ['code'],            desc: 'Qwen 2.5 Coder 14B — excellent code model rivaling GPT-4 on benchmarks.' },
  { name: 'qwq',              org: 'Alibaba',   icon: '🟣', size: '20 GB',  tags: ['large'],           desc: 'QwQ 32B — reasoning-focused model with strong math and logic.' },
  // ── Mistral / Mixtral ───────────────────────────────────────────────────────
  { name: 'mistral',          org: 'Mistral AI',icon: '💠', size: '4 GB',   tags: ['fast'],            desc: 'Mistral 7B — blazing fast, concise, great for instruction following.' },
  { name: 'mistral-small',    org: 'Mistral AI',icon: '💠', size: '14 GB',  tags: [],                  desc: 'Mistral Small 3 — strong all-rounder at an efficient size.' },
  { name: 'mixtral',          org: 'Mistral AI',icon: '💠', size: '26 GB',  tags: ['large'],           desc: 'Mixtral 8×7B MoE — sparse expert model with excellent quality.' },
  // ── DeepSeek ────────────────────────────────────────────────────────────────
  { name: 'deepseek-r1',      org: 'DeepSeek',  icon: '🔷', size: '5 GB',   tags: ['fast'],            desc: 'DeepSeek-R1 7B — chain-of-thought reasoning, open-source frontier.' },
  { name: 'deepseek-r1:14b',  org: 'DeepSeek',  icon: '🔷', size: '9 GB',   tags: [],                  desc: 'DeepSeek-R1 14B — strong math and coding with extended thinking.' },
  { name: 'deepseek-r1:32b',  org: 'DeepSeek',  icon: '🔷', size: '19 GB',  tags: ['large'],           desc: 'DeepSeek-R1 32B — near-GPT-4 reasoning quality.' },
  { name: 'deepseek-coder-v2',org: 'DeepSeek',  icon: '🔷', size: '9 GB',   tags: ['code'],            desc: 'DeepSeek Coder v2 16B — top-tier code model, outperforms GPT-4o on code.' },
  // ── Microsoft Phi ───────────────────────────────────────────────────────────
  { name: 'phi4',             org: 'Microsoft', icon: '🔵', size: '8 GB',   tags: ['fast'],            desc: 'Phi-4 14B — punches well above its weight on reasoning tasks.' },
  { name: 'phi4-mini',        org: 'Microsoft', icon: '🔵', size: '2.5 GB', tags: ['fast'],            desc: 'Phi-4 Mini 3.8B — ultra-efficient, great for constrained environments.' },
  { name: 'phi3.5',           org: 'Microsoft', icon: '🔵', size: '2.2 GB', tags: ['fast'],            desc: 'Phi-3.5 Mini — fast and smart small model from Microsoft.' },
  // ── Google Gemma ────────────────────────────────────────────────────────────
  { name: 'gemma3',           org: 'Google',    icon: '🟤', size: '5 GB',   tags: ['vision'],          desc: 'Gemma 3 9B — multimodal, strong reasoning, Google\'s open model.' },
  { name: 'gemma3:27b',       org: 'Google',    icon: '🟤', size: '17 GB',  tags: ['vision', 'large'], desc: 'Gemma 3 27B — Google\'s largest open model with vision capabilities.' },
  { name: 'gemma2',           org: 'Google',    icon: '🟤', size: '5 GB',   tags: [],                  desc: 'Gemma 2 9B — efficient, high-quality model from Google.' },
  // ── Code-specialized ────────────────────────────────────────────────────────
  { name: 'codellama',        org: 'Meta',      icon: '💻', size: '4 GB',   tags: ['code'],            desc: 'Code Llama 7B — purpose-built for code generation and debugging.' },
  { name: 'codellama:34b',    org: 'Meta',      icon: '💻', size: '19 GB',  tags: ['code', 'large'],   desc: 'Code Llama 34B — powerful coding assistant.' },
  { name: 'starcoder2',       org: 'HuggingFace',icon:'💻', size: '9 GB',   tags: ['code'],            desc: 'StarCoder2 15B — trained on 600+ languages, great for open-source code.' },
  // ── Embeddings ──────────────────────────────────────────────────────────────
  { name: 'nomic-embed-text', org: 'Nomic',     icon: '📐', size: '274 MB', tags: ['embed'],           desc: 'Nomic Embed Text v1.5 — fast, local embedding model for RAG.' },
  { name: 'mxbai-embed-large',org: 'MixedBread',icon: '📐', size: '670 MB', tags: ['embed'],           desc: 'MixedBread Large — high-quality English embedding model.' },
  // ── Vision ──────────────────────────────────────────────────────────────────
  { name: 'llava',            org: 'LLaVA',     icon: '👁',  size: '4 GB',   tags: ['vision'],          desc: 'LLaVA 1.6 7B — image understanding and visual Q&A.' },
  { name: 'moondream',        org: 'Moondream', icon: '👁',  size: '1.7 GB', tags: ['vision', 'fast'],  desc: 'Moondream 2 — tiny but capable vision-language model.' },
];

const MM_LIB_CATEGORIES = ['All', 'fast', 'code', 'vision', 'large', 'embed'];
let   mmLibActiveFilter  = 'All';

function switchModelManagerTab(tab) {
  document.getElementById('mm-panel-installed').style.display  = tab === 'installed'  ? '' : 'none';
  document.getElementById('mm-panel-library').style.display    = tab === 'library'    ? '' : 'none';
  document.getElementById('mm-panel-benchmark').style.display  = tab === 'benchmark'  ? '' : 'none';
  document.getElementById('mm-tab-installed').classList.toggle('active',  tab === 'installed');
  document.getElementById('mm-tab-library').classList.toggle('active',    tab === 'library');
  document.getElementById('mm-tab-benchmark').classList.toggle('active',  tab === 'benchmark');
  if (tab === 'library') {
    renderLibraryFilters();
    renderModelLibrary('');
  }
  if (tab === 'benchmark') openBenchmarkTab();
}

function renderLibraryFilters() {
  const el = document.getElementById('mm-library-filters');
  el.innerHTML = MM_LIB_CATEGORIES.map(cat =>
    `<button class="mm-filter-chip${mmLibActiveFilter === cat ? ' active' : ''}"
       onclick="mmSetFilter('${cat}')">${cat === 'All' ? 'All models' : cat}</button>`
  ).join('');
}

function mmSetFilter(cat) {
  mmLibActiveFilter = cat;
  renderLibraryFilters();
  renderModelLibrary(document.getElementById('mm-library-search').value || '');
}

function renderModelLibrary(query = '') {
  const q = query.toLowerCase().trim();
  const filtered = OLLAMA_LIBRARY.filter(m => {
    const matchesFilter = mmLibActiveFilter === 'All' || m.tags.includes(mmLibActiveFilter);
    const matchesQuery  = !q || m.name.includes(q) || m.org.toLowerCase().includes(q) || m.desc.toLowerCase().includes(q);
    return matchesFilter && matchesQuery;
  });

  const grid = document.getElementById('mm-library-grid');
  if (!filtered.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;padding:24px;text-align:center;color:var(--muted);font-family:var(--mono);font-size:12px">No models match your search.</div>';
    return;
  }

  grid.innerHTML = filtered.map(m => {
    const tags = m.tags.map(t => `<span class="mm-lib-tag ${t}">${t}</span>`).join('');
    return `<div class="mm-lib-card">
      <div class="mm-lib-card-header">
        <div class="mm-lib-icon" style="background:var(--s3)">${m.icon}</div>
        <div class="mm-lib-name-wrap">
          <div class="mm-lib-name">${m.name}</div>
          <div class="mm-lib-org">${m.org}</div>
        </div>
      </div>
      <div class="mm-lib-desc">${m.desc}</div>
      <div class="mm-lib-footer">
        <div class="mm-lib-tags">${tags}</div>
        <span class="mm-lib-size">${m.size}</span>
        <button class="mm-lib-pull-btn" onclick="pullFromLibrary('${m.name}', this)" title="Pull ${m.name}">↓ Pull</button>
      </div>
    </div>`;
  }).join('');
}

function pullFromLibrary(name, btnEl) {
  const pullBtn = document.getElementById('mm-pull-btn');
  if (pullBtn?.disabled) return;
  switchModelManagerTab('installed');
  const input = document.getElementById('mm-pull-input');
  input.value = name;
  input.focus();
  btnEl.disabled = true;
  btnEl.classList.add('pulling');
  btnEl.textContent = 'Queued';
  setTimeout(() => {
    pullModel().finally(() => { btnEl.disabled = false; });
  }, 100);
}

// ─────────────────────────────────────────────────────────────────────────────
// § MODEL BENCHMARK RUNNER
// ─────────────────────────────────────────────────────────────────────────────

let benchmarkRunning = false;

async function openBenchmarkTab() {
  const listEl = document.getElementById('mm-bench-model-list');
  listEl.innerHTML = '<div class="loading-row"><div class="spinner"></div> Loading…</div>';

  try {
    const res = await fetch(`${PROXY}/v1/models`);
    const data = await res.json();
    const models = (data.data || []).filter(m => m.owned_by === 'ollama' || m.id?.startsWith('ollama/'));

    if (!models.length) {
      listEl.innerHTML = '<div class="mm-empty">No Ollama models installed. Pull one first.</div>';
      return;
    }

    listEl.innerHTML = models.map(m => {
      const shortName = m.id.replace(/^ollama\//, '');
      const meta = modelMetadata[m.id] || {};
      const metaStr = [meta.parameter_size, meta.quantization].filter(Boolean).join(' · ') || '';
      return `<label class="mm-bench-model-check">
        <input type="checkbox" class="mm-bench-cb" value="${shortName}" checked>
        <span class="bench-model-name">${shortName}</span>
        ${metaStr ? `<span class="bench-model-meta">${metaStr}</span>` : ''}
      </label>`;
    }).join('');
  } catch {
    listEl.innerHTML = '<div class="mm-empty">Could not reach proxy — is it running?</div>';
  }
}

async function benchmarkSingleModel(modelId, prompt, onToken) {
  const startMs = performance.now();
  let firstTokenMs = null;
  let charCount = 0;

  const res = await fetch(`${PROXY}/v1/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...apiKeyHeader() },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 256,
      use_tools: false,
    }),
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const reader  = res.body.getReader();
  const decoder = new TextDecoder();
  let   buf     = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const block = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      for (const line of block.split('\n')) {
        if (!line.startsWith('data: ')) continue;
        let evt;
        try { evt = JSON.parse(line.slice(6)); } catch { continue; }
        if (evt.type === 'text_delta' && evt.delta) {
          if (firstTokenMs === null) firstTokenMs = performance.now();
          charCount += evt.delta.length;
          if (onToken) onToken(charCount);
        }
      }
    }
  }

  const endMs     = performance.now();
  const ttft      = firstTokenMs !== null ? firstTokenMs - startMs : null;
  const genMs     = firstTokenMs !== null ? endMs - firstTokenMs   : endMs - startMs;
  const estTokens = Math.round(charCount / 4);
  const tokPerSec = genMs > 0 ? (estTokens / (genMs / 1000)) : 0;

  return { modelId, estTokens, tokPerSec, ttft, totalMs: endMs - startMs };
}

async function runBenchmark() {
  if (benchmarkRunning) return;

  const checkboxes = [...document.querySelectorAll('.mm-bench-cb:checked')];
  if (!checkboxes.length) { showToast('Select at least one model to benchmark.', 'warning'); return; }

  const prompt = document.getElementById('mm-bench-prompt').value.trim();
  if (!prompt) { showToast('Enter a benchmark prompt.', 'warning'); return; }

  benchmarkRunning = true;
  const runBtn   = document.getElementById('mm-bench-run-btn');
  const statusEl = document.getElementById('mm-bench-status');
  runBtn.disabled = true;

  const models  = checkboxes.map(cb => cb.value);
  const results = [];

  // Show results area immediately with running state
  const resultsEl = document.getElementById('mm-bench-results');
  const tableEl   = document.getElementById('mm-bench-table');
  resultsEl.style.display = '';
  renderBenchmarkTable(models.map(id => ({ modelId: id, state: 'running' })), results);

  for (let i = 0; i < models.length; i++) {
    const modelId = models[i];
    statusEl.textContent = `Running ${i + 1}/${models.length}: ${modelId}…`;

    try {
      const result = await benchmarkSingleModel(modelId, prompt, () => {
        // Update live display with partial results
        renderBenchmarkTable(
          models.map((id, j) => ({
            modelId: id,
            state: j < i ? 'done' : j === i ? 'running' : 'pending',
          })),
          results
        );
      });
      results.push({ ...result, state: 'done' });
    } catch (e) {
      results.push({ modelId, state: 'error', error: e.message });
    }

    renderBenchmarkTable(
      models.map((id, j) => ({
        modelId: id,
        state: j < i + 1 ? 'done' : j === i + 1 ? 'running' : 'pending',
      })),
      results
    );
  }

  const maxTok = Math.max(...results.filter(r => r.state === 'done').map(r => r.tokPerSec || 0), 0);
  document.getElementById('mm-bench-results-subtitle').textContent =
    `— ${models.length} model${models.length !== 1 ? 's' : ''}, ${Math.round(maxTok)} tok/s best`;
  statusEl.textContent = 'Done ✓';
  runBtn.disabled = false;
  benchmarkRunning = false;

  // Final sorted render
  renderBenchmarkTable(models.map(id => ({ modelId: id, state: 'done' })), results, true);
}

function renderBenchmarkTable(modelStates, results, sorted = false) {
  const tableEl = document.getElementById('mm-bench-table');
  const doneResults = results.filter(r => r.state === 'done' && r.tokPerSec != null);
  const maxTok = doneResults.length ? Math.max(...doneResults.map(r => r.tokPerSec)) : 1;

  // Sort by tok/s descending when final
  const orderedModels = sorted
    ? [...modelStates].sort((a, b) => {
        const ra = results.find(r => r.modelId === a.modelId);
        const rb = results.find(r => r.modelId === b.modelId);
        return ((rb?.tokPerSec || 0) - (ra?.tokPerSec || 0));
      })
    : modelStates;

  let html = `<div class="mm-bench-row mm-bench-header">
    <div>Model</div>
    <div style="text-align:right">Tok/s</div>
    <div style="text-align:right">TTFT</div>
    <div style="text-align:right">Total</div>
    <div></div>
  </div>`;

  orderedModels.forEach((ms, idx) => {
    const r    = results.find(r => r.modelId === ms.modelId);
    const rank = idx + 1;

    if (!r || ms.state === 'pending') {
      html += `<div class="mm-bench-row">
        <div class="mm-bench-cell-model">
          <span class="mm-bench-rank rank-n">#?</span>
          <span class="mm-bench-model-label">${ms.modelId}</span>
        </div>
        <div class="mm-bench-val" style="text-align:right;color:var(--muted)">—</div>
        <div class="mm-bench-val" style="text-align:right;color:var(--muted)">—</div>
        <div class="mm-bench-val" style="text-align:right;color:var(--muted)">—</div>
        <div class="mm-bench-bar-cell"></div>
      </div>`;
      return;
    }

    if (ms.state === 'running' || r.state === 'running') {
      html += `<div class="mm-bench-row mm-bench-running">
        <div class="mm-bench-cell-model">
          <div class="mm-bench-spinner"></div>
          <span class="mm-bench-model-label">${ms.modelId}</span>
        </div>
        <div class="mm-bench-val" style="text-align:right;color:var(--muted)">…</div>
        <div class="mm-bench-val" style="text-align:right;color:var(--muted)">…</div>
        <div class="mm-bench-val" style="text-align:right;color:var(--muted)">…</div>
        <div class="mm-bench-bar-cell"></div>
      </div>`;
      return;
    }

    if (r.state === 'error') {
      html += `<div class="mm-bench-row mm-bench-error">
        <div class="mm-bench-cell-model">
          <span class="mm-bench-rank rank-n">ERR</span>
          <span class="mm-bench-model-label">${ms.modelId}</span>
        </div>
        <div class="mm-bench-val" style="text-align:right;color:var(--orange)" title="${r.error}">fail</div>
        <div></div><div></div><div></div>
      </div>`;
      return;
    }

    const tps    = r.tokPerSec.toFixed(1);
    const pct    = maxTok > 0 ? (r.tokPerSec / maxTok) * 100 : 0;
    const ttftMs = r.ttft != null ? `${Math.round(r.ttft)}` : '—';
    const totMs  = `${(r.totalMs / 1000).toFixed(1)}`;
    const rankCls = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : 'rank-n';
    const valCls  = r.tokPerSec >= maxTok * 0.8 ? 'val-best' : r.tokPerSec >= maxTok * 0.4 ? 'val-good' : 'val-slow';

    html += `<div class="mm-bench-row">
      <div class="mm-bench-cell-model">
        <span class="mm-bench-rank ${rankCls}">#${rank}</span>
        <span class="mm-bench-model-label">${ms.modelId}</span>
      </div>
      <div class="mm-bench-val ${valCls}" style="text-align:right">${tps}<span class="mm-bench-val-unit">t/s</span></div>
      <div class="mm-bench-val" style="text-align:right">${ttftMs}<span class="mm-bench-val-unit">ms</span></div>
      <div class="mm-bench-val" style="text-align:right">${totMs}<span class="mm-bench-val-unit">s</span></div>
      <div class="mm-bench-bar-cell"><div class="mm-bench-bar-fill" style="width:${pct.toFixed(1)}%"></div></div>
    </div>`;
  });

  tableEl.innerHTML = html;
}

// ─────────────────────────────────────────────────────────────────────────────
// § SIDEBAR RESIZE
// ─────────────────────────────────────────────────────────────────────────────

function initSidebarResize() {
  const MIN_W = { left: 160, right: 200 };
  const MAX_W = { left: 420, right: 480 };
  const STORAGE_KEY = { left: 'llm_sidebar_left_w', right: 'llm_sidebar_right_w' };

  function applyWidth(side, px) {
    const el = document.querySelector(side === 'left' ? '.sidebar-left' : '.sidebar-right');
    if (!el) return;
    const clamped = Math.max(MIN_W[side], Math.min(MAX_W[side], px));
    el.style.width = `${clamped}px`;
    try { localStorage.setItem(STORAGE_KEY[side], clamped); } catch (_) {}
  }

  function restoreWidths() {
    ['left', 'right'].forEach(side => {
      const saved = parseInt(localStorage.getItem(STORAGE_KEY[side]), 10);
      if (saved) applyWidth(side, saved);
    });
  }

  function attachHandle(handleId, side) {
    const handle = document.getElementById(handleId);
    if (!handle) return;
    let startX = 0, startW = 0;

    handle.addEventListener('mousedown', e => {
      e.preventDefault();
      const sidebarEl = document.querySelector(side === 'left' ? '.sidebar-left' : '.sidebar-right');
      if (!sidebarEl) return;
      startX = e.clientX;
      startW = sidebarEl.offsetWidth;
      handle.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', e => {
      if (!handle.classList.contains('dragging')) return;
      const delta = side === 'left' ? e.clientX - startX : startX - e.clientX;
      applyWidth(side, startW + delta);
    });

    document.addEventListener('mouseup', () => {
      if (!handle.classList.contains('dragging')) return;
      handle.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    });

    // Double-click to reset to default
    handle.addEventListener('dblclick', () => {
      const defaults = { left: 220, right: 260 };
      applyWidth(side, defaults[side]);
    });
  }

  restoreWidths();
  attachHandle('resize-left', 'left');
  attachHandle('resize-right', 'right');
}

// ─────────────────────────────────────────────────────────────────────────────
// § BOOT
// ─────────────────────────────────────────────────────────────────────────────

init();
initSidebarResize();
