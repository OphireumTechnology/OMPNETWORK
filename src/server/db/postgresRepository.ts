/**
 * OPHIREUM NETWORK — Native PostgreSQL Core DatabaseRepository (Phases 50–52)
 *
 * Full parameterized SQL implementation of DatabaseRepository backed by
 * Railway PostgreSQL (DATABASE_URL via PostgresPoolManager).
 */

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
} from './types';
import { PostgresPoolManager } from './postgresPool';

function toIsoString(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (val instanceof Date) return val.toISOString();
  return String(val);
}

function mapSolutionRequestRow(row: Record<string, any>): SolutionRequestRecord {
  const selectedServices = Array.isArray(row.selected_services_json) ? row.selected_services_json : [];
  const selectedOptionsMap =
    row.selected_options_json && typeof row.selected_options_json === 'object'
      ? row.selected_options_json
      : {};
  return {
    id: String(row.id),
    referenceCode: String(row.reference_code),
    idempotencyKey: row.idempotency_key || undefined,
    type: row.request_type === 'solution_builder' ? 'solution_builder' : 'contact_form',
    fullName: String(row.full_name),
    email: String(row.email),
    contactNumber: String(row.phone),
    company: String(row.organization),
    industry: row.industry || undefined,
    targetTimeline: row.target_timeline || undefined,
    selectedServices,
    selectedServiceIds: selectedServices.map((s: any) => String(s.id)).filter(Boolean),
    selectedOptionsMap,
    serviceId: selectedServices.map((s: any) => String(s.id)).join(', ') || 'general-consultation',
    serviceTitle: selectedServices.map((s: any) => String(s.title)).join(' + ') || 'General Consultation',
    estimatedOneTimeStartingUsd: Number(row.estimated_one_time_usd || 0),
    estimatedMonthlyStartingUsd: Number(row.estimated_monthly_usd || 0),
    estimatedBudget: row.estimated_budget_label || 'To be scoped via proposal',
    preferredCurrency: row.preferred_currency === 'PHP' ? 'PHP' : 'USD',
    phpConversionRate: row.php_conversion_rate ? Number(row.php_conversion_rate) : undefined,
    projectDescription: String(row.requirements_notes),
    fileName: row.attachment_filename || undefined,
    privacyConsent: Boolean(row.confidentiality_authorized),
    status: row.status || 'submitted',
    emailDeliveryStatus: row.email_delivery_status || 'pending',
    sourceChannel: row.source_channel || 'website',
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at || row.created_at),
  };
}

function mapAppointmentRow(row: Record<string, any>): AppointmentRecord {
  const schedDate =
    row.scheduled_date instanceof Date
      ? row.scheduled_date.toISOString().slice(0, 10)
      : String(row.scheduled_date);
  return {
    id: String(row.id),
    referenceCode: String(row.reference_code),
    idempotencyKey: row.idempotency_key || undefined,
    fullName: String(row.client_name || 'Client'),
    email: String(row.client_email || ''),
    phone: String(row.client_phone || ''),
    companyName: String(row.client_company || 'Enterprise Client'),
    briefReferenceCode: row.brief_reference_code || undefined,
    consultationType: row.consultation_type,
    scheduledDate: schedDate,
    scheduledTimeSlot: String(row.scheduled_time_slot),
    durationMinutes: Number(row.duration_minutes || 30),
    clientTimezone: String(row.client_timezone || 'Asia/Manila'),
    meetingLink: row.meeting_link || undefined,
    meetingLocation: row.meeting_location || undefined,
    assignedConsultant: String(row.assigned_consultant || 'Dhenze Languisan (Founder & CEO)'),
    status: row.status || 'pending_review',
    calendarSyncStatus: row.calendar_sync_status || 'unconfigured',
    calendarEventId: row.calendar_event_id || undefined,
    managementTokenHash: row.management_token_hash || undefined,
    notes: row.notes || undefined,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at || row.created_at),
  };
}

function mapOutboxRow(row: Record<string, any>): EmailOutboxRecord {
  return {
    id: String(row.id),
    dedupeKey: String(row.dedupe_key),
    entityType: row.entity_type,
    entityReference: String(row.entity_reference),
    recipientEmail: String(row.recipient_email),
    notificationType: row.notification_type,
    subject: String(row.subject),
    htmlBody: String(row.html_body),
    textBody: String(row.text_body),
    status: row.status,
    provider: String(row.provider || 'resend'),
    providerReference: row.provider_reference || undefined,
    deliveryAttempts: Number(row.delivery_attempts || 0),
    lastError: row.last_error || undefined,
    nextRetryAt: row.next_retry_at ? toIsoString(row.next_retry_at) : undefined,
    sentAt: row.sent_at ? toIsoString(row.sent_at) : undefined,
    metadata: row.metadata || undefined,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at || row.created_at),
  };
}

