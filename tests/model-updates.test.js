'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseOllamaRef, buildUpdateReport } = require('../lib/model-updates');

test('parseOllamaRef: bare name defaults to library namespace and latest tag', () => {
  assert.deepEqual(parseOllamaRef('mistral'), { namespace: 'library', model: 'mistral', tag: 'latest' });
});

test('parseOllamaRef: bare name with explicit tag', () => {
  assert.deepEqual(parseOllamaRef('llama3.2:3b'), { namespace: 'library', model: 'llama3.2', tag: '3b' });
});

test('parseOllamaRef: namespaced ref (org/model:tag)', () => {
  assert.deepEqual(parseOllamaRef('myorg/mymodel:v2'), { namespace: 'myorg', model: 'mymodel', tag: 'v2' });
});

test('parseOllamaRef: namespaced ref with no tag defaults to latest', () => {
  assert.deepEqual(parseOllamaRef('myorg/mymodel'), { namespace: 'myorg', model: 'mymodel', tag: 'latest' });
});

test('parseOllamaRef: rejects unsupported shapes and empty/non-string input', () => {
  assert.equal(parseOllamaRef('registry.example.com/org/model'), null);
  assert.equal(parseOllamaRef(''), null);
  assert.equal(parseOllamaRef(null), null);
  assert.equal(parseOllamaRef(undefined), null);
});

test('parseOllamaRef: rejects a host:port-qualified reference instead of mis-parsing the port as a tag', () => {
  // Without a "colon must come after the last slash" check, this would
  // wrongly parse as { namespace: 'library', model: 'registry.example.com', tag: '5000/org/model' }.
  assert.equal(parseOllamaRef('registry.example.com:5000/org/model'), null);
});

test('buildUpdateReport: flags a model whose remote digest differs', () => {
  const local = [{ name: 'llama3.2:3b', digest: 'sha256:aaa' }];
  const remote = { 'llama3.2:3b': 'sha256:bbb' };
  const report = buildUpdateReport(local, remote);
  assert.equal(report.length, 1);
  assert.equal(report[0].update_available, true);
  assert.equal(report[0].digest, 'sha256:aaa');
  assert.equal(report[0].latest_digest, 'sha256:bbb');
});

test('buildUpdateReport: does not flag a model whose digest matches', () => {
  const local = [{ name: 'llama3.2:3b', digest: 'sha256:aaa' }];
  const remote = { 'llama3.2:3b': 'sha256:aaa' };
  const report = buildUpdateReport(local, remote);
  assert.equal(report.length, 1);
  assert.equal(report[0].update_available, false);
});

test('buildUpdateReport: silently omits models with no local digest', () => {
  const local = [{ name: 'custom-import', digest: null }];
  const report = buildUpdateReport(local, { 'custom-import': 'sha256:bbb' });
  assert.deepEqual(report, []);
});

test('buildUpdateReport: silently omits models with a failed/missing remote lookup', () => {
  const local = [{ name: 'llama3.2:3b', digest: 'sha256:aaa' }];
  const report = buildUpdateReport(local, {});
  assert.deepEqual(report, []);
});

test('buildUpdateReport: accepts a Map as well as a plain object for remoteDigests', () => {
  const local = [{ name: 'llama3.2:3b', digest: 'sha256:aaa' }];
  const remote = new Map([['llama3.2:3b', 'sha256:bbb']]);
  const report = buildUpdateReport(local, remote);
  assert.equal(report[0].update_available, true);
});

test('buildUpdateReport: handles an empty/missing local model list', () => {
  assert.deepEqual(buildUpdateReport([], {}), []);
  assert.deepEqual(buildUpdateReport(null, {}), []);
  assert.deepEqual(buildUpdateReport(undefined, {}), []);
});

test('buildUpdateReport: skips malformed entries in the local list', () => {
  const local = [null, {}, { name: 'ok:latest', digest: 'sha256:aaa' }];
  const report = buildUpdateReport(local, { 'ok:latest': 'sha256:aaa' });
  assert.equal(report.length, 1);
  assert.equal(report[0].name, 'ok:latest');
});
