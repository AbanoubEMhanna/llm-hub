'use strict';

const vm = require('node:vm');

const DENY_PATTERN = /\b(require|process|global|this|constructor|import|eval|Function|setTimeout|setInterval)\b/;

/**
 * Evaluate a math expression in an isolated vm context.
 * Only the Math global is exposed — no fs, no process, no network.
 *
 * @param {string} expression
 * @returns {{ result: number } | { error: string }}
 */
function evaluate(expression) {
  if (typeof expression !== 'string' || expression.length > 500) {
    return { error: 'expression missing or too long' };
  }
  if (DENY_PATTERN.test(expression)) {
    return { error: 'expression contains disallowed identifier' };
  }
  try {
    const sandbox = { Math, result: null };
    vm.createContext(sandbox);
    const script = new vm.Script(`result = (${expression});`);
    script.runInContext(sandbox, { timeout: 1000 });
    return { expression, result: sandbox.result };
  } catch (e) {
    return { error: `Cannot evaluate: ${e.message}` };
  }
}

module.exports = { evaluate };
