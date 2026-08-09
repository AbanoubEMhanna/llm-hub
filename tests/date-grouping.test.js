'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { groupConversationsByDate } = require('../lib/date-grouping.js');

const DAY = 86400000;
// Fixed "now" mid-day so today/yesterday boundaries are unambiguous in tests.
const NOW = new Date(2026, 0, 15, 12, 0, 0).getTime();
const todayStart = new Date(2026, 0, 15, 0, 0, 0).getTime();

test('empty/missing input produces no groups', () => {
  assert.deepEqual(groupConversationsByDate([], NOW), []);
  assert.deepEqual(groupConversationsByDate(undefined, NOW), []);
});

test('buckets a conversation from today into the Today group', () => {
  const c = { id: 'a', ts: todayStart + 3600000 };
  const groups = groupConversationsByDate([c], NOW);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].key, 'today');
  assert.equal(groups[0].label, 'Today');
  assert.deepEqual(groups[0].items, [c]);
});

test('buckets yesterday, this-week, this-month, and older correctly', () => {
  const items = [
    { id: 'today', ts: todayStart + 1000 },
    { id: 'yesterday', ts: todayStart - DAY + 1000 },
    { id: 'week', ts: todayStart - 3 * DAY },
    { id: 'month', ts: todayStart - 20 * DAY },
    { id: 'older', ts: todayStart - 90 * DAY },
  ];
  const groups = groupConversationsByDate(items, NOW);
  const byKey = Object.fromEntries(groups.map(g => [g.key, g.items.map(c => c.id)]));
  assert.deepEqual(byKey, {
    today: ['today'],
    yesterday: ['yesterday'],
    week: ['week'],
    month: ['month'],
    older: ['older'],
  });
});

test('empty buckets are omitted, preserving group order', () => {
  const groups = groupConversationsByDate([
    { id: 'a', ts: todayStart - 90 * DAY },
    { id: 'b', ts: todayStart + 100 },
  ], NOW);
  assert.deepEqual(groups.map(g => g.key), ['today', 'older']);
});

test('boundary: exactly 7 days ago falls in Previous 7 Days, not Older', () => {
  const c = { id: 'edge', ts: todayStart - 7 * DAY };
  const groups = groupConversationsByDate([c], NOW);
  assert.equal(groups[0].key, 'week');
});

test('boundary: exactly 30 days ago falls in Previous 30 Days, not Older', () => {
  const c = { id: 'edge', ts: todayStart - 30 * DAY };
  const groups = groupConversationsByDate([c], NOW);
  assert.equal(groups[0].key, 'month');
});

test('missing/non-numeric ts is treated as epoch 0 (Older)', () => {
  const groups = groupConversationsByDate([{ id: 'a' }, { id: 'b', ts: 'nope' }], NOW);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].key, 'older');
  assert.equal(groups[0].items.length, 2);
});

test('preserves input order within a group', () => {
  const items = [
    { id: 'x', ts: todayStart + 500 },
    { id: 'y', ts: todayStart + 100 },
  ];
  const groups = groupConversationsByDate(items, NOW);
  assert.deepEqual(groups[0].items.map(c => c.id), ['x', 'y']);
});