export class PostgresDatabaseRepository implements DatabaseRepository {
  public readonly isConfigured: boolean;
  public readonly pool: PostgresPoolManager;

  constructor(pool?: PostgresPoolManager) {
    this.pool = pool || new PostgresPoolManager();
    this.isConfigured = this.pool.isConfigured;
  }

  private assertConfigured(): void {
    if (!this.isConfigured) {
      throw new DatabaseUnavailableError(
        'Native PostgreSQL persistence (DATABASE_URL) is not configured on this server.'
      );
    }
  }

  async ping(): Promise<{ ok: boolean; configured: boolean; latencyMs?: number; error?: string }> {
    return this.pool.ping();
  }

  async close(): Promise<void> {
    await this.pool.close();
  }

  async findSolutionRequestByIdempotencyKey(key: string): Promise<SolutionRequestRecord | null> {
    this.assertConfigured();
    try {
      const { rows } = await this.pool.query(
        'SELECT * FROM public.solution_requests WHERE idempotency_key = $1 LIMIT 1',
        [key]
      );
      return rows[0] ? mapSolutionRequestRow(rows[0]) : null;
    } catch (err: any) {
      throw new DatabaseUnavailableError(`Failed to query idempotency key: ${err?.message}`);
    }
  }

  async createSolutionRequest(input: CreateSolutionRequestInput): Promise<{
    record: SolutionRequestRecord;
    created: boolean;
  }> {
    this.assertConfigured();
    if (input.idempotencyKey) {
      const existing = await this.findSolutionRequestByIdempotencyKey(input.idempotencyKey);
      if (existing) return { record: existing, created: false };
    }

    try {
      const { rows } = await this.pool.query(
        `INSERT INTO public.solution_requests (
          reference_code, idempotency_key, request_type, full_name, email, phone, organization,
          industry, target_timeline, selected_services_json, selected_options_json,
          estimated_one_time_usd, estimated_monthly_usd, preferred_currency, php_conversion_rate,
          estimated_budget_label, requirements_notes, attachment_filename, confidentiality_authorized,
          status, email_delivery_status, source_channel, client_ip
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10::jsonb, $11::jsonb,
          $12, $13, $14, $15,
          $16, $17, $18, $19,
          'submitted', 'pending', 'website', $20
        ) RETURNING *`,
        [
          input.referenceCode,
          input.idempotencyKey || null,
          input.type,
          input.fullName,
          input.email,
          input.contactNumber,
          input.company,
          input.industry || null,
          input.targetTimeline || null,
          JSON.stringify(input.selectedServices),
          JSON.stringify(input.selectedOptionsMap),
          input.estimatedOneTimeStartingUsd,
          input.estimatedMonthlyStartingUsd,
          input.preferredCurrency,
          input.phpConversionRate || null,
          input.estimatedBudget,
          input.projectDescription,
          input.fileName || null,
          input.privacyConsent,
          input.clientIp || null,
        ]
      );
      return { record: mapSolutionRequestRow(rows[0]), created: true };
    } catch (err: any) {
      if (err?.code === '23505' && input.idempotencyKey) {
        const raced = await this.findSolutionRequestByIdempotencyKey(input.idempotencyKey);
        if (raced) return { record: raced, created: false };
      }
      throw new DatabaseUnavailableError(`Failed to persist solution request: ${err?.message}`);
    }
  }

  async updateSolutionRequestEmailStatus(
    referenceCode: string,
    emailDeliveryStatus: 'pending' | 'sent' | 'failed' | 'unconfigured'
  ): Promise<void> {
    this.assertConfigured();
    try {
      await this.pool.query(
        `UPDATE public.solution_requests
         SET email_delivery_status = $1, updated_at = NOW()
         WHERE reference_code = $2`,
        [emailDeliveryStatus, referenceCode]
      );
    } catch (err: any) {
      throw new DatabaseUnavailableError(`Failed to update email delivery status: ${err?.message}`);
    }
  }

  async updateSolutionRequestStatus(
    referenceCode: string,
    status: SolutionRequestRecord['status']
  ): Promise<SolutionRequestRecord> {
    this.assertConfigured();
    const { rows } = await this.pool.query(
      `UPDATE public.solution_requests
       SET status = $1, updated_at = NOW()
       WHERE reference_code = $2
       RETURNING *`,
      [status, referenceCode]
    );
    if (!rows[0]) {
      throw new NotFoundError(`Solution request ${referenceCode} not found.`);
    }
    return mapSolutionRequestRow(rows[0]);
  }

