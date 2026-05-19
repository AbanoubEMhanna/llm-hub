# LLM Hub — App Roadmap & Feature Checklist

> **Vision:** The best local-first AI workbench — combining **LM Studio's** model management
> and hardware awareness with **OpenCode's** code-first agent workflow, wrapped in a polished
> **Linear/Vercel-inspired UI** that feels fast, focused, and professional.
>
> **Goal:** Feel like LM Studio + OpenCode, but prettier, faster, and browser-native.

**Legend:**

| Mark | Meaning |
|------|---------|
| `[x]` | Done — shipped on `main` |
| `[~]` | In review — open PR, not yet merged |
| `[ ]` | Not started |
| 🔥 | High priority — next to build |

---

## 1. Core Infrastructure

- [x] Ollama provider integration
- [x] LM Studio provider integration
- [x] OpenAI provider (cloud, API key in localStorage)
- [x] Anthropic Claude provider (cloud, with format conversion)
- [x] Groq provider (ultra-fast inference)
- [x] OpenRouter provider (200+ models via one key)
- [x] Multi-provider unified model dropdown
- [x] OpenAI-compatible `/v1/chat/completions` passthrough
- [x] Proxy binds to `127.0.0.1` by default (secure by default)
- [x] API key management (localStorage, never written to disk)
- [ ] 🔥 **Mistral / Together / Fireworks providers**
- [ ] 🔥 **Custom provider endpoint** — add any OpenAI-compatible server from UI
- [ ] Provider health monitoring with auto-reconnect
- [ ] Per-provider timeout and retry configuration
- [ ] `npx llm-hub` zero-install launcher

---

## 2. Model Management *(LM Studio-inspired)*

- [x] Model listing from all connected providers
- [x] Running model detection (loaded in RAM/VRAM)
- [x] Model metadata display (size, params, context, quantization)
- [x] Model loading banner with live progress bar
- [x] Model pull / download with live progress (Ollama)
- [x] Model delete from disk (Ollama)
- [x] Model capability badges (vision, tools, code, long-context)
- [x] Model family grouping in dropdown (Llama, Qwen, Mistral…)
- [~] **Model library browser** — browse & pull models inline (PR `#17`)
- [~] **Per-model parameter profiles** — auto-save/restore params per model (PR `#15`)
- [ ] 🔥 **Hardware-aware suggestions** — recommend models that fit available VRAM
- [ ] 🔥 **Model benchmark runner** — tokens/sec speed test per model
- [ ] 🔥 **Favorite / pin models** to top of selector
- [ ] GGUF drag-and-drop import (load any GGUF into LM Studio)
- [ ] Model tags and aliasing (friendly names)
- [ ] Update notifications — alert when a newer model version exists

---

## 3. Chat Interface

- [x] Token streaming via SSE
- [x] Stop generation mid-stream
- [x] Persistent chat history (localStorage)
- [x] Message edit & regenerate
- [x] Message copy to clipboard
- [x] Continue generation
- [x] Conversation pinning
- [x] Auto-title from first message
- [x] Chat fuzzy search (⌘K)
- [x] Conversation title rename (double-click)
- [x] Chat export — Markdown, JSON, standalone HTML
- [~] **Per-conversation system prompt** — each chat remembers its own system prompt (PR `#19`)
- [~] **Message reactions** 👍 / 👎 — RLHF-style feedback (PR `#18`)
- [~] **Conversation color labels** — tag chats by type with filter chips (PR `#16`)
- [ ] 🔥 **Conversation folders** — nested folder organization
- [ ] 🔥 **Conversation branching** — fork from any message into a new thread
- [ ] 🔥 **Bulk management** — select all → delete / export / move
- [ ] 🔥 **Message search** within a single conversation
- [ ] Import conversations from JSON / ChatGPT export
- [ ] Multi-tab chat (several conversations open side-by-side)
- [ ] Context window timeline — visualize which messages fit in context
- [ ] Inline message threading / replies

---

## 4. Model Comparison

- [x] Side-by-side split-screen comparison
- [x] Parallel streaming to two models simultaneously
- [x] Per-pane token stats and latency
- [ ] 🔥 **Response diff view** — highlight differences between two answers
- [ ] 🔥 **Response quality grading** — thumbs up/down per pane
- [ ] Save comparison as a formatted report
- [ ] A/B test mode (random model selection, reveal after both respond)
- [ ] Multi-model tournament (bracket-style)
- [ ] Latency histogram per model

---

## 5. UI / Design *(Linear/Vercel-inspired)*

