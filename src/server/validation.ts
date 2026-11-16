import { SERVICE_CATALOG, computeConfiguredServiceTotal } from '../data/serviceCatalog';
import { servicesData } from '../data/servicesData';
import { CatalogService } from '../types';

export interface ValidatedInquiryPayload {
  type: 'contact_form' | 'solution_builder';
  fullName: string;
  email: string;
  contactNumber: string;
  company: string;
  industry?: string;
  targetTimeline?: string;
  idempotencyKey?: string;
  matchedCatalogServices: CatalogService[];
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
}

export interface ValidatedAppointmentPayload {
  fullName: string;
  email: string;
  phone: string;
  companyName: string;
  briefReferenceCode?: string;
  consultationType: 'video' | 'phone' | 'in_person';
  scheduledDate: string;
  scheduledTimeSlot: string;
  clientTimezone: string;
  idempotencyKey?: string;
  notes?: string;
}

export const ALLOWED_APPOINTMENT_SLOTS = [
  '09:00 AM - 09:30 AM',
  '10:00 AM - 10:30 AM',
  '11:00 AM - 11:30 AM',
  '01:30 PM - 02:00 PM',
  '02:30 PM - 03:00 PM',
  '03:30 PM - 04:00 PM',
  '04:30 PM - 05:00 PM',
] as const;

export function stripControlChars(input: string): string {
  return input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
}

