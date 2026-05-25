# LLM Hub — Features Checklist
## Vision: LM Studio + OpenCode with a Modern UI

> **Goal:** The best local-first AI workbench. LM Studio's model management and hardware awareness, OpenCode's code-first developer workflow, wrapped in a Linear/Vercel-inspired UI that feels fast, focused, and delightful.
>
> **Legend:** ✅ Done · 🔲 Todo · 🔥 High priority · 🚧 In progress

---

## 1. Model Management *(LM Studio-inspired)*

- ✅ Unified model dropdown across all providers (Ollama, LM Studio, OpenAI, Anthropic, Groq, OpenRouter)
- ✅ Running model detection — shows which model is loaded in RAM/VRAM
- ✅ Model metadata display (size, params, context length, quantization)
- ✅ Model pull / download with live progress bar (Ollama)
- ✅ Model delete from disk (Ollama)
- ✅ Model capability badges (vision, tools, code, long-ctx)
- ✅ Model family grouping in dropdown (Llama, Qwen, Mistral, Gemma…)
- ✅ Model library browser — browse & pull 30+ popular Ollama models in-app
- 🔥 🔲 Model benchmark runner — tokens/sec speed test, compare models side-by-side
- 🔥 🔲 Hardware-aware model suggestions — recommend models that fit available VRAM
- 🔥 🔲 Per-model parameter profiles — auto-save/load temperature, max tokens, system prompt per model
- 🔲 GGUF file drag-and-drop import (load any GGUF directly into LM Studio)
- 🔲 Favorite / pin models to the top of the selector
- 🔲 Model tags and friendly aliases
- 🔲 Update check — notify when a newer version of a model is available
- 🔲 Recommended model suggestions per task type (code, chat, vision, embedding)

---

## 2. Provider & Connectivity

- ✅ Ollama local provider
- ✅ LM Studio local provider
- ✅ OpenAI (GPT-4o, o3, o4-mini, etc.)
- ✅ Anthropic Claude (Opus, Sonnet, Haiku)
- ✅ Groq (ultra-fast inference)
- ✅ OpenRouter (200+ models via one key)
- ✅ Custom OpenAI-compatible endpoint (any local or remote server)
- ✅ API key management — stored in localStorage, sent via header only
- ✅ Per-provider connection test button
- 🔥 🔲 Mistral / Together / Fireworks / Cohere providers
- 🔲 Provider health monitoring with auto-reconnect
- 🔲 Per-provider timeout and retry configuration
- 🔲 `npx local-llm-hub` zero-install launcher

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
- ✅ Conversation title rename — double-click to edit inline
- ✅ Share conversation — export as self-contained HTML file
- ✅ Collapsible long messages (auto-collapse > ~22 lines)
- 🔥 🔲 Conversation folders — organize chats into named groups/projects
- 🔥 🔲 Conversation branching — fork from any message and explore different paths
- 🔲 Import conversations from JSON / ChatGPT export
- 🔲 Multi-tab chat (several conversations open side-by-side)
- 🔲 Message reactions (👍 👎) — quality rating for RLHF-style feedback
- 🔲 Bulk conversation management (select all → delete / export)
- 🔲 Context window visualization — show which messages are inside the context window
- 🔲 Message search within a single conversation
- 🔲 Inline message threading / replies

---

## 4. Code Features *(OpenCode-inspired)*

- ✅ Syntax-highlighted code blocks (14 languages via Prism.js)
- ✅ Artifact rendering — HTML, SVG, JSX, TSX in sandboxed iframe
- ✅ Prompt templates with `{{variable}}` placeholders
- 🔥 🔲 Live code editing inside artifact preview — edit + re-render inline
- 🔥 🔲 File tree sidebar — browse local filesystem via MCP filesystem server
- 🔥 🔲 Multi-file context — select multiple files to attach as context
- 🔥 🔲 Git integration — show diff, stage, commit, PR review workflow
- 🔥 🔲 Diff viewer — before/after code comparison with syntax highlighting
- 🔲 Terminal pane — run shell commands, see output inline in chat
- 🔲 Code lens — inline AI-powered suggestions on code blocks
- 🔲 Test runner output display — show test results inline
- 🔲 Copy code → file save dialog (write directly to disk via MCP)
- 🔲 Multi-language REPL (run Python, JS, etc. in sandboxed environment)
- 🔲 Linter/formatter auto-suggestions on pasted code

---

## 5. AI Agent & Tools

