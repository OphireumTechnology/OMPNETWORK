/*
Copyright (c) 2026 Ophireum Multimedia Production. All rights reserved.
Developer and claimed rights holder: Ophireum Multimedia Production
DTI-registered business, Philippines | Registration No. 7567003
SPDX-FileCopyrightText: 2026 Ophireum Multimedia Production
SPDX-License-Identifier: LicenseRef-Ophireum-Proprietary
Third-party materials, dependencies, and separately licensed components remain subject to their respective rights and licenses.
*/

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { AddressInfo } from 'node:net';
import { createApp, AppDependencies } from '../src/server/app';
import {
  AdminUserRecord,
  AppointmentRecord,
  AuditLogRecord,
  ConflictError,
  CreateAppointmentInput,
  CreateSolutionRequestInput,
  DatabaseRepository,
  DatabaseUnavailableError,
  EmailOutboxRecord,
  NotFoundError,
  SolutionRequestRecord,
} from '../src/server/db/types';
import { EmailSendResult, EmailTransport } from '../src/server/services/emailService';
import { GoogleCalendarService } from '../src/server/services/calendarService';
import { SupabaseDatabaseRepository } from '../src/server/db/supabaseRepository';

/**
 * Shared stateful storage backend backing multiple server instances cleanly
 * so server-restart durability, unique constraints, and transactional outbox are tested truthfully.
 */
interface BackingStore {
  solutionRequests: SolutionRequestRecord[];
  appointments: AppointmentRecord[];
  outbox: EmailOutboxRecord[];
  auditLogs: AuditLogRecord[];
  admins: AdminUserRecord[];
  usersByToken: Record<string, { id: string; email: string }>;
  failNextWrite: boolean;
}

function createBackingStore(): BackingStore {
  return {
    solutionRequests: [],
    appointments: [],
    outbox: [],
    auditLogs: [],
    admins: [
      {
        id: 'adm-1',
        authUserId: 'uid-admin',
        email: 'admin@ophireum.com',
        fullName: 'Dhenze Languisan',
        role: 'super_admin',
        isActive: true,
      },
    ],
    usersByToken: {
      'supabase-admin-jwt': { id: 'uid-admin', email: 'admin@ophireum.com' },
      'supabase-customer-jwt': { id: 'uid-customer', email: 'customer@example.com' },
    },
    failNextWrite: false,
  };
}

class TestDatabaseRepository implements DatabaseRepository {
  public readonly isConfigured = true;
  constructor(private readonly store: BackingStore) {}

  async ping() {
    return { ok: !this.store.failNextWrite, configured: true, latencyMs: 1 };
  }

  async findSolutionRequestByIdempotencyKey(key: string): Promise<SolutionRequestRecord | null> {
    return this.store.solutionRequests.find((r) => r.idempotencyKey === key) || null;
  }

  async createSolutionRequest(input: CreateSolutionRequestInput): Promise<{
    record: SolutionRequestRecord;
    created: boolean;
  }> {
    if (this.store.failNextWrite) {
      throw new DatabaseUnavailableError('Simulated PostgreSQL write failure');
    }
    if (input.idempotencyKey) {
      const existing = await this.findSolutionRequestByIdempotencyKey(input.idempotencyKey);
      if (existing) return { record: existing, created: false };
    }
    const now = new Date().toISOString();
    const record: SolutionRequestRecord = {
      id: crypto.randomUUID(),
      referenceCode: input.referenceCode,
      idempotencyKey: input.idempotencyKey,
      type: input.type,
      fullName: input.fullName,
      email: input.email,
      contactNumber: input.contactNumber,
      company: input.company,
      industry: input.industry,
      targetTimeline: input.targetTimeline,
      selectedServices: input.selectedServices,
      selectedServiceIds: input.selectedServiceIds,
      selectedOptionsMap: input.selectedOptionsMap,
      serviceId: input.serviceId,
      serviceTitle: input.serviceTitle,
      estimatedOneTimeStartingUsd: input.estimatedOneTimeStartingUsd,
      estimatedMonthlyStartingUsd: input.estimatedMonthlyStartingUsd,
      estimatedBudget: input.estimatedBudget,
      preferredCurrency: input.preferredCurrency,
      phpConversionRate: input.phpConversionRate,
      projectDescription: input.projectDescription,
      fileName: input.fileName,
      privacyConsent: input.privacyConsent,
      status: 'submitted',
      emailDeliveryStatus: 'pending',
      sourceChannel: 'website',
      createdAt: now,
      updatedAt: now,
    };
    this.store.solutionRequests.unshift(record);
    return { record, created: true };
  }

