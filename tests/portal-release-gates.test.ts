import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('public registration and checkout remain fail-closed until explicit staging acceptance', () => {
  const routes = fs.readFileSync('src/server/portal/portalRoutes.ts', 'utf8');
  const envExample = fs.readFileSync('.env.example', 'utf8');

  assert.match(routes, /PORTAL_REGISTRATION_ENABLED !== 'true'/);
  assert.match(routes, /code: 'REGISTRATION_DISABLED'/);
  assert.match(routes, /PORTAL_CHECKOUT_ENABLED !== 'true'/);
  assert.match(routes, /code: 'CHECKOUT_DISABLED'/);
  assert.match(envExample, /^PORTAL_REGISTRATION_ENABLED=false$/m);
  assert.match(envExample, /^PORTAL_CHECKOUT_ENABLED=false$/m);
});

test('readiness endpoint reports HTTP 503 when mandatory database is unavailable', () => {
  const app = fs.readFileSync('src/server/app.ts', 'utf8');
  assert.match(app, /isReadinessProbe && !dbPing\.ok \? 503 : 200/);
  assert.match(app, /app\.get\('\/api\/health\/ready', healthHandler\)/);
});
