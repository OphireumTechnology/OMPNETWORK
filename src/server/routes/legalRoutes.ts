import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import { COMPANY_CONFIG } from '../../data/companyConfig';
import { PortalRepository } from '../portal/types';
import { sanitizePlainText } from '../validation';

export interface LegalPolicyDocument {
  slug: string;
  title: string;
  versionTag: string;
  reviewStatus: 'pending_legal_review' | 'approved';
  applicableLaws: string[];
  summary: string;
  sections: Array<{ heading: string; body: string }>;
}

export interface PrivacyRequestRecord {
  id: string;
  referenceCode: string;
  requesterName: string;
  requesterEmail: string;
  requestType: 'data_access' | 'data_export' | 'rectification' | 'erasure' | 'objection' | 'complaint';
  details: string;
  status: 'received' | 'verifying_identity' | 'in_progress' | 'completed';
  createdAt: string;
}

const LEGAL_REVIEW_DISCLAIMER =
  'DRAFT FOR GOVERNANCE & COMPLIANCE READINESS — Pending final review and sign-off by OPHIREUM MULTIMEDIA PRODUCTION ownership and qualified Philippine legal counsel prior to binding commercial publication.';

export const OPHIREUM_LEGAL_POLICIES: LegalPolicyDocument[] = [
  {
    slug: 'privacy-policy',
    title: 'Privacy Policy',
    versionTag: '2026.1-draft',
    reviewStatus: 'pending_legal_review',
    applicableLaws: ['Republic Act No. 10173 (Data Privacy Act of 2012)', 'NPC Circulars', 'GDPR Principles'],
    summary: `Explains how ${COMPANY_CONFIG.name} (DTI Reg. No. ${COMPANY_CONFIG.dti.registrationNo}) collects, protects, retains, and processes personal information.`,
    sections: [
      {
        heading: '1. Data Controller & Contact Information',
        body: `${COMPANY_CONFIG.name}, located at ${COMPANY_CONFIG.address.fullFormatted}, acts as the Personal Information Controller. Data protection inquiries may be directed to ${COMPANY_CONFIG.founderCeo} (${COMPANY_CONFIG.mobile}).`,
      },
      {
        heading: '2. Categories of Data Collected',
        body: 'We collect contact details, company profiles, project briefs, consultation requests, transactional order/invoice metadata, support communications, and consent timestamps strictly necessary to deliver requested technology and multimedia services.',
      },
      {
        heading: '3. Security, Storage & Retention',
        body: 'Personal data is protected through encrypted transport, server-side authorization, Row Level Security (RLS), and immutable audit trails. Payment card details are never stored on OPHIREUM servers.',
      },
      {
        heading: '4. Data Subject Rights (RA 10173)',
        body: 'You have the right to be informed, access, rectify, export (data portability), object, or request erasure of your personal data via the Client Portal Privacy module or the Data Subject Request form.',
      },
    ],
  },
  {
    slug: 'terms-of-service',
    title: 'Terms of Service',
    versionTag: '2026.1-draft',
    reviewStatus: 'pending_legal_review',
    applicableLaws: ['Civil Code of the Philippines', 'RA 8792 (E-Commerce Act)', 'RA 11967 (Internet Transactions Act)'],
    summary: 'Governs access to the OPHIREUM NETWORK website, Client Portal, consultation scheduling, and commercial service engagements.',
    sections: [
      {
        heading: '1. Preliminary Estimates vs. Binding Agreements',
        body: 'All catalog prices displayed on the website represent starting investment benchmarks only. Binding pricing, timelines, and deliverables are confirmed exclusively via an approved formal quotation, Statement of Work, or verified Client Portal order.',
      },
      {
        heading: '2. Third-Party Infrastructure & API Charges',
        body: 'Cloud hosting, domains, SMS/email quotas, payment gateway fees, AI model token usage, and third-party SaaS licenses are itemized separately unless explicitly included in a signed contract.',
      },
      {
        heading: '3. Intellectual Property',
        body: 'Upon verified full payment, bespoke deliverables transfer according to the agreed license or Statement of Work, excluding pre-existing OPHIREUM proprietary frameworks and open-source dependencies.',
      },
    ],
  },
  {
    slug: 'refund-policy',
    title: 'Refund & Cancellation Policy',
    versionTag: '2026.1-draft',
    reviewStatus: 'pending_legal_review',
    applicableLaws: ['RA 7394 (Consumer Act of the Philippines)', 'RA 11967 (Internet Transactions Act)'],
    summary: 'Defines transparent rules for order cancellations, partial/full refunds, digital product exclusions, and dispute review.',
    sections: [
      {
        heading: '1. Unpaid & Pending Orders',
        body: 'Orders cancelled prior to verified payment settlement incur zero charge and immediately release reserved pending credits.',
      },
      {
        heading: '2. Paid Service & Custom Production Orders',
        body: 'Refund requests on paid engagements are reviewed by Finance and Operations leadership based on milestone completion status. Approved refunds are processed back through the originating verified payment gateway.',
      },
      {
        heading: '3. Digital Entitlements & Consumed Credits',
        body: 'Digital assets downloaded via active license keys and credits already consumed on delivered work are generally non-refundable unless a verified technical defect cannot be remedied.',
      },
    ],
  },
  {
    slug: 'subscription-terms',
    title: 'Subscription & Recurring Billing Terms',
    versionTag: '2026.1-draft',
    reviewStatus: 'pending_legal_review',
    applicableLaws: ['RA 7394', 'RA 11967'],
    summary: 'Explains recurring plan activation, monthly credit allocations, renewal cadence, and self-service cancellation.',
    sections: [
      {
        heading: '1. Activation Upon Verified Settlement',
        body: 'Subscriptions activate strictly upon server-verified payment confirmation. No recurring plan activates automatically on unverified checkout attempts.',
      },
      {
        heading: '2. Cancellation & Billing Cycle',
        body: 'Clients may request cancellation at any time from the Client Portal Subscriptions screen. Access continues through the end of the currently paid billing period unless otherwise specified.',
      },
    ],
  },
  {
    slug: 'acceptable-use',
    title: 'Acceptable Use Policy',
    versionTag: '2026.1-draft',
    reviewStatus: 'pending_legal_review',
    applicableLaws: ['RA 10175 (Cybercrime Prevention Act of 2012)'],
    summary: 'Prohibits abusive traffic, unauthorized penetration testing, malicious uploads, and unlawful automation on OPHIREUM systems.',
    sections: [
      {
        heading: '1. Prohibited Conduct',
        body: 'Users must not attempt unauthorized access, bypass rate limits, inject malicious payloads, upload malware, or misuse AI consultation tools to extract system prompts or third-party data.',
      },
    ],
  },
  {
    slug: 'cookie-policy',
    title: 'Cookie & Session Security Policy',
    versionTag: '2026.1-draft',
    reviewStatus: 'pending_legal_review',
    applicableLaws: ['RA 10173 (Data Privacy Act of 2012)'],
    summary: 'Details strictly necessary HttpOnly authentication cookies, CSRF protections, and zero third-party ad tracking.',
    sections: [
      {
        heading: '1. Essential Security Cookies',
        body: 'OPHIREUM NETWORK uses HttpOnly, SameSite-protected session cookies exclusively for authenticated Client Portal and Admin sessions. Authentication tokens are never stored in browser localStorage.',
      },
    ],
  },
  {
    slug: 'digital-licensing',
    title: 'Digital Product Licensing Terms',
    versionTag: '2026.1-draft',
    reviewStatus: 'pending_legal_review',
    applicableLaws: ['RA 8293 (Intellectual Property Code of the Philippines)'],
    summary: 'Establishes usage rights, seat limits, download caps, and revocation terms for purchased digital entitlements.',
    sections: [
      {
        heading: '1. Licensed Entitlements',
        body: 'Each verified digital purchase issues a unique license key and private download allowance tied to the purchasing organization. Redistribution or resale without written authorization is prohibited.',
      },
    ],
  },
  {
    slug: 'ai-disclosure',
    title: 'AI Usage & Transparency Disclosure',
    versionTag: '2026.1-draft',
    reviewStatus: 'pending_legal_review',
    applicableLaws: ['RA 10173', 'Ethical AI Governance Standards'],
    summary: 'Discloses how OPHIREUM AI Solutions Consultant and internal AI Workforce agents assist users under human supervision.',
    sections: [
      {
        heading: '1. Human Oversight & Grounding',
        body: 'AI consultation tools assist with discovery and preliminary catalog guidance. AI responses are non-binding; all commercial contracts, refunds, deployments, and security decisions require human executive review.',
      },
      {
        heading: '2. Voice & Session Privacy',
        body: 'Microphone audio in voice mode is used strictly for real-time consultation transcription and is not permanently archived without explicit consent.',
      },
    ],
  },
  {
    slug: 'data-subject-request',
    title: 'Data Subject Request Procedure',
    versionTag: '2026.1-draft',
    reviewStatus: 'pending_legal_review',
    applicableLaws: ['RA 10173 (Data Privacy Act of 2012)'],
    summary: 'Step-by-step procedure for exercising data access, portability, rectification, or erasure rights.',
    sections: [
      {
        heading: '1. Submission & Identity Verification',
        body: 'Authenticated portal users may export their personal data immediately in JSON format or submit formal rectification/erasure requests below. Requests receive a tracking reference and identity verification check.',
      },
    ],
  },
  {
    slug: 'customer-complaint',
    title: 'Customer Complaint & Dispute Resolution Procedure',
    versionTag: '2026.1-draft',
    reviewStatus: 'pending_legal_review',
    applicableLaws: ['RA 11967 (Internet Transactions Act)', 'RA 7394 (Consumer Act)'],
    summary: 'Transparent escalation workflow for service quality, billing, or fulfillment complaints.',
    sections: [
      {
        heading: '1. Resolution SLA & Escalation',
        body: 'Every logged complaint receives a reference code and is routed to Operations & Client Success leadership for documented review and resolution.',
      },
    ],
  },
];

