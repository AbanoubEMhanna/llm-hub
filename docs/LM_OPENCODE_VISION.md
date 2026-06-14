# LLM Hub — Product Vision Checklist

> **Goal:** Build the best local-first AI workbench that combines:
> - **LM Studio** — model management, hardware awareness, VRAM monitoring, model library
> - **OpenCode** — code-first agent workflow, file context, shell execution, git integration
> - **Modern UI** — Linear/Vercel-inspired, keyboard-first, fast, polished
>
> Legend: ✅ Done · 🔥 In progress / high priority · 🔲 Backlog

---

## LM Studio DNA — Model Management & Hardware

| Feature | Status | Notes |
|---------|--------|-------|
| Connect to local Ollama server | ✅ | Auto-detect on startup |
| Connect to LM Studio server | ✅ | OpenAI-compatible endpoint |
| Unified model dropdown across all providers | ✅ | |
| Model info card — size, params, context length | ✅ | In right sidebar |
| Model capability badges (vision, tools, code) | ✅ | |
| Model family grouping in dropdown | ✅ | Llama 3, Qwen, Mistral… |
| Model library browser — browse & pull Ollama models | ✅ | 30+ popular models |
| Model pull with live progress bar | ✅ | |
| Model delete from disk | ✅ | |
| Running model detection (RAM/VRAM loaded) | ✅ | |
| Live VRAM bar per loaded model | ✅ | |
| System RAM usage bar | ✅ | |
| Real-time tokens/sec counter | ✅ | |
| Model benchmark runner (TTFT, speed, time) | ✅ | Ranked results table |
| Per-model parameter profiles (auto-save) | ✅ | |
| Favorite / pin models to top of selector | ✅ | |
| Session cost accumulator | ✅ | Running total with reset |
| Cloud provider cost estimation per response | ✅ | |
| Hardware-aware model suggestions | 🔥 | Recommend by VRAM fit |
| GGUF drag-and-drop import | 🔲 | |
| Model update notifications | 🔲 | |
| Performance charts — tokens/sec over time | 🔲 | |

---

## OpenCode DNA — Code-First Agent Workflow

| Feature | Status | Notes |
|---------|--------|-------|
| Syntax-highlighted code blocks (14 languages) | ✅ | Prism.js |
| Artifact rendering — HTML/SVG/JSX in sandbox | ✅ | Sandboxed iframe |
| Live code editing inside artifact preview | ✅ | Edit + re-render inline |
| Autonomous agent loop (up to 8 tool rounds) | ✅ | |
| Built-in tools: datetime, calculator, web_search, fetch_url, run_javascript, rag_search | ✅ | |
| Live tool-call visualization | ✅ | Input → result → elapsed |
| MCP stdio client — spawn external MCP servers | ✅ | |
| Prompt templates with `{{variable}}` placeholders | ✅ | |
| PDF attachment — client-side extraction | ✅ | PDF.js |
| JSON mode — force `response_format: json_object` | ✅ | |
| JSON Schema mode — enforce output structure with editor + presets | ✅ | |
| Shell command tool — opt-in, confirmation prompt | 🔥 | Safe opt-in execution |
| File tree sidebar (MCP filesystem server) | 🔥 | Browse local files |
| Multi-file context — attach multiple files | 🔥 | |
| Git integration — diff, stage, commit, PR review | 🔥 | |
| Diff viewer — before/after with syntax highlighting | 🔥 | |
| Custom tool builder UI | 🔥 | Name, schema, handler URL |
| Agent run history — step-by-step replay | 🔥 | |
| Terminal pane — inline shell output | 🔲 | |
| Multi-language REPL (Python, JS sandbox) | 🔲 | |
| Code lens — inline AI suggestions in code blocks | 🔲 | |

---

## Modern UI DNA — Linear/Vercel-Inspired Design

| Feature | Status | Notes |
|---------|--------|-------|
| Dark/light themes with system-preference detection | ✅ | |
| Linear/Vercel design tokens (Inter + JetBrains Mono) | ✅ | |
| Command palette (⌘P) — fuzzy search all actions | ✅ | |
| Keyboard shortcuts with help modal (?) | ✅ | |
| Collapsible/resizable sidebars | ✅ | Drag-to-resize, persisted |
| Skeleton loading states / shimmer | ✅ | |
| Animated micro-interactions | ✅ | Fade-in, hover effects |
| Full-screen focus mode (⌘⇧F) | ✅ | |
| Appearance settings — accent color, font size, density | ✅ | |
| Sampling presets — Precise / Balanced / Creative | ✅ | |
| Collapsible long messages (Show more / less) | ✅ | |
| Plan mode — step-by-step thinking before response | ✅ | |
| Message timestamps (hover to peek, T key to pin) | ✅ | |
| Multi-tab chat — conversations side-by-side | 🔥 | |
| Fully responsive mobile layout | 🔥 | Hamburger nav, touch |
| Proper Settings UI with tabs (General/Providers/Tools/RAG/Audio/Advanced) | 🔥 | |
| Onboarding wizard for first-time setup | 🔲 | |
| Keyboard shortcut remapping | 🔲 | |
| Custom welcome screen card configuration | 🔲 | |

