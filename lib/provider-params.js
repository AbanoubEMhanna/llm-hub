'use strict';

/**
 * Cerebras renamed `max_tokens` to `max_completion_tokens` (fully enforced
 * 2026-08-17). Remaps an OpenAI-shaped request body in place so every cloud
 * provider can be built through the same code path.
 *
 * @param {string} provider - resolved provider key (e.g. 'cerebras', 'openai')
 * @param {object} body - OpenAI-shaped chat completion request body
 * @returns {object} the same body object, mutated if needed
 */
function applyProviderTokenParam(provider, body) {
  if (provider === 'cerebras' && body.max_tokens !== undefined && body.max_completion_tokens === undefined) {
    body.max_completion_tokens = body.max_tokens;
    delete body.max_tokens;
  }
  return body;
}

module.exports = { applyProviderTokenParam };
