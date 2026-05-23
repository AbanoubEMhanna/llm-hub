# LLM Hub — Vision TODO Checklist

> **Vision:** Make this app feel like **LM Studio + OpenCode** with a **modern Linear/Vercel-inspired UI** — local-first, fast, beautiful, and powerful enough for both casual chat and serious developer workflows.

**Legend:**
- `[x]` Done & shipped
- `[~]` In progress / open PR
- `[ ]` Not started
- 🔥 High priority — do this next

---

## Core Experience

### Providers & Connectivity
- [x] Ollama local provider
- [x] LM Studio local provider
- [x] OpenAI (GPT-4o, o3, etc.)
- [x] Anthropic Claude (Opus, Sonnet, Haiku)
- [x] Groq (ultra-fast inference)
- [x] OpenRouter (200+ models via one key)
- [x] Custom OpenAI-compatible endpoint (any local or remote server)
- [x] API key management (localStorage, sent via header only)
- [x] Per-provider connection test button
- [ ] 🔥 Mistral / Together / Fireworks / Cohere providers
- [ ] Provider health monitoring with auto-reconnect
- [ ] Per-provider timeout and retry configuration

### Model Management *(LM Studio-style)*
- [x] Unified model dropdown across all providers
- [x] Running model detection (loaded in RAM/VRAM)
- [x] Model metadata (size, params, context, quant)
- [x] Model pull / download with live progress bar (Ollama)
- [x] Model delete from disk (Ollama)
- [x] Model capability badges (vision, tools, code, long-ctx)
- [x] Model family grouping (Llama, Qwen, Mistral…)
- [x] Model library browser (30+ curated models)
- [ ] 🔥 Model benchmark runner — tokens/sec speed test per model
- [ ] 🔥 Hardware-aware suggestions — recommend models that fit in VRAM
- [ ] GGUF drag-and-drop import
- [ ] Favorite / pin models to top
- [ ] Model tags and friendly aliases

---

## Chat Interface

### Conversations
- [x] Token streaming via SSE
- [x] Stop generation mid-stream
- [x] Persistent chat history (localStorage)
- [x] Conversation auto-title from first message
- [x] Conversation rename (double-click inline)
- [x] Conversation pinning
- [x] Conversation color labels + filter chips
- [x] Per-conversation system prompt
- [x] Collapsible long messages (auto-collapse > 22 lines)
- [x] Message reactions (👍/👎)
- [x] In-conversation message search (⌘F)
- [ ] 🔥 Conversation branching — fork from any message
- [ ] 🔥 Conversation folders / nested organization
- [ ] 🔥 Multi-tab chat (several conversations side-by-side)
- [ ] Bulk conversation management (select → delete / export)
- [ ] Import from ChatGPT export JSON
- [ ] Context window timeline (show which messages fit)
- [ ] Message timestamps toggle

### Messages
- [x] Message edit & regenerate
- [x] Message copy
- [x] Continue generation
- [x] Syntax-highlighted code blocks (14 languages)
- [x] Artifact rendering (HTML, SVG, JSX in sandboxed iframe)
- [ ] 🔥 Inline diff view for edited messages
- [ ] 🔥 Live code editing inside artifact preview
- [ ] One-click copy code → save to file

### Export
- [x] Export as Markdown
- [x] Export as JSON
- [x] Export as standalone HTML
- [ ] Export as PDF
- [ ] Share conversation via link (server-side)

---

## UI / Design *(Modern — Linear / Vercel-inspired)*

### Layout & Navigation
- [x] Dark and light themes
- [x] Linear/Vercel design tokens (Inter + JetBrains Mono)
- [x] Collapsible right-sidebar accordion panels
- [x] Full-screen focus mode (hide sidebars) — ⌘⇧F
- [x] Fully responsive mobile layout — drawer sidebars, touch-friendly
- [x] Command palette (⌘P) — fuzzy search all actions + conversations
- [x] Keyboard shortcuts modal (`?`)
- [x] Skeleton loading states (shimmer for model selector + stagger for conversation list)
- [ ] 🔥 Drag-to-resize sidebars (mouse drag, persisted to localStorage)
- [ ] 🔥 Animated page transitions and micro-interactions
- [ ] Custom welcome screen with quick-action cards
- [ ] Drag-and-drop conversation reordering

### Appearance Settings
- [x] Accent color picker
- [x] Font size preference (Small / Medium / Large)
- [x] Chat density (Compact / Comfortable / Spacious)
- [ ] 🔥 Custom theme (fully configurable color palette)
- [ ] Keyboard shortcut remapping

### Settings UI
- [x] Settings modal with tabs (General · Providers · Tools · RAG · Audio · Advanced)
- [x] Raw JSON config editor
- [x] Config hot-reload (MCP restart on save)
- [x] Backup & restore (export/import all settings + conversations)
- [ ] Onboarding wizard for first-time setup
- [ ] Per-workspace configuration profiles

---

## Generation & Parameters

### Sampling
- [x] Temperature slider
- [x] Max tokens input
- [x] Top-P, Top-K, Repeat penalty, Frequency penalty
- [x] Sampling presets — Precise / Balanced / Creative
- [x] Per-model parameter profiles (auto-save/restore)
- [ ] Seed control (reproducible outputs)
- [ ] Stop sequences configuration
- [ ] Context length override per conversation

### Generation Modes
- [x] Plan mode — think step-by-step before responding
- [x] JSON mode — force `response_format: json_object`
- [ ] 🔥 Structured output with JSON schema (enforce specific JSON shape)
- [ ] 🔥 Grammar-constrained generation (GBNF / regex)
- [ ] Prefill / FIM (fill-in-the-middle) mode

---

## AI Agent & Tools *(OpenCode-inspired)*

