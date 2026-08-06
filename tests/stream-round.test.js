'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { runStreamRound } = require('../lib/stream-round');

const NO_RETRY = { retries: 0, retryDelayMs: 10 };

test('resolves with aggregated text on a clean single-attempt stream', async () => {
  const startStream = ({ onChunk, onDone }) => {
    onChunk({ choices: [{ delta: { content: 'hello ' } }] });
    onChunk({ choices: [{ delta: { content: 'world' } }] });
    onDone();
  };
  const deltas = [];
  const result = await runStreamRound(startStream, NO_RETRY, null, {
    onTextDelta: (d) => deltas.push(d),
    onUsage: () => {},
  });
  assert.equal(result.ok, true);
  assert.equal(result.content, 'hello world');
  assert.deepEqual(deltas, ['hello ', 'world']);
});

test('retries once after a failure with zero output, then succeeds', async () => {
  let attempts = 0;
  const startStream = ({ onChunk, onDone, onError }) => {
    attempts++;
    if (attempts === 1) { onError('connection reset'); return; }
    onChunk({ choices: [{ delta: { content: 'recovered' } }] });
    onDone();
  };
  const result = await runStreamRound(startStream, { retries: 1, retryDelayMs: 10 }, null, {
    onTextDelta: () => {},
    onUsage: () => {},
  });
  assert.equal(attempts, 2);
  assert.equal(result.ok, true);
  assert.equal(result.content, 'recovered');
});

test('does not retry once text has already streamed to the client', async () => {
  let attempts = 0;
  const startStream = ({ onChunk, onError }) => {
    attempts++;
    onChunk({ choices: [{ delta: { content: 'partial' } }] });
    onError('stream dropped');
  };
  const result = await runStreamRound(startStream, { retries: 3, retryDelayMs: 10 }, null, {
    onTextDelta: () => {},
    onUsage: () => {},
  });
  assert.equal(attempts, 1); // never retried — some content already reached the client
  assert.equal(result.ok, false);
});

test('a usage-only chunk (e.g. Anthropic message_start) does not block a retry', () => {
  // Regression: Anthropic emits a chunk shaped { usage: {...} } with no
  // `choices` before any text arrives. If the provider then goes idle and
  // times out, that usage chunk must not be mistaken for streamed output.
  let attempts = 0;
  const startStream = ({ onChunk, onDone, onError }) => {
    attempts++;
    onChunk({ usage: { prompt_tokens: 12, completion_tokens: 0 } });
    if (attempts === 1) { onError('idle timeout'); return; }
    onChunk({ choices: [{ delta: { content: 'answer' } }] });
    onDone();
  };
  return runStreamRound(startStream, { retries: 1, retryDelayMs: 10 }, null, {
    onTextDelta: () => {},
    onUsage: () => {},
  }).then((result) => {
    assert.equal(attempts, 2, 'usage-only chunk must not suppress the retry');
    assert.equal(result.ok, true);
    assert.equal(result.content, 'answer');
  });
});

test('does not retry once a tool-call fragment has streamed', async () => {
  let attempts = 0;
  const startStream = ({ onChunk, onError }) => {
    attempts++;
    onChunk({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_1', function: { name: 'search', arguments: '' } }] } }] });
    onError('dropped mid tool-call');
  };
  const result = await runStreamRound(startStream, { retries: 3, retryDelayMs: 10 }, null, {
    onTextDelta: () => {},
    onUsage: () => {},
  });
  assert.equal(attempts, 1);
  assert.equal(result.ok, false);
});

test('stops retrying once the configured retry budget is exhausted', async () => {
  let attempts = 0;
  const startStream = ({ onError }) => { attempts++; onError('always fails'); };
  const result = await runStreamRound(startStream, { retries: 2, retryDelayMs: 5 }, null, {
    onTextDelta: () => {},
    onUsage: () => {},
  });
  assert.equal(attempts, 3); // initial attempt + 2 retries
  assert.equal(result.ok, false);
});

test('aggregates tool-call argument fragments across chunks', async () => {
  const startStream = ({ onChunk, onDone }) => {
    onChunk({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_1', function: { name: 'search', arguments: '' } }] } }] });
    onChunk({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"q":' } }] } }] });
    onChunk({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"cats"}' } }] } }] });
    onDone();
  };
  const result = await runStreamRound(startStream, NO_RETRY, null, { onTextDelta: () => {}, onUsage: () => {} });
  assert.equal(result.ok, true);
  assert.equal(result.toolCalls.length, 1);
  assert.equal(result.toolCalls[0].id, 'call_1');
  assert.equal(result.toolCalls[0].function.name, 'search');
  assert.equal(result.toolCalls[0].function.arguments, '{"q":"cats"}');
});

test('returns immediately without starting a stream when already aborted', async () => {
  let started = false;
  const startStream = () => { started = true; };
  const result = await runStreamRound(startStream, { retries: 2, retryDelayMs: 10 }, { aborted: true }, {
    onTextDelta: () => {},
    onUsage: () => {},
  });
  assert.equal(started, false);
  assert.equal(result.ok, false);
});

test('forwards usage deltas via onUsage', async () => {
  const usages = [];
  const startStream = ({ onChunk, onDone }) => {
    onChunk({ usage: { prompt_tokens: 5, completion_tokens: 0 } });
    onChunk({ choices: [{ delta: { content: 'hi' } }], usage: { prompt_tokens: 0, completion_tokens: 3 } });
    onDone();
  };
  await runStreamRound(startStream, NO_RETRY, null, {
    onTextDelta: () => {},
    onUsage: (u) => usages.push(u),
  });
  assert.deepEqual(usages, [
    { prompt_tokens: 5, completion_tokens: 0 },
    { prompt_tokens: 0, completion_tokens: 3 },
  ]);
});
