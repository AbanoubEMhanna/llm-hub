# Contributing to Local LLM Hub

Thanks for your interest in contributing! This is a small, focused project and contributions of all sizes are welcome — bug reports, typo fixes, new features, or documentation improvements.

## Philosophy

Local LLM Hub aims to stay **local-first, dependency-free, and hackable**. Please keep these in mind when proposing changes:

- **Zero npm dependencies in the proxy**. `proxy.js` uses only Node's standard library. Front-end libraries (Prism, marked, React for artifacts) are pulled from CDN at runtime. Adding a package.json dependency requires very strong justification.
- **Single-file modules**. The project is deliberately flat: `proxy.js`, `app.js`, `index.html`, `styles.css`. Please avoid introducing build steps, bundlers, or transpilers.
- **No telemetry, no accounts, no cloud**. Everything runs on the user's machine.
- **Readable over clever**. Favor clarity and explicit control flow. This codebase is meant to be read and modified.

## Getting Started

```bash
git clone https://github.com/abanoubEMhanna/local-llm-hub.git
cd local-llm-hub
node proxy.js
# Open index.html in your browser
```

Requires:
- Node.js 18+ (for `fetch`, `AbortController`, etc.)
- Ollama and/or LM Studio running locally

## Making Changes

1. **Create a branch**: `git checkout -b fix/your-fix-name`
2. **Make your changes**. Keep commits focused.
3. **Test manually**. There are no automated tests yet (help welcome!). At minimum, verify:
   - `node --check proxy.js` passes
   - The UI still loads and basic chat works
   - If you touched tools or streaming, test those paths too
4. **Update the CHANGELOG** under `## [Unreleased]` if your change is user-visible.
5. **Open a pull request** with a clear description of what and why.

## Code Style

- 2-space indentation.
- Semi-colons required in JS.
- Keep line length reasonable (~120 chars) but don't wrap religiously.
- Prefer `const` over `let`; avoid `var`.
- Comment the "why", not the "what".

## What I'm Looking For

Especially welcome:
- 🐛 **Bug fixes** with clear reproduction steps.
- 📖 **Documentation improvements** — the README is never done.
- 🎨 **UI/UX polish** — the current design is functional but not final.
- 🔌 **New MCP server recipes** for the README.
- 🌐 **Translations** of the UI strings.
- ⚡ **Performance improvements** (especially faster RAG batching).

Less welcome, but open to discussion:
- Large new features that change the product's scope. Please open an issue first.
- Adding build tooling, bundlers, or frameworks.
- Dependencies in the proxy.

## Reporting Bugs

Use the [bug report template](./.github/ISSUE_TEMPLATE/bug_report.md). Include:
- Your OS and Node.js version
- Which model(s) you were using
- Steps to reproduce
- What you expected vs. what happened
- Any relevant console errors (browser DevTools + proxy terminal output)

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).

Thanks! — Abanoub
