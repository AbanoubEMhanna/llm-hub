# LLM Hub — Feature TODO Checklist

> **Vision:** The best local-first AI workbench — **LM Studio** model management & hardware awareness,
> **OpenCode** code-first agent workflow, wrapped in a **modern Linear/Vercel-inspired UI** that feels
> fast, focused, and professional.
>
> **Legend:** ✅ Done · 🔥 High priority · 🔲 Backlog

---

## 1. Core Infrastructure

- ✅ Ollama provider integration
- ✅ LM Studio provider integration
- ✅ Multi-provider model aggregation — single unified model dropdown
- ✅ OpenAI-compatible `/v1/chat/completions` passthrough
- ✅ Proxy binds to `127.0.0.1` by default (secure by default)
- ✅ OpenAI provider — cloud, with API key stored in localStorage
- ✅ Anthropic Claude provider — cloud, with API key (format conversion included)
- ✅ Groq provider — ultra-fast inference
- ✅ OpenRouter provider — unified cloud gateway
- ✅ API key management — stored in localStorage, transmitted via header only (never on disk)
- ✅ Custom provider endpoint — add any OpenAI-compatible server + API key from UI
- 🔲 Mistral / Together / Fireworks / Cohere providers
- 🔲 Provider health monitoring with auto-reconnect
- 🔲 Per-provider timeout and retry settings
- 🔲 `npx local-llm-hub` zero-install launcher
- 🔲 WebSocket API alternative to SSE

---

## 2. Model Management *(LM Studio DNA)*

- ✅ Model listing from all connected providers
- ✅ Running model detection — highlight models currently loaded in RAM/VRAM
- ✅ Model metadata panel — size, params, context length, quantization
- ✅ Model loading banner with live progress
- ✅ Model pull / download with live progress bar (Ollama)
- ✅ Model delete from disk (Ollama)
- ✅ Model capability badges — vision, tools, code, long-context
- ✅ Model family grouping in dropdown — Llama 3, Qwen, Mistral…
- ✅ Model library browser — browse & pull 30+ popular Ollama models in-app
- ✅ Model library search — live filter by name, org, description, and category
- ✅ Per-model parameter profiles — auto-save & restore temperature + max tokens per model
- ✅ Real-time tokens/sec counter during generation
- ✅ GPU / VRAM usage monitoring — live VRAM bar per loaded model
- ✅ System RAM usage bar
- ✅ Cost estimation for cloud providers — per-response USD display
- ✅ **Session cost accumulator** — running session total with ↺ reset button
- ✅ Model benchmark runner — tokens/sec, TTFT, total time per Ollama model; ranked results table
- 🔥 Hardware-aware model suggestions — recommend models that fit available VRAM
- 🔲 GGUF file drag-and-drop import
- ✅ Favorite / pin models to top of selector
- 🔲 Model update notifications — alert when a newer version exists
- 🔲 Performance dashboard — tokens/sec charts over time per model

---

## 3. Chat Interface

- ✅ Token streaming via SSE
- ✅ Stop generation mid-stream
- ✅ Persistent chat history (localStorage)
- ✅ Chat export — Markdown and JSON
- ✅ Export conversation as standalone HTML (offline, dark/light theme)
- ✅ Message edit & regenerate
- ✅ Message copy and delete
- ✅ Continue generation
- ✅ Message reactions — 👍 👎 RLHF-style, persisted per message
- ✅ Conversation pinning
- ✅ Auto-title from first message
- ✅ Chat fuzzy search (⌘K)
- ✅ Conversation title rename — double-click inline
- ✅ Collapsible long messages — auto-collapse > ~22 lines
- ✅ Per-conversation system prompt — auto-save/restore on switch
- ✅ In-conversation message search (⌘F)
- ✅ Conversation color labels — Work / Code / Research / Ideas / Personal with sidebar filter
- ✅ Conversation folders — organize chats into named groups
- ✅ Conversation branching — fork any conversation from any user message into a parallel path
- ✅ Backup & restore — all settings + conversations as a single JSON
- ✅ Import conversations — merge from LLM Hub JSON export or ChatGPT conversations.json
- ✅ Bulk conversation management — checkbox select, delete, export
- 🔥 Multi-tab chat — several conversations open side-by-side
- 🔲 Context window timeline visualization — which messages fit in context
- 🔲 Inline message threading / replies
- ✅ Message timestamps toggle — hover to peek, T key or ⏱ button to always show

---

## 4. Model Comparison

