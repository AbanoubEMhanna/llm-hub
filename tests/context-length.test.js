'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseContextLength } = require('../lib/context-length.js');

test('parses a numeric string into an integer', () => {
  assert.equal(parseContextLength('8192'), 8192);
});

test('trims whitespace around a numeric string', () => {
  assert.equal(parseContextLength(' 4096 \n'), 4096);
});

test('accepts a number directly', () => {
  assert.equal(parseContextLength(2048), 2048);
});

test('returns undefined for undefined, null, or empty string', () => {
  assert.equal(parseContextLength(undefined), undefined);
  assert.equal(parseContextLength(null), undefined);
  assert.equal(parseContextLength(''), undefined);
});

test('returns undefined for zero, negative, or non-integer values', () => {
  assert.equal(parseContextLength(0), undefined);
  assert.equal(parseContextLength(-1), undefined);
  assert.equal(parseContextLength(3.5), undefined);
  assert.equal(parseContextLength('-5'), undefined);
  assert.equal(parseContextLength('not a number'), undefined);
});

test('rejects fractional numeric strings instead of truncating them', () => {
  assert.equal(parseContextLength('7.5'), undefined);
});

test('returns undefined for NaN', () => {
  assert.equal(parseContextLength(NaN), undefined);
});
