# LLM Hub — Product Vision & Feature Checklist

> **Vision:** Build the best local-first AI workbench — combining **LM Studio's** model management and hardware awareness with **OpenCode's** code-first agent workflow, all wrapped in a polished **Linear/Vercel-inspired UI** that feels fast, focused, and professional.

---

## 1. Core Infrastructure

- [x] Ollama provider integration
- [x] LM Studio provider integration
- [x] Multi-provider model aggregation (single unified dropdown)
- [x] OpenAI-compatible `/v1/chat/completions` passthrough
- [x] Proxy binds to `127.0.0.1` by default (secure by default)
- [x] **OpenAI provider** (cloud, with API key)
- [x] **Anthropic Claude provider** (cloud, with API key — format conversion included)
- [x] **Groq provider** (ultra-fast inference)
- [x] **OpenRouter provider** (unified cloud gateway)
- [ ] **Mistral / Together / Fireworks providers**
- [x] API key management (localStorage, transmitted via header — never on disk)
- [ ] Custom provider endpoint configuration from UI
- [ ] Provider health monitoring with auto-reconnect
- [ ] Per-provider timeout and retry settings
- [ ] `npx local-llm-hub` zero-install launcher

---

## 2. Model Management *(LM Studio-inspired)*

- [x] Model listing from all connected providers
- [x] Running model detection (currently loaded in RAM/VRAM)
- [x] Model metadata display (size, params, context, quantization)
- [x] Model loading banner with live progress
- [x] **Model pull / download with live progress bar** (Ollama)
- [x] **Model delete from disk** (Ollama)
- [ ] **Model library browser** — search ollama.com/library inline
- [ ] **GGUF file drag-and-drop import** (load any GGUF into LM Studio)
- [ ] Model tags and aliasing (give friendly names to models)
- [ ] Update check — notify when a newer version of a model exists
- [ ] Favorite / pin models to top of selector
- [ ] **Model benchmark runner** — tokens/sec speed test per model
- [ ] Recommended model suggestions based on task type
- [x] Model capability badges (vision, tools, code, long-context)
- [x] Model family grouping in the dropdown (Llama 3, Qwen, Mistral…)
- [ ] **Hardware-aware model suggestions** — recommend models that fit in available VRAM

---

## 3. Chat Interface

- [x] Token streaming via SSE
- [x] Stop generation mid-stream
- [x] Persistent chat history (localStorage)
- [x] Chat export — Markdown and JSON
- [x] Message edit & regenerate
- [x] Message copy
- [x] Continue generation
- [x] Conversation pinning
- [x] Auto-title from first message
- [x] Chat fuzzy search (⌘K)
- [x] **Conversation title rename** on double-click
- [ ] **Conversation folders** / tag-based organization
- [ ] **Conversation branching** — fork from any message
- [ ] Import conversations from JSON / ChatGPT export
- [ ] **Share conversation** as a self-contained HTML file
- [ ] Multi-tab chat (several conversations open side-by-side)
- [ ] Message reactions (👍 👎 — RLHF-style feedback)
- [ ] Bulk conversation management (select all → delete / export)
- [ ] Context window timeline visualization (which messages fit in context)
- [ ] Inline message threading / replies

---

## 4. Model Comparison

- [x] Side-by-side split-screen comparison
- [x] Parallel streaming to two models simultaneously
- [ ] Response quality grading (thumbs up/down per pane)
- [ ] **Diff view** between two model responses
- [ ] Save comparison as a formatted report
- [ ] A/B test mode (random model selection, reveal after both respond)
- [ ] Multi-model tournament (bracket-style comparison)
- [ ] Latency histogram per model

---

## 5. UI / Design *(Modern — Linear/Vercel-inspired)*

