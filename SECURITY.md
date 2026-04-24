# Security Policy

## Overview

Local LLM Hub is designed for **local, single-user development use**. It binds to `127.0.0.1` by default and is not hardened for multi-tenant or internet-facing deployment.

## Threat Model

**Users should be aware of the following:**

### `run_javascript` tool is NOT a secure sandbox
This tool uses Node.js's `vm` module, which the Node.js team explicitly documents as **not a security boundary**. A determined model (or an adversarially crafted prompt) can escape the sandbox — for example via `this.constructor.constructor('return process')()` — and gain full access to the host environment.

**Never enable `run_javascript` if:**
- You expose the proxy to other users or networks.
- You pipe untrusted inputs into a model that has this tool enabled.
- You run this software in a shared or production environment.

You can disable this tool by removing `"run_javascript"` from `config.tools.built_in` in `config.json`.

### `fetch_url` blocks private addresses
As of v3.1, `fetch_url` refuses to connect to private, loopback, or link-local addresses, and declines to auto-follow redirects to such addresses. However, DNS rebinding attacks and time-of-check-to-time-of-use (TOCTOU) issues are not fully mitigated. Treat any tool results from this endpoint as untrusted.

### MCP servers run with your user's privileges
When you enable an MCP server in `config.json`, the proxy spawns the configured command with your environment and full user privileges. **Only enable MCP servers you trust.** Review the command and arguments before enabling, especially if they involve filesystem access or API keys.

### CORS is permissive (`*`)
Any web page you visit can make requests to `http://127.0.0.1:8765` while the proxy is running. Because the proxy binds to `localhost` only by default, this is limited to pages running on your own machine, but it still means malicious web pages could:
- Read your model list
- Send prompts (consuming your compute)
- Query your RAG collections

If you want to harden this, you can modify `setCORS()` in `proxy.js` to allow only specific origins, or run the UI from the same origin as the proxy.

### `localStorage` stores everything client-side
Conversations, pasted images (as base64), system-prompt presets, and templates are all stored in the browser's `localStorage`. This data is **not encrypted** and is accessible to any JavaScript running on the same origin.

## Reporting a Vulnerability

If you discover a security issue, please **do not open a public issue**.

Instead, email: **abanoubemhanna@gmail.com**

Please include:
- A description of the issue
- Steps to reproduce
- Proof of concept (if applicable)
- Your assessment of impact

You can expect an initial response within 7 days. I'll work with you on a timeline for a fix and coordinated disclosure if appropriate.

## Supported Versions

Only the latest minor release receives security fixes.

| Version | Supported |
|---------|-----------|
| 3.1.x   | ✅        |
| < 3.1   | ❌        |
