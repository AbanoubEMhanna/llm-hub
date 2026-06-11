# LLM Hub — Feature TODO Checklist

> **Vision:** Make LLM Hub feel like **LM Studio** + **OpenCode** wrapped in a **modern Linear/Vercel-inspired UI** —
> the best local-first AI workbench that is fast, focused, and professional.
>
> **Legend:** ✅ Done · 🔥 High priority · 🔲 Backlog

---

## LM Studio DNA — Model Management & Hardware

> *What makes LM Studio great: you can manage, download, and monitor models like a native app.*

- ✅ Multi-provider model aggregation — Ollama, LM Studio, OpenAI, Anthropic, Groq, OpenRouter, custom endpoints
- ✅ Model metadata panel — size, params, context length, quantization
- ✅ Running model detection — highlight which models are loaded in RAM/VRAM
- ✅ Model pull / download with live progress bar (Ollama)
- ✅ Model delete from disk (Ollama)
- ✅ Model library browser — 30+ popular Ollama models browsable in-app
- ✅ Model capability badges — vision, tools, code, long-context
- ✅ Model family grouping in dropdown (Llama 3, Qwen, Mistral…)
- ✅ Per-model parameter profiles — save temperature + max tokens per model
- ✅ Real-time tokens/sec counter during generation
- ✅ GPU / VRAM usage monitoring — live VRAM bar per loaded model
- ✅ System RAM usage bar
- ✅ Cost estimation for cloud providers — per-response USD display
- 🔥 Model library search — live search against ollama.com/library API
- ✅ Model benchmark runner — measure tokens/sec, TTFT, and total time per model; ranked results table
- 🔲 Hardware-aware model suggestions — recommend models that fit available VRAM
- 🔲 GGUF file drag-and-drop import
- 🔲 Favorite / pin models to top of selector
- 🔲 Model update notifications — alert when a newer version exists
- 🔲 Performance dashboard — tokens/sec charts over time per model

---

## OpenCode DNA — Code-First Agentic Workflow

> *What makes OpenCode great: it treats code as a first-class citizen with agents, tools, and file context.*

- ✅ Syntax-highlighted code blocks (14 languages via Prism.js)
- ✅ Artifact rendering — HTML, SVG, JSX, TSX in sandboxed iframe
- ✅ Autonomous agent loop (up to 8 tool-call rounds)
- ✅ Built-in tools: `datetime`, `calculator`, `web_search`, `fetch_url`, `run_javascript`, `rag_search`
- ✅ Live tool-call visualization — input → result → elapsed time
- ✅ MCP stdio client — spawn external MCP servers
- ✅ Prompt templates with `{{variable}}` placeholders
- ✅ Plan mode — think step-by-step prefix before answering
- ✅ Live code editing inside artifact preview — edit + re-render inline (Ctrl+Enter to run, Tab inserts spaces, Reset to original)
- 🔥 File tree sidebar — browse local filesystem via MCP filesystem server
- 🔥 Multi-file context — select and attach multiple files as context
- 🔥 Git integration — show diff, stage, commit, PR review workflow
- 🔥 Diff viewer — before/after code comparison with syntax highlighting
- 🔥 Shell command tool — opt-in, confirmation prompt per execution
- 🔥 Custom tool builder UI — define name, description, JSON schema, handler
- 🔲 Terminal pane — run shell commands, see output inline
- 🔲 Copy code → file save dialog (write directly to disk)
- 🔲 Multi-language REPL (run Python, JS, etc. sandboxed)
- 🔲 Code lens — inline AI suggestions in code blocks
- 🔲 VS Code extension — send selected code to LLM Hub

---

## Modern UI DNA — Linear / Vercel-Inspired Design

> *What makes Linear/Vercel great: fast, minimal, keyboard-driven, polished micro-interactions.*

- ✅ Dark and light themes with system-preference detection
- ✅ Linear/Vercel-inspired design tokens (Inter + JetBrains Mono)
- ✅ Command palette (⌘P) — fuzzy search all actions and conversations
- ✅ Keyboard shortcuts (⌘K, ⌘J, ⌘R, ⌘E, ⌘/) with help modal (`?`)
- ✅ Collapsible right-sidebar accordion panels
- ✅ Drag-to-resize left and right sidebars
- ✅ Skeleton loading states — smooth placeholders while content loads
- ✅ Animated micro-interactions — fade-ins, hover effects, welcome screen
- ✅ Full-screen focus mode — hide all sidebars, center content (⌘⇧F)
- ✅ Collapsible long messages — auto-collapse > ~22 lines
- ✅ Responsive welcome screen with quick-action cards
- ✅ Sampling presets — Precise / Balanced / Creative one-click buttons
- ✅ Fully responsive mobile layout — hamburger sidebar, touch-friendly
- ✅ Customizable accent color — color picker + 7 presets + custom hex in Appearance tab
- ✅ Font size and chat density — Compact / Comfortable / Spacious modes in Appearance tab
- 🔲 Inline message diff view for edited messages
- 🔲 Custom welcome screen card configuration
- 🔲 Onboarding wizard for first-time setup
- 🔲 Keyboard shortcut remapping

