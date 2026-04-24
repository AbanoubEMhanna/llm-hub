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

let currentConvId        = null;
let selectedModel        = null;
let availableModels      = [];
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
  initPresets();
  initDragDrop();
  initHotkeys();
  renderConvList();
  if (!conversations.length) newConversation();
  else loadConversation(conversations[0].id);
  updateInputTokenCount();
  setInterval(checkHealth, 30000);
}

async function checkHealth() {
  try {
    const res  = await fetch(`${PROXY}/health`);
    const data = await res.json();
    setStatus('b-ollama',   data.providers?.ollama   === 'online');
    setStatus('b-lmstudio', data.providers?.lmstudio === 'online');
    document.getElementById('proxy-alert').style.display = 'none';
  } catch {
    document.getElementById('proxy-alert').style.display = 'block';
  }
}
function setStatus(id, online) {
  const el = document.getElementById(id);
  if (el) el.className = `badge ${online ? 'online' : 'offline'}`;
}

async function loadModels() {
  try {
    const res  = await fetch(`${PROXY}/v1/models`);
    const data = await res.json();
    availableModels = data.data || [];
    fillModelSelect(document.getElementById('model-select'));
    fillModelSelect(document.getElementById('compare-model-a'));
    fillModelSelect(document.getElementById('compare-model-b'));
    document.getElementById('model-loading').style.display = 'none';
    document.getElementById('model-select').style.display  = 'block';
  } catch {
    document.getElementById('model-loading').innerHTML =
      '<span style="color:var(--orange)">Cannot reach proxy</span>';
  }
}

function fillModelSelect(sel) {
  if (!sel) return;
  sel.innerHTML = '<option value="">— select model —</option>';
  const groups = {};
  for (const m of availableModels) {
    (groups[m.owned_by] = groups[m.owned_by] || []).push(m);
  }
  for (const [p, models] of Object.entries(groups)) {
    const og = document.createElement('optgroup');
    og.label = p === 'ollama' ? '🟠 Ollama' : '🟣 LM Studio';
    for (const m of models) {
      const o = document.createElement('option');
      o.value = m.id;
      o.text  = m.id.replace(/^(ollama|lmstudio)\//, '');
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
    if (!data.tools?.length) {
      list.innerHTML = '<div style="color:var(--muted);font-size:11px;font-family:var(--mono)">No tools loaded</div>';
      return;
    }
    list.innerHTML = data.tools.map(t => `
      <div class="tool-entry" title="${escHtml(t.desc || '')}">
        🔧 ${escHtml(t.name)}
        <span class="tsrc ${t.source === 'built-in' ? 'built-in' : 'mcp'}">${escHtml(t.source)}</span>
      </div>`).join('');
  } catch { /* */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// § MODEL SELECTION
// ─────────────────────────────────────────────────────────────────────────────

function onModelChange() {
  selectedModel = document.getElementById('model-select').value || null;
  updateModelHeader();
  document.getElementById('send-btn').disabled = !selectedModel || isLoading;
  updateInputTokenCount();
}

function updateModelHeader() {
  const tag = document.getElementById('chat-model-tag');
  if (!selectedModel) {
    tag.innerHTML = '<span style="color:var(--muted);font-family:var(--mono);font-size:12px">No model selected</span>';
    return;
  }
  const name = selectedModel.replace(/^(ollama|lmstudio)\//, '');
  const prov = selectedModel.startsWith('ollama/') ? 'ollama'
             : selectedModel.startsWith('lmstudio/') ? 'lmstudio' : null;
  tag.innerHTML =
    `<span style="font-weight:500">${escHtml(name)}</span>` +
    `<span class="provider-pill" data-p="${prov}">${prov}</span>`;
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
    <div class="conv-item ${c.id === currentConvId ? 'active' : ''}" data-id="${c.id}"
         onclick="loadConversation('${c.id}')">
      <div class="conv-title">${c.pinned ? '📌 ' : ''}${escHtml(c.title)}</div>
      <div class="conv-meta">${c.messages.length} msgs · ${timeAgo(c.ts)}</div>
      <div style="position:absolute;right:4px;top:6px;display:flex;gap:2px">
        <button class="conv-del" onclick="togglePin('${c.id}',event)" title="${c.pinned ? 'Unpin' : 'Pin'}" style="opacity:${c.pinned ? '.9' : ''}">📌</button>
        <button class="conv-del" onclick="deleteConversation('${c.id}',event)" title="Delete">×</button>
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
  if (loading) { btn.classList.add('stopping');    btn.innerHTML = '■'; btn.disabled = false; }
  else         { btn.classList.remove('stopping'); btn.innerHTML = '▶'; btn.disabled = !selectedModel; }
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
  const sysPrompt = document.getElementById('sys-input').value.trim();
  const apiMsgs   = sysPrompt
    ? [{ role: 'system', content: sysPrompt }, ...conv.messages]
    : [...conv.messages];

  const useTools = document.getElementById('tools-toggle').classList.contains('on');
  const temp     = parseFloat(document.getElementById('temp-slider').value);
  const maxTok   = parseInt(document.getElementById('max-tokens').value) || 2048;

  setLoadingState(true);

  const assistantWrap  = createAssistantWrap();
  const bubble         = assistantWrap.querySelector('.bubble');
  bubble.innerHTML     = '<div class="typing"><span></span><span></span><span></span></div>';

  activeAbortController = new AbortController();
  let fullText = '';
  let cleared  = false;
  let textDiv  = null;
  const toolEls = {};

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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: selectedModel, messages: apiMsgs,
        temperature: temp, max_tokens: maxTok, use_tools: useTools,
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
            ensureCleared();
            fullText += evt.delta;
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
            updateStats(evt);
            conv.messages.push({ role: 'assistant', content: fullText });
            saveConvs();
            reRenderLastAssistant(conv, fullText);
          } else if (evt.type === 'error') {
            bubble.innerHTML = `<span style="color:var(--orange)">❌ ${escHtml(evt.message)}</span>`;
          }
        }
      }
    }
  } catch (e) {
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
      <div class="empty" id="empty-state">
        <div class="empty-icon">⚡</div>
        <div class="empty-title">New conversation</div>
        <div class="empty-sub">Select a model and start chatting</div>
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
      container.appendChild(buildAssistantWrap(i, m.content || '', m.stopped));
    }
  });
  highlightNewCode();
  scrollBottom();
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
}