- [x] Dark and light themes with instant toggle
- [x] Linear/Vercel design tokens (Inter + JetBrains Mono)
- [x] Collapsible right-sidebar accordion panels
- [x] Keyboard shortcuts (⌘P, ⌘K, ⌘J, ⌘R, ⌘E, ⌘/)
- [x] Keyboard shortcut help modal (`?`)
- [x] Sampling presets — Precise / Balanced / Creative
- [x] Command palette (⌘P) with fuzzy action search
- [x] Full-screen focus mode (⌘⇧F)
- [x] Collapsible long messages (auto-collapse > ~22 lines)
- [~] **Fully responsive mobile layout** — drawer sidebars, touch-friendly (PR `#14`)
- [x] **Appearance settings** — accent color picker, font size, chat density
- [ ] 🔥 **Drag-to-resize sidebars**
- [ ] Animated page transitions and micro-interactions
- [ ] Skeleton loading states instead of spinners
- [ ] Custom welcome screen with editable quick-action cards
- [ ] Inline diff view for edited messages

---

## 6. AI Agent & Tools

- [x] Autonomous agent loop (up to 8 tool-call rounds)
- [x] Built-in tools: `datetime`, `calculator`, `web_search`, `fetch_url`, `run_javascript`, `rag_search`
- [x] Live tool-call visualization (input → result → elapsed time)
- [x] MCP stdio client (spawn external MCP servers)
- [x] Tool enable/disable per-session toggle
- [ ] 🔥 **Custom tool builder UI** — define name, description, JSON schema, handler URL
- [ ] 🔥 **Shell command tool** — opt-in, with per-execution confirmation prompt
- [ ] 🔥 **Agent run history** — step-by-step replay of past sessions
- [ ] 🔥 **MCP marketplace** — browse and install popular MCP servers
- [ ] Tool result caching (skip re-runs for identical inputs within a session)
- [ ] Agent memory persistence across sessions (long-term notes store)
- [ ] Sub-agent spawning (parallel task execution)
- [ ] Browser automation via Playwright MCP
- [ ] Agent graph visualization (node/edge view of tool chain)

---

## 7. Code Features *(OpenCode-inspired)*

- [x] Syntax-highlighted code blocks (14 languages via Prism.js)
- [x] Artifact rendering (HTML, SVG, JSX, TSX in sandboxed iframe)
- [x] Prompt templates with `{{variable}}` placeholders
- [ ] 🔥 **Live code editing** in artifact preview (edit + re-render inline)
- [ ] 🔥 **File tree sidebar** — browse local filesystem via MCP filesystem server
- [ ] 🔥 **Multi-file context** — select and attach files as conversation context
- [ ] 🔥 **Diff viewer** — before/after code comparison with syntax highlight
- [ ] 🔥 **Git integration** — show diff, stage, commit, PR review workflow
- [ ] Terminal pane — run shell commands, see output inline
- [ ] Code lens — inline AI-powered suggestions in code blocks
- [ ] Test runner output display
- [ ] Copy code → file save dialog (write directly to disk)
- [ ] Multi-language REPL (run Python, JS, etc. via sandboxed env)

---

## 8. RAG / Knowledge Base

- [x] File upload and chunking (.txt, .md, .json, code files)
- [x] Ollama embedding (`nomic-embed-text` by default)
- [x] Cosine-similarity vector search
- [x] Collection management (create, query, delete)
- [x] SSE upload progress
- [ ] 🔥 **Web page crawl** — paste URL, auto-scrape into knowledge base
- [ ] 🔥 **PDF support** — extract text, embed, attach as context
- [ ] 🔥 **Auto-inject** most relevant chunks into every message (toggle)
- [ ] GitHub repository indexing — clone + embed all files
- [ ] Chunk preview and editing UI
- [ ] Knowledge base stats (total chunks, sources, last updated)
- [ ] Re-embedding on embedding model change
- [ ] Hybrid search (BM25 + vector)
- [ ] Multi-collection query

---

## 9. Parameters & Presets

- [x] Temperature slider
- [x] Max tokens input
- [x] System prompt presets (save / load)
- [x] Prompt templates with variable substitution
- [x] Plan mode (think step-by-step prefix)
- [x] Sampling presets: Precise / Balanced / Creative
- [x] Advanced params: Top-P, Top-K, Repeat penalty, Frequency penalty
- [~] **Per-model parameter profiles** — auto-save/restore per model (PR `#15`)
- [ ] 🔥 **Structured output (JSON mode)** — force JSON schema response
- [ ] 🔥 **Context length override** per conversation
- [ ] Seed control (reproducible outputs)
- [ ] Stop sequences configuration
- [ ] System prompt community library

