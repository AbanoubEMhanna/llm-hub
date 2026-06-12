# LLM Hub — MVP Feature Checklist
## Vision: LM Studio + OpenCode + Modern UI

> **Goal:** A local-first AI workbench that feels as polished as Linear, as powerful as LM Studio for model management, and as code-centric as OpenCode — shipping as a single Node.js process with zero npm dependencies.
>
> **Legend:** `[x]` Done · `[ ]` Not done · `[~]` In progress / open PR · **bold** = MVP critical

---

## 1. Model Management *(LM Studio DNA)*

- [x] Connect to Ollama (local)
- [x] Connect to LM Studio (local)
- [x] Unified model dropdown — all providers in one selector
- [x] OpenAI, Anthropic, Groq, OpenRouter cloud providers
- [x] Custom provider endpoint (any OpenAI-compatible API)
- [x] Running model detection — highlight models loaded in VRAM
- [x] Model metadata — size, params, context length, quantization
- [x] Model pull / download with live progress bar (Ollama)
- [x] Model delete from disk (Ollama)
- [x] Model capability badges — vision, tools, code, long-context
- [x] Model family grouping in dropdown
- [x] Model library browser — browse & pull 30+ models in-app
- [x] Model library search — live filter
- [x] Per-model parameter profiles — save/restore temperature + max tokens
- [x] Real-time tokens/sec counter during generation
- [x] GPU / VRAM usage monitoring with live bar
- [x] System RAM usage bar
- [x] Model benchmark runner — tokens/sec, TTFT, total time
- [x] **Favorite / pin models to top of selector**
- [ ] **Hardware-aware model suggestions** — recommend models that fit available VRAM
- [ ] GGUF drag-and-drop import (load any GGUF into LM Studio)
- [ ] Model update notifications — alert when newer version exists
- [ ] Performance dashboard — tokens/sec charts over time

---

## 2. Chat Interface

- [x] Token streaming via SSE
- [x] Stop generation mid-stream
- [x] Persistent chat history (localStorage)
- [x] Chat export — Markdown, JSON, standalone HTML
- [x] Message edit & regenerate
- [x] Message copy and delete
- [x] Continue generation
- [x] Message reactions — 👍 👎 per message
- [x] Conversation pinning
- [x] Auto-title from first message
- [x] Chat fuzzy search (⌘K)
- [x] Conversation title rename (double-click inline)
- [x] Collapsible long messages (auto-collapse > 22 lines)
- [x] Per-conversation system prompt
- [x] In-conversation message search (⌘F)
- [x] Conversation color labels + sidebar filter
- [x] Conversation folders
- [x] Conversation branching — fork from any message
- [x] Backup & restore — all data as single JSON
- [x] Import from LLM Hub export or ChatGPT export
- [x] Bulk conversation management — select, delete, export
- [ ] **Multi-tab chat** — several conversations open side-by-side
- [ ] Context window timeline visualization
- [ ] Message timestamps toggle
- [ ] Inline message threading / replies

---

## 3. Code Features *(OpenCode DNA)*

- [x] Syntax-highlighted code blocks (14 languages via Prism.js)
- [x] Artifact rendering — HTML, SVG, JSX, TSX in sandboxed iframe
- [x] Live code editing inside artifact preview — edit + re-render inline
- [x] Prompt templates with `{{variable}}` placeholders
- [ ] **File tree sidebar** — browse local filesystem via MCP filesystem server
- [ ] **Multi-file context** — select and attach multiple files as context
- [ ] **Git integration** — show diff, stage, commit, PR review workflow
- [ ] **Diff viewer** — before/after code comparison with syntax highlighting
- [ ] Terminal pane — run shell commands, see output inline
- [ ] Copy code → file save dialog (write directly to disk)
- [ ] Multi-language REPL — run Python, JS, etc. sandboxed
- [ ] Code lens — inline AI-powered suggestions in code blocks
- [ ] Linter / formatter auto-suggestions on code paste

