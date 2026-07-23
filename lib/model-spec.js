'use strict';

/**
 * Model comparison spec sheet — pure formatting helpers.
 * Turns two raw model-metadata objects (context_length, parameter_size,
 * quantization, size_label, family, license, owned_by) into a row list
 * suitable for rendering as a side-by-side table.
 */

const SPEC_FIELDS = [
  { key: 'owned_by',        label: 'Provider' },
  { key: 'parameter_size',  label: 'Parameters' },
  { key: 'context_length',  label: 'Context window', format: formatContextLength },
  { key: 'quantization',    label: 'Quantization' },
  { key: 'size_label',      label: 'Size on disk' },
  { key: 'family',          label: 'Family' },
  { key: 'license',         label: 'License' },
];

function formatContextLength(value) {
  if (!value || typeof value !== 'number') return null;
  return value >= 1024 ? `${(value / 1024).toFixed(0)}K tokens` : `${value} tokens`;
}

/**
 * @param {object} metaA - metadata for the left-hand model (may be null/undefined)
 * @param {object} metaB - metadata for the right-hand model (may be null/undefined)
 * @returns {{label: string, a: string, b: string, differs: boolean}[]}
 *          Rows where both sides are empty are omitted.
 */
function buildSpecRows(metaA, metaB) {
  const a = metaA || {};
  const b = metaB || {};
  const rows = [];
  for (const field of SPEC_FIELDS) {
    const rawA = a[field.key];
    const rawB = b[field.key];
    const fmt = field.format || (v => (v == null ? null : String(v)));
    const valA = fmt(rawA);
    const valB = fmt(rawB);
    if (!valA && !valB) continue;
    rows.push({
      label: field.label,
      a: valA || '—',
      b: valB || '—',
      differs: (rawA ?? null) !== (rawB ?? null),
    });
  }
  return rows;
}

// Loaded both as a CommonJS module (proxy.js, tests) and as a plain <script>
// in index.html (browser has no `module` global).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { buildSpecRows, formatContextLength, SPEC_FIELDS };
}
