import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const MIGRATIONS_DIR = path.resolve(process.cwd(), 'supabase/migrations');
const MIGRATION_FILES = [
  '000_baseline_core_schema.sql',
  '001_phase1_security_and_persistence.sql',
  '002_client_portal_commerce.sql',
  '003_enterprise_platform_expansion.sql',
  '004_reconciliation_hardening.sql',
];

async function bootstrapSupabaseFixtures(pg: PGlite) {
  await pg.exec(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOLOGIN;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOLOGIN;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        CREATE ROLE service_role NOLOGIN BYPASSRLS;
      END IF;
    END $$;

    CREATE SCHEMA IF NOT EXISTS auth;
    CREATE SCHEMA IF NOT EXISTS storage;
    CREATE SCHEMA IF NOT EXISTS extensions;

    CREATE TABLE IF NOT EXISTS auth.users (
      id UUID PRIMARY KEY,
      email TEXT UNIQUE
    );

    CREATE OR REPLACE FUNCTION auth.uid() RETURNS UUID
    LANGUAGE sql STABLE
    AS $$
      SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::UUID;
    $$;

    CREATE OR REPLACE FUNCTION auth.role() RETURNS TEXT
    LANGUAGE sql STABLE
    AS $$
      SELECT COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), current_user);
    $$;

    CREATE OR REPLACE FUNCTION auth.jwt() RETURNS JSONB
    LANGUAGE sql STABLE
    AS $$
      SELECT jsonb_build_object(
        'sub', NULLIF(current_setting('request.jwt.claim.sub', true), ''),
        'email', NULLIF(current_setting('request.jwt.claim.email', true), ''),
        'role', COALESCE(NULLIF(current_setting('request.jwt.claim.role', true), ''), current_user)
      );
    $$;

    CREATE TABLE IF NOT EXISTS storage.buckets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      public BOOLEAN NOT NULL DEFAULT false,
      file_size_limit BIGINT,
      allowed_mime_types TEXT[]
    );

    CREATE TABLE IF NOT EXISTS storage.objects (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      bucket_id TEXT NOT NULL REFERENCES storage.buckets(id),
      name TEXT NOT NULL,
      owner UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE OR REPLACE FUNCTION storage.foldername(name TEXT) RETURNS TEXT[]
    LANGUAGE sql IMMUTABLE
    AS $$
      SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1];
    $$;

    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

    GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
    GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
    GRANT USAGE ON SCHEMA storage TO anon, authenticated, service_role;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
    GRANT EXECUTE ON FUNCTION auth.role() TO anon, authenticated, service_role;
    GRANT EXECUTE ON FUNCTION auth.jwt() TO anon, authenticated, service_role;
    GRANT EXECUTE ON FUNCTION storage.foldername(TEXT) TO anon, authenticated, service_role;
    GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated, service_role;
  `);
}

describe('Real PostgreSQL 16 Migration Chain (000–004), RLS, Storage & Atomic RPC Verification', () => {
  let pg: PGlite;

  before(async () => {
    pg = new PGlite({ extensions: { uuid_ossp, pgcrypto } });
    await bootstrapSupabaseFixtures(pg);
  });

  after(async () => {
    await pg.close();
  });

  it('executes complete migration chain 000 -> 004 cleanly and verifies 004 idempotency', async () => {
    for (const file of MIGRATION_FILES) {
      const fullPath = path.join(MIGRATIONS_DIR, file);
      assert.ok(fs.existsSync(fullPath), `Migration missing: ${file}`);
      const sql = fs.readFileSync(fullPath, 'utf8');
      await pg.exec(sql);
    }

    // Re-run 004 to confirm idempotent upgrade compatibility
    const sql004 = fs.readFileSync(path.join(MIGRATIONS_DIR, '004_reconciliation_hardening.sql'), 'utf8');
    await pg.exec(sql004);

    const tablesRes = await pg.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
    );
    const names = new Set(tablesRes.rows.map((r) => r.table_name));
    assert.ok(names.size >= 38, `Expected >= 38 public tables, found ${names.size}`);

    for (const required of [
      'admin_users',
      'solution_requests',
      'consultation_appointments',
      'audit_logs',
      'admin_sessions',
      'profiles',
      'orders',
      'payments',
      'payment_reference_sequences',
      'subscriptions',
      'digital_entitlements',
      'ai_agents',
      'ai_agent_executions',
      'ai_knowledge_documents',
      'revoked_session_tokens',
      'distributed_rate_limit_buckets',
      'mfa_credentials',
      'mfa_recovery_codes',
      'background_jobs',
    ]) {
      assert.ok(names.has(required), `Missing required table: ${required}`);
    }
  });

  it('provisions all 6 private storage buckets with public = false and RLS policies', async () => {
    const res = await pg.query<{ id: string; public: boolean }>(
      `SELECT id, public FROM storage.buckets ORDER BY id`
    );
    const expected = [
      'business-documents',
      'customer-uploads',
      'digital-products',
      'invoices-pdf',
      'project-deliverables',
      'receipts-pdf',
    ];
    const actualBucketIds = res.rows.map((r) => r.id);
    for (const bucketId of expected) {
      assert.ok(actualBucketIds.includes(bucketId), `Missing private bucket: ${bucketId}`);
    }
    for (const row of res.rows) {
      assert.equal(row.public, false, `Bucket ${row.id} must be private`);
    }
  });

  it('enforces append-only audit logs (UPDATE and DELETE blocked by trigger)', async () => {
    await pg.query(
      `INSERT INTO public.audit_logs (actor, actor_role, action, entity_type, entity_id, details)
       VALUES ('system@test', 'super_admin', 'test_event', 'orders', 'ord-1', '{}'::jsonb)`
    );

    await assert.rejects(
      pg.query(`UPDATE public.audit_logs SET action = 'tampered' WHERE entity_id = 'ord-1'`),
      /append-only/i
    );
    await assert.rejects(
      pg.query(`DELETE FROM public.audit_logs WHERE entity_id = 'ord-1'`),
      /append-only/i
    );
  });

  it('enforces strict RLS tenant isolation between Customer A, Customer B, and anon across tables and storage', async () => {
    const userA = '11111111-1111-4111-8111-111111111111';
    const userB = '22222222-2222-4222-8222-222222222222';

    await pg.query(`INSERT INTO auth.users (id, email) VALUES ($1, 'a@client.test'), ($2, 'b@client.test')`, [
      userA,
      userB,
    ]);
    await pg.query(
      `INSERT INTO public.profiles (id, user_id, email, full_name) VALUES ($1, $1, 'a@client.test', 'Client A'), ($2, $2, 'b@client.test', 'Client B')`,
      [userA, userB]
    );
    await pg.query(
      `INSERT INTO public.orders (order_number, user_id, currency, payment_provider, subtotal_minor, total_minor, billing_details)
       VALUES
         ('OPM-ORD-A', $1, 'USD', 'xendit', 50000, 50000, '{"fullName":"Client A","email":"a@client.test"}'::jsonb),
         ('OPM-ORD-B', $2, 'USD', 'xendit', 90000, 90000, '{"fullName":"Client B","email":"b@client.test"}'::jsonb)`,
      [userA, userB]
    );
    await pg.query(
      `INSERT INTO storage.objects (bucket_id, name, owner)
       VALUES ('customer-uploads', $1::text || '/brief-a.pdf', $1::uuid), ('customer-uploads', $2::text || '/brief-b.pdf', $2::uuid)`,
      [userA, userB]
    );

    // Act as Customer A under ROLE authenticated
    await pg.exec('BEGIN');
    await pg.exec(`SET LOCAL ROLE authenticated`);
    await pg.exec(`SELECT set_config('request.jwt.claim.sub', '${userA}', true)`);
    await pg.exec(`SELECT set_config('request.jwt.claim.email', 'a@client.test', true)`);

    const aOrders = await pg.query<{ order_number: string }>(`SELECT order_number FROM public.orders`);
    assert.deepEqual(
      aOrders.rows.map((r) => r.order_number),
      ['OPM-ORD-A'],
      'Customer A must only see own orders'
    );

    const aFiles = await pg.query<{ name: string }>(
      `SELECT name FROM storage.objects WHERE bucket_id = 'customer-uploads'`
    );
    assert.deepEqual(
      aFiles.rows.map((r) => r.name),
      [`${userA}/brief-a.pdf`],
      'Customer A must only see own storage prefix'
    );

    // Anon / authenticated cannot execute privileged SECURITY DEFINER RPC
    await assert.rejects(
      pg.query(`SELECT public.allocate_ophireum_payment_ref(now())`),
      /permission denied/i
    );
    await pg.exec('ROLLBACK');

    // Act as anon: must not be able to read private orders, mfa_credentials, or revoked_session_tokens
    for (const table of ['public.orders', 'public.mfa_credentials', 'public.revoked_session_tokens']) {
      await pg.exec('BEGIN');
      await pg.exec(`SET LOCAL ROLE anon`);
      await assert.rejects(pg.query(`SELECT * FROM ${table}`), /permission denied/i);
      await pg.exec('ROLLBACK');
    }
  });

  it('hardens all SECURITY DEFINER functions with explicit search_path = public, pg_temp', async () => {
    const res = await pg.query<{ proname: string; proconfig: string[] | null }>(
      `SELECT p.proname, p.proconfig
       FROM pg_proc p
       JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.prosecdef = true`
    );
    assert.ok(res.rows.length >= 4, 'Expected at least 4 SECURITY DEFINER functions');
    for (const fn of res.rows) {
      const hasSafeSearchPath = (fn.proconfig || []).some((c) => c.startsWith('search_path=public'));
      assert.ok(hasSafeSearchPath, `Function ${fn.proname} missing safe search_path config`);
    }
  });

  it('allocates Asia/Manila MMDDYYYYHHMMAM/PMNNN payment references atomically, handles rollover, rollback, and exhaustion >999', async () => {
    // 2026-12-31 16:05 UTC == 2027-01-01 00:05 AM Asia/Manila (date & year rollover boundary!)
    const rolloverUtc = '2026-12-31T16:05:00Z';
    const r1 = await pg.query<{ ref: string }>(`SELECT public.allocate_ophireum_payment_ref($1::timestamptz) AS ref`, [
      rolloverUtc,
    ]);
    const r2 = await pg.query<{ ref: string }>(`SELECT public.allocate_ophireum_payment_ref($1::timestamptz) AS ref`, [
      rolloverUtc,
    ]);
    assert.equal(r1.rows[0].ref, '010120271205AM001');
    assert.equal(r2.rows[0].ref, '010120271205AM002');
    assert.match(r1.rows[0].ref, /^\d{12}(AM|PM)\d{3}$/);

    // Verify PM formatting (2026-06-15 05:30 UTC == 2026-06-15 01:30 PM Asia/Manila)
    const pmUtc = '2026-06-15T05:30:00Z';
    const pmRef = await pg.query<{ ref: string }>(`SELECT public.allocate_ophireum_payment_ref($1::timestamptz) AS ref`, [
      pmUtc,
    ]);
    assert.equal(pmRef.rows[0].ref, '061520260130PM001');

    // Verify transaction rollback reverts sequence allocation
    await pg.exec('BEGIN');
    const rolledRef = await pg.query<{ ref: string }>(
      `SELECT public.allocate_ophireum_payment_ref($1::timestamptz) AS ref`,
      [pmUtc]
    );
    assert.equal(rolledRef.rows[0].ref, '061520260130PM002');
    await pg.exec('ROLLBACK');

    const afterRollback = await pg.query<{ ref: string }>(
      `SELECT public.allocate_ophireum_payment_ref($1::timestamptz) AS ref`,
      [pmUtc]
    );
    assert.equal(afterRollback.rows[0].ref, '061520260130PM002');

    // Verify exhaustion above 999 raises PAYMENT_REF_MINUTE_SEQUENCE_EXHAUSTED
    await pg.query(
      `UPDATE public.payment_reference_sequences SET last_seq = 999 WHERE minute_bucket = '061520260130PM'`
    );
    await assert.rejects(
      pg.query(`SELECT public.allocate_ophireum_payment_ref($1::timestamptz)`, [pmUtc]),
      /PAYMENT_REF_MINUTE_SEQUENCE_EXHAUSTED/
    );
  });

  it('verifies distributed PostgreSQL rate limiter RPC and background job claim RPC', async () => {
    const k = 'bucket:ip:203.0.113.10';
    const c1 = await pg.query<{ allowed: boolean; current_hits: number; remaining: number }>(
      `SELECT * FROM public.check_and_increment_rate_limit($1, 60000, 2)`,
      [k]
    );
    const c2 = await pg.query<{ allowed: boolean; current_hits: number; remaining: number }>(
      `SELECT * FROM public.check_and_increment_rate_limit($1, 60000, 2)`,
      [k]
    );
    const c3 = await pg.query<{ allowed: boolean; current_hits: number; remaining: number }>(
      `SELECT * FROM public.check_and_increment_rate_limit($1, 60000, 2)`,
      [k]
    );

    assert.equal(c1.rows[0].allowed, true);
    assert.equal(c1.rows[0].current_hits, 1);
    assert.equal(c2.rows[0].allowed, true);
    assert.equal(c2.rows[0].current_hits, 2);
    assert.equal(c3.rows[0].allowed, false);
    assert.equal(c3.rows[0].remaining, 0);

    await pg.query(
      `INSERT INTO public.background_jobs (job_type, payload) VALUES ('email_retry', '{"batch":1}'::jsonb)`
    );
    const claimed = await pg.query<{ job_type: string; status: string }>(
      `SELECT job_type, status FROM public.claim_next_background_job('worker-a')`
    );
    assert.equal(claimed.rows.length, 1);
    assert.equal(claimed.rows[0].job_type, 'email_retry');
    assert.equal(claimed.rows[0].status, 'processing');
  });
});