---

## 4. AI Agent & Tools

- [x] Autonomous agent loop (up to 8 tool-call rounds)
- [x] Built-in tools: datetime, calculator, web_search, fetch_url, run_javascript, rag_search
- [x] Live tool-call visualization — input → result → elapsed time
- [x] MCP stdio client — spawn external MCP servers
- [x] Tool enable/disable per-session toggle
- [ ] **Custom tool builder UI** — define name, description, JSON schema, handler URL
- [ ] **Shell command tool** — opt-in, with confirmation per execution
- [ ] **Agent run history** — step-by-step replay of past agent sessions
- [ ] Tool result caching — skip re-runs for identical inputs
- [ ] MCP server marketplace / discovery browser
- [ ] Agent memory persistence across sessions
- [ ] Sub-agent spawning — parallel task execution
- [ ] Browser automation via Playwright MCP
- [ ] Agent graph visualization — node/edge view of tool call chain

---

## 5. RAG / Knowledge Base

- [x] File upload + chunking — `.txt`, `.md`, `.json`, code files
- [x] Ollama embedding (`nomic-embed-text`)
- [x] Cosine-similarity vector search
- [x] Collection management — create, query, delete
- [x] SSE upload progress
- [x] Web page crawl — paste URL, auto-scrape + embed into collection
- [ ] **GitHub repository indexing** — clone + embed all files
- [ ] **Auto-inject most-relevant chunks** into every message (toggle)
- [ ] Chunk preview and manual editing UI
- [ ] Knowledge base stats — total chunks, sources, last updated
- [ ] Re-embedding on embedding model change
- [ ] Hybrid search — keyword + vector BM25
- [ ] Multi-collection query — search across all collections at once

---

## 6. UI / Design *(Modern Linear/Vercel DNA)*

- [x] Dark and light themes with system-preference detection
- [x] Linear/Vercel design tokens — Inter + JetBrains Mono
- [x] Command palette (⌘P) — fuzzy search all actions + conversations
- [x] Keyboard shortcuts with help modal (`?`)
- [x] Collapsible right-sidebar accordion panels
- [x] Drag-to-resize left and right sidebars
- [x] Skeleton loading states — shimmer placeholders
- [x] Animated micro-interactions — fade-in, hover effects
- [x] Redesigned welcome screen with quick-action cards
- [x] Full-screen focus mode (⌘⇧F)
- [x] Sampling presets — Precise / Balanced / Creative
- [x] Appearance settings — accent color, font size, chat density
- [ ] **Fully responsive mobile layout** — hamburger sidebar, touch-friendly
- [ ] Inline message diff view for edited messages
- [ ] Custom welcome screen card configuration
- [ ] Onboarding wizard for first-time setup
- [ ] Keyboard shortcut remapping

---

## 7. Voice & Multimodal

- [x] Image attachments — paste, drag-and-drop, file picker
- [x] Vision model support (llava, qwen2-vl, llama3.2-vision)
- [x] Voice input via browser Web Speech API
- [x] Whisper server integration — local transcription
- [x] Text-to-speech — Read button, voice/rate/pitch controls
- [x] PDF attachment — client-side text extraction via PDF.js
- [ ] Audio file transcription by drag-and-drop
- [ ] Video frame extraction for vision models
- [ ] Screen capture / screenshot attach from clipboard

---

## 8. Model Comparison

- [x] Side-by-side split-screen comparison
- [x] Parallel streaming to two models simultaneously
- [x] Per-pane latency and token stats
- [x] Response quality grading — thumbs up/down with session win counter
- [x] Word-level diff view between two model responses
- [ ] Save comparison as a formatted report
- [ ] A/B test mode — random model selection, reveal after both respond
- [ ] Multi-model tournament — bracket-style comparison
- [ ] Latency histogram per model

---

## 9. Generation Control

