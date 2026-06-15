# LLM Hub — Feature Checklist

> **Vision:** Build the best local-first AI workbench — the feel of **LM Studio** (model management, VRAM awareness, hardware stats) combined with **OpenCode** (code-first agent workflow, file context, git integration) wrapped in a **Linear/Vercel-inspired modern UI** that's fast, keyboard-first, and polished.
>
> **Legend:** `[x]` Done/merged · `[ ]` Not started · **Bold** = next priority

*Last updated: 2026-06-14 — reflects all merged PRs through #43 (JSON Schema editor)*

---

## 1. Core Infrastructure

- [x] Ollama provider integration
- [x] LM Studio provider integration (OpenAI-compatible endpoint)
- [x] Multi-provider model aggregation — single unified model dropdown
- [x] OpenAI-compatible `/v1/chat/completions` passthrough
- [x] Proxy binds to `127.0.0.1` by default (secure by default)
- [x] OpenAI provider — cloud, with API key stored in localStorage
- [x] Anthropic Claude provider — cloud, with API key + format conversion
- [x] Groq provider — ultra-fast inference
- [x] OpenRouter provider — unified cloud gateway
- [x] API key management — localStorage, never written to disk
- [x] Custom provider endpoint — add any OpenAI-compatible server from UI
- [ ] Mistral / Together / Fireworks / Cohere providers
- [ ] Provider health monitoring with auto-reconnect
- [ ] Per-provider timeout and retry settings
- [ ] `npx local-llm-hub` zero-install launcher
- [ ] WebSocket API alternative to SSE

---

## 2. Model Management *(LM Studio DNA)*

- [x] Model listing from all connected providers
- [x] Running model detection — highlight models currently loaded in RAM/VRAM
- [x] Model metadata panel — size, params, context length, quantization
- [x] Model loading banner with live progress
- [x] Model pull / download with live progress bar (Ollama)
- [x] Model delete from disk (Ollama)
- [x] Model capability badges — vision, tools, code, long-context
- [x] Model family grouping in dropdown — Llama 3, Qwen, Mistral…
- [x] Model library browser — browse & pull 30+ popular Ollama models in-app
- [x] Model library search — live filter by name, org, description, category
- [x] Per-model parameter profiles — auto-save & restore temp + max_tokens per model
- [x] Real-time tokens/sec counter during generation
- [x] GPU / VRAM usage monitoring — live VRAM bar per loaded model
- [x] System RAM usage bar
- [x] Cloud API cost estimation — per-response USD display
- [x] Session cost accumulator — running session total with reset
- [x] Model benchmark runner — tokens/sec, TTFT, total time; ranked results table
- [x] Favorite / pin models to top of selector
- [ ] **Hardware-aware model suggestions** — recommend by VRAM fit
- [ ] GGUF file drag-and-drop import
- [ ] Model update notifications — alert when a newer version exists
- [ ] Performance dashboard — tokens/sec charts over time

---

## 3. Chat Interface

- [x] Token streaming via SSE
- [x] Stop generation mid-stream
- [x] Persistent chat history (localStorage)
- [x] Chat export — Markdown, JSON
- [x] Export conversation as standalone HTML (offline, dark/light theme)
- [x] Message edit & regenerate
- [x] Message copy and delete
- [x] Continue generation
- [x] Message reactions — 👍 👎 RLHF-style, persisted per message
- [x] Conversation pinning
- [x] Auto-title from first message
- [x] Chat fuzzy search (⌘K)
- [x] Conversation title rename — double-click inline
- [x] Collapsible long messages — auto-collapse > ~22 lines
- [x] Per-conversation system prompt — auto-save/restore on switch
- [x] In-conversation message search (⌘F)
- [x] Conversation color labels — Work / Code / Research / Ideas / Personal + filter
- [x] Conversation folders — organize chats into named groups
- [x] Conversation branching — fork any message into a parallel path
- [x] Backup & restore — all settings + conversations as a single JSON
- [x] Import conversations — from LLM Hub JSON or ChatGPT conversations.json
- [x] Bulk conversation management — checkbox select, delete, export
- [x] Message timestamps — hover to peek; T key / ⏱ button to pin always-on
- [ ] **Multi-tab chat** — several conversations open side-by-side
- [ ] Context window timeline visualization
- [ ] Inline message threading / replies

---

## 4. Model Comparison

