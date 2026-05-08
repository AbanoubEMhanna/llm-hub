# LLM Hub — TODO / Feature Checklist

> **Vision:** The best local-first AI workbench — **LM Studio** model management + hardware awareness, **OpenCode** code-first agent workflow, wrapped in a sharp **Linear/Vercel-inspired UI** that feels fast, focused, and professional.
>
> **Legend:** ✅ Done · 🔲 Not started · 🔥 High priority next

---

## 1. Core Infrastructure

- ✅ Ollama provider integration
- ✅ LM Studio provider integration
- ✅ Multi-provider model aggregation (single unified dropdown)
- ✅ OpenAI-compatible `/v1/chat/completions` passthrough
- ✅ Proxy binds to `127.0.0.1` by default (secure by default)
- ✅ **OpenAI provider** — cloud, with API key (stored in localStorage)
- ✅ **Anthropic Claude provider** — cloud, with API key (with OpenAI format conversion)
- ✅ **Groq provider** — ultra-fast inference
- ✅ **OpenRouter provider** — unified cloud gateway
- 🔲 Mistral / Together / Fireworks providers
- ✅ **API key management** — stored in localStorage, transmitted to proxy via header only
- 🔲 Custom provider endpoint configuration from UI
- 🔲 Provider health monitoring with auto-reconnect
- 🔲 Per-provider timeout and retry settings
- 🔲 `npx local-llm-hub` zero-install launcher

---

## 2. Model Management *(LM Studio-inspired)*

- ✅ Model listing from all connected providers
- ✅ Running model detection (currently loaded in RAM/VRAM)
- ✅ Model metadata display (size, params, context, quantization)
- ✅ Model loading banner with live progress
- ✅ Model pull / download with live progress bar (Ollama)
- ✅ Model delete from disk (Ollama)
- 🔥 **Model library browser** — search ollama.com/library inline
- 🔥 **Model capability badges** — vision, tools, code, long-context
- 🔥 **Model family grouping** in the dropdown (Llama 3, Qwen, Mistral…)
- 🔲 GGUF file drag-and-drop import (load any GGUF into LM Studio)
- 🔲 Model tags and aliasing (give friendly names to models)
- 🔲 Update check — notify when a newer version of a model exists
- 🔲 Favorite / pin models to top of selector
- 🔥 **Model benchmark runner** — tokens/sec speed test per model
- 🔲 Recommended model suggestions based on task type
- 🔲 Hardware-aware model suggestions — recommend models that fit in available VRAM

---

## 3. Chat Interface

- ✅ Token streaming via SSE
- ✅ Stop generation mid-stream
- ✅ Persistent chat history (localStorage)
- ✅ Chat export — Markdown and JSON
- ✅ Message edit & regenerate
- ✅ Message copy
- ✅ Continue generation
- ✅ Conversation pinning
- ✅ Auto-title from first message
- ✅ Chat fuzzy search (⌘K)
- 🔥 **Conversation title rename** — double-click to edit inline
- 🔥 **Conversation folders** / tag-based organization
- 🔥 **Conversation branching** — fork from any message
- 🔲 Import conversations from JSON / ChatGPT export
- 🔥 **Share conversation** — export as self-contained HTML file
- 🔲 Multi-tab chat (several conversations open side-by-side)
- 🔲 Message reactions (👍 👎 — RLHF-style feedback)
- 🔲 Bulk conversation management (select all → delete / export)
- 🔲 Context window timeline visualization (which messages fit in context)
- 🔲 Inline message threading / replies
- 🔲 Message search within a single conversation

---

## 4. Model Comparison

- ✅ Side-by-side split-screen comparison
- ✅ Parallel streaming to two models simultaneously
- ✅ Per-pane latency and token stats
- 🔥 **Response quality grading** — thumbs up/down per pane
- 🔥 **Diff view** between two model responses
- 🔲 Save comparison as a formatted report
- 🔲 A/B test mode (random model selection, reveal after both respond)
- 🔲 Multi-model tournament (bracket-style comparison)
- 🔲 Latency histogram per model

---

## 5. UI / Design *(Modern — Linear/Vercel-inspired)*

