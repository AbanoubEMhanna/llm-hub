'use strict';

const NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/;

/**
 * Validates a user-defined custom tool entry (as saved in CONFIG.custom_tools).
 *
 * @param {object} tool
 * @returns {{valid: boolean, errors: string[]}}
 */
function validateCustomTool(tool) {
  const errors = [];
  if (!tool || typeof tool !== 'object') return { valid: false, errors: ['tool must be an object'] };

  if (typeof tool.name !== 'string' || !NAME_RE.test(tool.name)) {
    errors.push('name must start with a letter/underscore and contain only letters, numbers, underscores (max 64 chars)');
  }
  if (typeof tool.description !== 'string' || !tool.description.trim()) {
    errors.push('description is required');
  }
  if (!tool.input_schema || typeof tool.input_schema !== 'object' || Array.isArray(tool.input_schema)) {
    errors.push('input_schema must be an object');
  }
  if (tool.method && !['GET', 'POST'].includes(String(tool.method).toUpperCase())) {
    errors.push('method must be GET or POST');
  }
  if (typeof tool.url !== 'string' || !tool.url.trim()) {
    errors.push('url is required');
  } else {
    try {
      const parsed = new URL(tool.url);
      if (!['http:', 'https:'].includes(parsed.protocol)) errors.push('url must use http:// or https://');
    } catch {
      errors.push('url is not a valid URL');
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Builds a tool-definition object (name/description/input_schema shape used
 * by ToolRegistry.getOpenAITools) from a stored custom tool entry.
 *
 * @param {object} tool
 * @returns {{name: string, description: string, input_schema: object, _source: string}}
 */
function buildCustomToolDef(tool) {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.input_schema,
    _source: 'custom',
  };
}

/**
 * Filters CONFIG.custom_tools down to the entries that are enabled, valid,
 * and don't collide with a reserved (built-in / MCP) tool name.
 *
 * @param {Array<object>} customTools
 * @param {Set<string>} reservedNames - names already registered (built-ins, MCP tools)
 * @returns {Array<object>} the usable, enabled tool entries (unvalidated fields untouched)
 */
function sanitizeCustomTools(customTools, reservedNames) {
  const seen = new Set(reservedNames || []);
  const usable = [];
  for (const tool of customTools || []) {
    if (!tool || tool.enabled === false) continue;
    if (!validateCustomTool(tool).valid) continue;
    if (seen.has(tool.name)) continue;
    seen.add(tool.name);
    usable.push(tool);
  }
  return usable;
}

module.exports = { validateCustomTool, buildCustomToolDef, sanitizeCustomTools, NAME_RE };
