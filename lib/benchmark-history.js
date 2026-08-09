'use strict';

// Client-side storage shaping for the Model Manager's benchmark runner (see
// runBenchmark() in app.js). Every completed benchmark run is appended here
// so the UI can render a tokens/sec trend per model instead of only ever
// showing the latest run. History lives in localStorage only — same as
// comparison-history.js — so this module holds the pure add/prune/stats
// logic to keep it unit-testable without a DOM or localStorage.

const MAX_RUNS_PER_MODEL = 20;

function formatRun({ tokPerSec, ttft, totalMs, timestamp } = {}) {
  return {
    tokPerSec: typeof tokPerSec === 'number' && isFinite(tokPerSec) ? tokPerSec : 0,
    ttft: typeof ttft === 'number' && isFinite(ttft) ? ttft : null,
    totalMs: typeof totalMs === 'number' && isFinite(totalMs) ? totalMs : 0,
    timestamp: typeof timestamp === 'number' && isFinite(timestamp) ? timestamp : Date.now(),
  };
}

// Append a completed run for `modelId`, keeping only the most recent
// MAX_RUNS_PER_MODEL entries for that model (oldest dropped first).
// `history` is a plain object keyed by modelId -> array of runs, oldest-first.
function addBenchmarkRun(history, modelId, run) {
  const id = String(modelId || '');
  if (!id) return history && typeof history === 'object' ? history : {};
  const base = history && typeof history === 'object' ? history : {};
  const existing = Array.isArray(base[id]) ? base[id] : [];
  const updated = [...existing, formatRun(run)].slice(-MAX_RUNS_PER_MODEL);
  return { ...base, [id]: updated };
}

function getHistoryForModel(history, modelId) {
  const id = String(modelId || '');
  const base = history && typeof history === 'object' ? history : {};
  return Array.isArray(base[id]) ? base[id] : [];
}

// Models with at least one recorded run, most-recently-benchmarked first.
function listBenchmarkedModels(history) {
  const base = history && typeof history === 'object' ? history : {};
  return Object.keys(base)
    .filter(id => Array.isArray(base[id]) && base[id].length > 0)
    .sort((a, b) => {
      const lastA = base[a][base[a].length - 1]?.timestamp || 0;
      const lastB = base[b][base[b].length - 1]?.timestamp || 0;
      return lastB - lastA;
    });
}

// Summary stats for a single model's run history (oldest-first array).
function computeTrendStats(entries) {
  const runs = Array.isArray(entries) ? entries : [];
  if (!runs.length) {
    return { count: 0, avgTokPerSec: 0, bestTokPerSec: 0, latestTokPerSec: 0, avgTtft: null, deltaPct: 0 };
  }

  const toks = runs.map(r => r.tokPerSec || 0);
  const ttfts = runs.map(r => r.ttft).filter(v => typeof v === 'number');

  const avgTokPerSec = toks.reduce((a, b) => a + b, 0) / toks.length;
  const bestTokPerSec = Math.max(...toks);
  const latestTokPerSec = toks[toks.length - 1];
  const avgTtft = ttfts.length ? ttfts.reduce((a, b) => a + b, 0) / ttfts.length : null;

  // % change of the latest run vs. the average of all prior runs.
  const priorToks = toks.slice(0, -1);
  const priorAvg = priorToks.length ? priorToks.reduce((a, b) => a + b, 0) / priorToks.length : null;
  const deltaPct = priorAvg && priorAvg > 0 ? ((latestTokPerSec - priorAvg) / priorAvg) * 100 : 0;

  return { count: runs.length, avgTokPerSec, bestTokPerSec, latestTokPerSec, avgTtft, deltaPct };
}

// Buckets a model's TTFT (time-to-first-token) values into `bucketCount`
// equal-width ranges spanning [min, max] across its run history, so the UI
// can render a latency-distribution bar chart alongside the tok/s trend.
const MAX_HISTOGRAM_BUCKETS = 100;

function computeLatencyHistogram(entries, bucketCount = 5) {
  const runs = Array.isArray(entries) ? entries : [];
  const values = runs.map(r => r.ttft).filter(v => typeof v === 'number' && isFinite(v) && v >= 0);
  if (!values.length) return { buckets: [], min: 0, max: 0 };

  const min = Math.min(...values);
  const max = Math.max(...values);
  const normalizedBucketCount = Number.isFinite(bucketCount) ? Math.floor(bucketCount) : 5;
  const count = Math.min(MAX_HISTOGRAM_BUCKETS, Math.max(1, normalizedBucketCount || 5));

  if (min === max) {
    return { buckets: [{ min, max, count: values.length }], min, max };
  }

  const width = (max - min) / count;
  const buckets = Array.from({ length: count }, (_, i) => ({
    min: min + i * width,
    max: i === count - 1 ? max : min + (i + 1) * width,
    count: 0,
  }));

  values.forEach(v => {
    const idx = Math.min(count - 1, Math.max(0, Math.floor((v - min) / width)));
    buckets[idx].count++;
  });

  return { buckets, min, max };
}

// Loaded both as a CommonJS module (tests) and as a plain <script> in
// index.html (browser has no `module` global).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    addBenchmarkRun,
    getHistoryForModel,
    listBenchmarkedModels,
    computeTrendStats,
    computeLatencyHistogram,
    MAX_RUNS_PER_MODEL,
  };
}