- ✅ Side-by-side split-screen comparison
- ✅ Parallel streaming to two models simultaneously
- ✅ Per-pane latency and token stats
- ✅ Response quality grading — header score; thumbs up/down per pane with session win counter
- ✅ Diff view between two model responses — word-level LCS diff in modal, colour-coded ins/del
- 🔲 Save comparison as a formatted report
- 🔲 A/B test mode — random model selection, reveal after both respond
- 🔲 Multi-model tournament — bracket-style comparison
- 🔲 Latency histogram per model

---

## 5. UI / Design *(Modern Linear/Vercel DNA)*

- ✅ Dark and light themes with system-preference detection
- ✅ Linear/Vercel-inspired design tokens — Inter + JetBrains Mono
- ✅ Command palette (⌘P) — fuzzy search all actions and conversations
- ✅ Keyboard shortcuts (⌘K, ⌘J, ⌘R, ⌘E, ⌘/) with help modal (`?`)
- ✅ Collapsible right-sidebar accordion panels
- ✅ Drag-to-resize left and right sidebars — 4 px handle, persisted, dblclick to reset
- ✅ Skeleton loading states — shimmer placeholders while models / conversations load
- ✅ Animated micro-interactions — message fade-in, button hover effects
- ✅ Redesigned welcome screen with quick-action cards and keyboard hints
- ✅ Full-screen focus mode — hide all sidebars, center content (⌘⇧F)
- ✅ Collapsible long messages — auto-collapse > ~22 lines with Show more / Show less
- ✅ Sampling presets — Precise / Balanced / Creative one-click buttons
- ✅ Appearance settings — accent color, font size, chat density
- 🔥 Fully responsive mobile layout — hamburger sidebar, touch-friendly
- 🔲 Inline message diff view for edited messages
- 🔲 Custom welcome screen card configuration
- 🔲 Onboarding wizard for first-time setup
- 🔲 Keyboard shortcut remapping

---

## 6. Generation Modes

- ✅ Plan mode — model thinks step-by-step in `<plan>` tags before answering
- ✅ JSON mode — forces `response_format: json_object` for structured output
- ✅ Sampling presets: Precise / Balanced / Creative
- ✅ Advanced parameters — Top-P, Top-K, Repeat penalty, Frequency penalty
- 🔥 Structured output with JSON schema editor — enforce specific JSON structure
- 🔲 Grammar-constrained generation (GBNF / regex)
- 🔲 Seed control — reproducible outputs
- 🔲 Stop sequences configuration
- 🔲 Context length override per conversation

---

## 7. AI Agent & Tools

- ✅ Autonomous agent loop — up to 8 tool-call rounds
- ✅ Built-in tools: `datetime`, `calculator`, `web_search`, `fetch_url`, `run_javascript`, `rag_search`
- ✅ Live tool-call visualization — input → result → elapsed time
- ✅ MCP stdio client — spawn external MCP servers
- ✅ Tool enable/disable per-session toggle
- 🔥 Custom tool builder UI — define name, description, JSON schema, handler URL
- 🔥 Shell command tool — opt-in, with confirmation prompt per execution
- 🔥 Agent run history — step-by-step replay of past agent sessions
- 🔲 Tool result caching — skip re-runs for identical inputs within a session
- 🔲 MCP server marketplace / discovery browser
- 🔲 Agent memory persistence across sessions (long-term notes store)
- 🔲 Sub-agent spawning — parallel execution of agent tasks
- 🔲 Browser automation via Playwright MCP
- 🔲 Agent graph visualization — node/edge view of tool call chain

---

## 8. Code Features *(OpenCode DNA)*

- ✅ Syntax-highlighted code blocks (14 languages via Prism.js)
- ✅ Artifact rendering — HTML, SVG, JSX, TSX in sandboxed iframe
- ✅ Prompt templates with `{{variable}}` placeholders
- ✅ Live code editing inside artifact preview — edit + re-render inline
- 🔥 File tree sidebar — browse local filesystem via MCP filesystem server
- 🔥 Multi-file context — select and attach multiple files as context
- 🔥 Git integration — show diff, stage, commit, PR review workflow
- 🔥 Diff viewer — before/after code comparison with syntax highlighting
- 🔲 Terminal pane — run shell commands, see output inline
- 🔲 Copy code → file save dialog (write directly to disk)
- 🔲 Multi-language REPL — run Python, JS, etc. in sandboxed environment
- 🔲 Code lens — inline AI-powered suggestions in code blocks
- 🔲 Linter / formatter auto-suggestions on code paste

---

## 9. RAG / Knowledge Base

