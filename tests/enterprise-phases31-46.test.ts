import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { Server } from 'node:http';
import { createApp } from '../src/server/app';
import { LocalPortalRepository } from '../src/server/portal/localPortalRepository';
import {
  CircuitBreaker,
  withTimeout,
  retryWithJitter,
  redactSensitiveText,
} from '../src/server/resilience';
import { buildTokenBudgetedContext } from '../src/server/ai/conversationService';
import {
  PaymentGatewayRegistry,
  validateWebhookTimestampWindow,
} from '../src/server/portal/payments/paymentAdapters';
import { InMemoryTestDatabase } from './_testDb';

describe('Phases 31–46: Enterprise Reliability, Privacy-Aware AI Memory, Financial Governance, RAG Quarantine & Workforce Queue', () => {
  let server: Server;
  let baseUrl: string;
  let db: InMemoryTestDatabase;
  let portalRepo: LocalPortalRepository;
  let createdApp: ReturnType<typeof createApp>;
  let ceoToken: string;
  let financeToken: string;
  const origXenditSecret = process.env.XENDIT_WEBHOOK_SECRET;

  before(async () => {
    process.env.XENDIT_WEBHOOK_SECRET = 'phase34-xendit-webhook-secret';
    db = new InMemoryTestDatabase();
    portalRepo = new LocalPortalRepository({ persistDir: null });

    // Seed a distinct second finance officer to verify dual-control maker-checker workflows
    db.admins.push({
      id: 'adm-finance-2',
      email: 'finance2@ophireum.test',
      fullName: 'Second Finance Officer',
      role: 'finance_officer',
      isActive: true,
    });

    createdApp = createApp({ db, portalRepo });
    const ceoAdmin = db.admins.find((a) => a.email === 'ceo@ophireum.test')!;
    const financeAdmin = db.admins.find((a) => a.email === 'finance2@ophireum.test')!;
    ceoToken = createdApp.authService.issueSessionToken(ceoAdmin, 3600, true);
    financeToken = createdApp.authService.issueSessionToken(financeAdmin, 3600, true);

    await new Promise<void>((resolve) => {
      server = createdApp.app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        const port = typeof addr === 'object' && addr ? addr.port : 0;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (origXenditSecret === undefined) delete process.env.XENDIT_WEBHOOK_SECRET;
    else process.env.XENDIT_WEBHOOK_SECRET = origXenditSecret;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('Phase 31: verifies CircuitBreaker state machine, withTimeout, retryWithJitter, redactSensitiveText, and /api/health, /api/ready, /api/version', async () => {
    // Circuit breaker: CLOSED -> OPEN -> HALF_OPEN -> CLOSED
    const cb = new CircuitBreaker('test_provider', {
      failureThreshold: 2,
      cooldownMs: 500,
    });
    assert.equal(cb.getSnapshot().state, 'CLOSED');
    await assert.rejects(() => cb.execute(async () => { throw new Error('err1'); }));
    await assert.rejects(() => cb.execute(async () => { throw new Error('err2'); }));
    assert.equal(cb.getSnapshot().state, 'OPEN');

    await assert.rejects(
      () => cb.execute(async () => 'blocked'),
      /circuit open/i
    );

    // Advance virtual time past cooldownMs to verify HALF_OPEN transition, then recover to CLOSED
    const futureMs = Date.now() + 600;
    assert.equal(cb.getState(futureMs), 'HALF_OPEN');
    cb.recordSuccess();
    assert.equal(cb.getSnapshot().state, 'CLOSED');

    // Timeout enforcement
    await assert.rejects(
      () => withTimeout(new Promise((r) => setTimeout(r, 250)), 50, 'slow_op'),
      /timed out/i
    );

    // Retry with jitter succeeds on 3rd attempt
    let attempts = 0;
    const retryResult = await retryWithJitter(
      async () => {
        attempts += 1;
        if (attempts < 3) throw new Error('transient');
        return 'ok-after-retry';
      },
      { maxAttempts: 3, baseDelayMs: 10, maxDelayMs: 25 }
    );
    assert.equal(retryResult, 'ok-after-retry');
    assert.equal(attempts, 3);

    // Sensitive text redaction
    const redaction = redactSensitiveText(
      'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.signature123456 card 4111-1111-1111-1111 password=SuperSecret99!'
    );
    assert.ok(redaction.findingsCount >= 3);
    assert.ok(!redaction.redactedText.includes('eyJhbGciOiJIUzI1NiJ9'), 'JWT must be redacted');
    assert.ok(!redaction.redactedText.includes('4111-1111-1111-1111'), 'Card PAN must be redacted');
    assert.ok(!redaction.redactedText.includes('SuperSecret99!'), 'Password value must be redacted');
    assert.ok(redaction.redactedText.includes('[REDACTED'));

    // Health, Ready, Version endpoints
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    const health = await healthRes.json();
    assert.ok(['healthy', 'degraded'].includes(health.status));
    assert.ok(health.circuitBreakers.supabase);
    assert.ok(health.circuitBreakers.gemini);

    const versionRes = await fetch(`${baseUrl}/api/version`);
    assert.equal(versionRes.status, 200);
    const version = await versionRes.json();
    assert.equal(version.packageName, 'ophireum-network');
    assert.ok(version.nodeVersion.startsWith('v'));
  });

  it('Phase 32: redacts secrets in AI conversations, enforces consent-gated memory, builds token-budgeted context, and exports RA 10173 portability bundle', async () => {
    const chatRes = await fetch(`${baseUrl}/api/consultant/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userMessage: 'My test card is 4111-1111-1111-1111 and api_key=sk_live_secret1234567890, can you build a corporate portal?',
        language: 'en-US',
      }),
    });
    assert.equal(chatRes.status, 200);
    const chatBody = await chatRes.json();
    assert.ok(chatBody.sessionId);
    assert.ok(chatBody.sessionToken);

    // Export conversation bundle and verify secrets were redacted before persistence
    const exportRes = await fetch(`${baseUrl}/api/consultant/session/${chatBody.sessionId}/export`, {
      headers: { 'x-session-token': chatBody.sessionToken },
    });
    assert.equal(exportRes.status, 200);
    const exportBody = await exportRes.json();
    assert.equal(exportBody.success, true);
    const serializedExport = JSON.stringify(exportBody.export);
    assert.ok(!serializedExport.includes('4111-1111-1111-1111'), 'PAN must never persist raw in conversation export');
    assert.ok(!serializedExport.includes('sk_live_secret1234567890'), 'API key must never persist raw in conversation export');

    // Consent-gated memory: customer_consented memory rejected before consent
    assert.ok(createdApp.conversationStore.saveMemory);
    await assert.rejects(
      () =>
        createdApp.conversationStore.saveMemory!({
          sessionKey: chatBody.sessionId,
          access: { anonymousToken: chatBody.sessionToken },
          memoryKey: 'preferred_stack',
          memoryValue: 'React + PostgreSQL',
          memoryScope: 'customer_consented',
        }),
      /consent/i
    );

    // Record explicit consent via API
    const consentRes = await fetch(`${baseUrl}/api/consultant/session/${chatBody.sessionId}/consent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-session-token': chatBody.sessionToken,
      },
      body: JSON.stringify({
        consentType: 'conversation_memory',
        granted: true,
        policyVersion: '2026.1',
      }),
    });
    assert.equal(consentRes.status, 201);
    const consentBody = await consentRes.json();
    assert.equal(consentBody.success, true);
    assert.equal(consentBody.consent.granted, true);

    // Now customer_consented memory succeeds and redacts any embedded secret
    const savedMem = await createdApp.conversationStore.saveMemory!({
      sessionKey: chatBody.sessionId,
      access: { anonymousToken: chatBody.sessionToken },
      memoryKey: 'preferred_stack',
      memoryValue: 'React + PostgreSQL password=DoNotStoreThis99',
      memoryScope: 'customer_consented',
    });
    assert.equal(savedMem.consentVerified, true);
    assert.ok(!savedMem.memoryValueRedacted.includes('DoNotStoreThis99'));

    // Token-budgeted context respects maxTokens and bounds messages cleanly
    const listed = await createdApp.conversationStore.listMessages(chatBody.sessionId, {
      anonymousToken: chatBody.sessionToken,
    });
    assert.ok(listed);
    const ctx = buildTokenBudgetedContext(listed.messages, { maxTokens: 350 });
    assert.ok(ctx.estimatedTokens <= 350);
    assert.ok(ctx.messages.length >= 1);
  });

  it('Phase 34: enforces strict rawBody webhook verification, timestamp replay window, unmatched reconciliation queue, and dual-control maker-checker approvals', async () => {
    // 1. Adapter rejects missing rawBody directly
    const registry = new PaymentGatewayRegistry();
    const xendit = registry.getAdapter('xendit');
    const missingRaw = xendit.verifyWebhook(
      { 'x-callback-token': 'phase34-xendit-webhook-secret' },
      '',
      { id: 'evt-empty' }
    );
    assert.equal(missingRaw.verified, false);
    assert.match(missingRaw.error || '', /raw/i);

    // 2. Replay timestamp window rejects stale timestamps (>5 min old)
    const staleSeconds = String(Math.floor(Date.now() / 1000) - 900);
    const staleCheck = validateWebhookTimestampWindow({ 'x-webhook-timestamp': staleSeconds });
    assert.equal(staleCheck.ok, false);
    assert.match(staleCheck.error || '', /replay|outside/i);

    const freshSeconds = String(Math.floor(Date.now() / 1000));
    assert.equal(validateWebhookTimestampWindow({ 'x-webhook-timestamp': freshSeconds }).ok, true);

    // 3. Unmatched Xendit webhook enters payment reconciliation queue
    const unmatchedRes = await fetch(`${baseUrl}/api/portal/webhooks/xendit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-callback-token': 'phase34-xendit-webhook-secret',
      },
      body: JSON.stringify({
        id: 'evt-unmatched-999',
        external_id: 'OPM-NONEXISTENT-ORDER',
        status: 'PAID',
        amount: 250,
        currency: 'USD',
      }),
    });
    assert.equal(unmatchedRes.status, 422);
    const unmatchedBody = await unmatchedRes.json();
    assert.equal(unmatchedBody.code, 'PAYMENT_RECONCILIATION_MISMATCH');

    const reconRes = await fetch(`${baseUrl}/api/admin/payments/reconciliation`, {
      headers: { Authorization: `Bearer ${ceoToken}` },
    });
    assert.equal(reconRes.status, 200);
    const reconBody = await reconRes.json();
    assert.ok(
      reconBody.records.some((r: { providerEventId: string }) => r.providerEventId === 'evt-unmatched-999'),
      'Unmatched webhook must be logged into reconciliation queue'
    );

    // 4. Maker-checker blocks self-approval (403) and permits distinct second approver (200)
    const createMcRes = await fetch(`${baseUrl}/api/admin/payments/maker-checker`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ceoToken}`,
      },
      body: JSON.stringify({
        actionType: 'refund_above_threshold',
        entityId: 'refund-high-value-001',
        amountMinor: 120000,
        currency: 'USD',
        justification: 'Client requested full project cancellation before phase 2',
      }),
    });
    assert.equal(createMcRes.status, 201);
    const createMcBody = await createMcRes.json();
    const approvalId = createMcBody.approval.id;

    // Same actor tries to self-approve -> HTTP 403
    const selfApproveRes = await fetch(`${baseUrl}/api/admin/payments/maker-checker/${approvalId}/decide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ceoToken}`,
      },
      body: JSON.stringify({ decision: 'approved', decisionNote: 'Self-approve attempt' }),
    });
    assert.equal(selfApproveRes.status, 403);

    // Second distinct finance officer approves -> HTTP 200
    const dualApproveRes = await fetch(`${baseUrl}/api/admin/payments/maker-checker/${approvalId}/decide`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${financeToken}`,
      },
      body: JSON.stringify({ decision: 'approved', decisionNote: 'Verified against invoice and ledger' }),
    });
    assert.equal(dualApproveRes.status, 200);
    const dualBody = await dualApproveRes.json();
    assert.equal(dualBody.approval.status, 'approved');
    assert.equal(dualBody.approval.approverEmail, 'finance2@ophireum.test');
  });

  it('Phase 36: exposes explicit RetrievalMode diagnostics, auto-quarantines sensitive secrets, and blocks quarantined docs from retrieval', async () => {
    // Ingest a document containing a payment card & private key -> auto-quarantined!
    const ingestRes = await fetch(`${baseUrl}/api/ai/knowledge/documents`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ceoToken}`,
      },
      body: JSON.stringify({
        title: 'Leaked Credentials Draft',
        category: 'sop',
        tenantScope: 'ophireum_internal',
        content: 'Internal memo containing card 4111-1111-1111-1111 and -----BEGIN PRIVATE KEY----- secret block',
        autoApprove: true,
      }),
    });
    assert.equal(ingestRes.status, 201);
    const ingestBody = await ingestRes.json();
    assert.equal(ingestBody.document.quarantined, true, 'Sensitive document must be automatically quarantined');
    assert.equal(ingestBody.document.status, 'quarantined');

    // Search with explicit diagnostics must return explicit RetrievalMode and never return quarantined doc
    const searchRes = await fetch(`${baseUrl}/api/ai/knowledge/search?q=Leaked%20Credentials%20Draft&tenantScope=ophireum_internal`, {
      headers: { Authorization: `Bearer ${ceoToken}` },
    });
    assert.equal(searchRes.status, 200);
    const searchBody = await searchRes.json();
    assert.ok(
      ['LIVE_SEMANTIC_RETRIEVAL', 'DEGRADED_KEYWORD_RETRIEVAL', 'LOCAL_DEVELOPMENT_FALLBACK', 'PROVIDER_UNAVAILABLE'].includes(
        searchBody.retrievalMode
      ),
      `Unexpected retrievalMode: ${searchBody.retrievalMode}`
    );
    assert.ok(
      !searchBody.hits.some((h: { documentId: string }) => h.documentId === ingestBody.document.id),
      'Quarantined document must never be returned by knowledge retrieval'
    );
  });

  it('Phase 37: verifies explicit WorkforceExecutionState, job leasing, retry scheduling, and dead-letter queue transitions', async () => {
    const enqueueRes = await fetch(`${baseUrl}/api/ai/jobs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ceoToken}`,
      },
      body: JSON.stringify({
        agentCode: 'A01',
        prompt: 'Analyze Q4 enterprise pipeline conversion metrics',
      }),
    });
    assert.equal(enqueueRes.status, 202);
    const { job } = await enqueueRes.json();
    assert.equal(job.executionState, 'QUEUED');

    // Claim job via worker 1
    const claimed = createdApp.workforceService.claimNextJob('worker-node-1');
    assert.ok(claimed);
    assert.equal(claimed.id, job.id);
    assert.equal(claimed.executionState, 'RUNNING');
    assert.equal(claimed.attemptCount, 1);

    // Exhaust retries to force dead-letter transition using deterministic clock advancement
    const retry1 = createdApp.workforceService.failOrRetryJob(job.id, 'Transient Gemini timeout');
    assert.equal(retry1.job?.executionState, 'RETRY_SCHEDULED');
    const c2 = createdApp.workforceService.claimNextJob('worker-node-2', 60, Date.now() + 10_000);
    assert.equal(c2?.attemptCount, 2);
    const retry2 = createdApp.workforceService.failOrRetryJob(job.id, 'Second timeout');
    assert.equal(retry2.job?.executionState, 'RETRY_SCHEDULED');
    const c3 = createdApp.workforceService.claimNextJob('worker-node-3', 60, Date.now() + 20_000);
    assert.equal(c3?.attemptCount, 3);
    const failedFinal = createdApp.workforceService.failOrRetryJob(job.id, 'Exhausted retries');
    assert.equal(failedFinal.job?.executionState, 'FAILED');
    assert.ok(failedFinal.deadLetter);

    const jobsRes = await fetch(`${baseUrl}/api/ai/jobs`, {
      headers: { Authorization: `Bearer ${ceoToken}` },
    });
    assert.equal(jobsRes.status, 200);
    const jobsBody = await jobsRes.json();
    assert.ok(jobsBody.deadLetters.some((dl: { jobId: string }) => dl.jobId === job.id));

    const dashRes = await fetch(`${baseUrl}/api/ai/dashboard`, {
      headers: { Authorization: `Bearer ${ceoToken}` },
    });
    assert.equal(dashRes.status, 200);
    const dashBody = await dashRes.json();
    assert.ok(dashBody.dashboard.executionStateCounts);
    assert.ok(dashBody.dashboard.deadLetterCount >= 1);
  });

  it('Phase 31 graceful draining: /api/ready returns 503 not_ready once runtimeLifecycle enters draining state', async () => {
    createdApp.runtimeLifecycle.markDraining();
    const readyRes = await fetch(`${baseUrl}/api/ready`);
    assert.equal(readyRes.status, 503);
    const readyBody = await readyRes.json();
    assert.equal(readyBody.ready, false);
    assert.equal(readyBody.status, 'temporarily_unavailable');
  });
});
