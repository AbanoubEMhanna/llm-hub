# LLM Hub — Product Checklist

> **Vision:** Build the best local-first AI workbench — the look and feel of **LM Studio** (model management, hardware awareness) combined with **OpenCode** (code-first, agent-powered workflow), wrapped in a sharp **Linear/Vercel-inspired UI** that feels fast, focused, and professional.

**Legend:**
- `[x]` Done / shipped
- `[~]` In review (open PR, not yet merged)
- `[ ]` Not started
- `🔥` High priority — build this next

---

## 1. Core Infrastructure

- [x] Ollama provider integration
- [x] LM Studio provider integration (OpenAI-compatible)
- [x] Multi-provider model aggregation — single unified dropdown
- [x] OpenAI-compatible `/v1/chat/completions` passthrough
- [x] Proxy server binds to `127.0.0.1` by default (no accidental LAN exposure)
- [x] **OpenAI** cloud provider (GPT-4o, o3, o4-mini…)
- [x] **Anthropic Claude** cloud provider (opus-4, sonnet-4, haiku-4…)
- [x] **Groq** cloud provider (ultra-fast llama/deepseek inference)
- [x] **OpenRouter** cloud provider (200+ models via one API key)
- [x] API key management — stored in localStorage, transmitted via request header only
- [ ] 🔥 Mistral / Together / Fireworks / Cohere providers
- [ ] 🔥 Custom provider endpoint — add any OpenAI-compatible URL from the UI
- [ ] Provider health monitoring with auto-reconnect and exponential back-off
- [ ] Per-provider request timeout and retry configuration
- [ ] `npx local-llm-hub` zero-install launcher (no global install needed)

---

## 2. Model Management *(LM Studio-inspired)*

