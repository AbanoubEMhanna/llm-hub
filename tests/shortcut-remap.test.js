'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  DEFAULT_SHORTCUTS,
  comboFromEvent,
  isValidCombo,
  formatCombo,
  mergeShortcuts,
  findConflicts,
} = require('../lib/shortcut-remap.js');

test('comboFromEvent builds a canonical combo string', () => {
  assert.equal(comboFromEvent({ key: 'p', metaKey: true }), 'mod+p');
  assert.equal(comboFromEvent({ key: 'P', ctrlKey: true }), 'mod+p');
  assert.equal(comboFromEvent({ key: 'f', ctrlKey: true, shiftKey: true }), 'mod+shift+f');
  assert.equal(comboFromEvent({ key: 't' }), 't');
  assert.equal(comboFromEvent({ key: '?' }), '?');
  assert.equal(comboFromEvent({ key: 'e', metaKey: true, altKey: true }), 'mod+alt+e');
});

test('comboFromEvent does not double-count shift for symbols the browser already shifted', () => {
  // Shift+/ arrives as key:"?" with shiftKey:true — shift is already baked
  // into the character, so the combo must stay "?", not "shift+?".
  assert.equal(comboFromEvent({ key: '?', shiftKey: true }), '?');
  // Shift+1 arrives as key:"!" with shiftKey:true.
  assert.equal(comboFromEvent({ key: '!', shiftKey: true }), '!');
});

test('comboFromEvent tracks shift explicitly for letters (case alone is not reliable — caps lock)', () => {
  assert.equal(comboFromEvent({ key: 'T', shiftKey: true }), 'shift+t');
  assert.equal(comboFromEvent({ key: 'T', shiftKey: false }), 't'); // caps lock, no shift held
  assert.equal(comboFromEvent({ key: 't', shiftKey: false }), 't');
});

test('comboFromEvent returns null for a bare modifier keypress or missing key', () => {
  assert.equal(comboFromEvent({ key: 'Control', ctrlKey: true }), null);
  assert.equal(comboFromEvent({ key: 'Meta', metaKey: true }), null);
  assert.equal(comboFromEvent({}), null);
  assert.equal(comboFromEvent(null), null);
});

test('isValidCombo accepts well-formed combos and rejects garbage', () => {
  assert.equal(isValidCombo('mod+p'), true);
  assert.equal(isValidCombo('mod+shift+f'), true);
  assert.equal(isValidCombo('t'), true);
  assert.equal(isValidCombo(''), false);
  assert.equal(isValidCombo('bogus+p'), false);
  assert.equal(isValidCombo(42), false);
  assert.equal(isValidCombo(null), false);
});

test('formatCombo renders symbols and uppercases single-char keys', () => {
  assert.equal(formatCombo('mod+p'), '⌘ P');
  assert.equal(formatCombo('mod+shift+f'), '⌘ ⇧ F');
  assert.equal(formatCombo('t'), 'T');
  assert.equal(formatCombo('?'), '?');
  assert.equal(formatCombo(''), '');
});

test('mergeShortcuts falls back to defaults with no overrides', () => {
  const map = mergeShortcuts(undefined);
  Object.keys(DEFAULT_SHORTCUTS).forEach(action => {
    assert.equal(map[action], DEFAULT_SHORTCUTS[action].combo);
  });
});

test('mergeShortcuts applies valid overrides and drops invalid/unknown ones', () => {
  const map = mergeShortcuts({
    palette: 'mod+shift+p',
    search: '', // invalid, ignored
    notARealAction: 'mod+z', // unknown action, ignored
    regenerate: 42, // not a string, ignored
  });
  assert.equal(map.palette, 'mod+shift+p');
  assert.equal(map.search, DEFAULT_SHORTCUTS.search.combo);
  assert.equal(map.regenerate, DEFAULT_SHORTCUTS.regenerate.combo);
  assert.equal(map.notARealAction, undefined);
});

test('findConflicts reports combos bound to more than one action', () => {
  const map = mergeShortcuts({ search: 'mod+p' }); // now collides with palette's default
  const conflicts = findConflicts(map);
  assert.deepEqual(Object.keys(conflicts), ['mod+p']);
  assert.deepEqual(conflicts['mod+p'].sort(), ['palette', 'search']);
});

test('findConflicts is empty for the default map', () => {
  assert.deepEqual(findConflicts(mergeShortcuts(undefined)), {});
});
