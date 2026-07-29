'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateCustomTool, buildCustomToolDef, sanitizeCustomTools } = require('../lib/custom-tools.js');

const VALID_TOOL = {
  name: 'weather',
  description: 'Get current weather for a city',
  input_schema: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] },
  url: 'https://example.com/weather',
  method: 'POST',
  enabled: true,
};

// ── validateCustomTool ─────────────────────────────────────────────────────

test('validateCustomTool: accepts a well-formed tool', () => {
  const { valid, errors } = validateCustomTool(VALID_TOOL);
  assert.equal(valid, true);
  assert.deepEqual(errors, []);
});

test('validateCustomTool: rejects a missing/invalid name', () => {
  assert.equal(validateCustomTool({ ...VALID_TOOL, name: '' }).valid, false);
  assert.equal(validateCustomTool({ ...VALID_TOOL, name: '1bad' }).valid, false);
  assert.equal(validateCustomTool({ ...VALID_TOOL, name: 'has space' }).valid, false);
  assert.equal(validateCustomTool({ ...VALID_TOOL, name: 'has-dash' }).valid, false);
});

test('validateCustomTool: accepts underscores and leading underscore in name', () => {
  assert.equal(validateCustomTool({ ...VALID_TOOL, name: '_my_tool_2' }).valid, true);
});

test('validateCustomTool: rejects missing description', () => {
  const { valid, errors } = validateCustomTool({ ...VALID_TOOL, description: '' });
  assert.equal(valid, false);
  assert.ok(errors.some(e => e.includes('description')));
});

test('validateCustomTool: rejects missing/malformed input_schema', () => {
  assert.equal(validateCustomTool({ ...VALID_TOOL, input_schema: undefined }).valid, false);
  assert.equal(validateCustomTool({ ...VALID_TOOL, input_schema: 'not an object' }).valid, false);
  assert.equal(validateCustomTool({ ...VALID_TOOL, input_schema: ['not', 'an', 'object'] }).valid, false);
});

test('validateCustomTool: rejects invalid method', () => {
  assert.equal(validateCustomTool({ ...VALID_TOOL, method: 'DELETE' }).valid, false);
  assert.equal(validateCustomTool({ ...VALID_TOOL, method: 'get' }).valid, true);
});

test('validateCustomTool: rejects missing/malformed/unsupported-protocol url', () => {
  assert.equal(validateCustomTool({ ...VALID_TOOL, url: '' }).valid, false);
  assert.equal(validateCustomTool({ ...VALID_TOOL, url: 'not a url' }).valid, false);
  assert.equal(validateCustomTool({ ...VALID_TOOL, url: 'ftp://example.com/x' }).valid, false);
});

test('validateCustomTool: rejects a non-object tool', () => {
  assert.equal(validateCustomTool(null).valid, false);
  assert.equal(validateCustomTool('x').valid, false);
});

// ── buildCustomToolDef ──────────────────────────────────────────────────────

test('buildCustomToolDef: shapes a tool entry into the registry def format', () => {
  const def = buildCustomToolDef(VALID_TOOL);
  assert.deepEqual(def, {
    name: 'weather',
    description: VALID_TOOL.description,
    input_schema: VALID_TOOL.input_schema,
    _source: 'custom',
  });
});

// ── sanitizeCustomTools ──────────────────────────────────────────────────────

test('sanitizeCustomTools: keeps only enabled, valid, non-colliding tools', () => {
  const tools = [
    VALID_TOOL,
    { ...VALID_TOOL, name: 'disabled_tool', enabled: false },
    { ...VALID_TOOL, name: 'bad tool name' },
    { ...VALID_TOOL, name: 'datetime' }, // collides with a reserved/built-in name
  ];
  const usable = sanitizeCustomTools(tools, new Set(['datetime']));
  assert.deepEqual(usable.map(t => t.name), ['weather']);
});

test('sanitizeCustomTools: dedupes custom tools that share a name with each other', () => {
  const tools = [VALID_TOOL, { ...VALID_TOOL, description: 'a different weather tool' }];
  const usable = sanitizeCustomTools(tools, new Set());
  assert.equal(usable.length, 1);
  assert.equal(usable[0].description, VALID_TOOL.description);
});

test('sanitizeCustomTools: treats enabled as true by default (only false excludes)', () => {
  const tools = [{ ...VALID_TOOL, enabled: undefined }];
  const usable = sanitizeCustomTools(tools, new Set());
  assert.equal(usable.length, 1);
});

test('sanitizeCustomTools: handles empty/undefined input', () => {
  assert.deepEqual(sanitizeCustomTools([], new Set()), []);
  assert.deepEqual(sanitizeCustomTools(undefined, new Set()), []);
});
