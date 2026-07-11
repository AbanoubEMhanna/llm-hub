'use strict';

// Decides where API keys should live when the "ephemeral" (per-session,
// never-persisted) toggle is flipped. Ephemeral mode keeps keys in
// sessionStorage (cleared when the tab closes, never written to disk);
// the default keeps them in localStorage (persists across restarts).
// Returns which store to write the keys into and which one to wipe, so a
// toggle flip never leaves a stale copy of the keys sitting in the other store.
function resolveApiKeyStorageMove(ephemeral) {
  return {
    writeTo: ephemeral ? 'session' : 'local',
    clearFrom: ephemeral ? 'local' : 'session',
  };
}

// Loaded both as a CommonJS module (tests) and as a plain <script>
// in index.html (browser has no `module` global).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { resolveApiKeyStorageMove };
}
