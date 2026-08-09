'use strict';

// Buckets the sidebar's "unfiled" conversation list (see renderConvList() in
// app.js) into recency-based sections — Today / Yesterday / Previous 7 Days /
// Previous 30 Days / Older — the same grouping shape used by most chat UIs.
// Folder-filed conversations already get an explicit "project" grouping via
// the folders feature; this module covers the remaining date axis. Pure and
// unit-testable: takes `now` as a parameter instead of reading Date.now().

const GROUP_DEFS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'week', label: 'Previous 7 Days' },
  { key: 'month', label: 'Previous 30 Days' },
  { key: 'older', label: 'Older' },
];

function groupConversationsByDate(conversations, now = Date.now()) {
  const items = Array.isArray(conversations) ? conversations : [];

  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const todayStart = startOfDay.getTime();
  // Calendar-day boundaries via setDate(), not fixed 24h offsets — a DST
  // transition can make a local day 23 or 25 hours long, which would
  // otherwise shift conversations into the wrong bucket.
  const dayStartDaysAgo = days => {
    const boundary = new Date(todayStart);
    boundary.setDate(boundary.getDate() - days);
    return boundary.getTime();
  };
  const yesterdayStart = dayStartDaysAgo(1);
  const weekStart = dayStartDaysAgo(7);
  const monthStart = dayStartDaysAgo(30);

  const buckets = { today: [], yesterday: [], week: [], month: [], older: [] };

  items.forEach(c => {
    const ts = c && typeof c.ts === 'number' && isFinite(c.ts) ? c.ts : 0;
    if (ts >= todayStart) buckets.today.push(c);
    else if (ts >= yesterdayStart) buckets.yesterday.push(c);
    else if (ts >= weekStart) buckets.week.push(c);
    else if (ts >= monthStart) buckets.month.push(c);
    else buckets.older.push(c);
  });

  return GROUP_DEFS
    .map(({ key, label }) => ({ key, label, items: buckets[key] }))
    .filter(group => group.items.length > 0);
}

// Loaded both as a CommonJS module (tests) and as a plain <script> in
// index.html (browser has no `module` global).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { groupConversationsByDate };
}
