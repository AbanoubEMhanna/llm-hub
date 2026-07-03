'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseStopSequences, MAX_STOP_SEQUENCES } = require('../lib/stop-sequences.js');

test('parses a comma-separated string into trimmed entries', () => {
  assert.deepEqual(parseStopSequences('###, END , \nSTOP'), ['###', 'END', 'STOP']);
});

test('drops empty and whitespace-only entries', () => {
  assert.deepEqual(parseStopSequences('a,, ,b'), ['a', 'b']);
});

test('dedupes repeated sequences', () => {
  assert.deepEqual(parseStopSequences('a,b,a,b,c'), ['a', 'b', 'c']);
});

test('caps at MAX_STOP_SEQUENCES', () => {
  const result = parseStopSequences('1,2,3,4,5,6');
  assert.equal(result.length, MAX_STOP_SEQUENCES);
  assert.deepEqual(result, ['1', '2', '3', '4']);
});

test('accepts an array directly', () => {
  assert.deepEqual(parseStopSequences(['a', ' b ', '']), ['a', 'b']);
});

test('returns an empty array for undefined, null, or non-string input', () => {
  assert.deepEqual(parseStopSequences(undefined), []);
  assert.deepEqual(parseStopSequences(null), []);
  assert.deepEqual(parseStopSequences(42), []);
});

test('returns an empty array for an empty string', () => {
  assert.deepEqual(parseStopSequences(''), []);
});