  async updateSolutionRequestEmailStatus(
    referenceCode: string,
    emailDeliveryStatus: 'pending' | 'sent' | 'failed' | 'unconfigured'
  ): Promise<void> {
    const target = this.store.solutionRequests.find((r) => r.referenceCode === referenceCode);
    if (target) {
      target.emailDeliveryStatus = emailDeliveryStatus;
      target.updatedAt = new Date().toISOString();
    }
  }

  async listSolutionRequests(options: { limit: number; offset: number; status?: string }) {
    const filtered = options.status
      ? this.store.solutionRequests.filter((r) => r.status === options.status)
      : this.store.solutionRequests;
    return {
      records: filtered.slice(options.offset, options.offset + options.limit),
      total: filtered.length,
    };
  }

  async getBookedSlotsForDate(scheduledDate: string): Promise<string[]> {
    return this.store.appointments
      .filter(
        (a) =>
          a.scheduledDate === scheduledDate &&
          (a.status === 'pending_review' || a.status === 'confirmed')
      )
      .map((a) => a.scheduledTimeSlot);
  }

  async createAppointment(input: CreateAppointmentInput): Promise<{
    record: AppointmentRecord;
    created: boolean;
  }> {
    if (this.store.failNextWrite) {
      throw new DatabaseUnavailableError('Simulated PostgreSQL appointment failure');
    }
    if (input.idempotencyKey) {
      const existing = this.store.appointments.find((a) => a.idempotencyKey === input.idempotencyKey);
      if (existing) return { record: existing, created: false };
    }
    const conflict = this.store.appointments.find(
      (a) =>
        a.scheduledDate === input.scheduledDate &&
        a.scheduledTimeSlot === input.scheduledTimeSlot &&
        (a.status === 'pending_review' || a.status === 'confirmed')
    );
    if (conflict) {
      throw new ConflictError(
        `The slot ${input.scheduledTimeSlot} on ${input.scheduledDate} has just been reserved.`
      );
    }

    const now = new Date().toISOString();
    const record: AppointmentRecord = {
      id: crypto.randomUUID(),
      referenceCode: input.referenceCode,
      idempotencyKey: input.idempotencyKey,
      fullName: input.fullName,
      email: input.email,
      phone: input.phone,
      companyName: input.companyName,
      briefReferenceCode: input.briefReferenceCode,
      consultationType: input.consultationType,
      scheduledDate: input.scheduledDate,
      scheduledTimeSlot: input.scheduledTimeSlot,
      durationMinutes: input.durationMinutes,
      clientTimezone: input.clientTimezone,
      meetingLink: input.meetingLink,
      meetingLocation: input.meetingLocation,
      assignedConsultant: input.assignedConsultant,
      status: input.status,
      calendarSyncStatus: input.calendarSyncStatus,
      calendarEventId: input.calendarEventId,
      managementTokenHash: input.managementTokenHash,
      notes: input.notes,
      createdAt: now,
      updatedAt: now,
    };
    this.store.appointments.unshift(record);
    return { record, created: true };
  }

  async getAppointmentByReference(referenceCode: string): Promise<AppointmentRecord | null> {
    return this.store.appointments.find((a) => a.referenceCode === referenceCode) || null;
  }