- ✅ File upload and chunking — `.txt`, `.md`, `.json`, code files
- ✅ Ollama embedding (`nomic-embed-text` by default)
- ✅ Cosine-similarity vector search
- ✅ Collection management — create, query, delete
- ✅ SSE upload progress
- ✅ Web page crawl — paste URL, fetch server-side, strip HTML, embed into collection
- 🔲 GitHub repository indexing — clone + embed all files
- 🔲 Auto-inject most-relevant chunks into every message (toggle)
- 🔲 Chunk preview and manual editing UI
- 🔲 Knowledge base stats — total chunks, sources, last updated
- 🔲 Re-embedding on embedding model change
- 🔲 Hybrid search — keyword + vector BM25
- 🔲 Multi-collection query — search across all collections at once

---

## 10. Voice & Multimodal

- ✅ Image attachments — paste, drag-and-drop, file picker
- ✅ Vision model support — llava, qwen2-vl, llama3.2-vision
- ✅ Voice input via browser Web Speech API
- ✅ Whisper server integration — local transcription
- ✅ Text-to-speech output — 🔊 Read button, Voice settings tab, voice/rate/pitch controls
- ✅ PDF attachment — client-side text extraction via PDF.js, attach as context
- 🔲 Audio file transcription by drag-and-drop
- 🔲 Video frame extraction for vision models
- 🔲 Screen capture / screenshot attach from clipboard

---

## 11. Performance & Hardware Stats *(LM Studio DNA)*

- ✅ Input token counter — live estimate while typing
- ✅ Generation stats — total tokens, elapsed time
- ✅ System RAM usage bar
- ✅ Context usage indicator — warns at >75%
- ✅ Real-time tokens/sec counter during generation
- ✅ GPU / VRAM usage monitoring — live VRAM bar per loaded model
- ✅ Cloud API cost estimation — per-response USD cost
- ✅ Session cost accumulator — running total per browser session with reset
- 🔲 Response latency histogram per model
- 🔲 Performance dashboard — charts comparing models over time
- 🔲 CPU / GPU temperature display (where available)

---

## 12. Settings UI

- ✅ Raw JSON config editor modal
- ✅ Config hot-reload — MCP servers restart on save
- ✅ Backup & restore — all settings + conversations as a single JSON
- ✅ Appearance settings tab — accent color, font size, chat density
- ✅ Provider connection test button — per-provider ping in Settings → Providers
- 🔥 Proper settings UI with tabs — General · Providers · Tools · RAG · Audio · Advanced
- 🔲 Per-workspace configuration profiles
- 🔲 Onboarding wizard for first-time setup

---

## 13. Security & Privacy

- ✅ Proxy binds to `127.0.0.1` by default — no LAN exposure without opt-in
- ✅ SSRF protection on `fetch_url`
- ✅ VM sandbox for `run_javascript`
- ✅ CORS locked to localhost
- 🔲 Per-session API key — never persisted to disk
- 🔲 Request / response logging toggle — opt-in, stored locally
- 🔲 Prompt injection warning detection
- 🔲 Conversation data encryption at rest
- 🔲 Audit log of all tool executions

---

## 14. Developer & Integration

- ✅ SSE streaming API (`/v1/chat`)
- ✅ OpenAI-compatible passthrough (`/v1/chat/completions`)
- ✅ MCP stdio client
- ✅ Node.js syntax validation CI (v18, v20, v22)
- ✅ JSON config validation in CI
- 🔥 OpenAPI / Swagger spec for all proxy endpoints
- 🔥 Unit tests — RagEngine, ToolRegistry, SSRF guard
- 🔥 Integration tests for HTTP endpoints
- 🔲 End-to-end tests with Playwright
- 🔲 Docker image with Ollama bundled
- 🔲 VS Code extension — send selected code to LLM Hub
- 🔲 Plugin system — load `.js` modules at startup
- 🔲 CLI batch mode — `echo "prompt" | llm-hub --model llama3`

---

## Progress Summary

| Category | ✅ Done | 🔥 Next | 🔲 Backlog |
|----------|---------|---------|-----------|
| Core Infrastructure | 11 | — | 5 |
| Model Management | 16 | 1 | 4 |
| Chat Interface | 22 | 1 | 3 |
| Model Comparison | 4 | 1 | 4 |
| UI / Design | 13 | 1 | 4 |
| Generation Modes | 4 | 1 | 3 |
| AI Agent & Tools | 5 | 3 | 6 |
| Code Features | 4 | 4 | 5 |
| RAG / Knowledge Base | 6 | — | 7 |
| Voice & Multimodal | 6 | — | 3 |
| Hardware Stats | 8 | — | 3 |
| Settings UI | 5 | 1 | 2 |
| Security & Privacy | 4 | — | 5 |
| Developer & Integration | 5 | 3 | 5 |
| **Total** | **113** | **16** | **59** |

---

*Last updated: 2026-06-10 — reflects all merged PRs #1–#39 plus web page crawl for RAG.*
