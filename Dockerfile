# ── Stage 1: dependency validation (ensures no npm deps sneak in)
FROM node:22-alpine AS validate
WORKDIR /app
COPY package.json ./
RUN node -e "const p=require('./package.json'); const d=Object.keys(p.dependencies||{}); if(d.length>0){console.error('ERROR: runtime deps detected:',d);process.exit(1);} console.log('OK: zero runtime dependencies confirmed');"

# ── Stage 2: production image
FROM node:22-alpine AS production

# Security: run as non-root
RUN addgroup -S llmhub && adduser -S -G llmhub llmhub

WORKDIR /app

# Copy application files (owned by non-root user)
COPY --chown=llmhub:llmhub package.json ./
COPY --chown=llmhub:llmhub proxy.js ./
COPY --chown=llmhub:llmhub index.html styles.css app.js ./
COPY --chown=llmhub:llmhub lib/ ./lib/
COPY --chown=llmhub:llmhub config.json ./

# Persistent data directory — mount a volume here in production
RUN mkdir -p /data && chown llmhub:llmhub /data

USER llmhub

# Expose default port (override with PORT env var)
EXPOSE 8765

# Bind to all interfaces inside the container; external exposure is controlled by the host.
# STORAGE_DIR is picked up by proxy.js to store RAG data, conversation backups, etc.
ENV HOST=0.0.0.0 \
    STORAGE_DIR=/data/.llm-hub

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8765/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1));"

CMD ["node", "proxy.js"]
