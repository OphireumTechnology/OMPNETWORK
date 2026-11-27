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

export type EmailDeliveryState =
  | 'queued'
  | 'provider_accepted'
  | 'sent'
  | 'delivered'
  | 'bounced'
  | 'failed'
  | 'retrying'
  | 'unconfigured';

export interface EmailOutboxRecord {
  id: string;
  dedupeKey: string;
  entityType: 'solution_request' | 'appointment' | 'order' | 'support' | 'security';
  entityReference: string;
  recipientEmail: string;
  notificationType:
    | 'customer_confirmation'
    | 'admin_alert'
    | 'appointment_request'
    | 'appointment_update'
    | 'order_update'
    | 'security_alert';
  subject: string;
  htmlBody: string;
  textBody: string;
  status: EmailDeliveryState;
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

export type AdminRole =
  | 'super_admin'
  | 'admin'
  | 'operations_manager'
  | 'finance_officer'
  | 'sales_officer'
  | 'project_manager'
  | 'developer'
  | 'support_officer'
  | 'auditor';

export interface AdminUserRecord {
  id: string;
  email: string;
  fullName: string;
  role: AdminRole;
  isActive: boolean;
  mfaEnabled?: boolean;
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
  updateSolutionRequestStatus?(
    referenceCode: string,
    status: SolutionRequestRecord['status']
  ): Promise<SolutionRequestRecord>;
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
    entityType: EmailOutboxRecord['entityType'];
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
  updateOutboxByProviderReference?(
    providerReference: string,
    status: EmailDeliveryState,
    lastError?: string
  ): Promise<boolean>;
  listRetryableOutbox(limit?: number): Promise<EmailOutboxRecord[]>;

  writeAuditLog(input: Omit<AuditLogRecord, 'id' | 'createdAt'>): Promise<void>;
  listAuditLogs(options: { limit: number; offset: number }): Promise<{
    records: AuditLogRecord[];
    total: number;
  }>;

  findActiveAdminByEmail(email: string, authUserId?: string): Promise<AdminUserRecord | null>;
  verifySupabaseUserToken(token: string): Promise<{ id: string; email: string } | null>;
}
