'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { applyProviderTokenParam } = require('../lib/provider-params');

test('renames max_tokens to max_completion_tokens for cerebras', () => {
  const body = { model: 'llama-3.3-70b', max_tokens: 2048 };
  const result = applyProviderTokenParam('cerebras', body);
  assert.equal(result.max_completion_tokens, 2048);
  assert.equal('max_tokens' in result, false);
  assert.equal(result, body);
});

test('leaves max_tokens untouched for other providers', () => {
  const body = { model: 'gpt-4o', max_tokens: 2048 };
  applyProviderTokenParam('openai', body);
  assert.equal(body.max_tokens, 2048);
  assert.equal('max_completion_tokens' in body, false);
});

test('does not overwrite an explicit max_completion_tokens', () => {
  const body = { model: 'llama-3.3-70b', max_tokens: 2048, max_completion_tokens: 4096 };
  applyProviderTokenParam('cerebras', body);
  assert.equal(body.max_completion_tokens, 4096);
  assert.equal(body.max_tokens, 2048);
});

test('no-op when max_tokens is absent', () => {
  const body = { model: 'llama-3.3-70b' };
  applyProviderTokenParam('cerebras', body);
  assert.equal('max_tokens' in body, false);
  assert.equal('max_completion_tokens' in body, false);
});
