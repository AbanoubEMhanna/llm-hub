'use strict';

/**
 * Estimates whether a model will fit in available hardware before the user
 * pulls it. Prefers detected GPU VRAM capacity (see lib/gpu-info.js); falls
 * back to free system RAM when no GPU was detected, since Ollama can still
 * run models on CPU.
 */

// Parses a human-readable size label like "43 GB" or "512MB" into raw bytes.
function parseSizeLabelToBytes(sizeLabel) {
  if (!sizeLabel || typeof sizeLabel !== 'string') return null;
  const m = sizeLabel.trim().match(/^([\d.]+)\s*(TB|GB|MB|KB|B)$/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return null;
  const units = { tb: 1e12, gb: 1e9, mb: 1e6, kb: 1e3, b: 1 };
  return n * units[m[2].toLowerCase()];
}

// gpus: [{ vram_total_mb, vram_used_mb }] from /v1/system. freeRamBytes: free
// system RAM in bytes, used only when no GPU was detected.
// Returns { level: 'fit'|'warn'|'no', source: 'vram'|'ram', capacityBytes, sizeBytes }
// or null when there isn't enough information to judge (unknown size / no capacity data).
function estimateLoadFit(sizeLabel, { gpus, freeRamBytes } = {}) {
  const sizeBytes = parseSizeLabelToBytes(sizeLabel);
  if (sizeBytes === null) return null;

  const totalVramMb = (gpus || []).reduce((sum, g) => sum + (g.vram_total_mb || 0), 0);
  const usedVramMb  = (gpus || []).reduce((sum, g) => sum + (g.vram_used_mb  || 0), 0);
  const hasGpu = totalVramMb > 0;

  const capacityBytes = hasGpu
    ? Math.max(0, totalVramMb - usedVramMb) * 1048576
    : (typeof freeRamBytes === 'number' ? freeRamBytes : null);
  if (capacityBytes === null) return null;

  let level;
  if (sizeBytes <= capacityBytes * 0.85) level = 'fit';
  else if (sizeBytes <= capacityBytes * 1.1) level = 'warn';
  else level = 'no';

  return { level, source: hasGpu ? 'vram' : 'ram', capacityBytes, sizeBytes };
}

// Loaded both as a CommonJS module (proxy.js, tests) and as a plain <script>
// in index.html (browser has no `module` global).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseSizeLabelToBytes, estimateLoadFit };
}