export function sanitizePlainText(input: unknown, maxLen: number): string {
  if (typeof input !== 'string') return '';
  return stripControlChars(input)
    .replace(/[<>]/g, '')
    .slice(0, maxLen);
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const UUID_OR_KEY_REGEX = /^[a-zA-Z0-9\-_]{8,128}$/;

export function validateInquiryPayload(raw: unknown): {
  ok: true;
  data: ValidatedInquiryPayload;
} | {
  ok: false;
  error: string;
} {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Invalid request payload.' };
  }
  const body = raw as Record<string, unknown>;

  // Honeypot spam filter
  if (typeof body.websiteHoneypot === 'string' && body.websiteHoneypot.trim().length > 0) {
    return { ok: false, error: 'Submission blocked by automated anti-spam verification.' };
  }

  const fullName = sanitizePlainText(body.fullName, 120);
  const email = stripControlChars(typeof body.email === 'string' ? body.email : '').toLowerCase().slice(0, 180);
  const contactNumber = sanitizePlainText(body.contactNumber, 40);
  const company = sanitizePlainText(body.company, 140);
  const projectDescription = sanitizePlainText(body.projectDescription, 4000);
  const industry = sanitizePlainText(body.industry, 100) || undefined;
  const targetTimeline = sanitizePlainText(body.targetTimeline, 120) || undefined;
  const fileName = sanitizePlainText(body.fileName, 180) || undefined;
  const privacyConsent = body.privacyConsent === true;

  if (fullName.length < 2) {
    return { ok: false, error: 'Full name is required (minimum 2 characters).' };
  }
  if (!EMAIL_REGEX.test(email)) {
    return { ok: false, error: 'A valid business or personal email address is required.' };
  }
  if (contactNumber.length < 5 || !/[0-9]{5,}/.test(contactNumber.replace(/[^0-9]/g, ''))) {
    return { ok: false, error: 'A valid contact phone number is required.' };
  }
  if (company.length < 2) {
    return { ok: false, error: 'Company or organization name is required.' };
  }
  if (projectDescription.length < 20) {
    return { ok: false, error: 'Please provide project scope details of at least 20 characters.' };
  }
  if (!privacyConsent) {
    return { ok: false, error: 'Authorization under OPHIREUM confidentiality terms is required.' };
  }

  const type: 'contact_form' | 'solution_builder' =
    body.type === 'solution_builder' ? 'solution_builder' : 'contact_form';

  let idempotencyKey: string | undefined;
  if (body.idempotencyKey !== undefined) {
    if (typeof body.idempotencyKey !== 'string' || !UUID_OR_KEY_REGEX.test(body.idempotencyKey.trim())) {
      return { ok: false, error: 'Invalid idempotencyKey format.' };
    }
    idempotencyKey = body.idempotencyKey.trim();
  }

  // Strictly validate service IDs against canonical SERVICE_CATALOG (and legacy servicesData for contact form)
  const rawIds: string[] = Array.isArray(body.selectedServiceIds)
    ? body.selectedServiceIds.filter((id): id is string => typeof id === 'string' && id.trim().length > 0).map((s) => s.trim())
    : typeof body.serviceId === 'string' && body.serviceId.trim().length > 0
    ? [body.serviceId.trim()]
    : [];

  const uniqueIds = Array.from(new Set(rawIds));

  if (type === 'solution_builder' && uniqueIds.length === 0) {
    return { ok: false, error: 'At least one valid catalog solution must be selected.' };
  }

  if (uniqueIds.length > 25) {
    return { ok: false, error: 'Too many services selected in a single request (max 25).' };
  }

  const matchedCatalogServices: CatalogService[] = [];
  const unknownIds: string[] = [];

  for (const id of uniqueIds) {
    const catalogSvc = SERVICE_CATALOG.find((s) => s.id === id);
    if (catalogSvc) {
      matchedCatalogServices.push(catalogSvc);
    } else if (type === 'contact_form' && (servicesData.some((s) => s.id === id) || id === 'general-consultation')) {
      // Legacy discipline selector on contact form allowed
    } else {
      unknownIds.push(id);
    }
  }

  if (unknownIds.length > 0) {
    return {
      ok: false,
      error: `Unrecognized service identifier rejected: ${unknownIds.slice(0, 3).join(', ')}`,
    };
  }

  // Server-authoritative option & pricing computation — ignore any client-supplied price totals!
  const rawOptionsMap =
    body.selectedOptionsMap && typeof body.selectedOptionsMap === 'object'
      ? (body.selectedOptionsMap as Record<string, unknown>)
      : {};

  const safeOptionsMap: Record<string, string[]> = {};
  let estimatedOneTimeStartingUsd = 0;
  let estimatedMonthlyStartingUsd = 0;

  for (const svc of matchedCatalogServices) {
    const allowedOptionIds = new Set((svc.configurableOptions || []).map((o) => o.id));
    const rawOpts = rawOptionsMap[svc.id];
    const safeOptIds = Array.isArray(rawOpts)
      ? Array.from(new Set(rawOpts.filter((x): x is string => typeof x === 'string' && allowedOptionIds.has(x))))
      : [];
    if (safeOptIds.length > 0) {
      safeOptionsMap[svc.id] = safeOptIds;
    }
    const totals = computeConfiguredServiceTotal(svc, safeOptIds);
    estimatedOneTimeStartingUsd += totals.oneTimeUsd;
    estimatedMonthlyStartingUsd += totals.monthlyUsd;
  }

  const legacyMatch =
    type === 'contact_form' && uniqueIds[0]
      ? servicesData.find((s) => s.id === uniqueIds[0])
      : undefined;

  const serviceTitle =
    matchedCatalogServices.length > 0
      ? matchedCatalogServices.map((s) => s.title).join(' + ')
      : legacyMatch?.title || 'General Consultation';

  const serviceId =
    matchedCatalogServices.length > 0
      ? matchedCatalogServices.map((s) => s.id).join(', ')
      : legacyMatch?.id || 'general-consultation';

  let estimatedBudget = sanitizePlainText(body.estimatedBudget, 140) || 'To be scoped via proposal';
  if (matchedCatalogServices.length > 0) {
    const parts: string[] = [];
    if (estimatedOneTimeStartingUsd > 0) {
      parts.push(`Starting est. $${estimatedOneTimeStartingUsd.toLocaleString('en-US')}`);
    }
    if (estimatedMonthlyStartingUsd > 0) {
      parts.push(`$${estimatedMonthlyStartingUsd.toLocaleString('en-US')}/mo`);
    }
    if (parts.length > 0) {
      estimatedBudget = parts.join(' + ');
    }
  }

  const preferredCurrency: 'USD' | 'PHP' = body.preferredCurrency === 'PHP' ? 'PHP' : 'USD';
  const rawPhpRate = typeof body.phpConversionRate === 'number' && Number.isFinite(body.phpConversionRate)
    ? Math.min(120, Math.max(20, body.phpConversionRate))
    : undefined;

  return {
    ok: true,
    data: {
      type,
      fullName,
      email,
      contactNumber,
      company,
      industry,
      targetTimeline,
      idempotencyKey,
      matchedCatalogServices,
      selectedServiceIds: matchedCatalogServices.map((s) => s.id),
      selectedOptionsMap: safeOptionsMap,
      serviceId,
      serviceTitle,
      estimatedOneTimeStartingUsd,
      estimatedMonthlyStartingUsd,
      estimatedBudget,
      preferredCurrency,
      phpConversionRate: rawPhpRate,
      projectDescription,
      fileName,
      privacyConsent,
    },
  };
}

