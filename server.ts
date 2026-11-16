import express, { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import {
  CATALOG_CATEGORIES,
  SERVICE_CATALOG,
  COMMERCIAL_PRICING_NOTICE,
  EXTERNAL_CHARGES_DISCLOSURE,
  BLOCKCHAIN_COMPLIANCE_NOTICE,
  EMERGING_TECH_FEASIBILITY_NOTICE,
} from './src/data/serviceCatalog.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const SUBMISSIONS_FILE = path.resolve(__dirname, '.ophireum-submissions.json');

app.use(express.json({ limit: '25mb' }));

// Initialize Google GenAI client if GEMINI_API_KEY is available and not a placeholder
const apiKey = process.env.GEMINI_API_KEY || '';
const isRealApiKey = Boolean(
  apiKey && !apiKey.includes('MY_GEMINI_API_KEY') && apiKey.length > 10
);
const ai = isRealApiKey
  ? new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    })
  : null;

// =========================================================================
// PERSISTENT INQUIRY STORAGE & RATE LIMITER
// =========================================================================

export interface StoredInquiryRecord {
  referenceId: string;
  type: 'contact_form' | 'solution_builder';
  fullName: string;
  email: string;
  contactNumber: string;
  company: string;
  industry?: string;
  targetTimeline?: string;
  serviceId: string;
  serviceTitle: string;
  selectedServiceIds: string[];
  estimatedOneTimeStartingUsd?: number;
  estimatedMonthlyStartingUsd?: number;
  estimatedBudget: string;
  preferredCurrency?: 'USD' | 'PHP';
  phpConversionRate?: number;
  projectDescription: string;
  fileName?: string;
  status: string;
  routedTo: string;
  timestamp: string;
}

const loadInitialSubmissions = (): StoredInquiryRecord[] => {
  try {
    if (fs.existsSync(SUBMISSIONS_FILE)) {
      const raw = fs.readFileSync(SUBMISSIONS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('[OPHIREUM] Could not read submissions file, starting with memory store:', err);
  }
  return [];
};

const inquiryStore: StoredInquiryRecord[] = loadInitialSubmissions();

const persistSubmissions = () => {
  try {
    fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(inquiryStore.slice(0, 500), null, 2), 'utf8');
  } catch (err) {
    console.warn('[OPHIREUM] Could not write submissions file (ephemeral filesystem fallback active):', err);
  }
};

// Sliding-window IP rate limiter (max 12 POST inquiry attempts per 15 min)
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 12;

const checkRateLimit = (ip: string): boolean => {
  const now = Date.now();
  const timestamps = (rateLimitMap.get(ip) || []).filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
  if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    rateLimitMap.set(ip, timestamps);
    return false;
  }
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  return true;
};

// Compact catalog summary string for Gemini grounding
const CATALOG_SUMMARY_FOR_AI = CATALOG_CATEGORIES.filter((c) => c.id !== 'all')
  .map((cat) => {
    const items = SERVICE_CATALOG.filter((s) => s.categoryId === cat.id)
      .map((s) => {
        const price =
          s.pricing.model === 'setup_plus_monthly'
            ? `Impl starting at $${s.pricing.startingUsd.toLocaleString('en-US')} + ongoing starting at $${(s.pricing.monthlyUsd || 0).toLocaleString('en-US')}/mo`
            : s.pricing.model === 'subscription_monthly'
            ? `Plans starting at $${s.pricing.startingUsd.toLocaleString('en-US')}/mo`
            : `Starting at $${s.pricing.startingUsd.toLocaleString('en-US')}`;
        return `  - [${s.id}] ${s.title} (${price}): ${s.shortDescription}`;
      })
      .join('\n');
    return `Category ${cat.number}: ${cat.label}\n${items}`;
  })
  .join('\n\n');

