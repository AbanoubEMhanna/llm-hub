# LLM Hub — Feature Roadmap

> Vision: a modern, local-first AI workbench inspired by **LM Studio** (model management, hardware stats) and **OpenCode** (code-first agent, file/git integration), built with a clean, sharp UI in the spirit of Linear and Vercel.

---

## Core Infrastructure

- [x] Ollama provider integration
- [x] LM Studio provider integration
- [x] Multi-provider model aggregation (single dropdown)
- [x] OpenAI-compatible `/v1/chat/completions` passthrough
- [x] Proxy binds to `127.0.0.1` by default
- [ ] Additional providers: OpenAI, Anthropic, Groq, OpenRouter, Mistral
- [ ] API key management (encrypted localStorage storage)
- [ ] Custom provider endpoint configuration via UI
- [ ] Provider health monitoring with auto-reconnect
- [ ] Per-provider connection timeout/retry settings

---

## Model Management *(LM Studio-inspired)*

- [x] Model listing from all connected providers
- [x] Running model detection (currently loaded in RAM/VRAM)
- [x] Model metadata display (size, params, context, quantization)
- [x] Model loading banner with progress on first use
- [ ] **Model pull / download with live progress** *(Ollama)*
- [ ] **Model delete from disk** *(Ollama)*
- [ ] Model library browser (search ollama.com/library)
- [ ] GGUF file drag-and-drop import
- [ ] Model tags / aliasing
- [ ] Model update check (notify when newer version exists)
- [ ] Favorite / pin models to the top of the selector
- [ ] Model benchmark runner (speed test: tokens/sec)
- [ ] Automatic recommended model suggestions based on task

---

## Chat Interface

- [x] Token streaming via SSE
- [x] Stop generation mid-stream
- [x] Persistent chat history (localStorage)
- [x] Chat export — Markdown and JSON
- [x] Message edit & regenerate
- [x] Message copy
- [x] Continue generation
- [x] Conversation pinning
- [x] Auto-title from first message
- [ ] Conversation folders / tag-based organization
- [ ] Conversation branching (fork a message thread)
- [ ] Import conversations from JSON
- [ ] Share conversation as self-contained HTML file
- [ ] Multi-tab chat (open several conversations at once)
- [ ] Message reactions (👍 👎 for RLHF-style feedback)
- [ ] Inline message threading / replies
- [ ] Conversation title rename on double-click
- [ ] Bulk conversation management (select + delete / export)
- [ ] Context window timeline visualization (which messages fit)

---

## Model Comparison

- [x] Side-by-side split-screen comparison
- [x] Parallel streaming to two models
- [ ] Response quality grading (thumbs up/down per pane)
- [ ] Diff view between two model responses
- [ ] Save comparison as a report
- [ ] A/B test mode (random model selection, reveal after response)
- [ ] Multi-model tournament (bracket-style comparisons)

---

## UI / Design *(Modern)*

- [x] Dark and light themes
- [x] Linear/Vercel-inspired design tokens
- [x] Collapsible right-sidebar panels
- [x] Keyboard shortcuts (⌘K, ⌘J, ⌘R, ⌘E, ⌘/)
- [x] Chat fuzzy search (⌘K)
- [x] Keyboard shortcuts help modal (`?`)
- [ ] Fully responsive mobile layout (hamburger sidebar)
- [ ] Command palette (⌘P) with full action search
- [ ] Customizable accent color (color picker in settings)
- [ ] Font size & chat density preferences (compact / comfortable)
- [ ] Animated page transitions and micro-interactions
- [ ] Full-screen focus mode (hide sidebars, center content)
- [ ] Inline message diff view for code edits
- [ ] Collapsible long messages (auto-collapse > N lines)
- [ ] Custom welcome screen / quick-action cards configuration

---

## AI Agent & Tools

- [x] Autonomous agent loop (up to 8 tool-call rounds)
- [x] Built-in tools: `datetime`, `calculator`, `web_search`, `fetch_url`, `run_javascript`, `rag_search`
- [x] Live tool-call visualization (input → result → elapsed time)
- [x] MCP stdio client (spawn external MCP servers)
- [x] Tool enable/disable per-session toggle
- [ ] Custom tool builder UI (define name, description, JSON schema, handler URL)
- [ ] Tool result caching (skip re-runs for identical inputs within a session)
- [ ] MCP server marketplace / discovery browser
- [ ] Agent memory persistence across sessions (long-term notes)
- [ ] Sub-agent spawning (parallel execution of agent tasks)
- [ ] Browser automation via Playwright MCP
- [ ] Shell command tool (opt-in, with confirmation prompt)
- [ ] Agent run history with step-by-step replay

---

## RAG / Knowledge Base

- [x] File upload and chunking (`.txt`, `.md`, `.json`, code files)
- [x] Ollama embedding (nomic-embed-text)
- [x] Cosine-similarity vector search
- [x] Collection management (create, query, delete)
- [x] SSE upload progress
- [ ] Web page crawl → knowledge base (paste URL, auto-scrape)
- [ ] GitHub repository indexing (clone + embed all files)
- [ ] PDF document support (extract text for embedding)
- [ ] Auto-inject most-relevant chunks into every message (toggle)
- [ ] Chunk preview and manual editing UI
- [ ] Knowledge base stats (total chunks, sources, last updated)
- [ ] Re-embedding on embedding model change
- [ ] Hybrid search (keyword + vector)
- [ ] Multi-collection query (search across all collections at once)

