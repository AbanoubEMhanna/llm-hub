# LLM Hub — App Feature TODO
## Vision: LM Studio + OpenCode + Modern UI

> **Goal:** The best local-first AI workbench.
> Combine the **model management & hardware awareness** of LM Studio,
> the **code-first developer workflow** of OpenCode, and a
> **Linear/Vercel-inspired modern UI** that feels fast, focused, and professional.
>
> **Legend:**
> - `[x]` Shipped
> - `[ ]` Not started
> - `[-]` In progress
> - 🔥 High priority (do next)
> - ⚡ Quick win (< 1 day)
> - 🏗️ Large effort (> 3 days)

---

## 🖥️ LM Studio DNA — Local Model Management

### Model Discovery & Download
- [x] List models from all connected providers (Ollama, LM Studio, cloud)
- [x] Model library browser — browse & pull 30+ popular models in-app
- [x] Model library search — live filter by name, category, org
- [x] Model pull / download with live progress bar (Ollama)
- [x] Model delete from disk (Ollama)
- [x] Model capability badges — vision, tools, code, long-context
- [x] Model family grouping in dropdown (Llama 3, Qwen, Mistral…)
- [x] Favorite / pin models to top of selector
- [x] Model search in the main selector (filter as you type)
- [ ] 🔥 GGUF drag-and-drop import — load any `.gguf` directly (no Ollama CLI needed)
- [ ] 🔥 Model update notifications — alert when a newer version exists on the registry
- [ ] ⚡ Model tags & friendly aliases — rename `llama3.2:3b` → `"Fast Llama"`
- [ ] Model comparison spec sheet — side-by-side parameter table (ctx, quant, size, license)
- [ ] Auto-recommend models based on hardware profile at first launch

### Hardware Awareness
- [x] System RAM bar — live used / total in sidebar
- [x] GPU / VRAM monitoring — live bar per loaded model
- [x] Context window usage indicator — warns at > 75%
- [x] Hardware-fit indicators on model selector (🟢 fits / 🟡 tight / 🔴 too large)
- [x] "Fits your system" optgroup — models filtered by free RAM
- [x] Model benchmark runner — tokens/sec, TTFT, total time, ranked table
- [x] Hardware-aware model suggestions
- [ ] 🔥 Total GPU VRAM detection (nvidia-smi / rocm-smi integration)
- [ ] VRAM-aware load warning before pulling large models
- [ ] CPU / GPU temperature display (where OS exposes it)
- [ ] Performance dashboard — tokens/sec trend chart over time
- [ ] Response latency histogram per model

### Providers
- [x] Ollama (local)
- [x] LM Studio (local, OpenAI-compatible)
- [x] OpenAI (GPT-4o, o3, o4-mini)
- [x] Anthropic Claude (Opus, Sonnet, Haiku)
- [x] Groq (ultra-fast inference)
- [x] OpenRouter (200+ models via one key)
- [x] Custom OpenAI-compatible endpoint (vLLM, LocalAI, Koboldcpp…)
- [x] Per-provider connection test button
- [x] Mistral AI provider
- [x] Together AI provider
- [x] Fireworks AI provider
- [x] Cohere provider
- [ ] 🔥 Provider health monitoring with auto-reconnect + retry backoff
- [ ] Per-provider timeout and retry configuration
- [ ] AI21 / Perplexity / Deepseek provider
- [ ] Provider usage cost estimator (token price × count)

---

## 💻 OpenCode DNA — Code-First Developer Workflow

### Code Editing & Context
- [x] Syntax highlighting — 14 languages via Prism.js
- [x] Artifact rendering — HTML, SVG, JSX, TSX in sandboxed iframe
- [x] Live code editing inside artifact preview — edit + re-render inline
- [x] JSON mode — force `response_format: json_object`
- [x] JSON Schema mode — enforce structured output with editor + presets
- [ ] 🔥 🏗️ File tree sidebar — browse local files via MCP filesystem server
- [ ] 🔥 Multi-file context — select and attach multiple files as context
- [ ] 🔥 Diff viewer — before/after code comparison with syntax highlighting
- [ ] 🔥 Git integration — show diff, stage, commit, PR review in-app
- [ ] ⚡ Copy code → file save dialog (write directly to disk via MCP)
- [ ] Terminal pane — run shell commands inline, see output in chat
- [ ] Multi-language REPL — Python, JS sandbox
- [ ] Code lens — inline AI-powered suggestions in code blocks
- [ ] Linter / formatter auto-suggestions on code paste