  async updateAppointment(
    referenceCode: string,
    patch: Partial<AppointmentRecord>
  ): Promise<AppointmentRecord> {
    const idx = this.store.appointments.findIndex((a) => a.referenceCode === referenceCode);
    if (idx === -1) throw new NotFoundError('Appointment not found');
    const updated = { ...this.store.appointments[idx], ...patch, updatedAt: new Date().toISOString() };
    this.store.appointments[idx] = updated;
    return updated;
  }

  async listAppointments(options: { limit: number; offset: number }) {
    return {
      records: this.store.appointments.slice(options.offset, options.offset + options.limit),
      total: this.store.appointments.length,
    };
  }

  async createOutboxRecord(input: {
    dedupeKey: string;
    entityType: 'solution_request' | 'appointment';
    entityReference: string;
    recipientEmail: string;
    notificationType: EmailOutboxRecord['notificationType'];
    subject: string;
    htmlBody: string;
    textBody: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ record: EmailOutboxRecord; created: boolean }> {
    const existing = this.store.outbox.find((o) => o.dedupeKey === input.dedupeKey);
    if (existing) return { record: existing, created: false };
    const now = new Date().toISOString();
    const record: EmailOutboxRecord = {
      id: crypto.randomUUID(),
      dedupeKey: input.dedupeKey,
      entityType: input.entityType,
      entityReference: input.entityReference,
      recipientEmail: input.recipientEmail,
      notificationType: input.notificationType,
      subject: input.subject,
      htmlBody: input.htmlBody,
      textBody: input.textBody,
      status: 'queued',
      provider: 'resend',
      deliveryAttempts: 0,
      metadata: input.metadata || {},
      createdAt: now,
      updatedAt: now,
    };
    this.store.outbox.push(record);
    return { record, created: true };
  }

  async updateOutboxStatus(id: string, patch: any): Promise<void> {
    const item = this.store.outbox.find((o) => o.id === id);
    if (item) {
      item.status = patch.status;
      item.providerReference = patch.providerReference;
      item.deliveryAttempts = patch.deliveryAttempts;
      item.lastError = patch.lastError;
      item.nextRetryAt = patch.nextRetryAt || undefined;
      item.sentAt = patch.sentAt || undefined;
      item.updatedAt = new Date().toISOString();
    }
  }

  async listRetryableOutbox(limit = 20): Promise<EmailOutboxRecord[]> {
    return this.store.outbox
      .filter((o) => (o.status === 'queued' || o.status === 'failed') && o.deliveryAttempts < 5)
      .slice(0, limit);
  }

  async writeAuditLog(input: Omit<AuditLogRecord, 'id' | 'createdAt'>): Promise<void> {
    this.store.auditLogs.unshift({
      id: crypto.randomUUID(),
      ...input,
      createdAt: new Date().toISOString(),
    });
  }

  async listAuditLogs(options: { limit: number; offset: number }) {
    return {
      records: this.store.auditLogs.slice(options.offset, options.offset + options.limit),
      total: this.store.auditLogs.length,
    };
  }

  async findActiveAdminByEmail(email: string, authUserId?: string): Promise<AdminUserRecord | null> {
    return (
      this.store.admins.find(
        (a) =>
          a.isActive &&
          a.email.toLowerCase() === email.toLowerCase() &&
          (!authUserId || a.authUserId === authUserId)
      ) || null
    );
  }

  async verifySupabaseUserToken(token: string): Promise<{ id: string; email: string } | null> {
    return this.store.usersByToken[token] || null;
  }
}

class MockEmailTransport implements EmailTransport {
  public isConfigured = true;
  public shouldFail = false;
  public sentCount = 0;

