'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseCliArgs, buildBatchMessages, extractAssistantText } = require('../lib/cli-batch.js');

test('no args → not batch mode, defaults intact', () => {
  const args = parseCliArgs([]);
  assert.equal(args.batchMode, false);
  assert.equal(args.model, null);
  assert.equal(args.provider, 'ollama');
  assert.equal(args.prompt, null);
});

test('--model alone enables batch mode', () => {
  const args = parseCliArgs(['--model', 'llama3.2']);
  assert.equal(args.batchMode, true);
  assert.equal(args.model, 'llama3.2');
});

test('--help enables batch mode even without --model', () => {
  const args = parseCliArgs(['--help']);
  assert.equal(args.batchMode, true);
  assert.equal(args.help, true);
});
test('-h is a synonym for --help', () => {
  assert.equal(parseCliArgs(['-h']).help, true);
});

test('positional args after flags are joined into the prompt', () => {
  const args = parseCliArgs(['--model', 'llama3.2', 'explain', 'closures', 'please']);
  assert.equal(args.prompt, 'explain closures please');
});

test('--prompt takes precedence over positional args', () => {
  const args = parseCliArgs(['--model', 'llama3.2', '--prompt', 'from flag', 'ignored positional']);
  assert.equal(args.prompt, 'from flag');
});

test('parses provider, system, temperature, and json flag', () => {
  const args = parseCliArgs(['--model', 'llama3.2', '--provider', 'lmstudio', '--system', 'be terse', '--temperature', '0.2', '--json']);
  assert.equal(args.provider, 'lmstudio');
  assert.equal(args.system, 'be terse');
  assert.equal(args.temperature, 0.2);
  assert.equal(args.json, true);
});

test('invalid --temperature falls back to null instead of NaN', () => {
  const args = parseCliArgs(['--model', 'llama3.2', '--temperature', 'not-a-number']);
  assert.equal(args.temperature, null);
});

test('a value-taking flag followed by another flag is a parse error, not a swallowed value', () => {
  const args = parseCliArgs(['--model', '--json', 'prompt text']);
  assert.equal(args.error, '--model requires a value');
  assert.equal(args.model, null);
  // "--json" was not consumed as --model's value, so the parser reaches it
  // on the next iteration and parses it as its own flag, as it should.
  assert.equal(args.json, true);
  assert.equal(args.prompt, 'prompt text');
});

test('a value-taking flag at the end of argv with no value is a parse error', () => {
  const args = parseCliArgs(['--model', 'llama3.2', '--system']);
  assert.equal(args.error, '--system requires a value');
  assert.equal(args.system, null);
});

test('--provider, --temperature, and --prompt also reject a following flag as their value', () => {
  assert.equal(parseCliArgs(['--model', 'x', '--provider', '--json']).error, '--provider requires a value');
  assert.equal(parseCliArgs(['--model', 'x', '--temperature', '--json']).error, '--temperature requires a value');
  assert.equal(parseCliArgs(['--model', 'x', '--prompt', '--json']).error, '--prompt requires a value');
});

test('a parse error on --model itself still enables batch mode (surfaces the error instead of silently starting the server)', () => {
  const args = parseCliArgs(['--model', '--json', 'hello']);
  assert.equal(args.error, '--model requires a value');
  assert.equal(args.model, null);
  assert.equal(args.batchMode, true);
});

test('buildBatchMessages omits system role when no system prompt given', () => {
  const messages = buildBatchMessages({ system: null, prompt: 'hi' });
  assert.deepEqual(messages, [{ role: 'user', content: 'hi' }]);
});

test('buildBatchMessages includes system role first when given', () => {
  const messages = buildBatchMessages({ system: 'be terse', prompt: 'hi' });
  assert.deepEqual(messages, [
    { role: 'system', content: 'be terse' },
    { role: 'user', content: 'hi' },
  ]);
});

test('extractAssistantText pulls the message content', () => {
  const text = extractAssistantText({ choices: [{ message: { content: 'hello there' } }] });
  assert.equal(text, 'hello there');
});

test('extractAssistantText surfaces a string error field', () => {
  assert.equal(extractAssistantText({ error: 'model not found' }), 'model not found');
});

test('extractAssistantText surfaces an object error field', () => {
  assert.equal(extractAssistantText({ error: { message: 'model not found' } }), 'model not found');
});

test('extractAssistantText falls back to empty string when nothing usable is present', () => {
  assert.equal(extractAssistantText({}), '');
  assert.equal(extractAssistantText(null), '');
});
