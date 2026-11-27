import crypto from 'crypto';
import { FunctionDeclaration, Type } from '@google/genai';
import {
  CATALOG_CATEGORIES,
  SERVICE_CATALOG,
  COMMERCIAL_PRICING_NOTICE,
  EXTERNAL_CHARGES_DISCLOSURE,
} from '../../data/serviceCatalog';
import { DatabaseRepository, AppointmentRecord } from '../db/types';
import { PortalRepository } from '../portal/types';
import { ALLOWED_APPOINTMENT_SLOTS, sanitizePlainText } from '../validation';
import { CentralKnowledgeService } from './knowledgeService';
import { AiConversationStore } from './conversationService';
import { GoogleCalendarService } from '../services/calendarService';
import { TransactionalEmailService } from '../services/emailService';

export interface ReceptionistToolContext {
  sessionId: string; // external sessionKey
  conversationSessionId?: string; // internal DB UUID
  anonymousToken?: string;
  authenticatedUserId?: string;
  authenticatedEmail?: string;
  actorRole: 'public' | 'customer' | 'admin';
  channel: 'chat' | 'voice' | 'live_audio';
  correlationId?: string;
}

export interface ReceptionistToolResult {
  ok: boolean;
  toolName: string;
  requiresConfirmation?: boolean;
  confirmationPrompt?: string;
  data?: Record<string, unknown>;
  error?: string;
}

