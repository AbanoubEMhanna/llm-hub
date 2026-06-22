# LLM Hub — Master Feature TODO

> **Vision:** The best local-first AI workbench — combining the model management & hardware awareness of **LM Studio**, the code-first developer workflow of **OpenCode**, and the polished feel of **Linear / Vercel**.
>
> **Legend:** `[x]` Done · `[ ]` Todo · `[~]` In progress / open PR · 🔥 High priority · ⚡ Quick win

---

## 1. Core Infrastructure & Providers

- [x] Ollama provider — auto-detect local server on startup
- [x] LM Studio provider — OpenAI-compatible endpoint
- [x] OpenAI (GPT-4o, o3, o4-mini, etc.)
- [x] Anthropic Claude (Opus, Sonnet, Haiku) with format conversion
- [x] Groq — ultra-fast inference
- [x] OpenRouter — 200+ models via one key
- [x] Custom OpenAI-compatible endpoint (vLLM, LocalAI, Koboldcpp, etc.)
- [x] Unified model dropdown across all providers
- [x] OpenAI-compatible `/v1/chat/completions` passthrough
- [x] Proxy binds to `127.0.0.1` by default (secure)
- [x] API key management — localStorage only, never written to disk
- [x] Per-provider connection test button
- [ ] 🔥 Mistral / Together / Fireworks / Cohere providers
- [ ] Provider health monitoring with auto-reconnect
- [ ] Per-provider timeout and retry configuration
- [ ] WebSocket streaming alternative to SSE
- [ ] `npx local-llm-hub` zero-install launcher

---

## 2. Model Management *(LM Studio DNA)*

- [x] Model listing from all connected providers
- [x] Running model detection — shows which model is loaded in RAM/VRAM
- [x] Model metadata panel — size, params, context length, quantization
- [x] Model loading banner with live progress
- [x] Model pull / download with live progress bar (Ollama)
- [x] Model delete from disk (Ollama)
- [x] Model capability badges — vision, tools, code, long-context
- [x] Model family grouping in dropdown (Llama 3, Qwen, Mistral…)
- [x] Model library browser — browse & pull 30+ popular models in-app
- [x] Model library search — live filter by name, category, org
- [x] Per-model parameter profiles — auto-save temperature + max tokens
- [x] Real-time tokens/sec counter during generation
- [x] Cloud provider cost estimation — per-response USD display
- [x] Session cost accumulator — running total with reset button
- [x] Model benchmark runner — tokens/sec, TTFT, total time; ranked table
- [x] Favorite / pin models to top of selector (★ Pinned group)
- [x] Hardware-aware model suggestions — 🟢/🟡/🔴 fit indicators
- [x] "Fits your system" optgroup — auto-populated with models that fit in free RAM
- [ ] 🔥 GGUF file drag-and-drop import (load any GGUF directly)
- [ ] Model update notifications — alert when newer version available
- [ ] Performance charts — tokens/sec over time per model
- [ ] Model comparison spec sheet (side-by-side table)
- [ ] Recommended model suggestions per task type (code, chat, vision)

---

## 3. Hardware Awareness *(LM Studio DNA)*

- [x] System RAM usage bar — live used/total display
- [x] GPU / VRAM monitoring — live bar per loaded model
- [x] Live VRAM per loaded model (from Ollama `/api/ps`)
- [x] Real-time tokens/sec counter
- [x] Context window usage indicator — warns at >75%
- [x] Session cost accumulator
- [x] Hardware-fit indicators on model selector (🟢/🟡/🔴)
- [x] "Fits your system" optgroup in model selector
- [ ] 🔥 Total GPU VRAM detection (nvidia-smi / rocm-smi integration)
- [ ] Response latency histogram per model
- [ ] Performance dashboard — tokens/sec charts over time
- [ ] CPU / GPU temperature display (where available)
- [ ] VRAM-aware load warning before pulling large models

---

## 4. Chat & Conversation

- [x] Token streaming via SSE
- [x] Stop generation mid-stream
- [x] Persistent chat history (localStorage)
- [x] Chat export — Markdown, JSON, standalone offline HTML
- [x] Message edit & regenerate
- [x] Message copy and delete
- [x] Continue generation
- [x] Message reactions — 👍 👎 RLHF-style, persisted
- [x] Conversation pinning
- [x] Auto-title from first message
- [x] Chat fuzzy search (⌘K)
- [x] Conversation title rename — double-click inline
- [x] Collapsible long messages — auto-collapse > ~22 lines
- [x] Per-conversation system prompt
- [x] In-conversation message search (⌘F)
- [x] Conversation color labels — with sidebar filter
- [x] Conversation folders
- [x] Conversation branching — fork from any message
- [x] Backup & restore — all settings + conversations as single JSON
- [x] Import conversations — ChatGPT export, LLM Hub backup
- [x] Bulk conversation management — select, delete, export
- [x] Message timestamps — hover to peek, T key to pin permanently
- [ ] 🔥 Multi-tab chat — multiple conversations side-by-side
- [ ] Context window timeline — visualize which messages fit in context
- [ ] Inline message threading / replies
- [ ] Inline diff view for edited messages