const findCatalogMatches = (query: string, limit = 3) => {
  const q = query.toLowerCase();
  const tokens = q.split(/\W+/).filter((t) => t.length > 2);
  const scored = SERVICE_CATALOG.map((svc) => {
    const haystack = `${svc.title} ${svc.shortDescription} ${svc.capabilities.join(' ')} ${svc.categoryId}`.toLowerCase();
    let score = 0;
    for (const token of tokens) {
      if (svc.title.toLowerCase().includes(token)) score += 4;
      else if (haystack.includes(token)) score += 1;
    }
    return { svc, score };
  })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.svc);
  return scored;
};

// =========================================================================
// API ENDPOINTS
// =========================================================================

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'online',
    platform: 'OPHIREUM NETWORK Voice, AI & Proposal Gateway',
    timestamp: new Date().toISOString(),
    geminiConfigured: Boolean(ai),
    catalogCount: SERVICE_CATALOG.length,
    categoryCount: CATALOG_CATEGORIES.filter((c) => c.id !== 'all').length,
  });
});

// =========================================================================
// INQUIRIES & SOLUTION BUILDER SUBMISSION ENDPOINTS
// =========================================================================

app.get('/api/inquiries', (_req: Request, res: Response) => {
  res.json({
    success: true,
    count: inquiryStore.length,
    inquiries: inquiryStore,
  });
});

