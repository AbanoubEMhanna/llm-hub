'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const {
  isAllowedRepoUrl,
  shouldIndexFile,
  walkRepoFiles,
  cloneRepo,
  repoDisplayName,
} = require('../lib/github-index.js');

const isPrivateHost = (host) => ['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes((host || '').toLowerCase());

// ── isAllowedRepoUrl ─────────────────────────────────────────────────────────

test('isAllowedRepoUrl: accepts a public https URL', () => {
  assert.deepEqual(isAllowedRepoUrl('https://github.com/owner/repo', isPrivateHost), { ok: true });
});

test('isAllowedRepoUrl: accepts a public http URL', () => {
  assert.deepEqual(isAllowedRepoUrl('http://example.com/owner/repo.git', isPrivateHost), { ok: true });
});

test('isAllowedRepoUrl: rejects a non-URL string', () => {
  const result = isAllowedRepoUrl('not-a-url', isPrivateHost);
  assert.equal(result.ok, false);
  assert.match(result.reason, /Invalid URL/);
});

test('isAllowedRepoUrl: rejects file:// (would read the server\'s local filesystem)', () => {
  const result = isAllowedRepoUrl('file:///etc/passwd', isPrivateHost);
  assert.equal(result.ok, false);
  assert.match(result.reason, /Unsupported protocol/);
});

test('isAllowedRepoUrl: rejects ssh:// and git:// schemes', () => {
  assert.equal(isAllowedRepoUrl('ssh://git@github.com/owner/repo.git', isPrivateHost).ok, false);
  assert.equal(isAllowedRepoUrl('git://github.com/owner/repo.git', isPrivateHost).ok, false);
});

test('isAllowedRepoUrl: rejects private/local hosts', () => {
  const result = isAllowedRepoUrl('https://localhost/owner/repo', isPrivateHost);
  assert.equal(result.ok, false);
  assert.match(result.reason, /Blocked/);
});

// ── shouldIndexFile ──────────────────────────────────────────────────────────

test('shouldIndexFile: accepts a small source file', () => {
  assert.equal(shouldIndexFile('src/index.js', 1000), true);
});

test('shouldIndexFile: rejects a file over the size cap', () => {
  assert.equal(shouldIndexFile('src/index.js', 1024 * 1024), false);
});

test('shouldIndexFile: rejects unrecognized extensions (binaries, images)', () => {
  assert.equal(shouldIndexFile('assets/logo.png', 100), false);
  assert.equal(shouldIndexFile('bin/app', 100), false);
});

test('shouldIndexFile: rejects files inside skipped directories', () => {
  assert.equal(shouldIndexFile('node_modules/pkg/index.js', 100), false);
  assert.equal(shouldIndexFile('dist/bundle.js', 100), false);
  assert.equal(shouldIndexFile('a/b/.git/config', 100), false);
});

test('shouldIndexFile: respects a custom maxFileBytes option', () => {
  assert.equal(shouldIndexFile('README.md', 500, { maxFileBytes: 100 }), false);
  assert.equal(shouldIndexFile('README.md', 50, { maxFileBytes: 100 }), true);
});

// ── walkRepoFiles ────────────────────────────────────────────────────────────

function makeTree(root, files) {
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
}

test('walkRepoFiles: collects indexable files and skips build/vendor dirs', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ghidx-walk-'));
  try {
    makeTree(root, {
      'README.md': '# hello',
      'src/index.js': 'console.log(1)',
      'node_modules/pkg/index.js': 'ignored',
      '.git/HEAD': 'ignored',
      'assets/logo.png': 'binary-ish',
    });
    const { files, truncated } = walkRepoFiles(root);
    assert.deepEqual(files.map(f => f.relPath).sort(), ['README.md', 'src/index.js']);
    assert.equal(truncated, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('walkRepoFiles: stops after maxFiles and reports truncated', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ghidx-walk-cap-'));
  try {
    makeTree(root, {
      'a.md': 'a', 'b.md': 'b', 'c.md': 'c', 'd.md': 'd',
    });
    const { files, truncated } = walkRepoFiles(root, { maxFiles: 2 });
    assert.equal(files.length, 2);
    assert.equal(truncated, true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('walkRepoFiles: stops after maxTotalBytes and reports truncated', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ghidx-walk-bytes-'));
  try {
    makeTree(root, {
      'a.md': 'x'.repeat(50),
      'b.md': 'x'.repeat(50),
      'c.md': 'x'.repeat(50),
    });
    const { files, truncated } = walkRepoFiles(root, { maxTotalBytes: 60 });
    assert.ok(files.length <= 2);
    assert.equal(truncated, true);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('walkRepoFiles: not truncated when everything fits under the caps', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ghidx-walk-fit-'));
  try {
    makeTree(root, { 'a.md': 'a', 'b.md': 'b' });
    const { files, truncated } = walkRepoFiles(root, { maxFiles: 10, maxTotalBytes: 1000 });
    assert.equal(files.length, 2);
    assert.equal(truncated, false);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

// ── repoDisplayName ──────────────────────────────────────────────────────────

test('repoDisplayName: extracts owner/repo from a .git URL', () => {
  assert.equal(repoDisplayName('https://github.com/owner/repo.git'), 'owner/repo');
});

test('repoDisplayName: extracts owner/repo without .git suffix', () => {
  assert.equal(repoDisplayName('https://github.com/owner/repo'), 'owner/repo');
});

test('repoDisplayName: falls back to the raw string when not a URL', () => {
  assert.equal(repoDisplayName('not-a-url'), 'not-a-url');
});

// ── cloneRepo (real `git clone`, against a local fixture repo — no network) ──
// `cloneRepo` is protocol-agnostic by design (see lib/github-index.js) so it
// can be exercised end-to-end against a plain local path; production safety
// comes from the HTTP endpoint calling `isAllowedRepoUrl` first.

test('cloneRepo: shallow-clones a local git repo and the files are readable', async () => {
  const srcRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'ghidx-src-'));
  const destDir = path.join(os.tmpdir(), 'ghidx-dest-' + process.pid + '-' + Date.now());
  try {
    execFileSync('git', ['init', '-q'], { cwd: srcRepo });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: srcRepo });
    execFileSync('git', ['config', 'user.name', 'Test'], { cwd: srcRepo });
    fs.writeFileSync(path.join(srcRepo, 'README.md'), '# Fixture repo');
    fs.mkdirSync(path.join(srcRepo, 'src'));
    fs.writeFileSync(path.join(srcRepo, 'src', 'index.js'), 'module.exports = 42;');
    execFileSync('git', ['add', '-A'], { cwd: srcRepo });
    execFileSync('git', ['commit', '-q', '-m', 'init'], { cwd: srcRepo });

    await cloneRepo(srcRepo, destDir);

    assert.ok(fs.existsSync(path.join(destDir, 'README.md')));
    const { files } = walkRepoFiles(destDir);
    assert.deepEqual(files.map(f => f.relPath).sort(), ['README.md', 'src/index.js']);
    assert.equal(fs.readFileSync(path.join(destDir, 'src', 'index.js'), 'utf8'), 'module.exports = 42;');
  } finally {
    fs.rmSync(srcRepo, { recursive: true, force: true });
    fs.rmSync(destDir, { recursive: true, force: true });
  }
});

test('cloneRepo: rejects (and does not hang) on a nonexistent source', async () => {
  const destDir = path.join(os.tmpdir(), 'ghidx-dest-bad-' + process.pid + '-' + Date.now());
  await assert.rejects(
    () => cloneRepo(path.join(os.tmpdir(), 'no-such-repo-' + Date.now()), destDir, { timeoutMs: 5000 }),
    /git clone failed/
  );
  fs.rmSync(destDir, { recursive: true, force: true });
});