---

## 10. Voice & Multimodal

- [x] Image attachments (paste, drag-and-drop, file picker)
- [x] Vision model support (llava, qwen2-vl, llama3.2-vision)
- [x] Voice input via browser Web Speech API
- [x] Whisper server integration (local transcription)
- [ ] 🔥 **Text-to-speech output** — read responses aloud (browser TTS)
- [ ] 🔥 **PDF attachment** — extract text and attach as context
- [ ] Audio file transcription by drag-and-drop
- [ ] Video frame extraction for vision models
- [ ] Screen capture / screenshot attach from clipboard

---

## 11. Performance & Hardware Stats *(LM Studio-inspired)*

- [x] Live input token counter while typing
- [x] Generation stats (total tokens, elapsed time)
- [x] Real-time tokens/sec counter during generation
- [x] System RAM usage bar
- [x] Context usage indicator (warns at >75%)
- [~] **GPU / VRAM monitoring** — live VRAM per loaded model (PR `#13`)
- [~] **Cloud API cost estimation** — per-model USD pricing table (PR `#12`)
- [ ] 🔥 **Performance dashboard** — charts comparing models over time
- [ ] Response latency histogram per model
- [ ] Session token usage totals (prompt + completion cumulative)
- [ ] CPU / GPU temperature display (where available)

---

## 12. Settings UI

- [x] Raw JSON config editor modal
- [x] Config hot-reload (MCP servers restart on save)
- [x] API keys tab (OpenAI, Anthropic, Groq, OpenRouter)
- [x] Backup & restore — export/import all data as JSON
- [x] **Appearance tab** — accent color picker, font size, chat density
- [ ] 🔥 **Proper settings UI** — tabbed form controls for all options (General · Providers · Tools · RAG · Audio · Advanced)
- [ ] 🔥 **Provider connection test** — ping + model count button
- [ ] 🔥 **Onboarding wizard** — first-time setup guide
- [ ] Keyboard shortcut remapping
- [ ] Per-workspace configuration profiles

---

## 13. Security & Privacy

- [x] Proxy binds to `127.0.0.1` (no LAN exposure by default)
- [x] SSRF protection on `fetch_url`
- [x] VM sandbox for `run_javascript`
- [x] CORS locked to localhost
- [ ] 🔥 **Prompt injection warning** — detect and flag suspicious injected instructions
- [ ] Per-session API key (never persisted)
- [ ] Request/response logging toggle (opt-in, local only)
- [ ] Conversation data encryption at rest
- [ ] Audit log of all tool executions

---

## 14. Developer & Integration

- [x] SSE streaming API (`/v1/chat`)
- [x] OpenAI-compatible passthrough (`/v1/chat/completions`)
- [x] MCP stdio client
- [ ] 🔥 **OpenAPI/Swagger spec** for all proxy endpoints
- [ ] 🔥 **Docker image** with Ollama bundled
- [ ] WebSocket API alternative to SSE
- [ ] Plugin system (load `.js` modules at startup)
- [ ] CLI batch mode (`echo "prompt" | llm-hub --model llama3`)
- [ ] VS Code extension (send selected code to LLM Hub)

---

## 15. Quality & Testing

- [x] Node.js syntax validation CI (18, 20, 22)
- [x] JSON config validation in CI
- [ ] 🔥 **Unit tests** for RagEngine, ToolRegistry, SSRF guard
- [ ] 🔥 **Integration tests** for all HTTP endpoints
- [ ] End-to-end tests with Playwright
- [ ] Screenshot regression tests
- [ ] Performance benchmark suite (tokens/sec baseline)

---

## Quick Stats

| Status | Count |
|--------|-------|
| `[x]` Done | ~57 |
| `[~]` In review | 8 (PRs `#12`–`#19`) |
| `[ ]` Not started | ~63 |
| 🔥 High priority | ~30 |
| **Total** | **~120** |

---

## Open PRs Index

| PR | Feature | Status |
|----|---------|--------|
| #19 | Per-conversation system prompt | Open |
| #18 | Message reactions 👍/👎 | Open |
| #17 | Model library browser | Open |
| #16 | Conversation color labels + filter chips | Open |
| #15 | Per-model parameter profiles | Open |
| #14 | Responsive mobile layout | Open |
| #13 | GPU/VRAM monitoring | Open |
| #12 | Cloud API cost estimation | Open |