app.post('/api/inquiries', (req: Request, res: Response) => {
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.ip || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({
      success: false,
      error: 'Too many submissions from this network address. Please wait a few minutes or contact us directly at +63 917 966 8814.',
    });
  }

  const body = req.body || {};

  // Honeypot spam filter
  if (typeof body.websiteHoneypot === 'string' && body.websiteHoneypot.trim().length > 0) {
    return res.status(400).json({
      success: false,
      error: 'Submission blocked by automated anti-spam verification.',
    });
  }

  const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const contactNumber = typeof body.contactNumber === 'string' ? body.contactNumber.trim() : '';
  const company = typeof body.company === 'string' ? body.company.trim() : '';
  const projectDescription = typeof body.projectDescription === 'string' ? body.projectDescription.trim() : '';
  const privacyConsent = body.privacyConsent === true;

  if (fullName.length < 2) {
    return res.status(400).json({ success: false, error: 'Full name is required (minimum 2 characters).' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, error: 'A valid email address is required.' });
  }
  if (contactNumber.length < 5) {
    return res.status(400).json({ success: false, error: 'A valid contact phone number is required.' });
  }
  if (company.length < 2) {
    return res.status(400).json({ success: false, error: 'Company or organization name is required.' });
  }
  if (projectDescription.length < 20) {
    return res.status(400).json({
      success: false,
      error: 'Please provide project scope details of at least 20 characters.',
    });
  }
  if (!privacyConsent) {
    return res.status(400).json({
      success: false,
      error: 'Authorization under OPHIREUM confidentiality terms is required.',
    });
  }

  const type: 'contact_form' | 'solution_builder' =
    body.type === 'solution_builder' ? 'solution_builder' : 'contact_form';

  // Resolve selected services server-side from canonical SERVICE_CATALOG
  const requestedIds: string[] = Array.isArray(body.selectedServiceIds)
    ? body.selectedServiceIds.filter((id: unknown): id is string => typeof id === 'string')
    : typeof body.serviceId === 'string' && body.serviceId.trim()
    ? [body.serviceId.trim()]
    : [];

  const matchedCatalogServices = requestedIds
    .map((id) => SERVICE_CATALOG.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  let estimatedOneTimeStartingUsd = 0;
  let estimatedMonthlyStartingUsd = 0;
  for (const svc of matchedCatalogServices) {
    if (svc.pricing.model === 'subscription_monthly') {
      estimatedMonthlyStartingUsd += svc.pricing.startingUsd;
    } else if (svc.pricing.model === 'setup_plus_monthly') {
      estimatedOneTimeStartingUsd += svc.pricing.startingUsd;
      estimatedMonthlyStartingUsd += svc.pricing.monthlyUsd || 0;
    } else {
      estimatedOneTimeStartingUsd += svc.pricing.startingUsd;
    }
  }

  const serviceTitle =
    matchedCatalogServices.length > 0
      ? matchedCatalogServices.map((s) => s.title).join(' + ')
      : typeof body.serviceTitle === 'string' && body.serviceTitle.trim()
      ? body.serviceTitle.trim()
      : requestedIds.join(', ') || 'General Consultation';

  const serviceId =
    matchedCatalogServices.length > 0
      ? matchedCatalogServices.map((s) => s.id).join(', ')
      : requestedIds.join(', ') || 'general-consultation';

  let estimatedBudget =
    typeof body.estimatedBudget === 'string' && body.estimatedBudget.trim()
      ? body.estimatedBudget.trim()
      : 'To be scoped via proposal';

  if (matchedCatalogServices.length > 0 && type === 'solution_builder') {
    const parts: string[] = [];
    if (estimatedOneTimeStartingUsd > 0) {
      parts.push(`Starting est. $${estimatedOneTimeStartingUsd.toLocaleString('en-US')}`);
    }
    if (estimatedMonthlyStartingUsd > 0) {
      parts.push(`$${estimatedMonthlyStartingUsd.toLocaleString('en-US')}/mo`);
    }
    estimatedBudget = parts.join(' + ') || estimatedBudget;
  }

  const prefix = type === 'solution_builder' ? 'OPM-SOL' : 'OPM-INQ';
  const referenceId = `${prefix}-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const timestamp = new Date().toISOString();

  const record: StoredInquiryRecord = {
    referenceId,
    type,
    fullName,
    email,
    contactNumber,
    company,
    industry: typeof body.industry === 'string' ? body.industry.trim() : undefined,
    targetTimeline: typeof body.targetTimeline === 'string' ? body.targetTimeline.trim() : undefined,
    serviceId,
    serviceTitle,
    selectedServiceIds: matchedCatalogServices.map((s) => s.id),
    estimatedOneTimeStartingUsd: estimatedOneTimeStartingUsd || undefined,
    estimatedMonthlyStartingUsd: estimatedMonthlyStartingUsd || undefined,
    estimatedBudget,
    preferredCurrency: body.preferredCurrency === 'PHP' ? 'PHP' : 'USD',
    phpConversionRate: typeof body.phpConversionRate === 'number' ? body.phpConversionRate : undefined,
    projectDescription,
    fileName: typeof body.fileName === 'string' ? body.fileName.trim() : undefined,
    status: 'Routed to Executive Desk',
    routedTo: 'ophireum.multimedia@gmail.com (Dhenze Languisan, Founder & CEO)',
    timestamp,
  };

  inquiryStore.unshift(record);
  persistSubmissions();

  return res.status(201).json({
    success: true,
    referenceId,
    timestamp,
    inquiry: record,
    notice: `${COMMERCIAL_PRICING_NOTICE} ${EXTERNAL_CHARGES_DISCLOSURE}`,
  });
});

// =========================================================================
// AI SOLUTIONS CONSULTANT TEXT CHAT ENDPOINT (Grounded in Full 10-Category Catalog)
// =========================================================================

app.post('/api/consultant/chat', async (req: Request, res: Response) => {
  const { userMessage, state = {}, conversationHistory = [], language = 'en-US' } = req.body || {};

  if (!userMessage || typeof userMessage !== 'string') {
    return res.status(400).json({ error: 'userMessage is required' });
  }

  const trimmed = userMessage.trim().slice(0, 4000);
  const isFilipino =
    language.startsWith('fil') || language.startsWith('tl') || /filipino|tagalog/i.test(trimmed);

  const systemInstruction = `You are the official OPHIREUM AI Solutions Consultant for OPHIREUM MULTIMEDIA PRODUCTION (DTI Registration No. 7567003), headquartered at KMC | One West Aeropark, Clark Freeport Zone, Mabalacat City, Pampanga, Philippines. Founder & CEO: Dhenze Languisan (+63 917 966 8814).

OFFICIAL 10-CATEGORY SERVICE CATALOG & STARTING PRICING:
${CATALOG_SUMMARY_FOR_AI}

MANDATORY PRICING & COMPLIANCE RULES:
1. ${COMMERCIAL_PRICING_NOTICE}
2. ${EXTERNAL_CHARGES_DISCLOSURE}
3. Never guarantee fixed final pricing. Always frame advertised figures accurately as "Starting at $XXX", "Plans starting at $XXX/month", or "Implementation starting at $XXX + ongoing starting at $XXX/month".
4. PHP figures are optional estimates based on configurable FX conversion (default ~58 PHP per USD) and must be framed as estimates only.
5. Blockchain compliance: ${BLOCKCHAIN_COMPLIANCE_NOTICE}
6. Emerging technology feasibility: ${EMERGING_TECH_FEASIBILITY_NOTICE}
7. Never invent unverified client testimonials, awards, certifications, or nonexistent staff. Never guarantee calendar confirmations that have not been submitted via the Booking Modal.

CONSULTATION BEHAVIOR:
- Explain services, compare packages clearly, ask 1–2 structured discovery questions (business goal, target users/integrations, timeline, or organization/contact details for a brief), and recommend up to 3 exact matching service IDs from the catalog above.
- If the user asks to speak to a human or CEO, set suggestedAction to "talk_to_human".
- If enough scope details are gathered or the user wants a brief/proposal, set suggestedAction to "review_brief".
- If the user asks to schedule or book a meeting, set suggestedAction to "schedule_meeting".
- Respond in crisp, executive consultative English${isFilipino ? ' or natural respectful Filipino/Taglish as requested' : ''}.`;

  try {
    if (ai) {
      const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];
      const recentHistory = Array.isArray(conversationHistory) ? conversationHistory.slice(-8) : [];
      for (const turn of recentHistory) {
        if (turn?.sender === 'user' && typeof turn.text === 'string' && turn.text.trim()) {
          contents.push({ role: 'user', parts: [{ text: turn.text.trim() }] });
        } else if (turn?.sender === 'ai' && typeof turn.text === 'string' && turn.text.trim()) {
          contents.push({ role: 'model', parts: [{ text: turn.text.trim() }] });
        }
      }

      const contextNote =
        state?.requirements?.category || state?.requirements?.businessProblem
          ? `\n[Discovery context so far — Category: ${state.requirements.category || 'Unspecified'}, Problem: ${state.requirements.businessProblem || 'Unspecified'}, Stage: ${state.currentStage || 'welcome'}]`
          : '';

      contents.push({ role: 'user', parts: [{ text: `${trimmed}${contextNote}` }] });

      const timeoutPromise = new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('Gemini chat timeout')), 9000)
      );

      const geminiPromise = ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: contents as any,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              replyText: {
                type: Type.STRING,
                description: 'Consultative answer explaining relevant OPHIREUM solutions, starting pricing framing, and next discovery question.',
              },
              recommendedServiceIds: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'Up to 3 exact service IDs from the provided OPHIREUM catalog.',
              },
              suggestedAction: {
                type: Type.STRING,
                description: 'One of: none, review_brief, schedule_meeting, talk_to_human',
              },
              quickReplies: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '2 to 4 concise follow-up button options under 7 words each.',
              },
            },
            required: ['replyText', 'recommendedServiceIds', 'suggestedAction', 'quickReplies'],
          },
        },
      });

      const response: any = await Promise.race([geminiPromise, timeoutPromise]);
      const rawJson = response?.text ? response.text.trim() : '';
      if (rawJson) {
        const parsed = JSON.parse(rawJson);
        const validIds = Array.isArray(parsed.recommendedServiceIds)
          ? parsed.recommendedServiceIds.filter((id: string) => SERVICE_CATALOG.some((s) => s.id === id))
          : [];
        const allowedActions = ['none', 'review_brief', 'schedule_meeting', 'talk_to_human'];
        const action = allowedActions.includes(parsed.suggestedAction) ? parsed.suggestedAction : 'none';

        return res.json({
          replyText: parsed.replyText,
          recommendedServiceIds: validIds,
          suggestedAction: action === 'none' ? undefined : action,
          quickReplies: Array.isArray(parsed.quickReplies) && parsed.quickReplies.length > 0
            ? parsed.quickReplies.slice(0, 4)
            : ['Review Project Brief', 'Schedule Consultation'],
          provider: 'Gemini Live AI Solutions Consultant',
          timestamp: new Date().toISOString(),
        });
      }
    }
  } catch (err: any) {
    console.warn('[OPHIREUM] /api/consultant/chat fallback activated:', err?.message || err);
  }

  // Deterministic catalog-grounded fallback response
  const matched = findCatalogMatches(trimmed, 3);
  const isBlockchain = /blockchain|web3|smart contract|token|nft|dao|wallet|ledger/i.test(trimmed);
  const isEmerging = /iot|computer vision|digital twin|ar\/vr|virtual reality|augmented reality/i.test(trimmed);
  const isBooking = /schedule|appointment|book|meeting|calendar/i.test(trimmed);
  const isHuman = /human|ceo|dhenze|founder|call now|phone/i.test(trimmed);

  let replyText = '';
  if (matched.length > 0) {
    const summaryLines = matched
      .map((s) => {
        const priceLabel =
          s.pricing.model === 'setup_plus_monthly'
            ? `Implementation starting at $${s.pricing.startingUsd.toLocaleString('en-US')} + ongoing starting at $${(s.pricing.monthlyUsd || 0).toLocaleString('en-US')}/mo`
            : s.pricing.model === 'subscription_monthly'
            ? `Plans starting at $${s.pricing.startingUsd.toLocaleString('en-US')}/mo`
            : `Starting at $${s.pricing.startingUsd.toLocaleString('en-US')}`;
        return `• ${s.title} (${priceLabel}) — ${s.shortDescription}`;
      })
      .join('\n');

    replyText = `Based on your inquiry, here are matching solutions from the OPHIREUM catalog:\n\n${summaryLines}\n\nNote: All prices represent starting investments; final scope and any external infrastructure or third-party API fees are itemized in your proposal.`;
    if (isBlockchain) {
      replyText += ` Also note that blockchain implementations are custom-engineered without guaranteed financial returns and require formal third-party security review for regulated workflows.`;
    } else if (isEmerging) {
      replyText += ` Emerging hardware/spatial solutions undergo a technical feasibility assessment prior to build commitment.`;
    }
    replyText += `\n\nTo prepare a tailored Project Brief, what target timeline and key integrations do you need?`;
  } else {
    replyText = `Thank you for reaching out to OPHIREUM MULTIMEDIA PRODUCTION. We deliver across 10 integrated technology disciplines—spanning Web Platforms (starting at $450), AI Agents (starting at $300), Blockchain/Web3 (starting at $950), Enterprise & Mobile Software, Cloud/Cybersecurity, and Creative Multimedia.\n\nCould you share the primary business challenge you want to solve and your target timeline?`;
  }

  return res.json({
    replyText,
    recommendedServiceIds: matched.map((m) => m.id),
    suggestedAction: isHuman ? 'talk_to_human' : isBooking ? 'schedule_meeting' : undefined,
    quickReplies: [
      'Compare starting packages',
      'Review Project Brief',
      'Schedule Consultation',
      'Speak with CEO Dhenze Languisan',
    ],
    provider: 'OPHIREUM Catalog Consultative Engine',
    timestamp: new Date().toISOString(),
  });
});

// =========================================================================
// VOICE SESSION & TRANSCRIPTION ENDPOINTS
// =========================================================================

// Voice Session Configuration
app.post('/api/voice/session', (req: Request, res: Response) => {
  const { language = 'en-US' } = req.body || {};
  const sessionId = `opm-voice-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

  res.json({
    sessionId,
    status: 'ready',
    preferredModel: 'gemini-4-hydrogen',
    preferredTtsModel: 'gemini-3.8-flash-lite-tts',
    language,
    sampleRate: 24000,
    serverGeminiAvailable: Boolean(ai),
    disclaimer:
      'Voice Disclosure: OPHIREUM AI Solutions Consultant voice mode is active. Microphone audio is used strictly for real-time consultation transcription and response generation and is not permanently stored.',
  });
});

