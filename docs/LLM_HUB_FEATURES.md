# LLM Hub — Features Checklist

> **Vision:** The best local-first AI workbench.
> **LM Studio** model management & hardware awareness + **OpenCode** code-first developer workflow + a **Linear/Vercel-inspired modern UI** that feels fast, focused, and professional.

**Legend:**
- `[x]` Shipped to `main`
- `[ ]` Not started
- `[-]` In progress / open PR
- 🔥 High priority — do next
- ⚡ Quick win (< 1 day)
- 🏗️ Large effort (> 3 days)

---

## 📦 Providers & Connectivity

### Local Providers
- [x] Ollama (local inference, pull/delete models)
- [x] LM Studio (local, OpenAI-compatible endpoint)
- [x] Custom OpenAI-compatible endpoint (vLLM, LocalAI, Koboldcpp, etc.)
- [x] Per-provider connection test button
- [x] 🔥 Provider health monitoring with auto-reconnect + exponential backoff
- [ ] Per-provider timeout and retry configuration

### Cloud Providers
- [x] OpenAI (GPT-4o, o3, o4-mini)
- [x] Anthropic Claude (Opus, Sonnet, Haiku)
- [x] Groq (ultra-fast inference)
- [x] OpenRouter (200+ models via one key)
- [x] Mistral AI
- [x] Together AI
- [x] Fireworks AI
- [x] Cohere
- [ ] AI21 / Perplexity / DeepSeek / Cerebras
- [x] ⚡ Provider usage cost estimator (token price × message count)

---

## 🖥️ Local Model Management (LM Studio DNA)

### Model Discovery & Download
- [x] List models from all connected providers in a unified dropdown
- [x] Model library browser — browse & pull 30+ popular models in-app
- [x] Model library search — live filter by name, category, org
- [x] Model pull / download with live progress bar (Ollama)
- [x] Model delete from disk (Ollama)
- [x] Model capability badges — vision, tools, code, long-context
- [x] Model family grouping in dropdown (Llama, Qwen, Mistral, etc.)
- [x] Favorite / pin models to top of selector
- [x] Model search in the main selector (filter as you type)
- [ ] 🔥 GGUF drag-and-drop import — load any `.gguf` directly without CLI
- [ ] 🔥 Model update notifications — alert when a newer version is available
- [x] ⚡ Model tags & friendly aliases — rename `llama3.2:3b` → `"Fast Llama"`
- [ ] Model comparison spec sheet — side-by-side table (ctx, quant, size, license)
- [ ] Auto-recommend models based on detected hardware at first launch

### Hardware Awareness
- [x] System RAM bar — live used / total in sidebar
- [x] GPU / VRAM monitoring — live bar per loaded model
- [x] Context window usage indicator — warns at > 75%
- [x] Hardware-fit indicators on model selector (🟢 fits / 🟡 tight / 🔴 too large)
- [x] "Fits your system" optgroup — models filtered by available RAM
- [x] Model benchmark runner — tokens/sec, TTFT, total time, ranked table
- [x] Cloud API cost estimation — per-message USD cost
- [ ] 🔥 Total GPU VRAM detection (nvidia-smi / rocm-smi integration)
- [ ] VRAM-aware load warning before pulling large models
- [ ] CPU / GPU temperature display (where OS exposes it)
- [ ] Performance dashboard — tokens/sec trend chart over time
- [ ] Response latency histogram per model

---

## 💬 Chat Interface

### Core Chat
- [x] Token streaming via SSE (real-time response display)
- [x] Stop generation mid-stream
- [x] Persistent chat history (localStorage, no server needed)
- [x] Auto-title conversations from first message
- [x] Message edit & regenerate
- [x] Message copy and delete
- [x] Collapsible long messages — auto-collapse > ~22 lines
- [x] Per-conversation system prompt (auto-save / restore on switch)
- [x] In-conversation message search (⌘F)
- [x] Message reactions — 👍 👎 persisted per message
- [x] Message timestamps — hover to peek, `T` key to pin permanently
- [ ] ⚡ Context window timeline — visualize which messages fit in active context
- [ ] Inline message threading / replies
- [ ] Inline diff view for edited messages
- [ ] Message bookmarks / starring

