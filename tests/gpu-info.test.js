'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseNvidiaSmi, parseRocmSmi } = require('../lib/gpu-info');

test('parseNvidiaSmi parses a single-GPU CSV line', () => {
  const out = 'NVIDIA GeForce RTX 4090, 24564, 1187\n';
  const gpus = parseNvidiaSmi(out);
  assert.equal(gpus.length, 1);
  assert.deepEqual(gpus[0], { name: 'NVIDIA GeForce RTX 4090', vram_total_mb: 24564, vram_used_mb: 1187 });
});

test('parseNvidiaSmi parses multiple GPUs', () => {
  const out = 'NVIDIA A100, 81920, 2048\nNVIDIA A100, 81920, 4096\n';
  const gpus = parseNvidiaSmi(out);
  assert.equal(gpus.length, 2);
  assert.equal(gpus[1].vram_used_mb, 4096);
});

test('parseNvidiaSmi ignores blank lines', () => {
  const out = '\nNVIDIA GeForce RTX 4090, 24564, 1187\n\n';
  assert.equal(parseNvidiaSmi(out).length, 1);
});

test('parseNvidiaSmi returns [] for empty/missing output', () => {
  assert.deepEqual(parseNvidiaSmi(''), []);
  assert.deepEqual(parseNvidiaSmi(null), []);
  assert.deepEqual(parseNvidiaSmi(undefined), []);
});

test('parseNvidiaSmi skips malformed lines', () => {
  const out = 'not enough fields\nNVIDIA GeForce RTX 4090, 24564, 1187\n';
  const gpus = parseNvidiaSmi(out);
  assert.equal(gpus.length, 1);
});

test('parseNvidiaSmi defaults used to 0 when unparsable', () => {
  const out = 'NVIDIA GeForce RTX 4090, 24564, N/A\n';
  const gpus = parseNvidiaSmi(out);
  assert.equal(gpus[0].vram_used_mb, 0);
});

test('parseNvidiaSmi skips a GPU with a blank total-VRAM field instead of treating it as 0', () => {
  const out = 'NVIDIA GeForce RTX 4090, , 1187\n';
  assert.deepEqual(parseNvidiaSmi(out), []);
});

test('parseRocmSmi parses a single card', () => {
  const json = JSON.stringify({
    card0: { 'VRAM Total Memory (B)': '17179869184', 'VRAM Total Used Memory (B)': '1073741824' },
  });
  const gpus = parseRocmSmi(json);
  assert.equal(gpus.length, 1);
  assert.equal(gpus[0].name, 'card0');
  assert.equal(gpus[0].vram_total_mb, 16384);
  assert.equal(gpus[0].vram_used_mb, 1024);
});

test('parseRocmSmi parses multiple cards', () => {
  const json = JSON.stringify({
    card0: { 'VRAM Total Memory (B)': '17179869184', 'VRAM Total Used Memory (B)': '1073741824' },
    card1: { 'VRAM Total Memory (B)': '17179869184', 'VRAM Total Used Memory (B)': '2147483648' },
  });
  assert.equal(parseRocmSmi(json).length, 2);
});

test('parseRocmSmi returns [] for invalid JSON', () => {
  assert.deepEqual(parseRocmSmi('not json'), []);
  assert.deepEqual(parseRocmSmi(''), []);
  assert.deepEqual(parseRocmSmi(null), []);
});

test('parseRocmSmi skips cards missing a total field', () => {
  const json = JSON.stringify({ card0: { 'some other key': '123' } });
  assert.deepEqual(parseRocmSmi(json), []);
});

test('parseRocmSmi skips a card with a blank or whitespace-only total field instead of treating it as 0', () => {
  const blank = JSON.stringify({ card0: { 'VRAM Total Memory (B)': '', 'VRAM Total Used Memory (B)': '1073741824' } });
  const whitespace = JSON.stringify({ card0: { 'VRAM Total Memory (B)': '   ', 'VRAM Total Used Memory (B)': '1073741824' } });
  assert.deepEqual(parseRocmSmi(blank), []);
  assert.deepEqual(parseRocmSmi(whitespace), []);
});
