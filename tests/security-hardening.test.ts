/*
Copyright (c) 2026 Ophireum Multimedia Production. All rights reserved.
Developer and claimed rights holder: Ophireum Multimedia Production
DTI-registered business, Philippines | Registration No. 7567003
SPDX-FileCopyrightText: 2026 Ophireum Multimedia Production
SPDX-License-Identifier: LicenseRef-Ophireum-Proprietary
Third-party materials, dependencies, and separately licensed components remain subject to their respective rights and licenses.
*/

import test from 'node:test';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { AdminAuthService } from '../src/server/auth';
import { SupabaseDatabaseRepository } from '../src/server/db/supabaseRepository';
import type { DatabaseRepository, AdminUserRecord } from '../src/server/db/types';

const activeAdmin: AdminUserRecord = {
  id: 'admin-123',
  email: 'admin@example.com',
  fullName: 'Test Admin',
  role: 'admin',
  isActive: true,
};

function fakeDb(record: AdminUserRecord | null): DatabaseRepository {
  return {
    findActiveAdminByEmail: async () => record,
    verifySupabaseUserToken: async () => null,
  } as unknown as DatabaseRepository;
}

test('signed admin session is accepted only when subject, email and role match active principal', async () => {
  const service = new AdminAuthService(fakeDb(activeAdmin), 'test-secret-that-is-long-enough');
  const token = service.issueSessionToken(activeAdmin);
  const result = await service.resolveAuthenticatedPrincipal({
    headers: { authorization: `Bearer ${token}` },
  } as any);
  assert.equal(result.adminUser?.id, activeAdmin.id);
});

test('signed admin session cannot survive account replacement with same email', async () => {
  const service = new AdminAuthService(fakeDb({ ...activeAdmin, id: 'replacement-id' }), 'test-secret');
  const token = service.issueSessionToken(activeAdmin);
  const result = await service.resolveAuthenticatedPrincipal({
    headers: { authorization: `Bearer ${token}` },
  } as any);
  assert.equal(result.authenticated, true);
  assert.equal(result.adminUser, undefined);
});

test('signed admin session is invalidated after role downgrade', async () => {
  const service = new AdminAuthService(fakeDb({ ...activeAdmin, role: 'admin' }), 'test-secret');
  const elevatedToken = service.issueSessionToken({ ...activeAdmin, role: 'super_admin' });
  const result = await service.resolveAuthenticatedPrincipal({
    headers: { authorization: `Bearer ${elevatedToken}` },
  } as any);
  assert.equal(result.adminUser, undefined);
});