- ✅ Dark and light themes
- ✅ Linear/Vercel-inspired design tokens (Inter + JetBrains Mono)
- ✅ Collapsible right-sidebar accordion panels
- ✅ Keyboard shortcuts (⌘K, ⌘J, ⌘R, ⌘E, ⌘/)
- ✅ Keyboard shortcuts help modal (`?`)
- ✅ Sampling presets — Precise / Balanced / Creative one-click buttons
- 🔥 **Command palette** (⌘P) — fuzzy search across all actions and conversations
- 🔥 **Fully responsive mobile layout** — hamburger sidebar, touch-friendly
- 🔥 **Full-screen focus mode** — hide all sidebars, center content
- 🔥 **Collapsible long messages** — auto-collapse messages > N lines with "Show more"
- 🔲 Customizable accent color (color picker in settings)
- 🔲 Font size and chat density preferences (Compact / Comfortable / Spacious)
- 🔲 Animated page transitions and micro-interactions
- 🔲 Custom welcome screen with quick-action card configuration
- 🔲 Inline message diff view for edited messages
- 🔲 Skeleton loading states instead of spinners
- 🔲 Drag-to-resize sidebars

---

## 6. AI Agent & Tools

- ✅ Autonomous agent loop (up to 8 tool-call rounds)
- ✅ Built-in tools: `datetime`, `calculator`, `web_search`, `fetch_url`, `run_javascript`, `rag_search`
- ✅ Live tool-call visualization (input → result → elapsed time)
- ✅ MCP stdio client (spawn external MCP servers)
- ✅ Tool enable/disable per-session toggle
- 🔥 **Custom tool builder UI** — define name, description, JSON schema, handler URL
- 🔥 **Shell command tool** — opt-in, with confirmation prompt per execution
- 🔥 **Agent run history** — step-by-step replay of past agent sessions
- 🔲 Tool result caching (skip re-runs for identical inputs within a session)
- 🔲 MCP server marketplace / discovery browser
- 🔲 Agent memory persistence across sessions (long-term notes store)
- 🔲 Sub-agent spawning (parallel execution of agent tasks)
- 🔲 Browser automation via Playwright MCP
- 🔲 Agent graph visualization (node/edge view of tool call chain)

---

## 7. Code Features *(OpenCode-inspired)*

- ✅ Syntax-highlighted code blocks (14 languages via Prism.js)
- ✅ Artifact rendering (HTML, SVG, JSX, TSX in sandboxed iframe)
- ✅ Prompt templates with `{{variable}}` placeholders
- 🔥 **Live code editing** inside artifact preview (edit + re-render inline)
- 🔥 **File tree sidebar** — browse local filesystem via MCP filesystem server
- 🔥 **Multi-file context** — select files to attach as context
- 🔥 **Git integration** — show diff, stage, commit, PR review workflow
- 🔥 **Diff viewer** — before/after code comparison with syntax highlighting
- 🔲 Terminal pane — run shell commands, see output inline
- 🔲 Code lens — inline AI-powered suggestions in code blocks
- 🔲 Test runner output display
- 🔲 Linter / formatter auto-suggestions on code paste
- 🔲 Copy code → file save dialog (write directly to disk)
- 🔲 Multi-language REPL (run Python, JS, etc. via sandboxed environment)

---

## 8. RAG / Knowledge Base

- ✅ File upload and chunking (`.txt`, `.md`, `.json`, code files)
- ✅ Ollama embedding (`nomic-embed-text` by default)
- ✅ Cosine-similarity vector search
- ✅ Collection management (create, query, delete)
- ✅ SSE upload progress
- 🔥 **Web page crawl** — paste URL, auto-scrape into knowledge base
- 🔥 **PDF attachment support** — extract text, embed, attach as context
- 🔲 GitHub repository indexing — clone + embed all files
- 🔲 Auto-inject most-relevant chunks into every message (toggle)
- 🔲 Chunk preview and manual editing UI
- 🔲 Knowledge base stats (total chunks, sources, last updated)
- 🔲 Re-embedding on embedding model change
- 🔲 Hybrid search (keyword + vector BM25)
- 🔲 Multi-collection query (search across all collections at once)

---

## 9. Parameters & Presets

