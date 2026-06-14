'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isPrivateHost } = require('../lib/ssrf.js');

// ── Private / blocked hosts ────────────────────────────────────────────────

test('blocks localhost', () => assert.equal(isPrivateHost('localhost'), true));
test('blocks 0.0.0.0', () => assert.equal(isPrivateHost('0.0.0.0'), true));
test('blocks null / empty host', () => {
  assert.equal(isPrivateHost(null), true);
  assert.equal(isPrivateHost(''), true);
});

test('blocks 127.x.x.x loopback range', () => {
  assert.equal(isPrivateHost('127.0.0.1'), true);
  assert.equal(isPrivateHost('127.255.255.255'), true);
});

test('blocks 10.x.x.x private range', () => {
  assert.equal(isPrivateHost('10.0.0.1'), true);
  assert.equal(isPrivateHost('10.255.255.255'), true);
});

test('blocks 192.168.x.x private range', () => {
  assert.equal(isPrivateHost('192.168.0.1'), true);
  assert.equal(isPrivateHost('192.168.100.50'), true);
});

test('blocks 172.16–31.x.x private range', () => {
  assert.equal(isPrivateHost('172.16.0.1'), true);
  assert.equal(isPrivateHost('172.31.255.255'), true);
});

test('does NOT block 172.15 (outside private range)', () => {
  assert.equal(isPrivateHost('172.15.0.1'), false);
});

test('does NOT block 172.32 (outside private range)', () => {
  assert.equal(isPrivateHost('172.32.0.1'), false);
});

test('blocks 169.254.x.x link-local / APIPA', () => {
  assert.equal(isPrivateHost('169.254.169.254'), true);
  assert.equal(isPrivateHost('169.254.0.1'), true);
});

test('blocks cloud metadata endpoints', () => {
  assert.equal(isPrivateHost('169.254.169.254'), true);
  assert.equal(isPrivateHost('metadata.google.internal'), true);
});

test('blocks IPv6 loopback ::1', () => assert.equal(isPrivateHost('::1'), true));
test('blocks IPv6 link-local fe80:', () => assert.equal(isPrivateHost('fe80::1'), true));
test('blocks IPv6 unique-local fc/fd', () => {
  assert.equal(isPrivateHost('fc00::1'), true);
  assert.equal(isPrivateHost('fd00::1'), true);
});

// ── Public hosts — must NOT be blocked ────────────────────────────────────

test('allows public IPv4', () => {
  assert.equal(isPrivateHost('8.8.8.8'), false);
  assert.equal(isPrivateHost('1.1.1.1'), false);
  assert.equal(isPrivateHost('93.184.216.34'), false);
});

test('allows public domain names', () => {
  assert.equal(isPrivateHost('example.com'), false);
  assert.equal(isPrivateHost('github.com'), false);
  assert.equal(isPrivateHost('api.openai.com'), false);
});

test('is case-insensitive for hostnames', () => {
  assert.equal(isPrivateHost('LOCALHOST'), true);
  assert.equal(isPrivateHost('Metadata.Google.Internal'), true);
});
