/*
Copyright (c) 2026 Ophireum Multimedia Production. All rights reserved.
Developer and claimed rights holder: Ophireum Multimedia Production
DTI-registered business, Philippines | Registration No. 7567003
SPDX-FileCopyrightText: 2026 Ophireum Multimedia Production
SPDX-License-Identifier: LicenseRef-Ophireum-Proprietary
Third-party materials, dependencies, and separately licensed components remain subject to their respective rights and licenses.
*/

import { createClient, SupabaseClient } from '@supabase/supabase-js';
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

function mapSolutionRequestRow(row: any): SolutionRequestRecord {
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
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at || row.created_at),
  };
}

function mapAppointmentRow(row: any): AppointmentRecord {
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
    scheduledDate: String(row.scheduled_date),
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
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at || row.created_at),
  };
}

function mapOutboxRow(row: any): EmailOutboxRecord {
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
    nextRetryAt: row.next_retry_at || undefined,
    sentAt: row.sent_at || undefined,
    metadata: row.metadata || undefined,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at || row.created_at),
  };
}

export class SupabaseDatabaseRepository implements DatabaseRepository {
  public readonly isConfigured: boolean;
  private readonly client: SupabaseClient | null;

  constructor(supabaseUrl?: string, serviceRoleKey?: string) {
    const url = (supabaseUrl || process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim();
    const key = (serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
    this.isConfigured = Boolean(url && key && !url.includes('your-ompnetwork-id'));
    this.client = this.isConfigured
      ? createClient(url, key, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        })
      : null;
  }

  private getClient(): SupabaseClient {
    if (!this.client) {
      throw new DatabaseUnavailableError(
        'PostgreSQL/Supabase persistence is not configured on this server. Request could not be saved.'
      );
    }
    return this.client;
  }

  async ping(): Promise<{ ok: boolean; configured: boolean; latencyMs?: number; error?: string }> {
    if (!this.client) {
      return {
        ok: false,
        configured: false,
        error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not configured.',
      };
    }
    const start = Date.now();
    try {
      const { error } = await this.client.from('solution_requests').select('id', { count: 'exact', head: true }).limit(1);
      if (error) {
        return {
          ok: false,
          configured: true,
          latencyMs: Date.now() - start,
          error: error.message,
        };
      }
      return { ok: true, configured: true, latencyMs: Date.now() - start };
    } catch (err: any) {
      return {
        ok: false,
        configured: true,
        latencyMs: Date.now() - start,
        error: err?.message || 'Database ping failed',
      };
    }
  }

  async findSolutionRequestByIdempotencyKey(key: string): Promise<SolutionRequestRecord | null> {
    const db = this.getClient();
    const { data, error } = await db
      .from('solution_requests')
      .select('*')
      .eq('idempotency_key', key)
      .maybeSingle();

    if (error) {
      throw new DatabaseUnavailableError(`Failed to query idempotency key: ${error.message}`);
    }
    return data ? mapSolutionRequestRow(data) : null;
  }

  async createSolutionRequest(input: CreateSolutionRequestInput): Promise<{
    record: SolutionRequestRecord;
    created: boolean;
  }> {
    const db = this.getClient();

    if (input.idempotencyKey) {
      const existing = await this.findSolutionRequestByIdempotencyKey(input.idempotencyKey);
      if (existing) {
        return { record: existing, created: false };
      }
    }

    const { data, error } = await db
      .from('solution_requests')
      .insert({
        reference_code: input.referenceCode,
        idempotency_key: input.idempotencyKey || null,
        request_type: input.type,
        full_name: input.fullName,
        email: input.email,
        phone: input.contactNumber,
        organization: input.company,
        industry: input.industry || null,
        target_timeline: input.targetTimeline || null,
        selected_services_json: input.selectedServices,
        selected_options_json: input.selectedOptionsMap,
        estimated_one_time_usd: input.estimatedOneTimeStartingUsd,
        estimated_monthly_usd: input.estimatedMonthlyStartingUsd,
        preferred_currency: input.preferredCurrency,
        php_conversion_rate: input.phpConversionRate || null,
        estimated_budget_label: input.estimatedBudget,
        requirements_notes: input.projectDescription,
        attachment_filename: input.fileName || null,
        confidentiality_authorized: input.privacyConsent,
        status: 'submitted',
        email_delivery_status: 'pending',
        source_channel: 'website',
        client_ip: input.clientIp || null,
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505' && input.idempotencyKey) {
        const raced = await this.findSolutionRequestByIdempotencyKey(input.idempotencyKey);
        if (raced) return { record: raced, created: false };
      }
      throw new DatabaseUnavailableError(`Failed to persist solution request: ${error.message}`);
    }

    return { record: mapSolutionRequestRow(data), created: true };
  }

  async updateSolutionRequestEmailStatus(
    referenceCode: string,
    emailDeliveryStatus: 'pending' | 'sent' | 'failed' | 'unconfigured'
  ): Promise<void> {
    const db = this.getClient();
    const { error } = await db
      .from('solution_requests')
      .update({ email_delivery_status: emailDeliveryStatus, updated_at: new Date().toISOString() })
      .eq('reference_code', referenceCode);

    if (error) {
      throw new DatabaseUnavailableError(`Failed to update email delivery status: ${error.message}`);
    }
  }

  async listSolutionRequests(options: {
    limit: number;
    offset: number;
    status?: string;
  }): Promise<{ records: SolutionRequestRecord[]; total: number }> {
    const db = this.getClient();
    let query = db
      .from('solution_requests')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(options.offset, options.offset + options.limit - 1);

    if (options.status) {
      query = query.eq('status', options.status);
    }

    const { data, count, error } = await query;
    if (error) {
      throw new DatabaseUnavailableError(`Failed to list solution requests: ${error.message}`);
    }
    return {
      records: (data || []).map(mapSolutionRequestRow),
      total: Number(count ?? (data || []).length),
    };
  }

  async getBookedSlotsForDate(scheduledDate: string): Promise<string[]> {
    const db = this.getClient();
    const { data, error } = await db
      .from('consultation_appointments')
      .select('scheduled_time_slot')
      .eq('scheduled_date', scheduledDate)
      .in('status', ['pending_review', 'confirmed']);

    if (error) {
      throw new DatabaseUnavailableError(`Failed to inspect booked appointment slots: ${error.message}`);
    }
    return (data || []).map((r: any) => String(r.scheduled_time_slot));
  }

  async createAppointment(input: CreateAppointmentInput): Promise<{
    record: AppointmentRecord;
    created: boolean;
  }> {
    const db = this.getClient();

    if (input.idempotencyKey) {
      const { data: existing, error: idempErr } = await db
        .from('consultation_appointments')
        .select('*')
        .eq('idempotency_key', input.idempotencyKey)
        .maybeSingle();
      if (idempErr) {
        throw new DatabaseUnavailableError(`Failed to verify appointment idempotency: ${idempErr.message}`);
      }
      if (existing) {
        return { record: mapAppointmentRow(existing), created: false };
      }
    }

    const { data, error } = await db
      .from('consultation_appointments')
      .insert({
        reference_code: input.referenceCode,
        idempotency_key: input.idempotencyKey || null,
        client_name: input.fullName,
        client_email: input.email,
        client_phone: input.phone,
        client_company: input.companyName,
        brief_reference_code: input.briefReferenceCode || null,
        consultation_type: input.consultationType,
        scheduled_date: input.scheduledDate,
        scheduled_time_slot: input.scheduledTimeSlot,
        duration_minutes: input.durationMinutes,
        client_timezone: input.clientTimezone,
        meeting_link: input.meetingLink || null,
        meeting_location: input.meetingLocation || null,
        assigned_consultant: input.assignedConsultant,
        status: input.status,
        calendar_sync_status: input.calendarSyncStatus,
        calendar_event_id: input.calendarEventId || null,
        management_token_hash: input.managementTokenHash,
        notes: input.notes || null,
      })
      .select('*')
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new ConflictError(
          `The slot ${input.scheduledTimeSlot} on ${input.scheduledDate} has just been reserved. Please select another slot.`
        );
      }
      throw new DatabaseUnavailableError(`Failed to persist consultation request: ${error.message}`);
    }