---

## Chat & Conversation

| Feature | Status | Notes |
|---------|--------|-------|
| Token streaming via SSE | ✅ | |
| Stop generation mid-stream | ✅ | |
| Persistent chat history (localStorage) | ✅ | |
| Chat export — Markdown, JSON, standalone HTML | ✅ | |
| Message edit & regenerate | ✅ | |
| Message reactions (👍 👎 RLHF-style) | ✅ | |
| Conversation pinning | ✅ | |
| Auto-title from first message | ✅ | |
| Chat fuzzy search (⌘K) | ✅ | |
| In-conversation message search (⌘F) | ✅ | |
| Conversation color labels with sidebar filter | ✅ | |
| Conversation folders | ✅ | |
| Conversation branching (fork from any message) | ✅ | |
| Backup & restore (single JSON) | ✅ | |
| Import ChatGPT conversations | ✅ | |
| Bulk conversation management | ✅ | Checkbox select, delete, export |
| Side-by-side model comparison | ✅ | Parallel streaming |
| Response quality grading (thumbs up/down per pane) | ✅ | |
| Word-level diff view between model responses | ✅ | |
| Context window usage indicator (warns at >75%) | ✅ | |
| Multi-tab chat | 🔥 | |
| Context window timeline visualization | 🔲 | |
| Inline message threading / replies | 🔲 | |

---

## RAG / Knowledge Base

| Feature | Status | Notes |
|---------|--------|-------|
| File upload — .txt, .md, .json, code files | ✅ | |
| Ollama embedding (nomic-embed-text) | ✅ | |
| Cosine-similarity vector search | ✅ | |
| Collection management (create, query, delete) | ✅ | |
| Web page crawl — paste URL, embed into collection | ✅ | |
| GitHub repository indexing | 🔲 | Clone + embed all files |
| Auto-inject relevant chunks into every message | 🔲 | Toggle |
| Chunk preview and manual editing | 🔲 | |
| Hybrid search (keyword + vector BM25) | 🔲 | |
| Multi-collection query | 🔲 | |

---

## Voice & Multimodal

| Feature | Status | Notes |
|---------|--------|-------|
| Image attachments (paste, drag-drop, file picker) | ✅ | |
| Vision model support (llava, qwen2-vl, llama3.2-vision) | ✅ | |
| Voice input (Web Speech API) | ✅ | |
| Whisper server integration | ✅ | Local transcription |
| Text-to-speech output (🔊 Read button) | ✅ | |
| Audio drag-and-drop transcription | 🔲 | |
| Screen capture / screenshot from clipboard | 🔲 | |

---

## Security & Privacy

| Feature | Status | Notes |
|---------|--------|-------|
| Proxy binds to 127.0.0.1 (secure default) | ✅ | |
| SSRF protection on fetch_url | ✅ | |
| VM sandbox for run_javascript | ✅ | |
| CORS locked to localhost | ✅ | |
| Prompt injection warning detection | 🔲 | |
| Conversation encryption at rest | 🔲 | |
| Audit log of all tool executions | 🔲 | |

---

## Developer & Integration

| Feature | Status | Notes |
|---------|--------|-------|
| SSE streaming API (/v1/chat) | ✅ | |
| OpenAI-compatible passthrough | ✅ | |
| MCP stdio client | ✅ | |
| Node.js syntax validation CI | ✅ | v18, v20, v22 |
| OpenAPI/Swagger spec for all proxy endpoints | 🔥 | |
| Unit tests (RagEngine, ToolRegistry, SSRF guard) | 🔥 | |
| Integration tests for HTTP endpoints | 🔥 | |
| Docker image with Ollama bundled | 🔲 | |
| VS Code extension | 🔲 | |
| Plugin system | 🔲 | |
| `npx local-llm-hub` zero-install launcher | 🔲 | |

---

## Progress Summary

| Category | ✅ Done | 🔥 Next | 🔲 Backlog |
|----------|---------|---------|-----------|
| LM Studio DNA | 17 | 1 | 3 |
| OpenCode DNA | 11 | 7 | 3 |
| Modern UI | 14 | 4 | 3 |
| Chat & Conversation | 18 | 1 | 3 |
| RAG / Knowledge | 5 | — | 5 |
| Voice & Multimodal | 5 | — | 2 |
| Security & Privacy | 4 | — | 3 |
| Developer & Integration | 5 | 3 | 5 |
| **Total** | **79** | **16** | **27** |

---

*Last updated: 2026-06-13 — reflects all merged PRs #1–#42 including JSON Schema editor.*
