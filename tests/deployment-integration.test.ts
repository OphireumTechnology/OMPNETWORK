import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { AddressInfo } from 'node:net';
import {
  PRODUCTION_RAILWAY_API_URL,
  buildApiUrl,
  normalizeApiBaseUrl,
  resolveApiBaseUrl,
} from '../src/lib/apiClient';
import { resolveListenPort } from '../server';
import { createApp } from '../src/server/app';
import {
  AdminUserRecord,
  AppointmentRecord,
  AuditLogRecord,
  ConflictError,
  CreateAppointmentInput,
  CreateSolutionRequestInput,
  DatabaseRepository,
  EmailOutboxRecord,
  NotFoundError,
  SolutionRequestRecord,
} from '../src/server/db/types';
import { GoogleCalendarService } from '../src/server/services/calendarService';

class IntegrationMemoryDb implements DatabaseRepository {
  public readonly isConfigured = true;
  public solutionRequests: SolutionRequestRecord[] = [];
  public appointments: AppointmentRecord[] = [];
  public outbox: EmailOutboxRecord[] = [];
  public auditLogs: AuditLogRecord[] = [];
  public admins: AdminUserRecord[] = [
    {
      id: 'adm-deploy-1',
      email: 'executive@ophireummultimedia.com',
      fullName: 'Dhenze Languisan',
      role: 'super_admin',
      isActive: true,
    },
  ];

  async ping() {
    return { ok: true, configured: true, latencyMs: 1 };
  }

  async findSolutionRequestByIdempotencyKey(key: string) {
    return this.solutionRequests.find((r) => r.idempotencyKey === key) || null;
  }

  async createSolutionRequest(input: CreateSolutionRequestInput) {
    const existing = input.idempotencyKey
      ? await this.findSolutionRequestByIdempotencyKey(input.idempotencyKey)
      : null;
    if (existing) return { record: existing, created: false };
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
      emailDeliveryStatus: 'unconfigured',
      sourceChannel: 'website',
      createdAt: now,
      updatedAt: now,
    };
    this.solutionRequests.unshift(record);
    return { record, created: true };
  }

  async updateSolutionRequestEmailStatus() {}

  async listSolutionRequests(options: { limit: number; offset: number }) {
    return {
      records: this.solutionRequests.slice(options.offset, options.offset + options.limit),
      total: this.solutionRequests.length,
    };
  }

  async getBookedSlotsForDate(scheduledDate: string) {
    return this.appointments
      .filter((a) => a.scheduledDate === scheduledDate && a.status !== 'cancelled')
      .map((a) => a.scheduledTimeSlot);
  }

  async createAppointment(input: CreateAppointmentInput) {
    const conflict = this.appointments.find(
      (a) =>
        a.scheduledDate === input.scheduledDate &&
        a.scheduledTimeSlot === input.scheduledTimeSlot &&
        a.status !== 'cancelled'
    );
    if (conflict) throw new ConflictError('Slot already reserved');
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
    this.appointments.unshift(record);
    return { record, created: true };
  }

  async getAppointmentByReference(ref: string) {
    return this.appointments.find((a) => a.referenceCode === ref) || null;
  }

  async updateAppointment(ref: string, patch: Partial<AppointmentRecord>) {
    const idx = this.appointments.findIndex((a) => a.referenceCode === ref);
    if (idx === -1) throw new NotFoundError('Not found');
    const updated = { ...this.appointments[idx], ...patch, updatedAt: new Date().toISOString() };
    this.appointments[idx] = updated;
    return updated;
  }

  async listAppointments(options: { limit: number; offset: number }) {
    return {
      records: this.appointments.slice(options.offset, options.offset + options.limit),
      total: this.appointments.length,
    };
  }

  async createOutboxRecord(input: any) {
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    this.outbox.push(record);
    return { record, created: true };
  }

  async updateOutboxStatus() {}
  async listRetryableOutbox() {
    return [];
  }

  async writeAuditLog(input: Omit<AuditLogRecord, 'id' | 'createdAt'>) {
    this.auditLogs.unshift({
      id: crypto.randomUUID(),
      ...input,
      createdAt: new Date().toISOString(),
    });
  }

  async listAuditLogs(options: { limit: number; offset: number }) {
    return {
      records: this.auditLogs.slice(options.offset, options.offset + options.limit),
      total: this.auditLogs.length,
    };
  }

  async findActiveAdminByEmail(email: string) {
    return this.admins.find((a) => a.email.toLowerCase() === email.toLowerCase()) || null;
  }

  async verifySupabaseUserToken() {
    return null;
  }
}