- ✅ Autonomous agent loop (up to 8 tool-call rounds)
- ✅ Built-in tools: `datetime`, `calculator`, `web_search`, `fetch_url`, `run_javascript`, `rag_search`
- ✅ Live tool-call visualization (input → result → elapsed time)
- ✅ MCP stdio client — spawn external MCP servers from config
- ✅ Tool enable/disable per-session toggle
- 🔥 🔲 Custom tool builder UI — define name, description, JSON schema, handler URL visually
- 🔥 🔲 Shell command tool — opt-in, with confirmation prompt per execution
- 🔥 🔲 Agent run history — step-by-step replay of past agent sessions
- 🔲 Tool result caching — skip re-runs for identical inputs within a session
- 🔲 MCP server marketplace / discovery browser
- 🔲 Agent memory persistence across sessions (long-term notes store)
- 🔲 Sub-agent spawning — parallel execution of agent tasks
- 🔲 Browser automation via Playwright MCP
- 🔲 Agent graph visualization — node/edge view of the tool call chain

---

## 6. RAG / Knowledge Base

- ✅ File upload and chunking (`.txt`, `.md`, `.json`, code files)
- ✅ Ollama embedding (`nomic-embed-text` by default)
- ✅ Cosine-similarity vector search
- ✅ Collection management (create, query, delete)
- ✅ SSE upload progress
- 🔥 🔲 Web page crawl — paste URL, auto-scrape and embed into knowledge base
- 🔥 🔲 PDF attachment support — extract text, embed, attach as context
- 🔲 GitHub repository indexing — clone + embed all source files
- 🔲 Auto-inject most-relevant chunks into every message (toggle)
- 🔲 Chunk preview and manual editing UI
- 🔲 Knowledge base stats (total chunks, sources, last updated)
- 🔲 Re-embedding on embedding model change
- 🔲 Hybrid search (keyword + vector BM25)
- 🔲 Multi-collection query (search across all collections at once)

---

## 7. Voice & Multimodal

- ✅ Image attachments (paste, drag-and-drop, file picker)
- ✅ Vision model support (llava, qwen2-vl, llama3.2-vision)
- ✅ Voice input via browser Web Speech API
- ✅ Whisper server integration (local transcription)
- 🔥 🔲 Text-to-speech output — read AI responses aloud (TTS synthesis)
- 🔥 🔲 PDF attachment — drag-and-drop PDF, extract text as context
- 🔲 Audio file transcription by drag-and-drop
- 🔲 Video frame extraction for vision models
- 🔲 Screen capture / screenshot attach from clipboard

---

## 8. Model Comparison

- ✅ Side-by-side split-screen comparison
- ✅ Parallel streaming to two models simultaneously
- ✅ Per-pane latency and token stats
- 🔥 🔲 Response quality grading — thumbs up/down per pane
- 🔥 🔲 Diff view between two model responses
- 🔲 Save comparison as a formatted report
- 🔲 A/B test mode — random model selection, reveal after both respond
- 🔲 Multi-model tournament (bracket-style comparison)
- 🔲 Latency histogram per model

---

## 9. Modern UI *(Linear/Vercel-inspired)*

- ✅ Dark and light themes
- ✅ Linear/Vercel design tokens (Inter + JetBrains Mono)
- ✅ Collapsible right-sidebar accordion panels (smooth slide animation)
- ✅ Keyboard shortcuts (⌘K search, ⌘J new chat, ⌘R regenerate, ⌘/)
- ✅ Keyboard shortcuts help modal (`?`)
- ✅ Command palette (⌘P) — fuzzy search across all actions and conversations
- ✅ Full-screen focus mode (⌘⇧F)
- ✅ Sampling presets — Precise / Balanced / Creative
- ✅ Plan mode toggle (think step-by-step prefix)
- ✅ JSON mode toggle (force structured output)
- ✅ Backup & restore — all settings + conversations as a single JSON
- ✅ Animated welcome screen — gradient logo, staggered cards, micro-interactions
- ✅ Button micro-interactions — press animations on all interactive buttons
- ✅ Enhanced typing indicator — wave-bounce dots
- ✅ Drag-to-resize sidebars (persisted to localStorage)
- ✅ Skeleton loading states (shimmer for model selector + conversation list)
- 🔥 🔲 Fully responsive mobile layout — hamburger nav, touch-friendly input
- 🔥 🔲 Settings UI with tabs — General · Providers · Tools · RAG · Audio · Advanced
- 🔥 🔲 Per-model parameter profiles — save and auto-load settings per model
- 🔲 Customizable accent color (color picker in settings)
- 🔲 Font size and chat density preferences (Compact / Comfortable / Spacious)
- 🔲 Inline message diff view for edited messages
- 🔲 Drag-and-drop conversation reordering
- 🔲 Onboarding wizard for first-time setup
- 🔲 Custom welcome card configuration (add/remove/reorder quick-action cards)

