# LLM Hub — App Vision Feature Checklist

> **Vision:** Build the best local-first AI workbench — combining **LM Studio**'s model management and hardware awareness, **OpenCode**'s code-first agentic workflow, and a **modern Linear/Vercel-inspired UI** that feels fast, focused, and professional.
>
> This checklist tracks the features that make LLM Hub feel like a native-grade product rather than a weekend project.
>
> **Legend:** ✅ Shipped · 🚧 In progress · 🔥 Next up · 🔲 Backlog

---

## LM Studio DNA — Model Management & Hardware Awareness

| Status | Feature |
|--------|---------|
| ✅ | Multi-provider model aggregation — Ollama, LM Studio, OpenAI, Anthropic, Groq, OpenRouter, custom endpoints |
| ✅ | Model metadata panel — size, params, context length, quantization |
| ✅ | Running model detection — highlight which models are loaded in RAM/VRAM |
| ✅ | Model pull / download with live progress bar (Ollama) |
| ✅ | Model delete from disk (Ollama) |
| ✅ | Model library browser — 30+ popular Ollama models browsable in-app |
| ✅ | Model capability badges — vision, tools, code, long-context |
| ✅ | Model family grouping in dropdown (Llama 3, Qwen, Mistral…) |
| ✅ | Per-model parameter profiles — save temperature + max tokens per model |
| ✅ | Real-time tokens/sec counter during generation |
| ✅ | GPU / VRAM usage monitoring — live VRAM bar per loaded model |
| ✅ | System RAM usage bar |
| ✅ | Cost estimation for cloud providers — per-response USD display |
| 🔥 | Model library search — live search against ollama.com/library |
| 🔥 | Model benchmark runner — measure tokens/sec per model with a standard prompt |
| 🔲 | Hardware-aware model suggestions — recommend models that fit available VRAM |
| 🔲 | GGUF file drag-and-drop import (direct into LM Studio) |
| 🔲 | Favorite / pin models to top of selector |
| 🔲 | Model update notifications — alert when a newer version exists |
| 🔲 | Performance dashboard — tokens/sec charts over time per model |

---

## OpenCode DNA — Code-First Agentic Workflow

| Status | Feature |
|--------|---------|
| ✅ | Syntax-highlighted code blocks (14 languages via Prism.js) |
| ✅ | Artifact rendering — HTML, SVG, JSX, TSX in sandboxed iframe |
| ✅ | Autonomous agent loop (up to 8 tool-call rounds) |
| ✅ | Built-in tools: `datetime`, `calculator`, `web_search`, `fetch_url`, `run_javascript`, `rag_search` |
| ✅ | Live tool-call visualization — input → result → elapsed time |
| ✅ | MCP stdio client — spawn external MCP servers |
| ✅ | Prompt templates with `{{variable}}` placeholders |
| ✅ | Plan mode — think step-by-step prefix before answering |
| 🔥 | Live code editing inside artifact preview — edit + re-render inline |
| 🔥 | File tree sidebar — browse local filesystem via MCP filesystem server |
| 🔥 | Multi-file context — select and attach multiple files as context |
| 🔥 | Git integration — show diff, stage, commit, PR review workflow |
| 🔥 | Diff viewer — before/after code comparison with syntax highlighting |
| 🔥 | Shell command tool — opt-in, confirmation prompt per execution |
| 🔥 | Custom tool builder UI — define name, description, JSON schema, handler |
| 🔲 | Terminal pane — run shell commands, see output inline |
| 🔲 | Copy code → file save dialog (write directly to disk) |
| 🔲 | Multi-language REPL (run Python, JS, etc. sandboxed) |
| 🔲 | Code lens — inline AI suggestions in code blocks |
| 🔲 | VS Code extension — send selected code to LLM Hub |

---

## Modern UI DNA — Linear/Vercel-Inspired Design

