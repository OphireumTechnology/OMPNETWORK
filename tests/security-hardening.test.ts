import test from 'node:test';
import assert from 'node:assert/strict';
import { AdminAuthService } from '../src/server/auth';
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
  const crypto = require('node:crypto');
  const signature = crypto.createHmac('sha256', 'test-secret').update(expiredPayload).digest('base64url');
  assert.equal(service.verifySessionToken(`${expiredPayload}.${signature}`), null);
});
