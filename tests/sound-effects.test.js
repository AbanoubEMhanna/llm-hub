'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getToneConfig } = require('../lib/sound-effects.js');

test('send and receive tones are distinct', () => {
  const send = getToneConfig('send');
  const receive = getToneConfig('receive');
  assert.ok(send && receive);
  assert.notEqual(send.frequency, receive.frequency);
});

test('tone config has the fields needed to drive an oscillator', () => {
  const cfg = getToneConfig('send');
  assert.equal(typeof cfg.frequency, 'number');
  assert.equal(typeof cfg.duration, 'number');
  assert.equal(typeof cfg.type, 'string');
  assert.equal(typeof cfg.gain, 'number');
});

test('unknown kind returns null', () => {
  assert.equal(getToneConfig('bogus'), null);
  assert.equal(getToneConfig(undefined), null);
});
