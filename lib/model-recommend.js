'use strict';

// Same file, loaded two ways (see the export guard at the bottom): under
// Node, `require` the sibling module directly; as a plain <script> in
// index.html there's no `require`, so reuse the `estimateLoadFit` global
// that lib/hardware-fit.js's own <script> tag already defined — index.html
// must load hardware-fit.js first. Named `_estimateLoadFit` (not
// `estimateLoadFit`) because classic <script> tags share one global lexical
// scope: a `const estimateLoadFit` here would collide with hardware-fit.js's
// `function estimateLoadFit` and throw "already been declared" at parse time,
// aborting this whole script.
const _estimateLoadFit = (typeof module !== 'undefined' && module.exports)
  ? require('./hardware-fit').estimateLoadFit
  : globalThis.estimateLoadFit;

/**
 * Picks a small, hardware-appropriate starter set from the model library for
 * first-launch onboarding — one general-purpose model plus, when a fitting
 * candidate exists, one code model and one vision model. Only entries that
 * `estimateLoadFit` marks as a comfortable 'fit' are considered; if nothing
 * fits (or hardware info isn't available yet), no recommendations are made
 * rather than steering a new user toward a pull that will likely fail.
 *
 * @param {Array<{name, org, icon, size, tags, desc}>} catalog e.g. OLLAMA_LIBRARY
 * @param {{gpus, freeRamBytes}} hardware same shape estimateLoadFit expects
 * @param {Iterable<string>} [installedNames] model names to exclude (already pulled)
 * @param {number} [limit] max recommendations to return (default 3)
 * @returns {Array<{category: 'general'|'code'|'vision', model: object, fit: object}>}
 */
function recommendModels(catalog, hardware, installedNames = [], limit = 3) {
  if (!Array.isArray(catalog) || !hardware) return [];
  const installed = new Set(installedNames);

  const fitting = catalog
    .filter(m => m && !installed.has(m.name))
    .map(m => ({ model: m, fit: _estimateLoadFit(m.size, hardware) }))
    .filter(({ fit }) => fit && fit.level === 'fit');

  if (!fitting.length) return [];

  // Prefer the largest model that still comfortably fits — best quality
  // within the hardware budget — breaking ties by catalog order.
  const bestOf = (predicate) =>
    fitting
      .filter(({ model }) => predicate(model))
      .sort((a, b) => b.fit.sizeBytes - a.fit.sizeBytes)[0];

  // Each category excludes models already claimed by an earlier one — a
  // model tagged both 'code' and 'vision' would otherwise show up twice.
  const picks = [];
  const picked = new Set();
  const take = (category, predicate) => {
    const found = bestOf(m => predicate(m) && !picked.has(m.name));
    if (!found) return;
    picked.add(found.model.name);
    picks.push({ category, ...found });
  };

  take('general', m => !m.tags?.includes('code') && !m.tags?.includes('vision'));
  take('code',    m => m.tags?.includes('code'));
  take('vision',  m => m.tags?.includes('vision'));

  return picks.slice(0, limit);
}

// Loaded both as a CommonJS module (proxy.js, tests) and as a plain <script>
// in index.html (browser has no `module` global) — same pattern as hardware-fit.js.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { recommendModels };
}
