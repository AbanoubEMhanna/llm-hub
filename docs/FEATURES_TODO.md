# LLM Hub — Features TODO

> **Vision:** A local-first AI workbench combining the best of:
> - **LM Studio** — model management, hardware awareness, VRAM monitoring, model library
> - **OpenCode** — code-first agent workflows, file context, shell execution, git integration
> - **Modern UI** — Linear/Vercel-inspired design, keyboard-first, fast, polished
>
> **Legend:** `[x]` Done · `[ ]` Not started · `[~]` In progress / open PR · 🔥 High priority next
>
> *Last updated: 2026-06-18 — reflects all merged PRs through #47 (Docker deployment).*

---

## Table of Contents

1. [Core Infrastructure](#1-core-infrastructure)
2. [Model Management — LM Studio DNA](#2-model-management--lm-studio-dna)
3. [Chat Interface](#3-chat-interface)
4. [Agent & Tools — OpenCode DNA](#4-agent--tools--opencode-dna)
5. [Code Features — OpenCode DNA](#5-code-features--opencode-dna)
6. [UI & Design — Modern DNA](#6-ui--design--modern-dna)
7. [RAG / Knowledge Base](#7-rag--knowledge-base)
8. [Voice & Multimodal](#8-voice--multimodal)
9. [Model Comparison](#9-model-comparison)
10. [Performance & Hardware Stats](#10-performance--hardware-stats)
11. [Settings](#11-settings)
12. [Deployment & Distribution](#12-deployment--distribution)
13. [Security & Privacy](#13-security--privacy)
14. [Developer & Integration](#14-developer--integration)
15. [Progress Summary](#progress-summary)

---

## 1. Core Infrastructure

- [x] Ollama provider integration
- [x] LM Studio provider integration
- [x] Unified model dropdown — all providers in one picker
- [x] OpenAI-compatible `/v1/chat/completions` passthrough
- [x] Proxy binds to `127.0.0.1` by default (secure by default)
- [x] OpenAI cloud provider with API key in localStorage
- [x] Anthropic Claude provider (format conversion included)
- [x] Groq provider — ultra-fast inference
- [x] OpenRouter provider — unified cloud gateway
- [x] API key management — localStorage, never on disk
- [x] Custom OpenAI-compatible server (vLLM, LocalAI, Koboldcpp, etc.)
- [ ] 🔥 Mistral / Together / Fireworks / Cohere providers
- [ ] Provider health monitoring with auto-reconnect
- [ ] Per-provider timeout and retry configuration
- [ ] WebSocket API alternative to SSE
- [ ] `npx local-llm-hub` zero-install launcher

---

## 2. Model Management — LM Studio DNA

- [x] Model listing from all connected providers
- [x] Running model detection — highlight models loaded in RAM/VRAM
- [x] Model metadata panel — size, params, context length, quantization
- [x] Model loading banner with live progress
- [x] Model pull / download with live progress bar (Ollama)
- [x] Model delete from disk (Ollama)
- [x] Model capability badges — vision, tools, code, long-context
- [x] Model family grouping in dropdown (Llama 3, Qwen, Mistral…)
- [x] Model library browser — browse & pull 30+ popular models in-app
- [x] Per-model parameter profiles — auto-save temperature + max tokens
- [x] Real-time tokens/sec counter during generation
- [x] GPU / VRAM usage monitoring — live VRAM bar per loaded model
- [x] System RAM usage bar
- [x] Cloud provider cost estimation — per-response USD display
- [x] Model library search — live filter by name, category, org
- [x] Model benchmark runner — tokens/sec, TTFT, total time; ranked table
- [ ] 🔥 Hardware-aware model suggestions — recommend models that fit VRAM
- [ ] GGUF file drag-and-drop import
- [ ] Favorite / pin models to top of selector
- [ ] Model update notifications — alert when newer version available
- [ ] Performance charts — tokens/sec over time per model

---

## 3. Chat Interface

- [x] Token streaming via SSE
- [x] Stop generation mid-stream
- [x] Persistent chat history (localStorage)
- [x] Chat export — Markdown and JSON
- [x] Export conversation as standalone offline HTML
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
- [ ] 🔥 Multi-tab chat — multiple conversations side-by-side
- [ ] Context window timeline — visualize which messages fit in context
- [ ] Inline message threading / replies
- [ ] Message timestamps toggle (hover to peek, T key to pin)

---

## 4. Agent & Tools — OpenCode DNA

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

## 5. Code Features — OpenCode DNA

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
- [ ] Terminal pane — run shell commands, see output inline
- [ ] Copy code → file save dialog (write directly to disk)
- [ ] Multi-language REPL — Python, JS sandbox
- [ ] Code lens — inline AI-powered suggestions in code blocks
- [ ] Linter / formatter auto-suggestions on code paste

---

## 6. UI & Design — Modern DNA

- [x] Dark / light themes with system-preference detection
- [x] Linear/Vercel-inspired design — Inter + JetBrains Mono
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
- [x] Message timestamps on hover
- [ ] 🔥 Fully responsive mobile layout — hamburger nav, touch-friendly
- [ ] Inline message diff view for edited messages
- [ ] Onboarding wizard for first-time setup
- [ ] Keyboard shortcut remapping
- [ ] Custom welcome screen card configuration

---

## 7. RAG / Knowledge Base

- [x] File upload and chunking — `.txt`, `.md`, `.json`, code files
- [x] Ollama embedding (`nomic-embed-text` by default)
- [x] Cosine-similarity vector search
- [x] Collection management — create, query, delete
- [x] Web page crawl — paste URL, auto-scrape + embed into collection
- [x] SSE upload progress
- [x] PDF attachment — client-side extraction via PDF.js
- [ ] 🔥 RAG settings tab — configure embedding model, chunk size, top_k from UI
- [ ] GitHub repository indexing — clone + embed all files
- [ ] Auto-inject most-relevant chunks into every message (toggle)
- [ ] Chunk preview and manual editing UI
- [ ] Knowledge base stats — total chunks, sources, last updated
- [ ] Re-embedding on embedding model change
- [ ] Hybrid search — keyword + vector BM25
- [ ] Multi-collection query — search across all collections at once

---

## 8. Voice & Multimodal

- [x] Image attachments — paste (⌘V), drag-drop, file picker
- [x] Vision model support — llava, qwen2-vl, llama3.2-vision
- [x] Voice input via browser Web Speech API
- [x] Whisper server integration — local transcription
- [x] Text-to-speech output — 🔊 Read button, voice/rate/pitch controls
- [x] PDF attachments
- [ ] Audio file transcription by drag-and-drop
- [ ] Video frame extraction for vision models
- [ ] Screen capture / screenshot attach from clipboard

---

## 9. Model Comparison

- [x] Side-by-side split-screen comparison
- [x] Parallel streaming to two models simultaneously
- [x] Per-pane latency and token stats
- [x] Response quality grading — 👍/👎 with session win counter
- [x] Word-level diff view between model responses
- [ ] 🔥 Save comparison as a formatted report
- [ ] A/B test mode — random model, reveal after both respond
- [ ] Multi-model tournament — bracket-style comparison
- [ ] Latency histogram per model

---

## 10. Performance & Hardware Stats

- [x] Live input token counter while typing
- [x] Generation stats — total tokens, elapsed time
- [x] System RAM usage bar
- [x] Context usage indicator — warns at >75%
- [x] Real-time tokens/sec counter
- [x] GPU / VRAM monitoring — live bar per loaded model
- [x] Cloud API cost estimation — per-response USD
- [x] Session cost accumulator — running total with reset button
- [ ] Response latency histogram per model
- [ ] Performance dashboard — charts over time per model
- [ ] CPU / GPU temperature display (where available)

---

## 11. Settings

- [x] Raw JSON config editor
- [x] Config hot-reload — MCP servers restart on save
- [x] Backup & restore tab — all data as single JSON
- [x] Appearance tab — accent color, font size, chat density
- [x] Providers tab — API keys + custom servers + test buttons
- [x] Voice tab — TTS voice, speed, pitch controls
- [x] Tools tab — enable/disable individual built-in tools from UI *(new in this session)*
- [x] RAG tab — embedding model, chunk size, top_k from UI *(new in this session)*
- [ ] General tab — proxy port, storage dir, startup options
- [ ] Per-workspace configuration profiles
- [ ] Onboarding wizard for first-time setup

---

## 12. Deployment & Distribution

- [x] Single Node.js file, zero npm dependencies
- [x] `node proxy.js` starts in under 1 second
- [x] `.env.example` with all environment variables
- [x] `DEPLOY.md` — quick start, Docker, rollback procedure
- [x] `Dockerfile` — multi-stage, non-root user, `/health` HEALTHCHECK
- [x] `docker-compose.yml` — LLM Hub + Ollama in a single stack
- [x] Env var overrides — PORT, HOST, STORAGE_DIR, OLLAMA_HOST/PORT
- [x] `GET /health` endpoint with provider status JSON
- [ ] 🔥 Published Docker image on Docker Hub / GHCR
- [ ] Reverse proxy config examples (nginx, Caddy, Traefik)
- [ ] Desktop app (Electron / Tauri)
- [ ] `npx local-llm-hub` zero-install launcher
- [ ] Homebrew formula

---

## 13. Security & Privacy

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

## 14. Developer & Integration

- [x] SSE streaming API (`/v1/chat`)
- [x] OpenAI-compatible passthrough (`/v1/chat/completions`)
- [x] MCP stdio client
- [x] OpenAPI/Swagger spec at `/v1/openapi.json` + Swagger UI at `/v1/docs`
- [x] Node.js syntax validation CI (v18, v20, v22)
- [x] JSON config validation in CI
- [x] Unit tests for RagEngine, ToolRegistry, SSRF guard (47 tests)
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
| Model Management | 16 | 1 | 4 |
| Chat Interface | 21 | 1 | 3 |
| Agent & Tools | 5 | 3 | 6 |
| Code Features | 6 | 4 | 5 |
| UI & Design | 13 | 1 | 4 |
| RAG / Knowledge Base | 7 | 1 | 6 |
| Voice & Multimodal | 6 | 0 | 3 |
| Model Comparison | 5 | 1 | 3 |
| Hardware Stats | 7 | 0 | 3 |
| Settings | 8 | 1 | 2 |
| Deployment | 8 | 1 | 4 |
| Security | 5 | 0 | 5 |
| Developer & Integration | 7 | 1 | 4 |
| **Total** | **125** | **16** | **56** |

**~63% complete toward the full vision.**

---

*For the full development history see `CHANGELOG.md`. For architecture details see `README.md`.*