---

## 5. Agent & Tools *(OpenCode DNA)*

- [x] Autonomous agent loop — up to 8 tool-call rounds
- [x] Built-in tools: `datetime`, `calculator`, `web_search`, `fetch_url`, `run_javascript`, `rag_search`
- [x] Live tool-call visualization — input → result → elapsed time
- [x] MCP stdio client — spawn any external MCP server
- [x] Tool enable/disable toggle per session
- [ ] 🔥 Shell command tool — opt-in, confirmation prompt per execution
- [ ] 🔥 Custom tool builder UI — define name, schema, handler URL from UI
- [ ] 🔥 Agent run history — step-by-step replay of past agent sessions
- [ ] Tool result caching — skip re-runs for identical inputs in a session
- [ ] MCP server marketplace / discovery browser
- [ ] Agent memory persistence across sessions (long-term notes store)
- [ ] Sub-agent spawning — parallel task execution
- [ ] Browser automation via Playwright MCP
- [ ] Agent graph visualization — node/edge view of tool call chain

---

## 6. Code Features *(OpenCode DNA)*

- [x] Syntax highlighting — 14 languages via Prism.js
- [x] Artifact rendering — HTML, SVG, JSX, TSX in sandboxed iframe
- [x] Prompt templates with `{{variable}}` placeholders
- [x] Live code editing inside artifact preview — edit + re-render inline
- [x] JSON mode — force `response_format: json_object`
- [x] JSON Schema mode — enforce output structure with editor + presets
- [ ] 🔥 File tree sidebar — browse local files via MCP filesystem server
- [ ] 🔥 Multi-file context — select and attach multiple files as context
- [ ] 🔥 Git integration — show diff, stage, commit, PR review workflow
- [ ] 🔥 Diff viewer — before/after code comparison with syntax highlighting
- [ ] Terminal pane — run shell commands inline, see output in chat
- [ ] Copy code → file save dialog (write directly to disk via MCP)
- [ ] Multi-language REPL — Python, JS sandbox
- [ ] Code lens — inline AI-powered suggestions in code blocks
- [ ] Linter / formatter auto-suggestions on code paste

---

## 7. UI & Design *(Modern DNA — Linear/Vercel-inspired)*

- [x] Dark / light themes with system-preference detection
- [x] Linear/Vercel-inspired design — Inter + JetBrains Mono fonts
- [x] Command palette (⌘P) — fuzzy search all actions and conversations
- [x] Keyboard shortcuts with help modal (`?`)
- [x] Collapsible right-sidebar accordion panels
- [x] Drag-to-resize left and right sidebars — persisted, dblclick to reset
- [x] Skeleton loading states — shimmer placeholders
- [x] Animated micro-interactions — message fade-in, hover effects
- [x] Welcome screen with quick-action cards and keyboard hints
- [x] Full-screen focus mode — hide all sidebars (⌘⇧F)
- [x] Sampling presets — Precise / Balanced / Creative
- [x] Appearance settings — accent color, font size, chat density
- [x] Plan mode — model thinks in `<plan>` tags before answering
- [x] Message timestamps on hover (T to pin)
- [ ] 🔥 Fully responsive mobile layout — hamburger nav, touch-friendly
- [ ] 🔥 Multi-tab chat UI — tab bar above chat area
- [ ] Inline message diff view for edited messages
- [ ] Onboarding wizard for first-time setup
- [ ] Keyboard shortcut remapping
- [ ] Custom welcome screen card configuration
- [ ] Notification / toast history panel

---

## 8. RAG / Knowledge Base

- [x] File upload and chunking — `.txt`, `.md`, `.json`, code files
- [x] Ollama embedding (`nomic-embed-text` by default)
- [x] Cosine-similarity vector search
- [x] Collection management — create, query, delete
- [x] Web page crawl — paste URL, auto-scrape + embed into collection
- [x] SSE upload progress
- [x] PDF attachment — client-side extraction via PDF.js
- [x] RAG settings tab — configure embedding model, chunk size, top_k from UI
- [ ] 🔥 GitHub repository indexing — clone + embed all files
- [ ] Auto-inject most-relevant chunks into every message (toggle)
- [ ] Chunk preview and manual editing UI
- [ ] Knowledge base stats — total chunks, sources, last updated
- [ ] Re-embedding on embedding model change
- [ ] Hybrid search — keyword + vector BM25
- [ ] Multi-collection query — search across all collections at once

---

## 9. Voice & Multimodal

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

## 10. Model Comparison

- [x] Side-by-side split-screen comparison
- [x] Parallel streaming to two models simultaneously
- [x] Per-pane latency and token stats
- [x] Response quality grading — 👍/👎 with session win counter
- [x] Word-level diff view between model responses
- [x] Save comparison as downloadable Markdown report
- [x] Diff/Report buttons gated on generation completion
- [ ] 🔥 A/B test mode — random model assignment, reveal after both respond
- [ ] Multi-model tournament — bracket-style comparison (3+ models)
- [ ] Latency histogram per model
- [ ] Comparison history — browse past comparison sessions

