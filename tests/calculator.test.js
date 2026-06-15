'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { evaluate } = require('../lib/calculator.js');

// ── Happy path ─────────────────────────────────────────────────────────────

test('addition', () => {
  const r = evaluate('1 + 2');
  assert.equal(r.result, 3);
});

test('multiplication', () => {
  const r = evaluate('6 * 7');
  assert.equal(r.result, 42);
});

test('floating point', () => {
  const r = evaluate('0.1 + 0.2');
  assert.ok(Math.abs(r.result - 0.3) < 1e-10);
});

test('exponentiation', () => {
  const r = evaluate('2 ** 10');
  assert.equal(r.result, 1024);
});

test('Math.sqrt', () => {
  const r = evaluate('Math.sqrt(144)');
  assert.equal(r.result, 12);
});

test('Math.PI', () => {
  const r = evaluate('Math.PI');
  assert.ok(Math.abs(r.result - Math.PI) < 1e-15);
});

test('complex expression', () => {
  const r = evaluate('Math.sqrt(144) + 2**10');
  assert.equal(r.result, 12 + 1024);
});

test('modulo', () => {
  const r = evaluate('17 % 5');
  assert.equal(r.result, 2);
});

// ── Security: deny-listed identifiers ────────────────────────────────────

test('blocks require', () => {
  const r = evaluate('require("fs")');
  assert.ok(r.error, 'Should return an error');
  assert.ok(r.error.includes('disallowed'));
});

test('blocks process', () => {
  const r = evaluate('process.exit(0)');
  assert.ok(r.error.includes('disallowed'));
});

test('blocks eval', () => {
  const r = evaluate('eval("1+1")');
  assert.ok(r.error.includes('disallowed'));
});

test('blocks Function constructor', () => {
  const r = evaluate('Function("return process")()');
  assert.ok(r.error, 'Should return an error');
});

test('blocks global', () => {
  const r = evaluate('global.process');
  assert.ok(r.error.includes('disallowed'));
});

// ── Input validation ──────────────────────────────────────────────────────

test('rejects empty expression', () => {
  const r = evaluate('');
  assert.ok(r.error);
});

test('rejects non-string expression', () => {
  const r = evaluate(42);
  assert.ok(r.error);
});

test('rejects expression over 500 chars', () => {
  const r = evaluate('1 +'.repeat(200));
  assert.ok(r.error);
});

test('returns error for syntax errors', () => {
  const r = evaluate('1 + + + +');
  assert.ok(r.error);
});

test('returns error for division by zero (returns Infinity, no throw)', () => {
  const r = evaluate('1 / 0');
  assert.equal(r.result, Infinity);
});