### Agent & Tools
- [x] Autonomous agent loop — up to 8 tool-call rounds
- [x] Built-in tools: `datetime`, `calculator`, `web_search`, `fetch_url`, `run_javascript`, `rag_search`
- [x] Live tool-call visualization — input → result → elapsed time
- [x] MCP stdio client — spawn any external MCP server
- [x] Tool enable/disable toggle per session
- [ ] 🔥 Shell command tool — opt-in, confirmation prompt per execution
- [ ] 🔥 Custom tool builder UI — define name, schema, handler URL from UI
- [ ] 🔥 Agent run history — step-by-step replay of past agent sessions
- [ ] 🏗️ Sub-agent spawning — parallel task execution
- [ ] 🏗️ Agent graph visualization — node/edge view of tool call chain
- [ ] Tool result caching — skip re-runs for identical inputs in a session
- [ ] MCP server marketplace / discovery browser
- [ ] Agent memory persistence across sessions (vector or key-value store)

---

## 🎨 Modern UI DNA — Linear / Vercel-Inspired

### Core Design
- [x] Dark / light themes with system-preference detection
- [x] Linear/Vercel-inspired design — Inter + JetBrains Mono fonts
- [x] Command palette (⌘P) — fuzzy search all actions and conversations
- [x] Keyboard shortcuts with help modal (`?`)
- [x] Drag-to-resize left and right sidebars — persisted, dblclick to reset
- [x] Skeleton loading states — shimmer placeholders
- [x] Animated micro-interactions — message fade-in, hover effects
- [x] Full-screen focus mode — hide all sidebars (⌘⇧F)
- [x] Appearance settings — accent color, font size, chat density
- [x] Welcome screen with quick-action cards and keyboard hints
- [x] Onboarding wizard for first-time setup (provider config, model pull)
- [x] Notification / toast history panel
- [ ] 🔥 🏗️ Fully responsive mobile layout — hamburger nav, touch-friendly
- [ ] 🔥 🏗️ Multi-tab chat — tab bar, multiple conversations side-by-side
- [ ] Keyboard shortcut remapping
- [ ] Custom welcome screen configuration
- [ ] Theme editor — tweak individual color tokens in-app

### Chat Experience
- [x] Token streaming via SSE
- [x] Stop generation mid-stream
- [x] Persistent chat history (localStorage)
- [x] Chat export — Markdown, JSON, standalone offline HTML
- [x] Message edit & regenerate
- [x] Message copy and delete
- [x] Message reactions — 👍 👎, persisted
- [x] Conversation pinning and color labels
- [x] Conversation folders
- [x] Conversation branching — fork from any message
- [x] Auto-title from first message
- [x] Chat fuzzy search (⌘K)
- [x] Conversation title rename — double-click inline
- [x] Collapsible long messages — auto-collapse > ~22 lines
- [x] Per-conversation system prompt
- [x] In-conversation message search (⌘F)
- [x] Bulk conversation management — select, delete, export
- [x] Message timestamps — hover to peek, T key to pin permanently
- [x] Backup & restore — all settings + conversations as single JSON
- [x] Import conversations — ChatGPT export, LLM Hub backup
- [ ] 🔥 Multi-tab chat UI — multiple conversations open simultaneously
- [ ] ⚡ Context window timeline — visualize which messages fit in context
- [ ] Inline message threading / replies
- [ ] Inline diff view for edited messages
- [ ] Message bookmarks / starring

### Model Comparison
- [x] Side-by-side split-screen comparison — two models simultaneously
- [x] Parallel streaming to both models
- [x] Per-pane latency and token stats
- [x] Response quality grading — 👍/👎 with win counter
- [x] Word-level diff view between model responses
- [x] Save comparison as downloadable Markdown report
- [ ] 🔥 ⚡ A/B test mode — random model assignment, reveal after response
- [ ] 🏗️ Multi-model tournament — bracket-style 3+ model comparison
- [ ] Comparison history — browse past sessions

---

## 🗄️ RAG / Knowledge Base

