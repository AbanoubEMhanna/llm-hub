'use strict';

// Given per-message token counts (oldest first, same order the messages are
// sent to the model in) and a context window budget, figures out which
// messages would actually survive a sliding-window truncation — i.e. which
// ones fit once you count backward from the newest message.
//
// `reservedTokens` accounts for tokens that are always sent regardless of
// history (system prompt, injected RAG context, etc.) and is subtracted from
// the budget up front.
function computeContextTimeline(messageTokens, ctxLimit, reservedTokens = 0) {
  const tokens = Array.isArray(messageTokens) ? messageTokens : [];
  const limit = Number.isFinite(ctxLimit) && ctxLimit > 0 ? ctxLimit : 0;
  const reserved = Number.isFinite(reservedTokens) && reservedTokens > 0 ? reservedTokens : 0;
  const budget = Math.max(0, limit - reserved);

  // Real truncation keeps a contiguous run of the most recent messages, so
  // stop at the first (oldest-going) message that doesn't fit rather than
  // skipping it and trying older ones.
  const included = new Array(tokens.length).fill(false);
  let used = 0;
  for (let i = tokens.length - 1; i >= 0; i--) {
    const t = tokens[i] || 0;
    if (used + t > budget) break;
    used += t;
    included[i] = true;
  }

  const totalMessageTokens = tokens.reduce((sum, t) => sum + (t || 0), 0);
  const droppedCount = included.filter(v => !v).length;

  return {
    included,
    reservedTokens: reserved,
    usedTokens: reserved + used,
    totalTokens: reserved + totalMessageTokens,
    ctxLimit: limit,
    droppedCount,
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { computeContextTimeline };
}