### Conversation Management
- [x] Conversation pinning
- [x] Conversation color labels
- [x] Conversation folders — organize chats into named groups
- [x] Conversation branching — fork from any message
- [x] Conversation title rename — double-click inline edit
- [x] Sidebar filter chips — filter by label / folder
- [x] Bulk conversation management — checkbox select, delete & export
- [x] Chat fuzzy search (⌘K)
- [ ] 🔥 🏗️ Multi-tab chat — tab bar, multiple conversations open simultaneously
- [ ] Conversation archive (hide from list without deleting)
- [ ] Smart conversation grouping by date / project

### Import & Export
- [x] Chat export — Markdown, JSON, standalone offline HTML
- [x] Backup & restore — all settings + conversations as single JSON
- [x] Import conversations — ChatGPT export format, LLM Hub backup
- [ ] ⚡ Notion / Obsidian export format
- [ ] Sync conversations across devices (E2E encrypted, opt-in)

---

## ⚙️ Model Parameters

- [x] Temperature, Max Tokens, Top-P, Top-K, Repeat Penalty, Frequency Penalty
- [x] Sampling presets — Precise / Balanced / Creative
- [x] Per-model parameter profiles — auto-save & restore per model
- [x] System prompt presets (save / load named presets)
- [x] Prompt templates with `{{variable}}` placeholder substitution
- [x] JSON mode — force `response_format: json_object`
- [x] JSON Schema mode — enforce structured output with editor + presets
- [x] Plan mode — model thinks step-by-step before responding
- [ ] Stop sequences configuration UI
- [ ] Context length override per conversation
- [ ] Seed control — reproducible outputs
- [ ] Grammar-constrained generation (GBNF / regex)

---

## 🤖 AI Agent & Tools

### Built-in Agent
- [x] Autonomous agent loop — up to 8 tool-call rounds
- [x] Built-in tools: `datetime`, `calculator`, `web_search`, `fetch_url`, `run_javascript`, `rag_search`
- [x] Live tool-call visualization — input → result → elapsed time
- [x] Tool enable / disable toggle per session
- [ ] 🔥 Shell command tool — opt-in, with confirmation prompt per execution
- [ ] 🔥 Custom tool builder UI — define name, JSON schema, handler URL from UI
- [ ] 🔥 Agent run history — step-by-step replay of past agent sessions
- [ ] Tool result caching — skip re-runs for identical inputs in a session
- [ ] Agent memory persistence across sessions (vector or key-value store)
- [ ] 🏗️ Sub-agent spawning — parallel task execution
- [ ] 🏗️ Agent graph visualization — node / edge view of the tool call chain

### MCP (Model Context Protocol)
- [x] MCP stdio client — spawn any external MCP server from config
- [x] Config hot-reload (MCP servers restart on config save)
- [ ] MCP server marketplace / discovery browser
- [ ] Browser automation via Playwright MCP
- [ ] Filesystem MCP — read/write local files with per-path permission grants

---

## 💻 Code-First Developer Workflow (OpenCode DNA)

