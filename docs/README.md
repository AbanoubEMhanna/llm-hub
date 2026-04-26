# Documentation Assets

This folder holds visual assets for the README.

## Required

- **`screenshot.png`** — Hero screenshot for the README. Recommended:
  - 1600×1000 px (will display at ~800px wide on GitHub)
  - Show the chat interface mid-conversation with a model
  - Bonus: include a code artifact preview or a tool call in action
  - macOS users: capture with `Cmd+Shift+4 → Spacebar → click window`
  - Save here, then uncomment the `<img>` line in the main README

## Optional / nice-to-have

- **`screenshot-light.png`** — Same as above but in light theme
- **`demo.gif`** — A 5–15 second screen recording showing streaming + a tool call
  - Use [Kap](https://getkap.co) (macOS, free) or [LICEcap](https://www.cockos.com/licecap/) (cross-platform)
  - Keep file size under 5 MB
- **`architecture.png`** or **`architecture.svg`** — A diagram showing the data flow:
  `Browser → Proxy (8765) → Ollama (11434) / LM Studio (1234)` plus `MCP servers (stdio)` and `RAG store`

Once added, reference them in `README.md` like:

```markdown
<p align="center"><img src="docs/screenshot.png" alt="Local LLM Hub" width="800"></p>
```
