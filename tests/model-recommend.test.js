'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { recommendModels } = require('../lib/model-recommend');

const CATALOG = [
  { name: 'llama3.1:70b', org: 'Meta',    size: '40 GB',  tags: ['large'] },
  { name: 'mixtral-8x7b', org: 'Mistral AI', size: '9.5 GB', tags: [] },
  { name: 'llama3.2',     org: 'Meta',    size: '2 GB',   tags: ['fast'] },
  { name: 'qwen2.5-coder',org: 'Alibaba', size: '5 GB',   tags: ['code'] },
  { name: 'qwen2.5-coder:14b', org: 'Alibaba', size: '9 GB', tags: ['code'] },
  { name: 'llama3.2-vision', org: 'Meta', size: '8 GB',   tags: ['vision'] },
];

test('returns nothing when hardware info is missing', () => {
  assert.deepEqual(recommendModels(CATALOG, null), []);
});

test('returns nothing when no catalog entry fits', () => {
  const hardware = { gpus: [], freeRamBytes: 1e9 }; // 1GB, nothing fits
  assert.deepEqual(recommendModels(CATALOG, hardware), []);
});

test('picks the largest fitting non-vision model as "general"', () => {
  // 12GB free RAM -> ~10.2GB fit cap: 70b (40GB) doesn't fit, mixtral (9.5GB) does
  // and is the largest fitting entry overall.
  const hardware = { gpus: [], freeRamBytes: 12e9 };
  const picks = recommendModels(CATALOG, hardware);
  const general = picks.find(p => p.category === 'general');
  assert.equal(general.model.name, 'mixtral-8x7b');
});

test('adds a distinct "code" pick when a code model fits and differs from general', () => {
  const hardware = { gpus: [], freeRamBytes: 12e9 };
  const picks = recommendModels(CATALOG, hardware);
  const code = picks.find(p => p.category === 'code');
  assert.ok(code);
  assert.equal(code.model.tags.includes('code'), true);
});

test('adds a "vision" pick when a vision model fits', () => {
  const hardware = { gpus: [], freeRamBytes: 12e9 };
  const picks = recommendModels(CATALOG, hardware);
  const vision = picks.find(p => p.category === 'vision');
  assert.equal(vision.model.name, 'llama3.2-vision');
});

test('omits the vision pick entirely when no vision model fits', () => {
  const hardware = { gpus: [], freeRamBytes: 3e9 }; // only llama3.2 (2GB) fits
  const picks = recommendModels(CATALOG, hardware);
  assert.equal(picks.some(p => p.category === 'vision'), false);
  assert.equal(picks[0].model.name, 'llama3.2');
});

test('excludes already-installed models', () => {
  const hardware = { gpus: [], freeRamBytes: 12e9 };
  const picks = recommendModels(CATALOG, hardware, ['qwen2.5-coder:14b', 'qwen2.5-coder']);
  const general = picks.find(p => p.category === 'general');
  assert.equal(general.model.name, 'mixtral-8x7b'); // unaffected, wasn't installed
  assert.equal(picks.some(p => p.category === 'code'), false); // both code entries excluded
});

test('prefers GPU VRAM over free RAM, matching estimateLoadFit', () => {
  const hardware = { gpus: [{ vram_total_mb: 20000, vram_used_mb: 0 }], freeRamBytes: 1e9 };
  const picks = recommendModels(CATALOG, hardware);
  assert.ok(picks.length > 0);
  assert.equal(picks[0].fit.source, 'vram');
});

test('respects the limit parameter', () => {
  const hardware = { gpus: [], freeRamBytes: 12e9 };
  const picks = recommendModels(CATALOG, hardware, [], 1);
  assert.equal(picks.length, 1);
});

test('returns an empty array for a non-array catalog', () => {
  assert.deepEqual(recommendModels(null, { gpus: [], freeRamBytes: 1e9 }), []);
  assert.deepEqual(recommendModels(undefined, { gpus: [], freeRamBytes: 1e9 }), []);
});
