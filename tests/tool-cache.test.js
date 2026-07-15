'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ToolCallCache } = require('../lib/tool-cache.js');

test('miss then hit for the same name + args', () => {
  const cache = new ToolCallCache();
  assert.equal(cache.has('read_file', { path: 'a.txt' }), false);
  cache.set('read_file', { path: 'a.txt' }, 'contents');
  assert.equal(cache.has('read_file', { path: 'a.txt' }), true);
  assert.equal(cache.get('read_file', { path: 'a.txt' }), 'contents');
});

test('different args for the same tool are cached separately', () => {
  const cache = new ToolCallCache();
  cache.set('read_file', { path: 'a.txt' }, 'A');
  assert.equal(cache.has('read_file', { path: 'b.txt' }), false);
  cache.set('read_file', { path: 'b.txt' }, 'B');
  assert.equal(cache.get('read_file', { path: 'a.txt' }), 'A');
  assert.equal(cache.get('read_file', { path: 'b.txt' }), 'B');
});

test('same args for different tools are cached separately', () => {
  const cache = new ToolCallCache();
  cache.set('tool_a', { x: 1 }, 'from A');
  cache.set('tool_b', { x: 1 }, 'from B');
  assert.equal(cache.get('tool_a', { x: 1 }), 'from A');
  assert.equal(cache.get('tool_b', { x: 1 }), 'from B');
});

test('key order in args does not matter is NOT guaranteed (documents current behavior)', () => {
  // JSON.stringify key order depends on insertion order, so {a:1,b:2} and
  // {b:2,a:1} are treated as distinct cache entries. This is an accepted
  // limitation for this MVP-level cache.
  const cache = new ToolCallCache();
  cache.set('tool', { a: 1, b: 2 }, 'first');
  assert.equal(cache.has('tool', { b: 2, a: 1 }), false);
});

test('missing/undefined args normalize to the same key as {}', () => {
  const cache = new ToolCallCache();
  cache.set('ping', undefined, 'pong');
  assert.equal(cache.get('ping', {}), 'pong');
});
