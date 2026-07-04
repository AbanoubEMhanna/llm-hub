'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseSeed } = require('../lib/seed.js');

test('parses a numeric string into an integer', () => {
  assert.equal(parseSeed('42'), 42);
});

test('trims whitespace around a numeric string', () => {
  assert.equal(parseSeed(' 7 \n'), 7);
});

test('accepts a number directly', () => {
  assert.equal(parseSeed(1234), 1234);
});

test('returns undefined for undefined, null, or empty string', () => {
  assert.equal(parseSeed(undefined), undefined);
  assert.equal(parseSeed(null), undefined);
  assert.equal(parseSeed(''), undefined);
});

test('returns undefined for non-integer or negative values', () => {
  assert.equal(parseSeed(3.5), undefined);
  assert.equal(parseSeed(-1), undefined);
  assert.equal(parseSeed('-5'), undefined);
  assert.equal(parseSeed('not a number'), undefined);
});

test('rejects fractional numeric strings instead of truncating them', () => {
  assert.equal(parseSeed('7.5'), undefined);
});

test('returns undefined for NaN', () => {
  assert.equal(parseSeed(NaN), undefined);
});
