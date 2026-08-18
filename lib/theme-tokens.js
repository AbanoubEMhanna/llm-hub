'use strict';

// Pure logic for the in-app Theme Editor (Settings → Appearance → Theme
// Editor). Keeps "which CSS custom properties are user-editable, and what
// counts as a valid override" separate from the DOM wiring in app.js so
// it's unit-testable, the same split used by lib/shortcut-remap.js for
// keyboard shortcuts.

// Tokens beyond --accent/--accent2 (already handled by the accent-color
// picker) that are safe to expose: the core structural colors every
// surface derives from. Each maps to the CSS custom property it drives and
// carries the shipped default for both themes so the UI can show a
// "default" swatch and resetThemeTokens() can restore it precisely.
const EDITABLE_THEME_TOKENS = {
  bg:     { cssVar: '--bg',     label: 'Background',   defaults: { dark: '#09090b', light: '#ffffff' } },
  text:   { cssVar: '--text',   label: 'Text',          defaults: { dark: '#fafafa', light: '#09090b' } },
  border: { cssVar: '--border', label: 'Border',        defaults: { dark: '#27272a', light: '#e4e4e7' } },
  muted:  { cssVar: '--muted',  label: 'Muted text',    defaults: { dark: '#71717a', light: '#71717a' } },
};

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

function isValidHexColor(value) {
  return typeof value === 'string' && HEX_RE.test(value);
}

// Merges user overrides (userSettings.themeTokens) on top of nothing —
// unlike shortcuts there's no "always present" default here, since an
// unset token should fall through to whichever theme (dark/light) CSS
// block is active rather than pinning one theme's color into the other.
// Drops anything that isn't a known token key or a well-formed #rrggbb
// value, so a corrupted/edited localStorage blob or backup import can't
// wedge in an invalid CSS custom property value.
function mergeThemeTokens(overrides) {
  const merged = {};
  if (overrides && typeof overrides === 'object') {
    Object.keys(overrides).forEach(key => {
      if (Object.prototype.hasOwnProperty.call(EDITABLE_THEME_TOKENS, key) && isValidHexColor(overrides[key])) {
        merged[key] = overrides[key];
      }
    });
  }
  return merged;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EDITABLE_THEME_TOKENS, isValidHexColor, mergeThemeTokens };
}