---

## Code Features *(OpenCode-inspired)*

- [x] Syntax-highlighted code blocks (14 languages via Prism.js)
- [x] Artifact rendering (HTML, SVG, JSX, TSX in sandboxed iframe)
- [x] Prompt templates with `{{variable}}` placeholders
- [ ] Live code editing inside artifact preview
- [ ] File tree sidebar (browse local filesystem via MCP)
- [ ] Multi-file context (select files to attach to the conversation)
- [ ] Terminal pane (run shell commands, see output inline)
- [ ] Git integration (show diff, commit, PR review workflow)
- [ ] Code lens (inline AI-powered suggestions in code blocks)
- [ ] Test runner output display
- [ ] Linter / formatter auto-suggestions on code paste
- [ ] Diff viewer (before/after code comparison)
- [ ] Copy code with one-click → file save dialog

---

## Parameters & Presets

- [x] Temperature slider
- [x] Max tokens input
- [x] System prompt presets (save / load)
- [x] Prompt templates with variable substitution
- [x] Plan mode (think step-by-step prefix)
- [ ] Sampling presets: Creative / Balanced / Precise (one-click)
- [ ] Per-model parameter profiles (save temperature, max tokens per model)
- [ ] Advanced parameters: Top-P, Top-K, Repeat penalty, Frequency penalty
- [ ] Context length override per conversation
- [ ] Structured output mode (force JSON schema response)
- [ ] Seed control (reproducible outputs)
- [ ] Stop sequences configuration

---

## Voice & Multimodal

- [x] Image attachments (paste, drag-and-drop, file picker)
- [x] Vision model support (llava, qwen2-vl, llama3.2-vision)
- [x] Voice input via browser Web Speech API
- [x] Whisper server integration (local transcription)
- [ ] Text-to-speech output (TTS synthesis, read responses aloud)
- [ ] PDF attachment (extract text, attach as context)
- [ ] Audio file transcription by drag-and-drop
- [ ] Video file frame extraction for vision models
- [ ] Screen capture / screenshot attach (clipboard)

---

## Performance & Statistics

- [x] Input token counter (live estimate)
- [x] Generation stats (total tokens, elapsed time)
- [x] System RAM usage bar
- [x] Context usage indicator (warns at >75%)
- [ ] **Real-time tokens/sec counter during generation**
- [ ] GPU / VRAM usage monitoring (Ollama VRAM via API)
- [ ] Response latency histogram (per-model statistics)
- [ ] Session token usage totals (prompt + completion)
- [ ] Cost estimation (for cloud API providers, per-model pricing)
- [ ] Performance dashboard (charts, model comparison over time)

---

## Settings UI

- [x] Raw JSON config editor modal
- [x] Config hot-reload (MCP servers restart on save)
- [ ] **Proper settings UI with tabs** (General · Providers · Tools · RAG · Audio · Advanced)
- [ ] Provider connection test button (ping + model count)
- [ ] Theme customizer (accent color, font, density)
- [ ] Keyboard shortcut remapping
- [ ] Backup & restore all settings + conversations
- [ ] Import / export full configuration as JSON
- [ ] Onboarding wizard for first-time setup

---

## Security & Privacy

- [x] Binds to `127.0.0.1` by default (no LAN exposure without opt-in)
- [x] SSRF protection on `fetch_url`
- [x] VM sandbox for `run_javascript`
- [x] CORS locked to localhost
- [ ] Per-session API key (never persisted to disk)
- [ ] Request / response logging toggle (opt-in, stored locally)
- [ ] Prompt injection warning detection
- [ ] Conversation data encryption at rest (localStorage)
- [ ] Audit log of tool executions

---

## Developer & Integration

- [x] SSE streaming API (`/v1/chat`)
- [x] OpenAI-compatible passthrough (`/v1/chat/completions`)
- [x] MCP stdio client
- [ ] OpenAPI / Swagger spec for all proxy endpoints
- [ ] WebSocket API alternative to SSE
- [ ] Plugin system (load `.js` modules at startup)
- [ ] CLI batch mode (`echo "prompt" | local-llm-hub --model llama3`)
- [ ] VS Code extension (sends selected code to LLM Hub)
- [ ] Browser extension (send selected text to LLM Hub)
- [ ] Docker image with Ollama bundled
- [ ] `npx local-llm-hub` zero-install launcher

---

## Quality & Testing

- [x] Node.js syntax validation CI (18, 20, 22)
- [x] JSON config validation in CI
- [ ] Unit tests for core utilities (RagEngine, ToolRegistry, SSRF guard)
- [ ] Integration tests for HTTP endpoints
- [ ] End-to-end tests with Playwright
- [ ] Automated screenshot tests for UI regressions
- [ ] Performance benchmark suite (tokens/sec baseline)