- [x] File upload and chunking — `.txt`, `.md`, `.json`, code files
- [x] Ollama embedding (`nomic-embed-text` by default)
- [x] Cosine-similarity vector search
- [x] Collection management — create, query, delete
- [x] Web page crawl — paste URL, auto-scrape + embed
- [x] PDF attachment — client-side extraction via PDF.js
- [x] RAG settings tab — embedding model, chunk size, top_k from UI
- [ ] 🔥 GitHub repository indexing — clone + embed all files
- [ ] ⚡ Auto-inject relevant chunks into every message (toggle)
- [ ] Chunk preview and manual editing UI
- [ ] Hybrid search — keyword + vector (BM25)
- [ ] Multi-collection query — search across all collections at once
- [ ] Re-embedding on embedding model change
- [ ] Knowledge base stats panel — total chunks, sources, last updated

---

## 🎙️ Voice & Multimodal

- [x] Image attachments — paste (⌘V), drag-drop, file picker
- [x] Vision model support — llava, qwen2-vl, llama3.2-vision
- [x] Voice input via browser Web Speech API
- [x] Whisper server integration — local transcription
- [x] Text-to-speech output — 🔊 Read button, voice/rate/pitch controls
- [x] PDF attachments — client-side extraction
- [ ] ⚡ Audio file transcription by drag-and-drop
- [ ] Video frame extraction for vision models
- [ ] Screen capture / screenshot attach from clipboard

---

## ⚙️ Settings & Configuration

- [x] General tab — proxy URL, storage stats, startup options
- [x] Raw JSON config editor with hot-reload
- [x] Backup & restore tab
- [x] Appearance tab — accent color, font size, chat density
- [x] Providers tab — API keys + custom servers + test buttons
- [x] Voice tab — TTS voice, speed, pitch controls
- [x] Tools tab — enable/disable individual built-in tools from UI
- [x] RAG tab — embedding model, chunk size, top_k from UI
- [ ] Per-workspace configuration profiles
- [ ] Cloud sync of settings (opt-in, E2E encrypted)
- [ ] Import/export settings only (separate from conversation backup)

---

## 🔒 Security & Privacy

- [x] Proxy binds to `127.0.0.1` by default (secure by default)
- [x] SSRF protection on `fetch_url` tool
- [x] VM sandbox for `run_javascript` tool
- [x] CORS locked to localhost
- [x] API keys in localStorage only — never written to disk
- [ ] Per-session ephemeral API key option
- [ ] Request / response logging toggle (opt-in, stored locally)
- [ ] Prompt injection warning detection
- [ ] Conversation data encryption at rest (opt-in)
- [ ] Audit log of all tool executions

---

## 🚀 Deployment & Distribution

- [x] Single Node.js file — `node proxy.js` starts in < 1 second
- [x] Zero npm dependencies (uses Node built-ins only)
- [x] `.env.example` with all environment variables documented
- [x] `DEPLOY.md` — quick start, Docker, rollback procedure
- [x] `Dockerfile` — multi-stage, non-root user, `/health` HEALTHCHECK
- [x] `docker-compose.yml` — LLM Hub + Ollama in a single stack
- [x] Env var overrides — PORT, HOST, STORAGE_DIR, OLLAMA_HOST/PORT
- [x] `GET /health` endpoint with provider status JSON
- [ ] 🔥 ⚡ Published Docker image on Docker Hub / GHCR
- [ ] ⚡ Reverse proxy config examples (nginx, Caddy, Traefik)
- [ ] `npx llm-hub` zero-install launcher
- [ ] Desktop app — Electron or Tauri wrapper
- [ ] Homebrew / Winget / AUR formula

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

| Area | ✅ Done | ⬜ Remaining |
|------|---------|-------------|
| Local Model Management | 9 | 5 |
| Hardware Awareness | 7 | 5 |
| Providers | 12 | 4 |
| Code & Context | 5 | 9 |
| Agent & Tools | 5 | 7 |
| Modern UI | 12 | 7 |
| Chat Experience | 19 | 5 |
| Model Comparison | 6 | 3 |
| RAG / Knowledge | 7 | 7 |
| Voice & Multimodal | 6 | 3 |
| Settings | 8 | 3 |
| Security | 5 | 5 |
| Deployment | 8 | 5 |
| Developer / Testing | 5 | 5 |
| **Total** | **~119** | **~78** |

**~60% complete. Top 5 areas to close the gap:**
1. 🔥 Code-first workflow (file tree, multi-file context, diff viewer, git integration)
2. 🔥 Mobile-responsive layout
3. 🔥 Agent tooling (shell tool, tool builder, run history)
4. 🔥 Provider health monitoring + more cloud providers
5. 🔥 Published Docker image + integration tests

---

*Last updated: 2026-06-27. Canonical source: `docs/APP_TODO.md`.*
