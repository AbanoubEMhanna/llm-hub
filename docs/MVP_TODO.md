# LLM Hub — MVP TODO

> **Vision:** LM Studio + OpenCode + Modern UI  
> A local-first AI workbench combining the model management of LM Studio, the developer workflow of OpenCode, and a Linear/Vercel-inspired UI.
>
> This list is the **gap to MVP** — ordered by impact. For the full feature inventory see `FEATURES_CHECKLIST.md`.

---

## 🔴 Must Ship (Blockers)

### Make it look and feel modern
- [ ] **Fully responsive mobile layout** — hamburger nav, collapsible sidebars, touch-friendly chat (currently breaks below 768px)
- [ ] **Multi-tab chat** — tab bar, open multiple conversations side-by-side (power-user core feature)
- [ ] **Onboarding wizard** — first-run flow: detect Ollama, configure API key, pull first model, send first message

### Code-first workflow (OpenCode parity)
- [ ] **File tree sidebar** — browse local filesystem via MCP filesystem server; click to attach file as context
- [ ] **Multi-file context** — select N files, inject all into system prompt with file paths and contents
- [ ] **Diff viewer** — side-by-side before/after code block with syntax highlighting
- [ ] **Git integration** — show current diff, stage hunks, write commit message with AI, submit PR description

### Agent power
- [ ] **Shell command tool** — opt-in, shows confirmation prompt before each execution
- [ ] **Agent run history** — step-by-step replay with tool inputs/outputs, timing, total tokens used
- [ ] **Custom tool builder** — UI to define a tool: name, description, JSON schema, handler URL

---

## 🟡 High Value (Ship soon)

### Providers
- [ ] **Perplexity AI provider** — sonar-pro, sonar-reasoning (web-connected models)
- [ ] **AI21 Labs provider** — Jamba family (long context, 256k)
- [ ] **Provider health monitoring** — auto-reconnect with backoff, configurable retry count

### Distribution
- [ ] **Publish Docker image** to Docker Hub / GHCR (`llmhub/llm-hub:latest`)
- [ ] **`npx llm-hub` launcher** — zero-install, pulls and starts the server
- [ ] **Reverse proxy examples** — nginx, Caddy, Traefik configs in `docs/`

### Local model management
- [ ] **GGUF drag-and-drop import** — drop a `.gguf` file onto the page, load it into Ollama
- [ ] **Model update notifications** — badge on model card when a newer Ollama tag is available
- [ ] **Total VRAM detection** — nvidia-smi / rocm-smi integration, show in hardware panel

### Chat & context
- [ ] **Context window timeline** — scrollable bar showing which messages fit in the active context window
- [ ] **A/B test mode** — randomly assign model A or B, reveal only after both respond

---

## 🟢 Quick Wins (< 1 day each)

- [ ] **Audio transcription drop** — drag an `.mp3` / `.wav` onto chat, send to Whisper, paste transcript
- [ ] **Auto-inject RAG chunks** — toggle to prepend top-k chunks to every message automatically
- [ ] **Reverse proxy config examples** — nginx/Caddy/Traefik snippets in `docs/reverse-proxy.md`
- [ ] **Copy code → file save** — "Save to file…" button on code blocks (writes via MCP filesystem)
- [ ] **Toast history panel** — slide-out list of recent notifications/errors
- [ ] **GitHub repo RAG indexing** — paste a GitHub URL, clone + embed all files into a collection

---

## 🔵 Backlog (After MVP)

- [ ] Sub-agent spawning (parallel task execution)
- [ ] Agent graph visualization (node/edge view of tool-call chain)
- [ ] Desktop app — Electron or Tauri wrapper
- [ ] VS Code extension — send selected code to LLM Hub
- [ ] CLI batch mode — `echo "prompt" | llm-hub --model llama3`
- [ ] Plugin system — load `.js` modules at startup
- [ ] Multi-model tournament — bracket-style 3+ model comparison
- [ ] Conversation data encryption at rest (opt-in)
- [ ] Cloud sync of settings (opt-in, E2E encrypted)
- [ ] Homebrew / Winget / AUR formula

---

## ✅ Recently Shipped

| Feature | PR |
|---------|-----|
| Cohere provider (Command R+, Aya, Embed) | this branch |
| Together AI provider (Llama, Qwen, DBRX, 200+ models) | #54 |
| Fireworks AI provider (Llama, Mixtral, FireFunction) | #54 |
| Model search / filter in selector | #54 |
| Mistral AI provider | #53 |
| A/B test mode (blind model comparison) | #52 |
| General settings tab + proxy config | #51 |
| Hardware-aware model suggestions | #50 |

---

*Last updated: 2026-06-25*