// Process conversational voice turn with Gemini
app.post('/api/voice/process', async (req: Request, res: Response) => {
  const {
    userMessage,
    language = 'en-US',
    conversationHistory = [],
  } = req.body || {};

  if (!userMessage || typeof userMessage !== 'string') {
    return res.status(400).json({ error: 'userMessage is required' });
  }

  const isFilipino =
    language.startsWith('fil') || language.startsWith('tl') || /filipino|tagalog/i.test(language);

  const systemInstruction = `You are the official OPHIREUM AI Solutions Consultant for OPHIREUM MULTIMEDIA PRODUCTION located at KMC | One West Aeropark, Clark Freeport Zone, Mabalacat City, Pampanga, Philippines.
Registered DTI Business Name: OPHIREUM MULTIMEDIA PRODUCTION (Registration No. 7567003). Founder & CEO: Dhenze Languisan (mobile: +63 917 966 8814).

Service Divisions (all pricing is Starting Investment only, external charges billed separately):
1. Website & Digital Experience Development (Starting at $450 to $3,500)
2. Artificial Intelligence & AI Agents (Starting at $300 to $1,500+)
3. Blockchain & Web3 Development (Smart Contracts from $950, Web3 Apps from $1,800; never claim guaranteed returns or regulatory approval)
4. Enterprise Software & Mobile Applications (Starting at $2,200 to $4,500+)
5. Automation, Data Analytics, Computer Vision & IoT (Starting at $350+; emerging tech subject to feasibility)
6. Cloud, Cybersecurity & Infrastructure (Starting at $450+)
7. Digital Modernization & Website Care (One-time upgrades from $150; Care Memberships starting at $120/mo to $650/mo)
8. Creative Multimedia & Brand Innovation (Starting at $350+)
9. Industry-Specific Digital Solutions (12 verticals from $480+)
10. Signature Business Transformation Packages (Starter $1,250, Growth $2,800, AI-Powered $4,500, Enterprise Custom Quote)

Tone & Voice Personality:
- Professional, consultative, articulate, executive-grade, confident, approachable.
- When speaking in Filipino/Tagalog or ${isFilipino ? 'Filipino mode is active' : 'requested'}, speak natural, respectful Filipino with clear English technical terms.
- IMPORTANT FOR VOICE: Keep spoken answers CONCISE and conversational (2 to 4 sentences maximum). Do NOT output markdown tables, asterisks, bullet points, or raw JSON, as this will be read aloud.
- Guide the conversation proactively: Ask targeted discovery questions or offer to prepare a project brief or schedule a consultation with CEO Dhenze Languisan and the engineering team (Monday to Friday, 9:00 AM to 5:00 PM PST).`;

  try {
    if (ai) {
      const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

      const recentHistory = Array.isArray(conversationHistory) ? conversationHistory.slice(-6) : [];
      for (const turn of recentHistory) {
        if (turn.sender === 'user' && turn.text) {
          contents.push({ role: 'user', parts: [{ text: turn.text }] });
        } else if (turn.sender === 'ai' && turn.text) {
          contents.push({ role: 'model', parts: [{ text: turn.text }] });
        }
      }

      contents.push({ role: 'user', parts: [{ text: userMessage }] });

      const timeoutPromise = new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('Gemini API timeout')), 7000)
      );

      const geminiPromise = ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: contents as any,
        config: {
          systemInstruction,
        },
      });

      const response: any = await Promise.race([geminiPromise, timeoutPromise]);
      const replyText = response && response.text ? response.text.trim() : '';

      const isBookingIntent = /schedule|appointment|book|calendar|slot|meeting/i.test(userMessage);
      const isBriefIntent = /brief|proposal|scope|specification|quote/i.test(userMessage);
      const isHumanEscalation = /speak to (a )?human|call (the )?ceo|dhenze|founder|phone number/i.test(userMessage);

      return res.json({
        replyText:
          replyText ||
          'I understand your project requirements. Would you like me to prepare a preliminary brief or help schedule a consultation slot for you?',
        detectedIntent: {
          isBookingIntent,
          isBriefIntent,
          isHumanEscalation,
        },
        language,
        timestamp: new Date().toISOString(),
      });
    } else {
      const matches = findCatalogMatches(userMessage, 2);
      let replyText = `Understood. At OPHIREUM MULTIMEDIA PRODUCTION, our team in Clark Freeport Zone delivers integrated platforms across web, AI, blockchain, and enterprise software.`;

      if (matches.length > 0) {
        const first = matches[0];
        replyText = isFilipino
          ? `Para sa inyong project, inirerekomenda namin ang ${first.title} na nagsisimula sa $${first.pricing.startingUsd.toLocaleString('en-US')}. Ano po ang target timeline at pangunahing features na kailangan ninyo?`
          : `For your objective, our ${first.title} offering starts at $${first.pricing.startingUsd.toLocaleString('en-US')}, subject to final scope. What timeline and key integrations are most important for your team?`;
      } else if (/schedule|appointment|book|meeting/i.test(userMessage)) {
        replyText = isFilipino
          ? 'Ikinagagalak po naming mag-schedule ng consultation. May available slots tayo mula Lunes hanggang Biyernes sa Clark Freeport Zone o via Google Meet. Anong araw at oras po ang pinakamainam para sa inyo?'
          : 'I would be pleased to help schedule an executive consultation. We have availability Monday through Friday for video conference or in-person at our Clark Freeport Zone suite. What day and time works best for you?';
      }

      return res.json({
        replyText,
        detectedIntent: {
          isBookingIntent: /schedule|appointment|book|meeting/i.test(userMessage),
          isBriefIntent: /brief|proposal|scope/i.test(userMessage),
          isHumanEscalation: /human|ceo|dhenze|call/i.test(userMessage),
        },
        language,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error: any) {
    console.warn('Gemini Voice API bypassed or timed out, returning fallback:', error?.message || error);

    const fallbackReply = isFilipino
      ? 'Naintindihan ko po ang inyong pangangailangan. Nais po ba ninyong ihanda ang project brief o mag-schedule ng consultation kasama ang aming team sa Clark Freeport Zone?'
      : 'I understand your project objective. We can tailor a solution across our web, AI, blockchain, and enterprise software divisions. Would you like to prepare a preliminary brief or schedule a consultation?';

    return res.json({
      replyText: fallbackReply,
      detectedIntent: {
        isBookingIntent: /schedule|appointment|book|meeting/i.test(userMessage),
        isBriefIntent: /brief|proposal|scope/i.test(userMessage),
        isHumanEscalation: /human|ceo|dhenze|call/i.test(userMessage),
      },
      language,
      timestamp: new Date().toISOString(),
      provider: 'OPHIREUM Consultative Voice Engine',
    });
  }
});

