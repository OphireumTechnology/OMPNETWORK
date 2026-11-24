/*
Copyright (c) 2026 Ophireum Multimedia Production. All rights reserved.
Developer and claimed rights holder: Ophireum Multimedia Production
DTI-registered business, Philippines | Registration No. 7567003
SPDX-FileCopyrightText: 2026 Ophireum Multimedia Production
SPDX-License-Identifier: LicenseRef-Ophireum-Proprietary
Third-party materials, dependencies, and separately licensed components remain subject to their respective rights and licenses.
*/

export class DatabaseUnavailableError extends Error {
  public readonly statusCode = 503;
  public readonly code = 'DATABASE_UNAVAILABLE';
  constructor(message = 'Secure database persistence is not configured or unreachable.') {
    super(message);
    this.name = 'DatabaseUnavailableError';
  }
}

export class ConflictError extends Error {
  public readonly statusCode = 409;
  public readonly code = 'SLOT_CONFLICT';
  constructor(message = 'The requested resource conflicts with an existing record.') {
    super(message);
    this.name = 'ConflictError';
  }
}

export class NotFoundError extends Error {
  public readonly statusCode = 404;
  public readonly code = 'NOT_FOUND';
  constructor(message = 'Requested record was not found.') {
    super(message);
    this.name = 'NotFoundError';
  }
}

export interface SelectedServiceSnapshot {
  id: string;
  title: string;
  startingUsd: number;
  monthlyUsd?: number;
  model: string;
  selectedOptionIds: string[];
}