test('malformed and expired session claims are rejected', () => {
  const service = new AdminAuthService(fakeDb(activeAdmin), 'test-secret');
  assert.equal(service.verifySessionToken('not-a-token'), null);
  const expiredPayload = Buffer.from(JSON.stringify({
    sub: activeAdmin.id, email: activeAdmin.email, role: 'admin', exp: 1,
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', 'test-secret').update(expiredPayload).digest('base64url');
  assert.equal(service.verifySessionToken(`${expiredPayload}.${signature}`), null);
});


test('ephemeral fallback session secret is not reported as production-configured', () => {
  const previous = process.env.ADMIN_SESSION_SECRET;
  delete process.env.ADMIN_SESSION_SECRET;
  try {
    const service = new AdminAuthService(fakeDb(null));
    assert.equal(service.isSessionSecretConfigured(), false);
  } finally {
    if (previous === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = previous;
  }
});

test('explicit stable session secret is reported as configured', () => {
  const service = new AdminAuthService(fakeDb(null), '0123456789abcdef0123456789abcdef');
  assert.equal(service.isSessionSecretConfigured(), true);
});


test('Supabase administrator access requires an exact verified Auth UUID binding', async () => {
  const supabaseUser = { id: 'auth-uuid-verified', email: 'admin@example.com' };
  let requestedAuthUserId: string | undefined;
  const matchingDb = {
    findActiveAdminByEmail: async (_email: string, authUserId?: string) => {
      requestedAuthUserId = authUserId;
      return { ...activeAdmin, authUserId: 'auth-uuid-verified' };
    },
    verifySupabaseUserToken: async () => supabaseUser,
  } as unknown as DatabaseRepository;

  const service = new AdminAuthService(matchingDb, 'test-secret-that-is-long-enough');
  const accepted = await service.resolveAuthenticatedPrincipal({
    headers: { authorization: 'Bearer verified-supabase-jwt' },
  } as any);
  assert.equal(requestedAuthUserId, supabaseUser.id);
  assert.equal(accepted.adminUser?.authUserId, supabaseUser.id);

  const mismatchedDb = {
    findActiveAdminByEmail: async (_email: string, authUserId?: string) => {
      requestedAuthUserId = authUserId;
      // Same email, different Auth UUID: account replacement must not inherit access.
      return { ...activeAdmin, authUserId: 'attacker-replacement-uuid' };
    },
    verifySupabaseUserToken: async () => supabaseUser,
  } as unknown as DatabaseRepository;
  const denied = await new AdminAuthService(mismatchedDb, 'test-secret-that-is-long-enough')
    .resolveAuthenticatedPrincipal({
      headers: { authorization: 'Bearer verified-supabase-jwt' },
    } as any);
  assert.equal(requestedAuthUserId, supabaseUser.id);
  assert.equal(denied.authenticated, true);
  assert.equal(denied.adminUser, undefined);
});

test('Supabase administrator access rejects records without an Auth UUID binding', async () => {
  const db = {
    findActiveAdminByEmail: async () => activeAdmin,
    verifySupabaseUserToken: async () => ({ id: 'auth-uuid-verified', email: activeAdmin.email }),
  } as unknown as DatabaseRepository;
  const result = await new AdminAuthService(db, 'test-secret-that-is-long-enough')
    .resolveAuthenticatedPrincipal({
      headers: { authorization: 'Bearer verified-supabase-jwt' },
    } as any);
  assert.equal(result.adminUser, undefined);
});

test('bootstrap credentials require an explicitly configured email and sufficiently strong password', () => {
  const previousEmail = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const previousPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  try {
    process.env.ADMIN_BOOTSTRAP_EMAIL = ' Bootstrap.Admin@example.com ';
    process.env.ADMIN_BOOTSTRAP_PASSWORD = 'correct-horse-battery-staple';
    const service = new AdminAuthService(fakeDb(null), 'test-secret-that-is-long-enough');
    assert.equal(service.isBootstrapLoginConfigured(), true);
    assert.equal(service.verifyBootstrapCredentials('bootstrap.admin@example.com', 'correct-horse-battery-staple'), true);
    assert.equal(service.verifyBootstrapCredentials('bootstrap.admin@example.com', 'incorrect-password'), false);
    assert.equal(service.verifyBootstrapCredentials('other@example.com', 'correct-horse-battery-staple'), false);

    process.env.ADMIN_BOOTSTRAP_PASSWORD = 'short';
    assert.equal(service.isBootstrapLoginConfigured(), false);
    assert.equal(service.verifyBootstrapCredentials('bootstrap.admin@example.com', 'short'), false);
    delete process.env.ADMIN_BOOTSTRAP_EMAIL;
    assert.equal(service.isBootstrapLoginConfigured(), false);
  } finally {
    if (previousEmail === undefined) delete process.env.ADMIN_BOOTSTRAP_EMAIL;
    else process.env.ADMIN_BOOTSTRAP_EMAIL = previousEmail;
    if (previousPassword === undefined) delete process.env.ADMIN_BOOTSTRAP_PASSWORD;
    else process.env.ADMIN_BOOTSTRAP_PASSWORD = previousPassword;
  }
});

test('schema and forward migration authorize RLS administrators by Auth UUID only', () => {
  const schema = fs.readFileSync(path.resolve('supabase/schema.sql'), 'utf8');
  const initialMigration = fs.readFileSync(
    path.resolve('supabase/migrations/001_phase1_security_and_persistence.sql'),
    'utf8'
  );
  const forwardMigration = fs.readFileSync(
    path.resolve('supabase/migrations/20261124_uuid_bound_admin_rls.sql'),
    'utf8'
  );

  for (const sql of [schema, initialMigration, forwardMigration]) {
    assert.ok(sql.includes('au.auth_user_id = auth.uid()'));
    assert.ok(!sql.includes("auth.jwt() ->> 'email'"));
    assert.ok(!sql.toLowerCase().includes('lower(au.email)'));
  }
  assert.ok(forwardMigration.includes('REVOKE ALL ON FUNCTION public.is_ophireum_admin() FROM PUBLIC'));
  assert.ok(forwardMigration.includes('GRANT EXECUTE ON FUNCTION public.is_ophireum_admin() TO authenticated, service_role'));
});


test('Supabase repository filters administrator rows by exact Auth UUID and normalized email', async () => {
  const repository = new SupabaseDatabaseRepository(
    'https://example.supabase.co',
    'test-service-role-key'
  );
  const filters: Array<[string, unknown]> = [];
  const query = {
    select() { return this; },
    eq(column: string, value: unknown) { filters.push([column, value]); return this; },
    async maybeSingle() {
      return {
        data: {
          id: 'admin-row-1',
          auth_user_id: 'auth-uuid-verified',
          email: 'admin@example.com',
          full_name: 'Test Admin',
          role: 'admin',
          is_active: true,
        },
        error: null,
      };
    },
  };
  (repository as any).client = { from: (table: string) => {
    assert.equal(table, 'admin_users');
    return query;
  } };

  const result = await repository.findActiveAdminByEmail(' ADMIN@example.com ', 'auth-uuid-verified');
  assert.equal(result?.authUserId, 'auth-uuid-verified');
  assert.deepEqual(filters, [
    ['is_active', true],
    ['auth_user_id', 'auth-uuid-verified'],
    ['email', 'admin@example.com'],
  ]);
});

test('server email allowlist cannot satisfy a Supabase Auth UUID lookup', async () => {
  const previousAllowlist = process.env.ADMIN_ALLOWLIST_EMAILS;
  const previousBootstrapEmail = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const previousUrl = process.env.SUPABASE_URL;
  const previousViteUrl = process.env.VITE_SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  try {
    process.env.ADMIN_ALLOWLIST_EMAILS = 'admin@example.com';
    process.env.ADMIN_BOOTSTRAP_EMAIL = 'admin@example.com';
    delete process.env.SUPABASE_URL;
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const repository = new SupabaseDatabaseRepository();
    const result = await repository.findActiveAdminByEmail('admin@example.com', 'auth-uuid-verified');
    assert.equal(result, null);
  } finally {
    if (previousAllowlist === undefined) delete process.env.ADMIN_ALLOWLIST_EMAILS;
    else process.env.ADMIN_ALLOWLIST_EMAILS = previousAllowlist;
    if (previousBootstrapEmail === undefined) delete process.env.ADMIN_BOOTSTRAP_EMAIL;
    else process.env.ADMIN_BOOTSTRAP_EMAIL = previousBootstrapEmail;
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousViteUrl === undefined) delete process.env.VITE_SUPABASE_URL;
    else process.env.VITE_SUPABASE_URL = previousViteUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
  }
});
