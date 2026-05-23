# LLM Hub — Master Feature Checklist

> **Vision:** The best local-first AI workbench — **LM Studio** model management & hardware awareness + **OpenCode** code-first agent workflow, wrapped in a **modern Linear/Vercel-inspired UI** that feels fast, focused, and professional.
>
> **Goal:** Feel like LM Studio + OpenCode, but prettier, faster, and more powerful.

**Legend:**
- `[x]` Done & merged to main
- `[~]` In review (open PR)
- `[ ]` Not started
- 🔥 High priority — next to implement

---

## Merged PRs (all in main)

| PR | Feature | Status |
|----|---------|--------|
| [#1](../../pull/1)   | Model Manager (pull/delete Ollama models) | ✅ Merged |
| [#2](../../pull/2)   | Sampling presets + FEATURES.md roadmap | ✅ Merged |
| [#3](../../pull/3)   | Enhanced compare mode with dedicated UI | ✅ Merged |
| [#4](../../pull/4)   | Live tok/s counter + conversation rename | ✅ Merged |
| [#5](../../pull/5)   | Advanced sampling params, focus mode | ✅ Merged |
| [#6](../../pull/6)   | Cloud provider support (OpenAI, Anthropic, Groq, OpenRouter) | ✅ Merged |
| [#7](../../pull/7)   | Collapsible long messages | ✅ Merged |
| [#8](../../pull/8)   | Model capability badges + family-sorted selector | ✅ Merged |
| [#9](../../pull/9)   | Command palette (⌘P) | ✅ Merged |
| [#10](../../pull/10) | Backup & restore (export/import JSON) | ✅ Merged |
| [#11](../../pull/11) | Export conversation as standalone HTML | ✅ Merged |
| [#12](../../pull/12) | Cloud API cost estimation + showToast fix | ✅ Merged |
| [#13](../../pull/13) | GPU/VRAM monitoring panel | ✅ Merged |
| [#14](../../pull/14) | Fully responsive mobile layout | ✅ Merged |
| [#15](../../pull/15) | Per-model parameter profiles (auto-save/restore) | ✅ Merged |
| [#16](../../pull/16) | Conversation color labels + sidebar filter chips | ✅ Merged |
| [#17](../../pull/17) | Model library browser (30+ curated models) | ✅ Merged |
| [#18](../../pull/18) | Message reactions (👍/👎) | ✅ Merged |
| [#19](../../pull/19) | Per-conversation system prompt | ✅ Merged |
| [#20](../../pull/20) | Appearance settings (accent color, font size, density) | ✅ Merged |
| [#21](../../pull/21) | In-conversation message search (⌘F) | ✅ Merged |
| [#22](../../pull/22) | JSON mode toggle (structured output) | ✅ Merged |

---

## 1. Core Infrastructure

- [x] Ollama provider integration
- [x] LM Studio provider integration
- [x] Multi-provider model aggregation (single unified dropdown)
- [x] OpenAI-compatible `/v1/chat/completions` passthrough
- [x] Proxy binds to `127.0.0.1` by default (secure by default)
- [x] OpenAI provider (cloud, with API key)
- [x] Anthropic Claude provider (cloud, with API key)
- [x] Groq provider (ultra-fast inference)
- [x] OpenRouter provider (unified cloud gateway)
- [x] API key management (localStorage, transmitted via header only)
- [ ] 🔥 Mistral / Together / Fireworks / Cohere providers
- [x] Custom provider endpoint configuration from UI (any OpenAI-compatible server)
- [ ] Provider health monitoring with auto-reconnect
- [ ] Per-provider timeout and retry settings
- [ ] `npx local-llm-hub` zero-install launcher
- [ ] WebSocket API alternative to SSE

---

## 2. Model Management *(LM Studio-inspired)*

- [x] Model listing from all connected providers
- [x] Running model detection (currently loaded in RAM/VRAM)
- [x] Model metadata display (size, params, context, quantization)
- [x] Model loading banner with live progress
- [x] Model pull / download with live progress bar (Ollama)
- [x] Model delete from disk (Ollama)
- [x] Model capability badges (vision, tools, code, long-context)
- [x] Model family grouping in dropdown (Llama 3, Qwen, Mistral…)
- [x] Model library browser — 30+ curated models, filter by category
- [ ] 🔥 Model benchmark runner — tokens/sec speed test
- [ ] 🔥 Hardware-aware model suggestions — recommend models that fit in VRAM
- [ ] GGUF file drag-and-drop import (load any GGUF into LM Studio)
- [ ] Model tags and aliasing (give friendly names)
- [ ] Favorite / pin models to top of selector
- [ ] Update check — notify when a newer model version exists
- [ ] Recommended model suggestions based on task type

---

## 3. Chat Interface

- [x] Token streaming via SSE
- [x] Stop generation mid-stream
- [x] Persistent chat history (localStorage)
- [x] Chat export — Markdown and JSON
- [x] Export conversation as standalone HTML
- [x] Message edit & regenerate
- [x] Message copy
- [x] Continue generation
- [x] Conversation pinning
- [x] Auto-title from first message
- [x] Conversation title rename (double-click inline)
- [x] Collapsible long messages (auto-collapse > 22 lines)
- [x] Message reactions (👍/👎) — persist per message
- [x] Per-conversation system prompt (auto-save/restore on switch)
- [x] In-conversation message search (⌘F)
- [x] Conversation color labels + sidebar filter chips
- [ ] 🔥 Conversation branching — fork from any message
- [ ] 🔥 Conversation folders / nested organization
- [ ] 🔥 Multi-tab chat (several conversations side-by-side)
- [ ] Import conversations from JSON / ChatGPT export
- [ ] Bulk conversation management (select all → delete / export)
- [ ] Context window timeline visualization (which messages fit)
- [ ] Inline message threading / replies
- [ ] Message timestamps toggle

---

## 4. Model Comparison

- [x] Side-by-side split-screen comparison
- [x] Parallel streaming to two models simultaneously
- [x] Per-pane latency and token stats
- [ ] 🔥 Response quality grading — thumbs up/down per pane
- [ ] 🔥 Diff view between two model responses
- [ ] Save comparison as a formatted report
- [ ] A/B test mode (random model selection, reveal after both respond)
- [ ] Multi-model tournament (bracket-style)
- [ ] Latency histogram per model

---

## 5. UI / Design *(Modern — Linear/Vercel-inspired)*

- [x] Dark and light themes
- [x] Linear/Vercel-inspired design tokens (Inter + JetBrains Mono)
- [x] Collapsible right-sidebar accordion panels
- [x] Keyboard shortcuts (⌘K, ⌘J, ⌘R, ⌘E, ⌘/)
- [x] Keyboard shortcuts help modal (`?`)
- [x] Sampling presets — Precise / Balanced / Creative
- [x] Command palette (⌘P) — fuzzy search all actions and conversations
- [x] Full-screen focus mode — hide all sidebars (⌘⇧F)
- [x] Fully responsive mobile layout — drawer sidebars, touch-friendly
- [x] Appearance settings — accent color, font size, chat density
- [ ] 🔥 Animated page transitions and micro-interactions
- [ ] 🔥 Skeleton loading states instead of spinners
- [~] 🔥 Drag-to-resize sidebars (4px handle, persisted, dblclick to reset)
- [ ] Custom welcome screen with quick-action cards
- [ ] Inline message diff view for edits
- [ ] Keyboard shortcut remapping

---

## 6. Generation Modes

- [x] Plan mode — model thinks step-by-step in `<plan>` tags before responding
- [x] JSON mode — forces `response_format: json_object` for structured output
- [ ] 🔥 Structured output with JSON schema — enforce specific JSON structure
- [ ] 🔥 Grammar-constrained generation (GBNF / regex)
- [ ] Seed control — reproducible outputs
- [ ] Stop sequences configuration
- [ ] Context length override per conversation

---

## 7. AI Agent & Tools

- [x] Autonomous agent loop (up to 8 tool-call rounds)
- [x] Built-in tools: `datetime`, `calculator`, `web_search`, `fetch_url`, `run_javascript`, `rag_search`
- [x] Live tool-call visualization (input → result → elapsed time)
- [x] MCP stdio client (spawn external MCP servers)
- [x] Tool enable/disable per-session toggle
- [ ] 🔥 Custom tool builder UI — define name, description, JSON schema, handler URL
- [ ] 🔥 Shell command tool — opt-in, with confirmation prompt
- [ ] 🔥 Agent run history — step-by-step replay of past sessions
- [ ] Tool result caching (skip re-runs for identical inputs)
- [ ] MCP server marketplace / discovery browser
- [ ] Agent memory persistence across sessions
- [ ] Sub-agent spawning (parallel execution)
- [ ] Browser automation via Playwright MCP
- [ ] Agent graph visualization (node/edge view of tool call chain)

---

## 8. Code Features *(OpenCode-inspired)*

- [x] Syntax-highlighted code blocks (14 languages via Prism.js)
- [x] Artifact rendering (HTML, SVG, JSX, TSX in sandboxed iframe)
- [x] Prompt templates with `{{variable}}` placeholders
- [ ] 🔥 Live code editing inside artifact preview (edit + re-render inline)
- [ ] 🔥 File tree sidebar — browse local filesystem via MCP filesystem server
- [ ] 🔥 Multi-file context — select files to attach as context
- [ ] 🔥 Git integration — show diff, stage, commit, PR review workflow
- [ ] 🔥 Diff viewer — before/after code comparison with syntax highlighting
- [ ] Terminal pane — run shell commands, see output inline
- [ ] Copy code → file save dialog (write directly to disk)
- [ ] Multi-language REPL (run Python, JS, etc. in sandboxed environment)
- [ ] Linter / formatter auto-suggestions on code paste

---

## 9. RAG / Knowledge Base

- [x] File upload and chunking (`.txt`, `.md`, `.json`, code files)
- [x] Ollama embedding (`nomic-embed-text` by default)
- [x] Cosine-similarity vector search
- [x] Collection management (create, query, delete)
- [x] SSE upload progress
- [ ] 🔥 Web page crawl — paste URL, auto-scrape into knowledge base
- [ ] 🔥 PDF attachment support — extract text, embed, attach as context
- [ ] GitHub repository indexing — clone + embed all files
- [ ] Auto-inject most-relevant chunks into every message (toggle)
- [ ] Chunk preview and manual editing UI
- [ ] Knowledge base stats (total chunks, sources, last updated)
- [ ] Hybrid search (keyword + vector BM25)
- [ ] Multi-collection query (search across all at once)

---

## 10. Parameters & Presets

- [x] Temperature slider
- [x] Max tokens input
- [x] System prompt presets (save / load)
- [x] Prompt templates with variable substitution
- [x] Plan mode (think step-by-step prefix)
- [x] JSON mode (force structured JSON output)
- [x] Sampling presets: Precise / Balanced / Creative
- [x] Advanced parameters — Top-P, Top-K, Repeat penalty, Frequency penalty
- [x] Per-model parameter profiles — auto-save temperature + max tokens per model
- [ ] 🔥 Structured output with explicit JSON schema editor
- [ ] System prompt library with community presets
- [ ] Context length override per conversation
- [ ] Stop sequences configuration

---

## 11. Voice & Multimodal

- [x] Image attachments (paste, drag-and-drop, file picker)
- [x] Vision model support (llava, qwen2-vl, llama3.2-vision)
- [x] Voice input via browser Web Speech API
- [x] Whisper server integration (local transcription)
- [ ] 🔥 Text-to-speech output — read responses aloud
- [ ] 🔥 PDF attachment — extract text and attach as context
- [ ] Audio file transcription by drag-and-drop
- [ ] Video file frame extraction for vision models
- [ ] Screen capture / screenshot attach

---

## 12. Performance & Hardware Stats *(LM Studio-inspired)*

- [x] Input token counter (live estimate while typing)
- [x] Generation stats (total tokens, elapsed time)
- [x] System RAM usage bar
- [x] Context usage indicator (warns at >75%)
- [x] Real-time tokens/sec counter during generation
- [x] GPU / VRAM usage monitoring — Ollama VRAM per loaded model
- [x] Cloud API cost estimation — per-message USD cost for OpenAI/Anthropic/Groq
- [ ] Session cost accumulator (running total per session)
- [ ] Response latency histogram per model
- [ ] Performance dashboard — charts comparing models over time
- [ ] CPU / GPU temperature display (where available)

---

## 13. Settings UI

- [x] Raw JSON config editor modal
- [x] Config hot-reload (MCP servers restart on save)
- [x] Backup & restore — all settings + conversations as JSON
- [x] Appearance settings tab — accent color, font size, chat density
- [ ] 🔥 Proper settings UI with tabs — General · Providers · Tools · RAG · Audio · Advanced
- [ ] 🔥 Provider connection test button — ping + model count
- [ ] Keyboard shortcut remapping
- [ ] Onboarding wizard for first-time setup
- [ ] Per-workspace configuration profiles

---

## 14. Security & Privacy

- [x] Binds to `127.0.0.1` by default (no LAN exposure without opt-in)
- [x] SSRF protection on `fetch_url`
- [x] VM sandbox for `run_javascript`
- [x] CORS locked to localhost
- [ ] 🔥 Per-session API key (never persisted to disk)
- [ ] Request / response logging toggle (opt-in, stored locally)
- [ ] Prompt injection warning detection
- [ ] Conversation data encryption at rest
- [ ] Audit log of all tool executions

---

## 15. Developer & Integration

- [x] SSE streaming API (`/v1/chat`)
- [x] OpenAI-compatible passthrough (`/v1/chat/completions`)
- [x] MCP stdio client
- [x] Node.js syntax validation CI (v18, v20, v22)
- [x] JSON config validation in CI
- [ ] 🔥 OpenAPI / Swagger spec for all proxy endpoints
- [ ] 🔥 Unit tests — RagEngine, ToolRegistry, SSRF guard
- [ ] 🔥 Integration tests for HTTP endpoints
- [ ] End-to-end tests with Playwright
- [ ] Docker image with Ollama bundled
- [ ] `npx local-llm-hub` zero-install launcher
- [ ] VS Code extension (send selected code to LLM Hub)
- [ ] Plugin system (load `.js` modules at startup)
- [ ] CLI batch mode (`echo "prompt" | llm-hub --model llama3`)

---

## Quick Stats

| Status | Count |
|--------|-------|
| `[x]` Done | ~64 |
| `[ ]` Not started | ~58 |
| **Total** | **~122** |

---

*All 22 PRs merged to main as of 2026-05-21. No open PRs. Next features tracked in [TODO.md](./TODO.md).*
