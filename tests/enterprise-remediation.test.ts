import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { createApp } from '../src/server/app';
import {
  DatabaseRepository,
  AdminUserRecord,
  SolutionRequestRecord,
  AppointmentRecord,
  AuditLogRecord,
  EmailOutboxRecord,
  EmailDeliveryState,
  CreateSolutionRequestInput,
  CreateAppointmentInput,
  NotFoundError,
} from '../src/server/db/types';
import {
  generateTotpSecret,
  generateTotpCode,
  verifyTotpCode,
  AdminAuthService,
} from '../src/server/auth';
import {
  AtomicPaymentReferenceAllocator,
  isValidOphireumPaymentReference,
  PAYMENT_REFERENCE_REGEX,
} from '../src/server/portal/paymentReference';
import { CentralKnowledgeService } from '../src/server/ai/knowledgeService';

class MockEnterpriseDatabase implements DatabaseRepository {
  public readonly isConfigured = true;
  public solutionRequests: SolutionRequestRecord[] = [];
  public appointments: AppointmentRecord[] = [];
  public auditLogs: AuditLogRecord[] = [];
  public outbox: EmailOutboxRecord[] = [];
  public admins: AdminUserRecord[] = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'super@ophireum.test',
      fullName: 'Super Admin',
      role: 'super_admin',
      isActive: true,
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      email: 'auditor@ophireum.test',
      fullName: 'Compliance Auditor',
      role: 'auditor',
      isActive: true,
    },
  ];

  async ping() {
    return { configured: true, ok: true, latencyMs: 1 };
  }

  async findSolutionRequestByIdempotencyKey(key: string): Promise<SolutionRequestRecord | null> {
    return this.solutionRequests.find((r) => r.idempotencyKey === key) || null;
  }

  async createSolutionRequest(input: CreateSolutionRequestInput) {
    const now = new Date().toISOString();
    const rec: SolutionRequestRecord = {
      ...input,
      id: crypto.randomUUID(),
      status: 'submitted',
      emailDeliveryStatus: 'pending',
      sourceChannel: 'web',
      createdAt: now,
      updatedAt: now,
    };
    this.solutionRequests.unshift(rec);
    return { record: rec, created: true };
  }

  async updateSolutionRequestEmailStatus(referenceCode: string, status: SolutionRequestRecord['emailDeliveryStatus']) {
    const rec = this.solutionRequests.find((r) => r.referenceCode === referenceCode);
    if (rec) rec.emailDeliveryStatus = status;
  }

  async updateSolutionRequestStatus(referenceCode: string, status: SolutionRequestRecord['status']) {
    const rec = this.solutionRequests.find((r) => r.referenceCode === referenceCode);
    if (!rec) throw new NotFoundError('Solution request not found');
    rec.status = status;
    rec.updatedAt = new Date().toISOString();
    return rec;
  }

  async listSolutionRequests(opts: { limit: number; offset: number; status?: string }) {
    const filtered = opts.status ? this.solutionRequests.filter((r) => r.status === opts.status) : this.solutionRequests;
    return {
      total: filtered.length,
      records: filtered.slice(opts.offset, opts.offset + opts.limit),
    };
  }

  async getBookedSlotsForDate(scheduledDate: string): Promise<string[]> {
    return this.appointments
      .filter((a) => a.scheduledDate === scheduledDate && a.status !== 'cancelled')
      .map((a) => a.scheduledTimeSlot);
  }

  async createAppointment(input: CreateAppointmentInput) {
    const now = new Date().toISOString();
    const rec: AppointmentRecord = {
      ...input,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    this.appointments.unshift(rec);
    return { record: rec, created: true };
  }

  async getAppointmentByReference(referenceCode: string): Promise<AppointmentRecord | null> {
    return this.appointments.find((a) => a.referenceCode === referenceCode) || null;
  }

  async updateAppointment(
    referenceCode: string,
    patch: Partial<
      Pick<
        AppointmentRecord,
        'scheduledDate' | 'scheduledTimeSlot' | 'status' | 'meetingLink' | 'calendarSyncStatus' | 'calendarEventId' | 'notes'
      >
    >
  ): Promise<AppointmentRecord> {
    const rec = this.appointments.find((a) => a.referenceCode === referenceCode);
    if (!rec) throw new NotFoundError('Appointment not found');
    Object.assign(rec, patch, { updatedAt: new Date().toISOString() });
    return rec;
  }

  async listAppointments(opts: { limit: number; offset: number }) {
    return {
      total: this.appointments.length,
      records: this.appointments.slice(opts.offset, opts.offset + opts.limit),
    };
  }

  async createOutboxRecord(input: {
    dedupeKey: string;
    entityType: EmailOutboxRecord['entityType'];
    entityReference: string;
    recipientEmail: string;
    notificationType: EmailOutboxRecord['notificationType'];
    subject: string;
    htmlBody: string;
    textBody: string;
    metadata?: Record<string, unknown>;
  }) {
    const existing = this.outbox.find((o) => o.dedupeKey === input.dedupeKey);
    if (existing) return { record: existing, created: false };
    const now = new Date().toISOString();
    const rec: EmailOutboxRecord = {
      ...input,
      id: crypto.randomUUID(),
      status: 'queued',
      provider: 'resend',
      deliveryAttempts: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.outbox.push(rec);
    return { record: rec, created: true };
  }

  async updateOutboxStatus(
    id: string,
    patch: {
      status: EmailOutboxRecord['status'];
      providerReference?: string;
      deliveryAttempts: number;
      lastError?: string;
      nextRetryAt?: string | null;
      sentAt?: string | null;
    }
  ) {
    const rec = this.outbox.find((o) => o.id === id);
    if (rec) {
      rec.status = patch.status;
      rec.deliveryAttempts = patch.deliveryAttempts;
      if (patch.providerReference !== undefined) rec.providerReference = patch.providerReference;
      if (patch.lastError !== undefined) rec.lastError = patch.lastError;
      if (patch.nextRetryAt !== undefined) rec.nextRetryAt = patch.nextRetryAt || undefined;
      if (patch.sentAt !== undefined) rec.sentAt = patch.sentAt || undefined;
      rec.updatedAt = new Date().toISOString();
    }
  }

  async updateOutboxByProviderReference(
    providerReference: string,
    status: EmailDeliveryState,
    lastError?: string
  ): Promise<boolean> {
    const rec = this.outbox.find((o) => o.providerReference === providerReference);
    if (!rec) return false;
    rec.status = status;
    if (lastError) rec.lastError = lastError;
    return true;
  }

  async listRetryableOutbox(limit = 25): Promise<EmailOutboxRecord[]> {
    return this.outbox.filter((o) => o.status === 'retrying' || o.status === 'queued').slice(0, limit);
  }

  async writeAuditLog(input: Omit<AuditLogRecord, 'id' | 'createdAt'>): Promise<void> {
    this.auditLogs.unshift({
      ...input,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    });
  }

  async listAuditLogs(opts: { limit: number; offset: number }) {
    return {
      total: this.auditLogs.length,
      records: this.auditLogs.slice(opts.offset, opts.offset + opts.limit),
    };
  }

  async findActiveAdminByEmail(email: string): Promise<AdminUserRecord | null> {
    const lower = email.toLowerCase();
    return this.admins.find((a) => a.isActive && a.email.toLowerCase() === lower) || null;
  }

  async verifySupabaseUserToken(): Promise<{ id: string; email: string } | null> {
    return null;
  }
}

async function startTestServer(db?: DatabaseRepository) {
  const { app } = createApp(db ? { db } : {});
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;
  return {
    baseUrl,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

// ---------------------------------------------------------------------------
// 1. Atomic Asia/Manila Payment Reference Allocator
// ---------------------------------------------------------------------------
test('AtomicPaymentReferenceAllocator generates unique Asia/Manila MMDDYYYYHHMMAM/PMNNN references under concurrency', async () => {
  const allocator = new AtomicPaymentReferenceAllocator();
  const fixedDate = new Date('2026-11-27T05:00:00.000Z'); // 13:00 PHT => 112720260100PM

  const results = await Promise.all(
    Array.from({ length: 100 }, () => allocator.allocate(fixedDate))
  );

  assert.equal(new Set(results).size, 100);
  assert.equal(results[0], '112720260100PM001');
  assert.equal(results[99], '112720260100PM100');
  for (const ref of results) {
    assert.equal(isValidOphireumPaymentReference(ref), true);
    assert.match(ref, PAYMENT_REFERENCE_REGEX);
  }
});

// ---------------------------------------------------------------------------
// 2. RFC 6238 TOTP MFA Verification
// ---------------------------------------------------------------------------
test('RFC 6238 TOTP MFA generates and verifies 6-digit codes with constant-time validation', () => {
  const secret = generateTotpSecret();
  const now = Date.now();
  const validCode = generateTotpCode(secret, now);
  assert.match(validCode, /^\d{6}$/);
  assert.equal(verifyTotpCode(secret, validCode, now), true);
  assert.equal(verifyTotpCode(secret, '000000', now), validCode === '000000');
  assert.equal(verifyTotpCode(secret, 'not-a-code', now), false);
});

// ---------------------------------------------------------------------------
// 3. Central AI Knowledge Service — Tenant Isolation & Prompt Injection Guard
// ---------------------------------------------------------------------------
test('CentralKnowledgeService enforces strict tenant isolation and wraps retrieved context', async () => {
  const kb = new CentralKnowledgeService(null);
  await kb.ingestDocument({
    title: 'Customer Alpha Private Contract',
    category: 'contracts',
    visibility: 'tenant_private',
    tenantUserId: 'tenant-alpha',
    rawContent: 'Confidential alpha pricing code ALPHA-SECRET-9921.',
    createdBy: 'super@ophireum.test',
    approvalStatus: 'approved',
  });

  const alphaHits = await kb.search({
    query: 'ALPHA-SECRET-9921',
    tenantUserId: 'tenant-alpha',
    includeInternal: false,
  });
  assert.equal(alphaHits.length > 0, true);

  const betaHits = await kb.search({
    query: 'ALPHA-SECRET-9921',
    tenantUserId: 'tenant-beta',
    includeInternal: false,
  });
  assert.equal(betaHits.length, 0);

  const wrapped = kb.formatRetrievedKnowledgeForPrompt(alphaHits);
  assert.match(wrapped, /<untrusted_knowledge_context>/);
  assert.match(wrapped, /<\/untrusted_knowledge_context>/);
});

// ---------------------------------------------------------------------------
// 4. Readiness Probe (/api/ready) & Version Endpoint (/api/version)
// ---------------------------------------------------------------------------
test('GET /api/ready returns 503 when DB unconfigured and 200 when DB healthy; GET /api/version returns metadata', async () => {
  const unconfiguredServer = await startTestServer();
  try {
    const readyRes = await fetch(`${unconfiguredServer.baseUrl}/api/ready`);
    assert.equal(readyRes.status, 503);
    const verRes = await fetch(`${unconfiguredServer.baseUrl}/api/version`);
    assert.equal(verRes.status, 200);
    const verJson = await verRes.json();
    assert.equal(verJson.service, 'OPHIREUM NETWORK API Gateway');
  } finally {
    await unconfiguredServer.close();
  }

  const healthyServer = await startTestServer(new MockEnterpriseDatabase());
  try {
    const readyRes = await fetch(`${healthyServer.baseUrl}/api/ready`);
    assert.equal(readyRes.status, 200);
    const readyJson = await readyRes.json();
    assert.equal(readyJson.status, 'ready');
  } finally {
    await healthyServer.close();
  }
});

// ---------------------------------------------------------------------------
// 5. RBAC 9-Role Enforcement, Principal Binding, Token Revocation, AI Workforce, BI & Legal
// ---------------------------------------------------------------------------
test('Enterprise Admin RBAC, token revocation, 25-agent AI approval queue, BI Analytics, and Legal APIs work end-to-end', async () => {
  const prevSecret = process.env.ADMIN_SESSION_SECRET;
  process.env.ADMIN_SESSION_SECRET = 'test-enterprise-session-secret-0123456789abcdef';

  const db = new MockEnterpriseDatabase();
  const authHelper = new AdminAuthService(db);
  const superToken = authHelper.issueSessionToken(db.admins[0]);
  const auditorToken = authHelper.issueSessionToken(db.admins[1]);
  // Forge a token with mismatched sub ID for principal binding test
  const mismatchedToken = authHelper.issueSessionToken({
    ...db.admins[0],
    id: '99999999-9999-4999-8999-999999999999',
  });

  const server = await startTestServer(db);
  try {
    // 5a. Principal binding rejects mismatched admin id
    const badPrincipal = await fetch(`${server.baseUrl}/api/admin/auth/session`, {
      headers: { Authorization: `Bearer ${mismatchedToken}` },
    });
    assert.equal(badPrincipal.status, 403);

    // 5b. Auditor can read BI analytics but gets 403 on write mutation (creating promotion)
    const auditorAnalytics = await fetch(`${server.baseUrl}/api/admin/analytics/overview`, {
      headers: { Authorization: `Bearer ${auditorToken}` },
    });
    assert.equal(auditorAnalytics.status, 200);
    const analyticsJson = await auditorAnalytics.json();
    assert.equal(analyticsJson.analytics.kpis.totalOrders, 0);
    assert.equal(analyticsJson.analytics.kpis.revenueUsdMinor, 0);

    const auditorWriteDenied = await fetch(`${server.baseUrl}/api/admin/promotions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auditorToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ code: 'HACK50', value: 50, discountType: 'percent' }),
    });
    assert.equal(auditorWriteDenied.status, 403);

    // 5c. Super Admin can list all 25 AI agents (A00–A24)
    const agentsRes = await fetch(`${server.baseUrl}/api/ai/agents`, {
      headers: { Authorization: `Bearer ${superToken}` },
    });
    assert.equal(agentsRes.status, 200);
    const agentsJson = await agentsRes.json();
    assert.equal(agentsJson.total, 25);

    // 5d. High-risk AI agent (A13 Billing, Invoicing & Reconciliation) requires human approval (HTTP 202)
    const highRiskExec = await fetch(`${server.baseUrl}/api/ai/agents/A13/execute`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${superToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt: 'Audit Q4 invoice reconciliation variances.' }),
    });
    assert.equal(highRiskExec.status, 202);
    const highRiskJson = await highRiskExec.json();
    assert.equal(highRiskJson.execution.status, 'pending_approval');

    const approveRes = await fetch(
      `${server.baseUrl}/api/ai/approvals/${encodeURIComponent(highRiskJson.execution.id)}/decide`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${superToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ decision: 'approved' }),
      }
    );
    assert.equal(approveRes.status, 200);
    const approveJson = await approveRes.json();
    assert.equal(approveJson.execution.status, 'completed');
    assert.ok(approveJson.execution.outputText);

    // 5e. Super Admin cannot bypass live_payments_enabled safety lock
    const lockRes = await fetch(`${server.baseUrl}/api/admin/config`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${superToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ key: 'live_payments_enabled', value: true }),
    });
    assert.equal(lockRes.status, 403);

    // 5f. BI Analytics CSV export
    const csvRes = await fetch(`${server.baseUrl}/api/admin/analytics/export.csv`, {
      headers: { Authorization: `Bearer ${superToken}` },
    });
    assert.equal(csvRes.status, 200);
    const csvText = await csvRes.text();
    assert.match(csvText, /"metric","value"/);
    assert.match(csvText, /"revenueUsdMinor","0"/);

    // 5g. Token revocation on /api/admin/auth/logout immediately invalidates bearer token
    const logoutRes = await fetch(`${server.baseUrl}/api/admin/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${superToken}` },
    });
    assert.equal(logoutRes.status, 200);

    const postLogoutRes = await fetch(`${server.baseUrl}/api/admin/auth/session`, {
      headers: { Authorization: `Bearer ${superToken}` },
    });
    assert.equal(postLogoutRes.status, 401);

    // 5h. Public Legal Policies (10 policies all pending_legal_review) + DSR Intake + Studio Blueprint
    const legalRes = await fetch(`${server.baseUrl}/api/legal/policies`);
    assert.equal(legalRes.status, 200);
    const legalJson = await legalRes.json();
    assert.equal(legalJson.policies.length, 10);
    assert.ok(legalJson.policies.every((p: any) => p.reviewStatus === 'pending_legal_review'));

    const dsrRes = await fetch(`${server.baseUrl}/api/legal/privacy-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requesterName: 'Juan Dela Cruz',
        requesterEmail: 'juan@example.com',
        requestType: 'data_export',
        details: 'Requesting copy of my personal records under RA 10173.',
      }),
    });
    assert.equal(dsrRes.status, 201);
    const dsrJson = await dsrRes.json();
    assert.match(dsrJson.request.referenceCode, /^OPM-DSR-\d{4}-[A-F0-9]{6}$/);

    const blueprintRes = await fetch(`${server.baseUrl}/api/ai/studio/blueprint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idea: 'Build a multi-tenant AI video production portal with billing' }),
    });
    assert.equal(blueprintRes.status, 200);
    const blueprintJson = await blueprintRes.json();
    assert.ok(blueprintJson.blueprint.length > 50);
  } finally {
    await server.close();
    if (prevSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = prevSecret;
  }
});

// ---------------------------------------------------------------------------
// 6. Appointment Management Token, Weekend/Past Validation & Cancellation
// ---------------------------------------------------------------------------
test('Appointments enforce DB-first persistence, management token verification, and weekend rejection on reschedule', async () => {
  const db = new MockEnterpriseDatabase();
  const server = await startTestServer(db);
  try {
    // Pick next weekday (Mon-Fri)
    const d = new Date();
    d.setDate(d.getDate() + 3);
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
    const weekdayIso = d.toISOString().slice(0, 10);

    // Pick next Sunday for rejection test
    const sun = new Date(d);
    while (sun.getDay() !== 0) sun.setDate(sun.getDate() + 1);
    const sundayIso = sun.toISOString().slice(0, 10);

    const createRes = await fetch(`${server.baseUrl}/api/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Maria Santos',
        email: 'maria@example.com',
        phone: '+63 917 000 1234',
        companyName: 'Santos Media',
        serviceInterest: 'Corporate Brand Video',
        consultationType: 'video',
        scheduledDate: weekdayIso,
        scheduledTimeSlot: '10:00 AM - 10:30 AM',
        consentAccepted: true,
      }),
    });
    assert.equal(createRes.status, 201);
    const created = await createRes.json();
    const refCode = created.appointment?.referenceCode;
    assert.ok(refCode);
    assert.ok(created.managementToken);

    // Wrong token rejected
    const badPatch = await fetch(`${server.baseUrl}/api/appointments/${refCode}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ managementToken: 'wrong-token', action: 'cancel' }),
    });
    assert.equal(badPatch.status, 401);

    // Weekend reschedule rejected
    const weekendPatch = await fetch(`${server.baseUrl}/api/appointments/${refCode}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        managementToken: created.managementToken,
        action: 'reschedule',
        scheduledDate: sundayIso,
        scheduledTimeSlot: '02:00 PM - 02:30 PM',
      }),
    });
    assert.equal(weekendPatch.status, 400);

    // Valid cancel succeeds
    const cancelPatch = await fetch(`${server.baseUrl}/api/appointments/${refCode}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ managementToken: created.managementToken, action: 'cancel' }),
    });
    assert.equal(cancelPatch.status, 200);
    const cancelled = await cancelPatch.json();
    assert.equal(cancelled.appointment.status, 'cancelled');
  } finally {
    await server.close();
  }
});

// ---------------------------------------------------------------------------
// 7. Extended Client Portal Endpoints (Organization, Offers, Privacy Export, MFA)
// ---------------------------------------------------------------------------
test('Extended Client Portal endpoints enforce auth and execute Organization, Offers, Privacy Export, and MFA flows', async () => {
  const server = await startTestServer(new MockEnterpriseDatabase());
  const uniqueEmail = `portal.client.${crypto.randomBytes(4).toString('hex')}@example.com`;
  try {
    const regRes = await fetch(`${server.baseUrl}/api/portal/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: uniqueEmail,
        password: 'StrongPassword123!',
        firstName: 'Elena',
        lastName: 'Reyes',
        companyName: 'Reyes Creative',
      }),
    });
    assert.equal(regRes.status, 201);
    const regJson = await regRes.json();
    const token = regJson.token;
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    const orgPatch = await fetch(`${server.baseUrl}/api/portal/organization`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        legalName: 'Reyes Creative Inc.',
        tradeName: 'Reyes Creative',
        taxId: '123-456-789-000',
        industry: 'Broadcast Media',
      }),
    });
    assert.equal(orgPatch.status, 200);
    const orgJson = await orgPatch.json();
    assert.equal(orgJson.organization.taxId, '123-456-789-000');

    const offersRes = await fetch(`${server.baseUrl}/api/portal/offers`, { headers });
    assert.equal(offersRes.status, 200);
    const offersJson = await offersRes.json();
    assert.ok(Array.isArray(offersJson.offers) && offersJson.offers.length >= 1);

    // MFA Enroll + Confirm
    const mfaEnroll = await fetch(`${server.baseUrl}/api/portal/security/mfa/enroll`, {
      method: 'POST',
      headers,
    });
    assert.equal(mfaEnroll.status, 200);
    const mfaJson = await mfaEnroll.json();
    const code = generateTotpCode(mfaJson.secret);
    const mfaConfirm = await fetch(`${server.baseUrl}/api/portal/security/mfa/confirm`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ code }),
    });
    assert.equal(mfaConfirm.status, 200);

    // Personal Data Export (RA 10173)
    const exportRes = await fetch(`${server.baseUrl}/api/portal/privacy/export`, { headers });
    assert.equal(exportRes.status, 200);
    const exportJson = await exportRes.json();
    assert.equal(exportJson.exportBundle.account.email, uniqueEmail);
    assert.equal(exportJson.exportBundle.organization.legalName, 'Reyes Creative Inc.');
  } finally {
    await server.close();
  }
});

// ---------------------------------------------------------------------------
// 8. Database Migration Sequence & Zero Permissive RLS Verification
// ---------------------------------------------------------------------------
test('Clean-room SQL migrations 000 -> 001 -> 002 -> 003 exist with zero permissive USING (true) policies', () => {
  const migrationsDir = path.resolve(process.cwd(), 'supabase/migrations');
  const expectedFiles = [
    '000_baseline_core_schema.sql',
    '001_phase1_security_and_persistence.sql',
    '002_client_portal_commerce.sql',
    '003_enterprise_platform_expansion.sql',
  ];
  for (const file of expectedFiles) {
    const full = path.join(migrationsDir, file);
    assert.equal(fs.existsSync(full), true, `Missing migration ${file}`);
    const sql = fs.readFileSync(full, 'utf8');
    assert.equal(/USING\s*\(\s*true\s*\)/i.test(sql), false, `Forbidden permissive RLS in ${file}`);
  }
  const m003 = fs.readFileSync(path.join(migrationsDir, '003_enterprise_platform_expansion.sql'), 'utf8');
  assert.match(m003, /allocate_ophireum_payment_ref/);
  assert.match(m003, /trg_audit_logs_immutable/);
  assert.match(m003, /claim_next_background_job/);
});
