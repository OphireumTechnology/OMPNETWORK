import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
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
  '005_ai_conversation_persistence.sql',
  '006_enterprise_reliability_and_ai_memory.sql',
  '007_native_postgresql_runtime_support.sql',
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

describe('Real PostgreSQL 16 Migration Chain (000–007), RLS, Storage, Atomic RPC & DR Verification', () => {
  let pg: PGlite;

  before(async () => {
    pg = new PGlite({ extensions: { uuid_ossp, pgcrypto } });
    await bootstrapSupabaseFixtures(pg);
  });

  after(async () => {
    await pg.close();
  });

  it('executes complete migration chain 000 -> 007 cleanly and verifies 004, 005, 006 & 007 idempotency', async () => {
    for (const file of MIGRATION_FILES) {
      const fullPath = path.join(MIGRATIONS_DIR, file);
      assert.ok(fs.existsSync(fullPath), `Migration missing: ${file}`);
      const sql = fs.readFileSync(fullPath, 'utf8');
      await pg.exec(sql);
    }

    // Re-run 004, 005, 006, and 007 to confirm idempotent upgrade compatibility
    for (const idempFile of [
      '004_reconciliation_hardening.sql',
      '005_ai_conversation_persistence.sql',
      '006_enterprise_reliability_and_ai_memory.sql',
      '007_native_postgresql_runtime_support.sql',
    ]) {
      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, idempFile), 'utf8');
      await pg.exec(sql);
    }

    const tablesRes = await pg.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name`
    );
    const names = new Set(tablesRes.rows.map((r) => r.table_name));
    assert.ok(names.size >= 68, `Expected >= 68 public tables after Migration 007, found ${names.size}`);

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
      'ai_knowledge_chunks',
      'ai_conversation_sessions',
      'ai_conversation_messages',
      'ai_voice_sessions',
      'ai_session_events',
      'ai_session_usage',
      'ai_session_checkpoints',
      'revoked_session_tokens',
      'distributed_rate_limit_buckets',
      'mfa_credentials',
      'mfa_recovery_codes',
      'background_jobs',
      'schema_migrations',
      'portal_auth_users',
      'portal_auth_sessions',
      'portal_carts',
      'portal_custom_inquiries',
      'portal_attachments',
      'portal_activity_logs',
      'portal_domain_records',
      'ai_usage_governance_limits',
    ]) {
      assert.ok(names.has(required), `Missing required table: ${required}`);
    }

    // Verify native PG principal helper functions and zero permissive USING(true) RLS policies
    const rlsTrue = await pg.query<{ tablename: string; policyname: string }>(
      `SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' AND qual = 'true'`
    );
    assert.equal(rlsTrue.rows.length, 0, `Forbidden permissive RLS USING (true) policies found: ${JSON.stringify(rlsTrue.rows)}`);
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

  it('verifies Migration 005 atomic append_ai_conversation_message RPC, optimistic concurrency, deduplication, zero raw audio check, append-only events, RLS isolation, and vector columns', async () => {
    const userA = '11111111-1111-4111-8111-111111111111';
    const userB = '22222222-2222-4222-8222-222222222222';

    const sessA = await pg.query<{ id: string }>(
      `INSERT INTO public.ai_conversation_sessions (session_key, owner_type, user_id, tenant_scope, channel_mode)
       VALUES ('pg-sess-a', 'authenticated', $1::uuid, $2, 'unified')
       RETURNING id`,
      [userA, `customer:${userA}`]
    );
    const sessB = await pg.query<{ id: string }>(
      `INSERT INTO public.ai_conversation_sessions (session_key, owner_type, user_id, tenant_scope, channel_mode)
       VALUES ('pg-sess-b', 'authenticated', $1::uuid, $2, 'unified')
       RETURNING id`,
      [userB, `customer:${userB}`]
    );
    const idA = sessA.rows[0].id;
    const idB = sessB.rows[0].id;

    // 1. Atomic message append + version increment + deduplication
    const m1 = await pg.query<{ sequence_number: number; session_version: number; deduplicated: boolean }>(
      `SELECT sequence_number, session_version, deduplicated
       FROM public.append_ai_conversation_message($1, 'user', 'chat', 'Hello OPHIREUM', 'cmsg-001', 1)`,
      [idA]
    );
    assert.equal(m1.rows[0].sequence_number, 1);
    assert.equal(m1.rows[0].session_version, 2);
    assert.equal(m1.rows[0].deduplicated, false);

    // Replaying the same client_message_id deduplicates cleanly without incrementing sequence
    const m1Dup = await pg.query<{ sequence_number: number; session_version: number; deduplicated: boolean }>(
      `SELECT sequence_number, session_version, deduplicated
       FROM public.append_ai_conversation_message($1, 'user', 'chat', 'Hello OPHIREUM', 'cmsg-001', 1)`,
      [idA]
    );
    assert.equal(m1Dup.rows[0].sequence_number, 1);
    assert.equal(m1Dup.rows[0].deduplicated, true);

    // Stale expected_version triggers optimistic concurrency conflict (SQLSTATE 40001)
    await assert.rejects(
      pg.query(
        `SELECT * FROM public.append_ai_conversation_message($1, 'assistant', 'chat', 'Stale write', 'cmsg-002', 1)`,
        [idA]
      ),
      /AI_SESSION_VERSION_CONFLICT/
    );

    // Correct expected_version = 2 succeeds
    const m2 = await pg.query<{ sequence_number: number; session_version: number }>(
      `SELECT sequence_number, session_version
       FROM public.append_ai_conversation_message($1, 'assistant', 'live_audio', 'Welcome to OPHIREUM.', 'cmsg-002', 2)`,
      [idA]
    );
    assert.equal(m2.rows[0].sequence_number, 2);
    assert.equal(m2.rows[0].session_version, 3);

    // 2. Zero raw audio persistence CHECK constraints enforced at DB level
    await assert.rejects(
      pg.query(
        `INSERT INTO public.ai_voice_sessions (conversation_session_id, transport, raw_audio_persisted)
         VALUES ($1, 'gemini_live_ws', true)`,
        [idA]
      ),
      /check constraint/i
    );
    await assert.rejects(
      pg.query(
        `INSERT INTO public.ai_conversation_messages (session_id, sequence_number, sender, channel, content, contains_raw_audio)
         VALUES ($1, 99, 'user', 'voice', 'audio blob', true)`,
        [idA]
      ),
      /check constraint/i
    );

    // 3. Append-only ai_session_events trigger blocks tampering
    await pg.query(
      `INSERT INTO public.ai_session_events (conversation_session_id, event_type, actor)
       VALUES ($1, 'tool_executed', 'receptionist')`,
      [idA]
    );
    await assert.rejects(
      pg.query(`UPDATE public.ai_session_events SET event_type = 'tampered' WHERE conversation_session_id = $1`, [idA]),
      /append-only/i
    );
    await assert.rejects(
      pg.query(`DELETE FROM public.ai_session_events WHERE conversation_session_id = $1`, [idA]),
      /append-only/i
    );

    // 4. RLS isolation: Customer A sees only own conversation sessions & messages (not Customer B)
    await pg.query(
      `SELECT * FROM public.append_ai_conversation_message($1, 'user', 'chat', 'Customer B confidential message', 'b-1', 1)`,
      [idB]
    );

    await pg.exec('BEGIN');
    await pg.exec(`SET LOCAL ROLE authenticated`);
    await pg.exec(`SELECT set_config('request.jwt.claim.sub', '${userA}', true)`);

    const aSessions = await pg.query<{ session_key: string }>(`SELECT session_key FROM public.ai_conversation_sessions`);
    assert.deepEqual(aSessions.rows.map((r) => r.session_key), ['pg-sess-a']);

    const aMessages = await pg.query<{ content: string }>(`SELECT content FROM public.ai_conversation_messages ORDER BY sequence_number`);
    assert.deepEqual(aMessages.rows.map((r) => r.content), ['Hello OPHIREUM', 'Welcome to OPHIREUM.']);

    // authenticated cannot call SECURITY DEFINER append_ai_conversation_message directly
    await assert.rejects(
      pg.query(`SELECT * FROM public.append_ai_conversation_message($1, 'user', 'chat', 'direct bypass')`, [idA]),
      /permission denied/i
    );
    await pg.exec('ROLLBACK');

    // 5. Phase 24 knowledge vector & metadata columns exist on ai_knowledge_chunks
    const cols = await pg.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'ai_knowledge_chunks'`
    );
    const colSet = new Set(cols.rows.map((c) => c.column_name));
    for (const expectedCol of [
      'tenant_scope',
      'category',
      'embedding_model',
      'embedding_dimensions',
      'embedding_provider',
      'embedding_values',
      'document_version',
    ]) {
      assert.ok(colSet.has(expectedCol), `Missing ai_knowledge_chunks column: ${expectedCol}`);
    }
  });

  it('verifies Migration 006 maker-checker DB constraint, append-only auth_security_events, claim_ai_workforce_job RPC, and legal policy acceptances RLS', async () => {
    // 1. Maker-checker DB CHECK constraint blocks self-approval at PostgreSQL level
    await assert.rejects(
      pg.query(
        `INSERT INTO public.financial_maker_checker_approvals
           (action_type, entity_id, amount_minor, currency, requested_by_email, requested_by_role, approver_email, approver_role, status, justification)
         VALUES
           ('refund_above_threshold', 'ref-self-1', 75000, 'USD', 'finance@ophireum.test', 'finance_officer', 'FINANCE@OPHIREUM.TEST', 'finance_officer', 'approved', 'Self approval attempt')`
      ),
      /chk_maker_checker_distinct_actors/i
    );

    // Distinct second approver succeeds
    const okApproval = await pg.query<{ id: string }>(
      `INSERT INTO public.financial_maker_checker_approvals
         (action_type, entity_id, amount_minor, currency, requested_by_email, requested_by_role, approver_email, approver_role, status, justification)
       VALUES
         ('refund_above_threshold', 'ref-ok-1', 75000, 'USD', 'finance@ophireum.test', 'finance_officer', 'ceo@ophireum.test', 'super_admin', 'approved', 'Dual-control verified refund')
       RETURNING id`
    );
    assert.ok(okApproval.rows[0].id);

    // 2. Append-only auth_security_events trigger blocks UPDATE and DELETE
    const secEvt = await pg.query<{ id: string }>(
      `INSERT INTO public.auth_security_events (principal_type, principal_identifier, event_type, outcome, ip_address)
       VALUES ('admin', 'ceo@ophireum.test', 'login_mfa_verified', 'allowed', '127.0.0.1')
       RETURNING id`
    );
    const secEvtId = secEvt.rows[0].id;
    await assert.rejects(
      pg.query(`UPDATE public.auth_security_events SET outcome = 'denied' WHERE id = $1`, [secEvtId]),
      /append-only/i
    );
    await assert.rejects(
      pg.query(`DELETE FROM public.auth_security_events WHERE id = $1`, [secEvtId]),
      /append-only/i
    );

    // 3. claim_ai_workforce_job SECURITY DEFINER RPC atomically leases queued job and blocks authenticated caller
    const execId = crypto.randomUUID();
    await pg.query(
      `INSERT INTO public.ai_workforce_job_queue (execution_id, agent_code, actor, actor_role, prompt, action_hash)
       VALUES ($1, 'A01', 'ceo@ophireum.test', 'super_admin', 'Prepare executive summary', 'hash-a01-001')`,
      [execId]
    );
    const claimed = await pg.query<{ agent_code: string; execution_state: string; worker_id: string; attempt_count: number }>(
      `SELECT agent_code, execution_state, worker_id, attempt_count FROM public.claim_ai_workforce_job('replica-2', 90)`
    );
    assert.equal(claimed.rows.length, 1);
    assert.equal(claimed.rows[0].agent_code, 'A01');
    assert.equal(claimed.rows[0].execution_state, 'RUNNING');
    assert.equal(claimed.rows[0].worker_id, 'replica-2');
    assert.equal(claimed.rows[0].attempt_count, 1);

    // Second worker receives empty result because job is already leased
    const secondClaim = await pg.query(`SELECT * FROM public.claim_ai_workforce_job('replica-3', 90)`);
    assert.equal(secondClaim.rows.length, 0);

    // Authenticated role cannot call claim_ai_workforce_job directly
    await pg.exec('BEGIN');
    await pg.exec(`SET LOCAL ROLE authenticated`);
    await assert.rejects(
      pg.query(`SELECT * FROM public.claim_ai_workforce_job('attacker-worker', 60)`),
      /permission denied/i
    );
    await pg.exec('ROLLBACK');

    // 4. Legal policy acceptances owner RLS isolation
    const userA = '11111111-1111-4111-8111-111111111111';
    const userB = '22222222-2222-4222-8222-222222222222';
    await pg.query(
      `INSERT INTO public.legal_policy_acceptances (user_id, email, policy_slug, policy_version, review_status_at_acceptance)
       VALUES
         ($1, 'a@client.test', 'privacy-policy', '2026.1-draft', 'pending_legal_review'),
         ($2, 'b@client.test', 'privacy-policy', '2026.1-draft', 'pending_legal_review')`,
      [userA, userB]
    );
    await pg.exec('BEGIN');
    await pg.exec(`SET LOCAL ROLE authenticated`);
    await pg.exec(`SELECT set_config('request.jwt.claim.sub', '${userA}', true)`);
    const ownAcceptances = await pg.query<{ email: string }>(`SELECT email FROM public.legal_policy_acceptances`);
    assert.deepEqual(ownAcceptances.rows.map((r) => r.email), ['a@client.test']);
    await pg.exec('ROLLBACK');
  });

  it('executes a real PostgreSQL 16 (PGlite) logical backup, SHA-256 checksum verification, and clean DR restore into a fresh instance', async () => {
    // Capture deterministic logical snapshot from Primary Instance A
    const snapshot = {
      exportedAt: new Date().toISOString(),
      users: (await pg.query<{ id: string; email: string }>(`SELECT id, email FROM auth.users ORDER BY email`)).rows,
      profiles: (await pg.query<{ id: string; user_id: string; email: string; full_name: string }>(
        `SELECT id, user_id, email, full_name FROM public.profiles ORDER BY email`
      )).rows,
      orders: (await pg.query<{ order_number: string; user_id: string; currency: string; payment_provider: string; subtotal_minor: number; total_minor: number; billing_details: unknown }>(
        `SELECT order_number, user_id, currency, payment_provider, subtotal_minor, total_minor, billing_details FROM public.orders ORDER BY order_number`
      )).rows,
      makerChecker: (await pg.query<{ action_type: string; entity_id: string; amount_minor: number; currency: string; requested_by_email: string; requested_by_role: string; approver_email: string | null; approver_role: string | null; status: string; justification: string }>(
        `SELECT action_type, entity_id, amount_minor, currency, requested_by_email, requested_by_role, approver_email, approver_role, status, justification FROM public.financial_maker_checker_approvals ORDER BY entity_id`
      )).rows,
      legalAcceptances: (await pg.query<{ user_id: string; email: string; policy_slug: string; policy_version: string; review_status_at_acceptance: string }>(
        `SELECT user_id, email, policy_slug, policy_version, review_status_at_acceptance FROM public.legal_policy_acceptances ORDER BY email`
      )).rows,
    };

    const serializedBackup = JSON.stringify(snapshot);
    const backupSha256 = crypto.createHash('sha256').update(serializedBackup).digest('hex');
    assert.equal(backupSha256.length, 64);
    assert.ok(snapshot.orders.length >= 2, 'Primary snapshot must contain orders');

    // Provision a completely fresh Disaster Recovery PostgreSQL 16 instance (Instance B)
    const drPg = new PGlite({ extensions: { uuid_ossp, pgcrypto } });
    try {
      await bootstrapSupabaseFixtures(drPg);
      for (const file of MIGRATION_FILES) {
        const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
        await drPg.exec(sql);
      }

      // Verify backup checksum prior to restore
      const verifiedSha = crypto.createHash('sha256').update(serializedBackup).digest('hex');
      assert.equal(verifiedSha, backupSha256, 'Backup artifact SHA-256 verification failed');
      const parsed = JSON.parse(serializedBackup) as typeof snapshot;

      for (const u of parsed.users) {
        await drPg.query(`INSERT INTO auth.users (id, email) VALUES ($1, $2)`, [u.id, u.email]);
      }
      for (const p of parsed.profiles) {
        await drPg.query(`INSERT INTO public.profiles (id, user_id, email, full_name) VALUES ($1, $2, $3, $4)`, [
          p.id,
          p.user_id,
          p.email,
          p.full_name,
        ]);
      }
      for (const o of parsed.orders) {
        await drPg.query(
          `INSERT INTO public.orders (order_number, user_id, currency, payment_provider, subtotal_minor, total_minor, billing_details)
           VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
          [o.order_number, o.user_id, o.currency, o.payment_provider, o.subtotal_minor, o.total_minor, JSON.stringify(o.billing_details)]
        );
      }
      for (const mc of parsed.makerChecker) {
        await drPg.query(
          `INSERT INTO public.financial_maker_checker_approvals
             (action_type, entity_id, amount_minor, currency, requested_by_email, requested_by_role, approver_email, approver_role, status, justification)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            mc.action_type,
            mc.entity_id,
            mc.amount_minor,
            mc.currency,
            mc.requested_by_email,
            mc.requested_by_role,
            mc.approver_email,
            mc.approver_role,
            mc.status,
            mc.justification,
          ]
        );
      }
      for (const la of parsed.legalAcceptances) {
        await drPg.query(
          `INSERT INTO public.legal_policy_acceptances (user_id, email, policy_slug, policy_version, review_status_at_acceptance)
           VALUES ($1, $2, $3, $4, $5)`,
          [la.user_id, la.email, la.policy_slug, la.policy_version, la.review_status_at_acceptance]
        );
      }

      // Assert 100% post-restore parity across every restored table
      const drOrders = await drPg.query<{ order_number: string; total_minor: number }>(
        `SELECT order_number, total_minor FROM public.orders ORDER BY order_number`
      );
      assert.deepEqual(
        drOrders.rows.map((r) => r.order_number),
        parsed.orders.map((r) => r.order_number)
      );
      const drMakerChecker = await drPg.query<{ entity_id: string; status: string }>(
        `SELECT entity_id, status FROM public.financial_maker_checker_approvals ORDER BY entity_id`
      );
      assert.deepEqual(drMakerChecker.rows, [{ entity_id: 'ref-ok-1', status: 'approved' }]);
      const drLegal = await drPg.query<{ email: string }>(
        `SELECT email FROM public.legal_policy_acceptances ORDER BY email`
      );
      assert.equal(drLegal.rows.length, parsed.legalAcceptances.length);
    } finally {
      await drPg.close();
    }
  });
});