    return { record: mapAppointmentRow(data), created: true };
  }

  async getAppointmentByReference(referenceCode: string): Promise<AppointmentRecord | null> {
    const db = this.getClient();
    const { data, error } = await db
      .from('consultation_appointments')
      .select('*')
      .eq('reference_code', referenceCode)
      .maybeSingle();

    if (error) {
      throw new DatabaseUnavailableError(`Failed to retrieve appointment: ${error.message}`);
    }
    return data ? mapAppointmentRow(data) : null;
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
    const db = this.getClient();
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (patch.scheduledDate !== undefined) updatePayload.scheduled_date = patch.scheduledDate;
    if (patch.scheduledTimeSlot !== undefined) updatePayload.scheduled_time_slot = patch.scheduledTimeSlot;
    if (patch.status !== undefined) updatePayload.status = patch.status;
    if (patch.meetingLink !== undefined) updatePayload.meeting_link = patch.meetingLink;
    if (patch.calendarSyncStatus !== undefined) updatePayload.calendar_sync_status = patch.calendarSyncStatus;
    if (patch.calendarEventId !== undefined) updatePayload.calendar_event_id = patch.calendarEventId;
    if (patch.notes !== undefined) updatePayload.notes = patch.notes;

    const { data, error } = await db
      .from('consultation_appointments')
      .update(updatePayload)
      .eq('reference_code', referenceCode)
      .select('*')
      .maybeSingle();

    if (error) {
      if (error.code === '23505') {
        throw new ConflictError('Requested replacement slot is already booked.');
      }
      throw new DatabaseUnavailableError(`Failed to update appointment: ${error.message}`);
    }
    if (!data) {
      throw new NotFoundError(`Appointment ${referenceCode} not found.`);
    }
    return mapAppointmentRow(data);
  }

  async listAppointments(options: { limit: number; offset: number }): Promise<{
    records: AppointmentRecord[];
    total: number;
  }> {
    const db = this.getClient();
    const { data, count, error } = await db
      .from('consultation_appointments')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(options.offset, options.offset + options.limit - 1);

    if (error) {
      throw new DatabaseUnavailableError(`Failed to list appointments: ${error.message}`);
    }
    return {
      records: (data || []).map(mapAppointmentRow),
      total: Number(count ?? (data || []).length),
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
    const db = this.getClient();

    const { data: existing } = await db
      .from('notification_records')
      .select('*')
      .eq('dedupe_key', input.dedupeKey)
      .maybeSingle();
    if (existing) {
      return { record: mapOutboxRow(existing), created: false };
    }

    const { data, error } = await db
      .from('notification_records')
      .insert({
        dedupe_key: input.dedupeKey,
        entity_type: input.entityType,
        entity_reference: input.entityReference,
        recipient_email: input.recipientEmail,
        notification_type: input.notificationType,
        subject: input.subject,
        html_body: input.htmlBody,
        text_body: input.textBody,
        status: 'queued',
        provider: 'resend',
        delivery_attempts: 0,
        metadata: input.metadata || {},
      })
      .select('*')
      .single();

    if (error) {
      throw new DatabaseUnavailableError(`Failed to enqueue notification outbox: ${error.message}`);
    }
    return { record: mapOutboxRow(data), created: true };
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
    const db = this.getClient();
    const { error } = await db
      .from('notification_records')
      .update({
        status: patch.status,
        provider_reference: patch.providerReference || null,
        delivery_attempts: patch.deliveryAttempts,
        last_error: patch.lastError || null,
        next_retry_at: patch.nextRetryAt || null,
        sent_at: patch.sentAt || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      throw new DatabaseUnavailableError(`Failed to update outbox status: ${error.message}`);
    }
  }

  async listRetryableOutbox(limit = 20): Promise<EmailOutboxRecord[]> {
    const db = this.getClient();
    const nowIso = new Date().toISOString();
    const { data, error } = await db
      .from('notification_records')
      .select('*')
      .in('status', ['queued', 'failed'])
      .lt('delivery_attempts', 5)
      .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
      .order('created_at', { ascending: true })
      .limit(limit);

    if (error) {
      throw new DatabaseUnavailableError(`Failed to list retryable outbox records: ${error.message}`);
    }
    return (data || []).map(mapOutboxRow);
  }

  async writeAuditLog(input: Omit<AuditLogRecord, 'id' | 'createdAt'>): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.from('audit_logs').insert({
        correlation_id: input.correlationId || null,
        actor: input.actor,
        actor_role: input.actorRole,
        action: input.action,
        entity_type: input.entityType,
        entity_id: input.entityId || null,
        details: input.details || {},
      });
    } catch {
      // Audit log persistence errors are logged by caller without masking primary response
    }
  }

  async listAuditLogs(options: { limit: number; offset: number }): Promise<{
    records: AuditLogRecord[];
    total: number;
  }> {
    const db = this.getClient();
    const { data, count, error } = await db
      .from('audit_logs')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(options.offset, options.offset + options.limit - 1);

    if (error) {
      throw new DatabaseUnavailableError(`Failed to list audit logs: ${error.message}`);
    }

    return {
      records: (data || []).map((row: any) => ({
        id: String(row.id),
        correlationId: row.correlation_id || undefined,
        actor: String(row.actor),
        actorRole: String(row.actor_role || 'system'),
        action: String(row.action),
        entityType: String(row.entity_type),
        entityId: row.entity_id || undefined,
        details: row.details || {},
        createdAt: String(row.created_at),
      })),
      total: Number(count ?? (data || []).length),
    };
  }

  async findActiveAdminByEmail(email: string, authUserId?: string): Promise<AdminUserRecord | null> {
    const normalized = email.trim().toLowerCase();

    if (this.client) {
      let query = this.client
        .from('admin_users')
        .select('*')
        .eq('is_active', true);

      if (authUserId) {
        // A Supabase JWT is privileged only when its verified Auth UUID is explicitly
        // bound to the active admin row. Email is an additional consistency check,
        // never an alternate identity or account-recovery mechanism.
        query = query.eq('auth_user_id', authUserId).eq('email', normalized);
      } else {
        query = query.eq('email', normalized);
      }

      const { data, error } = await query.maybeSingle();
      if (!error && data) {
        return {
          id: String(data.id),
          authUserId: data.auth_user_id ? String(data.auth_user_id) : undefined,
          email: String(data.email),
          fullName: String(data.full_name),
          role: data.role === 'super_admin' ? 'super_admin' : 'admin',
          isActive: Boolean(data.is_active),
        };
      }
    }

    // Server bootstrap/allowlist identities are intentionally available only to
    // the separate bootstrap/signed-session path. They must never satisfy a
    // Supabase Auth UUID lookup, even when the email matches.
    if (!authUserId) {
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
          fullName: 'OPHIRIUM Administrator',
          role: 'super_admin',
          isActive: true,
        };
      }
    }

    return null;
  }

  async verifySupabaseUserToken(token: string): Promise<{ id: string; email: string } | null> {
    if (!this.client || !token) return null;
    try {
      const { data, error } = await this.client.auth.getUser(token);
      if (error || !data?.user?.email) return null;
      return {
        id: data.user.id,
        email: data.user.email,
      };
    } catch {
      return null;
    }
  }
}