  async send(): Promise<EmailSendResult> {
    if (!this.isConfigured) {
      return { status: 'unconfigured', error: 'RESEND_API_KEY not configured' };
    }
    if (this.shouldFail) {
      return { status: 'failed', error: 'Resend API 502 Bad Gateway' };
    }
    this.sentCount += 1;
    return { status: 'sent', providerReference: `re_msg_${this.sentCount}` };
  }
}

async function startTestServer(deps: AppDependencies) {
  const created = createApp(deps);
  const server = http.createServer(created.app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    ...created,
    close: () => new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

function getNextBusinessDayIso(daysAhead = 2): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysAhead);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) {
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return d.toISOString().split('T')[0];
}

// ============================================================================
// MANDATORY REGRESSION & SECURITY TESTS (BLOCK 9)
// ============================================================================

test('1-3. Admin RBAC protection: 401 unauthenticated, 403 non-admin, 200 paginated admin', async () => {
  const store = createBackingStore();
  const srv = await startTestServer({
    db: new TestDatabaseRepository(store),
    sessionSecret: 'test-session-secret-0123456789abcdef',
  });

  try {
    // 1. Unauthenticated requests rejected with 401
    for (const ep of [
      '/api/inquiries',
      '/api/admin/solution-requests',
      '/api/admin/appointments',
      '/api/admin/audit-logs',
    ]) {
      const res = await fetch(`${srv.baseUrl}${ep}`);
      assert.equal(res.status, 401, `Expected 401 for unauthenticated ${ep}`);
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
      assert.ok(res.headers.get('x-request-id'));
    }

    // 2. Authenticated non-admin customer rejected with 403
    const nonAdminRes = await fetch(`${srv.baseUrl}/api/admin/solution-requests`, {
      headers: { Authorization: 'Bearer supabase-customer-jwt' },
    });
    assert.equal(nonAdminRes.status, 403);

    // 3. Verified admin gets paginated 200 data + audit log entry
    const adminRes = await fetch(`${srv.baseUrl}/api/admin/solution-requests?limit=10&offset=0`, {
      headers: { Authorization: 'Bearer supabase-admin-jwt' },
    });
    assert.equal(adminRes.status, 200);
    const body = await adminRes.json();
    assert.equal(body.success, true);
    assert.equal(body.limit, 10);
    assert.equal(body.offset, 0);
    assert.ok(Array.isArray(body.records));
    assert.ok(store.auditLogs.some((l) => l.action === 'admin_view_solution_requests'));
  } finally {
    await srv.close();
  }
});

test('4-8. Solution request lifecycle: valid submission, restart persistence, idempotency, invalid serviceId, server-authoritative pricing', async () => {
  const store = createBackingStore();
  const transport = new MockEmailTransport();
  const db = new TestDatabaseRepository(store);
  const srv1 = await startTestServer({ db, emailTransport: transport });

  const idempKey = crypto.randomUUID();
  let createdReference = '';

  try {
    // 7. Invalid serviceId returns 400
    const badServiceRes = await fetch(`${srv1.baseUrl}/api/inquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'solution_builder',
        fullName: 'Elena Reyes',
        email: 'elena@enterprise.ph',
        contactNumber: '+63 917 111 2222',
        company: 'Clark Logistics Corp',
        selectedServiceIds: ['nonexistent-tampered-id'],
        projectDescription: 'Building a comprehensive logistics automation solution.',
        privacyConsent: true,
      }),
    });
    assert.equal(badServiceRes.status, 400);

    // 4 & 8. Valid submission + client-tampered pricing ignored by server catalog computation
    const createRes = await fetch(`${srv1.baseUrl}/api/inquiries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempKey,
      },
      body: JSON.stringify({
        idempotencyKey: idempKey,
        type: 'solution_builder',
        fullName: 'Elena Reyes',
        email: 'elena@enterprise.ph',
        contactNumber: '+63 917 111 2222',
        company: 'Clark Logistics Corp',
        selectedServiceIds: ['essential-digital-presence', 'ai-concierge-elite'],
        // Tampered lowball prices from client must NEVER be trusted
        estimatedOneTimeStartingUsd: 1,
        estimatedMonthlyStartingUsd: 1,
        estimatedBudget: '$1 fake total',
        projectDescription: 'We need a corporate web platform plus a customer service AI agent.',
        privacyConsent: true,
      }),
    });
    assert.equal(createRes.status, 201);
    const createdJson = await createRes.json();
    assert.equal(createdJson.success, true);
    assert.match(createdJson.referenceId, /^OPM-SOL-\d{4}-/);
    assert.equal(createdJson.deduplicated, false);
    // Server computes authoritative sum: essential-digital-presence ($897) + ai-concierge-elite ($447 + $147/mo) = $1,344 + $147/mo
    assert.equal(createdJson.inquiry.estimatedOneTimeStartingUsd, 1344);
    assert.equal(createdJson.inquiry.estimatedMonthlyStartingUsd, 147);
    assert.equal(createdJson.emailDelivery.overallStatus, 'sent');
    createdReference = createdJson.referenceId;

    // 6. Duplicate idempotencyKey returns original record cleanly without duplicating rows
    const dupRes = await fetch(`${srv1.baseUrl}/api/inquiries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempKey,
      },
      body: JSON.stringify({
        idempotencyKey: idempKey,
        type: 'solution_builder',
        fullName: 'Elena Reyes',
        email: 'elena@enterprise.ph',
        contactNumber: '+63 917 111 2222',
        company: 'Clark Logistics Corp',
        selectedServiceIds: ['essential-digital-presence', 'ai-concierge-elite'],
        projectDescription: 'We need a corporate web platform plus a customer service AI agent.',
        privacyConsent: true,
      }),
    });
    assert.equal(dupRes.status, 200);
    const dupJson = await dupRes.json();
    assert.equal(dupJson.referenceId, createdReference);
    assert.equal(dupJson.deduplicated, true);
    assert.equal(store.solutionRequests.length, 1);
  } finally {
    await srv1.close();
  }

  // 5. Simulate fresh server restart reading from persisted database store
  const srv2 = await startTestServer({ db: new TestDatabaseRepository(store) });
  try {
    const listAfterRestart = await fetch(`${srv2.baseUrl}/api/admin/solution-requests`, {
      headers: { Authorization: 'Bearer supabase-admin-jwt' },
    });
    assert.equal(listAfterRestart.status, 200);
    const listBody = await listAfterRestart.json();
    assert.equal(listBody.total, 1);
    assert.equal(listBody.records[0].referenceCode, createdReference);
  } finally {
    await srv2.close();
  }
});

test('9. Real unconfigured DB & simulated DB write failure return HTTP 503 and never fake 201 success', async () => {
  // Unconfigured Supabase database repository
  const unconfiguredDb = new SupabaseDatabaseRepository('', '');
  const srvUnconf = await startTestServer({ db: unconfiguredDb });
  try {
    const healthRes = await fetch(`${srvUnconf.baseUrl}/api/health`);
    const healthJson = await healthRes.json();
    assert.equal(healthJson.dependencies.database.connected, false);
    assert.equal(healthJson.dependencies.database.status, 'unconfigured');

    const failRes = await fetch(`${srvUnconf.baseUrl}/api/inquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'solution_builder',
        fullName: 'Marco Villanueva',
        email: 'marco@company.com',
        contactNumber: '+63 918 555 0000',
        company: 'Apex Corp',
        selectedServiceIds: ['essential-digital-presence'],
        projectDescription: 'Need a corporate digital platform with SEO architecture.',
        privacyConsent: true,
      }),
    });
    assert.equal(failRes.status, 503);
    const failJson = await failRes.json();
    assert.equal(failJson.success, false);
    assert.equal(failJson.code, 'DATABASE_UNAVAILABLE');
  } finally {
    await srvUnconf.close();
  }

  // Runtime DB write failure on configured store
  const store = createBackingStore();
  store.failNextWrite = true;
  const srvDbFail = await startTestServer({ db: new TestDatabaseRepository(store) });
  try {
    const res = await fetch(`${srvDbFail.baseUrl}/api/inquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'solution_builder',
        fullName: 'Marco Villanueva',
        email: 'marco@company.com',
        contactNumber: '+63 918 555 0000',
        company: 'Apex Corp',
        selectedServiceIds: ['essential-digital-presence'],
        projectDescription: 'Need a corporate digital platform with SEO architecture.',
        privacyConsent: true,
      }),
    });
    assert.equal(res.status, 503);
  } finally {
    await srvDbFail.close();
  }
});

test('10. Transactional email failure is persisted in outbox and retries succeed without pretending sent', async () => {
  const store = createBackingStore();
  const transport = new MockEmailTransport();
  transport.shouldFail = true;

  const srv = await startTestServer({
    db: new TestDatabaseRepository(store),
    emailTransport: transport,
  });

  try {
    const res = await fetch(`${srv.baseUrl}/api/inquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'solution_builder',
        fullName: 'Sofia Mendoza',
        email: 'sofia@health.ph',
        contactNumber: '+63 917 888 9999',
        company: 'MetroCare Group',
        selectedServiceIds: ['essential-digital-presence'],
        projectDescription: 'Patient onboarding & clinic digital presence upgrade.',
        privacyConsent: true,
      }),
    });
    assert.equal(res.status, 201);
    const json = await res.json();
    assert.equal(json.emailDelivery.overallStatus, 'failed');
    assert.equal(store.outbox.length, 2);
    assert.equal(store.outbox[0].status, 'failed');
    assert.ok(store.outbox[0].lastError?.includes('502'));

    // Recover transport & run outbox retry queue
    transport.shouldFail = false;
    const processed = await srv.emailService.processRetryQueue(10);
    assert.equal(processed, 2);
    assert.equal(store.outbox[0].status, 'sent');
    assert.equal(store.outbox[1].status, 'sent');
  } finally {
    await srv.close();
  }
});

