import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Supabase production portal authentication is backed by Auth, Resend, PostgreSQL profiles and durable sessions', () => {
  const repository = fs.readFileSync('src/server/portal/supabasePortalRepository.ts', 'utf8');
  const routes = fs.readFileSync('src/server/portal/portalRoutes.ts', 'utf8');
  const app = fs.readFileSync('src/server/app.ts', 'utf8');
  const migration = fs.readFileSync('supabase/migrations/003_portal_auth_sessions.sql', 'utf8');
  const commerceMigration = fs.readFileSync('supabase/migrations/002_client_portal_commerce.sql', 'utf8');

  assert.match(repository, /auth\.admin\.generateLink\(\{/);
  assert.match(repository, /type: 'signup'/);
  assert.match(repository, /new ResendEmailTransport\(\)/);
  assert.match(repository, /from\('profiles'\)\.insert/);
  assert.match(repository, /auth\.signInWithPassword\(/);
  assert.match(repository, /from\('portal_auth_sessions'\)\.insert/);
  assert.match(repository, /from\('portal_auth_sessions'\)\.select/);
  assert.match(repository, /from\('portal_auth_sessions'\)\.update/);
  assert.match(routes, /requiresEmailVerification: true/);
  assert.match(routes, /repo\.authenticateUser\(email, password\)/);
  assert.match(routes, /setPortalSessionCookie\(res, rawSessionToken\)/);
  assert.match(app, /Production Client Portal requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(commerceMigration, /ALTER TABLE public\.profiles ENABLE ROW LEVEL SECURITY/);
  assert.match(commerceMigration, /auth\.uid\(\) = user_id/);
  assert.match(migration, /ALTER TABLE public\.portal_auth_sessions ENABLE ROW LEVEL SECURITY/);
  assert.match(migration, /GRANT SELECT ON TABLE public\.portal_auth_sessions TO authenticated/);
  assert.match(migration, /auth\.uid\(\)\) = user_id/);
  assert.match(migration, /REVOKE ALL ON TABLE public\.portal_auth_sessions FROM PUBLIC, anon, authenticated/);
});
