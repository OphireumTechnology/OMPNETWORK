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

export interface AIAgentRole {
  id: string;
  name: string;
  code: string;
  focus: string;
  capabilities: string[];
  status: 'Standby' | 'Active' | 'Supervised';
  icon: string;
}
