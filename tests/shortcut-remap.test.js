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

test('comboFromEvent encodes a literal + keypress as an unambiguous token', () => {
  // A raw "+" combo string would be indistinguishable from the "+" join
  // separator (splits into two empty parts) — must round-trip through a
  // named token instead so binding the + key actually works.
  assert.equal(comboFromEvent({ key: '+', ctrlKey: true }), 'mod+plus');
  assert.equal(isValidCombo(comboFromEvent({ key: '+', ctrlKey: true })), true);
});

test('isValidCombo accepts well-formed combos and rejects garbage', () => {
  assert.equal(isValidCombo('mod+p'), true);
  assert.equal(isValidCombo('mod+shift+f'), true);
  assert.equal(isValidCombo('mod+shift+alt+p'), true);
  assert.equal(isValidCombo('t'), true);
  assert.equal(isValidCombo(''), false);
  assert.equal(isValidCombo('bogus+p'), false);
  assert.equal(isValidCombo(42), false);
  assert.equal(isValidCombo(null), false);
});

test('isValidCombo rejects combos comboFromEvent could never produce', () => {
  assert.equal(isValidCombo('mod'), false); // bare modifier, no dispatchable key
  assert.equal(isValidCombo('shift'), false);
  assert.equal(isValidCombo('shift+mod+p'), false); // wrong modifier order
  assert.equal(isValidCombo('mod+mod+p'), false); // duplicate modifier
  assert.equal(isValidCombo('mod+shift+P'), false); // non-canonical casing — comboFromEvent always lowercases letters
});

test('formatCombo renders symbols and uppercases single-char keys', () => {
  assert.equal(formatCombo('mod+p'), '⌘ P');
  assert.equal(formatCombo('mod+shift+f'), '⌘ ⇧ F');
  assert.equal(formatCombo('t'), 'T');
  assert.equal(formatCombo('?'), '?');
  assert.equal(formatCombo('mod+plus'), '⌘ +');
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
