import { servicesData } from '../data/servicesData';
import { COMPANY_CONFIG } from '../data/companyConfig';
import { ProjectBrief, ClientProfile, ProjectRequirements } from './supabaseService';

export interface ChatMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: string;
  stage?: 'welcome' | 'category' | 'details' | 'recommendation' | 'brief' | 'schedule';
  quickReplies?: string[];
  suggestedAction?: 'review_brief' | 'schedule_meeting' | 'talk_to_human';
}

export interface ConsultationState {
  currentStage: 'welcome' | 'category' | 'problem' | 'features' | 'client_info' | 'recommendation' | 'brief_ready' | 'scheduling' | 'confirmed';
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

export const PROJECT_CATEGORIES = [
  'Website Design & Development',
  'Enterprise Software Development',
  'AI Solutions & Automation',
  'Multimedia & Cinema Production',
  'Cloud & Database Integration',
  'Digital Platforms & Interactive 3D',
  'Broadcast & Streaming Solutions',
  'Cybersecurity & Technology Consulting',
];

export const aiConsultantService = {
  // Generate intelligent tailored response based on client stage and message
  async processUserMessage(
    userMessage: string,
    state: ConsultationState,
    conversationHistory: ChatMessage[]
  ): Promise<{ aiMessage: ChatMessage; updatedState: ConsultationState }> {
    const trimmed = userMessage.trim();
    const updatedState = { ...state };
    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const msgId = `msg-${Date.now()}`;

    // STAGE 1: WELCOME -> CATEGORY SELECTION
    if (state.currentStage === 'welcome') {
      const matchedCategory = PROJECT_CATEGORIES.find((cat) =>
        trimmed.toLowerCase().includes(cat.toLowerCase().split(' ')[0]) ||
        (cat.includes('AI') && trimmed.toLowerCase().includes('ai')) ||
        (cat.includes('Website') && (trimmed.toLowerCase().includes('web') || trimmed.toLowerCase().includes('site'))) ||
        (cat.includes('Enterprise') && (trimmed.toLowerCase().includes('app') || trimmed.toLowerCase().includes('software') || trimmed.toLowerCase().includes('portal'))) ||
        (cat.includes('Multimedia') && (trimmed.toLowerCase().includes('video') || trimmed.toLowerCase().includes('media') || trimmed.toLowerCase().includes('film')))
      ) || trimmed;

      updatedState.requirements.category = matchedCategory;
      updatedState.currentStage = 'problem';

      return {
        aiMessage: {
          id: msgId,
          sender: 'ai',
          text: `Excellent. OPHIREUM specializes in high-caliber ${matchedCategory}. To help our solution architects tailor an optimal proposal: What is the primary business challenge or objective you are aiming to solve?`,
          timestamp: now,
          stage: 'details',
          quickReplies: [
            'Automate manual operations',
            'Launch a new customer-facing platform',
            'Upgrade legacy infrastructure',
            'Produce cinema-grade brand media',
          ],
        },
        updatedState,
      };
    }

    // STAGE 2: PROBLEM -> FEATURES
    if (state.currentStage === 'problem') {
      updatedState.requirements.businessProblem = trimmed;
      updatedState.currentStage = 'features';

      return {
        aiMessage: {
          id: msgId,
          sender: 'ai',
          text: `Understood. That aligns directly with our engineering and production capabilities. What key features or specific functionality are essential for this project (e.g., role-based portals, AI automation, payment gateways, 4K video workflows)?`,
          timestamp: now,
          stage: 'details',
          quickReplies: [
            'Secure client portal & RBAC',
            'AI automation & assistant',
            'Cloud database & API sync',
            'High-bitrate media streaming',
          ],
        },
        updatedState,
      };
    }

    // STAGE 3: FEATURES -> CLIENT INFO
    if (state.currentStage === 'features') {
      updatedState.requirements.keyFeatures = trimmed.split(/,|\n|and/).map(f => f.trim()).filter(Boolean);
      updatedState.currentStage = 'client_info';

      return {
        aiMessage: {
          id: msgId,
          sender: 'ai',
          text: `Those are clear, actionable requirements. To synthesize your official Project Brief and schedule your consultation, may I have your full name, organization/company, and email address?`,
          timestamp: now,
          stage: 'details',
          quickReplies: ['Fill details directly'],
        },
        updatedState,
      };
    }

    // STAGE 4: CLIENT INFO -> RECOMMENDATION & BRIEF SYNTHESIS
    if (state.currentStage === 'client_info') {
      // Basic extraction of name/company/email if provided in natural language
      const emailMatch = trimmed.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      if (emailMatch) {
        updatedState.client.email = emailMatch[0];
      }
      
      const parts = trimmed.split(/[,\n-]/).map(s => s.trim());
      if (parts[0] && !updatedState.client.fullName) {
        updatedState.client.fullName = parts[0].replace(/my name is/i, '').replace(/i am/i, '').trim();
      }
      if (parts[1] && !updatedState.client.companyName) {
        updatedState.client.companyName = parts[1].replace(/company is/i, '').replace(/at/i, '').trim();
      }

      updatedState.currentStage = 'recommendation';

      // Generate the structured brief
      const refCode = `OPM-BRF-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const brief: ProjectBrief = {
        referenceCode: refCode,
        client: {
          fullName: updatedState.client.fullName || 'Prospective Enterprise Client',
          email: updatedState.client.email || 'client@enterprise.com',
          phone: updatedState.client.phone || '+63 9XX XXX XXXX',
          companyName: updatedState.client.companyName || 'Enterprise Partner',
          industry: 'Technology & Enterprise Services',
          location: 'Philippines / International',
        },
        requirements: {
          category: updatedState.requirements.category || 'Enterprise Digital Platform',
          businessProblem: updatedState.requirements.businessProblem || 'Operational scalability and automated workflow transformation.',
          keyFeatures: updatedState.requirements.keyFeatures.length > 0
            ? updatedState.requirements.keyFeatures
            : ['Enterprise RBAC Gateway', 'Intelligent AI Pipeline', 'Cloud Database Replication'],
          budgetPreference: 'Enterprise Tier / Flexible',
          targetTimeline: 'Q1–Q2 Delivery Scope',
        },
        technicalArchitecture: {
          recommendedModules: [
            'Authentication & Multi-Tenant Access Controller',
            'Distributed Cloud API & Event Engine',
            'Real-Time Status & Progress Dashboard',
            'Automated GitHub Actions CI/CD Pipeline',
          ],
          suggestedStack: ['React 19', 'TypeScript', 'Node.js', 'PostgreSQL / Supabase', '@google/genai SDK'],
          infrastructure: 'Dedicated Cloud Run & Cloud SQL with automated failover and daily snapshots.',
          securityMeasures: [
            'Row-Level Security (RLS) enforcement',
            'JWT & MFA privilege isolation',
            'Zero-hallucination verification gates',
          ],
        },
        commercialDiscovery: {
          budgetPreference: 'Subject to verified milestone discovery',
          timelinePreference: 'Standard 4 to 12 week staged rollout',
          suggestedPhases: [
            'Phase 1: Architecture Review & Screenplay / Technical Spec',
            'Phase 2: Prototype Development & Core Integration',
            'Phase 3: QA Verification, Security Audit & Staging',
            'Phase 4: Production Deployment & SLA Handover',
          ],
          consultationAgenda: [
            'Deep dive into operational workflows',
            'Review existing technical assets and dependencies',
            'Formal scope finalization and milestone roadmap',
          ],
        },
        createdAt: new Date().toISOString(),
        status: 'draft',
      };

      updatedState.generatedBrief = brief;
      updatedState.currentStage = 'brief_ready';

      return {
        aiMessage: {
          id: msgId,
          sender: 'ai',
          text: `Thank you. I have synthesized an initial Enterprise Project Brief (Ref: ${refCode}) based on our approved OPHIREUM engineering standards. 

Here is what we recommend:
• Modular React 19 & TypeScript frontend with strict RBAC access control
• Server-side AI orchestration using our verified @google/genai pipeline
• Dedicated relational database schema with Row Level Security (RLS)
• Staged milestone delivery with human architectural approval at each gate

You can review your complete structured brief below. Would you like to schedule an executive consultation with our development team to discuss your project in detail?`,
          timestamp: now,
          stage: 'brief',
          suggestedAction: 'schedule_meeting',
          quickReplies: [
            'Review Project Brief',
            'Schedule Consultation',
            'Speak with Dhenze Languisan (CEO)',
          ],
        },
        updatedState,
      };
    }

    // Default consultative follow-up
    return {
      aiMessage: {
        id: msgId,
        sender: 'ai',
        text: `I've noted that detail. At OPHIREUM MULTIMEDIA PRODUCTION, our executive team in Clark Freeport Zone reviews every project requirement to ensure high technical integrity. Would you like to inspect the generated project brief, or proceed directly to select a consultation slot?`,
        timestamp: now,
        stage: 'recommendation',
        quickReplies: ['View Project Brief', 'Schedule Consultation'],
      },
      updatedState,
    };
  },
};
