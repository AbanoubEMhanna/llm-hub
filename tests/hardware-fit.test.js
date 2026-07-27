'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseSizeLabelToBytes, estimateLoadFit } = require('../lib/hardware-fit');

test('parseSizeLabelToBytes parses common units', () => {
  assert.equal(parseSizeLabelToBytes('43 GB'), 43e9);
  assert.equal(parseSizeLabelToBytes('1.3 GB'), 1.3e9);
  assert.equal(parseSizeLabelToBytes('512MB'), 512e6);
  assert.equal(parseSizeLabelToBytes('2TB'), 2e12);
});

test('parseSizeLabelToBytes returns null for missing/unrecognized input', () => {
  assert.equal(parseSizeLabelToBytes(''), null);
  assert.equal(parseSizeLabelToBytes(null), null);
  assert.equal(parseSizeLabelToBytes(undefined), null);
  assert.equal(parseSizeLabelToBytes('unknown'), null);
});

test('estimateLoadFit returns null for an unparsable size label', () => {
  assert.equal(estimateLoadFit('', { gpus: [], freeRamBytes: 1e9 }), null);
});

test('estimateLoadFit returns null when neither GPU nor RAM capacity is known', () => {
  assert.equal(estimateLoadFit('4 GB', { gpus: [] }), null);
});

test('estimateLoadFit prefers GPU VRAM over RAM when a GPU is detected', () => {
  const gpus = [{ vram_total_mb: 24000, vram_used_mb: 0 }];
  const fit = estimateLoadFit('4 GB', { gpus, freeRamBytes: 1e6 });
  assert.equal(fit.source, 'vram');
  assert.equal(fit.level, 'fit');
});

test('estimateLoadFit falls back to free RAM when no GPU was detected', () => {
  const fit = estimateLoadFit('4 GB', { gpus: [], freeRamBytes: 8e9 });
  assert.equal(fit.source, 'ram');
  assert.equal(fit.level, 'fit');
});

test('estimateLoadFit accounts for VRAM already in use by loaded models', () => {
  const gpus = [{ vram_total_mb: 8000, vram_used_mb: 6000 }]; // ~2GB free of 8GB
  const fit = estimateLoadFit('4 GB', { gpus });
  assert.equal(fit.level, 'no');
});

test('estimateLoadFit sums capacity across multiple GPUs', () => {
  const gpus = [{ vram_total_mb: 12000, vram_used_mb: 0 }, { vram_total_mb: 12000, vram_used_mb: 0 }];
  const fit = estimateLoadFit('20 GB', { gpus });
  assert.equal(fit.level, 'fit');
});

test('estimateLoadFit flags a model that is close to the capacity limit as warn', () => {
  const gpus = [{ vram_total_mb: 10000, vram_used_mb: 0 }]; // ~10.49 GB
  const fit = estimateLoadFit('11 GB', { gpus }); // within 1.1x of capacity
  assert.equal(fit.level, 'warn');
});

test('estimateLoadFit flags an oversized model as no', () => {
  const gpus = [{ vram_total_mb: 8000, vram_used_mb: 0 }]; // ~8.39 GB
  const fit = estimateLoadFit('43 GB', { gpus });
  assert.equal(fit.level, 'no');
});

test('estimateLoadFit never returns a negative capacity when used exceeds total', () => {
  const gpus = [{ vram_total_mb: 8000, vram_used_mb: 9000 }];
  const fit = estimateLoadFit('1 GB', { gpus });
  assert.equal(fit.capacityBytes, 0);
  assert.equal(fit.level, 'no');
});