---

## 10. Hardware & Performance Stats *(LM Studio-inspired)*

- ✅ Input token counter (live estimate while typing)
- ✅ Generation stats (total tokens, elapsed time, tokens/sec)
- ✅ System RAM usage bar
- ✅ Context usage indicator (warns at >75%)
- ✅ Real-time tokens/sec counter during generation
- ✅ GPU / VRAM usage monitoring — live VRAM bar per loaded model
- ✅ Cost estimation for cloud API providers (per-response USD)
- 🔲 Response latency histogram (per-model statistics panel)
- 🔲 Session token usage totals (prompt + completion aggregate)
- 🔲 Performance dashboard — charts comparing models over time
- 🔲 CPU / GPU temperature display (where available)

---

## 11. Parameters & Presets

- ✅ Temperature slider
- ✅ Max tokens input
- ✅ System prompt presets (save / load named presets)
- ✅ Prompt templates with `{{variable}}` substitution
- ✅ Advanced parameters — Top-P, Top-K, Repeat penalty, Frequency penalty
- 🔥 🔲 Per-model parameter profiles — save temperature + max tokens + system prompt per model
- 🔥 🔲 Structured output mode — force JSON schema response with schema editor
- 🔲 Context length override per conversation
- 🔲 Seed control (reproducible outputs)
- 🔲 Stop sequences configuration
- 🔲 System prompt library with community presets

---

## 12. Security & Privacy

- ✅ Proxy binds to `127.0.0.1` by default (no LAN exposure without opt-in)
- ✅ SSRF protection on `fetch_url` tool
- ✅ VM sandbox for `run_javascript` tool
- ✅ CORS locked to localhost
- 🔲 Prompt injection warning detection
- 🔲 Conversation data encryption at rest (opt-in)
- 🔲 Audit log of all tool executions
- 🔲 Request/response logging toggle (opt-in, stored locally)

---

## 13. Developer & Integration

- ✅ SSE streaming API (`/v1/chat`)
- ✅ OpenAI-compatible passthrough (`/v1/chat/completions`)
- ✅ MCP stdio client
- 🔥 🔲 OpenAPI / Swagger spec for all proxy endpoints
- 🔲 WebSocket API alternative to SSE
- 🔲 Plugin system (load `.js` modules at startup)
- 🔲 CLI batch mode (`echo "prompt" | local-llm-hub --model llama3`)
- 🔲 VS Code extension (send selected code to LLM Hub)
- 🔲 Docker image with Ollama bundled

---

## 14. Quality & Testing

- ✅ Node.js syntax validation CI (Node 18, 20, 22)
- ✅ JSON config validation in CI
- 🔥 🔲 Unit tests for core utilities (RagEngine, ToolRegistry, SSRF guard)
- 🔥 🔲 Integration tests for HTTP endpoints
- 🔲 End-to-end tests with Playwright
- 🔲 Automated screenshot regression tests
- 🔲 Performance benchmark suite (tokens/sec baseline)

---

## Progress Summary

| Category | Done | High Priority | Backlog | Total |
|----------|------|---------------|---------|-------|
| Model Management | 8 | 3 | 4 | 15 |
| Providers | 8 | 1 | 3 | 12 |
| Chat Interface | 12 | 2 | 7 | 21 |
| Code / OpenCode | 3 | 4 | 6 | 13 |
| Agent & Tools | 5 | 3 | 6 | 14 |
| RAG / Knowledge | 5 | 2 | 7 | 14 |
| Voice & Multimodal | 4 | 2 | 3 | 9 |
| Model Comparison | 3 | 2 | 3 | 8 |
| Modern UI | 16 | 3 | 5 | 24 |
| Hardware Stats | 7 | 0 | 4 | 11 |
| Parameters | 6 | 2 | 4 | 12 |
| Security | 4 | 0 | 4 | 8 |
| Developer | 3 | 1 | 5 | 9 |
| Quality | 2 | 2 | 3 | 7 |
| **Total** | **86** | **27** | **64** | **177** |

---

*Last updated: 2026-05-25*