- [x] Plan mode — step-by-step thinking in `<plan>` tags
- [x] JSON mode — `response_format: json_object`
- [x] Advanced parameters — Top-P, Top-K, Repeat penalty, Frequency penalty
- [ ] **Structured output with JSON schema editor**
- [ ] Grammar-constrained generation (GBNF / regex)
- [ ] Seed control — reproducible outputs
- [ ] Stop sequences configuration
- [ ] Context length override per conversation

---

## 10. Settings & Configuration

- [x] Raw JSON config editor modal
- [x] Config hot-reload — MCP servers restart on save
- [x] Backup & restore — all settings + conversations as JSON
- [x] Appearance settings tab — accent color, font size, chat density
- [x] Provider connection test button
- [ ] **Proper settings UI with tabs** — General · Providers · Tools · RAG · Audio · Advanced
- [ ] Per-workspace configuration profiles
- [ ] Onboarding wizard

---

## 11. Performance & Hardware *(LM Studio DNA)*

- [x] Input token counter — live estimate while typing
- [x] Generation stats — total tokens, elapsed time
- [x] Context usage indicator — warns at >75%
- [x] Cloud API cost estimation — per-response USD cost
- [x] Session cost accumulator — running total with reset
- [ ] Response latency histogram per model
- [ ] Performance dashboard — charts comparing models over time
- [ ] CPU / GPU temperature display

---

## 12. Security & Privacy

- [x] Proxy binds to `127.0.0.1` by default (no LAN exposure)
- [x] SSRF protection on `fetch_url` and web crawl
- [x] VM sandbox for `run_javascript`
- [x] CORS locked to localhost
- [x] API keys in localStorage only — never written to disk
- [ ] Request / response logging toggle (opt-in, stored locally)
- [ ] Prompt injection warning detection
- [ ] Conversation data encryption at rest
- [ ] Audit log of all tool executions

---

## 13. Developer & Integration

- [x] SSE streaming API (`/v1/chat`)
- [x] OpenAI-compatible passthrough (`/v1/chat/completions`)
- [x] MCP stdio client
- [x] Node.js CI — syntax check on v18, v20, v22
- [ ] **OpenAPI / Swagger spec for all proxy endpoints**
- [ ] **Unit tests** — RagEngine, ToolRegistry, SSRF guard
- [ ] Integration tests for HTTP endpoints
- [ ] Docker image with Ollama bundled
- [ ] VS Code extension — send selected code to LLM Hub
- [ ] Plugin system — load `.js` modules at startup
- [ ] CLI batch mode — `echo "prompt" | llm-hub --model llama3`

---

## Progress Summary

| Category | Done | Remaining | Total |
|----------|------|-----------|-------|
| Model Management | 19 | 4 | 23 |
| Chat Interface | 21 | 4 | 25 |
| Code Features (OpenCode) | 4 | 9 | 13 |
| AI Agent & Tools | 5 | 9 | 14 |
| RAG / Knowledge Base | 6 | 7 | 13 |
| UI / Design | 12 | 5 | 17 |
| Voice & Multimodal | 6 | 3 | 9 |
| Model Comparison | 5 | 4 | 9 |
| Generation Control | 3 | 4 | 7 |
| Settings & Config | 5 | 2 | 7 |
| Performance & Hardware | 5 | 3 | 8 |
| Security & Privacy | 5 | 4 | 9 |
| Developer & Integration | 4 | 7 | 11 |
| **Total** | **100** | **65** | **165** |

---

## MVP Milestone (ship to first users)

The following items are the minimum to feel like "LM Studio + OpenCode with modern UI":

- [ ] **Fully responsive mobile layout**
- [ ] **Hardware-aware model suggestions**
- [ ] **File tree sidebar via MCP filesystem**
- [ ] **Multi-file context attachment**
- [ ] **Custom tool builder UI**
- [ ] **Proper settings UI with tabs**
- [ ] **Multi-tab chat**
- [ ] **OpenAPI spec for proxy endpoints**

*Last updated: 2026-06-11*