export interface SolutionRequestRecord {
  id: string;
  referenceCode: string;
  idempotencyKey?: string;
  type: 'contact_form' | 'solution_builder';
  fullName: string;
  email: string;
  contactNumber: string;
  company: string;
  industry?: string;
  targetTimeline?: string;
  selectedServices: SelectedServiceSnapshot[];
  selectedServiceIds: string[];
  selectedOptionsMap: Record<string, string[]>;
  serviceId: string;
  serviceTitle: string;
  estimatedOneTimeStartingUsd: number;
  estimatedMonthlyStartingUsd: number;
  estimatedBudget: string;
  preferredCurrency: 'USD' | 'PHP';
  phpConversionRate?: number;
  projectDescription: string;
  fileName?: string;
  privacyConsent: boolean;
  status: 'submitted' | 'under_review' | 'proposal_sent' | 'archived';
  emailDeliveryStatus: 'pending' | 'sent' | 'failed' | 'unconfigured';
  sourceChannel: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentRecord {
  id: string;
  referenceCode: string;
  idempotencyKey?: string;
  fullName: string;
  email: string;
  phone: string;
  companyName: string;
  briefReferenceCode?: string;
  consultationType: 'video' | 'phone' | 'in_person';
  scheduledDate: string;
  scheduledTimeSlot: string;
  durationMinutes: number;
  clientTimezone: string;
  meetingLink?: string;
  meetingLocation?: string;
  assignedConsultant: string;
  status: 'pending_review' | 'confirmed' | 'rescheduled' | 'cancelled' | 'completed';
  calendarSyncStatus: 'synced' | 'pending' | 'failed' | 'unconfigured';
  calendarEventId?: string;
  managementTokenHash?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmailOutboxRecord {
  id: string;
  dedupeKey: string;
  entityType: 'solution_request' | 'appointment';
  entityReference: string;
  recipientEmail: string;
  notificationType:
    | 'customer_confirmation'
    | 'admin_alert'
    | 'appointment_request'
    | 'appointment_update';
  subject: string;
  htmlBody: string;
  textBody: string;
  status: 'queued' | 'sent' | 'failed' | 'unconfigured';
  provider: string;
  providerReference?: string;
  deliveryAttempts: number;
  lastError?: string;
  nextRetryAt?: string;
  sentAt?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogRecord {
  id: string;
  correlationId?: string;
  actor: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId?: string;
  details: Record<string, unknown>;
  createdAt: string;
}

export interface AdminUserRecord {
  id: string;
  /** Supabase Auth UUID bound to this administrator; absent for local/bootstrap-only identities. */
  authUserId?: string;
  email: string;
  fullName: string;
  role: 'admin' | 'super_admin';
  isActive: boolean;
}

export interface CreateSolutionRequestInput {
  referenceCode: string;
  idempotencyKey?: string;
  type: 'contact_form' | 'solution_builder';
  fullName: string;
  email: string;
  contactNumber: string;
  company: string;
  industry?: string;
  targetTimeline?: string;
  selectedServices: SelectedServiceSnapshot[];
  selectedServiceIds: string[];
  selectedOptionsMap: Record<string, string[]>;
  serviceId: string;
  serviceTitle: string;
  estimatedOneTimeStartingUsd: number;
  estimatedMonthlyStartingUsd: number;
  estimatedBudget: string;
  preferredCurrency: 'USD' | 'PHP';
  phpConversionRate?: number;
  projectDescription: string;
  fileName?: string;
  privacyConsent: boolean;
  clientIp?: string;
}

export interface CreateAppointmentInput {
  referenceCode: string;
  idempotencyKey?: string;
  fullName: string;
  email: string;
  phone: string;
  companyName: string;
  briefReferenceCode?: string;
  consultationType: 'video' | 'phone' | 'in_person';
  scheduledDate: string;
  scheduledTimeSlot: string;
  durationMinutes: number;
  clientTimezone: string;
  meetingLink?: string;
  meetingLocation?: string;
  assignedConsultant: string;
  status: 'pending_review' | 'confirmed';
  calendarSyncStatus: 'synced' | 'pending' | 'failed' | 'unconfigured';
  calendarEventId?: string;
  managementTokenHash: string;
  notes?: string;
}

export interface DatabaseRepository {
  readonly isConfigured: boolean;
  ping(): Promise<{ ok: boolean; configured: boolean; latencyMs?: number; error?: string }>;

  findSolutionRequestByIdempotencyKey(key: string): Promise<SolutionRequestRecord | null>;
  createSolutionRequest(input: CreateSolutionRequestInput): Promise<{
    record: SolutionRequestRecord;
    created: boolean;
  }>;
  updateSolutionRequestEmailStatus(
    referenceCode: string,
    emailDeliveryStatus: 'pending' | 'sent' | 'failed' | 'unconfigured'
  ): Promise<void>;
  listSolutionRequests(options: {
    limit: number;
    offset: number;
    status?: string;
  }): Promise<{ records: SolutionRequestRecord[]; total: number }>;

  getBookedSlotsForDate(scheduledDate: string): Promise<string[]>;
  createAppointment(input: CreateAppointmentInput): Promise<{
    record: AppointmentRecord;
    created: boolean;
  }>;
  getAppointmentByReference(referenceCode: string): Promise<AppointmentRecord | null>;
  updateAppointment(
    referenceCode: string,
    patch: Partial<
      Pick<
        AppointmentRecord,
        'scheduledDate' | 'scheduledTimeSlot' | 'status' | 'meetingLink' | 'calendarSyncStatus' | 'calendarEventId' | 'notes'
      >
    >
  ): Promise<AppointmentRecord>;
  listAppointments(options: { limit: number; offset: number }): Promise<{
    records: AppointmentRecord[];
    total: number;
  }>;

  createOutboxRecord(input: {
    dedupeKey: string;
    entityType: 'solution_request' | 'appointment';
    entityReference: string;
    recipientEmail: string;
    notificationType: EmailOutboxRecord['notificationType'];
    subject: string;
    htmlBody: string;
    textBody: string;
    metadata?: Record<string, unknown>;
  }): Promise<{ record: EmailOutboxRecord; created: boolean }>;
  updateOutboxStatus(
    id: string,
    patch: {
      status: EmailOutboxRecord['status'];
      providerReference?: string;
      deliveryAttempts: number;
      lastError?: string;
      nextRetryAt?: string | null;
      sentAt?: string | null;
    }
  ): Promise<void>;
  listRetryableOutbox(limit?: number): Promise<EmailOutboxRecord[]>;

  writeAuditLog(input: Omit<AuditLogRecord, 'id' | 'createdAt'>): Promise<void>;
  listAuditLogs(options: { limit: number; offset: number }): Promise<{
    records: AuditLogRecord[];
    total: number;
  }>;

  findActiveAdminByEmail(email: string, authUserId?: string): Promise<AdminUserRecord | null>;
  verifySupabaseUserToken(token: string): Promise<{ id: string; email: string } | null>;
}