- [x] Side-by-side split-screen comparison
- [x] Parallel streaming to two models simultaneously
- [x] Per-pane latency and token stats
- [x] Response quality grading — thumbs up/down per pane with session win counter
- [x] Word-level diff view between model responses — LCS diff, colour-coded
- [ ] Save comparison as a formatted report
- [ ] A/B test mode — random model selection, reveal after both respond
- [ ] Multi-model tournament (bracket-style)
- [ ] Latency histogram per model

---

## 5. UI / Design *(Modern — Linear/Vercel-inspired)*

- [x] Dark and light themes with system-preference detection
- [x] Linear/Vercel-inspired design tokens — Inter + JetBrains Mono
- [x] Command palette (⌘P) — fuzzy search all actions and conversations
- [x] Keyboard shortcuts (⌘K, ⌘J, ⌘R, ⌘E, ⌘/) with help modal (`?`)
- [x] Collapsible right-sidebar accordion panels
- [x] Drag-to-resize left and right sidebars — persisted, double-click to reset
- [x] Skeleton loading states — shimmer placeholders while loading
- [x] Animated micro-interactions — message fade-in, hover effects
- [x] Redesigned welcome screen with quick-action cards and keyboard hints
- [x] Full-screen focus mode — hide all sidebars, center content (⌘⇧F)
- [x] Sampling presets — Precise / Balanced / Creative one-click buttons
- [x] Appearance settings — accent color, font size, chat density
- [ ] **Fully responsive mobile layout** — hamburger sidebar, touch-friendly
- [ ] **Proper Settings UI with tabs** — General · Providers · Tools · RAG · Audio · Advanced
- [ ] Onboarding wizard for first-time setup
- [ ] Keyboard shortcut remapping
- [ ] Custom welcome screen card configuration

---

## 6. Generation Modes

- [x] Plan mode — model thinks step-by-step in `<plan>` tags before answering
- [x] JSON mode — forces `response_format: json_object` for structured output
- [x] JSON Schema mode — enforce specific output structure; sidebar editor + presets
- [x] Sampling presets — Precise / Balanced / Creative
- [x] Advanced parameters — Top-P, Top-K, Repeat penalty, Frequency penalty
- [ ] Grammar-constrained generation (GBNF / regex)
- [ ] Seed control — reproducible outputs
- [ ] Stop sequences configuration
- [ ] Context length override per conversation

---

## 7. AI Agent & Tools

- [x] Autonomous agent loop — up to 8 tool-call rounds
- [x] Built-in tools: `datetime`, `calculator`, `web_search`, `fetch_url`, `run_javascript`, `rag_search`
- [x] Live tool-call visualization — input → result → elapsed time
- [x] MCP stdio client — spawn external MCP servers
- [x] Tool enable/disable per-session toggle
- [ ] **Custom tool builder UI** — define name, description, JSON schema, handler URL
- [ ] **Shell command tool** — opt-in, with confirmation prompt per execution
- [ ] **Agent run history** — step-by-step replay of past agent sessions
- [ ] Tool result caching — skip re-runs for identical inputs within a session
- [ ] MCP server marketplace / discovery browser
- [ ] Agent memory persistence across sessions
- [ ] Sub-agent spawning — parallel execution of agent tasks
- [ ] Agent graph visualization — node/edge view of tool call chain

---

## 8. Code Features *(OpenCode DNA)*

- [x] Syntax-highlighted code blocks (14 languages via Prism.js)
- [x] Artifact rendering — HTML, SVG, JSX, TSX in sandboxed iframe
- [x] Prompt templates with `{{variable}}` placeholders
- [x] Live code editing inside artifact preview — edit + re-render inline
- [ ] **File tree sidebar** — browse local filesystem via MCP filesystem server
- [ ] **Multi-file context** — select and attach multiple files as context
- [ ] **Git integration** — show diff, stage, commit, PR review workflow
- [ ] **Diff viewer** — before/after code comparison with syntax highlighting
- [ ] Terminal pane — run shell commands inline
- [ ] Multi-language REPL — Python, JS in sandboxed env
- [ ] Code lens — inline AI-powered suggestions in code blocks
- [ ] Copy code → file save dialog

---

## 9. RAG / Knowledge Base

