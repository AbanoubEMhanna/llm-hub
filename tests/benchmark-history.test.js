'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  addBenchmarkRun,
  getHistoryForModel,
  listBenchmarkedModels,
  computeTrendStats,
  computeLatencyHistogram,
  MAX_RUNS_PER_MODEL,
} = require('../lib/benchmark-history.js');

test('addBenchmarkRun appends a run for a model, starting from empty history', () => {
  const h = addBenchmarkRun({}, 'llama3.2', { tokPerSec: 42, ttft: 100, totalMs: 900, timestamp: 1 });
  assert.deepEqual(getHistoryForModel(h, 'llama3.2'), [{ tokPerSec: 42, ttft: 100, totalMs: 900, timestamp: 1 }]);
});

test('addBenchmarkRun keeps runs for other models untouched', () => {
  let h = addBenchmarkRun({}, 'a', { tokPerSec: 10, timestamp: 1 });
  h = addBenchmarkRun(h, 'b', { tokPerSec: 20, timestamp: 2 });
  assert.equal(getHistoryForModel(h, 'a').length, 1);
  assert.equal(getHistoryForModel(h, 'b').length, 1);
  assert.equal(getHistoryForModel(h, 'a')[0].tokPerSec, 10);
});

test('addBenchmarkRun coerces missing/invalid numeric fields to safe defaults', () => {
  const h = addBenchmarkRun({}, 'x', { tokPerSec: 'nope', ttft: undefined, totalMs: NaN });
  const run = getHistoryForModel(h, 'x')[0];
  assert.equal(run.tokPerSec, 0);
  assert.equal(run.ttft, null);
  assert.equal(run.totalMs, 0);
  assert.equal(typeof run.timestamp, 'number');
});

test('addBenchmarkRun ignores an empty/missing modelId', () => {
  const h = addBenchmarkRun({ a: [{ tokPerSec: 1 }] }, '', { tokPerSec: 5 });
  assert.deepEqual(Object.keys(h), ['a']);
});

test('addBenchmarkRun caps a model history at MAX_RUNS_PER_MODEL, dropping the oldest', () => {
  let h = {};
  for (let i = 0; i < MAX_RUNS_PER_MODEL + 5; i++) {
    h = addBenchmarkRun(h, 'm', { tokPerSec: i, timestamp: i });
  }
  const runs = getHistoryForModel(h, 'm');
  assert.equal(runs.length, MAX_RUNS_PER_MODEL);
  assert.equal(runs[0].tokPerSec, 5); // oldest 5 dropped
  assert.equal(runs[runs.length - 1].tokPerSec, MAX_RUNS_PER_MODEL + 4);
});

test('getHistoryForModel returns an empty array for an unknown model or bad input', () => {
  assert.deepEqual(getHistoryForModel({}, 'missing'), []);
  assert.deepEqual(getHistoryForModel(null, 'missing'), []);
  assert.deepEqual(getHistoryForModel({ m: 'not-an-array' }, 'm'), []);
});

test('listBenchmarkedModels returns only models with at least one run, most-recent first', () => {
  let h = addBenchmarkRun({}, 'old', { tokPerSec: 1, timestamp: 100 });
  h = addBenchmarkRun(h, 'new', { tokPerSec: 2, timestamp: 500 });
  h = { ...h, empty: [] };
  assert.deepEqual(listBenchmarkedModels(h), ['new', 'old']);
});

test('computeTrendStats on empty history returns zeroed stats', () => {
  const stats = computeTrendStats([]);
  assert.deepEqual(stats, { count: 0, avgTokPerSec: 0, bestTokPerSec: 0, latestTokPerSec: 0, avgTtft: null, deltaPct: 0 });
});

test('computeTrendStats computes avg/best/latest across runs', () => {
  const stats = computeTrendStats([
    { tokPerSec: 10, ttft: 100 },
    { tokPerSec: 20, ttft: 200 },
    { tokPerSec: 30, ttft: null },
  ]);
  assert.equal(stats.count, 3);
  assert.equal(stats.avgTokPerSec, 20);
  assert.equal(stats.bestTokPerSec, 30);
  assert.equal(stats.latestTokPerSec, 30);
  assert.equal(stats.avgTtft, 150); // only numeric ttft values averaged
});

test('computeTrendStats reports positive deltaPct when the latest run improves on the prior average', () => {
  const stats = computeTrendStats([{ tokPerSec: 10 }, { tokPerSec: 10 }, { tokPerSec: 20 }]);
  assert.equal(stats.deltaPct, 100); // 20 vs prior avg of 10 = +100%
});

test('computeTrendStats reports zero deltaPct for a single run (no prior average)', () => {
  const stats = computeTrendStats([{ tokPerSec: 42 }]);
  assert.equal(stats.deltaPct, 0);
});

test('computeLatencyHistogram on empty/missing ttft values returns no buckets', () => {
  assert.deepEqual(computeLatencyHistogram([]), { buckets: [], min: 0, max: 0 });
  assert.deepEqual(computeLatencyHistogram([{ ttft: null }, { ttft: undefined }]), { buckets: [], min: 0, max: 0 });
});

test('computeLatencyHistogram collapses identical ttft values into a single bucket', () => {
  const hist = computeLatencyHistogram([{ ttft: 100 }, { ttft: 100 }, { ttft: 100 }]);
  assert.deepEqual(hist.buckets, [{ min: 100, max: 100, count: 3 }]);
});

test('computeLatencyHistogram buckets values into the requested number of equal-width ranges', () => {
  const entries = [{ ttft: 0 }, { ttft: 10 }, { ttft: 50 }, { ttft: 90 }, { ttft: 100 }];
  const hist = computeLatencyHistogram(entries, 5);
  assert.equal(hist.min, 0);
  assert.equal(hist.max, 100);
  assert.equal(hist.buckets.length, 5);
  assert.equal(hist.buckets.reduce((sum, b) => sum + b.count, 0), entries.length);
  assert.equal(hist.buckets[0].count, 2); // 0 and 10 fall in the first [0,20) bucket
  assert.equal(hist.buckets[4].count, 2); // 90 and 100 fall in the last, inclusive [80,100] bucket
});

test('computeLatencyHistogram ignores non-numeric or negative ttft values', () => {
  const hist = computeLatencyHistogram([{ ttft: 100 }, { ttft: -5 }, { ttft: 'x' }, { ttft: 200 }]);
  const total = hist.buckets.reduce((sum, b) => sum + b.count, 0);
  assert.equal(total, 2);
});