- [x] Dark and light themes
- [x] Linear/Vercel-inspired design tokens (Inter + JetBrains Mono)
- [x] Collapsible right-sidebar accordion panels
- [x] Keyboard shortcuts (⌘P, ⌘K, ⌘J, ⌘R, ⌘E, ⌘/)
- [x] Keyboard shortcuts help modal (`?`)
- [x] **Sampling presets** — Precise / Balanced / Creative one-click buttons
- [x] **Command palette** (⌘P) with fuzzy action search
- [ ] **Fully responsive mobile layout** (hamburger sidebar, touch-friendly)
- [ ] Customizable accent color (color picker in settings)
- [ ] Font size and chat density preferences (Compact / Comfortable / Spacious)
- [ ] Animated page transitions and micro-interactions
- [x] **Full-screen focus mode** — hide all sidebars, center content (⌘⇧F)
- [x] Collapsible long messages (auto-collapse messages > ~22 lines)
- [ ] Custom welcome screen with quick-action card configuration
- [ ] Inline message diff view for edited messages
- [ ] Skeleton loading states instead of spinners
- [ ] Drag-to-resize sidebars

---

## 6. AI Agent & Tools

- [x] Autonomous agent loop (up to 8 tool-call rounds)
- [x] Built-in tools: `datetime`, `calculator`, `web_search`, `fetch_url`, `run_javascript`, `rag_search`
- [x] Live tool-call visualization (input → result → elapsed time)
- [x] MCP stdio client (spawn external MCP servers)
- [x] Tool enable/disable per-session toggle
- [ ] **Custom tool builder UI** — define name, description, JSON schema, handler URL
- [ ] Tool result caching (skip re-runs for identical inputs within a session)
- [ ] **MCP server marketplace** / discovery browser
- [ ] Agent memory persistence across sessions (long-term notes store)
- [ ] Sub-agent spawning (parallel execution of agent tasks)
- [ ] Browser automation via Playwright MCP
- [ ] **Shell command tool** (opt-in, with confirmation prompt)
- [ ] Agent run history with step-by-step replay
- [ ] Agent graph visualization (node/edge view of tool call chain)

---

## 7. Code Features *(OpenCode-inspired)*

- [x] Syntax-highlighted code blocks (14 languages via Prism.js)
- [x] Artifact rendering (HTML, SVG, JSX, TSX in sandboxed iframe)
- [x] Prompt templates with `{{variable}}` placeholders
- [ ] **Live code editing** inside artifact preview (edit + re-render inline)
- [ ] **File tree sidebar** — browse local filesystem via MCP filesystem server
- [ ] **Multi-file context** — select files to attach as context to the conversation
- [ ] **Terminal pane** — run shell commands, see output inline
- [ ] **Git integration** — show diff, stage, commit, PR review workflow
- [ ] Code lens — inline AI-powered suggestions in code blocks
- [ ] Test runner output display
- [ ] Linter / formatter auto-suggestions on code paste
- [ ] **Diff viewer** — before/after code comparison with syntax highlight
- [ ] Copy code → file save dialog (write directly to disk)
- [ ] Multi-language REPL (run code in Python, JS, etc. via sandboxed env)

---

## 8. RAG / Knowledge Base

- [x] File upload and chunking (`.txt`, `.md`, `.json`, code files)
- [x] Ollama embedding (`nomic-embed-text` by default)
- [x] Cosine-similarity vector search
- [x] Collection management (create, query, delete)
- [x] SSE upload progress
- [ ] **Web page crawl** — paste URL, auto-scrape into knowledge base
- [ ] **GitHub repository indexing** — clone + embed all files
- [ ] **PDF attachment support** — extract text, embed, attach as context
- [ ] Auto-inject most-relevant chunks into every message (toggle)
- [ ] Chunk preview and manual editing UI
- [ ] Knowledge base stats (total chunks, sources, last updated)
- [ ] Re-embedding on embedding model change
- [ ] Hybrid search (keyword + vector BM25)
- [ ] Multi-collection query (search across all collections at once)

---

## 9. Parameters & Presets

