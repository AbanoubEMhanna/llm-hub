# LLM Hub — Migration Plan to a t3code-class Architecture

> **Goal:** Evolve `llm-hub` from a single-file vanilla-JS web app into a TypeScript + React monorepo with IDE-grade features, **while keeping full local-model support (Ollama + LM Studio)** that `t3code` does not have.
>
> **Reference target:** [`pingdotgg/t3code`](https://github.com/pingdotgg/t3code) — Bun + Turbo monorepo, React 19 + Vite + Tailwind frontend, Effect + SQLite backend, Electron desktop, agent-SDK orchestration.
>
> **Our differentiator vs. t3code:** Local models stay first-class. We are a **hybrid** — model-client *and* agent-orchestrator.

---

## Current baseline (May 2026)

| | Value |
|---|---|
| Frontend | Vanilla JS — `app.js` (3,620 LOC), `index.html` (808 LOC), `styles.css` (1,465 LOC) |
| Backend | Single-file Node proxy — `proxy.js` (1,817 LOC), CommonJS, zero runtime deps |
| Storage | Browser `localStorage` only |
| Providers | Ollama, LM Studio, OpenAI, Anthropic, Groq, OpenRouter |
| Features shipped | Streaming SSE, RAG, MCP stdio client, agent tools, vision, voice, compare mode |
| Distribution | `node proxy.js` (manual), no installer |
| Tests | None |
| Build | None — direct browser load |

---

## Phase 0 — Strategic decisions  *(this document)*

These decisions are locked. They drive every subsequent phase.

### D-0.1 — Product framing: **hybrid model-client + agent-orchestrator**

- **Local models (Ollama, LM Studio) remain first-class.** This is our moat vs. t3code.
- **Cloud chat providers (OpenAI, Anthropic, Groq, OpenRouter) remain first-class.**
- **NEW:** add `@anthropic-ai/claude-agent-sdk` and `@opencode-ai/sdk` as *additional* provider types, surfaced as "Agent providers" in the UI. They live next to (not instead of) the existing providers.

### D-0.2 — Stack target

| Layer | Choice | Rationale |
|---|---|---|
| Language | **TypeScript** strict mode | Matches t3code, prevents regressions in a 7.7k-LOC port |
| Package manager | **pnpm** (not Bun) | Wider ecosystem support; we still ship Node binaries; users on Windows/Linux without Bun stay supported |
| Monorepo | **Turborepo + pnpm workspaces** | Same as t3code shape, Bun-free |
| Frontend | **React 19 + Vite + Tailwind v4** | Same as t3code |
| State | **Zustand** + React Query | Same as t3code |
| Editor (chat composer) | **Lexical** | Same as t3code, supports @mentions |
| Code editor (NEW) | **Monaco** (not CodeMirror) | Better TS/multi-file UX, ships in VS Code |
| Terminal (NEW) | **xterm.js + node-pty** | Same as t3code |
| Backend framework | **Plain Node + Fastify** (NOT Effect) | Effect has steep learning curve; our backend is mostly proxying — keep it simple |
| Persistence | **SQLite via `better-sqlite3`** | Replaces `localStorage`; sync API is simpler than `@effect/sql-sqlite-bun`; no Bun lock-in |
| Streaming | **SSE → WebSocket** | Single bidirectional channel, simpler client-side, but **keep SSE proxy endpoints** for OpenAI-compat passthrough |
| Desktop | **Electron + electron-updater** | Same as t3code |
| Tests | **Vitest + Playwright + MSW** | Same as t3code |
| Linter | **Biome** (not oxlint + custom plugin) | Single tool, formatter + linter, faster than ESLint |

### D-0.3 — Backwards compatibility contract

- **`proxy.js` keeps working unchanged** until Phase 2 lands. No flag day.
- **OpenAI-compatible `/v1/chat/completions` endpoint stays forever.** Third-party tools depend on it.
- **`config.json` schema stays additive only.** New keys allowed, no rename/remove without a 1-version deprecation window.
- **`localStorage` data is migrated to SQLite on first run** of the new build; old data preserved as `~/.llm-hub/legacy-localstorage.json` for safety.

### D-0.4 — Migration safety rules

1. **Old build keeps shipping** from `main` until the new build reaches feature parity. New build lives on `next` branch and `apps/web-next/`.
2. **No feature freeze on `main`.** Open PRs (#20, #21, #22, etc.) keep landing on the legacy stack.
3. **Every new component in `apps/web/` must have a matching Playwright smoke test** before merging.
4. **Provider parity test** — a CI job loads each provider and runs a 5-message conversation. Blocks any release that breaks an existing provider.

### D-0.5 — Out of scope (deliberately)

- **No Tailscale/SSH remote workspaces** — niche, complex, t3code's bet, not ours.
- **No Effect framework** — too much learning cost.
- **No Bun runtime requirement** — Node 20+ only.
- **No closed-source agent CLIs (Codex)** as required dependencies — optional plugin only.
- **No marketing site app** — `apps/marketing` is out; README is enough.

---

## Phase 1 — Foundation: TS + monorepo + React port  *(~3 weeks)*

**Deliverable:** `apps/web/` boots, renders the chat UI, talks to the existing `proxy.js`, supports streaming from Ollama and OpenAI. Old build still ships from `main`.

### Tasks

- [ ] **T-1.1** Add `pnpm-workspace.yaml` and root `package.json` with workspaces
- [ ] **T-1.2** Add `turbo.json` with `build`, `dev`, `lint`, `test`, `typecheck` pipelines
- [ ] **T-1.3** Create `packages/contracts/` — shared TS types for `ChatMessage`, `Provider`, `Conversation`, `Tool`, `RagChunk`, `AgentEvent`
- [ ] **T-1.4** Create `packages/shared/` — `tokenizer.ts`, `sse.ts`, `ssrf-guard.ts`, `cost-estimator.ts` (extracted from `proxy.js`)
- [ ] **T-1.5** Scaffold `apps/web/` — Vite + React 19 + Tailwind v4 + Biome
- [ ] **T-1.6** Move existing `proxy.js` to `apps/server-legacy/` (rename only, no logic change)
- [ ] **T-1.7** Port `index.html` → `apps/web/src/App.tsx` (skeleton: topbar + sidebars + chat area)
- [ ] **T-1.8** Port chat message rendering (`renderMessage`, `buildAssistantWrap`) → `<Message />` component
- [ ] **T-1.9** Port streaming SSE client → `useChatStream` hook with React Query
- [ ] **T-1.10** Port conversation state → `useConversationStore` (Zustand)
- [ ] **T-1.11** Port settings/API-keys → `useSettingsStore` (still `localStorage`-backed for now)
- [ ] **T-1.12** Port command palette (⌘P) → `<CommandPalette />` with `cmdk`
- [ ] **T-1.13** Provider parity smoke test (Playwright) — each provider sends and receives one message

### Acceptance criteria

- `pnpm dev` boots both `apps/web` (Vite) and `apps/server-legacy` (Node proxy)
- Conversations from old build appear in new build via `localStorage` (shared storage)
- All 6 existing providers work end-to-end in the new UI

---

## Phase 2 — Backend modernization  *(~2 weeks)*

**Deliverable:** New `apps/server/` (Fastify + SQLite + WS) co-exists with `apps/server-legacy/`. `localStorage` data migrated to SQLite on first launch.

### Tasks

- [ ] **T-2.1** Scaffold `apps/server/` — Fastify + TypeScript + Biome
- [ ] **T-2.2** SQLite schema (`conversations`, `messages`, `attachments`, `api_keys`, `settings`, `rag_collections`, `rag_chunks`, `tool_runs`)
- [ ] **T-2.3** Port `/v1/chat/completions` (OpenAI compat) — keep API surface identical
- [ ] **T-2.4** Add WebSocket `/ws/chat` channel — bidirectional streaming for new UI
- [ ] **T-2.5** Port `MCP stdio client` from `proxy.js`
- [ ] **T-2.6** Port `RagEngine` (chunking + embedding + cosine search)
- [ ] **T-2.7** Port `ToolRegistry` (`datetime`, `calculator`, `web_search`, `fetch_url`, `run_javascript`, `rag_search`)
- [ ] **T-2.8** One-time `localStorage` → SQLite migrator (runs on first `apps/web` boot; backs up to `~/.llm-hub/legacy-localstorage.json`)
- [ ] **T-2.9** Vitest unit tests for `RagEngine`, `ToolRegistry`, `SSRF guard`, `tokenizer`
- [ ] **T-2.10** Switch `apps/web` to point at `apps/server` (kill `apps/server-legacy`)

### Acceptance criteria

- All existing features work against the new server
- `localStorage` data automatically migrates on first launch
- `apps/server-legacy/` is deleted from `main`

---

## Phase 3 — IDE features  *(~3-4 weeks)*

**Deliverable:** Terminal pane, code editor, file tree, diff viewer, project/workspace abstraction.

### Tasks

- [ ] **T-3.1** `<Terminal />` component (xterm.js) + `apps/server/src/pty/` (node-pty wrapper, opt-in feature flag)
- [ ] **T-3.2** Project/workspace model — `Project` table in SQLite, points at a filesystem path
- [ ] **T-3.3** `<FileTree />` component — read-only file browser via new `/v1/fs/list` endpoint (path-jailed to the project root)
- [ ] **T-3.4** `<CodeEditor />` (Monaco) — single-file editing, syntax highlighting for 14+ languages
- [ ] **T-3.5** `<DiffViewer />` — before/after view using Monaco diff editor
- [ ] **T-3.6** Git integration — `apps/server/src/git/` (simple-git wrapper): `status`, `diff`, `stage`, `commit`, `branch`
- [ ] **T-3.7** Right-sidebar refactor: tabs for `Chat | Terminal | Files | Git`
- [ ] **T-3.8** Lexical-based composer with `@file`/`@symbol` mentions

### Acceptance criteria

- A user can open a project folder, browse files, edit a file in Monaco, run a terminal command, and ask the LLM to refactor — all in one window
- Filesystem access is path-jailed; SSRF guard equivalent applies to fs paths

---

## Phase 4 — Agent SDK integration  *(~1 week)*

**Deliverable:** Claude Agent SDK and OpenCode SDK appear as "Agent providers" alongside Ollama/OpenAI/etc.

### Tasks

- [ ] **T-4.1** Add `@anthropic-ai/claude-agent-sdk` as `apps/server/src/providers/claude-agent.ts`
- [ ] **T-4.2** Add `@opencode-ai/sdk` as `apps/server/src/providers/opencode.ts`
- [ ] **T-4.3** Provider-type taxonomy in `packages/contracts/`: `'chat' | 'agent'`. UI shows a small badge.
- [ ] **T-4.4** Agent event timeline — render `tool_call`, `tool_result`, `plan_step`, `checkpoint` events from agent SDKs
- [ ] **T-4.5** Codex CLI plugin (optional, behind feature flag) — wraps the Codex CLI like t3code does

### Acceptance criteria

- Switching from a chat provider to an agent provider in the same conversation does not lose history
- All existing tools (`run_javascript`, `web_search`, …) still work with chat providers

---

## Phase 5 — Desktop + distribution  *(~1 week)*

**Deliverable:** Signed Electron binaries for macOS, Windows, Linux published to GitHub Releases with auto-update.

### Tasks

- [ ] **T-5.1** Scaffold `apps/desktop/` (Electron 41 + electron-builder + electron-updater)
- [ ] **T-5.2** Bundle `apps/web` (Vite build) + `apps/server` (Node entrypoint) into the Electron package
- [ ] **T-5.3** GitHub Actions release pipeline — build DMG / NSIS / AppImage on push of `v*` tag
- [ ] **T-5.4** Code-signing certificates (macOS notarization, Windows EV) — *cost item, deferred until needed*
- [ ] **T-5.5** Homebrew tap + WinGet manifest + AUR PKGBUILD (matches t3code's install matrix)
- [ ] **T-5.6** `npx llm-hub` still works (web-only mode, no Electron) — Electron is *one* distribution, not *the* distribution

### Acceptance criteria

- A user on macOS can download a `.dmg`, drag-and-drop, launch, and get a working app with auto-update
- The non-Electron `npx llm-hub` mode still works for headless / server / Linux-CLI users

---

## Phase 6 — Testing + observability  *(continuous, kicks off in Phase 1)*

### Tasks

- [ ] **T-6.1** Vitest for `packages/*` (unit tests run on every PR via Turbo)
- [ ] **T-6.2** Playwright smoke suite — provider parity, conversation lifecycle, RAG flow, tool-call flow
- [ ] **T-6.3** MSW handlers for offline-mode dev (no network calls during `pnpm dev`)
- [ ] **T-6.4** OpenTelemetry-compatible event emitter in `apps/server` — opt-in, off by default (privacy-first)
- [ ] **T-6.5** GitHub Actions: `typecheck`, `lint` (Biome), `test:unit`, `test:e2e`, `build` — all required for merge

---

## Risks & open questions

| Risk | Mitigation |
|---|---|
| `app.js` is 3,620 LOC of intertwined state — porting will surface bugs we never knew about | Snapshot every behaviour with Playwright **before** porting; port a feature only when its Playwright test passes against the legacy build |
| Two parallel codebases for ~5 weeks doubles maintenance | Strict cutoff: any feature PR that lands on legacy must also land on `next` within 7 days, or it gets reverted |
| Electron bundle size (~150 MB) alienates the "zero-install" crowd | Keep `npx llm-hub` as a tier-one distribution; Electron is *optional* |
| SQLite migration corrupts user data | Atomic migration: write to `~/.llm-hub/data.sqlite.tmp`, fsync, then `rename()`; back up `localStorage` JSON first |
| Agent SDK APIs churn (still pre-1.0) | Pin minor versions; vendored adapter layer in `apps/server/src/providers/` so SDK churn never reaches the UI |

---

## Status tracker

| Phase | Status | ETA |
|---|---|---|
| Phase 0 — Decisions | ✅ Done (this doc) | 2026-05-21 |
| Phase 1 — Foundation | 🔜 Next | ~3 weeks |
| Phase 2 — Backend | ⏳ Queued | ~2 weeks |
| Phase 3 — IDE features | ⏳ Queued | ~3-4 weeks |
| Phase 4 — Agent SDKs | ⏳ Queued | ~1 week |
| Phase 5 — Desktop | ⏳ Queued | ~1 week |
| Phase 6 — Testing | 🔄 Continuous | — |

**Total estimated effort:** ~10-12 weeks of focused work.
