/*
Copyright (c) 2026 Ophireum Multimedia Production. All rights reserved.
Developer and claimed rights holder: Ophireum Multimedia Production
DTI-registered business, Philippines | Registration No. 7567003
SPDX-FileCopyrightText: 2026 Ophireum Multimedia Production
SPDX-License-Identifier: LicenseRef-Ophireum-Proprietary
Third-party materials, dependencies, and separately licensed components remain subject to their respective rights and licenses.
*/

import { SERVICE_CATALOG, CATALOG_CATEGORIES, formatCatalogPrice } from '../data/serviceCatalog';
import { ProjectBrief, ClientProfile, ProjectRequirements } from './supabaseService';
import { apiUrl } from '../lib/apiClient';

export interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: string;
  stage?: 'welcome' | 'category' | 'details' | 'recommendation' | 'brief' | 'schedule';
  quickReplies?: string[];
  recommendedServiceIds?: string[];
  suggestedAction?: 'review_brief' | 'schedule_meeting' | 'talk_to_human';
}

export interface ConsultationState {
  currentStage:
    | 'welcome'
    | 'category'
    | 'problem'
    | 'features'
    | 'client_info'
    | 'recommendation'
    | 'brief_ready'
    | 'scheduling'
    | 'confirmed';
  client: ClientProfile;
  requirements: ProjectRequirements;
  generatedBrief?: ProjectBrief;
  scheduledAppointment?: any;
}

export const INITIAL_CONSULTATION_STATE: ConsultationState = {
  currentStage: 'welcome',
  client: {
    fullName: '',
    email: '',
    phone: '',
    companyName: '',
    industry: '',
    location: '',
  },
  requirements: {
    category: '',
    businessProblem: '',
    targetUsers: '',
    keyFeatures: [],
    existingSystems: '',
    thirdPartyIntegrations: [],
    budgetPreference: '',
    targetTimeline: '',
    specialRequirements: '',
  },
};

export const PROJECT_CATEGORIES = CATALOG_CATEGORIES.filter((c) => c.id !== 'all').map((c) => c.label);

const matchCatalogLocally = (query: string, limit = 3) => {
  const q = query.toLowerCase();
  const tokens = q.split(/\W+/).filter((t) => t.length > 2);
  return SERVICE_CATALOG.map((svc) => {
    const text = `${svc.title} ${svc.shortDescription} ${svc.capabilities.join(' ')} ${svc.categoryId}`.toLowerCase();
    let score = 0;
    for (const token of tokens) {
      if (svc.title.toLowerCase().includes(token)) score += 4;
      else if (text.includes(token)) score += 1;
    }
    return { svc, score };
  })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.svc);
};

