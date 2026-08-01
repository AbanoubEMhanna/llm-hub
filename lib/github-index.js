'use strict';

const { execFile } = require('child_process');
const fs   = require('fs');
const path = require('path');

const DEFAULT_MAX_FILE_BYTES   = 300 * 1024;       // skip any single file bigger than this
const DEFAULT_MAX_FILES        = 500;              // stop walking after this many indexable files
const DEFAULT_MAX_TOTAL_BYTES  = 8 * 1024 * 1024;  // stop walking once this much content is queued
const DEFAULT_CLONE_TIMEOUT_MS = 30000;

const SKIP_DIRS = new Set([
  '.git', 'node_modules', 'dist', 'build', 'out', 'vendor',
  '.next', '.venv', 'venv', '__pycache__', 'target', '.idea', '.vscode',
]);

const TEXT_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs',
  '.py', '.rb', '.go', '.rs', '.java', '.kt', '.c', '.h', '.cpp', '.hpp', '.cs', '.php', '.swift',
  '.md', '.mdx', '.txt', '.rst',
  '.json', '.yml', '.yaml', '.toml', '.ini', '.cfg',
  '.html', '.css', '.scss', '.less',
  '.sh', '.bash', '.sql', '.graphql', '.proto',
]);

/**
 * Validate a repo URL is safe to `git clone`: http(s) only, no private/local hosts.
 * Mirrors the SSRF guard already applied to POST /v1/rag/crawl — cloning is a
 * server-side network fetch too, so the same deny-list applies.
 *
 * @param {string} repoUrl
 * @param {(hostname: string) => boolean} isPrivateHost
 * @returns {{ok: true} | {ok: false, reason: string}}
 */
function isAllowedRepoUrl(repoUrl, isPrivateHost) {
  let parsed;
  try { parsed = new URL(repoUrl); } catch { return { ok: false, reason: 'Invalid URL' }; }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return { ok: false, reason: `Unsupported protocol: ${parsed.protocol}` };
  }
  if (isPrivateHost(parsed.hostname)) {
    return { ok: false, reason: `Blocked: cannot clone from private/local addresses (${parsed.hostname})` };
  }
  return { ok: true };
}

/**
 * Decide whether a file found while walking a cloned repo is worth indexing:
 * a text/code extension, under the per-file size cap, and outside any skipped
 * directory (node_modules, .git, build output, etc).
 *
 * @param {string} relPath   - path relative to the repo root, `/`-separated
 * @param {number} sizeBytes
 * @param {{maxFileBytes?: number}} [opts]
 * @returns {boolean}
 */
function shouldIndexFile(relPath, sizeBytes, opts = {}) {
  const maxFileBytes = opts.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES;
  if (sizeBytes > maxFileBytes) return false;
  if (relPath.split('/').some(part => SKIP_DIRS.has(part))) return false;
  return TEXT_EXTENSIONS.has(path.extname(relPath).toLowerCase());
}

/**
 * Walk a directory tree (a cloned repo) and collect the text/code files worth
 * indexing, stopping once the file-count or total-byte budget runs out so a
 * huge repo can't exhaust memory or blow the request past a sane duration.
 *
 * @param {string} rootDir
 * @param {{maxFiles?: number, maxTotalBytes?: number, maxFileBytes?: number}} [opts]
 * @returns {Array<{relPath: string, absPath: string, size: number}>}
 */
function walkRepoFiles(rootDir, opts = {}) {
  const maxFiles       = opts.maxFiles ?? DEFAULT_MAX_FILES;
  const maxTotalBytes   = opts.maxTotalBytes ?? DEFAULT_MAX_TOTAL_BYTES;
  const results = [];
  let totalBytes = 0;

  function walk(dir, relDir) {
    if (results.length >= maxFiles || totalBytes >= maxTotalBytes) return;
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (results.length >= maxFiles || totalBytes >= maxTotalBytes) return;
      const abs = path.join(dir, entry.name);
      const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(abs, rel);
      } else if (entry.isFile()) {
        let size;
        try { size = fs.statSync(abs).size; } catch { continue; }
        if (!shouldIndexFile(rel, size, opts)) continue;
        results.push({ relPath: rel, absPath: abs, size });
        totalBytes += size;
      }
    }
  }
  walk(rootDir, '');
  return results;
}

/**
 * Shallow-clone a repo into destDir. Protocol-agnostic on purpose — this is a
 * thin wrapper around `git clone`, so it also works with a plain local path
 * (handy for tests). Callers reachable from the network (the HTTP endpoint)
 * are responsible for calling `isAllowedRepoUrl` first. Uses execFile with an
 * argv array (no shell), so the URL/path can never be interpreted as a shell
 * command.
 *
 * @param {string} repoUrl
 * @param {string} destDir
 * @param {{branch?: string, timeoutMs?: number}} [opts]
 * @returns {Promise<void>}
 */
function cloneRepo(repoUrl, destDir, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_CLONE_TIMEOUT_MS;
  const args = ['clone', '--depth', '1', '--single-branch'];
  if (opts.branch) args.push('--branch', opts.branch);
  args.push('--', repoUrl, destDir);
  return new Promise((resolve, reject) => {
    execFile('git', args, { timeout: timeoutMs }, (err, _stdout, stderr) => {
      if (err) return reject(new Error(`git clone failed: ${(stderr || err.message).trim().slice(0, 500)}`));
      resolve();
    });
  });
}

/**
 * Derive a short human-friendly name (`owner/repo`) from a repo URL, for
 * default collection naming and source labels.
 *
 * @param {string} repoUrl
 * @returns {string}
 */
function repoDisplayName(repoUrl) {
  try {
    const parsed = new URL(repoUrl);
    const cleaned = parsed.pathname.replace(/^\/|\/$/g, '').replace(/\.git$/, '');
    return cleaned.split('/').slice(-2).join('/') || parsed.hostname;
  } catch {
    return repoUrl;
  }
}

module.exports = {
  isAllowedRepoUrl,
  shouldIndexFile,
  walkRepoFiles,
  cloneRepo,
  repoDisplayName,
  DEFAULT_MAX_FILE_BYTES,
  DEFAULT_MAX_FILES,
  DEFAULT_MAX_TOTAL_BYTES,
};
