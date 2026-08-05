'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveTimeoutConfig, backoffDelay } = require('../lib/provider-timeouts');

test('falls back to built-in defaults when config is empty', () => {
  const result = resolveTimeoutConfig('openai', undefined);
  assert.equal(result.timeoutMs, 120000);
  assert.equal(result.retries, 1);
  assert.equal(result.retryDelayMs, 500);
});

test('applies the "default" section to every provider', () => {
  const cfg = { default: { timeoutMs: 20000, retries: 3, retryDelayMs: 250 } };
  const result = resolveTimeoutConfig('cerebras', cfg);
  assert.equal(result.timeoutMs, 20000);
  assert.equal(result.retries, 3);
  assert.equal(result.retryDelayMs, 250);
});

test('a per-provider override wins over the default section', () => {
  const cfg = {
    default: { timeoutMs: 20000, retries: 3, retryDelayMs: 250 },
    overrides: { openai: { timeoutMs: 45000 } },
  };
  const result = resolveTimeoutConfig('openai', cfg);
  assert.equal(result.timeoutMs, 45000);
  assert.equal(result.retries, 3); // not overridden, falls back to default section
  assert.equal(result.retryDelayMs, 250);
});

test('overrides are scoped to their own provider only', () => {
  const cfg = { overrides: { openai: { timeoutMs: 45000 } } };
  const result = resolveTimeoutConfig('anthropic', cfg);
  assert.equal(result.timeoutMs, 120000);
});

test('clamps retries to the [0, 5] range', () => {
  assert.equal(resolveTimeoutConfig('x', { default: { retries: -5 } }).retries, 0);
  assert.equal(resolveTimeoutConfig('x', { default: { retries: 99 } }).retries, 5);
});

test('enforces a minimum timeout floor', () => {
  const result = resolveTimeoutConfig('x', { default: { timeoutMs: 10 } });
  assert.equal(result.timeoutMs, 1000);
});

test('enforces a maximum timeout ceiling', () => {
  const result = resolveTimeoutConfig('x', { default: { timeoutMs: 900000 } });
  assert.equal(result.timeoutMs, 600000);
});

test('clamps values above the 32-bit timer limit instead of letting Node normalize them to 1ms', () => {
  // Node silently turns any setTimeout/socket timeout above 2^31-1 into 1ms —
  // resolveTimeoutConfig must never pass a value that large through.
  const result = resolveTimeoutConfig('x', { default: { timeoutMs: 2147483648 } });
  assert.equal(result.timeoutMs, 600000);
});

test('ignores non-numeric config values', () => {
  const cfg = { default: { timeoutMs: 'fast', retries: null, retryDelayMs: NaN } };
  const result = resolveTimeoutConfig('x', cfg);
  assert.equal(result.timeoutMs, 120000);
  assert.equal(result.retries, 1);
  assert.equal(result.retryDelayMs, 500);
});

test('backoffDelay doubles per attempt and is capped', () => {
  assert.equal(backoffDelay(0, 500), 500);
  assert.equal(backoffDelay(1, 500), 1000);
  assert.equal(backoffDelay(2, 500), 2000);
  assert.equal(backoffDelay(10, 500), 8000); // capped at MAX_RETRY_DELAY_MS
});

test('backoffDelay falls back to a default base when given an invalid one', () => {
  assert.equal(backoffDelay(0, 0), 500);
  assert.equal(backoffDelay(0, -1), 500);
});
