# Phase 0 — Locked Decisions

**Date locked:** 2026-05-21
**Authority:** Owner (Abanoub Mhanna)
**Full context:** [`MIGRATION_PLAN.md`](./MIGRATION_PLAN.md)

This is the one-pager. Open `MIGRATION_PLAN.md` for the full rationale.

---

## What we are building

A **hybrid** LLM workbench:

- **Model-client** for local (Ollama, LM Studio) and cloud (OpenAI, Anthropic, Groq, OpenRouter) providers — this is our moat vs. t3code.
- **Agent-orchestrator** for `@anthropic-ai/claude-agent-sdk` and `@opencode-ai/sdk` — same surface as t3code.
- **IDE-grade UI** — terminal, code editor, file tree, diff viewer, project workspaces — borrowed from t3code's shape.

We are **not** copying t3code's bet of dropping local models. We add agent SDKs *alongside* them.

---

## Stack — locked

| Layer | Choice | Not chosen | Why not |
|---|---|---|---|
| Language | TypeScript (strict) | JavaScript | Codebase will triple in size; types are non-negotiable |
| Package manager | **pnpm** | Bun | Wider OS support; we want `npx llm-hub` to keep working on every platform |
| Monorepo | Turborepo + pnpm workspaces | Nx, Lerna, single-package | Matches t3code; lightweight |
| Frontend | React 19 + Vite + Tailwind v4 | Next.js, Svelte | Same as t3code; no SSR needed |
| State | Zustand + React Query | Redux, MobX, Jotai | Smallest API surface; same as t3code |
| Composer | Lexical | Slate, Tiptap, ProseMirror | @mentions, same as t3code |
| Code editor | Monaco | CodeMirror 6 | VS Code parity; better TS UX |
| Terminal | xterm.js + node-pty | hterm | Industry standard |
| Backend | **Plain Node + Fastify** | Effect, Express, Hono | Effect is overkill; Fastify is fastest mainstream |
| DB | SQLite via `better-sqlite3` | Postgres, PGlite, Effect SQL | Local-first, single-file, sync API |
| Streaming | WebSocket + keep SSE for `/v1/chat/completions` | Pure SSE | Single bidirectional channel for the new UI |
| Desktop | Electron + electron-updater | Tauri, Neutralino | Mature; same as t3code |
| Tests | Vitest + Playwright + MSW | Jest, Cypress | Same as t3code; Vite-native |
| Linter / formatter | **Biome** | ESLint + Prettier, oxlint | One binary, faster, fewer configs |

---

## Hard constraints

1. **Local models are first-class forever.** Any feature that breaks Ollama or LM Studio support is a blocker.
2. **`/v1/chat/completions` API stays unchanged.** Third-party tools rely on it.
3. **`npx llm-hub` keeps working** (web + headless server mode). Electron is one distribution channel, not the only one.
4. **No Bun runtime requirement.** Node 20+ only.
5. **Zero data loss.** Every schema change ships a one-way migration with a backup.
6. **Old build keeps shipping from `main`** until the new build reaches feature parity on `next`.

---

## Explicitly out of scope

- Tailscale / SSH remote workspaces (t3code-specific)
- Effect functional-effect framework (too much learning cost)
- Bun (ecosystem still maturing on Windows)
- Marketing app (`apps/marketing` in t3code) — our README is enough
- Codex CLI as a *required* dependency (optional plugin only)

---

## Target repo layout (end of Phase 1)

```
llm-hub/
├── apps/
│   ├── web/              # Vite + React 19 + Tailwind (NEW)
│   ├── server/           # Fastify + SQLite (lands in Phase 2)
│   ├── server-legacy/    # current proxy.js (deleted at end of Phase 2)
│   └── desktop/          # Electron (lands in Phase 5)
├── packages/
│   ├── contracts/        # shared TS types
│   ├── shared/           # tokenizer, SSE, SSRF guard, cost estimator
│   └── client-runtime/   # shared client-side helpers
├── docs/
├── pnpm-workspace.yaml
├── turbo.json
└── package.json          # workspace root
```

The legacy files (`app.js`, `proxy.js`, `index.html`, `styles.css`) stay at the repo root until Phase 2 lands and the cutover happens.

---

## Next step

**Phase 1, Task T-1.1:** add `pnpm-workspace.yaml` and the root workspace `package.json`. See `MIGRATION_PLAN.md` for the full task list.
