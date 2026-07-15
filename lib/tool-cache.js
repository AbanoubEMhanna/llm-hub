'use strict';

// Caches tool call results within a single agent loop / chat turn so that if
// the model calls the exact same tool with the exact same arguments twice in
// one session, the second call is served from cache instead of re-executed
// (useful for expensive or side-effect-free reads like file/webpage fetches).
class ToolCallCache {
  constructor() {
    this.store = new Map();
  }

  key(name, args) {
    return `${name}:${JSON.stringify(args ?? {})}`;
  }

  has(name, args) {
    return this.store.has(this.key(name, args));
  }

  get(name, args) {
    return this.store.get(this.key(name, args));
  }

  set(name, args, result) {
    this.store.set(this.key(name, args), result);
    return result;
  }
}

// Loaded both as a CommonJS module (proxy.js, tests) and as a plain <script>
// in index.html (browser has no `module` global).
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ToolCallCache };
}
