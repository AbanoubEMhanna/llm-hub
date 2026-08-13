'use strict';

/**
 * Returns the OpenAPI 3.0 spec for the LLM Hub proxy API.
 * @param {number} port
 * @returns {object}
 */
function buildSpec(port) {
  return {
    openapi: '3.0.3',
    info: {
      title: 'LLM Hub Proxy API',
      version: '3.1.0',
      description:
        'Local-first AI workbench proxy — aggregates Ollama, LM Studio, and cloud providers ' +
        '(OpenAI, Anthropic, Groq, OpenRouter) behind a single OpenAI-compatible interface.',
      contact: { url: 'https://github.com/AbanoubEMhanna/llm-hub' },
      license: { name: 'MIT' },
    },
    servers: [{ url: `http://127.0.0.1:${port}`, description: 'Local proxy' }],
    tags: [
      { name: 'Health',  description: 'Liveness and provider status' },
      { name: 'Models',  description: 'Model listing, pull, and delete' },
      { name: 'Chat',    description: 'Text generation endpoints' },
      { name: 'RAG',     description: 'Retrieval-Augmented Generation — collections and search' },
      { name: 'Audio',   description: 'Whisper transcription' },
      { name: 'Config',  description: 'Runtime configuration' },
      { name: 'Tools',   description: 'Tool registry' },
      { name: 'Logs',    description: 'Local, opt-in request logging' },
      { name: 'AgentRuns', description: 'Local, opt-in agent-loop run history' },
      { name: 'Docs',    description: 'API documentation' },
    ],
    components: {
      securitySchemes: {
        ApiKeys: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Api-Keys',
          description: 'JSON object mapping provider key names to values, e.g. `{"openai_api_key":"sk-..."}`',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Not found' },
          },
          required: ['error'],
        },
        Model: {
          type: 'object',
          properties: {
            id:       { type: 'string', example: 'llama3.2:3b' },
            object:   { type: 'string', example: 'model' },
            provider: { type: 'string', example: 'ollama', enum: ['ollama', 'lmstudio', 'openai', 'anthropic', 'groq', 'openrouter'] },
            created:  { type: 'integer', example: 0 },
          },
        },
        ChatMessage: {
          type: 'object',
          required: ['role', 'content'],
          properties: {
            role:    { type: 'string', enum: ['system', 'user', 'assistant', 'tool'] },
            content: { type: 'string', example: 'Hello, what can you do?' },
          },
        },
        ChatRequest: {
          type: 'object',
          required: ['model', 'messages'],
          properties: {
            model:       { type: 'string', example: 'llama3.2:3b' },
            messages:    { type: 'array', items: { $ref: '#/components/schemas/ChatMessage' } },
            temperature: { type: 'number', minimum: 0, maximum: 2, example: 0.7 },
            max_tokens:  { type: 'integer', example: 2048 },
            top_p:       { type: 'number', minimum: 0, maximum: 1, example: 0.9 },
            top_k:       { type: 'integer', example: 40 },
            repeat_penalty:    { type: 'number', example: 1.1 },
            frequency_penalty: { type: 'number', example: 0 },
            stream:      { type: 'boolean', default: false },
            tools:       { type: 'array', description: 'Names of built-in tools to enable', items: { type: 'string' } },
            response_format: {
              type: 'object',
              properties: {
                type: { type: 'string', enum: ['text', 'json_object', 'json_schema'] },
                json_schema: { type: 'object' },
              },
            },
          },
        },
        RagCollection: {
          type: 'object',
          properties: {
            id:          { type: 'string', format: 'uuid' },
            name:        { type: 'string', example: 'my-docs' },
            chunkCount:  { type: 'integer', example: 42 },
            model:       { type: 'string', example: 'nomic-embed-text' },
            createdAt:   { type: 'string', format: 'date-time' },
            updatedAt:   { type: 'string', format: 'date-time' },
          },
        },
        ToolStatus: {
          type: 'object',
          properties: {
            name:        { type: 'string' },
            enabled:     { type: 'boolean' },
            description: { type: 'string' },
            source:      { type: 'string', enum: ['builtin', 'mcp'] },
          },
        },
      },
    },
    paths: {
      '/health': {
        get: {
          tags: ['Health'],
          summary: 'Provider health check',
          description: 'Pings Ollama, LM Studio, and any configured cloud providers. Returns their status and model counts.',
          responses: {
            200: {
              description: 'Health status of all providers',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      ollama:    { type: 'object', properties: { ok: { type: 'boolean' }, models: { type: 'integer' } } },
                      lmstudio:  { type: 'object', properties: { ok: { type: 'boolean' }, models: { type: 'integer' } } },
                      openai:    { type: 'object', properties: { ok: { type: 'boolean' } } },
                      anthropic: { type: 'object', properties: { ok: { type: 'boolean' } } },
                      groq:      { type: 'object', properties: { ok: { type: 'boolean' } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/v1/models': {
        get: {
          tags: ['Models'],
          summary: 'List all available models',
          description: 'Returns a unified list of models from Ollama, LM Studio, and connected cloud providers in OpenAI format.',
          responses: {
            200: {
              description: 'Model list',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      object: { type: 'string', example: 'list' },
                      data:   { type: 'array', items: { $ref: '#/components/schemas/Model' } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/v1/models/running': {
        get: {
          tags: ['Models'],
          summary: 'List models currently loaded in RAM/VRAM',
          responses: {
            200: {
              description: 'Running models',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      models: { type: 'array', items: { $ref: '#/components/schemas/Model' } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/v1/models/updates': {
        get: {
          tags: ['Models'],
          summary: 'Check installed Ollama models against the official registry for newer versions',
          description: 'Compares each installed model\'s local manifest digest against the digest currently published on the Ollama registry (the same anonymous-pull token flow `ollama pull` uses). Models with an unofficial ref shape or a failed lookup are omitted, never reported as up to date. Requires outbound HTTPS to registry.ollama.ai.',
          responses: {
            200: {
              description: 'Update report for installed models with a resolvable registry ref',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      updates: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            name: { type: 'string', example: 'llama3.2:3b' },
                            digest: { type: 'string', example: 'sha256:abc123...' },
                            latest_digest: { type: 'string', example: 'sha256:def456...' },
                            update_available: { type: 'boolean' },
                          },
                        },
                      },
                      checked: {
                        type: 'integer',
                        description: 'Number of locally installed models with a digest that were candidates for a registry lookup — 0 means nothing was actually checked (distinct from "checked, none need an update").',
                        example: 3,
                      },
                      lookup_failures: {
                        type: 'integer',
                        description: 'Of the `checked` candidates with a resolvable registry ref, how many had their token/manifest request fail (network issue, registry unavailable). A ref that doesn\'t parse (unofficial/third-party namespace) is not counted here — it\'s an expected, permanent skip, not a failure. A nonzero count here means `updates` under-reports what actually needs attention: some models simply weren\'t compared.',
                        example: 0,
                      },
                      ollama_reachable: {
                        type: 'boolean',
                        description: 'Whether the local Ollama backend responded to /api/tags. False means `updates` is empty because the check didn\'t run, not because everything is up to date.',
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/v1/models/pull': {
        post: {
          tags: ['Models'],
          summary: 'Pull / download an Ollama model',
          description: 'Streams pull progress as Server-Sent Events (`text/event-stream`).',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['name'],
                  properties: {
                    name: { type: 'string', example: 'llama3.2:3b' },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'SSE stream of pull progress events',
              content: { 'text/event-stream': { schema: { type: 'string' } } },
            },
            400: { description: 'Invalid model name', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/v1/models/import-gguf': {
        post: {
          tags: ['Models'],
          summary: 'Import a local GGUF file into Ollama',
          description: 'Uploads a raw `.gguf` file as the request body and registers it as an Ollama model (via `POST /api/blobs` + `POST /api/create`), with no `ollama create` CLI step required. The model name and original filename are passed as query parameters.',
          parameters: [
            { name: 'name', in: 'query', required: true, schema: { type: 'string' }, example: 'my-model' },
            { name: 'filename', in: 'query', required: true, schema: { type: 'string' }, example: 'my-model.Q4_K_M.gguf' },
          ],
          requestBody: {
            required: true,
            content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } },
          },
          responses: {
            200: { description: 'Model imported', content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' }, model: { type: 'string' }, bytes: { type: 'integer' } } } } } },
            400: { description: 'Invalid name/filename, empty file, or file over the size cap', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            502: { description: 'Ollama unreachable or rejected the import', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/v1/models/{name}': {
        delete: {
          tags: ['Models'],
          summary: 'Delete an Ollama model from disk',
          parameters: [
            { name: 'name', in: 'path', required: true, schema: { type: 'string' }, example: 'llama3.2:3b' },
          ],
          responses: {
            200: { description: 'Model deleted' },
            500: { description: 'Delete failed', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/v1/chat': {
        post: {
          tags: ['Chat'],
          summary: 'Streaming chat (SSE)',
          description:
            'Send a chat request and receive token-by-token streaming via `text/event-stream`. ' +
            'Supports autonomous tool-use loops (up to 8 rounds). ' +
            'Pass `tools` array to enable built-in or MCP tools.',
          security: [{ ApiKeys: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ChatRequest' } } },
          },
          responses: {
            200: {
              description: 'SSE stream. Each event is a JSON token delta or a `[DONE]` sentinel.',
              content: { 'text/event-stream': { schema: { type: 'string' } } },
            },
            400: { description: 'Bad request', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/v1/chat/completions': {
        post: {
          tags: ['Chat'],
          summary: 'OpenAI-compatible chat completions passthrough',
          description: 'Forwards the request directly to the upstream provider. Non-streaming response.',
          security: [{ ApiKeys: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/ChatRequest' } } },
          },
          responses: {
            200: {
              description: 'OpenAI-format completion response',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      id:      { type: 'string' },
                      object:  { type: 'string', example: 'chat.completion' },
                      choices: { type: 'array', items: { type: 'object' } },
                      usage:   { type: 'object' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/v1/rag/collections': {
        get: {
          tags: ['RAG'],
          summary: 'List RAG collections',
          responses: {
            200: {
              description: 'All collections',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      collections: { type: 'array', items: { $ref: '#/components/schemas/RagCollection' } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/v1/rag/stats': {
        get: {
          tags: ['RAG'],
          summary: 'Knowledge-base stats across all RAG collections',
          responses: {
            200: {
              description: 'Aggregate stats',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      totalCollections: { type: 'integer', example: 3 },
                      totalChunks:      { type: 'integer', example: 128 },
                      totalSources:     { type: 'integer', example: 5 },
                      lastUpdated:      { type: 'integer', format: 'int64', nullable: true, description: 'Unix ms timestamp of the most recently updated collection, or null if empty' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/v1/rag/upload': {
        post: {
          tags: ['RAG'],
          summary: 'Upload and embed a document',
          description: 'Streams chunking + embedding progress as SSE. Supports `.txt`, `.md`, `.json`, and code files.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['collectionName', 'text'],
                  properties: {
                    collectionId:   { type: 'string', format: 'uuid', description: 'Existing collection ID to append to' },
                    collectionName: { type: 'string', example: 'my-docs' },
                    source:         { type: 'string', example: 'README.md' },
                    text:           { type: 'string', description: 'Plain-text content to embed' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'SSE stream of upload/embedding progress', content: { 'text/event-stream': { schema: { type: 'string' } } } },
          },
        },
      },
      '/v1/rag/crawl': {
        post: {
          tags: ['RAG'],
          summary: 'Crawl a URL and embed its content',
          description: 'Server-side HTTP fetch (SSRF-protected), extracts text, then embeds into a RAG collection.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['url', 'collectionName'],
                  properties: {
                    url:            { type: 'string', format: 'uri', example: 'https://example.com/docs' },
                    collectionId:   { type: 'string', format: 'uuid' },
                    collectionName: { type: 'string', example: 'web-docs' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Crawl result', content: { 'application/json': { schema: { type: 'object' } } } },
            400: { description: 'Invalid or blocked URL', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/v1/rag/github': {
        post: {
          tags: ['RAG'],
          summary: 'Index a GitHub repo and embed its text/code files',
          description: 'Server-side shallow `git clone` (SSRF-protected, http/https only), walks the tree skipping build/vendor directories, then embeds every text/code file into a RAG collection.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['repo_url'],
                  properties: {
                    repo_url:        { type: 'string', format: 'uri', example: 'https://github.com/owner/repo' },
                    branch:          { type: 'string', example: 'main' },
                    collection_id:   { type: 'string', format: 'uuid' },
                    collection_name: { type: 'string', example: 'owner/repo' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'SSE stream of clone/index progress, ending in a `done` or `error` event', content: { 'text/event-stream': { schema: { type: 'string' } } } },
            400: { description: 'Invalid or blocked repo URL', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/v1/rag/collections/{id}': {
        get: {
          tags: ['RAG'],
          summary: 'Get a single RAG collection',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: {
            200: { description: 'Collection metadata and chunk previews', content: { 'application/json': { schema: { $ref: '#/components/schemas/RagCollection' } } } },
            404: { description: 'Collection not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
        delete: {
          tags: ['RAG'],
          summary: 'Delete a RAG collection',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
          responses: {
            200: { description: 'Collection deleted' },
            404: { description: 'Collection not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/v1/rag/query': {
        post: {
          tags: ['RAG'],
          summary: 'Semantic search one, several, or all RAG collections',
          description: 'Provide `collection_id` to search a single collection, or `collection_ids` to search several together — not both. Omit both to search across every collection at once, with results merged and re-ranked by score.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['query'],
                  properties: {
                    collection_id:  { type: 'string', description: 'Search only this collection.' },
                    collection_ids: { type: 'array', items: { type: 'string' }, description: 'Search only these collections, merged and re-ranked together.' },
                    query:          { type: 'string', example: 'How does chunking work?' },
                    top_k:          { type: 'integer', default: 5, example: 5 },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: 'Top-k matching chunks, merged and sorted by score across all searched collections',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      results: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            text:           { type: 'string' },
                            score:          { type: 'number' },
                            source:         { type: 'string' },
                            collectionId:   { type: 'string', description: 'ID of the collection this chunk came from.' },
                            collectionName: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/v1/audio/transcribe': {
        post: {
          tags: ['Audio'],
          summary: 'Transcribe audio via Whisper',
          description: 'Forwards audio to the configured local Whisper server. Max 25 MB.',
          requestBody: {
            required: true,
            content: { 'application/octet-stream': { schema: { type: 'string', format: 'binary' } } },
          },
          responses: {
            200: {
              description: 'Transcription result',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { text: { type: 'string' } },
                  },
                },
              },
            },
            503: { description: 'Whisper not configured or unreachable', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/v1/audio/status': {
        get: {
          tags: ['Audio'],
          summary: 'Whisper server status',
          responses: {
            200: {
              description: 'Whisper liveness',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      enabled: { type: 'boolean' },
                      ok:      { type: 'boolean' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/v1/config': {
        get: {
          tags: ['Config'],
          summary: 'Get current runtime config',
          responses: {
            200: { description: 'config.json contents', content: { 'application/json': { schema: { type: 'object' } } } },
          },
        },
        post: {
          tags: ['Config'],
          summary: 'Update runtime config',
          description: 'Writes the new config to disk and hot-reloads MCP servers.',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', description: 'Full config.json replacement' } } },
          },
          responses: {
            200: { description: 'Updated config and new tool status', content: { 'application/json': { schema: { type: 'object' } } } },
            400: { description: 'Invalid config JSON', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/v1/logs': {
        get: {
          tags: ['Logs'],
          summary: 'Recent request log entries',
          description: 'Metadata-only log (method, path, status, duration) of requests handled by the proxy. Enable with `logging.enabled` in config; empty when disabled. Bodies, headers, and API keys are never logged.',
          parameters: [
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 200, maximum: 1000 }, description: 'Max entries to return, most recent first' },
          ],
          responses: {
            200: {
              description: 'Logging status and recent entries',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      enabled: { type: 'boolean' },
                      entries: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            ts:     { type: 'string', format: 'date-time' },
                            method: { type: 'string', example: 'GET' },
                            path:   { type: 'string', example: '/v1/models' },
                            status: { type: 'integer', example: 200 },
                            ms:     { type: 'integer', example: 12 },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        delete: {
          tags: ['Logs'],
          summary: 'Clear the local request log',
          responses: {
            200: { description: 'Cleared', content: { 'application/json': { schema: { type: 'object', properties: { cleared: { type: 'boolean' } } } } } },
          },
        },
      },
      '/v1/agent-runs': {
        get: {
          tags: ['AgentRuns'],
          summary: 'Recent agent-loop run history',
          description: 'Step-by-step record of past agent-loop sessions (tool calls, results, timing) for replay. Enable with `agentHistory.enabled` in config; empty when disabled. Only sessions that made at least one tool call are recorded.',
          parameters: [
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 100, maximum: 500 }, description: 'Max runs to return, most recent first' },
          ],
          responses: {
            200: {
              description: 'Agent history status and recent runs',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      enabled: { type: 'boolean' },
                      entries: {
                        type: 'array',
                        items: {
                          type: 'object',
                          properties: {
                            id:       { type: 'string' },
                            ts:       { type: 'string', format: 'date-time' },
                            provider: { type: 'string', example: 'ollama' },
                            model:    { type: 'string', example: 'llama3.2:3b' },
                            status:   { type: 'string', enum: ['done', 'error', 'stopped'] },
                            error:    { type: 'string', nullable: true },
                            ms:       { type: 'integer', example: 1420 },
                            steps: {
                              type: 'array',
                              items: {
                                type: 'object',
                                properties: {
                                  id:     { type: 'string' },
                                  name:   { type: 'string', example: 'web_search' },
                                  args:   { type: 'string' },
                                  result: { type: 'string' },
                                  cached: { type: 'boolean' },
                                  ms:     { type: 'integer', example: 340 },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        delete: {
          tags: ['AgentRuns'],
          summary: 'Clear the local agent run history',
          responses: {
            200: { description: 'Cleared', content: { 'application/json': { schema: { type: 'object', properties: { cleared: { type: 'boolean' } } } } } },
          },
        },
      },
      '/v1/tools': {
        get: {
          tags: ['Tools'],
          summary: 'List all tools and their enabled status',
          responses: {
            200: {
              description: 'Tool registry status',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      tools: { type: 'array', items: { $ref: '#/components/schemas/ToolStatus' } },
                      total: { type: 'integer' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/v1/system': {
        get: {
          tags: ['Health'],
          summary: 'System resource usage',
          description: 'Returns memory and CPU info, plus which models are currently loaded.',
          responses: {
            200: {
              description: 'System stats',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      memory:  { type: 'object', properties: { total: { type: 'integer' }, free: { type: 'integer' }, used: { type: 'integer' } } },
                      models:  { type: 'array', items: { $ref: '#/components/schemas/Model' } },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/v1/openapi.json': {
        get: {
          tags: ['Docs'],
          summary: 'OpenAPI 3.0 spec (this document)',
          responses: {
            200: { description: 'OpenAPI spec', content: { 'application/json': { schema: { type: 'object' } } } },
          },
        },
      },
      '/v1/docs': {
        get: {
          tags: ['Docs'],
          summary: 'Swagger UI — interactive API explorer',
          responses: {
            200: { description: 'HTML page', content: { 'text/html': { schema: { type: 'string' } } } },
          },
        },
      },
    },
  };
}

module.exports = { buildSpec };