- ✅ Temperature slider
- ✅ Max tokens input
- ✅ System prompt presets (save / load)
- ✅ Prompt templates with variable substitution
- ✅ Plan mode (think step-by-step prefix)
- ✅ Sampling presets: Precise / Balanced / Creative
- 🔥 **Advanced parameters** — Top-P, Top-K, Repeat penalty, Frequency penalty
- 🔥 **Per-model parameter profiles** — save temperature + max tokens per model
- 🔥 **Structured output mode** — force JSON schema response (JSON mode)
- 🔲 Context length override per conversation
- 🔲 Seed control (reproducible outputs)
- 🔲 Stop sequences configuration
- 🔲 System prompt library with community presets

---

## 10. Voice & Multimodal

- ✅ Image attachments (paste, drag-and-drop, file picker)
- ✅ Vision model support (llava, qwen2-vl, llama3.2-vision)
- ✅ Voice input via browser Web Speech API
- ✅ Whisper server integration (local transcription)
- 🔥 **Text-to-speech output** — read responses aloud (TTS synthesis)
- 🔥 **PDF attachment** — extract text and attach as context
- 🔲 Audio file transcription by drag-and-drop
- 🔲 Video file frame extraction for vision models
- 🔲 Screen capture / screenshot attach (from clipboard)

---

## 11. Performance & Hardware Stats *(LM Studio-inspired)*

- ✅ Input token counter (live estimate while typing)
- ✅ Generation stats (total tokens, elapsed time)
- ✅ System RAM usage bar
- ✅ Context usage indicator (warns at >75%)
- 🔥 **Real-time tokens/sec counter** — live speed display during generation
- 🔥 **GPU / VRAM usage monitoring** — Ollama VRAM via API
- 🔲 Response latency histogram (per-model statistics panel)
- 🔲 Session token usage totals (prompt + completion)
- 🔲 Cost estimation for cloud API providers (per-model pricing table)
- 🔲 Performance dashboard — charts comparing models over time
- 🔲 CPU / GPU temperature display (where available)

---

## 12. Settings UI

- ✅ Raw JSON config editor modal
- ✅ Config hot-reload (MCP servers restart on save)
- 🔥 **Proper settings UI with tabs** — General · Providers · Tools · RAG · Audio · Advanced
- 🔥 **Provider connection test button** — ping + model count
- 🔲 Theme customizer (accent color, font, density)
- 🔲 Keyboard shortcut remapping
- 🔥 **Backup & restore** — all settings + conversations as a single JSON
- 🔲 Onboarding wizard for first-time setup
- 🔲 Per-workspace configuration profiles

---

## 13. Security & Privacy

- ✅ Binds to `127.0.0.1` by default (no LAN exposure without opt-in)
- ✅ SSRF protection on `fetch_url`
- ✅ VM sandbox for `run_javascript`
- ✅ CORS locked to localhost
- 🔲 Per-session API key (never persisted to disk)
- 🔲 Request / response logging toggle (opt-in, stored locally)
- 🔲 Prompt injection warning detection
- 🔲 Conversation data encryption at rest
- 🔲 Audit log of all tool executions

---

## 14. Developer & Integration

- ✅ SSE streaming API (`/v1/chat`)
- ✅ OpenAI-compatible passthrough (`/v1/chat/completions`)
- ✅ MCP stdio client
- 🔥 **OpenAPI / Swagger spec** for all proxy endpoints
- 🔲 WebSocket API alternative to SSE
- 🔲 Plugin system (load `.js` modules at startup)
- 🔲 CLI batch mode (`echo "prompt" | local-llm-hub --model llama3`)
- 🔲 VS Code extension (send selected code to LLM Hub)
- 🔲 Docker image with Ollama bundled

---

## 15. Quality & Testing

- ✅ Node.js syntax validation CI (18, 20, 22)
- ✅ JSON config validation in CI
- 🔥 **Unit tests** for core utilities (RagEngine, ToolRegistry, SSRF guard)
- 🔥 **Integration tests** for HTTP endpoints
- 🔲 End-to-end tests with Playwright
- 🔲 Automated screenshot regression tests
- 🔲 Performance benchmark suite (tokens/sec baseline)

---

## Quick Stats

| Status | Count |
|--------|-------|
| ✅ Done | ~45 |
| 🔥 High priority | ~35 |
| 🔲 Backlog | ~30 |
| **Total** | **~110** |