### Code Display & Editing
- [x] Syntax highlighting — 14+ languages via Prism.js
- [x] Artifact rendering — HTML, SVG, JSX, TSX in sandboxed iframe
- [x] Live code editing inside artifact preview — edit + re-render inline
- [-] Code / text file attachment — drag-and-drop or click to attach `.js`, `.py`, `.ts`, etc. (PR #58)
- [ ] 🔥 🏗️ File tree sidebar — browse local files via MCP filesystem server
- [ ] 🔥 Diff viewer — before/after code comparison with syntax highlighting
- [ ] 🔥 Git integration — show diff, stage, commit, PR review in-app
- [ ] ⚡ Copy code → file save dialog (write directly to disk via MCP)
- [ ] Terminal pane — run shell commands inline, see output in chat
- [ ] Multi-language REPL — Python, JS sandbox execution
- [ ] Code lens — inline AI-powered suggestions in code blocks
- [ ] Linter / formatter auto-suggestions on code paste

### Multi-file Context
- [-] Single file attachment with language detection and line count badge (PR #58)
- [ ] 🔥 Multi-file context picker — select and attach multiple files at once
- [ ] Project context — attach an entire directory tree as context
- [ ] `.gitignore`-aware file picker (exclude build artifacts, node_modules)
- [ ] File diff as context — attach `git diff` output directly

---

## 📎 Attachments & Multimodal

- [x] Image attachments — paste (⌘V), drag-drop, file picker
- [x] Vision model support — llava, qwen2-vl, llama3.2-vision
- [x] PDF attachments — client-side text extraction via PDF.js
- [-] Code / text file attachments — `.js`, `.py`, `.ts`, `.md`, `.json`, etc. (PR #58)
- [x] Voice input — browser Web Speech API
- [x] Whisper server integration — local speech-to-text transcription
- [x] Text-to-speech output — 🔊 Read button, voice / rate / pitch controls
- [ ] ⚡ Audio file transcription by drag-and-drop
- [ ] Video frame extraction for vision models
- [ ] Screen capture / screenshot attach from clipboard (desktop app)

---

## 🔍 RAG / Knowledge Base

- [x] File upload and chunking — `.txt`, `.md`, `.json`, code files
- [x] Ollama embedding (`nomic-embed-text` by default)
- [x] Cosine-similarity vector search
- [x] Collection management — create, query, delete
- [x] Web page crawl — paste URL, auto-scrape + embed
- [x] PDF attachment — client-side extraction + embedding
- [x] RAG settings tab — embedding model, chunk size, top_k
- [ ] 🔥 GitHub repository indexing — clone + embed all repo files
- [ ] ⚡ Auto-inject relevant chunks into every message (toggle)
- [ ] Chunk preview and manual editing UI
- [ ] Hybrid search — keyword + vector (BM25)
- [ ] Multi-collection query — search across all collections at once
- [ ] Re-embedding on model change
- [ ] Knowledge base stats panel — total chunks, sources, last updated

---

## 🆚 Model Comparison

- [x] Side-by-side split-screen comparison — two models simultaneously
- [x] Parallel streaming to both models
- [x] Per-pane latency and token stats
- [x] Response quality grading — 👍 / 👎 with win counter
- [x] Word-level diff view between model responses
- [x] Save comparison as downloadable Markdown report
- [ ] 🔥 ⚡ A/B test mode — random model assignment, reveal after response
- [ ] 🏗️ Multi-model tournament — bracket-style 3+ model comparison
- [ ] Comparison history — browse and replay past comparison sessions

---

## 🎨 Modern UI (Linear / Vercel DNA)

### Design System
- [x] Dark / light themes with system-preference detection
- [x] Linear / Vercel-inspired design — Inter + JetBrains Mono fonts
- [x] Consistent design tokens — spacing, radius, shadow, color
- [x] Appearance settings — accent color, font size, chat density
- [x] Skeleton loading states — shimmer placeholders throughout
- [x] Animated micro-interactions — message fade-in, hover effects
- [ ] Theme editor — tweak individual color tokens in-app
- [ ] Custom accent colors beyond preset palette
- [ ] High-contrast accessibility mode

### Navigation & Productivity
- [x] Command palette (⌘P) — fuzzy search all actions and conversations
- [x] Keyboard shortcuts with help modal (`?`)
- [x] Drag-to-resize left and right sidebars — persisted, double-click to reset
- [x] Full-screen focus mode — hide all sidebars (⌘⇧F)
- [x] Welcome screen with quick-action cards and keyboard hints
- [x] Onboarding wizard for first-time setup (provider config, model pull)
- [x] Notification / toast history panel
- [ ] 🔥 🏗️ Fully responsive mobile layout — hamburger nav, touch-friendly
- [ ] 🔥 🏗️ Multi-tab chat — tab bar, multiple conversations side-by-side
- [ ] Keyboard shortcut remapping
- [ ] Custom welcome screen configuration

### Notifications & Feedback
- [x] Toast notifications for all key actions
- [x] Toast / notification history panel
- [x] ⚡ Desktop notifications when a generation completes in a background tab (opt-in)
- [ ] Sound effects (opt-in) on message send / receive

---

## 🔒 Security & Privacy

- [x] Proxy binds to `127.0.0.1` by default — no LAN exposure without opt-in
- [x] SSRF protection on `fetch_url` tool
- [x] VM sandbox for `run_javascript` tool
- [x] CORS locked to localhost
- [x] API keys in localStorage only — never written to disk by the proxy
- [ ] ⚡ Per-session ephemeral API key (never persisted)
- [ ] Request / response logging toggle (opt-in, stored locally)
- [ ] Prompt injection warning detection
- [ ] Conversation data encryption at rest (opt-in, local key)
- [ ] Audit log of all tool / agent executions

---

## 🚀 Deployment & Distribution

- [x] Single Node.js file — `node proxy.js` starts in < 1 second
- [x] Zero npm dependencies (uses Node.js built-ins only)
- [x] `.env.example` with all environment variables documented
- [x] `DEPLOY.md` — quick start, Docker, rollback procedure
- [x] `Dockerfile` — multi-stage, non-root user, `/health` HEALTHCHECK
- [x] `docker-compose.yml` — LLM Hub + Ollama in a single stack
- [x] Env var overrides — PORT, HOST, STORAGE_DIR, OLLAMA_HOST/PORT
- [x] `GET /health` endpoint with provider status JSON
- [ ] 🔥 ⚡ Published Docker image on Docker Hub / GHCR
- [ ] ⚡ Reverse proxy config examples (nginx, Caddy, Traefik)
- [ ] `npx llm-hub` zero-install launcher
- [ ] 🏗️ Desktop app — Electron or Tauri wrapper
- [ ] Homebrew / Winget / AUR package formula
- [ ] One-click cloud deploy buttons (Railway, Render, Fly.io)

---

## 🛠️ Developer & Integration

- [x] SSE streaming API (`/v1/chat`)
- [x] OpenAI-compatible passthrough (`/v1/chat/completions`)
- [x] MCP stdio client
- [x] OpenAPI 3.0 spec at `/v1/openapi.json` + Swagger UI at `/v1/docs`
- [x] Node.js syntax validation CI (v18, v20, v22)
- [x] Unit tests — 47 tests for RagEngine, ToolRegistry, SSRF guard
- [ ] 🔥 Integration tests for all HTTP endpoints
- [ ] End-to-end tests with Playwright
- [ ] VS Code extension — send selected code to LLM Hub
- [ ] CLI batch mode — `echo "prompt" | llm-hub --model llama3`
- [ ] Plugin system — load `.js` modules at startup

---

## 📊 Progress Snapshot

| Area | ✅ Done | ⬜ To Do |
|------|---------|----------|
| Providers & Connectivity | 10 | 4 |
| Local Model Management | 9 | 6 |
| Hardware Awareness | 7 | 5 |
| Chat Interface | 16 | 8 |
| Model Parameters | 8 | 5 |
| AI Agent & Tools | 5 | 9 |
| Code-First Workflow | 4 | 11 |
| Attachments & Multimodal | 7 | 4 |
| RAG / Knowledge Base | 7 | 7 |
| Model Comparison | 6 | 3 |
| Modern UI | 12 | 8 |
| Security & Privacy | 5 | 5 |
| Deployment | 8 | 6 |
| Developer / Testing | 5 | 4 |
| **Total** | **~119** | **~85** |

**~58% complete. Top priorities to close the gap:**
1. 🔥 Code-first workflow (file tree, multi-file context, diff viewer, git integration)
2. 🔥 Mobile-responsive layout & multi-tab UI
3. 🔥 Agent tooling (shell tool, tool builder, run history)
4. 🔥 Provider health monitoring + more cloud providers
5. 🔥 Published Docker image + integration / E2E tests

---

*Last updated: 2026-07-02. This is the single canonical feature checklist for the project — previous parallel checklists (`APP_TODO.md`, `APP_ROADMAP.md`, `FEATURES.md`, `MASTER_CHECKLIST.md`, etc.) have been consolidated into this file and removed to avoid drift.*