  async listSolutionRequests(options: {
    limit: number;
    offset: number;
    status?: string;
  }): Promise<{ records: SolutionRequestRecord[]; total: number }> {
    this.assertConfigured();
    try {
      const whereClause = options.status ? 'WHERE status = $1' : '';
      const countParams = options.status ? [options.status] : [];
      const listParams = options.status
        ? [options.status, options.limit, options.offset]
        : [options.limit, options.offset];
      const limitIdx = options.status ? '$2' : '$1';
      const offsetIdx = options.status ? '$3' : '$2';

      const [countRes, listRes] = await Promise.all([
        this.pool.query(`SELECT COUNT(*)::int AS total FROM public.solution_requests ${whereClause}`, countParams),
        this.pool.query(
          `SELECT * FROM public.solution_requests ${whereClause}
           ORDER BY created_at DESC LIMIT ${limitIdx} OFFSET ${offsetIdx}`,
          listParams
        ),
      ]);
      return {
        records: listRes.rows.map(mapSolutionRequestRow),
        total: Number(countRes.rows[0]?.total || 0),
      };
    } catch (err: any) {
      throw new DatabaseUnavailableError(`Failed to list solution requests: ${err?.message}`);
    }
  }

  async getBookedSlotsForDate(scheduledDate: string): Promise<string[]> {
    this.assertConfigured();
    try {
      const { rows } = await this.pool.query(
        `SELECT scheduled_time_slot
         FROM public.consultation_appointments
         WHERE scheduled_date = $1 AND status IN ('pending_review', 'confirmed')`,
        [scheduledDate]
      );
      return rows.map((r) => String(r.scheduled_time_slot));
    } catch (err: any) {
      throw new DatabaseUnavailableError(`Failed to inspect booked appointment slots: ${err?.message}`);
    }
  }