export const RECEPTIONIST_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'discover_services',
    description:
      'Search the official OPHIREUM 78-service catalog across 10 divisions to recommend matching services and starting investments.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Client need, industry, or solution keywords.' },
        categoryId: { type: Type.STRING, description: 'Optional category identifier.' },
        limit: { type: Type.NUMBER, description: 'Max services to return (1-5).' },
      },
      required: ['query'],
    },
  },
  {
    name: 'search_company_knowledge',
    description:
      'Retrieve approved OPHIREUM company policy, pricing, legal, or FAQ excerpts from the Central Knowledge Base.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Question or topic to look up.' },
        category: { type: Type.STRING, description: 'Optional knowledge category filter.' },
      },
      required: ['query'],
    },
  },
  {
    name: 'prepare_indicative_quotation',
    description:
      'Prepare a non-binding indicative starting investment summary grounded strictly in official OPHIREUM catalog service IDs. Never fabricates custom fixed prices.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        serviceIds: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: 'List of valid OPHIREUM catalog service IDs.',
        },
        currency: { type: Type.STRING, description: 'Preferred currency: USD or PHP.' },
        budgetNotes: { type: Type.STRING, description: 'Client budget range or constraints.' },
        requirementsSummary: { type: Type.STRING, description: 'Key functional requirements.' },
        targetTimeline: { type: Type.STRING, description: 'Target delivery timeline.' },
      },
      required: ['serviceIds'],
    },
  },
  {
    name: 'check_consultation_availability',
    description: 'Check real available consultation time slots on a specific YYYY-MM-DD date from the database.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        date: { type: Type.STRING, description: 'Date in YYYY-MM-DD format (Monday–Friday).' },
      },
      required: ['date'],
    },
  },
  {
    name: 'book_consultation',
    description:
      'Create a real consultation booking in the database ONLY after the client explicitly confirms all booking details (set userConfirmed=true only after explicit confirmation).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        fullName: { type: Type.STRING },
        email: { type: Type.STRING },
        phone: { type: Type.STRING },
        companyName: { type: Type.STRING },
        date: { type: Type.STRING, description: 'YYYY-MM-DD' },
        timeSlot: { type: Type.STRING, description: 'One of the available slots returned by check_consultation_availability.' },
        meetingType: { type: Type.STRING, description: 'Online Video Call or Office Consultation (Clark Freeport Zone)' },
        notes: { type: Type.STRING },
        userConfirmed: {
          type: Type.BOOLEAN,
          description: 'Must be true ONLY after the client explicitly confirmed the date, slot, and contact details.',
        },
      },
      required: ['fullName', 'email', 'date', 'timeSlot'],
    },
  },
  {
    name: 'reschedule_consultation',
    description:
      'Reschedule an existing consultation appointment using its reference code and client email or management token. Requires explicit userConfirmed=true.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        referenceCode: { type: Type.STRING },
        email: { type: Type.STRING },
        newDate: { type: Type.STRING, description: 'YYYY-MM-DD' },
        newTimeSlot: { type: Type.STRING },
        userConfirmed: { type: Type.BOOLEAN },
      },
      required: ['referenceCode', 'email', 'newDate', 'newTimeSlot'],
    },
  },
  {
    name: 'cancel_consultation',
    description:
      'Cancel an existing consultation appointment using its reference code and client email. Requires explicit userConfirmed=true.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        referenceCode: { type: Type.STRING },
        email: { type: Type.STRING },
        reason: { type: Type.STRING },
        userConfirmed: { type: Type.BOOLEAN },
      },
      required: ['referenceCode', 'email'],
    },
  },
  {
    name: 'create_support_ticket',
    description:
      'Create a real customer support ticket for an authenticated portal customer. Requires explicit userConfirmed=true.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        subject: { type: Type.STRING },
        category: { type: Type.STRING, description: 'general, billing, project, technical, or refund' },
        priority: { type: Type.STRING, description: 'low, normal, high, or urgent' },
        message: { type: Type.STRING },
        userConfirmed: { type: Type.BOOLEAN },
      },
      required: ['subject', 'message'],
    },
  },
  {
    name: 'get_my_orders',
    description: 'List real orders belonging ONLY to the currently authenticated customer.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        limit: { type: Type.NUMBER },
      },
    },
  },
  {
    name: 'get_my_projects',
    description: 'List real active/past projects belonging ONLY to the currently authenticated customer.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        limit: { type: Type.NUMBER },
      },
    },
  },
  {
    name: 'escalate_to_human',
    description: 'Record a human escalation handoff and provide official OPHIREUM executive contact details.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        reason: { type: Type.STRING },
        clientName: { type: Type.STRING },
        clientContact: { type: Type.STRING },
      },
      required: ['reason'],
    },
  },
  {
    name: 'summarize_conversation',
    description: 'Save a structured conversation checkpoint and return a concise summary of the current session.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        clientName: { type: Type.STRING },
        budgetRange: { type: Type.STRING },
        requirements: { type: Type.STRING },
        recommendedServiceIds: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
        },
      },
    },
  },
];

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function isValidWeekdayDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const parsed = new Date(`${dateStr}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return false;
  const day = parsed.getUTCDay();
  return day !== 0 && day !== 6;
}

export class ReceptionistToolExecutor {
  constructor(
    private readonly deps: {
      db: DatabaseRepository;
      portalRepo: PortalRepository;
      knowledgeService: CentralKnowledgeService;
      conversationStore: AiConversationStore;
      calendarService: GoogleCalendarService;
      emailService: TransactionalEmailService;
    }
  ) {}

  public async execute(
    toolName: string,
    rawArgs: Record<string, unknown> = {},
    ctx: ReceptionistToolContext
  ): Promise<ReceptionistToolResult> {
    const args = rawArgs && typeof rawArgs === 'object' ? rawArgs : {};

    switch (toolName) {
      case 'discover_services':
        return this.discoverServices(args);
      case 'search_company_knowledge':
        return this.searchKnowledge(args, ctx);
      case 'prepare_indicative_quotation':
        return this.prepareIndicativeQuotation(args, ctx);
      case 'check_consultation_availability':
        return this.checkConsultationAvailability(args);
      case 'book_consultation':
        return this.bookConsultation(args, ctx);
      case 'reschedule_consultation':
        return this.rescheduleConsultation(args, ctx);
      case 'cancel_consultation':
        return this.cancelConsultation(args, ctx);
      case 'create_support_ticket':
        return this.createSupportTicket(args, ctx);
      case 'get_my_orders':
        return this.getMyOrders(args, ctx);
      case 'get_my_projects':
        return this.getMyProjects(args, ctx);
      case 'escalate_to_human':
        return this.escalateToHuman(args, ctx);
      case 'summarize_conversation':
        return this.summarizeConversation(args, ctx);
      default:
        return {
          ok: false,
          toolName,
          error: `Unsupported receptionist tool: ${toolName}`,
        };
    }
  }

  private async discoverServices(args: Record<string, unknown>): Promise<ReceptionistToolResult> {
    const query = sanitizePlainText(args.query, 300).toLowerCase();
    const categoryId = sanitizePlainText(args.categoryId, 60).toLowerCase();
    const limit = Math.max(1, Math.min(5, Number(args.limit || 3)));

    const tokens = query.split(/\W+/).filter((t) => t.length >= 2);
    const pool = categoryId
      ? SERVICE_CATALOG.filter((s) => s.categoryId.toLowerCase() === categoryId)
      : SERVICE_CATALOG;

    const scored = pool
      .map((svc) => {
        const hay = `${svc.title} ${svc.shortDescription} ${svc.capabilities.join(' ')} ${svc.categoryId}`.toLowerCase();
        let score = 0;
        for (const tok of tokens) {
          if (svc.title.toLowerCase().includes(tok)) score += 5;
          else if (hay.includes(tok)) score += 2;
        }
        return { svc, score };
      })
      .filter((x) => x.score > 0 || tokens.length === 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return {
      ok: true,
      toolName: 'discover_services',
      data: {
        totalCatalogServices: SERVICE_CATALOG.length,
        totalCategories: CATALOG_CATEGORIES.filter((c) => c.id !== 'all').length,
        matches: scored.map(({ svc }) => ({
          id: svc.id,
          title: svc.title,
          categoryId: svc.categoryId,
          pricingModel: svc.pricing.model,
          startingUsd: svc.pricing.startingUsd,
          monthlyUsd: svc.pricing.monthlyUsd ?? null,
          shortDescription: svc.shortDescription,
          capabilities: svc.capabilities.slice(0, 4),
        })),
        pricingNotice: COMMERCIAL_PRICING_NOTICE,
      },
    };
  }

  private async searchKnowledge(
    args: Record<string, unknown>,
    ctx: ReceptionistToolContext
  ): Promise<ReceptionistToolResult> {
    const query = sanitizePlainText(args.query, 400);
    if (!query) {
      return { ok: false, toolName: 'search_company_knowledge', error: 'Search query is required.' };
    }
    const category = sanitizePlainText(args.category, 50) || undefined;
    const hits = await this.deps.knowledgeService.search(query, {
      limit: 4,
      tenantScope: ctx.authenticatedUserId || 'public',
      actorRole: ctx.actorRole === 'customer' ? 'customer' : 'public',
      includeInternal: false,
      category: category as any,
    });
    return {
      ok: true,
      toolName: 'search_company_knowledge',
      data: {
        hitCount: hits.length,
        hits: hits.map((h) => ({
          documentTitle: h.documentTitle,
          category: h.category,
          citationLabel: h.citationLabel,
          score: h.score,
          confidence: h.confidence,
          excerpt: h.content,
        })),
      },
    };
  }

  private async prepareIndicativeQuotation(
    args: Record<string, unknown>,
    ctx: ReceptionistToolContext
  ): Promise<ReceptionistToolResult> {
    const rawIds = Array.isArray(args.serviceIds) ? args.serviceIds.map((v) => String(v)) : [];
    const matched = rawIds
      .map((id) => SERVICE_CATALOG.find((s) => s.id === id))
      .filter((s): s is NonNullable<typeof s> => Boolean(s));

    if (matched.length === 0) {
      return {
        ok: false,
        toolName: 'prepare_indicative_quotation',
        error: 'No valid OPHIREUM catalog serviceIds were provided. Use discover_services first.',
      };
    }

    const currency = String(args.currency || 'USD').toUpperCase() === 'PHP' ? 'PHP' : 'USD';
    const fxRate = 58;
    const totalStartingUsd = matched.reduce((sum, s) => sum + s.pricing.startingUsd, 0);
    const totalMonthlyUsd = matched.reduce((sum, s) => sum + (s.pricing.monthlyUsd || 0), 0);

    const quotation = {
      status: 'indicative_estimate_non_binding',
      currency,
      fxReferenceRate: fxRate,
      items: matched.map((s) => ({
        serviceId: s.id,
        title: s.title,
        pricingModel: s.pricing.model,
        startingUsd: s.pricing.startingUsd,
        monthlyUsd: s.pricing.monthlyUsd ?? 0,
        estimatedStartingPhp: Math.round(s.pricing.startingUsd * fxRate),
      })),
      totalStartingUsd,
      totalMonthlyUsd,
      estimatedTotalStartingPhp: Math.round(totalStartingUsd * fxRate),
      budgetNotes: sanitizePlainText(args.budgetNotes, 240) || undefined,
      requirementsSummary: sanitizePlainText(args.requirementsSummary, 600) || undefined,
      targetTimeline: sanitizePlainText(args.targetTimeline, 120) || undefined,
      disclosures: [COMMERCIAL_PRICING_NOTICE, EXTERNAL_CHARGES_DISCLOSURE],
    };

    if (ctx.conversationSessionId) {
      await this.deps.conversationStore
        .recordEvent({
          conversationSessionId: ctx.conversationSessionId,
          eventType: 'tool_executed',
          actor: ctx.authenticatedEmail || 'ai_receptionist',
          payload: { toolName: 'prepare_indicative_quotation', serviceCount: matched.length, totalStartingUsd },
        })
        .catch(() => undefined);
    }

    return {
      ok: true,
      toolName: 'prepare_indicative_quotation',
      data: { quotation },
    };
  }

  private async checkConsultationAvailability(args: Record<string, unknown>): Promise<ReceptionistToolResult> {
    const date = sanitizePlainText(args.date, 20);
    if (!isValidWeekdayDate(date)) {
      return {
        ok: false,
        toolName: 'check_consultation_availability',
        error: 'Please provide a valid weekday (Monday–Friday) date in YYYY-MM-DD format.',
      };
    }

    const booked = await this.deps.db.getBookedSlotsForDate(date);
    const bookedSet = new Set(booked);
    const availableSlots = ALLOWED_APPOINTMENT_SLOTS.filter((slot) => !bookedSet.has(slot));

    return {
      ok: true,
      toolName: 'check_consultation_availability',
      data: {
        date,
        timezone: 'Asia/Manila (GMT+8)',
        availableSlots,
        bookedSlots: booked,
      },
    };
  }

  private async bookConsultation(
    args: Record<string, unknown>,
    ctx: ReceptionistToolContext
  ): Promise<ReceptionistToolResult> {
    const fullName = sanitizePlainText(args.fullName, 120);
    const email = sanitizePlainText(args.email, 160).toLowerCase();
    const phone = sanitizePlainText(args.phone, 40) || 'Not provided';
    const companyName = sanitizePlainText(args.companyName, 120) || 'Prospective Client';
    const date = sanitizePlainText(args.date, 20);
    const timeSlot = sanitizePlainText(args.timeSlot, 40);
    const meetingTypeRaw = sanitizePlainText(args.meetingType, 80);
    const consultationType: 'video' | 'phone' | 'in_person' =
      meetingTypeRaw === 'Office Consultation (Clark Freeport Zone)' || meetingTypeRaw === 'in_person'
        ? 'in_person'
        : meetingTypeRaw === 'phone'
          ? 'phone'
          : 'video';
    const meetingTypeLabel =
      consultationType === 'in_person'
        ? 'Office Consultation (Clark Freeport Zone)'
        : consultationType === 'phone'
          ? 'Phone Consultation'
          : 'Online Video Call';
    const notes = sanitizePlainText(args.notes, 600);
    const userConfirmed = args.userConfirmed === true;

    if (!fullName || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, toolName: 'book_consultation', error: 'Valid fullName and email are required.' };
    }
    if (!isValidWeekdayDate(date)) {
      return { ok: false, toolName: 'book_consultation', error: 'Consultations are available Monday–Friday (YYYY-MM-DD).' };
    }
    if (!(ALLOWED_APPOINTMENT_SLOTS as readonly string[]).includes(timeSlot)) {
      return {
        ok: false,
        toolName: 'book_consultation',
        error: `Invalid timeSlot. Allowed slots: ${ALLOWED_APPOINTMENT_SLOTS.join(', ')}`,
      };
    }

    if (!userConfirmed) {
      return {
        ok: false,
        toolName: 'book_consultation',
        requiresConfirmation: true,
        confirmationPrompt: `Please confirm that you would like me to book a ${meetingTypeLabel} consultation for ${fullName} (${email}) on ${date} at ${timeSlot} Asia/Manila.`,
        data: {
          proposedBooking: { fullName, email, phone, companyName, date, timeSlot, consultationType },
        },
      };
    }

    const booked = await this.deps.db.getBookedSlotsForDate(date);
    if (booked.includes(timeSlot)) {
      return {
        ok: false,
        toolName: 'book_consultation',
        error: `The slot ${timeSlot} on ${date} is already booked. Please choose another available time.`,
      };
    }

    const referenceCode = `OPM-APT-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const managementToken = crypto.randomBytes(18).toString('hex');
    const calendarRes = await this.deps.calendarService.createConsultationEvent({
      referenceCode,
      fullName,
      email,
      companyName,
      consultationType,
      scheduledDate: date,
      scheduledTimeSlot: timeSlot,
      clientTimezone: 'Asia/Manila',
      location:
        consultationType === 'in_person'
          ? 'KMC | One West Aeropark, Clark Freeport Zone, Pampanga'
          : undefined,
      correlationId: ctx.correlationId,
    });

    const { record: created }: { record: AppointmentRecord; created: boolean } =
      await this.deps.db.createAppointment({
        referenceCode,
        fullName,
        email,
        phone,
        companyName,
        consultationType,
        scheduledDate: date,
        scheduledTimeSlot: timeSlot,
        durationMinutes: 30,
        clientTimezone: 'Asia/Manila',
        assignedConsultant: 'OPHIREUM Executive Producer',
        status: calendarRes.synced ? 'confirmed' : 'pending_review',
        notes: notes || `Booked via OPHIREUM AI Receptionist (${ctx.channel})`,
        calendarEventId: calendarRes.eventId,
        meetingLink: calendarRes.meetingLink,
        calendarSyncStatus: calendarRes.calendarSyncStatus,
        managementTokenHash: hashToken(managementToken),
      });

    await this.deps.emailService
      .enqueueAndSendAppointmentEmails(created, ctx.correlationId)
      .catch(() => undefined);

    await this.deps.db
      .writeAuditLog({
        correlationId: ctx.correlationId,
        actor: email,
        actorRole: ctx.actorRole,
        action: 'ai_receptionist_consultation_booked',
        entityType: 'consultation_appointments',
        entityId: created.referenceCode,
        details: { sessionId: ctx.sessionId, channel: ctx.channel, date, timeSlot },
      })
      .catch(() => undefined);

    if (ctx.conversationSessionId) {
      await this.deps.conversationStore
        .recordEvent({
          conversationSessionId: ctx.conversationSessionId,
          eventType: 'consultation_booked',
          actor: email,
          payload: { referenceCode: created.referenceCode, date, timeSlot, status: created.status },
        })
        .catch(() => undefined);
    }

    return {
      ok: true,
      toolName: 'book_consultation',
      data: {
        referenceCode: created.referenceCode,
        status: created.status,
        scheduledDate: created.scheduledDate,
        scheduledTimeSlot: created.scheduledTimeSlot,
        timezone: created.clientTimezone,
        consultationType: created.consultationType,
        calendarSyncStatus: created.calendarSyncStatus,
        meetingLink: created.meetingLink || null,
        managementToken,
      },
    };
  }

  private async rescheduleConsultation(
    args: Record<string, unknown>,
    ctx: ReceptionistToolContext
  ): Promise<ReceptionistToolResult> {
    const referenceCode = sanitizePlainText(args.referenceCode, 60);
    const email = sanitizePlainText(args.email, 160).toLowerCase();
    const newDate = sanitizePlainText(args.newDate, 20);
    const newTimeSlot = sanitizePlainText(args.newTimeSlot, 40);
    const userConfirmed = args.userConfirmed === true;

    if (!referenceCode || !email) {
      return { ok: false, toolName: 'reschedule_consultation', error: 'referenceCode and email are required.' };
    }
    if (!isValidWeekdayDate(newDate) || !(ALLOWED_APPOINTMENT_SLOTS as readonly string[]).includes(newTimeSlot)) {
      return { ok: false, toolName: 'reschedule_consultation', error: 'Provide a valid weekday newDate and allowed newTimeSlot.' };
    }

    const existing = await this.deps.db.getAppointmentByReference(referenceCode);
    if (!existing) {
      return { ok: false, toolName: 'reschedule_consultation', error: 'Appointment reference not found.' };
    }
    if (existing.email.toLowerCase() !== email) {
      return { ok: false, toolName: 'reschedule_consultation', error: 'Email does not match the appointment owner.' };
    }

    if (!userConfirmed) {
      return {
        ok: false,
        toolName: 'reschedule_consultation',
        requiresConfirmation: true,
        confirmationPrompt: `Please confirm rescheduling appointment ${referenceCode} from ${existing.scheduledDate} ${existing.scheduledTimeSlot} to ${newDate} at ${newTimeSlot} Asia/Manila.`,
      };
    }

    const booked = await this.deps.db.getBookedSlotsForDate(newDate);
    if (booked.includes(newTimeSlot)) {
      return { ok: false, toolName: 'reschedule_consultation', error: `Slot ${newTimeSlot} on ${newDate} is unavailable.` };
    }

    const calUpdate = await this.deps.calendarService.updateConsultationEvent({
      eventId: existing.calendarEventId,
      referenceCode,
      scheduledDate: newDate,
      scheduledTimeSlot: newTimeSlot,
      correlationId: ctx.correlationId,
    });

    const updated = await this.deps.db.updateAppointment(referenceCode, {
      scheduledDate: newDate,
      scheduledTimeSlot: newTimeSlot,
      status: calUpdate.synced ? 'confirmed' : 'pending_review',
      calendarSyncStatus: calUpdate.calendarSyncStatus,
      meetingLink: calUpdate.meetingLink || existing.meetingLink,
    });

    await this.deps.emailService
      .enqueueAndSendAppointmentUpdateEmails(updated, 'rescheduled', ctx.correlationId)
      .catch(() => undefined);

    return {
      ok: true,
      toolName: 'reschedule_consultation',
      data: {
        referenceCode: updated.referenceCode,
        scheduledDate: updated.scheduledDate,
        scheduledTimeSlot: updated.scheduledTimeSlot,
        status: updated.status,
      },
    };
  }

  private async cancelConsultation(
    args: Record<string, unknown>,
    ctx: ReceptionistToolContext
  ): Promise<ReceptionistToolResult> {
    const referenceCode = sanitizePlainText(args.referenceCode, 60);
    const email = sanitizePlainText(args.email, 160).toLowerCase();
    const reason = sanitizePlainText(args.reason, 300) || 'Cancelled via AI Receptionist';
    const userConfirmed = args.userConfirmed === true;

    if (!referenceCode || !email) {
      return { ok: false, toolName: 'cancel_consultation', error: 'referenceCode and email are required.' };
    }

    const existing = await this.deps.db.getAppointmentByReference(referenceCode);
    if (!existing) {
      return { ok: false, toolName: 'cancel_consultation', error: 'Appointment reference not found.' };
    }
    if (existing.email.toLowerCase() !== email) {
      return { ok: false, toolName: 'cancel_consultation', error: 'Email does not match the appointment owner.' };
    }

    if (!userConfirmed) {
      return {
        ok: false,
        toolName: 'cancel_consultation',
        requiresConfirmation: true,
        confirmationPrompt: `Please confirm that you want to permanently cancel consultation ${referenceCode} scheduled for ${existing.scheduledDate} at ${existing.scheduledTimeSlot}.`,
      };
    }

    await this.deps.calendarService
      .cancelConsultationEvent({
        eventId: existing.calendarEventId,
        referenceCode,
        correlationId: ctx.correlationId,
      })
      .catch(() => undefined);

    const updated = await this.deps.db.updateAppointment(referenceCode, {
      status: 'cancelled',
      notes: `${existing.notes ? `${existing.notes}\n` : ''}[Cancelled: ${reason}]`,
    });

    await this.deps.emailService
      .enqueueAndSendAppointmentUpdateEmails(updated, 'cancelled', ctx.correlationId)
      .catch(() => undefined);

    return {
      ok: true,
      toolName: 'cancel_consultation',
      data: { referenceCode: updated.referenceCode, status: updated.status },
    };
  }

  private async createSupportTicket(
    args: Record<string, unknown>,
    ctx: ReceptionistToolContext
  ): Promise<ReceptionistToolResult> {
    if (!ctx.authenticatedUserId) {
      return {
        ok: false,
        toolName: 'create_support_ticket',
        error: 'Authentication required. Please sign in to the OPHIREUM Client Portal to open a support ticket.',
      };
    }
    const subject = sanitizePlainText(args.subject, 160);
    const message = sanitizePlainText(args.message ?? args.body, 2000);
    const categoryRaw = sanitizePlainText(args.category, 40).toLowerCase();
    const categoryMap: Record<string, 'Account Access' | 'Orders' | 'Payments' | 'Billing' | 'Project Status' | 'Technical Support' | 'Service Inquiry' | 'Refund Request' | 'Other'> = {
      billing: 'Billing',
      payment: 'Payments',
      payments: 'Payments',
      project: 'Project Status',
      'project status': 'Project Status',
      technical: 'Technical Support',
      'technical support': 'Technical Support',
      refund: 'Refund Request',
      'refund request': 'Refund Request',
      orders: 'Orders',
      account: 'Account Access',
      inquiry: 'Service Inquiry',
      general: 'Service Inquiry',
      'general inquiry': 'Service Inquiry',
    };
    const category = categoryMap[categoryRaw] || 'Service Inquiry';

    if (!subject || !message) {
      return { ok: false, toolName: 'create_support_ticket', error: 'Both subject and message are required.' };
    }

    if (args.userConfirmed !== true) {
      return {
        ok: false,
        toolName: 'create_support_ticket',
        requiresConfirmation: true,
        confirmationPrompt: `Please confirm creating a ${category} support ticket titled "${subject}".`,
      };
    }

    const user = await this.deps.portalRepo.findUserById(ctx.authenticatedUserId);
    const profile = await this.deps.portalRepo.getProfile(ctx.authenticatedUserId).catch(() => null);
    const ticket = await this.deps.portalRepo.createSupportTicket({
      userId: ctx.authenticatedUserId,
      senderName: profile?.fullName || user?.email || ctx.authenticatedEmail || 'Portal Customer',
      category,
      subject,
      body: message,
      attachmentIds: [],
    });

    if (ctx.conversationSessionId) {
      await this.deps.conversationStore
        .recordEvent({
          conversationSessionId: ctx.conversationSessionId,
          eventType: 'support_ticket_created',
          actor: ctx.authenticatedEmail || ctx.authenticatedUserId,
          payload: { ticketNumber: ticket.ticketNumber, category },
        })
        .catch(() => undefined);
    }

    return {
      ok: true,
      toolName: 'create_support_ticket',
      data: {
        ticketId: ticket.id,
        ticketNumber: ticket.ticketNumber,
        status: ticket.status,
        subject: ticket.subject,
      },
    };
  }

  private async getMyOrders(
    args: Record<string, unknown>,
    ctx: ReceptionistToolContext
  ): Promise<ReceptionistToolResult> {
    if (!ctx.authenticatedUserId) {
      return {
        ok: false,
        toolName: 'get_my_orders',
        error: 'Authentication required. Sign in to the Client Portal to view your orders.',
      };
    }
    const limit = Math.max(1, Math.min(10, Number(args.limit || 5)));
    const orders = await this.deps.portalRepo.listOrders(ctx.authenticatedUserId);
    return {
      ok: true,
      toolName: 'get_my_orders',
      data: {
        totalOrders: orders.length,
        orders: orders.slice(0, limit).map((o) => ({
          orderNumber: o.orderNumber,
          fulfillmentStatus: o.fulfillmentStatus,
          paymentStatus: o.paymentStatus,
          currency: o.currency,
          totalMinor: o.totalMinor,
          itemCount: o.items.length,
          createdAt: o.createdAt,
        })),
      },
    };
  }

  private async getMyProjects(
    args: Record<string, unknown>,
    ctx: ReceptionistToolContext
  ): Promise<ReceptionistToolResult> {
    if (!ctx.authenticatedUserId) {
      return {
        ok: false,
        toolName: 'get_my_projects',
        error: 'Authentication required. Sign in to the Client Portal to view your projects.',
      };
    }
    const limit = Math.max(1, Math.min(10, Number(args.limit || 5)));
    const projects = await this.deps.portalRepo.listProjects(ctx.authenticatedUserId);
    return {
      ok: true,
      toolName: 'get_my_projects',
      data: {
        totalProjects: projects.length,
        projects: projects.slice(0, limit).map((p) => ({
          referenceNumber: p.referenceNumber,
          serviceName: p.serviceName,
          title: p.title,
          currentStage: p.currentStage,
          progressPercent: p.progressPercent,
          updatedAt: p.updatedAt,
        })),
      },
    };
  }

  private async escalateToHuman(
    args: Record<string, unknown>,
    ctx: ReceptionistToolContext
  ): Promise<ReceptionistToolResult> {
    const reason = sanitizePlainText(args.reason, 500) || 'Client requested human specialist.';
    const clientName = sanitizePlainText(args.clientName, 120) || undefined;
    const clientContact = sanitizePlainText(args.clientContact, 160) || undefined;

    if (ctx.conversationSessionId) {
      await this.deps.conversationStore
        .recordEvent({
          conversationSessionId: ctx.conversationSessionId,
          eventType: 'human_escalation_requested',
          actor: ctx.authenticatedEmail || clientContact || 'anonymous_client',
          payload: { reason, clientName, clientContact, channel: ctx.channel },
        })
        .catch(() => undefined);
    }

    await this.deps.db
      .writeAuditLog({
        correlationId: ctx.correlationId,
        actor: ctx.authenticatedEmail || clientContact || 'anonymous_client',
        actorRole: ctx.actorRole,
        action: 'ai_receptionist_human_escalation',
        entityType: 'ai_conversation_sessions',
        entityId: ctx.sessionId,
        details: { reason, clientName, channel: ctx.channel },
      })
      .catch(() => undefined);

    return {
      ok: true,
      toolName: 'escalate_to_human',
      data: {
        escalated: true,
        executiveContact: {
          name: 'Dhenze Languisan (Founder & CEO)',
          phone: '+63 917 966 8814',
          email: 'contact@ophireummultimedia.com',
          office: 'KMC | One West Aeropark, 5th Floor & Penthouse, Clark Freeport Zone, Pampanga 2010, Philippines',
        },
      },
    };
  }

  private async summarizeConversation(
    args: Record<string, unknown>,
    ctx: ReceptionistToolContext
  ): Promise<ReceptionistToolResult> {
    const access = {
      userId: ctx.authenticatedUserId,
      isAdmin: ctx.actorRole === 'admin',
      anonymousToken: ctx.anonymousToken,
    };
    const listed = await this.deps.conversationStore.listMessages(ctx.sessionId, access, 30);
    const messages = listed?.messages || [];
    const session = listed?.session;
    const userUtterances = messages
      .filter((m) => m.sender === 'user')
      .slice(-6)
      .map((m) => m.content)
      .join(' | ');

    const summary = [
      args.clientName ? `Client: ${sanitizePlainText(args.clientName, 120)}.` : null,
      args.requirements ? `Requirements: ${sanitizePlainText(args.requirements, 500)}.` : null,
      args.budgetRange ? `Budget: ${sanitizePlainText(args.budgetRange, 120)}.` : null,
      userUtterances ? `Recent context: ${userUtterances.slice(0, 500)}` : 'Session initialized.',
    ]
      .filter(Boolean)
      .join(' ');

    const checkpoint = await this.deps.conversationStore.createCheckpoint({
      sessionKey: ctx.sessionId,
      access,
      summaryText: summary,
      extractedState: {
        clientName: args.clientName ? sanitizePlainText(args.clientName, 120) : undefined,
        budgetRange: args.budgetRange ? sanitizePlainText(args.budgetRange, 120) : undefined,
        requirements: args.requirements ? sanitizePlainText(args.requirements, 500) : undefined,
        recommendedServiceIds: Array.isArray(args.recommendedServiceIds)
          ? args.recommendedServiceIds.map(String).slice(0, 5)
          : [],
      },
    });

    return {
      ok: true,
      toolName: 'summarize_conversation',
      data: {
        sessionId: ctx.sessionId,
        version: session?.version ?? 1,
        messageCount: messages.length,
        checkpointId: checkpoint.id,
        summary: checkpoint.summaryText,
      },
    };
  }
}
