# Reverse Proxy Examples

Ready-to-adapt configs for putting a TLS-terminating reverse proxy in
front of LLM Hub, per the [Production Checklist](../../DEPLOY.md#production-checklist)
in `DEPLOY.md`.

LLM Hub streams chat/agent responses via SSE (`text/event-stream`), so
every example below either disables response buffering or relies on the
proxy's non-buffering default, and sets generous read timeouts — a
long agent run can legitimately keep a connection open for minutes.

| File | Proxy | Notes |
|------|-------|-------|
| [`nginx.conf`](./nginx.conf) | nginx | HTTP→HTTPS redirect + `proxy_buffering off` for SSE |
| [`Caddyfile`](./Caddyfile) | Caddy | Automatic HTTPS via Let's Encrypt; no buffering flags needed |
| [`traefik-dynamic.yml`](./traefik-dynamic.yml) | Traefik (file provider) | For a Traefik instance running outside Docker |
| [`docker-compose.traefik.yml`](./docker-compose.traefik.yml) | Traefik (Docker labels) | Merge into `docker-compose.yml` if Traefik already runs on the same Docker network — run from the repo root with `docker compose -f docker-compose.yml -f docs/reverse-proxy/docker-compose.traefik.yml up -d` |

The Docker-labels overlay resets the base file's `8765:8765` host port
mapping (`ports: !reset []`) so the app is only reachable through
Traefik, not directly. On Compose versions older than 2.24, remove that
`ports:` entry from the `llm-hub` service in `docker-compose.yml`
by hand instead — `!reset` isn't supported there.

In every example, replace `llm-hub.example.com` with your real domain
and point LLM Hub itself at `127.0.0.1:8765` (the proxy's default
`HOST`/`PORT`) — keep `HOST=127.0.0.1` (or `0.0.0.0` only inside a
container network) so LLM Hub is never reachable directly from the
internet; the reverse proxy is the only public-facing entry point.