test('Centralized API client resolves Railway production, VITE_API_BASE_URL overrides, and local dev safely', () => {
  assert.equal(normalizeApiBaseUrl('https://api.ophireummultimedia.com///'), PRODUCTION_RAILWAY_API_URL);
  assert.equal(normalizeApiBaseUrl('javascript:alert(1)'), '');
  assert.equal(normalizeApiBaseUrl('   '), '');

  // Explicit VITE_API_BASE_URL override wins everywhere
  assert.equal(
    resolveApiBaseUrl({ envBaseUrl: 'https://api.ophireummultimedia.com/', hostname: 'localhost' }),
    PRODUCTION_RAILWAY_API_URL
  );
  assert.equal(
    buildApiUrl('/api/inquiries', 'https://api.ophireummultimedia.com/'),
    'https://api.ophireummultimedia.com/api/inquiries'
  );

  // Local development keeps relative /api/* paths
  assert.equal(resolveApiBaseUrl({ envBaseUrl: '', hostname: 'localhost' }), '');
  assert.equal(resolveApiBaseUrl({ envBaseUrl: '', hostname: '127.0.0.1' }), '');
  assert.equal(buildApiUrl('api/health', ''), '/api/health');

  // GitHub Pages static origins automatically route to Railway backend if env is unset
  assert.equal(
    resolveApiBaseUrl({ envBaseUrl: '', hostname: 'ophireummultimedia.com' }),
    PRODUCTION_RAILWAY_API_URL
  );
  assert.equal(
    resolveApiBaseUrl({ envBaseUrl: '', hostname: 'www.ophireummultimedia.com' }),
    PRODUCTION_RAILWAY_API_URL
  );
  assert.equal(
    resolveApiBaseUrl({ envBaseUrl: '', hostname: 'ophireumtechnology.github.io' }),
    PRODUCTION_RAILWAY_API_URL
  );
});

test('Railway PORT parser handles injected PORT strings and invalid fallbacks cleanly', () => {
  assert.equal(resolveListenPort(undefined), 3000);
  assert.equal(resolveListenPort(''), 3000);
  assert.equal(resolveListenPort('8080'), 8080);
  assert.equal(resolveListenPort(' 4123 '), 4123);
  assert.equal(resolveListenPort('invalid-port'), 3000);
  assert.equal(resolveListenPort('99999'), 3000);
});