- [x] Model listing from all connected providers
- [x] Running model detection (currently loaded in RAM/VRAM)
- [x] Model metadata display (size, params, context length, quantization)
- [x] Model loading banner with animated progress bar
- [x] Model pull / download with live byte-level progress (Ollama)
- [x] Model delete from disk (Ollama)
- [x] Model capability badges (vision, tools, code, long-context)
- [x] Model family grouping in dropdown (Llama, Qwen, Mistral, GPT…)
- [~] GPU / VRAM monitoring — live VRAM usage per loaded model (PR #13)
- [x] 🔥 **Model library browser** — browse and pull popular Ollama models in-app
- [ ] 🔥 **Hardware-aware model suggestions** — recommend models that fit in free VRAM
- [ ] 🔥 **Model benchmark runner** — measure tokens/sec, TTFT per model
- [ ] Favorite / pin models to the top of the selector
- [ ] GGUF drag-and-drop import into LM Studio
- [ ] Model tags and friendly name aliasing
- [ ] Update check — notify when a newer version of a model is available
- [ ] Recommended model suggestions based on the current task type

---

## 3. Chat Interface

- [x] Token streaming via Server-Sent Events (SSE)
- [x] Stop generation mid-stream
- [x] Persistent chat history stored in `localStorage`
- [x] Chat export — Markdown and JSON formats
- [x] Chat export — standalone HTML (fully offline, dark + light theme)
- [x] Message edit & regenerate from any point in the conversation
- [x] Message copy to clipboard
- [x] Continue generation (append to last AI response)
- [x] Conversation pinning
- [x] Auto-title from the first user message
- [x] Chat fuzzy search across all conversations (⌘K)
- [x] Conversation title rename on double-click
- [x] Collapsible long messages (auto-collapse >~22 lines with Show more / Show less)
- [x] **Conversation color labels** — tag chats with Work / Code / Research / Ideas / Personal, filter by label in sidebar
- [ ] 🔥 **Conversation folders** — tree-based folder hierarchy for organizing chats
- [ ] 🔥 **Conversation branching** — fork from any message, explore alternatives
- [ ] 🔥 Message search within a single conversation
- [ ] Import conversations from JSON or ChatGPT export
- [ ] Multi-tab chat — several conversations open side-by-side
- [ ] Message reactions (👍 👎) for RLHF-style feedback collection
- [ ] Bulk conversation management (multi-select → delete / export)
- [ ] Context window timeline visualization — which messages fit in the current window
- [ ] Inline message threading / reply chains

---

## 4. Model Comparison

- [x] Side-by-side split-screen comparison
- [x] Parallel streaming to two models simultaneously
- [x] Per-pane latency and token stats
- [ ] 🔥 **Diff view** between two model responses (word-level diff)
- [ ] Response quality grading (👍 / 👎 per pane)
- [ ] Save comparison as a formatted report (Markdown / PDF)
- [ ] A/B test mode — random model selection, reveal identity after both respond
- [ ] Multi-model tournament (bracket-style, N models)
- [ ] Latency histogram — response time distribution per model over N runs

---

## 5. UI & Design *(Linear / Vercel-inspired)*

- [x] Dark and light themes with instant toggle
- [x] Design tokens — Inter + JetBrains Mono, CSS custom properties throughout
- [x] Collapsible right-sidebar accordion panels
- [x] Keyboard shortcuts — ⌘P, ⌘K, ⌘J, ⌘R, ⌘E, ⌘/
- [x] Keyboard shortcuts modal (`?`)
- [x] Sampling presets — Precise / Balanced / Creative one-click chips
- [x] Command palette (⌘P) with fuzzy search across all actions
- [x] Full-screen focus mode — hide sidebars (⌘⇧F)
- [~] Fully responsive mobile layout — hamburger drawer sidebars, touch-friendly (PR #14)
- [ ] 🔥 Drag-to-resize sidebars
- [ ] 🔥 Skeleton loading states instead of spinners
- [ ] Customizable accent color via settings color picker
- [ ] Font size + chat density preferences (Compact / Comfortable / Spacious)
- [ ] Animated page transitions and micro-interactions
- [ ] Custom welcome screen — configurable quick-action cards
- [ ] Inline message diff view for edited messages
- [ ] Notification badge on conversation list for unread (imported) messages

---

## 6. AI Agent & Tools

- [x] Autonomous agent loop (up to 8 tool-call rounds)
- [x] Built-in tools: `datetime`, `calculator`, `web_search`, `fetch_url`, `run_javascript`, `rag_search`
- [x] Live tool-call visualization — input → result → elapsed time
- [x] MCP stdio client — spawn any external MCP server
- [x] Tool enable / disable per-session toggle
- [ ] 🔥 **Custom tool builder UI** — define name, description, JSON schema, HTTP handler URL
- [ ] 🔥 **Shell command tool** — opt-in, confirmation dialog before every execution
- [ ] 🔥 **Agent run history** — step-by-step replay of past agent sessions
- [ ] Tool result caching — skip re-runs for identical inputs within a session
- [ ] MCP server marketplace / discovery browser
- [ ] Agent memory persistence across sessions (long-term notes store)
- [ ] Sub-agent spawning for parallel task execution
- [ ] Browser automation via Playwright MCP
- [ ] Agent graph visualization — node/edge view of the tool call chain

---

## 7. Code Features *(OpenCode-inspired)*

- [x] Syntax-highlighted code blocks — 14+ languages via Prism.js
- [x] Artifact rendering — HTML, SVG, JSX, TSX in sandboxed `<iframe>`
- [x] Prompt templates with `{{variable}}` placeholder substitution
- [ ] 🔥 **Live code editing** inside artifact preview — edit and re-render inline
- [ ] 🔥 **File tree sidebar** — browse local filesystem via MCP filesystem server
- [ ] 🔥 **Multi-file context** — select files from disk to attach as conversation context
- [ ] 🔥 **Git integration** — view diff, stage changes, commit, PR review workflow
- [ ] 🔥 **Diff viewer** — before/after code comparison with syntax highlighting
- [ ] Terminal pane — run shell commands and see output inline
- [ ] Code lens — inline AI-powered suggestions within code blocks
- [ ] Test runner output display — parse and format test results
- [ ] Linter / formatter auto-suggestions on code paste
- [ ] Copy code → file save dialog (write directly to disk)
- [ ] Multi-language REPL — run Python, JS, etc. in a sandboxed environment

---

## 8. RAG / Knowledge Base

- [x] File upload and chunking (`.txt`, `.md`, `.json`, `.js`, `.ts`, `.py`, etc.)
- [x] Ollama embedding via `nomic-embed-text` (or any embedding model)
- [x] Cosine-similarity vector search
- [x] Collection management — create, query, delete
- [x] SSE upload progress with chunk count
- [ ] 🔥 **Web page crawl** — paste URL, auto-scrape + embed into knowledge base
- [ ] 🔥 **PDF attachment** — extract text, embed, attach as conversation context
- [ ] GitHub repository indexing — clone + embed all source files
- [ ] Auto-inject most-relevant chunks into every message (toggle)
- [ ] Chunk preview and manual editing UI
- [ ] Knowledge base stats (total chunks, sources, last updated timestamp)
- [ ] Re-embedding when the embedding model changes
- [ ] Hybrid search (keyword BM25 + vector combined score)
- [ ] Multi-collection query — search across all collections at once

---

## 9. Parameters & Presets

- [x] Temperature slider (0 – 2)
- [x] Max tokens input with preset-aware reset
- [x] System prompt presets — save and load named presets
- [x] Prompt templates with variable substitution
- [x] Plan mode — adds a "think step-by-step" prefix automatically
- [x] Sampling presets: Precise / Balanced / Creative (one-click)
- [x] Advanced parameters — Top-P, Top-K, Repeat penalty, Frequency penalty
- [~] Per-model parameter profiles — auto-save and restore all sliders per model (PR #15)
- [ ] 🔥 **Structured output mode** — force JSON schema response (JSON mode)
- [ ] Context length override per conversation
- [ ] Seed control for reproducible outputs
- [ ] Stop sequences configuration
- [ ] System prompt library — community-curated presets
- [ ] Session cost accumulator — running total of API spend shown in stats bar

---

## 10. Voice & Multimodal

- [x] Image attachments — paste, drag-and-drop, or file picker
- [x] Vision model support — llava, qwen2-vl, llama3.2-vision, etc.
- [x] Voice input via browser Web Speech API
- [x] Whisper server integration — local transcription
- [ ] 🔥 **Text-to-speech output** — read responses aloud (browser TTS + Kokoro/Coqui support)
- [ ] 🔥 **PDF attachment** — extract text and attach as context
- [ ] Audio file transcription by drag-and-drop
- [ ] Video file frame extraction for vision models
- [ ] Screen capture / screenshot attach from clipboard

---

## 11. Performance & Hardware Stats *(LM Studio-inspired)*

- [x] Input token counter — live estimate while typing
- [x] Generation stats — total tokens, elapsed time, tokens/sec
- [x] System RAM usage bar with warning at >75%
- [x] Context usage indicator — warns at >75% of model's context window
- [x] Real-time tokens/sec counter during generation
- [~] GPU / VRAM usage monitoring — per-model VRAM breakdown (PR #13)
- [~] Cloud API cost estimation — per-response USD cost for OpenAI / Anthropic / Groq (PR #12)
- [ ] 🔥 Session cost accumulator — running total of cloud API spend
- [ ] Response latency histogram (per-model statistics panel)
- [ ] Session token totals (prompt + completion, this session)
- [ ] Performance dashboard — charts comparing models over time
- [ ] CPU / GPU temperature display (where available via system API)

---

## 12. Settings & Configuration

- [x] Raw JSON config editor with hot-reload (MCP servers restart on save)
- [x] API key management tab (per-provider keys stored in localStorage)
- [x] Backup & restore — export + import all conversations, presets, and templates as JSON
- [ ] 🔥 **Proper settings UI with tabs** — General · Providers · Tools · RAG · Audio · Advanced
- [ ] 🔥 Provider connection test button — ping each provider and show model count
- [ ] Theme customizer — accent color, font, chat density
- [ ] Keyboard shortcut remapping
- [ ] Onboarding wizard for first-time setup
- [ ] Per-workspace configuration profiles

---

## 13. Security & Privacy

- [x] Proxy binds to `127.0.0.1` by default — no LAN exposure without explicit opt-in
- [x] SSRF protection on the `fetch_url` built-in tool
- [x] VM sandbox (`vm.runInNewContext`) for the `run_javascript` tool
- [x] CORS locked to `localhost` origins only
- [ ] Per-session API key — option to enter key once per tab, never persisted
- [ ] Request / response logging toggle — opt-in, stored locally only
- [ ] Prompt injection warning detection
- [ ] Conversation data encryption at rest (via IndexedDB + SubtleCrypto)
- [ ] Audit log of all tool executions with timestamps

---

## 14. Developer & Integration

- [x] SSE streaming API at `/v1/chat`
- [x] OpenAI-compatible passthrough at `/v1/chat/completions`
- [x] MCP stdio client — spawn any MCP-compatible tool server
- [ ] 🔥 OpenAPI / Swagger spec for all proxy endpoints
- [ ] WebSocket API as an alternative to SSE
- [ ] Plugin system — load `.js` modules at startup
- [ ] CLI batch mode — `echo "prompt" | local-llm-hub --model llama3`
- [ ] VS Code extension — send selected code to LLM Hub with one shortcut
- [ ] Docker image with Ollama bundled (single-command local AI stack)

---

## 15. Quality & Testing

- [x] Node.js syntax validation CI — runs on Node 18, 20, 22
- [x] JSON config validation in CI
- [ ] 🔥 Unit tests for core utilities (RagEngine, ToolRegistry, SSRF guard)
- [ ] 🔥 Integration tests for HTTP endpoints
- [ ] End-to-end tests with Playwright
- [ ] Automated screenshot regression tests
- [ ] Performance benchmark suite — tokens/sec baseline per model family

---

## Quick Stats

| Status | Count |
|--------|-------|
| `[x]` Done | ~52 |
| `[~]` In review (open PRs) | 4 |
| `[ ]` Not started | ~55 |
| **Total** | **~111** |

---

## Open PRs

| # | Feature | Branch |
|---|---------|--------|
| #12 | Cloud API cost estimation + showToast fix | `claude/eager-wright-vnKoe` |
| #13 | GPU / VRAM monitoring — live sidebar panel | `claude/eager-wright-OI4IN` |
| #14 | Fully responsive mobile layout — drawer sidebars | `claude/epic-keller-XLbXr` |
| #15 | Per-model parameter profiles — auto-save & restore | `claude/epic-keller-AHvdJ` |
