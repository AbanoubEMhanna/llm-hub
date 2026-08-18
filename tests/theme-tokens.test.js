'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EDITABLE_THEME_TOKENS, isValidHexColor, mergeThemeTokens } = require('../lib/theme-tokens.js');

test('isValidHexColor accepts well-formed 6-digit hex and rejects garbage', () => {
  assert.equal(isValidHexColor('#09090b'), true);
  assert.equal(isValidHexColor('#FAFAFA'), true);
  assert.equal(isValidHexColor('#fff'), false); // 3-digit shorthand not accepted
  assert.equal(isValidHexColor('09090b'), false); // missing #
  assert.equal(isValidHexColor('#zzzzzz'), false);
  assert.equal(isValidHexColor(''), false);
  assert.equal(isValidHexColor(null), false);
  assert.equal(isValidHexColor(42), false);
});

test('mergeThemeTokens returns empty object with no overrides', () => {
  assert.deepEqual(mergeThemeTokens(undefined), {});
  assert.deepEqual(mergeThemeTokens(null), {});
});

test('mergeThemeTokens keeps valid overrides for known tokens', () => {
  const merged = mergeThemeTokens({ bg: '#111111', text: '#eeeeee' });
  assert.equal(merged.bg, '#111111');
  assert.equal(merged.text, '#eeeeee');
});

test('mergeThemeTokens drops unknown keys and invalid values', () => {
  const merged = mergeThemeTokens({
    bg: '#111111',
    notARealToken: '#222222', // unknown key, dropped
    text: 'not-a-color',      // invalid value, dropped
    border: 42,               // not a string, dropped
  });
  assert.deepEqual(merged, { bg: '#111111' });
});

test('EDITABLE_THEME_TOKENS covers the core structural colors with dark/light defaults', () => {
  ['bg', 'text', 'border', 'muted'].forEach(key => {
    const entry = EDITABLE_THEME_TOKENS[key];
    assert.ok(entry, `missing entry for ${key}`);
    assert.ok(entry.cssVar.startsWith('--'));
    assert.ok(isValidHexColor(entry.defaults.dark));
    assert.ok(isValidHexColor(entry.defaults.light));
  });
});
