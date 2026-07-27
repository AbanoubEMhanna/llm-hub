'use strict';

/**
 * GPU / VRAM hardware detection — pure parsers for `nvidia-smi` and `rocm-smi`
 * stdout. Spawning the subprocess lives in proxy.js; these functions only turn
 * raw output into a normalized `{ name, vram_total_mb, vram_used_mb }[]`.
 */

// Number('') is 0, not NaN — without this guard a blank total-memory field
// would parse as a "valid" 0-VRAM GPU instead of being skipped as malformed.
function parsePositiveNumber(raw) {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === 'string' && raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

// Parses `nvidia-smi --query-gpu=name,memory.total,memory.used --format=csv,noheader,nounits`
// Each line looks like: "NVIDIA GeForce RTX 4090, 24564, 1187"
function parseNvidiaSmi(output) {
  if (!output || typeof output !== 'string') return [];
  const gpus = [];
  for (const line of output.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(',').map(p => p.trim());
    if (parts.length < 3) continue;
    const [name, totalStr, usedStr] = parts;
    const total = parsePositiveNumber(totalStr);
    const used = parsePositiveNumber(usedStr);
    if (!name || total === null) continue;
    gpus.push({ name, vram_total_mb: total, vram_used_mb: used ?? 0 });
  }
  return gpus;
}

// Parses `rocm-smi --showmeminfo vram --json`, shaped like:
// { "card0": { "VRAM Total Memory (B)": "17179869184", "VRAM Total Used Memory (B)": "1073741824" } }
function parseRocmSmi(jsonStr) {
  if (!jsonStr || typeof jsonStr !== 'string') return [];
  let parsed;
  try { parsed = JSON.parse(jsonStr); } catch { return []; }
  if (!parsed || typeof parsed !== 'object') return [];
  const gpus = [];
  for (const [card, info] of Object.entries(parsed)) {
    if (!info || typeof info !== 'object') continue;
    const totalB = parsePositiveNumber(info['VRAM Total Memory (B)']);
    const usedB = parsePositiveNumber(info['VRAM Total Used Memory (B)']);
    if (totalB === null) continue;
    gpus.push({
      name: card,
      vram_total_mb: Math.round(totalB / 1048576),
      vram_used_mb: usedB !== null ? Math.round(usedB / 1048576) : 0,
    });
  }
  return gpus;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseNvidiaSmi, parseRocmSmi };
}