const synthesizeBriefFromState = (state: ConsultationState, recommendedIds: string[]): ProjectBrief => {
  const refCode = `OPM-BRF-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const matchedServices = recommendedIds
    .map((id) => SERVICE_CATALOG.find((s) => s.id === id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  const recommendedModules =
    matchedServices.length > 0
      ? matchedServices.map((s) => `${s.title} (${formatCatalogPrice(s, 'USD', 58).primaryLabel})`)
      : [
          'Authentication & Multi-Tenant Access Controller',
          'Distributed Cloud API & Event Engine',
          'Real-Time Status & Progress Dashboard',
          'Automated CI/CD & Quality Verification Pipeline',
        ];

  return {
    referenceCode: refCode,
    client: {
      fullName: state.client.fullName || 'Prospective Enterprise Client',
      email: state.client.email || 'client@organization.com',
      phone: state.client.phone || '+63 9XX XXX XXXX',
      companyName: state.client.companyName || 'Client Organization',
      industry: state.client.industry || 'Digital & Enterprise Services',
      location: state.client.location || 'Philippines / International',
    },
    requirements: {
      category: state.requirements.category || 'Unified Digital & Technology Solution',
      businessProblem:
        state.requirements.businessProblem ||
        'Operational scalability, digital platform modernization, and intelligent automation.',
      keyFeatures:
        state.requirements.keyFeatures.length > 0
          ? state.requirements.keyFeatures
          : matchedServices.flatMap((s) => s.capabilities).slice(0, 4),
      budgetPreference: state.requirements.budgetPreference || 'Subject to scoped proposal review',
      targetTimeline: state.requirements.targetTimeline || 'Staged Milestone Delivery (4–12 Weeks)',
    },
    technicalArchitecture: {
      recommendedModules,
      suggestedStack: ['React 19', 'TypeScript', 'Node.js', 'PostgreSQL / Cloud SQL', '@google/genai SDK'],
      infrastructure: 'Managed cloud architecture with automated backups, HTTPS encryption, and access controls.',
      securityMeasures: [
        'Role-Based Access Control (RBAC) & Row-Level Security',
        'Server-side secret & API key isolation',
        'Compliance & pre-deployment security review',
      ],
    },
    commercialDiscovery: {
      budgetPreference: 'Starting investment basis — finalized upon verified proposal sign-off',
      timelinePreference: 'Staged engineering & milestone review',
      suggestedPhases: [
        'Phase 1: Discovery, Feasibility & Architecture Blueprint',
        'Phase 2: Core System & Interface Implementation',
        'Phase 3: Integration Testing, Security Hardening & QA',
        'Phase 4: Deployment, Handover & Optional Digital Care Plan',
      ],
      consultationAgenda: [
        'Validate business workflows and integration touchpoints',
        'Confirm deliverables, inclusions/exclusions, and external third-party costs',
        'Approve milestone schedule and formal proposal',
      ],
    },
    createdAt: new Date().toISOString(),
    status: 'draft',
  };
};

export const aiConsultantService = {
  async processUserMessage(
    userMessage: string,
    state: ConsultationState,
    conversationHistory: ChatMessage[],
    language: 'en-US' | 'fil-PH' = 'en-US'
  ): Promise<{ aiMessage: ChatMessage; updatedState: ConsultationState }> {
    const trimmed = userMessage.trim();
    const updatedState: ConsultationState = {
      ...state,
      client: { ...state.client },
      requirements: {
        ...state.requirements,
        keyFeatures: [...(state.requirements.keyFeatures || [])],
      },
    };
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msgId = `msg-${Date.now()}`;

    // Advance discovery state unobtrusively
    if (updatedState.currentStage === 'welcome') {
      const matchedCat =
        CATALOG_CATEGORIES.find(
          (c) =>
            c.id !== 'all' &&
            (trimmed.toLowerCase().includes(c.label.toLowerCase()) ||
              trimmed.toLowerCase().includes(c.shortLabel.toLowerCase()))
        )?.label || trimmed;
      updatedState.requirements.category = matchedCat;
      updatedState.currentStage = 'problem';
    } else if (updatedState.currentStage === 'problem') {
      updatedState.requirements.businessProblem = trimmed;
      updatedState.currentStage = 'features';
    } else if (updatedState.currentStage === 'features') {
      updatedState.requirements.keyFeatures = trimmed
        .split(/,|\n| and /)
        .map((f) => f.trim())
        .filter(Boolean);
      updatedState.currentStage = 'client_info';
    } else if (updatedState.currentStage === 'client_info') {
      const emailMatch = trimmed.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (emailMatch) updatedState.client.email = emailMatch[0];
      const parts = trimmed.split(/[,\n-]/).map((s) => s.trim());
      if (parts[0] && !updatedState.client.fullName) {
        updatedState.client.fullName = parts[0].replace(/my name is/i, '').replace(/i am/i, '').trim();
      }
      if (parts[1] && !updatedState.client.companyName) {
        updatedState.client.companyName = parts[1].replace(/company is/i, '').replace(/at/i, '').trim();
      }
      updatedState.currentStage = 'brief_ready';
    }

    // Call live server-side AI Solutions Consultant endpoint grounded in the 10-category catalog
    try {
      const response = await fetch(apiUrl('/api/consultant/chat'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userMessage: trimmed.slice(0, 2000),
          state: updatedState,
          conversationHistory: conversationHistory.slice(-8).map((m) => ({
            sender: m.sender,
            text: m.text.slice(0, 1200),
          })),
          language,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const recommendedIds: string[] = Array.isArray(data.recommendedServiceIds)
          ? data.recommendedServiceIds
          : [];

        if (
          updatedState.currentStage === 'brief_ready' ||
          data.suggestedAction === 'review_brief'
        ) {
          updatedState.generatedBrief = synthesizeBriefFromState(updatedState, recommendedIds);
          updatedState.currentStage = 'brief_ready';
        }

        return {
          aiMessage: {
            id: msgId,
            sender: 'ai',
            text: data.replyText,
            timestamp: now,
            recommendedServiceIds: recommendedIds,
            suggestedAction: data.suggestedAction,
            quickReplies: Array.isArray(data.quickReplies)
              ? data.quickReplies
              : ['Review Project Brief', 'Schedule Consultation'],
          },
          updatedState,
        };
      }
    } catch (err) {
      console.warn('[OPHIREUM] Falling back to local catalog consultant engine:', err);
    }

    // Local catalog-grounded fallback if backend is unreachable
    const localMatches = matchCatalogLocally(
      `${trimmed} ${updatedState.requirements.category} ${updatedState.requirements.businessProblem}`,
      3
    );

    if (updatedState.currentStage === 'brief_ready') {
      updatedState.generatedBrief = synthesizeBriefFromState(
        updatedState,
        localMatches.map((m) => m.id)
      );
      return {
        aiMessage: {
          id: msgId,
          sender: 'ai',
          text: `Thank you. I have prepared a preliminary Project Brief (Ref: ${updatedState.generatedBrief.referenceCode}) tailored to your goals. All pricing figures represent starting investments and final scope will be verified prior to build kickoff. Would you like to inspect your brief or book a consultation?`,
          timestamp: now,
          stage: 'brief',
          recommendedServiceIds: localMatches.map((m) => m.id),
          suggestedAction: 'review_brief',
          quickReplies: ['Review Project Brief', 'Schedule Consultation', 'Speak with CEO Dhenze Languisan'],
        },
        updatedState,
      };
    }

    const matchText =
      localMatches.length > 0
        ? `Matched OPHIREUM capabilities:\n${localMatches
            .map((m) => `• ${m.title} — ${formatCatalogPrice(m, 'USD', 58).primaryLabel}`)
            .join('\n')}\n\nTo narrow the recommendation, what target timeline and key features or integrations do you require?`
        : `Understood. To prepare your customized scope and starting investment breakdown across our 10 technology divisions, what specific goals, users, or integrations does this project require?`;

    return {
      aiMessage: {
        id: msgId,
        sender: 'ai',
        text: matchText,
        timestamp: now,
        stage: 'recommendation',
        recommendedServiceIds: localMatches.map((m) => m.id),
        quickReplies: [
          'Prepare Project Brief',
          'Schedule Consultation',
          'Speak with CEO Dhenze Languisan',
        ],
      },
      updatedState,
    };
  },
};
