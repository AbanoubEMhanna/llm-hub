'use strict';

/**
 * GPU / VRAM hardware detection — pure parsers for `nvidia-smi` and `rocm-smi`
 * stdout. Spawning the subprocess lives in proxy.js; these functions only turn
 * raw output into a normalized `{ name, vram_total_mb, vram_used_mb }[]`.
 */

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
    const total = Number(totalStr);
    const used = Number(usedStr);
    if (!name || !Number.isFinite(total)) continue;
    gpus.push({ name, vram_total_mb: total, vram_used_mb: Number.isFinite(used) ? used : 0 });
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
    const totalB = Number(info['VRAM Total Memory (B)']);
    const usedB = Number(info['VRAM Total Used Memory (B)']);
    if (!Number.isFinite(totalB)) continue;
    gpus.push({
      name: card,
      vram_total_mb: Math.round(totalB / 1048576),
      vram_used_mb: Number.isFinite(usedB) ? Math.round(usedB / 1048576) : 0,
    });
  }
  return gpus;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseNvidiaSmi, parseRocmSmi };
}
