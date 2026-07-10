'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveApiKeyStorageMove } = require('../lib/key-storage.js');

test('ephemeral mode writes to session and clears local', () => {
  assert.deepEqual(resolveApiKeyStorageMove(true), { writeTo: 'session', clearFrom: 'local' });
});

test('non-ephemeral mode writes to local and clears session', () => {
  assert.deepEqual(resolveApiKeyStorageMove(false), { writeTo: 'local', clearFrom: 'session' });
});

test('truthy/falsy inputs are coerced like booleans', () => {
  assert.deepEqual(resolveApiKeyStorageMove(1), { writeTo: 'session', clearFrom: 'local' });
  assert.deepEqual(resolveApiKeyStorageMove(0), { writeTo: 'local', clearFrom: 'session' });
  assert.deepEqual(resolveApiKeyStorageMove(undefined), { writeTo: 'local', clearFrom: 'session' });
});
