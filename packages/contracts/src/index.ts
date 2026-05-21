/**
 * @llm-hub/contracts — shared TypeScript types used across apps and packages.
 *
 * Phase 0 scaffold. Types here mirror the runtime shapes used in the legacy
 * `app.js` and `proxy.js` so they can be ported incrementally without breaking
 * the wire format.
 */

export type ProviderKind =
  | 'ollama'
  | 'lmstudio'
  | 'openai'
  | 'anthropic'
  | 'groq'
  | 'openrouter'
  | 'claude-agent-sdk'
  | 'opencode-sdk';

export type ProviderTier = 'chat' | 'agent';

export interface ProviderInfo {
  id: string;
  kind: ProviderKind;
  tier: ProviderTier;
  label: string;
  baseUrl?: string;
}

export type Role = 'system' | 'user' | 'assistant' | 'tool';

export type Reaction = 'up' | 'down' | null;

export interface Attachment {
  id: string;
  kind: 'image' | 'audio' | 'file';
  mime: string;
  name: string;
  dataUrl?: string;
  url?: string;
  bytes?: number;
}

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  attachments?: Attachment[];
  reaction?: Reaction;
  toolCalls?: ToolCall[];
  meta?: {
    model?: string;
    providerId?: string;
    elapsedMs?: number;
    promptTokens?: number;
    completionTokens?: number;
    costUsd?: number;
  };
}

export interface Conversation {
  id: string;
  title: string;
  pinned: boolean;
  colorLabel?: string;
  sysPrompt?: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

export interface ToolCall {
  id: string;
  name: string;
  args: unknown;
  result?: unknown;
  error?: string;
  elapsedMs?: number;
}

export interface RagChunk {
  id: string;
  collectionId: string;
  source: string;
  text: string;
  embedding?: number[];
}

export interface RagCollection {
  id: string;
  name: string;
  embeddingModel: string;
  chunkCount: number;
  createdAt: number;
}

/** Wire format for streaming events over WebSocket (Phase 2+). */
export type StreamEvent =
  | { type: 'token'; text: string }
  | { type: 'tool_call'; call: ToolCall }
  | { type: 'tool_result'; callId: string; result: unknown; elapsedMs: number }
  | { type: 'error'; message: string }
  | { type: 'done'; usage?: ChatMessage['meta'] };
