'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { computeContextTimeline } = require('../lib/context-timeline.js');

test('includes every message when everything fits under the budget', () => {
  const r = computeContextTimeline([100, 200, 300], 1000);
  assert.deepEqual(r.included, [true, true, true]);
  assert.equal(r.droppedCount, 0);
  assert.equal(r.usedTokens, 600);
  assert.equal(r.totalTokens, 600);
});

test('drops the oldest messages first, keeping a contiguous recent run', () => {
  const r = computeContextTimeline([500, 300, 100], 500);
  // Walking newest → oldest: 100 fits (100), 300 fits (400), 500 does not (900 > 500) → stop.
  assert.deepEqual(r.included, [false, true, true]);
  assert.equal(r.droppedCount, 1);
  assert.equal(r.usedTokens, 400);
  assert.equal(r.totalTokens, 900);
});

test('subtracts reservedTokens (system prompt / RAG context) from the budget', () => {
  const r = computeContextTimeline([100, 100], 250, 200);
  // budget = 250 - 200 = 50, so neither message fits.
  assert.deepEqual(r.included, [false, false]);
  assert.equal(r.usedTokens, 200);
  assert.equal(r.totalTokens, 400);
});

test('handles an empty message list', () => {
  const r = computeContextTimeline([], 4096);
  assert.deepEqual(r.included, []);
  assert.equal(r.droppedCount, 0);
  assert.equal(r.usedTokens, 0);
  assert.equal(r.totalTokens, 0);
});

test('treats a zero or negative ctxLimit as no budget at all', () => {
  const r = computeContextTimeline([10, 20], 0);
  assert.deepEqual(r.included, [false, false]);
  assert.equal(r.usedTokens, 0);
});

test('a single message larger than the whole budget is dropped, not partially counted', () => {
  const r = computeContextTimeline([50, 5000], 1000);
  assert.deepEqual(r.included, [false, false]);
  assert.equal(r.droppedCount, 2);
});

test('reservedTokens that already exceeds ctxLimit leaves a zero budget, not negative', () => {
  const r = computeContextTimeline([10], 100, 500);
  assert.deepEqual(r.included, [false]);
  assert.equal(r.usedTokens, 500);
});
