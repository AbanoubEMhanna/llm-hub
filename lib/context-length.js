'use strict';

// Accepts a number, numeric string, or empty/undefined/null input and
// returns a positive integer context length (num_ctx), or undefined if unset/invalid.
function parseContextLength(input) {
  if (input === undefined || input === null) return undefined;
  const trimmed = typeof input === 'string' ? input.trim() : input;
  if (trimmed === '') return undefined;
  const n = typeof trimmed === 'number' ? trimmed : Number(trimmed);
  if (!Number.isInteger(n) || n < 1) return undefined;
  return n;
}

// Loaded both as a CommonJS module (proxy.js, tests) and as a plain <script>
// in index.html (browser has no `module` global).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseContextLength };
}
