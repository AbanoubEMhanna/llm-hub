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

Build and run LLM Hub without Ollama (connect to a separately-running Ollama):

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

**Docker Compose:** redeploy a previous image tag:

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

## Production Checklist

- [ ] `.env` file created from `.env.example` with real keys
- [ ] Volume mounts in place for persistent data
- [ ] Reverse proxy (nginx / Caddy / Traefik) in front for HTTPS
- [ ] `HOST` is `0.0.0.0` only within the container (not exposed directly to internet)
- [ ] Firewall rules limit port 8765 to trusted sources
- [ ] Regular backup of the `llm-hub-data` Docker volume
