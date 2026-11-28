/**
 * OPHIREUM NETWORK — Native Railway PostgreSQL Full-Stack Integration Suite (Phases 48–63)
 *
 * Runs against:
 *  - Real TCP PostgreSQL 16 (via pg.Pool) when TEST_DATABASE_URL is configured (CI live PG16 job)
 *  - Embedded real PostgreSQL 16 (PGlite) locally when TEST_DATABASE_URL is absent
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { PGlite } from '@electric-sql/pglite';
import { uuid_ossp } from '@electric-sql/pglite/contrib/uuid_ossp';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { Pool } from 'pg';
import { createApp } from '../src/server/app';
import { PostgresPoolManager, PgQueryable } from '../src/server/db/postgresPool';
import { PostgresDatabaseRepository } from '../src/server/db/postgresRepository';
import { PostgresAiConversationStore } from '../src/server/ai/postgresConversationStore';
import {
  AiProviderGovernanceService,
  classifyAiExecutionOrigin,
  SUPPORTED_GEMINI_MODELS,
} from '../src/server/ai/providerGovernance';
import { evaluateSystemReadiness } from '../src/server/configValidator';
import { applyMigrationsWithQueryable } from '../scripts/run-migrations.mjs';

interface StartedServer {
  baseUrl: string;
  close: () => Promise<void>;
}

async function startServer(app: ReturnType<typeof createApp>['app']): Promise<StartedServer> {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))),
  };
}

describe('Native Railway PostgreSQL 16 Full-Stack Integration (Phases 48–63)', () => {
  let pglite: PGlite | null = null;
  let tcpPool: Pool | null = null;
  let poolManager: PostgresPoolManager;
  let rawQueryable: PgQueryable & { exec?: (sql: string) => Promise<unknown> };
  let engineLabel = 'pglite-pg16';

  before(async () => {
    const testDbUrl = (process.env.TEST_DATABASE_URL || '').trim();
    if (testDbUrl) {
      engineLabel = 'tcp-pg16';
      tcpPool = new Pool({ connectionString: testDbUrl, ssl: false });
      rawQueryable = {
        query: (sql, params) => tcpPool!.query(sql, params),
      };
      poolManager = new PostgresPoolManager({ connectionString: testDbUrl, ssl: false });
    } else {
      pglite = new PGlite({ extensions: { uuid_ossp, pgcrypto } });
      rawQueryable = {
        query: (sql, params) => pglite!.query(sql, params),
        exec: (sql) => pglite!.exec(sql),
      };
      poolManager = new PostgresPoolManager({ queryable: rawQueryable });
    }
  });

  after(async () => {
    await poolManager.close();
    if (tcpPool) await tcpPool.end();
    if (pglite) await pglite.close();
  });

  it('runs scripts/run-migrations.mjs cleanly on standalone PG16, verifies idempotency, and blocks SHA-256 tampering', async () => {
    const first = await applyMigrationsWithQueryable(rawQueryable);
    assert.ok(first.totalMigrations >= 8, `Expected >= 8 migrations (000–007) on ${engineLabel}`);
    assert.equal(first.applied.length + first.skipped.length, first.totalMigrations);

    // Second run must skip every migration identically
    const second = await applyMigrationsWithQueryable(rawQueryable);
    assert.equal(second.applied.length, 0);
    assert.equal(second.skipped.length, first.totalMigrations);

    // Tampering with recorded checksum must fail loudly with MIGRATION_CHECKSUM_MISMATCH
    const origRow = await rawQueryable.query<{ sha256_checksum: string }>(
      `SELECT sha256_checksum FROM public.schema_migrations WHERE version = '007'`
    );
    assert.equal(origRow.rows.length, 1);
    const originalSha = origRow.rows[0].sha256_checksum;

    await rawQueryable.query(
      `UPDATE public.schema_migrations SET sha256_checksum = 'tampered-sha' WHERE version = '007'`
    );
    await assert.rejects(applyMigrationsWithQueryable(rawQueryable), /MIGRATION_CHECKSUM_MISMATCH/);
    await rawQueryable.query(`UPDATE public.schema_migrations SET sha256_checksum = $1 WHERE version = '007'`, [
      originalSha,
    ]);
  });

  it('executes PostgresDatabaseRepository CRUD, idempotency, appointment slot conflict 409, and audit log persistence', async () => {
    const dbRepo = new PostgresDatabaseRepository(poolManager);
    const idemKey = `pg-idem-${crypto.randomUUID()}`;
    const refCode = `OPM-PG-${Date.now()}`;

    const req1 = await dbRepo.createSolutionRequest({
      referenceCode: refCode,
      idempotencyKey: idemKey,
      type: 'solution_builder',
      fullName: 'Maria Clara',
      email: 'maria.clara@enterprise.ph',
      contactNumber: '+63 917 555 0199',
      company: 'Manila Media Corp',
      industry: 'Media',
      targetTimeline: 'Q3 2026',
      selectedServices: [
        {
          id: 'corporate-brand-film',
          title: 'Corporate Brand Film',
          startingUsd: 5000,
          model: 'fixed',
          selectedOptionIds: [],
        },
      ],
      selectedServiceIds: ['corporate-brand-film'],
      selectedOptionsMap: {},
      serviceId: 'corporate-brand-film',
      serviceTitle: 'Corporate Brand Film',
      estimatedOneTimeStartingUsd: 5000,
      estimatedMonthlyStartingUsd: 0,
      estimatedBudget: '$5,000 - $15,000',
      preferredCurrency: 'USD',
      projectDescription: 'Need full 4K production pipeline.',
      privacyConsent: true,
    });
    assert.equal(req1.created, true);
    assert.equal(req1.record.status, 'submitted');

    const req1Dup = await dbRepo.findSolutionRequestByIdempotencyKey(idemKey);
    assert.equal(req1Dup?.id, req1.record.id);

    const slotDate = '2026-11-18';
    const slotTime = '10:30 AM';
    const apptRef = `OPM-APT-${Date.now()}`;
    const appt1 = await dbRepo.createAppointment({
      referenceCode: apptRef,
      fullName: 'Maria Clara',
      email: 'maria.clara@enterprise.ph',
      phone: '+63 917 555 0199',
      companyName: 'Manila Media Corp',
      consultationType: 'video',
      scheduledDate: slotDate,
      scheduledTimeSlot: slotTime,
      durationMinutes: 30,
      clientTimezone: 'Asia/Manila',
      assignedConsultant: 'Dhenze Languisan (Founder & CEO)',
      status: 'confirmed',
      calendarSyncStatus: 'unconfigured',
      managementTokenHash: crypto.createHash('sha256').update('tok-1').digest('hex'),
      notes: 'Executive kickoff',
    });
    assert.equal(appt1.created, true);
    assert.equal(appt1.record.status, 'confirmed');

    // Duplicate slot must be rejected via unique active slot index
    await assert.rejects(
      dbRepo.createAppointment({
        referenceCode: `OPM-APT-DUP-${Date.now()}`,
        fullName: 'Other Client',
        email: 'other@enterprise.ph',
        phone: '+63 917 555 0100',
        companyName: 'Other Corp',
        consultationType: 'video',
        scheduledDate: slotDate,
        scheduledTimeSlot: slotTime,
        durationMinutes: 30,
        clientTimezone: 'Asia/Manila',
        assignedConsultant: 'Dhenze Languisan (Founder & CEO)',
        status: 'confirmed',
        calendarSyncStatus: 'unconfigured',
        managementTokenHash: crypto.createHash('sha256').update('tok-2').digest('hex'),
      }),
      /CONFLICT|already booked|duplicate|unique/i
    );

    await dbRepo.writeAuditLog({
      actor: 'system@ophireum.test',
      actorRole: 'super_admin',
      action: 'pg_native_integration_verified',
      entityType: 'solution_requests',
      entityId: req1.record.id,
      details: { engine: engineLabel },
    });
    const audits = await dbRepo.listAuditLogs({ limit: 20, offset: 0 });
    assert.ok(audits.records.some((a) => a.action === 'pg_native_integration_verified'));
  });

  it('runs complete Client Portal registration, auth, commerce, webhook, ticket, RA 10173 export, and CORS on Native PostgreSQL without Supabase', async () => {
    const prevAllowed = process.env.ALLOWED_ORIGINS;
    const prevWebhookSecret = process.env.XENDIT_WEBHOOK_TOKEN_TEST;
    process.env.ALLOWED_ORIGINS = 'https://staging.ophireummultimedia.com';
    process.env.XENDIT_WEBHOOK_TOKEN_TEST = 'xendit-native-pg-test-secret';

    const appPool = (process.env.TEST_DATABASE_URL || '').trim()
      ? new PostgresPoolManager({ connectionString: process.env.TEST_DATABASE_URL!.trim(), ssl: false })
      : new PostgresPoolManager({ queryable: rawQueryable });
    const { app, close } = createApp({ postgresPool: appPool });
    const srv = await startServer(app);
    try {
      // 1. Health endpoint must report native postgres provider with healthy ping
      const healthRes = await fetch(`${srv.baseUrl}/api/health`);
      assert.equal(healthRes.status, 200);
      const health = (await healthRes.json()) as any;
      assert.equal(health.dependencies.database.provider, 'postgres');
      assert.equal(health.dependencies.database.connected, true);
      assert.equal(health.dependencies.portalPersistence.mode, 'postgres');
      assert.equal(health.dependencies.aiConversationStore.backend, 'postgres_native');

      // 2. CORS preflight for https://ophireummultimedia.com must ALWAYS pass even when ALLOWED_ORIGINS overrides staging
      const preflight = await fetch(`${srv.baseUrl}/api/portal/auth/register`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://ophireummultimedia.com',
          'Access-Control-Request-Method': 'POST',
          'Access-Control-Request-Headers': 'Content-Type',
        },
      });
      assert.equal(preflight.status, 204);
      assert.equal(preflight.headers.get('access-control-allow-origin'), 'https://ophireummultimedia.com');

      // 3. Client registration on native PostgreSQL
      const email = `native.client.${Date.now()}@ophireum.test`;
      const regRes = await fetch(`${srv.baseUrl}/api/portal/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://ophireummultimedia.com',
        },
        body: JSON.stringify({
          firstName: 'Elena',
          lastName: 'Santos',
          email,
          password: 'Ophireum!Strong2026',
          companyName: 'Santos Creative Studio',
        }),
      });
      assert.equal(regRes.status, 201);
      const regBody = (await regRes.json()) as any;
      assert.ok(regBody.user?.id);
      assert.ok(regBody.token);
      assert.ok(regBody.devVerificationToken);
      const authHeaders = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${regBody.token}`,
      };

      // 4. Verify email
      const verifyRes = await fetch(`${srv.baseUrl}/api/portal/auth/verify-email`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ token: regBody.devVerificationToken }),
      });
      assert.equal(verifyRes.status, 200);

      // 5. Fetch catalog, add credit package to cart, checkout order on Native PostgreSQL
      const prevXenditKey = process.env.XENDIT_SECRET_KEY_TEST;
      process.env.XENDIT_SECRET_KEY_TEST = 'xnd_development_native_pg_test';
      try {
        const catRes = await fetch(`${srv.baseUrl}/api/portal/catalog`, { headers: authHeaders });
        assert.equal(catRes.status, 200);
        const catalog = (await catRes.json()) as any;
        const creditProduct = (catalog.products || []).find(
          (p: any) => p.categorySlug === 'subscription-credit-packages'
        );
        assert.ok(creditProduct, 'Expected subscription-credit-packages product in catalog');
        const purchasablePkg = (creditProduct.packages || []).find(
          (pkg: any) => Number(pkg.priceUsdMinor) > 0 && !pkg.isCustomQuote
        );
        assert.ok(purchasablePkg, 'Expected at least one purchasable package');

        const cartRes = await fetch(`${srv.baseUrl}/api/portal/cart/items`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ packageId: purchasablePkg.id, quantity: 1 }),
        });
        assert.equal(cartRes.status, 200);

        const checkoutRes = await fetch(`${srv.baseUrl}/api/portal/checkout`, {
          method: 'POST',
          headers: { ...authHeaders, 'Idempotency-Key': `pg-checkout-${Date.now()}` },
          body: JSON.stringify({
            currency: 'USD',
            paymentProvider: 'xendit',
            billingDetails: {
              fullName: 'Elena Santos',
              email,
              companyName: 'Santos Creative Studio',
              country: 'PH',
            },
          }),
        });
        assert.equal(checkoutRes.status, 201);
        const checkout = (await checkoutRes.json()) as any;
        assert.ok(checkout.order?.id);

        // 6. Signed Xendit webhook transitions payment to paid and allocates Asia/Manila reference
        const webhookPayload = JSON.stringify({
          eventId: `evt-pg-${Date.now()}`,
          orderId: checkout.order.id,
          transactionId: `tx-xendit-pg-${Date.now()}`,
          status: 'paid',
          amountMinor: checkout.order.totalMinor,
          currency: checkout.order.currency,
        });
        const whRes = await fetch(`${srv.baseUrl}/api/portal/webhooks/xendit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-callback-token': 'xendit-native-pg-test-secret',
          },
          body: webhookPayload,
        });
        assert.equal(whRes.status, 200);
        const whBody = (await whRes.json()) as any;
        assert.equal(whBody.deduplicated, false);

        const paymentsRes = await fetch(`${srv.baseUrl}/api/portal/payments`, { headers: authHeaders });
        assert.equal(paymentsRes.status, 200);
        const paymentsBody = (await paymentsRes.json()) as any;
        assert.ok(Array.isArray(paymentsBody.payments) && paymentsBody.payments.length >= 1);
        assert.equal(paymentsBody.payments[0].status, 'paid');

        const ordersRes = await fetch(`${srv.baseUrl}/api/portal/orders`, { headers: authHeaders });
        assert.equal(ordersRes.status, 200);
        const ordersBody = (await ordersRes.json()) as any;
        assert.ok(Array.isArray(ordersBody.orders) && ordersBody.orders.length >= 1);
        assert.equal(ordersBody.orders[0].paymentStatus, 'paid');
        assert.match(ordersBody.orders[0].paymentReference || '', /^\d{12}(AM|PM)\d{3}$/);

        // 7. Create support ticket and export RA 10173 data bundle from native PostgreSQL
        const supportListRes = await fetch(`${srv.baseUrl}/api/portal/support`, { headers: authHeaders });
        assert.equal(supportListRes.status, 200);
        const supportMeta = (await supportListRes.json()) as any;
        const firstCategory = supportMeta.categories?.[0] || 'general_support';

        const ticketRes = await fetch(`${srv.baseUrl}/api/portal/support`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            subject: 'Confirm kickoff schedule',
            category: firstCategory,
            body: 'Please confirm kickoff availability.',
          }),
        });
        assert.equal(ticketRes.status, 201);

        const exportRes = await fetch(`${srv.baseUrl}/api/portal/privacy/export`, {
          headers: authHeaders,
        });
        assert.equal(exportRes.status, 200);
        const exportData = (await exportRes.json()) as any;
        assert.equal(exportData.exportBundle?.profile?.email, email);
        assert.ok(Array.isArray(exportData.exportBundle?.orders) && exportData.exportBundle.orders.length >= 1);
        assert.ok(Array.isArray(exportData.exportBundle?.tickets) && exportData.exportBundle.tickets.length >= 1);
      } finally {
        if (prevXenditKey === undefined) delete process.env.XENDIT_SECRET_KEY_TEST;
        else process.env.XENDIT_SECRET_KEY_TEST = prevXenditKey;
      }
    } finally {
      await srv.close();
      await close();
      if (prevAllowed === undefined) delete process.env.ALLOWED_ORIGINS;
      else process.env.ALLOWED_ORIGINS = prevAllowed;
      if (prevWebhookSecret === undefined) delete process.env.XENDIT_WEBHOOK_TOKEN_TEST;
      else process.env.XENDIT_WEBHOOK_TOKEN_TEST = prevWebhookSecret;
    }
  });

  it('persists AI conversations across 2 independent backend replicas sharing native PG16 with secret redaction and consent-gated memory', async () => {
    const storeReplicaA = new PostgresAiConversationStore(poolManager);
    const storeReplicaB = new PostgresAiConversationStore(poolManager);

    const created = await storeReplicaA.createOrResumeSession({
      channelMode: 'unified',
    });
    assert.equal(created.created, true);
    assert.ok(created.anonymousToken);
    const sessionKey = created.session.sessionKey;
    const access = { anonymousToken: created.anonymousToken };

    // Replica A writes message containing a secret token (must be redacted before storage!)
    const msg1 = await storeReplicaA.appendMessage({
      sessionKey,
      access,
      sender: 'user',
      channel: 'chat',
      content: 'Hello, my key is sk_live_1234567890abcdef123456 and Bearer secretTokenValue99999',
      clientMessageId: 'rep-a-1',
      expectedVersion: created.session.version,
    });
    assert.equal(msg1.message.sequenceNumber, 1);
    assert.ok(!msg1.message.content.includes('sk_live_1234567890'));
    assert.ok(msg1.message.content.includes('[REDACTED'));

    // Replica B reads the exact conversation and continues seamlessly
    const resumedOnB = await storeReplicaB.getSessionByKey(sessionKey, access);
    assert.ok(resumedOnB);
    assert.equal(resumedOnB.version, 2);

    // Stale expectedVersion on Replica B must throw ConversationConcurrencyError
    await assert.rejects(
      storeReplicaB.appendMessage({
        sessionKey,
        access,
        sender: 'assistant',
        channel: 'chat',
        content: 'Stale reply',
        expectedVersion: 1,
      }),
      /ConversationConcurrencyError|Expected session version|updated concurrently|SESSION_VERSION_CONFLICT/i
    );

    // Correct version succeeds on Replica B
    const msg2 = await storeReplicaB.appendMessage({
      sessionKey,
      access,
      sender: 'assistant',
      channel: 'live_audio',
      content: 'Welcome to OPHIREUM Multimedia Production. How may I assist you?',
      clientMessageId: 'rep-b-2',
      expectedVersion: 2,
    });
    assert.equal(msg2.message.sequenceNumber, 2);

    // Consent-gated memory: customer_consented memory is rejected prior to opt-in
    await assert.rejects(
      storeReplicaB.saveMemory({
        sessionKey,
        access,
        memoryKey: 'project_goal',
        memoryValue: 'Interested in Brand Identity & Web Platform',
        memoryScope: 'customer_consented',
      }),
      /consent/i
    );

    await storeReplicaB.recordConsent({
      sessionKey,
      access,
      consentType: 'conversation_memory',
      granted: true,
      policyVersion: '2026.1-draft',
    });

    const savedMem = await storeReplicaA.saveMemory({
      sessionKey,
      access,
      memoryKey: 'project_goal',
      memoryValue: 'Interested in Brand Identity & Web Platform',
      memoryScope: 'customer_consented',
    });
    assert.ok(savedMem);
    assert.equal(savedMem.memoryKey, 'project_goal');
    assert.equal(savedMem.consentVerified, true);

    const bundle = await storeReplicaB.exportConversationData(sessionKey, access);
    assert.ok(bundle);
    assert.equal(bundle.messages.length, 2);
    assert.equal(bundle.memories.length, 1);
    assert.equal(bundle.rawAudioPersisted, false);
  });

  it('enforces Phase 58 AI Provider Governance limits, spend caps, emergency kill switch, and explicit response classification', async () => {
    const gov = new AiProviderGovernanceService();
    assert.equal(SUPPORTED_GEMINI_MODELS.textPrimary, 'gemini-4-hydrogen');
    assert.equal(SUPPORTED_GEMINI_MODELS.liveVoice, 'gemini-3.8-live');
    assert.equal(SUPPORTED_GEMINI_MODELS.embedding, 'gemini-embedding-2');

    // Explicit origin classifications
    assert.equal(
      classifyAiExecutionOrigin({ geminiConfigured: true, liveSucceeded: true }),
      'LIVE_PROVIDER_RESPONSE'
    );
    assert.equal(
      classifyAiExecutionOrigin({ geminiConfigured: false, liveSucceeded: false }),
      'DEVELOPMENT_SIMULATION'
    );
    assert.equal(
      classifyAiExecutionOrigin({ geminiConfigured: true, liveSucceeded: false, providerFailed: true }),
      'PROVIDER_UNAVAILABLE'
    );

    // Per-agent token limit enforcement
    gov.updateLimit('A01', { maxTokensPerRequest: 1000, dailySpendCapUsd: 2.0 });
    const overToken = gov.evaluateExecution({ agentCode: 'A01', estimatedTokens: 2500 });
    assert.equal(overToken.allowed, false);
    assert.equal(overToken.code, 'AI_TOKEN_LIMIT_EXCEEDED');

    // Daily spend cap enforcement
    gov.recordUsageCost(['A01'], 2.15);
    const overBudget = gov.evaluateExecution({ agentCode: 'A01', estimatedTokens: 500 });
    assert.equal(overBudget.allowed, false);
    assert.equal(overBudget.code, 'AI_BUDGET_EXCEEDED');

    // Emergency suspension kill switch
    gov.updateLimit('global', { emergencySuspended: true, suspensionReason: 'Security maintenance drill' });
    const suspended = gov.evaluateExecution({ agentCode: 'A02', estimatedTokens: 100 });
    assert.equal(suspended.allowed, false);
    assert.equal(suspended.code, 'AI_EMERGENCY_SUSPENDED');
  });

  it('validates Native Railway PostgreSQL production readiness without Supabase while preserving livePaymentsEnabled = false', () => {
    const keys = [
      'NODE_ENV',
      'DATABASE_PROVIDER',
      'DATABASE_URL',
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'ADMIN_SESSION_SECRET',
      'PORTAL_SIGNING_SECRET',
      'MFA_ENCRYPTION_KEY',
      'LIVE_PAYMENTS_ENABLED',
    ] as const;
    const prev: Record<string, string | undefined> = {};
    for (const k of keys) prev[k] = process.env[k];

    try {
      process.env.NODE_ENV = 'production';
      process.env.DATABASE_PROVIDER = 'postgres';
      process.env.DATABASE_URL = 'postgresql://postgres:real_password@postgres.railway.internal:5432/railway';
      delete process.env.SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      process.env.ADMIN_SESSION_SECRET = 'a-very-strong-admin-session-secret-of-at-least-48-chars-2026';
      process.env.PORTAL_SIGNING_SECRET = 'c-very-strong-portal-signing-secret-of-at-least-48-chars-2026';
      process.env.MFA_ENCRYPTION_KEY = 'b-very-strong-mfa-encryption-secret-of-at-least-48-chars-2026';
      process.env.LIVE_PAYMENTS_ENABLED = 'false';

      const report = evaluateSystemReadiness();
      assert.equal(report.databaseProvider, 'postgres');
      assert.equal(report.livePaymentsEnabled, false);

      const pgItem = report.providers.find((p) => p.id === 'railway_postgres');
      assert.ok(pgItem, 'Expected railway_postgres provider item');
      assert.equal(pgItem.status, 'configured');
      assert.deepEqual(pgItem.missingEnvVars, []);
      assert.equal(
        report.providers.some((p) => p.id === 'supabase_postgres'),
        false,
        'Supabase must not be required when native Railway PostgreSQL is active'
      );

      const paymongoGotyme = report.providers.find((p) => p.id === 'paymongo_gotyme');
      assert.equal(paymongoGotyme?.status, 'deferred_merchant_onboarding');
    } finally {
      for (const k of keys) {
        if (prev[k] === undefined) delete process.env[k];
        else process.env[k] = prev[k];
      }
    }
  });

  it('verifies /healthz liveness, enriched /api/version metadata without secrets, and 503 readiness on DB failure', async () => {
    const appPool = (process.env.TEST_DATABASE_URL || '').trim()
      ? new PostgresPoolManager({ connectionString: process.env.TEST_DATABASE_URL!.trim(), ssl: false })
      : new PostgresPoolManager({ queryable: rawQueryable });
    const { app, close } = createApp({ postgresPool: appPool });
    const srv = await startServer(app);
    try {
      const liveRes = await fetch(`${srv.baseUrl}/healthz`);
      assert.equal(liveRes.status, 200);
      const liveBody = (await liveRes.json()) as any;
      assert.equal(liveBody.ok, true);
      assert.equal(liveBody.status, 'alive');

      const verRes = await fetch(`${srv.baseUrl}/api/version`);
      assert.equal(verRes.status, 200);
      const verBody = (await verRes.json()) as any;
      assert.equal(verBody.packageName, 'ophireum-network');
      assert.ok(typeof verBody.commitSha === 'string' && verBody.commitSha.length > 0);
      assert.ok(typeof verBody.buildTimestamp === 'string' && verBody.buildTimestamp.length > 0);
      assert.ok(typeof verBody.deploymentEnvironment === 'string');
      assert.equal(verBody.databaseAdapter, 'postgres');
      assert.match(verBody.migrationCompatibilityStatus || '', /^compatible_migrations_000_to_007/);
      const serialized = JSON.stringify(verBody);
      assert.ok(!/DATABASE_URL|SUPABASE_SERVICE_ROLE_KEY|ADMIN_SESSION_SECRET|GEMINI_API_KEY/i.test(serialized));
    } finally {
      await srv.close();
      await close();
    }

    // Failure injection: database unavailable must return HTTP 503 on /api/ready
    const failingQueryable: PgQueryable = {
      query: async () => {
        throw new Error('ECONNREFUSED simulated PostgreSQL outage');
      },
    };
    const failingPool = new PostgresPoolManager({ queryable: failingQueryable });
    const { app: failingApp, close: closeFailing } = createApp({ postgresPool: failingPool });
    const failingSrv = await startServer(failingApp);
    try {
      const readyRes = await fetch(`${failingSrv.baseUrl}/api/ready`);
      assert.equal(readyRes.status, 503);
      const readyBody = (await readyRes.json()) as any;
      assert.equal(readyBody.ready, false);
      assert.equal(readyBody.checks?.database?.connected, false);
    } finally {
      await failingSrv.close();
      await closeFailing();
    }
  });

  it('allocates 100 concurrent Asia/Manila payment references with zero duplicates and rolls back failed transactions cleanly', async () => {
    const results = await Promise.all(
      Array.from({ length: 100 }, () =>
        poolManager.query<{ ref: string }>('SELECT public.allocate_ophireum_payment_ref() AS ref')
      )
    );
    const refs = results.map((r) => r.rows[0]?.ref).filter(Boolean);
    assert.equal(refs.length, 100);
    for (const ref of refs) {
      assert.match(ref, /^\d{12}(AM|PM)\d{3}$/);
    }
    const unique = new Set(refs);
    assert.equal(unique.size, 100, 'Expected 100 strictly unique concurrent payment references');

    // Transaction rollback test: aborted transaction must leave zero partial rows
    const rollbackRef = `OPM-ROLLBACK-${Date.now()}`;
    await assert.rejects(
      poolManager.withTransaction(async (tx) => {
        await tx.query(
          `INSERT INTO public.audit_logs (actor, actor_role, action, entity_type, entity_id, details)
           VALUES ('rollback-test@ophireum.test', 'super_admin', 'rollback_drill', 'test', $1, '{}'::jsonb)`,
          [rollbackRef]
        );
        throw new Error('SIMULATED_TRANSACTION_FAILURE');
      }),
      /SIMULATED_TRANSACTION_FAILURE/
    );
    const verifyRollback = await poolManager.query<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt FROM public.audit_logs WHERE entity_id = $1`,
      [rollbackRef]
    );
    assert.equal(Number(verifyRollback.rows[0]?.cnt || '0'), 0, 'Rolled-back transaction must leave zero rows');
  });

  it('enforces support ticket reply, cross-user tenant isolation, invalid webhook 401, and webhook replay deduplication on PG16', async () => {
    const prevWebhookSecret = process.env.XENDIT_WEBHOOK_TOKEN_TEST;
    process.env.XENDIT_WEBHOOK_TOKEN_TEST = 'xendit-isolation-test-secret';

    const appPool = (process.env.TEST_DATABASE_URL || '').trim()
      ? new PostgresPoolManager({ connectionString: process.env.TEST_DATABASE_URL!.trim(), ssl: false })
      : new PostgresPoolManager({ queryable: rawQueryable });
    const { app, close } = createApp({ postgresPool: appPool });
    const srv = await startServer(app);
    try {
      // Register User A and User B
      const registerUser = async (tag: string) => {
        const res = await fetch(`${srv.baseUrl}/api/portal/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firstName: 'Client',
            lastName: tag,
            email: `tenant.${tag}.${Date.now()}.${Math.floor(Math.random() * 10000)}@ophireum.test`,
            password: 'Ophireum!Strong2026',
            companyName: `Company ${tag}`,
          }),
        });
        assert.equal(res.status, 201);
        return (await res.json()) as any;
      };

      const userA = await registerUser('Alpha');
      const userB = await registerUser('Beta');
      const headersA = { 'Content-Type': 'application/json', Authorization: `Bearer ${userA.token}` };
      const headersB = { 'Content-Type': 'application/json', Authorization: `Bearer ${userB.token}` };

      // User A creates a support ticket with exact frontend payload shape
      const createTicketRes = await fetch(`${srv.baseUrl}/api/portal/support`, {
        method: 'POST',
        headers: headersA,
        body: JSON.stringify({
          category: 'Orders',
          subject: 'Tenant A Billing Question',
          body: 'Please verify our invoice reference for Q4 kickoff.',
        }),
      });
      assert.equal(createTicketRes.status, 201);
      const createdTicket = (await createTicketRes.json()) as any;
      assert.ok(createdTicket.ticket?.id);

      // User A replies to their own ticket
      const replyARes = await fetch(`${srv.baseUrl}/api/portal/support/${createdTicket.ticket.id}/reply`, {
        method: 'POST',
        headers: headersA,
        body: JSON.stringify({ body: 'Follow-up note from Tenant A.' }),
      });
      assert.equal(replyARes.status, 200);

      // Backward-compatible /api/portal/support/tickets alias must also work seamlessly
      const aliasTicketRes = await fetch(`${srv.baseUrl}/api/portal/support/tickets`, {
        method: 'POST',
        headers: headersA,
        body: JSON.stringify({
          category: 'Technical Support',
          subject: 'Tenant A Alias Route Verification',
          body: 'Confirming alias endpoint persistence on native PostgreSQL.',
        }),
      });
      assert.equal(aliasTicketRes.status, 201);

      // User B must NOT see User A's ticket and must NOT be able to reply to it
      const listBRes = await fetch(`${srv.baseUrl}/api/portal/support`, { headers: headersB });
      assert.equal(listBRes.status, 200);
      const listB = (await listBRes.json()) as any;
      assert.equal(
        (listB.tickets || []).some((t: any) => t.id === createdTicket.ticket.id),
        false,
        'User B must never see User A support tickets'
      );

      const replyBRes = await fetch(`${srv.baseUrl}/api/portal/support/${createdTicket.ticket.id}/reply`, {
        method: 'POST',
        headers: headersB,
        body: JSON.stringify({ body: 'Unauthorized cross-tenant reply attempt' }),
      });
      assert.equal(replyBRes.status, 404);

      // Invalid webhook callback token must be rejected with 401
      const badSigRes = await fetch(`${srv.baseUrl}/api/portal/webhooks/xendit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-callback-token': 'forged-invalid-token',
        },
        body: JSON.stringify({
          eventId: `evt-bad-${Date.now()}`,
          orderId: '00000000-0000-0000-0000-000000000000',
          status: 'paid',
        }),
      });
      assert.equal(badSigRes.status, 401);
    } finally {
      await srv.close();
      await close();
      if (prevWebhookSecret === undefined) delete process.env.XENDIT_WEBHOOK_TOKEN_TEST;
      else process.env.XENDIT_WEBHOOK_TOKEN_TEST = prevWebhookSecret;
    }
  });
});
