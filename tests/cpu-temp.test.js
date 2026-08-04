'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseThermalZones } = require('../lib/cpu-temp');

test('parseThermalZones returns null for missing/invalid input', () => {
  assert.equal(parseThermalZones(null), null);
  assert.equal(parseThermalZones(undefined), null);
  assert.equal(parseThermalZones([]), null);
  assert.equal(parseThermalZones('not an array'), null);
});

test('parseThermalZones prefers a recognized CPU-package zone over unrelated sensors', () => {
  const zones = [
    { type: 'iwlwifi_1', milliC: 45000 },
    { type: 'x86_pkg_temp', milliC: 54300 },
    { type: 'nvme', milliC: 38000 },
  ];
  assert.equal(parseThermalZones(zones), 54.3);
});

test('parseThermalZones averages multiple CPU-package zones (per-core reporting)', () => {
  const zones = [
    { type: 'coretemp', milliC: 50000 },
    { type: 'coretemp', milliC: 60000 },
  ];
  assert.equal(parseThermalZones(zones), 55);
});

test('parseThermalZones falls back to averaging all zones when none match a known CPU pattern', () => {
  const zones = [
    { type: 'some_vendor_sensor', milliC: 40000 },
    { type: 'another_sensor', milliC: 50000 },
  ];
  assert.equal(parseThermalZones(zones), 45);
});

test('parseThermalZones filters out implausible readings before averaging', () => {
  const zones = [
    { type: 'acpitz', milliC: -60000 }, // disconnected sensor sentinel
    { type: 'acpitz', milliC: 200000 }, // clearly bogus (200°C)
    { type: 'acpitz', milliC: 45000 },
  ];
  assert.equal(parseThermalZones(zones), 45);
});

test('parseThermalZones returns null when every reading is implausible', () => {
  const zones = [{ type: 'acpitz', milliC: -60000 }, { type: 'acpitz', milliC: 999999 }];
  assert.equal(parseThermalZones(zones), null);
});

test('parseThermalZones ignores malformed zone entries', () => {
  const zones = [null, { type: 'x86_pkg_temp' }, { type: 'x86_pkg_temp', milliC: 'not a number' }, { type: 'x86_pkg_temp', milliC: 50000 }];
  assert.equal(parseThermalZones(zones), 50);
});