export function createLegalRouter(portalRepo: PortalRepository): Router {
  const router = Router();
  const privacyRequests: PrivacyRequestRecord[] = [];

  router.get('/policies', (_req: Request, res: Response) => {
    res.json({
      success: true,
      legalReviewNotice: LEGAL_REVIEW_DISCLAIMER,
      policies: OPHIREUM_LEGAL_POLICIES,
    });
  });

  router.get('/policies/:slug', (req: Request, res: Response) => {
    const slug = sanitizePlainText(req.params.slug, 80).toLowerCase();
    const policy = OPHIREUM_LEGAL_POLICIES.find((p) => p.slug === slug);
    if (!policy) {
      res.status(404).json({ success: false, error: 'Legal policy document not found.' });
      return;
    }
    res.json({
      success: true,
      legalReviewNotice: LEGAL_REVIEW_DISCLAIMER,
      policy,
    });
  });

  router.post('/consents', async (req: Request, res: Response) => {
    const email = sanitizePlainText(req.body?.email, 180).toLowerCase();
    const policySlug = sanitizePlainText(req.body?.policySlug, 80).toLowerCase();
    const policy = OPHIREUM_LEGAL_POLICIES.find((p) => p.slug === policySlug);
    if (!email || !policy) {
      res.status(400).json({ success: false, error: 'Valid email and policySlug are required.' });
      return;
    }
    if (!portalRepo.recordConsent) {
      res.status(503).json({ success: false, error: 'Consent persistence is unavailable.' });
      return;
    }
    const record = await portalRepo.recordConsent({
      email,
      policySlug: policy.slug,
      policyVersion: policy.versionTag,
      accepted: req.body?.accepted !== false,
      ipAddress: req.ip || 'unknown',
      userAgent: String(req.headers['user-agent'] || '').slice(0, 200),
    });
    res.status(201).json({ success: true, consent: record });
  });

  router.post('/privacy-requests', (req: Request, res: Response) => {
    const requesterName = sanitizePlainText(req.body?.requesterName, 140);
    const requesterEmail = sanitizePlainText(req.body?.requesterEmail, 180).toLowerCase();
    const details = sanitizePlainText(req.body?.details, 2000);
    const allowedTypes = ['data_access', 'data_export', 'rectification', 'erasure', 'objection', 'complaint'];
    const rawType = String(req.body?.requestType || '').trim();
    if (!requesterName || !requesterEmail || !details || !allowedTypes.includes(rawType)) {
      res.status(400).json({
        success: false,
        error: 'requesterName, requesterEmail, valid requestType, and details are required.',
      });
      return;
    }

    const record: PrivacyRequestRecord = {
      id: crypto.randomUUID(),
      referenceCode: `OPM-DSR-${new Date().getFullYear()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`,
      requesterName,
      requesterEmail,
      requestType: rawType as PrivacyRequestRecord['requestType'],
      details,
      status: 'received',
      createdAt: new Date().toISOString(),
    };
    privacyRequests.push(record);
    res.status(201).json({ success: true, request: record });
  });

  router.get('/privacy-requests/summary', (_req: Request, res: Response) => {
    res.json({ success: true, totalReceived: privacyRequests.length });
  });

  return router;
}
