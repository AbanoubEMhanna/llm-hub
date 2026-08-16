# Deployment Guide

## Quick Start (local development)

```bash
git clone https://github.com/abanoubEMhanna/llm-hub.git
cd llm-hub
cp .env.example .env          # fill in any cloud API keys you want
node proxy.js                 # starts on http://localhost:8765
```

---

## Docker (single container)

### Option A: pull the published image

Every push to `main` publishes a multi-arch image to GitHub Container Registry — no local build needed:

```bash
docker pull ghcr.io/abanoubemhanna/llm-hub:latest

docker run -d \
  --name llm-hub \
  -p 8765:8765 \
  -v llm-hub-data:/data \
  -e HOST=0.0.0.0 \
  -e OLLAMA_HOST=host.docker.internal \
  ghcr.io/abanoubemhanna/llm-hub:latest
```

Pin to an immutable tag instead of `latest` for production — each image is also tagged with its short commit SHA (e.g. `ghcr.io/abanoubemhanna/llm-hub:sha-4c03ed0`) and, for tagged releases, its semver (`v1.2.3`, `1.2`).

### Option B: build locally

```bash
docker build -t llm-hub .

docker run -d \
  --name llm-hub \
  -p 8765:8765 \
  -v llm-hub-data:/data \
  -e HOST=0.0.0.0 \
  -e OLLAMA_HOST=host.docker.internal \
  llm-hub
```

Open `http://localhost:8765`.

---

## Docker Compose (LLM Hub + Ollama, recommended)

```bash
cp .env.example .env          # add OPENAI_API_KEY etc. if desired
docker compose up -d
```

Services:
| Service | Port | Description |
|---------|------|-------------|
| `llm-hub` | 8765 | LLM Hub web UI + proxy |
| `ollama` | 11434 | Ollama inference server |

### Pull a model after first start

```bash
docker compose exec ollama ollama pull llama3.2
```

### View logs

```bash
docker compose logs -f llm-hub
docker compose logs -f ollama
```

### Stop

```bash
docker compose down
```

### Stop and remove volumes (destructive — deletes all models and chat history)

```bash
docker compose down -v
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8765` | HTTP port LLM Hub listens on |
| `HOST` | `127.0.0.1` | Bind address (`0.0.0.0` to expose to LAN/container network) |
| `STORAGE_DIR` | `.llm-hub` | Directory for RAG collections and backups |
| `OLLAMA_HOST` | `localhost` | Ollama hostname (use container name in Docker) |
| `OLLAMA_PORT` | `11434` | Ollama port |
| `LM_STUDIO_HOST` | `localhost` | LM Studio hostname |
| `LM_STUDIO_PORT` | `1234` | LM Studio port |

Cloud API keys are set in `.env` (see `.env.example`).

---

## Health Check

The proxy exposes a health endpoint at `GET /health` that returns provider statuses:

```bash
curl http://localhost:8765/health
```

Response example:

```json
{
  "status": "ok",
  "ollama": "online",
  "lmstudio": "offline",
  "openai": "no-key",
  "anthropic": "no-key"
}
```

---

## Rollback

**Published GHCR image:** redeploy the SHA-tagged image from the last known-good commit:

```bash
docker pull ghcr.io/abanoubemhanna/llm-hub:sha-<previous-short-sha>
docker stop llm-hub && docker rm llm-hub
docker run -d --name llm-hub -p 8765:8765 -v llm-hub-data:/data \
  ghcr.io/abanoubemhanna/llm-hub:sha-<previous-short-sha>
```

**Docker Compose (local build):** redeploy a previous image tag:

```bash
docker compose down
docker tag llm-hub:latest llm-hub:backup   # save current before rollback
docker pull llm-hub:<previous-tag>
docker tag llm-hub:<previous-tag> llm-hub:latest
docker compose up -d
```

**Node.js (git):** check out the last stable commit and restart:

```bash
git log --oneline -10          # find the last good commit
git checkout <sha>
node proxy.js
```

---

## Reverse Proxy

Ready-to-adapt nginx, Caddy, and Traefik configs (TLS termination + SSE
streaming settings for `/v1/chat`) live in
[`docs/reverse-proxy/`](docs/reverse-proxy/README.md).

---

## Production Checklist

- [ ] `.env` file created from `.env.example` with real keys
- [ ] Volume mounts in place for persistent data
- [ ] Reverse proxy (nginx / Caddy / Traefik) in front for HTTPS — see [`docs/reverse-proxy/`](docs/reverse-proxy/README.md)
- [ ] `HOST` is `0.0.0.0` only within the container (not exposed directly to internet)
- [ ] Firewall rules limit port 8765 to trusted sources
- [ ] Regular backup of the `llm-hub-data` Docker volume
