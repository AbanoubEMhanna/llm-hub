'use strict';

const { backoffDelay } = require('./provider-timeouts');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs one streamed chat-completion round and retries it (with exponential
 * backoff) when the failure happens before any output reached the client —
 * safe to redo, since nothing has been emitted yet. A failure after partial
 * text or a partial tool call is never retried, to avoid duplicating
 * already-streamed content.
 *
 * Protocol chunks that carry no content — e.g. Anthropic's message_start
 * usage event, which arrives before any text — must NOT count as output,
 * or a provider that goes idle right after one would wrongly skip the retry.
 *
 * @param {(handlers: {signal, onChunk, onDone, onError}) => void} startStream
 * @param {{retries: number, retryDelayMs: number}} timeoutCfg
 * @param {{aborted: boolean}} [signal]
 * @param {{onTextDelta: (text: string) => void, onUsage: (usage: object) => void}} callbacks
 */
async function runStreamRound(startStream, { retries, retryDelayMs }, signal, { onTextDelta, onUsage }) {
  for (let attempt = 0; ; attempt++) {
    if (signal?.aborted) return { ok: false, error: 'aborted' };
    const result = await new Promise((resolve) => {
      let content = '';
      const toolCalls = [];
      let producedOutput = false;
      startStream({
        signal,
        onChunk(chunk) {
          const delta = chunk.choices?.[0]?.delta || {};
          if (typeof delta.content === 'string' && delta.content.length) {
            content += delta.content;
            producedOutput = true;
            onTextDelta(delta.content);
          }
          if (Array.isArray(delta.tool_calls)) {
            for (const tc of delta.tool_calls) {
              const i = tc.index ?? 0;
              if (!toolCalls[i]) toolCalls[i] = { id: '', type: 'function', function: { name: '', arguments: '' } };
              if (tc.id)                  toolCalls[i].id = tc.id;
              if (tc.function?.name)      { toolCalls[i].function.name      += tc.function.name;      producedOutput = true; }
              if (tc.function?.arguments) { toolCalls[i].function.arguments += tc.function.arguments; producedOutput = true; }
            }
          }
          // Usage/role-only chunks (no text, no tool-call fragment) intentionally
          // do not set producedOutput — nothing reached the client from them.
          if (chunk.usage) onUsage(chunk.usage);
        },
        onDone()  { resolve({ ok: true, content, toolCalls: toolCalls.filter(tc => tc?.function?.name) }); },
        onError(e){ resolve({ ok: false, error: e, producedOutput }); },
      });
    });
    if (result.ok || result.producedOutput || attempt >= retries) return result;
    await sleep(backoffDelay(attempt, retryDelayMs));
  }
}

module.exports = { runStreamRound };