---

## 11. Settings

- [x] **General tab** — proxy URL, storage, startup options *(new)*
- [x] Raw JSON config editor with hot-reload
- [x] Backup & restore tab — all data as single JSON
- [x] Appearance tab — accent color, font size, chat density
- [x] Providers tab — API keys + custom servers + test buttons
- [x] Voice tab — TTS voice, speed, pitch controls
- [x] Tools tab — enable/disable individual built-in tools from UI
- [x] RAG tab — embedding model, chunk size, top_k from UI
- [ ] Per-workspace configuration profiles
- [ ] Onboarding wizard for first-time setup
- [ ] Cloud sync of settings (opt-in)

---

## 12. Security & Privacy

- [x] Proxy binds to `127.0.0.1` by default
- [x] SSRF protection on `fetch_url`
- [x] VM sandbox for `run_javascript`
- [x] CORS locked to localhost
- [x] API keys in localStorage only — never written to disk
- [ ] Per-session ephemeral API key option
- [ ] Request / response logging toggle (opt-in, stored locally)
- [ ] Prompt injection warning detection
- [ ] Conversation data encryption at rest
- [ ] Audit log of all tool executions

---

## 13. Deployment & Distribution

- [x] Single Node.js file — `node proxy.js` starts in under 1 second
- [x] Zero npm dependencies (uses Node built-ins only)
- [x] `.env.example` with all environment variables
- [x] `DEPLOY.md` — quick start, Docker, rollback procedure
- [x] `Dockerfile` — multi-stage, non-root user, `/health` HEALTHCHECK
- [x] `docker-compose.yml` — LLM Hub + Ollama in a single stack
- [x] Env var overrides — PORT, HOST, STORAGE_DIR, OLLAMA_HOST/PORT
- [x] `GET /health` endpoint with provider status JSON
- [ ] 🔥 Published Docker image on Docker Hub / GHCR
- [ ] Reverse proxy config examples (nginx, Caddy, Traefik)
- [ ] Desktop app (Electron / Tauri wrapper)
- [ ] `npx local-llm-hub` zero-install launcher
- [ ] Homebrew / Winget / AUR formula

---

## 14. Developer & Integration

- [x] SSE streaming API (`/v1/chat`)
- [x] OpenAI-compatible passthrough (`/v1/chat/completions`)
- [x] MCP stdio client
- [x] OpenAPI/Swagger spec at `/v1/openapi.json` + Swagger UI at `/v1/docs`
- [x] Node.js syntax validation CI (v18, v20, v22)
- [x] JSON config validation in CI
- [x] Unit tests — 47 tests for RagEngine, ToolRegistry, SSRF guard
- [ ] 🔥 Integration tests for all HTTP endpoints
- [ ] End-to-end tests with Playwright
- [ ] VS Code extension — send selected code to LLM Hub
- [ ] Plugin system — load `.js` modules at startup
- [ ] CLI batch mode — `echo "prompt" | llm-hub --model llama3`

---

## Progress Summary

| Area | Done | 🔥 Next | Backlog |
|------|------|---------|---------|
| Core Infrastructure | 11 | 1 | 4 |
| Model Management | 18 | 1 | 5 |
| Hardware Awareness | 8 | 1 | 4 |
| Chat & Conversation | 22 | 1 | 3 |
| Agent & Tools | 5 | 3 | 6 |
| Code Features | 6 | 4 | 5 |
| UI & Design | **14** | 2 | 6 |
| RAG / Knowledge Base | 8 | 1 | 6 |
| Voice & Multimodal | 6 | 0 | 3 |
| Model Comparison | 7 | 1 | 3 |
| Settings | **8** | 0 | 2 |
| Security & Privacy | 5 | 0 | 5 |
| Deployment | 8 | 1 | 4 |
| Developer & Integration | 7 | 1 | 4 |
| **Total** | **133** | **17** | **60** |

**~63% complete toward the full LM Studio + OpenCode + Modern UI vision.**

---

## Top Priorities (Next Sessions)

| # | Feature | Impact | Effort |
|---|---------|--------|--------|
| 1 | A/B test mode for compare | High | Low |
| 2 | GPU VRAM total detection (nvidia-smi) | High | Medium |
| 3 | Multi-tab chat | High | High |
| 4 | Shell command tool (opt-in) | High | Medium |
| 5 | File tree sidebar via MCP filesystem | High | Medium |
| 6 | Integration tests for HTTP endpoints | High | Medium |
| 7 | Mobile responsive layout | High | High |
| 8 | Published Docker image on GHCR | Medium | Low |
| 9 | Mistral/Together/Fireworks providers | Medium | Low |
| 10 | GGUF file drag-and-drop import | Medium | Medium |

---

*Last updated: 2026-06-21 — reflects all merged PRs through #50 (hardware-aware model suggestions). For development history see `CHANGELOG.md`. For architecture see `README.md`.*
