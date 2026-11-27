import crypto from 'node:crypto';
import {
  DatabaseRepository,
  AdminUserRecord,
  AdminRole,
  SolutionRequestRecord,
  AppointmentRecord,
  AuditLogRecord,
  EmailOutboxRecord,
  CreateSolutionRequestInput,
  CreateAppointmentInput,
  NotFoundError,
} from '../src/server/db/types';

export const ALL_NINE_ROLES: AdminRole[] = [
  'super_admin',
  'admin',
  'operations_manager',
  'finance_officer',
  'sales_officer',
  'project_manager',
  'developer',
  'support_officer',
  'auditor',
];

export class InMemoryTestDatabase implements DatabaseRepository {
  public readonly isConfigured = true;
  public solutionRequests: SolutionRequestRecord[] = [];
  public appointments: AppointmentRecord[] = [];
  public auditLogs: AuditLogRecord[] = [];
  public outbox: EmailOutboxRecord[] = [];
  public admins: AdminUserRecord[] = [
    ...ALL_NINE_ROLES.map((role, idx) => ({
      id: `adm-${role}-${idx}`,
      email: `${role}@ophireum.test`,
      fullName: `Role ${role}`,
      role,
      isActive: true,
    })),
    {
      id: 'env-bootstrap-admin',
      email: 'ceo@ophireum.test',
      fullName: 'CEO Admin',
      role: 'super_admin',
      isActive: true,
    },
    {
      id: 'adm-mfa',
      email: 'mfa-officer@ophireum.test',
      fullName: 'MFA Officer',
      role: 'super_admin',
      isActive: true,
    },
    {
      id: 'adm-csv',
      email: 'csv@ophireum.test',
      fullName: 'CSV Admin',
      role: 'super_admin',
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
    return { total: filtered.length, records: filtered.slice(opts.offset, opts.offset + opts.limit) };
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
        'status' | 'scheduledDate' | 'scheduledTimeSlot' | 'calendarSyncStatus' | 'calendarEventId' | 'meetingLink'
      >
    >
  ): Promise<AppointmentRecord> {
    const rec = this.appointments.find((a) => a.referenceCode === referenceCode);
    if (!rec) throw new NotFoundError('Appointment not found');
    Object.assign(rec, patch, { updatedAt: new Date().toISOString() });
    return rec;
  }

  async listAppointments(opts: { limit: number; offset: number }) {
    return { total: this.appointments.length, records: this.appointments.slice(opts.offset, opts.offset + opts.limit) };
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
  }) {
    const existing = this.outbox.find((o) => o.dedupeKey === input.dedupeKey);
    if (existing) return { record: existing, created: false };
    const now = new Date().toISOString();
    const rec: EmailOutboxRecord = {
      ...input,
      id: crypto.randomUUID(),
      provider: 'resend',
      status: 'queued',
      deliveryAttempts: 0,
      createdAt: now,
      updatedAt: now,
    };
    this.outbox.unshift(rec);
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
      rec.nextRetryAt = patch.nextRetryAt ?? undefined;
      rec.sentAt = patch.sentAt ?? undefined;
      rec.updatedAt = new Date().toISOString();
    }
  }

  async listRetryableOutbox(limit: number): Promise<EmailOutboxRecord[]> {
    return this.outbox.filter((o) => o.status === 'failed' || o.status === 'retrying').slice(0, limit);
  }

  async updateOutboxByProviderReference(
    providerReference: string,
    status: EmailOutboxRecord['status'],
    lastError?: string
  ): Promise<boolean> {
    const rec = this.outbox.find((o) => o.providerReference === providerReference);
    if (!rec) return false;
    rec.status = status;
    if (lastError) rec.lastError = lastError;
    return true;
  }

  async writeAuditLog(input: {
    correlationId?: string;
    actor: string;
    actorRole: string;
    action: string;
    entityType: string;
    entityId?: string;
    details?: Record<string, unknown>;
  }) {
    this.auditLogs.unshift({
      id: crypto.randomUUID(),
      correlationId: input.correlationId,
      actor: input.actor,
      actorRole: input.actorRole,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      details: input.details || {},
      createdAt: new Date().toISOString(),
    });
  }

  async listAuditLogs(opts: { limit: number; offset: number }) {
    return { total: this.auditLogs.length, records: this.auditLogs.slice(opts.offset, opts.offset + opts.limit) };
  }

  async findActiveAdminByEmail(email: string, authUserId?: string): Promise<AdminUserRecord | null> {
    const normalized = email.trim().toLowerCase();
    return (
      this.admins.find(
        (a) => a.isActive && (a.email.toLowerCase() === normalized || (authUserId && a.id === authUserId))
      ) || null
    );
  }

  async verifySupabaseUserToken(_accessToken: string): Promise<{ id: string; email: string } | null> {
    return null;
  }
}
