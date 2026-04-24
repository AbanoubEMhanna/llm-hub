# 🤖 Local LLM Hub

> A **local-first**, **zero-dependency** web UI for [Ollama](https://ollama.com) and [LM Studio](https://lmstudio.ai) — with streaming, tool calling, MCP, RAG, vision, and more.

<p align="center">
  <img alt="Node.js" src="https://img.shields.io/badge/node.js-%3E%3D18-43853d?logo=node.js&logoColor=white">
  <img alt="License" src="https://img.shields.io/badge/license-MIT-blue.svg">
  <img alt="Dependencies" src="https://img.shields.io/badge/dependencies-0-success">
  <img alt="PRs welcome" src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg">
</p>

<p align="center"><em>One UI, one port (8765), two providers, zero npm install.</em></p>

<!-- TODO: Add a screenshot / GIF here. Save to docs/screenshot.png and uncomment:
<p align="center"><img src="docs/screenshot.png" alt="Local LLM Hub screenshot" width="800"></p>
-->

---

## What it does

Local LLM Hub gives you a clean chat UI that unifies **Ollama** and **LM Studio** behind a single OpenAI-compatible proxy. Pick any model from either provider, stream tokens live, attach images, let the model call tools or search your knowledge base, and do it all without sending a single byte off your machine.

The entire backend is one Node.js file that uses only the standard library. No npm install, no build step, no framework — just `node proxy.js`.

---

## Quick Start

```bash
git clone https://github.com/abanoubEMhanna/local-llm-hub.git
cd local-llm-hub
node proxy.js
```

Then open `index.html` in your browser.

**Requires Node.js 18+**. Ollama and/or LM Studio should be running locally.

Optional, but recommended:
```bash
ollama pull nomic-embed-text   # enables the RAG knowledge base
ollama pull llava              # enables vision (image attachments)
```

---

## Features

### 🔌 Core
- Unified dropdown for Ollama + LM Studio models (one picker, one API)
- **True token streaming** — tokens appear as the model generates them
- **Stop button** — aborts mid-generation and reaches the provider
- OpenAI-compatible passthrough at `/v1/chat/completions`

### 🧰 Tools & Agents
- Autonomous **agent loop** — model can chain tool calls, up to 8 rounds
- Live tool-call visualization (input, result, elapsed time)
- **Built-in tools**: `datetime`, `calculator`, `web_search` (DuckDuckGo), `fetch_url`, `run_javascript`, `rag_search`
- **MCP stdio client** — plug any [Model Context Protocol](https://modelcontextprotocol.io) server via `config.json`

### 📚 RAG
- Upload `.txt`, `.md`, `.json`, code files into a knowledge collection
- Automatic chunking + embedding via Ollama (`nomic-embed-text` by default)
- Model queries its own knowledge via the `rag_search` tool
- Manage collections from the sidebar

### 🖼 Vision / Multimodal
- Image attachments — paste (⌘V), click 📎, or drag & drop anywhere
- Multiple images per message
- Works with `llava`, `qwen2-vl`, `llama3.2-vision`, etc.

### 💬 Message Actions
Hover any message to access:
- **🔄 Regenerate** (⌘R for last)
- **▶ Continue**
- **✏️ Edit & regenerate** (⌘E for last user message)
- **📋 Copy** / **🗑 Delete**

### 🎨 Artifacts & Syntax Highlighting
- Prism.js syntax highlighting for 14+ languages
- **HTML / SVG / JSX / TSX** blocks auto-render a live Preview tab (sandboxed iframe with Babel for React)
- One-click Copy on every code block

### 📝 Prompt Templates
- 6 built-in templates (Refactor, Explain, Debug, PR Review, Translate, Summarize)
- Create your own with `{{variable}}` placeholders → fill-in-the-blank UI on run

### 🎭 System Prompt Presets
6 built-in (Code Assistant, Code Reviewer, Translator, Concise, Brainstorm, Rubber Duck) plus save your own.

### ⚖️ Model Comparison
Click ⚡ in the top bar → split screen → pick two models → send the same prompt in parallel. See latency + tokens side-by-side.

### 🔍 Cmd+K Search
Fuzzy search across every message in every chat. Arrow keys + Enter to jump.

### 📌 Chat Management
Pin important chats, delete with confirm, auto-title from first message, export as **Markdown** or **JSON**.

### ⚙️ Live Config Editor
Edit `config.json` from the UI. Save → MCP servers and tools reload without restarting.

### 🎛 Parameters & Stats
Temperature, max tokens, live token counter, context-usage indicator (warns >75 %), timing stats.

### ⌨️ Hotkeys
| Shortcut | Action |
|----------|--------|
| `Enter` | Send |
| `⇧Enter` | New line |
| `⌘K` / `Ctrl+K` | Search across chats |
| `⌘J` / `Ctrl+J` | New conversation |
| `⌘/` / `Ctrl+/` | Toggle tools |
| `⌘R` / `Ctrl+R` | Regenerate last response |
| `⌘E` / `Ctrl+E` | Edit last user message |
| `Esc` | Close modal |

### 🎨 Dark / Light theme
Toggle with 🌙 in the top bar. Persists across sessions.

---

## 🔌 API Reference

All endpoints live at `http://127.0.0.1:8765`.

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/health` | Providers + tools status |
| `GET`  | `/v1/models` | All models, prefixed by provider (`ollama/llama3`, `lmstudio/…`) |
| `GET`  | `/v1/tools` | All available tools |
| `GET`  | `/v1/config` | Current config |
| `POST` | `/v1/config` | Update config + reload MCP |
| `POST` | `/v1/chat` | SSE streaming agent loop (abortable) |
| `POST` | `/v1/chat/completions` | OpenAI-compatible passthrough (non-streaming) |
| `GET`  | `/v1/rag/collections` | List RAG collections |
| `POST` | `/v1/rag/upload` | Upload doc (SSE progress) |
| `POST` | `/v1/rag/query` | Query a collection |
| `DELETE` | `/v1/rag/collections/:id` | Delete a collection |

### SSE Event Types on `/v1/chat`

```
text_delta   → { delta: "token" }             streaming content
tool_call    → { id, name, args }             model invoked a tool
tool_result  → { id, name, result }           tool returned
done         → { model, elapsed, prompt_tokens, completion_tokens }
error        → { message }
```

---

## 🛠 Adding MCP Servers

Edit `config.json` and set `"enabled": true`:

```json
{
  "mcp_servers": [
    {
      "name": "filesystem",
      "enabled": true,
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/your/path"]
    }
  ]
}
```

Popular ready-to-use MCP servers:

```bash
npx -y @modelcontextprotocol/server-filesystem /path
npx -y @modelcontextprotocol/server-github             # env: GITHUB_PERSONAL_ACCESS_TOKEN
npx -y @modelcontextprotocol/server-brave-search       # env: BRAVE_API_KEY
npx -y @modelcontextprotocol/server-postgres postgresql://…
```

Reload the config from the UI (⚙️ icon) and the server will connect without restarting the proxy.

---

## 🐛 Troubleshooting

### "Cannot reach proxy"
The proxy isn't running. Start it with `node proxy.js` in the project folder.

### Ollama shows "offline" in the badge
Check that Ollama is running: `ollama list`. Default port is 11434.

### LM Studio shows "offline"
LM Studio needs to be in **Server mode**. Open LM Studio → Developer tab → start the server on port 1234.

### RAG uploads fail with "Embedding failed"
You need an embedding model. Run:
```bash
ollama pull nomic-embed-text
```

### Vision doesn't work
Make sure your model actually supports vision. Try `llava`, `qwen2-vl`, or `llama3.2-vision`.

### The UI can see models but sending returns "Model not found"
Refresh the models list by reloading `index.html`. If that doesn't work, check `/v1/models` in your browser to confirm the proxy sees them.

### Artifact preview is blank
Check DevTools → Console for Babel errors. Make sure your React code has a component named `App` or `Component`.

---

## 📁 Project Structure

```
local-llm-hub/
├── proxy.js         Node.js proxy server (no deps)
├── app.js           Frontend logic
├── index.html       Entry HTML
├── styles.css       All styling
├── config.json      Providers, tools, RAG, MCP config
├── README.md        This file
├── LICENSE          MIT
├── CHANGELOG.md     Version history
├── CONTRIBUTING.md  How to contribute
├── SECURITY.md      Security considerations (important!)
└── .llm-hub/        Auto-created: RAG embeddings cache
```

---

## ⚠️ Security Notes

This tool is intended for **local, single-user development**. A few things worth knowing:

- `run_javascript` uses Node's `vm` module, which **is not a true security sandbox**. Don't expose the proxy to the internet or share it with untrusted users.
- The proxy binds to `127.0.0.1` by default. Set `HOST=0.0.0.0` env var to expose to LAN (at your own risk).
- CORS is permissive. Any web page you visit while the proxy is running can query your local models.

See [SECURITY.md](./SECURITY.md) for the full threat model.

---

## 🗺 Roadmap

Planned for future releases:
- Conversation branching
- Multi-agent workflows (planner → executor → critic)
- Voice I/O (speech-to-text, text-to-speech)
- Structured output schemas (JSON mode with validation)
- Desktop app (Electron / Tauri)
- MCP server marketplace
- Smart autocomplete (ghost text)
- Diff view for regenerations

Got an idea? [Open an issue!](https://github.com/abanoubEMhanna/local-llm-hub/issues)

---

## 🤝 Contributing

Contributions welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

---

## 📜 License

MIT © [Abanoub Essam Mhanna](https://github.com/abanoubEMhanna)

---

## 🙏 Acknowledgements

Built with:
- [Ollama](https://ollama.com) — local LLM runner
- [LM Studio](https://lmstudio.ai) — LLM desktop app
- [Model Context Protocol](https://modelcontextprotocol.io) — tool protocol spec
- [marked](https://marked.js.org) — markdown parsing
- [Prism.js](https://prismjs.com) — syntax highlighting
- [Babel](https://babeljs.io) — JSX/TSX rendering in artifacts

If you find this useful, a ⭐ on [GitHub](https://github.com/abanoubEMhanna/local-llm-hub) is much appreciated.
