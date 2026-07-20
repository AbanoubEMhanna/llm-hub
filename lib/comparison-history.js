'use strict';

// Formats and caps client-side comparison-mode session history (see
// persistCompareSession() in app.js). Sessions live in localStorage only —
// there's no server component here, same as chat history — so this module
// just holds the pure shaping/capping logic to keep it unit-testable
// without a DOM or localStorage.

const MAX_ENTRIES = 50;
const MAX_ROUNDS = 20;
const MAX_TEXT_LEN = 8000;

function truncateText(value) {
  const str = typeof value === 'string' ? value : '';
  return str.length > MAX_TEXT_LEN ? str.slice(0, MAX_TEXT_LEN) + '…[truncated]' : str;
}

function formatRound({ prompt, textA, textB, gradeA, gradeB } = {}) {
  return {
    prompt: truncateText(prompt),
    textA: truncateText(textA),
    textB: truncateText(textB),
    gradeA: gradeA === 'up' || gradeA === 'down' ? gradeA : null,
    gradeB: gradeB === 'up' || gradeB === 'down' ? gradeB : null,
  };
}

function formatSession({ id, ts, modelA, modelB, abMode, rounds = [] } = {}) {
  const list = Array.isArray(rounds) ? rounds : [];
  return {
    id: String(id || ''),
    ts: ts || new Date().toISOString(),
    modelA: String(modelA || ''),
    modelB: String(modelB || ''),
    abMode: abMode === true,
    // Keep only the most recent rounds so one long-running session can't
    // grow the stored entry without bound.
    rounds: list.slice(-MAX_ROUNDS).map(formatRound),
  };
}

// Keep the most recent MAX_ENTRIES sessions (list is expected newest-first).
function pruneHistory(list) {
  return (Array.isArray(list) ? list : []).slice(0, MAX_ENTRIES);
}

// Move/insert `session` to the front of `list`, replacing any existing
// entry with the same id (a session gets updated in place as new rounds
// are sent), then apply the entry cap.
function upsertSession(list, session) {
  const rest = (Array.isArray(list) ? list : []).filter(s => s && s.id !== session.id);
  return pruneHistory([session, ...rest]);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { formatSession, formatRound, pruneHistory, upsertSession, MAX_ENTRIES, MAX_ROUNDS, MAX_TEXT_LEN };
}
