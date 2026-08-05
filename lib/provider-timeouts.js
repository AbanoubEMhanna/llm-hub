'use strict';

/**
 * Per-provider request timeout / retry resolution for LLM provider calls
 * (local — Ollama, LM Studio — and cloud/custom alike).
 * Config shape (config.json):
 *   "providerTimeouts": {
 *     "default":   { "timeoutMs": 120000, "retries": 1, "retryDelayMs": 500 },
 *     "overrides": { "openai": { "timeoutMs": 30000, "retries": 2 } }
 *   }
 * Any field left out falls back to the built-in default below.
 */

const DEFAULT_TIMEOUT_MS     = 120000;
const DEFAULT_RETRIES        = 1;
const DEFAULT_RETRY_DELAY_MS = 500;

const MIN_TIMEOUT_MS      = 1000;
const MAX_RETRIES         = 5;
const MIN_RETRY_DELAY_MS  = 100;
const MAX_RETRY_DELAY_MS  = 8000;

function resolveTimeoutConfig(provider, providerTimeoutsConfig) {
  const cfg      = providerTimeoutsConfig || {};
  const defaults = cfg.default || {};
  const override = (cfg.overrides && cfg.overrides[provider]) || {};

  const timeoutMs     = numberOr(override.timeoutMs,     numberOr(defaults.timeoutMs,     DEFAULT_TIMEOUT_MS));
  const retries        = numberOr(override.retries,       numberOr(defaults.retries,        DEFAULT_RETRIES));
  const retryDelayMs  = numberOr(override.retryDelayMs,  numberOr(defaults.retryDelayMs,  DEFAULT_RETRY_DELAY_MS));

  return {
    timeoutMs:    Math.max(MIN_TIMEOUT_MS, timeoutMs),
    retries:       Math.min(MAX_RETRIES, Math.max(0, Math.trunc(retries))),
    retryDelayMs: Math.min(MAX_RETRY_DELAY_MS, Math.max(MIN_RETRY_DELAY_MS, retryDelayMs)),
  };
}

/** Exponential backoff, capped, for the Nth retry attempt (0-indexed). */
function backoffDelay(attempt, baseDelayMs) {
  const base = Number.isFinite(baseDelayMs) && baseDelayMs > 0 ? baseDelayMs : DEFAULT_RETRY_DELAY_MS;
  return Math.min(MAX_RETRY_DELAY_MS, base * Math.pow(2, attempt));
}

function numberOr(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

module.exports = {
  resolveTimeoutConfig,
  backoffDelay,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_RETRIES,
  DEFAULT_RETRY_DELAY_MS,
};
