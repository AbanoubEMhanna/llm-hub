# 🤖 Local LLM Hub v3

Unified local AI playground for **Ollama + LM Studio** — streaming, tool calling, MCP, vision, RAG, agent loops, and more. Zero npm install.

## Quick Start

```bash
node proxy.js
# Then open index.html in browser
```

---

## ✨ All Features

### 🔌 Core
- Unified endpoint for Ollama + LM Studio (one model picker, one API)
- **True token streaming** — tokens appear as the model generates
- **Stop button** — cancel mid-generation; the abort reaches the provider
- OpenAI-compatible passthrough at `/v1/chat/completions`

### 🧰 Tools & Agents
- Autonomous **agent loop** — model can call multiple tools in sequence, up to 8 rounds
- Live tool-call visualization (input, result, elapsed)
- **Built-in tools** (no setup): `datetime`, `calculator`, `web_search` (DuckDuckGo), `fetch_url`, `run_javascript` (vm sandbox, 3s timeout), `rag_search`
- **MCP stdio client** — plug any Model Context Protocol server via `config.json`

### 📚 RAG (Retrieval-Augmented Generation)
- Upload `.txt`, `.md`, `.json`, `.js`, `.ts`, `.py`, etc. into a collection
- Automatic chunking + embedding via Ollama (`nomic-embed-text` by default)
- Model queries its own knowledge via the `rag_search` tool
- Manage collections from the sidebar (create, delete, view chunk count)

### 🖼 Vision / Multimodal
- Image attachments — paste (Cmd+V), click 📎, or **drag & drop** anywhere
- Multiple images per message
- Works with `llava`, `qwen2-vl`, `llama3.2-vision`, etc.

### 💬 Message Actions
Every assistant message has:
- **🔄 Regenerate** — try again (⌘R for last)
- **▶ Continue** — extend the previous response
- **📋 Copy** — to clipboard
- **🗑 Delete**

Every user message has:
- **✏️ Edit** — edit and regenerate from this point (⌘E for last)
- **📋 Copy**
- **🗑 Delete**

### 🎨 Artifacts & Syntax Highlighting
- Code blocks get **Prism.js** syntax highlighting (JS, TS, Python, bash, JSON, MD, SQL, YAML, JSX, TSX, CSS, Go, Rust)
- **HTML / SVG / JSX / TSX** blocks automatically render a **live preview** tab (sandboxed iframe with Babel-in-browser for React)
- One-click **Copy** button on every code block

### 📝 Templates Library (⌘-less)
- 6 built-in templates: Refactor Code, Explain Code, Debug Issue, PR Review, Translate AR↔EN, Summarize
- Templates use `{{variable}}` syntax → fills prompt-by-prompt UI on run
- Create, edit, tag, delete your own templates (saved in localStorage)

### 🎭 System Prompt Presets
6 built-in + save your own: Code Assistant, Code Reviewer, Translator, Concise, Brainstorm, Rubber Duck

### ⚖️ Model Comparison Mode
- Click ⚡ in the top bar → split screen
- Pick two different models → same prompt runs on both in parallel
- See latency + token counts side-by-side

### 🔍 Cmd+K Search
- Fuzzy search across **all** chats + titles + message contents
- Arrow-key navigation, Enter to jump
- Highlighted matches

### 📌 Chat Management
- **Pin** important conversations to top
- Delete with confirm
- Auto-titling from first message
- Export current chat as **Markdown** or **JSON**

### ⚙️ Config Editor
- Edit `config.json` live from UI (⚙️ icon)
- Save → MCP servers and tools reload without restarting the proxy

### 🎛 Parameters & Stats
- Temperature slider + max_tokens input
- Live stats bar: model · context usage · tokens · elapsed time
- **Context window indicator** — turns orange past 75%
- **Live token counter** in the input hint (approximation)

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

### 🎨 Theming
- Dark / Light theme toggle (🌙 in top bar)
- Persists across sessions

---

## 🔌 API Reference

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/health` | Providers + tools status |
| `GET`  | `/v1/models` | All models, prefixed by provider |
| `GET`  | `/v1/tools` | All available tools |
| `GET`  | `/v1/config` | Read current config |
| `POST` | `/v1/config` | Update config + reload MCP |
| `POST` | `/v1/chat` | SSE streaming agent loop (abortable) |
| `POST` | `/v1/chat/completions` | OpenAI-compatible passthrough |
| `GET`  | `/v1/rag/collections` | List RAG collections |
| `POST` | `/v1/rag/upload` | Upload doc (SSE progress) |
| `POST` | `/v1/rag/query` | Query a collection |
| `DELETE` | `/v1/rag/collections/:id` | Delete collection |

### SSE Event Types on `/v1/chat`

```
text_delta   → { delta: "token" }     ← streaming content
tool_call    → { id, name, args }     ← model invoked a tool
tool_result  → { id, name, result }   ← tool returned
done         → { model, elapsed, prompt_tokens, completion_tokens }
error        → { message }
```

---

## 🛠 Adding MCP Servers

Edit `config.json` → set `"enabled": true`:

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

Popular MCP servers:
```bash
npx -y @modelcontextprotocol/server-filesystem /path
npx -y @modelcontextprotocol/server-github            # needs GITHUB_PERSONAL_ACCESS_TOKEN
npx -y @modelcontextprotocol/server-brave-search      # needs BRAVE_API_KEY
npx -y @modelcontextprotocol/server-postgres postgresql://…
```

---

## 💡 Tips

### Using RAG
1. Pull an embedding model: `ollama pull nomic-embed-text`
2. Click **＋** next to "RAG Knowledge" in sidebar
3. Upload docs → new or existing collection
4. Enable tools → model will use `rag_search` when relevant

### Using Vision
```bash
ollama pull llava:latest         # general-purpose
ollama pull qwen2-vl:7b          # strong on OCR
ollama pull llama3.2-vision:11b  # Meta's model
```
Pick the model → paste / drop an image → ask a question.

### Using Templates
Click 📝 in top bar → pick a template → fill in `{{vars}}` → inserted into input, ready to send.

### Model Comparison
Click ⚡ in top bar → pick two models from the pane headers → send. Great for speed/quality comparisons.

---

## 📋 Requirements

- **Node.js** (any version — pure stdlib, no deps)
- **Ollama** on port 11434 (optional, but recommended for RAG embeddings)
- **LM Studio** Server mode on port 1234 (optional)

---

## 📁 Project Structure

```
llm-hub-v2/
├── proxy.js       Node.js proxy server (no deps)
├── config.json    Providers, tools, RAG, MCP config
├── index.html     Entry HTML
├── styles.css     All styling
├── app.js         Frontend logic
├── README.md      This file
└── .llm-hub/      Auto-created: RAG embeddings cache
```

---

## Changelog

### v3.0 (current)
- RAG with Ollama embeddings + upload UI + `rag_search` tool
- `run_javascript` tool (vm sandbox)
- Config editor in UI
- Message actions: regenerate / edit / continue / copy / delete
- Model comparison mode
- Artifacts preview (HTML / SVG / React)
- Prism.js syntax highlighting
- Cmd+K search across chats
- Chat pinning
- Prompt templates library
- Token counter + context indicator
- Export as Markdown
- Theme toggle
- Hotkeys

### v2.1
- True token streaming
- Stop button
- Vision support (paste + drag-drop)
- System prompt presets

### v2.0
- SSE, tool calling, agent loop, MCP stdio, conversation history
