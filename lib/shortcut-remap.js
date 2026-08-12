'use strict';

// Pure logic for the remappable global keyboard shortcuts (see initHotkeys()
// in app.js). Keeps the "what key combo maps to what action" resolution
// separate from the DOM-bound keydown listener so it's unit-testable.

const DEFAULT_SHORTCUTS = {
  palette:          { combo: 'mod+p',       label: 'Command palette' },
  search:           { combo: 'mod+k',       label: 'Search all chats' },
  convSearch:       { combo: 'mod+f',       label: 'Search in conversation' },
  newConversation:  { combo: 'mod+j',       label: 'New conversation' },
  toggleTools:      { combo: 'mod+/',       label: 'Toggle agent tools' },
  regenerate:       { combo: 'mod+r',       label: 'Regenerate last response' },
  editLast:         { combo: 'mod+e',       label: 'Edit last user message' },
  focusMode:        { combo: 'mod+shift+f', label: 'Toggle focus mode' },
  toggleTimestamps: { combo: 't',           label: 'Toggle message timestamps' },
  showHelp:         { combo: '?',           label: 'Show keyboard shortcuts' },
};

const MODIFIER_ORDER = ['mod', 'shift', 'alt'];
const MODIFIER_KEYS = new Set(['Control', 'Meta', 'Shift', 'Alt', 'OS']);
const SYMBOLS = { mod: '⌘', shift: '⇧', alt: '⌥' };

const LETTER_RE = /^[a-zA-Z]$/;

// Turns a KeyboardEvent-like object into a canonical combo string, e.g.
// {key:'f', ctrlKey:true, shiftKey:true} -> "mod+shift+f". Returns null for
// a bare modifier keypress (nothing to bind yet) or a missing key.
//
// Shift is only tracked explicitly for letters and multi-char named keys
// (ArrowUp, F1, ...) — for everything else (digits, punctuation) the
// browser already bakes shift into `key` itself (Shift+/ arrives as "?",
// Shift+1 as "!"), so adding a separate "shift" part would double-count it
// and the combo would never match again.
// The delimiter itself needs an unambiguous named token — a literal "+" key
// would otherwise produce a combo string indistinguishable from the "+"
// join separator (e.g. binding the bare + key would emit "+", which
// isValidCombo then rejects as a malformed two-empty-parts split).
const PLUS_KEY_TOKEN = 'plus';

function comboFromEvent(e) {
  const key = e && e.key;
  if (!key || MODIFIER_KEYS.has(key)) return null;
  const isLetter = LETTER_RE.test(key);
  const tracksShift = isLetter || key.length > 1;
  const parts = [];
  if (e.ctrlKey || e.metaKey) parts.push('mod');
  if (tracksShift && e.shiftKey) parts.push('shift');
  if (e.altKey) parts.push('alt');
  if (key === '+') parts.push(PLUS_KEY_TOKEN);
  else parts.push(isLetter ? key.toLowerCase() : key);
  return parts.join('+');
}

// Rejects anything comboFromEvent() itself could never produce — a bare
// modifier with no dispatchable key, duplicate/out-of-order modifiers, or
// non-canonical letter casing — so a hand-edited or imported settings blob
// can't wedge in a combo the runtime will silently never match.
function isValidCombo(combo) {
  if (typeof combo !== 'string' || !combo.trim()) return false;
  const parts = combo.split('+');
  const key = parts[parts.length - 1];
  const mods = parts.slice(0, -1);
  if (!key || MODIFIER_ORDER.includes(key)) return false;
  if (LETTER_RE.test(key) && key !== key.toLowerCase()) return false;
  let lastRank = -1;
  for (const m of mods) {
    const rank = MODIFIER_ORDER.indexOf(m);
    if (rank === -1 || rank <= lastRank) return false; // unknown, duplicate, or out of canonical order
    lastRank = rank;
  }
  return true;
}

// Renders a combo string for display, e.g. "mod+shift+f" -> "⌘ ⇧ F".
function formatCombo(combo) {
  if (typeof combo !== 'string' || !combo) return '';
  return combo
    .split('+')
    .map(part => {
      if (SYMBOLS[part]) return SYMBOLS[part];
      if (part === PLUS_KEY_TOKEN) return '+';
      return part.length === 1 ? part.toUpperCase() : part;
    })
    .join(' ');
}

// Merges user overrides (e.g. userSettings.shortcuts) on top of the
// defaults, dropping anything that isn't a known action or a well-formed
// combo string so a corrupted/edited localStorage blob can't break hotkeys.
function mergeShortcuts(overrides) {
  const merged = {};
  Object.keys(DEFAULT_SHORTCUTS).forEach(action => {
    merged[action] = DEFAULT_SHORTCUTS[action].combo;
  });
  if (overrides && typeof overrides === 'object') {
    Object.keys(overrides).forEach(action => {
      if (Object.prototype.hasOwnProperty.call(DEFAULT_SHORTCUTS, action) && isValidCombo(overrides[action])) {
        merged[action] = overrides[action];
      }
    });
  }
  return merged;
}

// Given a full action->combo map, returns { combo: [actions...] } for every
// combo bound to more than one action, so the UI can flag the clash.
function findConflicts(map) {
  const byCombo = {};
  Object.keys(map || {}).forEach(action => {
    const combo = map[action];
    (byCombo[combo] = byCombo[combo] || []).push(action);
  });
  const conflicts = {};
  Object.keys(byCombo).forEach(combo => {
    if (byCombo[combo].length > 1) conflicts[combo] = byCombo[combo];
  });
  return conflicts;
}

// Loaded both as a CommonJS module (tests) and as a plain <script> in
// index.html (browser has no `module` global).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { DEFAULT_SHORTCUTS, comboFromEvent, isValidCombo, formatCombo, mergeShortcuts, findConflicts };
}
