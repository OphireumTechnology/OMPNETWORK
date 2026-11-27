#!/usr/bin/env node
/**
 * OPHIREUM NETWORK — Release Integrity Manifest & Runtime SBOM Generator
 *
 * Emits dist/release-sbom-manifest.json containing:
 *  - Package identity, version, and Node engine constraints
 *  - SHA-256 checksums for compiled frontend/backend bundles and SQL migrations (000–007)
 *  - Resolved runtime dependency inventory from package-lock.json
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const lockPath = path.join(ROOT, 'package-lock.json');
const lock = fs.existsSync(lockPath) ? JSON.parse(fs.readFileSync(lockPath, 'utf8')) : { packages: {} };

function sha256File(absPath) {
  if (!fs.existsSync(absPath)) return null;
  const buf = fs.readFileSync(absPath);
  return {
    bytes: buf.length,
    sha256: crypto.createHash('sha256').update(buf).digest('hex'),
  };
}

const migrationsDir = path.join(ROOT, 'supabase/migrations');
const migrationFiles = fs
  .readdirSync(migrationsDir)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((file) => {
    const abs = path.join(migrationsDir, file);
    return {
      file: `supabase/migrations/${file}`,
      ...sha256File(abs),
    };
  });

const runtimeDependencies = Object.entries(pkg.dependencies || {})
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, range]) => {
    const lockEntry = lock.packages?.[`node_modules/${name}`];
    return {
      name,
      declaredRange: range,
      resolvedVersion: lockEntry?.version || null,
      license: lockEntry?.license || null,
      integrity: lockEntry?.integrity || null,
    };
  });

const artifacts = [
  'dist/index.html',
  'dist/server/index.mjs',
  'railway.json',
].map((relPath) => ({
  file: relPath,
  ...sha256File(path.join(ROOT, relPath)),
}));

const manifest = {
  schema: 'ophireum-release-sbom-v1',
  generatedAt: new Date().toISOString(),
  application: {
    name: pkg.name,
    version: pkg.version,
    nodeEngine: pkg.engines?.node || '>=22 <23',
    commitSha:
      process.env.GITHUB_SHA ||
      process.env.RAILWAY_GIT_COMMIT_SHA ||
      'local-workspace',
  },
  artifacts,
  migrations: migrationFiles,
  runtimeDependencies,
  runtimeDependencyCount: runtimeDependencies.length,
};

fs.mkdirSync(path.join(ROOT, 'dist'), { recursive: true });
const outPath = path.join(ROOT, 'dist/release-sbom-manifest.json');
fs.writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

console.log(
  JSON.stringify({
    ok: true,
    output: 'dist/release-sbom-manifest.json',
    version: pkg.version,
    runtimeDependencies: runtimeDependencies.length,
    migrationsHashed: migrationFiles.length,
  })
);