---

## Chat Experience

> *Best-in-class conversation UX — the core loop that users live in.*

- ✅ Token streaming via SSE
- ✅ Stop generation mid-stream
- ✅ Persistent chat history (localStorage)
- ✅ Message edit & regenerate
- ✅ Continue generation
- ✅ Message copy, delete
- ✅ Message reactions (👍 👎 RLHF-style)
- ✅ Auto-title from first message
- ✅ Chat fuzzy search (⌘K)
- ✅ Conversation title rename — double-click inline
- ✅ Conversation pinning
- ✅ Conversation folders — organize into named groups
- ✅ Conversation labels / color tags
- ✅ Conversation branching — fork any chat from any user message
- ✅ Share conversation — export as self-contained HTML
- ✅ Chat export — Markdown and JSON
- ✅ Backup & restore — all settings + conversations as single JSON
- ✅ Import conversations — merge from LLM Hub backup or ChatGPT export
- ✅ Bulk conversation management — checkbox select, bulk delete & export JSON
- ✅ Message search within a single conversation (⌘F, highlight + navigate)
- 🔲 Multi-tab chat (several conversations side-by-side)
- 🔲 Context window timeline visualization

---

## Voice & Multimodal

- ✅ Image attachments — paste, drag-and-drop, file picker
- ✅ Vision model support (llava, qwen2-vl, llama3.2-vision)
- ✅ Voice input via browser Web Speech API
- ✅ Whisper server integration — local transcription
- ✅ Text-to-speech output — 🔊 Read button, Voice settings tab, voice/rate/pitch
- ✅ PDF attachment — client-side text extraction via PDF.js, sent as document context
- 🔲 Audio file transcription by drag-and-drop
- 🔲 Video frame extraction for vision models
- 🔲 Screen capture / screenshot from clipboard

---

## Model Comparison

- ✅ Side-by-side split-screen comparison
- ✅ Parallel streaming to two models simultaneously
- ✅ Per-pane latency and token stats
- 🔥 Response quality grading — thumbs up/down per pane
- ✅ Diff view between two model responses — word-level LCS diff modal, colour-coded ins/del
- 🔲 Save comparison as formatted report
- 🔲 A/B test mode — random model selection, reveal after both respond
- 🔲 Multi-model tournament — bracket-style comparison

---

## RAG / Knowledge Base

- ✅ File upload and chunking (.txt, .md, .json, code files)
- ✅ Ollama embedding (nomic-embed-text by default)
- ✅ Cosine-similarity vector search
- ✅ Collection management — create, query, delete
- ✅ SSE upload progress
- ✅ Web page crawl — paste URL, fetch server-side, strip HTML, embed into collection
- ✅ PDF attachment — extract text, attach as inline document context (chat input)
- 🔲 GitHub repository indexing — clone + embed all files
- 🔲 Auto-inject most-relevant chunks into every message
- 🔲 Chunk preview and manual editing UI
- 🔲 Hybrid search — keyword + vector BM25
- 🔲 Multi-collection query (search across all at once)

---

## Security & Privacy

- ✅ Binds to `127.0.0.1` by default (no LAN exposure without opt-in)
- ✅ SSRF protection on `fetch_url`
- ✅ VM sandbox for `run_javascript`
- ✅ CORS locked to localhost
- 🔲 Per-session API key (never persisted to disk)
- 🔲 Prompt injection warning detection
- 🔲 Conversation data encryption at rest
- 🔲 Audit log of all tool executions

---

## Progress Summary

| Area | ✅ Done | 🔥 Next | 🔲 Backlog |
|------|---------|---------|-----------|
| LM Studio DNA | 14 | 1 | 5 |
| OpenCode DNA | 9 | 6 | 5 |
| Modern UI | 15 | 0 | 4 |
| Chat Experience | 20 | 0 | 3 |
| Voice & Multimodal | 6 | 0 | 3 |
| Model Comparison | 3 | 2 | 3 |
| RAG / Knowledge | 6 | 1 | 5 |
| Security | 4 | 0 | 4 |
| **Total** | **77** | **10** | **32** |

---

*Last updated: 2026-06-06*