export function validateAppointmentPayload(raw: unknown): {
  ok: true;
  data: ValidatedAppointmentPayload;
} | {
  ok: false;
  error: string;
} {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Invalid appointment payload.' };
  }
  const body = raw as Record<string, unknown>;

  if (typeof body.websiteHoneypot === 'string' && body.websiteHoneypot.trim().length > 0) {
    return { ok: false, error: 'Submission blocked by automated anti-spam verification.' };
  }

  const fullName = sanitizePlainText(body.fullName, 120);
  const email = stripControlChars(typeof body.email === 'string' ? body.email : '').toLowerCase().slice(0, 180);
  const phone = sanitizePlainText(body.phone, 40);
  const companyName = sanitizePlainText(body.companyName, 140) || 'Enterprise Client';
  const briefReferenceCode = sanitizePlainText(body.briefReferenceCode, 60) || undefined;
  const consultationTypeRaw = typeof body.consultationType === 'string' ? body.consultationType.trim() : '';
  const scheduledDate = typeof body.scheduledDate === 'string' ? body.scheduledDate.trim() : '';
  const scheduledTimeSlot = typeof body.scheduledTimeSlot === 'string' ? body.scheduledTimeSlot.trim() : '';
  const clientTimezone = sanitizePlainText(body.clientTimezone, 80) || 'Asia/Manila';
  const notes = sanitizePlainText(body.notes, 1000) || undefined;

  if (fullName.length < 2) {
    return { ok: false, error: 'Full name is required (minimum 2 characters).' };
  }
  if (!EMAIL_REGEX.test(email)) {
    return { ok: false, error: 'A valid email address is required for consultation scheduling.' };
  }
  if (phone.length < 5 || !/[0-9]{5,}/.test(phone.replace(/[^0-9]/g, ''))) {
    return { ok: false, error: 'A valid contact phone number is required.' };
  }
  if (consultationTypeRaw !== 'video' && consultationTypeRaw !== 'phone' && consultationTypeRaw !== 'in_person') {
    return { ok: false, error: 'Consultation channel must be video, phone, or in_person.' };
  }
  if (!DATE_REGEX.test(scheduledDate)) {
    return { ok: false, error: 'Scheduled date must be in YYYY-MM-DD format.' };
  }

  const parsedDate = new Date(`${scheduledDate}T00:00:00Z`);
  if (Number.isNaN(parsedDate.getTime())) {
    return { ok: false, error: 'Invalid calendar date.' };
  }
  const day = parsedDate.getUTCDay();
  if (day === 0 || day === 6) {
    return { ok: false, error: 'Consultations are available Monday through Friday only.' };
  }

  const todayIso = new Date().toISOString().split('T')[0];
  if (scheduledDate < todayIso) {
    return { ok: false, error: 'Scheduled consultation date cannot be in the past.' };
  }

  if (!(ALLOWED_APPOINTMENT_SLOTS as readonly string[]).includes(scheduledTimeSlot)) {
    return { ok: false, error: 'Selected time slot is invalid or outside operating hours.' };
  }

  let idempotencyKey: string | undefined;
  if (body.idempotencyKey !== undefined) {
    if (typeof body.idempotencyKey !== 'string' || !UUID_OR_KEY_REGEX.test(body.idempotencyKey.trim())) {
      return { ok: false, error: 'Invalid idempotencyKey format.' };
    }
    idempotencyKey = body.idempotencyKey.trim();
  }

  return {
    ok: true,
    data: {
      fullName,
      email,
      phone,
      companyName,
      briefReferenceCode,
      consultationType: consultationTypeRaw,
      scheduledDate,
      scheduledTimeSlot,
      clientTimezone,
      idempotencyKey,
      notes,
    },
  };
}

export function sanitizeChatInput(raw: unknown): {
  ok: true;
  userMessage: string;
  language: 'en-US' | 'fil-PH';
  history: Array<{ sender: 'user' | 'ai'; text: string }>;
  stateContext: { category?: string; businessProblem?: string; currentStage?: string };
} | {
  ok: false;
  error: string;
} {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Invalid chat request body.' };
  }
  const body = raw as Record<string, unknown>;
  if (typeof body.userMessage !== 'string' || body.userMessage.trim().length === 0) {
    return { ok: false, error: 'userMessage is required.' };
  }

  const userMessage = stripControlChars(body.userMessage).slice(0, 2000);
  if (userMessage.length === 0) {
    return { ok: false, error: 'userMessage cannot be empty.' };
  }

  const langRaw = typeof body.language === 'string' ? body.language.trim() : 'en-US';
  const language: 'en-US' | 'fil-PH' =
    langRaw.startsWith('fil') || langRaw.startsWith('tl') ? 'fil-PH' : 'en-US';

  const rawHistory = Array.isArray(body.conversationHistory) ? body.conversationHistory.slice(-8) : [];
  const history: Array<{ sender: 'user' | 'ai'; text: string }> = [];
  for (const turn of rawHistory) {
    if (
      turn &&
      typeof turn === 'object' &&
      ((turn as any).sender === 'user' || (turn as any).sender === 'ai') &&
      typeof (turn as any).text === 'string'
    ) {
      const cleaned = stripControlChars((turn as any).text).slice(0, 1200);
      if (cleaned) {
        history.push({ sender: (turn as any).sender, text: cleaned });
      }
    }
  }

  const rawState = body.state && typeof body.state === 'object' ? (body.state as Record<string, any>) : {};
  const stateContext = {
    category: sanitizePlainText(rawState?.requirements?.category, 140) || undefined,
    businessProblem: sanitizePlainText(rawState?.requirements?.businessProblem, 400) || undefined,
    currentStage: sanitizePlainText(rawState?.currentStage, 40) || undefined,
  };

  return {
    ok: true,
    userMessage,
    language,
    history,
    stateContext,
  };
}