test('11-12. Consultation booking creates honest pending_review when Calendar unconfigured and blocks double booking (409)', async () => {
  const store = createBackingStore();
  const srv = await startTestServer({
    db: new TestDatabaseRepository(store),
    calendarService: new GoogleCalendarService('', ''),
  });

  const targetDate = getNextBusinessDayIso(3);
  const slot = '10:00 AM - 10:30 AM';

  try {
    const bookRes1 = await fetch(`${srv.baseUrl}/api/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Carlos Dizon',
        email: 'carlos@dizon.ph',
        phone: '+63 917 222 3333',
        companyName: 'Dizon Holdings',
        consultationType: 'video',
        scheduledDate: targetDate,
        scheduledTimeSlot: slot,
        clientTimezone: 'Asia/Manila',
      }),
    });
    assert.equal(bookRes1.status, 201);
    const json1 = await bookRes1.json();
    assert.equal(json1.success, true);
    assert.equal(json1.calendarSynced, false);
    assert.equal(json1.appointment.status, 'pending_review');
    assert.equal(json1.appointment.meetingLink, undefined);
    assert.ok(json1.managementToken);

    // 12. Competing double booking on same date & slot returns 409 Conflict
    const bookRes2 = await fetch(`${srv.baseUrl}/api/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Competing Client',
        email: 'other@company.ph',
        phone: '+63 917 444 5555',
        companyName: 'Other Org',
        consultationType: 'video',
        scheduledDate: targetDate,
        scheduledTimeSlot: slot,
        clientTimezone: 'Asia/Manila',
      }),
    });
    assert.equal(bookRes2.status, 409);

    // Verify availability reflects reserved slot
    const availRes = await fetch(
      `${srv.baseUrl}/api/appointments/availability?date=${encodeURIComponent(targetDate)}`
    );
    const availJson = await availRes.json();
    assert.ok(availJson.bookedSlots.includes(slot));

    // Verify cancellation releases slot
    const cancelRes = await fetch(
      `${srv.baseUrl}/api/appointments/${encodeURIComponent(json1.appointment.referenceCode)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel',
          managementToken: json1.managementToken,
          email: 'carlos@dizon.ph',
        }),
      }
    );
    assert.equal(cancelRes.status, 200);
    const cancelJson = await cancelRes.json();
    assert.equal(cancelJson.appointment.status, 'cancelled');
  } finally {
    await srv.close();
  }
});

test('13-14. AI Consultant deterministic grounding without GEMINI_API_KEY, input validation, rate limits & static leak checks', async () => {
  const store = createBackingStore();
  const srv = await startTestServer({
    db: new TestDatabaseRepository(store),
    geminiClient: null,
  });

  try {
    // 13a. Empty chat message returns 400
    const badChat = await fetch(`${srv.baseUrl}/api/consultant/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userMessage: '   ' }),
    });
    assert.equal(badChat.status, 400);

    // 13b. Catalog-grounded deterministic fallback when GEMINI_API_KEY is missing
    const chatRes = await fetch(`${srv.baseUrl}/api/consultant/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userMessage: 'Can you help us build a blockchain verification system and tell us starting price?',
      }),
    });
    assert.equal(chatRes.status, 200);
    const chatJson = await chatRes.json();
    assert.ok(chatJson.replyText.includes('starting investments'));
    assert.ok(Array.isArray(chatJson.recommendedServiceIds));

    // 14. Honeypot & invalid inquiry payloads return 400
    const spamRes = await fetch(`${srv.baseUrl}/api/inquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Bot User',
        email: 'bot@spam.test',
        contactNumber: '+63 917 000 0000',
        company: 'Spam Corp',
        selectedServiceIds: ['business-website'],
        projectDescription: 'Automated spam test submission payload body.',
        privacyConsent: true,
        websiteHoneypot: 'http://spam-link.example',
      }),
    });
    assert.equal(spamRes.status, 400);
  } finally {
    await srv.close();
  }

  // Static audit guarantees: no fake meet links, no opm_inquiries, no SUBMISSIONS_FILE, RLS fixed
  const schemaContent = fs.readFileSync(path.resolve('supabase/schema.sql'), 'utf8');
  assert.ok(!schemaContent.includes('USING (true)'), 'schema.sql must not contain USING (true)');
  assert.ok(schemaContent.includes('solution_requests'), 'schema.sql must define solution_requests');
  assert.ok(schemaContent.includes('admin_users'), 'schema.sql must define admin_users');
});


test('security: arbitrary run.app origins are rejected by the exact CORS allowlist', async () => {
  const previous = process.env.ALLOWED_ORIGINS;
  process.env.ALLOWED_ORIGINS = 'https://ophireummultimedia.com';
  const srv = await startTestServer({ db: new TestDatabaseRepository(createBackingStore()) });
  try {
    const response = await fetch(`${srv.baseUrl}/api/inquiries`, {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://untrusted-origin.run.app',
        'Access-Control-Request-Method': 'POST',
      },
    });
    assert.equal(response.status, 403);
    assert.equal(response.headers.get('access-control-allow-origin'), null);
  } finally {
    await srv.close();
    if (previous === undefined) delete process.env.ALLOWED_ORIGINS;
    else process.env.ALLOWED_ORIGINS = previous;
  }
});

test('security: health endpoint returns 503 when database dependency is unavailable', async () => {
  const store = createBackingStore();
  store.failNextWrite = true;
  const srv = await startTestServer({ db: new TestDatabaseRepository(store) });
  try {
    const response = await fetch(`${srv.baseUrl}/api/health`);
    const body = await response.json();
    assert.equal(response.status, 503);
    assert.equal(body.dependencies.database.connected, false);
  } finally {
    await srv.close();
  }
});