  async createAppointment(input: CreateAppointmentInput): Promise<{
    record: AppointmentRecord;
    created: boolean;
  }> {
    this.assertConfigured();
    if (input.idempotencyKey) {
      const { rows: existing } = await this.pool.query(
        'SELECT * FROM public.consultation_appointments WHERE idempotency_key = $1 LIMIT 1',
        [input.idempotencyKey]
      );
      if (existing[0]) return { record: mapAppointmentRow(existing[0]), created: false };
    }

    try {
      const { rows } = await this.pool.query(
        `INSERT INTO public.consultation_appointments (
          reference_code, idempotency_key, client_name, client_email, client_phone, client_company,
          brief_reference_code, consultation_type, scheduled_date, scheduled_time_slot,
          duration_minutes, client_timezone, meeting_link, meeting_location, assigned_consultant,
          status, calendar_sync_status, calendar_event_id, management_token_hash, notes
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10,
          $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20
        ) RETURNING *`,
        [
          input.referenceCode,
          input.idempotencyKey || null,
          input.fullName,
          input.email,
          input.phone,
          input.companyName,
          input.briefReferenceCode || null,
          input.consultationType,
          input.scheduledDate,
          input.scheduledTimeSlot,
          input.durationMinutes,
          input.clientTimezone,
          input.meetingLink || null,
          input.meetingLocation || null,
          input.assignedConsultant,
          input.status,
          input.calendarSyncStatus,
          input.calendarEventId || null,
          input.managementTokenHash,
          input.notes || null,
        ]
      );
      return { record: mapAppointmentRow(rows[0]), created: true };
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new ConflictError(
          `The slot ${input.scheduledTimeSlot} on ${input.scheduledDate} has just been reserved. Please select another slot.`
        );
      }
      throw new DatabaseUnavailableError(`Failed to persist consultation request: ${err?.message}`);
    }
  }

  async getAppointmentByReference(referenceCode: string): Promise<AppointmentRecord | null> {
    this.assertConfigured();
    try {
      const { rows } = await this.pool.query(
        'SELECT * FROM public.consultation_appointments WHERE reference_code = $1 LIMIT 1',
        [referenceCode]
      );
      return rows[0] ? mapAppointmentRow(rows[0]) : null;
    } catch (err: any) {
      throw new DatabaseUnavailableError(`Failed to retrieve appointment: ${err?.message}`);
    }
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
    this.assertConfigured();
    const sets: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];

    const pushField = (col: string, val: unknown) => {
      params.push(val);
      sets.push(`${col} = $${params.length}`);
    };

    if (patch.scheduledDate !== undefined) pushField('scheduled_date', patch.scheduledDate);
    if (patch.scheduledTimeSlot !== undefined) pushField('scheduled_time_slot', patch.scheduledTimeSlot);
    if (patch.status !== undefined) pushField('status', patch.status);
    if (patch.meetingLink !== undefined) pushField('meeting_link', patch.meetingLink);
    if (patch.calendarSyncStatus !== undefined) pushField('calendar_sync_status', patch.calendarSyncStatus);
    if (patch.calendarEventId !== undefined) pushField('calendar_event_id', patch.calendarEventId);
    if (patch.notes !== undefined) pushField('notes', patch.notes);

    params.push(referenceCode);
    try {
      const { rows } = await this.pool.query(
        `UPDATE public.consultation_appointments
         SET ${sets.join(', ')}
         WHERE reference_code = $${params.length}
         RETURNING *`,
        params
      );
      if (!rows[0]) {
        throw new NotFoundError(`Appointment ${referenceCode} not found.`);
      }
      return mapAppointmentRow(rows[0]);
    } catch (err: any) {
      if (err instanceof NotFoundError) throw err;
      if (err?.code === '23505') {
        throw new ConflictError('Requested replacement slot is already booked.');
      }
      throw new DatabaseUnavailableError(`Failed to update appointment: ${err?.message}`);
    }
  }

  async listAppointments(options: { limit: number; offset: number }): Promise<{
    records: AppointmentRecord[];
    total: number;
  }> {
    this.assertConfigured();
    try {
      const [countRes, listRes] = await Promise.all([
        this.pool.query('SELECT COUNT(*)::int AS total FROM public.consultation_appointments'),
        this.pool.query(
          `SELECT * FROM public.consultation_appointments
           ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
          [options.limit, options.offset]
        ),
      ]);
      return {
        records: listRes.rows.map(mapAppointmentRow),
        total: Number(countRes.rows[0]?.total || 0),
      };
    } catch (err: any) {
      throw new DatabaseUnavailableError(`Failed to list appointments: ${err?.message}`);
    }
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
  }): Promise<{ record: EmailOutboxRecord; created: boolean }> {
    this.assertConfigured();
    const { rows: existing } = await this.pool.query(
      'SELECT * FROM public.notification_records WHERE dedupe_key = $1 LIMIT 1',
      [input.dedupeKey]
    );
    if (existing[0]) {
      return { record: mapOutboxRow(existing[0]), created: false };
    }

    try {
      const { rows } = await this.pool.query(
        `INSERT INTO public.notification_records (
          dedupe_key, entity_type, entity_reference, recipient_email, notification_type,
          subject, html_body, text_body, status, provider, delivery_attempts, metadata
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, 'queued', 'resend', 0, $9::jsonb
        ) RETURNING *`,
        [
          input.dedupeKey,
          input.entityType,
          input.entityReference,
          input.recipientEmail,
          input.notificationType,
          input.subject,
          input.htmlBody,
          input.textBody,
          JSON.stringify(input.metadata || {}),
        ]
      );
      return { record: mapOutboxRow(rows[0]), created: true };
    } catch (err: any) {
      throw new DatabaseUnavailableError(`Failed to enqueue notification outbox: ${err?.message}`);
    }
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
  ): Promise<void> {
    this.assertConfigured();
    try {
      await this.pool.query(
        `UPDATE public.notification_records
         SET status = $1,
             provider_reference = $2,
             delivery_attempts = $3,
             last_error = $4,
             next_retry_at = $5,
             sent_at = $6,
             updated_at = NOW()
         WHERE id = $7`,
        [
          patch.status,
          patch.providerReference || null,
          patch.deliveryAttempts,
          patch.lastError || null,
          patch.nextRetryAt || null,
          patch.sentAt || null,
          id,
        ]
      );
    } catch (err: any) {
      throw new DatabaseUnavailableError(`Failed to update outbox status: ${err?.message}`);
    }
  }

  async updateOutboxByProviderReference(
    providerReference: string,
    status: EmailOutboxRecord['status'],
    lastError?: string
  ): Promise<boolean> {
    if (!this.isConfigured || !providerReference) return false;
    const { rows } = await this.pool.query(
      `UPDATE public.notification_records
       SET status = $1,
           last_error = COALESCE($2, last_error),
           updated_at = NOW()
       WHERE provider_reference = $3
       RETURNING id`,
      [status, lastError ?? null, providerReference]
    );
    return rows.length > 0;
  }

  async listRetryableOutbox(limit = 20): Promise<EmailOutboxRecord[]> {
    this.assertConfigured();
    try {
      const { rows } = await this.pool.query(
        `SELECT * FROM public.notification_records
         WHERE status IN ('queued', 'failed')
           AND delivery_attempts < 5
           AND (next_retry_at IS NULL OR next_retry_at <= NOW())
         ORDER BY created_at ASC
         LIMIT $1`,
        [limit]
      );
      return rows.map(mapOutboxRow);
    } catch (err: any) {
      throw new DatabaseUnavailableError(`Failed to list retryable outbox records: ${err?.message}`);
    }
  }

  async writeAuditLog(input: Omit<AuditLogRecord, 'id' | 'createdAt'>): Promise<void> {
    if (!this.isConfigured) return;
    try {
      await this.pool.query(
        `INSERT INTO public.audit_logs (
          correlation_id, actor, actor_role, action, entity_type, entity_id, details
        ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
        [
          input.correlationId || null,
          input.actor,
          input.actorRole,
          input.action,
          input.entityType,
          input.entityId || null,
          JSON.stringify(input.details || {}),
        ]
      );
    } catch {
      // Audit log persistence errors are surfaced via structured logger without masking primary response
    }
  }

  async listAuditLogs(options: { limit: number; offset: number }): Promise<{
    records: AuditLogRecord[];
    total: number;
  }> {
    this.assertConfigured();
    try {
      const [countRes, listRes] = await Promise.all([
        this.pool.query('SELECT COUNT(*)::int AS total FROM public.audit_logs'),
        this.pool.query(
          `SELECT * FROM public.audit_logs
           ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
          [options.limit, options.offset]
        ),
      ]);
      return {
        records: listRes.rows.map((row) => ({
          id: String(row.id),
          correlationId: row.correlation_id || undefined,
          actor: String(row.actor),
          actorRole: String(row.actor_role || 'system'),
          action: String(row.action),
          entityType: String(row.entity_type),
          entityId: row.entity_id || undefined,
          details: row.details || {},
          createdAt: toIsoString(row.created_at),
        })),
        total: Number(countRes.rows[0]?.total || 0),
      };
    } catch (err: any) {
      throw new DatabaseUnavailableError(`Failed to list audit logs: ${err?.message}`);
    }
  }

  async findActiveAdminByEmail(email: string, authUserId?: string): Promise<AdminUserRecord | null> {
    const normalized = email.trim().toLowerCase();
    const validRoles = new Set([
      'super_admin',
      'admin',
      'operations_manager',
      'finance_officer',
      'sales_officer',
      'project_manager',
      'developer',
      'support_officer',
      'auditor',
    ]);
    const normalizeRole = (raw: unknown): AdminUserRecord['role'] => {
      const value = String(raw || '').trim();
      return validRoles.has(value) ? (value as AdminUserRecord['role']) : 'admin';
    };

    if (this.isConfigured) {
      const isUuid =
        typeof authUserId === 'string' &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(authUserId);
      if (isUuid) {
        const { rows } = await this.pool.query(
          `SELECT id, email, full_name, role, is_active
           FROM public.admin_users
           WHERE is_active = true AND auth_user_id = $1
           LIMIT 1`,
          [authUserId]
        );
        if (rows[0]) {
          return {
            id: String(rows[0].id),
            email: String(rows[0].email),
            fullName: String(rows[0].full_name),
            role: normalizeRole(rows[0].role),
            isActive: Boolean(rows[0].is_active),
          };
        }
      }

      if (normalized) {
        const { rows } = await this.pool.query(
          `SELECT id, email, full_name, role, is_active
           FROM public.admin_users
           WHERE is_active = true AND LOWER(email) = $1
           LIMIT 1`,
          [normalized]
        );
        if (rows[0]) {
          return {
            id: String(rows[0].id),
            email: String(rows[0].email),
            fullName: String(rows[0].full_name),
            role: normalizeRole(rows[0].role),
            isActive: Boolean(rows[0].is_active),
          };
        }
      }
    }

    const bootstrapEmail = (process.env.ADMIN_BOOTSTRAP_EMAIL || '').trim().toLowerCase();
    const envAllowlist = (process.env.ADMIN_ALLOWLIST_EMAILS || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    if (
      normalized &&
      ((bootstrapEmail && normalized === bootstrapEmail) || envAllowlist.includes(normalized))
    ) {
      return {
        id: 'env-bootstrap-admin',
        email: normalized,
        fullName: 'OPHIREUM Administrator',
        role: 'super_admin',
        isActive: true,
      };
    }

    return null;
  }

  async verifySupabaseUserToken(_token: string): Promise<{ id: string; email: string } | null> {
    // Native PostgreSQL mode verifies sessions via HMAC admin tokens and portal_auth_sessions.
    return null;
  }
}
