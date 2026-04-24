# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.1.0] — 2026-04-24

### Security
- **SSRF protection**: `fetch_url` now blocks private/loopback/metadata addresses (`127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.169.254`, IPv6 `::1`/`fe80::/10`/`fc00::/7`, `localhost`, `metadata.google.internal`). Redirects to private addresses are refused.
- **Size & time limits**: `fetch_url` now caps response size at 2 MB and times out after 10 s.
- **`calculator` hardening**: replaced `new Function()` with an isolated `vm` context exposing only `Math`. Added identifier deny-list for defense-in-depth.
- **Default bind address**: proxy now listens on `127.0.0.1` by default. Set `HOST=0.0.0.0` env var to opt in to LAN exposure.
- **`web_search` timeout**: 8 s hard cap.
- **`httpGet` timeout**: 5 s (was unbounded — could hang health checks indefinitely).
- **`run_javascript` description**: clarified that Node `vm` is **not** a security sandbox; tool labeled as development-only.

### Fixed
- RAG sidebar now correctly shows chunk count (was reading wrong field).
- Markdown rendering now supports lists, tables, blockquotes, strikethrough, and task lists (switched to `marked.js`; previous regex-based renderer broke code blocks containing `*` or `#`).
- Compare mode now respects the active system prompt.
- Compare mode surfaces backend `error` events.
- IME composition input (Arabic, Chinese, Japanese, Korean) no longer triggers accidental send on Enter.
- Pin/delete action buttons in sidebar now use proper CSS classes (previously unstyled).
- Added `prism-diff` so PR-review templates render with highlighting.

## [3.0.0] — 2026-04-24

### Added
- **RAG** with file-based vector store and Ollama embeddings (`nomic-embed-text` by default). New `/v1/rag/*` endpoints and `rag_search` tool.
- **`run_javascript`** built-in tool (vm context, 3 s timeout).
- **Config editor** in UI — edit `config.json` live; MCP servers reload on save.
- **Message actions**: regenerate, edit & regenerate, continue, copy, delete.
- **Model comparison mode**: split-screen streaming for two models in parallel.
- **Artifacts preview**: HTML / SVG / JSX / TSX blocks render in a sandboxed iframe (Babel-in-browser for React).
- **Syntax highlighting** via Prism.js (13 languages).
- **⌘K search** across all chats.
- **Chat pinning** (📌 pins to top).
- **Prompt templates library** with `{{variable}}` substitution.
- **Token counter + context indicator** (warns above 75 %).
- **Export to Markdown**.
- **Theme toggle** (dark/light, persisted).
- Hotkeys: ⌘K, ⌘J, ⌘/, ⌘R, ⌘E, Esc.

## [2.1.0] — 2026-04-24

### Added
- True token streaming via SSE (previously buffered).
- Stop button — aborts the in-flight request to the provider.
- Vision support: paste / drag-drop / attach images for multimodal models.
- Six built-in system-prompt presets.

## [2.0.0] — 2026-04-24

### Added
- Tool calling with autonomous agent loop (up to 8 rounds).
- MCP stdio client (Model Context Protocol).
- Built-in tools: `datetime`, `calculator`, `web_search`, `fetch_url`.
- Conversation history in `localStorage`.
- Live tool-call visualization.

## [1.0.0] — 2026-04-24

### Added
- Initial release: OpenAI-compatible proxy for Ollama and LM Studio.
- Unified model list, chat endpoint, health check.
- Minimal HTML chat UI.