| Status | Feature |
|--------|---------|
| ✅ | Dark and light themes with system-preference detection |
| ✅ | Linear/Vercel-inspired design tokens (Inter + JetBrains Mono) |
| ✅ | Command palette (⌘P) — fuzzy search all actions and conversations |
| ✅ | Keyboard shortcuts (⌘K, ⌘J, ⌘R, ⌘E, ⌘/) with help modal (`?`) |
| ✅ | Collapsible right-sidebar accordion panels |
| ✅ | Drag-to-resize left and right sidebars |
| ✅ | Skeleton loading states — smooth placeholders while content loads |
| ✅ | Animated micro-interactions — fade-ins, hover effects, welcome screen |
| ✅ | Full-screen focus mode — hide all sidebars, center content (⌘⇧F) |
| ✅ | Collapsible long messages — auto-collapse > ~22 lines |
| ✅ | Responsive welcome screen with quick-action cards |
| ✅ | Sampling presets — Precise / Balanced / Creative one-click buttons |
| 🔥 | Fully responsive mobile layout — hamburger sidebar, touch-friendly |
| 🔥 | Customizable accent color — color picker in settings |
| 🔥 | Font size and chat density — Compact / Comfortable / Spacious modes |
| 🔲 | Inline message diff view for edited messages |
| 🔲 | Custom welcome screen card configuration |
| 🔲 | Onboarding wizard for first-time setup |
| 🔲 | Keyboard shortcut remapping |

---

## Chat Experience — Best-in-Class Conversation UX

| Status | Feature |
|--------|---------|
| ✅ | Token streaming via SSE |
| ✅ | Stop generation mid-stream |
| ✅ | Persistent chat history (localStorage) |
| ✅ | Message edit & regenerate |
| ✅ | Continue generation |
| ✅ | Message copy, delete |
| ✅ | Message reactions (👍 👎 RLHF-style) |
| ✅ | Auto-title from first message |
| ✅ | Chat fuzzy search (⌘K) |
| ✅ | Conversation title rename — double-click inline |
| ✅ | Conversation pinning |
| ✅ | Conversation folders — organize into named groups |
| ✅ | Conversation labels / color tags |
| ✅ | **Conversation branching** — fork any chat from any user message |
| ✅ | Share conversation — export as self-contained HTML |
| ✅ | Chat export — Markdown and JSON |
| ✅ | Backup & restore — all settings + conversations as single JSON |
| 🔥 | Import conversations from JSON / ChatGPT export |
| 🔲 | Multi-tab chat (several conversations side-by-side) |
| 🔲 | Bulk conversation management (select all → delete / export) |
| 🔲 | Context window timeline visualization |
| 🔲 | Message search within a single conversation |

---

## Voice & Multimodal

| Status | Feature |
|--------|---------|
| ✅ | Image attachments — paste, drag-and-drop, file picker |
| ✅ | Vision model support (llava, qwen2-vl, llama3.2-vision) |
| ✅ | Voice input via browser Web Speech API |
| ✅ | Whisper server integration — local transcription |
| ✅ | Text-to-speech output — 🔊 Read button, Voice settings tab, voice/rate/pitch |
| 🔥 | PDF attachment — extract text and attach as context |
| 🔲 | Audio file transcription by drag-and-drop |
| 🔲 | Video frame extraction for vision models |
| 🔲 | Screen capture / screenshot from clipboard |

---

## Model Comparison

| Status | Feature |
|--------|---------|
| ✅ | Side-by-side split-screen comparison |
| ✅ | Parallel streaming to two models simultaneously |
| ✅ | Per-pane latency and token stats |
| 🔥 | Response quality grading — thumbs up/down per pane |
| 🔥 | Diff view between two model responses |
| 🔲 | Save comparison as formatted report |
| 🔲 | A/B test mode — random model selection, reveal after both respond |
| 🔲 | Multi-model tournament — bracket-style comparison |

---

## RAG / Knowledge Base

| Status | Feature |
|--------|---------|
| ✅ | File upload and chunking (.txt, .md, .json, code files) |
| ✅ | Ollama embedding (nomic-embed-text by default) |
| ✅ | Cosine-similarity vector search |
| ✅ | Collection management — create, query, delete |
| ✅ | SSE upload progress |
| 🔥 | Web page crawl — paste URL, auto-scrape into knowledge base |
| 🔥 | PDF attachment — extract text, embed, attach as context |
| 🔲 | GitHub repository indexing — clone + embed all files |
| 🔲 | Auto-inject most-relevant chunks into every message |
| 🔲 | Chunk preview and manual editing UI |
| 🔲 | Hybrid search — keyword + vector BM25 |

---

## Progress Summary

| Category | ✅ Done | 🔥 Next | 🔲 Backlog |
|----------|---------|---------|-----------|
| LM Studio DNA | 13 | 2 | 5 |
| OpenCode DNA | 8 | 7 | 5 |
| Modern UI | 12 | 4 | 4 |
| Chat UX | 15 | 1 | 4 |
| Voice & Multimodal | 5 | 1 | 3 |
| Model Comparison | 3 | 2 | 3 |
| RAG / Knowledge | 5 | 2 | 3 |
| **Total** | **61** | **19** | **27** |

---

*Last updated: 2026-05-27*