- [x] File upload and chunking — `.txt`, `.md`, `.json`, code files
- [x] Ollama embedding (`nomic-embed-text` by default)
- [x] Cosine-similarity vector search
- [x] Collection management — create, query, delete
- [x] SSE upload progress
- [x] Web page crawl — paste URL, server-side fetch + embed into collection
- [x] PDF attachment — client-side text extraction via PDF.js
- [ ] GitHub repository indexing — clone + embed all files
- [ ] Auto-inject most-relevant chunks into every message (toggle)
- [ ] Chunk preview and manual editing UI
- [ ] Knowledge base stats — total chunks, sources, last updated
- [ ] Hybrid search — keyword + vector BM25
- [ ] Multi-collection query — search across all collections at once

---

## 10. Voice & Multimodal

- [x] Image attachments — paste, drag-and-drop, file picker
- [x] Vision model support — llava, qwen2-vl, llama3.2-vision
- [x] Voice input via browser Web Speech API
- [x] Whisper server integration — local transcription
- [x] Text-to-speech output — Read button, voice/rate/pitch controls
- [ ] Audio file transcription by drag-and-drop
- [ ] Video frame extraction for vision models
- [ ] Screen capture / screenshot attach from clipboard

---

## 11. Performance & Hardware Stats *(LM Studio DNA)*

- [x] Input token counter — live estimate while typing
- [x] Generation stats — total tokens, elapsed time
- [x] System RAM usage bar
- [x] Context usage indicator — warns at >75%
- [x] Real-time tokens/sec counter during generation
- [x] GPU / VRAM usage monitoring — live VRAM bar per loaded model
- [x] Cloud API cost estimation — per-response USD cost
- [x] Session cost accumulator — running total with reset
- [ ] Response latency histogram per model
- [ ] Performance dashboard — charts comparing models over time
- [ ] CPU / GPU temperature display (where available)

---

## 12. Settings UI

- [x] Raw JSON config editor modal
- [x] Config hot-reload — MCP servers restart on save
- [x] Backup & restore — all settings + conversations as a single JSON
- [x] Appearance settings tab — accent color, font size, chat density
- [x] Provider connection test button — per-provider ping
- [ ] **Proper settings UI with tabs** — General · Providers · Tools · RAG · Audio · Advanced
- [ ] Per-workspace configuration profiles
- [ ] Onboarding wizard for first-time setup

---

## 13. Security & Privacy

- [x] Proxy binds to `127.0.0.1` by default — no LAN exposure without opt-in
- [x] SSRF protection on `fetch_url` (extracted to `lib/ssrf.js`, unit-tested)
- [x] VM sandbox for `run_javascript` (calculator via `lib/calculator.js`)
- [x] CORS locked to localhost
- [ ] Per-session API key — never persisted to disk
- [ ] Request / response logging toggle — opt-in, stored locally
- [ ] Prompt injection warning detection
- [ ] Conversation data encryption at rest
- [ ] Audit log of all tool executions

---

## 14. Developer & Integration

- [x] SSE streaming API (`/v1/chat`)
- [x] OpenAI-compatible passthrough (`/v1/chat/completions`)
- [x] MCP stdio client
- [x] Node.js syntax validation CI (v18, v20, v22)
- [x] JSON config validation in CI
- [x] Unit tests — SSRF guard, RAG chunking/cosine, calculator (47 tests, Node built-in runner)
- [ ] **OpenAPI / Swagger spec** for all proxy endpoints
- [ ] Integration tests for HTTP endpoints
- [ ] End-to-end tests with Playwright
- [ ] Docker image with Ollama bundled
- [ ] VS Code extension — send selected code to LLM Hub
- [ ] Plugin system — load `.js` modules at startup
- [ ] CLI batch mode

---

## Progress Summary

| Category | Done | Todo |
|----------|------|------|
| Core Infrastructure | 11 | 5 |
| Model Management | 18 | 4 |
| Chat Interface | 23 | 3 |
| Model Comparison | 5 | 4 |
| UI / Design | 12 | 5 |
| Generation Modes | 5 | 4 |
| AI Agent & Tools | 5 | 8 |
| Code Features | 4 | 8 |
| RAG / Knowledge Base | 7 | 6 |
| Voice & Multimodal | 5 | 3 |
| Hardware Stats | 8 | 3 |
| Settings UI | 5 | 3 |
| Security & Privacy | 4 | 5 |
| Developer & Integration | 6 | 7 |
| **Total** | **118** | **68** |