- [x] Temperature slider
- [x] Max tokens input
- [x] System prompt presets (save / load)
- [x] Prompt templates with variable substitution
- [x] Plan mode (think step-by-step prefix)
- [x] **Sampling presets: Precise / Balanced / Creative**
- [ ] Per-model parameter profiles (save temperature + max tokens per model)
- [x] Advanced parameters: Top-P, Top-K, Repeat penalty, Frequency penalty
- [ ] Context length override per conversation
- [ ] **Structured output mode** — force JSON schema response (JSON mode)
- [ ] Seed control (reproducible outputs)
- [ ] Stop sequences configuration
- [ ] System prompt library with community presets

---

## 10. Voice & Multimodal

- [x] Image attachments (paste, drag-and-drop, file picker)
- [x] Vision model support (llava, qwen2-vl, llama3.2-vision)
- [x] Voice input via browser Web Speech API
- [x] Whisper server integration (local transcription)
- [ ] **Text-to-speech output** — read responses aloud (TTS synthesis)
- [ ] **PDF attachment** — extract text, attach as context
- [ ] Audio file transcription by drag-and-drop
- [ ] Video file frame extraction for vision models
- [ ] Screen capture / screenshot attach (from clipboard)

---

## 11. Performance & Hardware Stats *(LM Studio-inspired)*

- [x] Input token counter (live estimate while typing)
- [x] Generation stats (total tokens, elapsed time)
- [x] System RAM usage bar
- [x] Context usage indicator (warns at >75%)
- [x] **Real-time tokens/sec counter** during generation
- [ ] **GPU / VRAM usage monitoring** (Ollama VRAM via API)
- [ ] Response latency histogram (per-model statistics panel)
- [ ] Session token usage totals (prompt + completion)
- [ ] **Cost estimation** for cloud API providers (per-model pricing table)
- [ ] Performance dashboard — charts comparing models over time
- [ ] CPU / GPU temperature display (where available)

---

## 12. Settings UI

- [x] Raw JSON config editor modal
- [x] Config hot-reload (MCP servers restart on save)
- [ ] **Proper settings UI with tabs** — General · Providers · Tools · RAG · Audio · Advanced
- [ ] Provider connection test button (ping + model count)
- [ ] Theme customizer (accent color, font, density)
- [ ] Keyboard shortcut remapping
- [x] **Backup & restore** all settings + conversations as a single JSON
- [ ] Onboarding wizard for first-time setup
- [ ] Per-workspace configuration profiles

---

## 13. Security & Privacy

- [x] Binds to `127.0.0.1` by default
- [x] SSRF protection on `fetch_url`
- [x] VM sandbox for `run_javascript`
- [x] CORS locked to localhost
- [ ] Per-session API key (never persisted to disk)
- [ ] Request / response logging toggle (opt-in, stored locally)
- [ ] Prompt injection warning detection
- [ ] Conversation data encryption at rest
- [ ] Audit log of all tool executions

---

## 14. Developer & Integration

- [x] SSE streaming API (`/v1/chat`)
- [x] OpenAI-compatible passthrough (`/v1/chat/completions`)
- [x] MCP stdio client
- [ ] OpenAPI / Swagger spec for all proxy endpoints
- [ ] WebSocket API alternative to SSE
- [ ] Plugin system (load `.js` modules at startup)
- [ ] CLI batch mode (`echo "prompt" | local-llm-hub --model llama3`)
- [ ] VS Code extension (send selected code to LLM Hub)
- [ ] Docker image with Ollama bundled

---

## 15. Quality & Testing

- [x] Node.js syntax validation CI (18, 20, 22)
- [x] JSON config validation in CI
- [ ] Unit tests for core utilities (RagEngine, ToolRegistry, SSRF guard)
- [ ] Integration tests for HTTP endpoints
- [ ] End-to-end tests with Playwright
- [ ] Automated screenshot regression tests
- [ ] Performance benchmark suite (tokens/sec baseline)

---

## Priority Legend

| Symbol | Meaning |
|--------|---------|
| [x] | Done / shipped |
| [ ] | Not started |
| **Bold** | High priority — next to implement |
