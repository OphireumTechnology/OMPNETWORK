#!/usr/bin/env node
/**
 * OPHIREUM NETWORK — Production Compiled Server Startup & Smoke Verification
 *
 * Verifies:
 *  1. Compiled production artifacts exist (dist/server/index.mjs & dist/index.html)
 *  2. Fail-closed production boot: NODE_ENV=production without Supabase MUST exit non-zero
 *  3. Compiled dist/server/index.mjs starts cleanly, serves /api/health, /api/ready,
 *     /api/version, 404 JSON on unknown API routes, compiled frontend HTML on /, and
 *     shuts down cleanly (exit code 0) on SIGTERM.
 */

import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import net from 'node:net';

const ROOT = process.cwd();
const SERVER_BUNDLE = path.resolve(ROOT, 'dist/server/index.mjs');
const FRONTEND_INDEX = path.resolve(ROOT, 'dist/index.html');

function assert(condition, message) {
  if (!condition) {
    throw new Error(`PROD_SMOKE_FAILED: ${message}`);
  }
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 4199;
      srv.close(() => resolve(port));
    });
  });
}

async function waitForHealth(baseUrl, timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) {
        return await res.json();
      }
    } catch {
      // retry until server binds
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Timed out waiting for ${baseUrl}/api/health after ${timeoutMs}ms`);
}

async function testFailClosedProductionBoot() {
  const port = await getFreePort();
  const child = spawn(process.execPath, [SERVER_BUNDLE], {
    cwd: ROOT,
    env: {
      PATH: process.env.PATH || '',
      NODE_ENV: 'production',
      PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  const exitCode = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error('Fail-closed production boot test timed out (server unexpectedly stayed alive)'));
    }, 8000);
    child.on('exit', (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });

  assert(
    exitCode !== 0,
    `Expected non-zero exit when starting NODE_ENV=production without Supabase credentials, got exit code ${exitCode}`
  );
  assert(
    /SUPABASE|PRODUCTION|FATAL|required/i.test(stderr),
    `Expected explicit fail-closed startup diagnostic on stderr, got: ${stderr.slice(0, 300)}`
  );
}

async function testCompiledRuntimeAndGracefulShutdown() {
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, [SERVER_BUNDLE], {
    cwd: ROOT,
    env: {
      ...process.env,
      NODE_ENV: 'staging_smoke',
      PORT: String(port),
      ADMIN_BOOTSTRAP_EMAIL: 'smoke-admin@ophireum.test',
      ADMIN_BOOTSTRAP_PASSWORD: 'OphireumSmokePassword!2026',
      ADMIN_SESSION_SECRET: 'ophireum-smoke-session-secret-0123456789abcdef',
      MFA_ENCRYPTION_KEY: 'ophireum-smoke-mfa-encryption-key-0123456789abcdef',
      SUPABASE_URL: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  try {
    const health = await waitForHealth(baseUrl);
    assert(health && typeof health === 'object', 'Health response must be JSON object');
    assert(
      ['healthy', 'degraded', 'unconfigured'].includes(health.status),
      `Unexpected /api/health status: ${health.status}`
    );
    assert(health.dependencies && typeof health.dependencies === 'object', 'Health must include dependencies');
    assert(health.circuitBreakers && typeof health.circuitBreakers === 'object', 'Health must include circuitBreakers');

    const livenessRes = await fetch(`${baseUrl}/healthz`);
    assert(livenessRes.status === 200, `/healthz expected 200, got ${livenessRes.status}`);
    const livenessBody = await livenessRes.json();
    assert(livenessBody.ok === true && livenessBody.status === 'alive', '/healthz must return ok:true and status:alive');

    const readyRes = await fetch(`${baseUrl}/api/ready`);
    const readyBody = await readyRes.json();
    assert([200, 503].includes(readyRes.status), `Unexpected /api/ready HTTP status: ${readyRes.status}`);
    assert(typeof readyBody.ready === 'boolean', '/api/ready must expose boolean ready flag');

    const versionRes = await fetch(`${baseUrl}/api/version`);
    assert(versionRes.status === 200, `/api/version expected 200, got ${versionRes.status}`);
    const versionBody = await versionRes.json();
    assert(versionBody.packageName === 'ophireum-network', `Unexpected /api/version packageName: ${versionBody.packageName}`);
    assert(typeof versionBody.commitSha === 'string', '/api/version missing commitSha');
    assert(typeof versionBody.buildTimestamp === 'string', '/api/version missing buildTimestamp');
    assert(typeof versionBody.databaseAdapter === 'string', '/api/version missing databaseAdapter');
    assert(
      typeof versionBody.migrationCompatibilityStatus === 'string',
      '/api/version missing migrationCompatibilityStatus'
    );
    assert(typeof versionBody.nodeVersion === 'string', '/api/version missing nodeVersion');

    const notFoundRes = await fetch(`${baseUrl}/api/nonexistent-smoke-route`);
    assert(notFoundRes.status === 404, `Unknown /api route expected 404, got ${notFoundRes.status}`);

    const htmlRes = await fetch(`${baseUrl}/`);
    assert(htmlRes.status === 200, `Compiled SPA root expected 200, got ${htmlRes.status}`);
    const html = await htmlRes.text();
    assert(/<div id="root">/i.test(html), 'Compiled SPA HTML missing #root container');

    // Graceful SIGTERM shutdown verification
    const shutdownCode = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error('Compiled server did not shut down cleanly within 5s of SIGTERM'));
      }, 5000);
      child.on('exit', (code) => {
        clearTimeout(timer);
        resolve(code);
      });
      child.kill('SIGTERM');
    });

    assert(
      shutdownCode === 0,
      `Expected clean exit code 0 on SIGTERM, got ${shutdownCode}. stderr: ${stderr.slice(0, 300)}`
    );
  } catch (err) {
    child.kill('SIGKILL');
    throw err;
  }
}

async function main() {
  assert(fs.existsSync(SERVER_BUNDLE), `Missing compiled backend bundle: ${SERVER_BUNDLE}. Run npm run build:server first.`);
  assert(fs.existsSync(FRONTEND_INDEX), `Missing compiled frontend index: ${FRONTEND_INDEX}. Run npm run build first.`);

  await testFailClosedProductionBoot();
  await testCompiledRuntimeAndGracefulShutdown();

  console.log(
    JSON.stringify({
      ok: true,
      check: 'prod_smoke_check',
      serverBundle: path.relative(ROOT, SERVER_BUNDLE),
      frontendIndex: path.relative(ROOT, FRONTEND_INDEX),
      failClosedVerified: true,
      gracefulShutdownVerified: true,
    })
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