// Audio transcription endpoint using gemini-3.5-transcribe
app.post('/api/voice/transcribe', async (req: Request, res: Response) => {
  const { audioBase64, mimeType = 'audio/webm' } = req.body || {};

  if (!audioBase64) {
    return res.status(400).json({ error: 'audioBase64 is required' });
  }

  if (!ai) {
    return res.json({
      transcript: '',
      notice: 'Server-side Gemini transcription not configured with API key. Client-side speech recognition is active.',
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: [
        {
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType,
                data: audioBase64,
              },
            },
            {
              text: 'Accurately transcribe the spoken speech in this audio clip. Return ONLY the transcribed text without quotes or explanations.',
            },
          ],
        },
      ],
    });

    const transcript = response.text ? response.text.trim() : '';
    res.json({ transcript });
  } catch (error: any) {
    console.error('Transcription error:', error);
    res.status(500).json({ error: 'Transcription failed', details: error?.message });
  }
});

// =========================================================================
// DEV / PROD SERVER BOOTSTRAP
// =========================================================================

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, port: PORT },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[OPHIREUM NETWORK] Server running on http://0.0.0.0:${PORT}`);
    console.log(`[OPHIREUM NETWORK] Gemini AI Engine: ${ai ? 'ONLINE' : 'FALLBACK_MODE'}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal error starting server:', err);
});