test('Backend CORS allows authorized OPHIREUM origins, blocks unauthorized github.io, and integrates AI + Inquiry + Booking + Admin flows', async () => {
  const prevEmail = process.env.ADMIN_BOOTSTRAP_EMAIL;
  const prevPass = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  process.env.ADMIN_BOOTSTRAP_EMAIL = 'executive@ophireummultimedia.com';
  process.env.ADMIN_BOOTSTRAP_PASSWORD = 'OphireumTestPassword2026!';

  const db = new IntegrationMemoryDb();
  const { app } = createApp({
    db,
    calendarService: new GoogleCalendarService('', ''),
    geminiClient: null,
    sessionSecret: 'integration-test-secret-0123456789',
  });

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Verify /health alias and /api/health
    for (const healthPath of ['/api/health', '/health']) {
      const hRes = await fetch(`${baseUrl}${healthPath}`, {
        headers: { Origin: 'https://ophireummultimedia.com' },
      });
      assert.equal(hRes.status, 200);
      assert.equal(hRes.headers.get('access-control-allow-origin'), 'https://ophireummultimedia.com');
      assert.equal(hRes.headers.get('vary'), 'Origin');
      const hBody = await hRes.json();
      assert.equal(hBody.status, 'healthy');
    }

    // 2. Verify authorized preflight OPTIONS and rejection of rogue *.github.io origin
    const allowedPreflight = await fetch(`${baseUrl}/api/inquiries`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://ophireumtechnology.github.io' },
    });
    assert.equal(allowedPreflight.status, 204);
    assert.equal(
      allowedPreflight.headers.get('access-control-allow-origin'),
      'https://ophireumtechnology.github.io'
    );

    const roguePreflight = await fetch(`${baseUrl}/api/inquiries`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://evil-attacker.github.io' },
    });
    assert.equal(roguePreflight.status, 403);
    assert.equal(roguePreflight.headers.get('access-control-allow-origin'), null);

    // 3. Cross-origin AI Consultant check
    const aiRes = await fetch(`${baseUrl}/api/consultant/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://ophireummultimedia.com',
      },
      body: JSON.stringify({ userMessage: 'Tell me about Essential Digital Presence pricing.' }),
    });
    assert.equal(aiRes.status, 200);
    assert.equal(aiRes.headers.get('access-control-allow-origin'), 'https://ophireummultimedia.com');
    const aiJson = await aiRes.json();
    assert.ok(aiJson.replyText.includes('$897'));

    // 4. Cross-origin Inquiry Submission -> Admin Login -> Admin Dashboard Read
    const inqRes = await fetch(`${baseUrl}/api/inquiries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://ophireummultimedia.com',
      },
      body: JSON.stringify({
        type: 'solution_builder',
        fullName: 'Rafael Santos',
        email: 'rafael@enterprise.ph',
        contactNumber: '+63 917 300 4000',
        company: 'Manila Tech Logistics',
        selectedServiceIds: ['essential-digital-presence'],
        projectDescription: 'Corporate landing platform with structured inquiry intake.',
        privacyConsent: true,
      }),
    });
    assert.equal(inqRes.status, 201);
    const inqJson = await inqRes.json();
    assert.ok(inqJson.referenceId);

    const loginRes = await fetch(`${baseUrl}/api/admin/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://ophireummultimedia.com',
      },
      body: JSON.stringify({
        email: 'executive@ophireummultimedia.com',
        password: 'OphireumTestPassword2026!',
      }),
    });
    assert.equal(loginRes.status, 200);
    const loginJson = await loginRes.json();
    assert.ok(loginJson.token);

    const adminListRes = await fetch(`${baseUrl}/api/admin/solution-requests`, {
      headers: {
        Authorization: `Bearer ${loginJson.token}`,
        Origin: 'https://ophireummultimedia.com',
      },
    });
    assert.equal(adminListRes.status, 200);
    const adminListJson = await adminListRes.json();
    assert.equal(adminListJson.total, 1);
    assert.equal(adminListJson.records[0].referenceCode, inqJson.referenceId);
  } finally {
    if (prevEmail === undefined) delete process.env.ADMIN_BOOTSTRAP_EMAIL;
    else process.env.ADMIN_BOOTSTRAP_EMAIL = prevEmail;
    if (prevPass === undefined) delete process.env.ADMIN_BOOTSTRAP_PASSWORD;
    else process.env.ADMIN_BOOTSTRAP_PASSWORD = prevPass;
    await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
});

test('Deployment configuration & frontend secret isolation checks pass', () => {
  const deployWorkflow = fs.readFileSync(path.resolve('.github/workflows/deploy-pages.yml'), 'utf8');
  assert.ok(deployWorkflow.includes('VITE_API_BASE_URL'));
  assert.ok(!deployWorkflow.includes('--legacy-peer-deps'));

  const railwayConfig = JSON.parse(fs.readFileSync(path.resolve('railway.json'), 'utf8'));
  assert.equal(railwayConfig.deploy.healthcheckPath, '/api/health');

  // Verify no client files reference privileged server secrets
  const forbiddenNames = [
    'SUPABASE_SERVICE_ROLE_KEY',
    'ADMIN_BOOTSTRAP_PASSWORD',
    'ADMIN_SESSION_SECRET',
    'RESEND_API_KEY',
    'GOOGLE_SERVICE_ACCOUNT_JSON',
  ];
  const frontendDirs = ['src/components', 'src/services', 'src/lib', 'src/data'];
  for (const dir of frontendDirs) {
    const fullDir = path.resolve(dir);
    for (const entry of fs.readdirSync(fullDir, { withFileTypes: true })) {
      const entryPath = path.join(fullDir, entry.name);
      if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
        const content = fs.readFileSync(entryPath, 'utf8');
        for (const secretName of forbiddenNames) {
          assert.ok(
            !content.includes(secretName),
            `Forbidden secret identifier ${secretName} found in frontend file ${entryPath}`
          );
        }
      }
    }
  }
});
