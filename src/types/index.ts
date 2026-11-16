export type ServiceCategory = 'all' | 'creative' | 'software' | 'ai' | 'interactive';

export interface ServiceItem {
  id: string;
  number: string;
  title: string;
  category: 'creative' | 'software' | 'ai' | 'interactive';
  tagline: string;
  description: string;
  deliverables: string[];
  technologies: string[];
  visualType: 'media' | 'camera' | 'post' | 'design' | 'web' | 'enterprise' | 'ai' | 'cloud' | 'platform' | 'game' | 'broadcast' | 'consulting';
  status: 'Proposed Specification' | 'Client Ready' | 'Enterprise Active';
}

export type CatalogCategoryId =
  | 'all'
  | 'website-digital'
  | 'ai-agents'
  | 'blockchain-web3'
  | 'enterprise-mobile'
  | 'automation-systems'
  | 'cloud-cybersecurity'
  | 'modernization-care'
  | 'creative-multimedia'
  | 'industry-solutions'
  | 'signature-packages';

export type TechIconKind =
  | 'website'
  | 'ai'
  | 'blockchain'
  | 'enterprise'
  | 'mobile'
  | 'automation'
  | 'cloud'
  | 'cybersecurity'
  | 'multimedia'
  | 'analytics';

export type PricingModel =
  | 'one_time'
  | 'subscription_monthly'
  | 'setup_plus_monthly'
  | 'hourly'
  | 'per_session';

export type ServiceEngagementMode = 'standardized' | 'custom_proposal';

export interface CatalogServiceOption {
  id: string;
  label: string;
  description: string;
  deltaUsd: number;
  monthlyDeltaUsd?: number;
}

export interface CatalogPricing {
  model: PricingModel;
  startingUsd: number;
  monthlyUsd?: number;
  unitLabel?: string;
}

export interface CatalogService {
  id: string;
  categoryId: Exclude<CatalogCategoryId, 'all'>;
  subcategory?: 'one-time' | 'care-membership' | 'agent-plan' | 'custom-ai' | 'signature';
  title: string;
  shortDescription: string;
  fullDescription: string;
  iconKind: TechIconKind;
  pricing: CatalogPricing;
  engagementMode?: ServiceEngagementMode;
  configurableOptions?: CatalogServiceOption[];
  capabilities: string[];
  includedScope: string[];
  excludedScope: string[];
  externalChargesNote?: string;
  complianceNote?: string;
  featuredTier?: 'signature' | 'flagship';
  signatureSubtitle?: string;
  interactiveDemoType?: 'ai_consultant' | 'blockchain_canvas' | 'preview_only';
  legacyServiceId?: string;
}

export interface CatalogCategoryMeta {
  id: CatalogCategoryId;
  number: string;
  label: string;
  shortLabel: string;
  iconKind: TechIconKind;
  headline: string;
  description: string;
}

export interface PortfolioItem {
  id: string;
  title: string;
  category: string;
  tagline: string;
  description: string;
  clientType: string;
  deliverables: string[];
  technologies: string[];
  status: 'Production Architecture' | 'Verified Showcase' | 'Enterprise Blueprint';
  imagePlaceholderGradient: string;
  year: string;
}

export interface InquiryFormData {
  fullName: string;
  email: string;
  contactNumber: string;
  company: string;
  serviceId: string;
  projectDescription: string;
  estimatedBudget: string;
  fileName?: string;
  privacyConsent: boolean;
}

export interface SolutionSubmissionPayload {
  fullName: string;
  email: string;
  contactNumber: string;
  company: string;
  industry?: string;
  targetTimeline?: string;
  selectedServiceIds: string[];
  projectDescription: string;
  estimatedBudget?: string;
  preferredCurrency?: 'USD' | 'PHP';
  phpConversionRate?: number;
  privacyConsent: boolean;
  websiteHoneypot?: string;
}

export interface AIAgentRole {
  id: string;
  name: string;
  code: string;
  focus: string;
  capabilities: string[];
  status: 'Standby' | 'Active' | 'Supervised';
  icon: string;
}
