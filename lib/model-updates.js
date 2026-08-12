'use strict';

/**
 * Parse an Ollama model reference (e.g. "llama3.2:3b", "myorg/mymodel",
 * "mistral") into the { namespace, model, tag } shape used by the registry's
 * `/v2/<namespace>/<model>/manifests/<tag>` endpoint. Official library
 * models have no namespace segment and default to the "library" namespace,
 * matching how `ollama pull llama3.2` resolves under the hood.
 */
function parseOllamaRef(name) {
  if (!name || typeof name !== 'string') return null;
  const lastSlash = name.lastIndexOf('/');
  const lastColon = name.lastIndexOf(':');
  // A tag-separating ':' must come after the last '/' (if any). A colon
  // before it is a host:port prefix (e.g. "registry.example.com:5000/org/model"),
  // which isn't a ref shape this registry client understands.
  const hasTag = lastColon > lastSlash;
  const repo = hasTag ? name.slice(0, lastColon) : name;
  const tag  = hasTag ? name.slice(lastColon + 1) : 'latest';
  if (!repo || !tag) return null;
  const parts = repo.split('/').filter(Boolean);
  if (parts.length === 1) return { namespace: 'library', model: parts[0], tag };
  if (parts.length === 2) return { namespace: parts[0], model: parts[1], tag };
  return null; // unsupported shape (e.g. a third-party registry host prefix)
}

/**
 * Compare each locally installed model's manifest digest against the
 * digest currently published on the registry. `localModels` is
 * `[{ name, digest }]` (from Ollama's `/api/tags`); `remoteDigests` maps
 * model name -> digest string, with entries only present for models whose
 * registry lookup succeeded. Models with no local digest or no successful
 * remote lookup are omitted from the report rather than reported as
 * "up to date", since we have nothing trustworthy to compare against.
 */
function buildUpdateReport(localModels, remoteDigests) {
  const lookup = remoteDigests instanceof Map ? remoteDigests : new Map(Object.entries(remoteDigests || {}));
  const report = [];
  for (const m of localModels || []) {
    if (!m || !m.name || !m.digest) continue;
    const latestDigest = lookup.get(m.name);
    if (!latestDigest) continue;
    report.push({
      name: m.name,
      digest: m.digest,
      latest_digest: latestDigest,
      update_available: latestDigest !== m.digest,
    });
  }
  return report;
}

module.exports = { parseOllamaRef, buildUpdateReport };