### Built-in Tools
- [x] Autonomous agent loop (up to 8 rounds)
- [x] `datetime`, `calculator`, `web_search`, `fetch_url`, `run_javascript`, `rag_search`
- [x] Live tool-call visualization (input → result → elapsed)
- [x] Tool enable/disable per-session toggle
- [ ] 🔥 Custom tool builder UI (name, description, JSON schema, handler URL)
- [ ] 🔥 Shell command tool (opt-in, confirm per execution)
- [ ] Tool result caching (skip re-runs for identical inputs)
- [ ] Agent memory persistence across sessions

### MCP (Model Context Protocol)
- [x] MCP stdio client (spawn external MCP servers)
- [ ] MCP server marketplace / discovery browser
- [ ] Browser automation via Playwright MCP
- [ ] Agent graph visualization (node/edge view)

### Code Features *(OpenCode-inspired)*
- [x] Syntax-highlighted code blocks
- [x] Artifact rendering (HTML / SVG / JSX sandbox)
- [x] Prompt templates with `{{variable}}` placeholders
- [ ] 🔥 File tree sidebar (local filesystem via MCP)
- [ ] 🔥 Multi-file context — select files to attach
- [ ] 🔥 Git integration — diff, stage, commit, PR review
- [ ] 🔥 Diff viewer — before/after with syntax highlighting
- [ ] Terminal pane — run shell commands, see output inline
- [ ] Multi-language REPL (Python, JS, etc. in sandbox)

---

## RAG / Knowledge Base

- [x] File upload and chunking (`.txt`, `.md`, `.json`, code)
- [x] Ollama embeddings (`nomic-embed-text` default)
- [x] Cosine-similarity vector search
- [x] Collection management (create, query, delete)
- [x] SSE upload progress
- [ ] 🔥 Web page crawl — paste URL, auto-scrape into KB
- [ ] 🔥 PDF attachment support — extract text, embed, attach
- [ ] GitHub repository indexing
- [ ] Hybrid search (BM25 + vector)
- [ ] Auto-inject relevant chunks into every message (toggle)
- [ ] Re-embedding on model change

---

## Voice & Multimodal

- [x] Image attachments (paste, drag-and-drop, file picker)
- [x] Vision model support (llava, qwen2-vl, llama3.2-vision)
- [x] Voice input via Web Speech API
- [x] Whisper server integration (local transcription)
- [ ] 🔥 Text-to-speech output (read responses aloud)
- [ ] 🔥 PDF attachment (extract text → context)
- [ ] Audio file transcription by drag-and-drop
- [ ] Screen capture / screenshot attach from clipboard

---

## Performance & Hardware *(LM Studio-style)*

- [x] Input token counter (live estimate while typing)
- [x] Generation stats (tokens, elapsed time, tok/s)
- [x] System RAM usage bar
- [x] Context usage indicator (warns at >75%)
- [x] Real-time tokens/sec counter during generation
- [x] GPU / VRAM usage monitoring panel
- [x] Cloud API cost estimation per response (USD)
- [ ] Response latency histogram per model
- [ ] Performance dashboard — charts over time
- [ ] CPU / GPU temperature display

---

## Model Comparison

- [x] Side-by-side split-screen comparison
- [x] Parallel streaming to two models simultaneously
- [x] Per-pane latency and token stats
- [ ] 🔥 Response quality grading (thumbs up/down per pane)
- [ ] 🔥 Diff view between two model responses
- [ ] Save comparison as formatted report
- [ ] A/B test mode (random model, reveal after both respond)
- [ ] Multi-model tournament (bracket-style)

---

## Developer & Integration

- [x] SSE streaming API (`/v1/chat`)
- [x] OpenAI-compatible passthrough (`/v1/chat/completions`)
- [x] MCP stdio client
- [ ] 🔥 OpenAPI / Swagger spec for all proxy endpoints
- [ ] WebSocket API alternative to SSE
- [ ] Plugin system (load `.js` modules at startup)
- [ ] CLI batch mode (`echo "prompt" | llm-hub --model llama3`)
- [ ] VS Code extension (send selected code to LLM Hub)
- [ ] Docker image with Ollama bundled
- [ ] `npx llm-hub` zero-install launcher

---

## Security & Privacy

- [x] Binds to `127.0.0.1` by default (no LAN exposure)
- [x] SSRF protection on `fetch_url`
- [x] VM sandbox for `run_javascript`
- [x] CORS locked to localhost
- [ ] Per-session API key (never persisted)
- [ ] Prompt injection warning detection
- [ ] Conversation data encryption at rest
- [ ] Audit log of all tool executions

---

## Quality & Testing

- [x] Node.js syntax validation CI (18, 20, 22)
- [x] JSON config validation in CI
- [ ] 🔥 Unit tests — RagEngine, ToolRegistry, SSRF guard
- [ ] 🔥 Integration tests for HTTP endpoints
- [ ] End-to-end tests with Playwright
- [ ] Performance benchmark suite

---

## Quick Stats

| Category | Done | High Priority | Backlog |
|----------|------|---------------|---------|
| Providers | 8 | 3 | 0 |
| Model Management | 8 | 2 | 3 |
| Chat Interface | 15 | 5 | 6 |
| UI / Design | 11 | 4 | 3 |
| Generation | 8 | 2 | 3 |
| Agent & Tools | 6 | 5 | 4 |
| RAG | 5 | 2 | 5 |
| Voice & Multimodal | 4 | 2 | 2 |
| Performance | 6 | 0 | 2 |
| Comparison | 3 | 2 | 3 |
| Developer | 3 | 1 | 5 |
| Security | 4 | 0 | 4 |
| Quality | 2 | 2 | 2 |
| **Total** | **~83** | **~30** | **~42** |

---

*Last updated: 2026-05-23*