function buildAssistantWrap(idx, content, stopped = false) {
  const wrap = document.createElement('div');
  wrap.className = 'msg-wrap';
  const name = selectedModel?.replace(/^(ollama|lmstudio)\//, '') || '';
  wrap.innerHTML = `
    <div class="msg assistant">
      <div class="avatar">🤖</div>
      <div class="bubble">${renderMarkdown(content)}${stopped ? '<div class="stopped-marker">⏹ Stopped</div>' : ''}</div>
    </div>
    <div class="msg-meta"><span>${escHtml(name)}</span></div>
    ${idx >= 0 ? `<div class="msg-actions">
      <button onclick="regenerateMessage(${idx})" title="Regenerate (⌘R)">🔄 Regenerate</button>
      <button onclick="continueMessage(${idx})" title="Continue">▶ Continue</button>
      <button onclick="copyMessage(${idx})" title="Copy">📋 Copy</button>
      <button class="danger" onclick="deleteMessage(${idx})" title="Delete">🗑 Delete</button>
    </div>` : ''}`;
  enhanceCodeBlocks(wrap);
  return wrap;
}

function createAssistantWrap() {
  const container = document.getElementById('messages');
  const wrap = document.createElement('div');
  wrap.className = 'msg-wrap';
  const name = selectedModel?.replace(/^(ollama|lmstudio)\//, '') || '';
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
  document.getElementById('stat-time').textContent   = elapsed ? `${elapsed}ms` : '—';

  const ctxLimit = 8192;
  const used = (prompt_tokens || 0) + (completion_tokens || 0);
  const pct  = Math.round((used / ctxLimit) * 100);
  document.getElementById('stat-ctx').textContent   = `${used} / ${ctxLimit} (${pct}%)`;
  document.getElementById('stat-ctx-wrap').classList.toggle('warn', pct > 75);
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

// ─────────────────────────────────────────────────────────────────────────────
// § MARKDOWN + HIGHLIGHTING + ARTIFACTS
// ─────────────────────────────────────────────────────────────────────────────

function renderMarkdown(text) {
  if (!text) return '';
  let t = escHtml(text);
  t = t.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const L = (lang || '').toLowerCase();
    return `<pre data-lang="${L}"><button class="copy-code-btn" onclick="copyCodeBtn(this)">Copy</button><code class="language-${L || 'plaintext'}">${code.trim()}</code></pre>`;
  });
  t = t.replace(/`([^`\n]+)`/g, '<code>$1</code>');
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  t = t.replace(/\*(.+?)\*/g, '<em>$1</em>');
  t = t.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  t = t.replace(/^## (.+)$/gm,  '<h2>$1</h2>');
  t = t.replace(/^# (.+)$/gm,   '<h1>$1</h1>');
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" style="color:var(--accent)">$1</a>');
  t = t.replace(/(<pre[\s\S]*?<\/pre>)|\n/g, (m, pre) => pre || '<br/>');
  return t;
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
        <span class="rag-meta">${c.chunkCount || 0} ch</span>
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

// ─────────────────────────────────────────────────────────────────────────────
// § COMPARE MODE
// ─────────────────────────────────────────────────────────────────────────────

function toggleCompareMode() {
  compareMode = !compareMode;
  document.getElementById('compare-btn').classList.toggle('active', compareMode);
  document.getElementById('chat-area-single').style.display = compareMode ? 'none' : 'flex';
  document.getElementById('compare-area').style.display     = compareMode ? 'flex' : 'none';
  if (compareMode) {
    document.getElementById('compare-msgs-a').innerHTML =
      '<div class="empty"><div class="empty-icon">⚖️</div><div class="empty-title">Pick left model ↑</div></div>';
    document.getElementById('compare-msgs-b').innerHTML =
      '<div class="empty"><div class="empty-icon">⚖️</div><div class="empty-title">Pick right model ↑</div></div>';
  }
}

function onCompareModelChange() {
  compareModelA = document.getElementById('compare-model-a').value || null;
  compareModelB = document.getElementById('compare-model-b').value || null;
}

async function sendCompare() {
  if (!compareModelA || !compareModelB) return toast('Pick both models', 'error');
  const input = document.getElementById('msg-input');
  const text  = input.value.trim();
  if (!text) return;
  input.value = '';
  autoResize(input);

  const paneA = document.getElementById('compare-msgs-a');
  const paneB = document.getElementById('compare-msgs-b');

  for (const pane of [paneA, paneB]) {
    if (pane.querySelector('.empty')) pane.innerHTML = '';
    const u = document.createElement('div');
    u.className = 'msg-wrap';
    u.innerHTML = `<div class="msg user"><div class="avatar">👤</div><div class="bubble">${renderMarkdown(text)}</div></div>`;
    pane.appendChild(u);
  }

  setLoadingState(true);
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model, messages: [{ role: 'user', content: text }],
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
            }
          }
        }
      }
    } catch (e) {
      if (e.name !== 'AbortError') bubble.innerHTML = `<span style="color:var(--orange)">❌ ${escHtml(e.message)}</span>`;
      else if (full) bubble.innerHTML = renderMarkdown(full) + '<div class="stopped-marker">⏹ Stopped</div>';
    }
    compareActiveCount--;
    if (compareActiveCount <= 0) setLoadingState(false);
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

    if (!meta) return;

    if (e.key === 'k' || e.key === 'K') { e.preventDefault(); openSearch(); return; }
    if (e.key === 'j' || e.key === 'J') { e.preventDefault(); newConversation(); return; }

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
// § BOOT
// ─────────────────────────────────────────────────────────────────────────────

init();
