/*
Copyright (c) 2026 Ophireum Multimedia Production. All rights reserved.
Developer and claimed rights holder: Ophireum Multimedia Production
DTI-registered business, Philippines | Registration No. 7567003
SPDX-FileCopyrightText: 2026 Ophireum Multimedia Production
SPDX-License-Identifier: LicenseRef-Ophireum-Proprietary
Third-party materials, dependencies, and separately licensed components remain subject to their respective rights and licenses.
*/

import {
  CatalogCategoryId,
  CatalogCategoryMeta,
  CatalogService,
  CatalogServiceOption,
  ServiceEngagementMode,
} from '../types';

export const DEFAULT_USD_TO_PHP_RATE = 58;

export const COMMERCIAL_PRICING_NOTICE =
  'All advertised prices represent starting investments. Final pricing is tailored to the scope, technical complexity, required features, integrations, workload, infrastructure, and delivery timeline of each engagement. A detailed proposal will be provided for review and approval before development begins.';

export const EXTERNAL_CHARGES_DISCLOSURE =
  'Hosting, domain registrations, third-party subscriptions, API usage, telephony, payment processing, taxes, and other external charges are billed separately when applicable.';

export const BLOCKCHAIN_COMPLIANCE_NOTICE =
  'Blockchain development services are not advertised or warranted as guaranteed financial returns, investment performance, regulatory approval, or independently audited security. Regulated token offerings, custody, payments, and financial applications require appropriate legal and security review. Implementations are never claimed as independently audited unless a formal third-party audit has occurred.';

export const EMERGING_TECH_FEASIBILITY_NOTICE =
  'Emerging technology engagements (including IoT, Computer Vision, Digital Twin, and AR/VR systems) are delivered as custom-scoped engineering projects subject to technical feasibility assessment and hardware/environment validation.';

export const CATALOG_CATEGORIES: CatalogCategoryMeta[] = [
  {
    id: 'all',
    number: '00',
    label: 'All Solutions',
    shortLabel: 'All Solutions',
    iconKind: 'analytics',
    headline: 'Complete Ophireum Technology & Creative Catalog',
    description:
      'Browse every OPHIREUM capability across digital experiences, AI agents, blockchain engineering, enterprise software, cloud security, and multimedia innovation.',
  },
  {
    id: 'website-digital',
    number: '01',
    label: 'Website & Digital Experience Development',
    shortLabel: 'Web & Digital',
    iconKind: 'website',
    headline: 'High-Trust Web Architectures & Commercial Flagships',
    description:
      'Responsive web platforms designed for brand authority, measurable conversion clarity, accessibility compliance, and scalable digital commerce.',
  },
  {
    id: 'ai-agents',
    number: '02',
    label: 'Artificial Intelligence & AI Agents',
    shortLabel: 'AI & Agents',
    iconKind: 'ai',
    headline: 'Flagship AI Division & Specialized Agent Workforce',
    description:
      'Server-side generative intelligence, RAG knowledge pipelines, voice & scheduling concierges, and human-in-the-loop enterprise orchestration.',
  },
  {
    id: 'blockchain-web3',
    number: '03',
    label: 'Blockchain & Web3 Development',
    shortLabel: 'Blockchain & Web3',
    iconKind: 'blockchain',
    headline: 'Build Trust Into Every Digital Transaction.',
    description:
      'Explore the next generation of digital infrastructure through blockchain engineering, smart contract development, decentralized applications, tokenization architecture, and transparent transaction systems.',
  },
  {
    id: 'enterprise-mobile',
    number: '04',
    label: 'Enterprise Software & Mobile Applications',
    shortLabel: 'Enterprise & Mobile',
    iconKind: 'enterprise',
    headline: 'Bespoke Engineering, Mobile Ecosystems & Spatial Systems',
    description:
      'Mission-critical applications, cross-platform mobile software, digital twins, immersive AR/VR experiences, and senior technical advisory.',
  },
  {
    id: 'automation-systems',
    number: '05',
    label: 'Automation & Intelligent Business Systems',
    shortLabel: 'Automation & BI',
    iconKind: 'automation',
    headline: 'Operational Acceleration, Telemetry & Data Intelligence',
    description:
      'Intelligent workflow automation, API orchestration, enterprise data pipelines, document intelligence, computer vision, and IoT systems.',
  },
  {
    id: 'cloud-cybersecurity',
    number: '06',
    label: 'Cloud, Cybersecurity & Infrastructure',
    shortLabel: 'Cloud & Security',
    iconKind: 'cloud',
    headline: 'Resilient Infrastructure, Database Engineering & Protection',
    description:
      'Zero-downtime cloud deployments, relational database optimization, automated CI/CD pipelines, and layered cybersecurity hardening.',
  },
  {
    id: 'modernization-care',
    number: '07',
    label: 'Digital Modernization & Website Care',
    shortLabel: 'Modernization & Care',
    iconKind: 'cybersecurity',
    headline: 'Website Recovery, Performance Upgrades & Ongoing Care Plans',
    description:
      'Targeted one-time remediation and modernization services paired with structured monthly Digital Care Memberships for existing websites and apps.',
  },
  {
    id: 'creative-multimedia',
    number: '08',
    label: 'Creative Multimedia & Brand Innovation',
    shortLabel: 'Creative & Media',
    iconKind: 'multimedia',
    headline: 'Cinema Production, Brand Systems & 3D Visual Storytelling',
    description:
      'Cohesive brand identities, commercial multimedia production, 3D product visualization, executive training, and ongoing creative support.',
  },
  {
    id: 'industry-solutions',
    number: '09',
    label: 'Industry-Specific Digital Solutions',
    shortLabel: 'By Industry',
    iconKind: 'analytics',
    headline: 'Sector-Tailored Platforms Across 12 Core Industries',
    description:
      'Purpose-built digital workflows engineered around the operational, regulatory, and customer-journey realities of specific industries.',
  },
  {
    id: 'signature-packages',
    number: '10',
    label: 'Signature Business Transformation Packages',
    shortLabel: 'Signature Suites',
    iconKind: 'enterprise',
    headline: 'End-to-End Transformation Collections',
    description:
      'Curated multi-disciplinary engagements combining web architecture, automation, AI integration, and ongoing executive engineering care.',
  },
];

const STD_EXCLUDED = [
  'Domain registration fees, third-party cloud hosting, and paid SaaS/API usage',
  'Payment gateway processing fees, SMS/telephony carrier charges, and applicable taxes',
  'Custom scope additions requested after formal proposal sign-off',
];

const RAW_SERVICE_CATALOG: CatalogService[] = [
  // =========================================================================
  // 1. WEBSITE & DIGITAL EXPERIENCE DEVELOPMENT (BLOCK 3)
  // =========================================================================
  {
    id: 'essential-digital-presence',
    categoryId: 'website-digital',
    title: 'Essential Digital Presence',
    shortDescription:
      'An elegant digital foundation designed to establish credibility, communicate your brand\'s identity, and create meaningful customer connections.',
    fullDescription:
      'A disciplined corporate web foundation engineered for clarity, fast page loads, mobile responsiveness, and structured lead capture.',
    iconKind: 'website',
    pricing: { model: 'one_time', startingUsd: 897 },
    capabilities: [
      'Bespoke brand-aligned corporate landing architecture',
      'Mobile-first responsive layout & WCAG AA accessibility baseline',
      'Structured inquiry & lead capture routing',
      'Technical SEO metadata & Schema.org setup',
    ],
    includedScope: [
      'Custom responsive UI implementation across desktop, tablet, and mobile',
      'Core brand sections, service overview, and validated inquiry form',
      'Baseline on-page SEO metadata and performance optimization',
    ],
    excludedScope: STD_EXCLUDED,
    legacyServiceId: 'website-design-development',
  },
  {
    id: 'signature-business-experience',
    categoryId: 'website-digital',
    title: 'Signature Business Experience',
    shortDescription:
      'A sophisticated business website engineered to strengthen your market presence, elevate customer engagement, and support sustainable growth.',
    fullDescription:
      'Multi-page interactive business platform with CMS-ready content architecture, structured service showcases, analytics tracking, and conversion funnels.',
    iconKind: 'website',
    pricing: { model: 'one_time', startingUsd: 2097 },
    capabilities: [
      'Multi-page bespoke UX architecture & interactive UI transitions',
      'Headless CMS or structured content management integration',
      'Conversion-focused service catalogs & lead qualification forms',
      'Analytics instrumentation & search-engine structured data',
    ],
    includedScope: [
      'Multi-section bespoke design system and responsive templates',
      'CMS content workflow setup and editorial training',
      'Speed optimization and pre-launch QA verification',
    ],
    excludedScope: STD_EXCLUDED,
    legacyServiceId: 'website-design-development',
  },
  {
    id: 'executive-digital-intelligence',
    categoryId: 'website-digital',
    title: 'Executive Digital Intelligence',
    shortDescription:
      'A premium digital experience combining bespoke design, intelligent customer engagement, AI assistant integration, and connected business tools.',
    fullDescription:
      'An intelligent flagship web ecosystem integrating conversational AI discovery, calendar booking workflows, CRM synchronization, and executive dashboards.',
    iconKind: 'ai',
    pricing: { model: 'one_time', startingUsd: 4497 },
    capabilities: [
      'Custom flagship web platform with interactive technology showcases',
      'Embedded AI Solutions Assistant & automated brief capture',
      'Connected CRM, calendar scheduling, and API workflows',
      'Role-based executive admin review dashboard',
    ],
    includedScope: [
      'Full-stack React/TypeScript web application & server API routes',
      'AI assistant integration with structured lead/brief handoff',
      'Calendar booking flow and administrative lead queue',
    ],
    excludedScope: [
      ...STD_EXCLUDED,
      'External LLM token consumption beyond included setup test quota',
    ],
    featuredTier: 'flagship',
    interactiveDemoType: 'ai_consultant',
    legacyServiceId: 'website-design-development',
  },
  {
    id: 'commerce-elite',
    categoryId: 'website-digital',
    title: 'Commerce Elite',
    shortDescription:
      'A refined e-commerce ecosystem designed to deliver exceptional shopping experiences, streamlined transactions, and scalable commercial operations.',
    fullDescription:
      'High-conversion digital storefront engineered for catalog scalability, friction-free checkout flows, inventory sync, and automated order notifications.',
    iconKind: 'enterprise',
    pricing: { model: 'one_time', startingUsd: 5997 },
    capabilities: [
      'High-speed product discovery, variant filtering & cart experience',
      'Secure payment gateway & regional checkout integration',
      'Order management, inventory tracking & customer account portal',
      'Automated transactional notifications & commercial analytics',
    ],
    includedScope: [
      'Custom storefront UX, product catalog templates, and checkout integration',
      'Merchant order management workflow and tax/shipping rules setup',
      'Security review of checkout endpoints and webhook handlers',
    ],
    excludedScope: [
      ...STD_EXCLUDED,
      'Merchant acquirer fees, ERP licensing, and bulk product photography',
    ],
    legacyServiceId: 'website-design-development',
  },
  {
    id: 'enterprise-digital-architecture',
    categoryId: 'website-digital',
    title: 'Enterprise Digital Architecture',
    shortDescription:
      'Custom-engineered enterprise applications, secure digital platforms, intelligent dashboards, and advanced integrations built for complex business requirements.',
    fullDescription:
      'Comprehensive multi-tenant digital platform architecture featuring strict RBAC, relational data persistence, custom APIs, and enterprise SLA readiness.',
    iconKind: 'enterprise',
    pricing: { model: 'one_time', startingUsd: 14997 },
    capabilities: [
      'Multi-tenant RBAC portals & SSO/OAuth authentication gateways',
      'Custom enterprise dashboards & real-time operational telemetry',
      'PostgreSQL / Cloud SQL schema architecture & audit logging',
      'CI/CD automation, staging environments & security hardening',
    ],
    includedScope: [
      'Architecture specification, full-stack development, and database design',
      'Role-based permission enforcement and automated test suites',
      'Production deployment pipeline and technical documentation',
    ],
    excludedScope: STD_EXCLUDED,
    featuredTier: 'flagship',
    legacyServiceId: 'enterprise-software-development',
  },

  // =========================================================================
  // 2. ARTIFICIAL INTELLIGENCE & AI AGENTS (BLOCK 4)
  // =========================================================================
  {
    id: 'ai-concierge-elite',
    categoryId: 'ai-agents',
    subcategory: 'agent-plan',
    title: 'AI Concierge Elite',
    shortDescription:
      'Intelligent website assistance, customer inquiries, knowledge retrieval, lead capture, and human escalation.',
    fullDescription:
      '24/7 context-grounded website concierge trained on your verified corporate catalog and documentation, engineered to capture qualified leads and escalate cleanly to staff.',
    iconKind: 'ai',
    pricing: { model: 'setup_plus_monthly', startingUsd: 447, monthlyUsd: 147 },
    capabilities: [
      'Verified knowledge-base retrieval & service explanation',
      'Structured lead capture & inquiry classification',
      'Seamless human consultant escalation handoff',
      'Server-side API key isolation & moderation guardrails',
    ],
    includedScope: [
      'Server-side AI widget integration and brand-grounded system prompt',
      'Knowledge base ingestion for core service and FAQ documents',
      'Lead dispatch webhook or database persistence',
    ],
    excludedScope: [
      ...STD_EXCLUDED,
      'High-volume LLM API token usage beyond base monthly plan allowance',
    ],
    interactiveDemoType: 'ai_consultant',
    legacyServiceId: 'ai-solutions-automation',
  },
  {
    id: 'ai-voice-executive',
    categoryId: 'ai-agents',
    subcategory: 'agent-plan',
    title: 'AI Voice Executive',
    shortDescription:
      'Natural conversational voice assistance, appointment coordination, inquiry handling, and structured interaction summaries.',
    fullDescription:
      'Real-time bidirectional voice consultation agent supporting natural dialogue, explicit consent disclosure, calendar coordination, and executive call summaries.',
    iconKind: 'ai',
    pricing: { model: 'setup_plus_monthly', startingUsd: 897, monthlyUsd: 297 },
    capabilities: [
      'Bidirectional low-latency voice interaction with barge-in support',
      'Multilingual capability (English & Filipino/Tagalog switching)',
      'Appointment slot discovery & consultation scheduling',
      'Structured post-call interaction summaries for human teams',
    ],
    includedScope: [
      'Voice gateway endpoint, speech pipeline integration, and UI controls',
      'Explicit caller disclosure and consent workflow',
      'Calendar booking integration and transcript logging',
    ],
    excludedScope: [
      ...STD_EXCLUDED,
      'PSTN/SIP telephony minutes, carrier trunks, and metered TTS/STT usage',
    ],
    featuredTier: 'flagship',
    interactiveDemoType: 'ai_consultant',
    legacyServiceId: 'ai-solutions-automation',
  },
  {
    id: 'ai-communications-executive',
    categoryId: 'ai-agents',
    subcategory: 'agent-plan',
    title: 'AI Communications Executive',
    shortDescription:
      'Intelligent email classification, priority management, response drafting, communication workflows, and human approval controls.',
    fullDescription:
      'Automated inbox triage and executive response drafting pipeline that categorizes inbound messages by urgency and routes drafts through mandatory human sign-off.',
    iconKind: 'automation',
    pricing: { model: 'setup_plus_monthly', startingUsd: 597, monthlyUsd: 237 },
    capabilities: [
      'Automated inbound email classification & urgency scoring',
      'Context-aware executive response drafting',
      'Human-in-the-loop approval queue prior to dispatch',
      'CRM & ticketing system synchronization',
    ],
    includedScope: [
      'Inbox webhook/API integration and classification taxonomy setup',
      'Draft review interface with one-click human approval gates',
      'Audit trail of approved communications',
    ],
    excludedScope: STD_EXCLUDED,
    legacyServiceId: 'ai-solutions-automation',
  },
  {
    id: 'ai-revenue-intelligence',
    categoryId: 'ai-agents',
    subcategory: 'agent-plan',
    title: 'AI Revenue Intelligence',
    shortDescription:
      'AI-powered lead qualification, CRM support, follow-up coordination, sales intelligence, and customer engagement.',
    fullDescription:
      'Pipeline intelligence agent that scores inbound requirements against service fit, enriches CRM records, and coordinates timely follow-up briefs for sales teams.',
    iconKind: 'analytics',
    pricing: { model: 'setup_plus_monthly', startingUsd: 747, monthlyUsd: 297 },
    capabilities: [
      'Automated discovery & project scope qualification',
      'CRM record enrichment & next-step recommendations',
      'Structured follow-up drafting with human oversight',
      'Pipeline visibility & conversion bottleneck reporting',
    ],
    includedScope: [
      'Qualification rubric engineering and CRM field mapping',
      'Automated brief synthesis and team notification routing',
      'Monthly prompt tuning and performance review',
    ],
    excludedScope: [
      ...STD_EXCLUDED,
      'Third-party CRM seat licenses and data-enrichment provider subscriptions',
    ],
    legacyServiceId: 'ai-solutions-automation',
  },
  {
    id: 'ai-scheduling-concierge',
    categoryId: 'ai-agents',
    subcategory: 'agent-plan',
    title: 'AI Scheduling Concierge',
    shortDescription:
      'Intelligent appointment coordination, calendar integration, reminders, and consultation preparation.',
    fullDescription:
      'Smart scheduling agent that verifies real-time slot availability, handles timezone conversion, prevents double-bookings, and prepares pre-meeting briefs.',
    iconKind: 'automation',
    pricing: { model: 'setup_plus_monthly', startingUsd: 447, monthlyUsd: 177 },
    capabilities: [
      'Real-time calendar availability checks & conflict prevention',
      'Multi-timezone slot presentation & Google Calendar sync',
      'Automated pre-consultation briefing packet generation',
      'Rescheduling & cancellation workflow handling',
    ],
    includedScope: [
      'Booking engine integration and calendar template generation',
      'Client intake form and confirmation reference ticketing',
      'Reminder trigger configuration',
    ],
    excludedScope: STD_EXCLUDED,
    legacyServiceId: 'ai-solutions-automation',
  },
  {
    id: 'ai-enterprise-command',
    categoryId: 'ai-agents',
    subcategory: 'agent-plan',
    title: 'AI Enterprise Command',
    shortDescription:
      'Multi-agent orchestration, cross-department workflow automation, operational monitoring, and intelligent process coordination.',
    fullDescription:
      'Coordinated multi-agent architecture uniting intake, research, architecture drafting, QA verification, and executive reporting behind strict permission boundaries.',
    iconKind: 'ai',
    pricing: { model: 'setup_plus_monthly', startingUsd: 2997, monthlyUsd: 897 },
    capabilities: [
      'Coordinated multi-agent workflows across departments',
      'Human approval gates, role isolation & audit logging',
      'Operational telemetry & exception escalation routing',
      'Cross-system API & database task orchestration',
    ],
    includedScope: [
      'Custom multi-agent orchestration layer and role matrix',
      'RBAC governance controls and audit log persistence',
      'Dedicated ongoing model monitoring and SLA support',
    ],
    excludedScope: STD_EXCLUDED,
    featuredTier: 'flagship',
    legacyServiceId: 'ai-solutions-automation',
  },
  {
    id: 'custom-ai-engineering',
    categoryId: 'ai-agents',
    subcategory: 'custom-ai',
    title: 'Custom AI Engineering',
    shortDescription:
      'Private AI assistants, retrieval-augmented generation (RAG), document intelligence, multimodal integrations, and governed enterprise AI systems.',
    fullDescription:
      'Bespoke server-side AI architecture engineered for proprietary datasets, citation-grounded knowledge retrieval, multimodal workflows, and enterprise governance.',
    iconKind: 'ai',
    pricing: { model: 'one_time', startingUsd: 1497 },
    capabilities: [
      'Private AI assistants & Retrieval-Augmented Generation (RAG)',
      'Enterprise knowledge assistants & document intelligence',
      'AI-powered analytics & AI workflow orchestration',
      'Multimodal AI & custom language-model integrations',
      'Human-in-the-loop AI systems, governance & monitoring',
    ],
    includedScope: [
      'Custom architecture design and server-side @google/genai / LLM integration',
      'Document chunking, vector indexing, and grounded citation pipeline',
      'Evaluation test harness and security boundary review',
    ],
    excludedScope: [
      ...STD_EXCLUDED,
      'Dedicated GPU/vector cloud cluster hosting and metered inference fees',
    ],
    legacyServiceId: 'ai-solutions-automation',
  },

  // =========================================================================
  // 3. BLOCKCHAIN & WEB3 DEVELOPMENT (BLOCK 5)
  // =========================================================================
  {
    id: 'blockchain-technology-consultation',
    categoryId: 'blockchain-web3',
    title: 'Blockchain Technology Consultation',
    shortDescription:
      'Feasibility analysis, ledger selection, compliance scoping, and architectural roadmapping before writing smart contract code.',
    fullDescription:
      'Objective engineering advisory evaluating whether distributed ledger, permissioned blockchain, or cryptographic verification architecture delivers measurable operational value.',
    iconKind: 'blockchain',
    pricing: { model: 'one_time', startingUsd: 597 },
    capabilities: [
      'Distributed ledger vs. relational database fit assessment',
      'Permissioned vs. public network architecture selection',
      'Gas/throughput modeling & integration blueprint',
      'Regulatory & security review scoping recommendations',
    ],
    includedScope: [
      'Technical discovery sessions and written architecture recommendation',
      'Risk register identifying legal/security review prerequisites',
    ],
    excludedScope: [
      ...STD_EXCLUDED,
      'Formal legal opinions, regulatory licensing, or third-party security audits',
    ],
    complianceNote: BLOCKCHAIN_COMPLIANCE_NOTICE,
    interactiveDemoType: 'blockchain_canvas',
    legacyServiceId: 'technology-consulting',
  },
  {
    id: 'smart-contract-development',
    categoryId: 'blockchain-web3',
    title: 'Smart Contract Development',
    shortDescription:
      'Deterministic smart contract engineering with automated unit tests, access controls, and upgradeability safeguards.',
    fullDescription:
      'Modular smart contracts built with strict role permissions, event emission, comprehensive test coverage, and testnet verification.',
    iconKind: 'blockchain',
    pricing: { model: 'one_time', startingUsd: 2997 },
    capabilities: [
      'Modular smart contracts with role-based access control',
      'Automated unit & invariant test suites on local/testnet',
      'Gas optimization & deterministic state-transition design',
      'Event indexing schemas for off-chain application sync',
    ],
    includedScope: [
      'Contract source code, test suite, and testnet deployment scripts',
      'Internal engineering code review and ABI documentation',
    ],
    excludedScope: [
      ...STD_EXCLUDED,
      'Mainnet gas deployment costs and independent third-party smart contract audits',
    ],
    complianceNote: BLOCKCHAIN_COMPLIANCE_NOTICE,
    interactiveDemoType: 'blockchain_canvas',
    legacyServiceId: 'enterprise-software-development',
  },
  {
    id: 'blockchain-application-integration',
    categoryId: 'blockchain-web3',
    title: 'Blockchain Application Integration',
    shortDescription:
      'Connect existing web, mobile, and ERP platforms to blockchain networks through resilient APIs and event indexers.',
    fullDescription:
      'Production bridge connecting enterprise backends and user interfaces to on-chain transactions, webhook listeners, and verifiable state records.',
    iconKind: 'blockchain',
    pricing: { model: 'one_time', startingUsd: 4497 },
    capabilities: [
      'Blockchain API integration & RPC failover routing',
      'Real-time on-chain event indexing to PostgreSQL',
      'Transaction lifecycle monitoring & retry queues',
      'Role-gated administrative dispatch controls',
    ],
    includedScope: [
      'Backend integration service, event listener, and database schema sync',
      'Testnet integration QA and operational runbook',
    ],
    excludedScope: STD_EXCLUDED,
    complianceNote: BLOCKCHAIN_COMPLIANCE_NOTICE,
    interactiveDemoType: 'blockchain_canvas',
    legacyServiceId: 'enterprise-software-development',
  },
  {
    id: 'dapp-development',
    categoryId: 'blockchain-web3',
    title: 'Decentralized Application (dApp) Development',
    shortDescription:
      'Full-stack Web3 user interfaces seamlessly paired with smart contract workflows, transaction feedback, and wallet signing.',
    fullDescription:
      'Intuitive Web3 application architecture built in React and TypeScript with clear signing prompts, network switching, and resilient state reconciliation.',
    iconKind: 'blockchain',
    pricing: { model: 'one_time', startingUsd: 5997 },
    capabilities: [
      'Responsive Web3 frontend & wallet signature UX',
      'Smart contract interaction layer & optimistic UI states',
      'Off-chain metadata indexing & IPFS/decentralized storage links',
      'Comprehensive error handling for rejected/pending transactions',
    ],
    includedScope: [
      'Full-stack dApp frontend, contract integration, and testnet QA',
      'User onboarding flow and transaction status feedback',
    ],
    excludedScope: STD_EXCLUDED,
    complianceNote: BLOCKCHAIN_COMPLIANCE_NOTICE,
    featuredTier: 'flagship',
    interactiveDemoType: 'blockchain_canvas',
    legacyServiceId: 'digital-platforms-interactive',
  },
  {
    id: 'tokenization-platform-development',
    categoryId: 'blockchain-web3',
    title: 'Tokenization Platform Development',
    shortDescription:
      'Technical infrastructure for digital asset representation, programmable permissions, lifecycle tracking, and registry portals.',
    fullDescription:
      'Custom tokenization architecture supporting mint/burn governance, transfer restrictions, and transparent registry reporting—engineered for legal and compliance review.',
    iconKind: 'blockchain',
    pricing: { model: 'one_time', startingUsd: 7497 },
    capabilities: [
      'Tokenization architecture & programmable transfer rules',
      'Registry portal with issuance & lifecycle history',
      'Multi-signature administrative governance hooks',
      'Reporting exports for compliance & legal counsel review',
    ],
    includedScope: [
      'Token contract architecture, issuance portal UI, and testnet deployment',
      'Technical documentation for external legal and security reviewers',
    ],
    excludedScope: [
      ...STD_EXCLUDED,
      'Legal structuring, securities/regulatory approvals, custody licensing, and third-party audits',
    ],
    complianceNote: BLOCKCHAIN_COMPLIANCE_NOTICE,
    interactiveDemoType: 'blockchain_canvas',
    legacyServiceId: 'enterprise-software-development',
  },
  {
    id: 'enterprise-blockchain-architecture',
    categoryId: 'blockchain-web3',
    title: 'Enterprise Blockchain Architecture',
    shortDescription:
      'Permissioned enterprise blockchain networks engineered for consortium governance, supply-chain traceability, and cross-org trust.',
    fullDescription:
      'Multi-organization distributed ledger architecture with participant node permissions, confidential data channels, and high-availability monitoring.',
    iconKind: 'blockchain',
    pricing: { model: 'one_time', startingUsd: 14997 },
    capabilities: [
      'Permissioned enterprise blockchain networks',
      'Supply-chain traceability & multi-party attestation workflows',
      'Participant identity governance & private channels',
      'Enterprise observability & disaster recovery design',
    ],
    includedScope: [
      'Consortium network blueprint, node orchestration scripts, and admin console',
      'API gateway for legacy ERP/WMS integration',
    ],
    excludedScope: STD_EXCLUDED,
    complianceNote: BLOCKCHAIN_COMPLIANCE_NOTICE,
    featuredTier: 'flagship',
    interactiveDemoType: 'blockchain_canvas',
    legacyServiceId: 'enterprise-software-development',
  },
  {
    id: 'blockchain-security-review',
    categoryId: 'blockchain-web3',
    title: 'Blockchain Security Review',
    shortDescription:
      'Internal engineering code review, threat modeling, access-control inspection, and automated static analysis for Web3 codebases.',
    fullDescription:
      'Structured pre-deployment engineering security review identifying reentrancy, privilege escalation, signature replay, and key-management risks prior to formal third-party auditing.',
    iconKind: 'cybersecurity',
    pricing: { model: 'one_time', startingUsd: 1497 },
    capabilities: [
      'Smart contract static analysis & vulnerability scanning',
      'Role-permission, multisig & key-lifecycle threat modeling',
      'API & wallet integration boundary verification',
      'Prioritized remediation report for engineering teams',
    ],
    includedScope: [
      'Internal engineering security assessment and remediation checklist',
      'Re-verification pass after developer fixes',
    ],
    excludedScope: [
      ...STD_EXCLUDED,
      'Independent third-party security audit certification (available via external audit partners)',
    ],
    complianceNote: BLOCKCHAIN_COMPLIANCE_NOTICE,
    interactiveDemoType: 'blockchain_canvas',
    legacyServiceId: 'technology-consulting',
  },
  {
    id: 'web3-wallet-integration',
    categoryId: 'blockchain-web3',
    title: 'Web3 Wallet Integration',
    shortDescription:
      'Frictionless wallet connection, cryptographic message signing (SIWE), and multi-chain session state for web and mobile apps.',
    fullDescription:
      'Clean authentication and transaction-signing UX supporting standard browser and mobile Web3 wallets with clear user safety prompts.',
    iconKind: 'blockchain',
    pricing: { model: 'one_time', startingUsd: 1497 },
    capabilities: [
      'Standard wallet connector & mobile deep-link flows',
      'Cryptographic Sign-In With Ethereum (SIWE) session verification',
      'Network mismatch detection & human-readable signature prompts',
      'Session persistence aligned with backend auth',
    ],
    includedScope: [
      'Frontend wallet modal, backend signature verifier, and QA across major wallets',
    ],
    excludedScope: [
      ...STD_EXCLUDED,
      'Custodial wallet licensing or regulated fiat on/off-ramp compliance',
    ],
    complianceNote: BLOCKCHAIN_COMPLIANCE_NOTICE,
    interactiveDemoType: 'blockchain_canvas',
    legacyServiceId: 'website-design-development',
  },
  {
    id: 'blockchain-audit-trail-solutions',
    categoryId: 'blockchain-web3',
    title: 'Blockchain Audit Trail Solutions',
    shortDescription:
      'Tamper-evident audit trails and blockchain-based document verification for compliance logs, certificates, and critical records.',
    fullDescription:
      'Cryptographic hashing and anchored verification pipelines that prove document integrity and timestamp authenticity without exposing private payloads on-chain.',
    iconKind: 'blockchain',
    pricing: { model: 'one_time', startingUsd: 2997 },
    capabilities: [
      'Blockchain-based document verification & cryptographic hashing',
      'Tamper-evident audit trails with zero on-chain PII exposure',
      'Public or partner verification portal for record authenticity',
      'Batch Merkle-proof anchoring for cost-efficient verification',
    ],
    includedScope: [
      'Hashing & anchoring microservice, verification UI, and API endpoints',
      'Audit log export and integrity verification documentation',
    ],
    excludedScope: STD_EXCLUDED,
    complianceNote: BLOCKCHAIN_COMPLIANCE_NOTICE,
    interactiveDemoType: 'blockchain_canvas',
    legacyServiceId: 'enterprise-software-development',
  },
  {
    id: 'decentralized-identity-integration',
    categoryId: 'blockchain-web3',
    title: 'Decentralized Identity Integration',
    shortDescription:
      'Digital identity and verifiable credential architecture enabling privacy-preserving user and organization verification.',
    fullDescription:
      'Standards-aligned verifiable credential issuance and verification workflows designed for enterprise onboarding, academic credentials, and partner access.',
    iconKind: 'cybersecurity',
    pricing: { model: 'one_time', startingUsd: 4497 },
    capabilities: [
      'Digital identity & verifiable credential verification',
      'Issuer & verifier portal workflows with revocation registries',
      'Privacy-preserving selective disclosure patterns',
      'Integration with existing enterprise IAM directories',
    ],
    includedScope: [
      'Credential schema design, issuer/verifier API, and integration UI',
    ],
    excludedScope: [
      ...STD_EXCLUDED,
      'Government KYC/AML provider fees and regulatory accreditation',
    ],
    complianceNote: BLOCKCHAIN_COMPLIANCE_NOTICE,
    interactiveDemoType: 'blockchain_canvas',
    legacyServiceId: 'enterprise-software-development',
  },

  // =========================================================================
  // 4. ENTERPRISE SOFTWARE & MOBILE APPLICATIONS (BLOCK 6)
  // =========================================================================
  {
    id: 'bespoke-software-engineering',
    categoryId: 'enterprise-mobile',
    title: 'Bespoke Software Engineering',
    shortDescription:
      'Replace fragmented spreadsheets and rigid off-the-shelf tools with custom operational software built precisely around how your business wins.',
    fullDescription:
      'End-to-end custom software engineering delivering multi-role portals, workflow engines, and resilient backends designed to scale with your organization.',
    iconKind: 'enterprise',
    pricing: { model: 'one_time', startingUsd: 5997 },
    capabilities: [
      'Tailored operational portals & internal workflow engines',
      'Strict role-based access control & audit logging',
      'Modular TypeScript, React & Node.js service architecture',
      'Automated testing & staged deployment readiness',
    ],
    includedScope: [
      'Requirements discovery, system architecture, full-stack build, and QA',
      'Admin/staff onboarding documentation',
    ],
    excludedScope: STD_EXCLUDED,
    featuredTier: 'flagship',
    legacyServiceId: 'enterprise-software-development',
  },
  {
    id: 'premium-mobile-application-development',
    categoryId: 'enterprise-mobile',
    title: 'Premium Mobile Application Development',
    shortDescription:
      'Put your service directly in customers\' and field teams\' pockets with responsive, fast, intuitive iOS and Android experiences.',
    fullDescription:
      'Cross-platform mobile application engineering engineered for offline resilience, push notifications, secure authentication, and seamless backend synchronization.',
    iconKind: 'mobile',
    pricing: { model: 'one_time', startingUsd: 4497 },
    capabilities: [
      'Cross-platform iOS & Android application engineering',
      'Offline-capable caching & real-time API synchronization',
      'Biometric-ready auth & push notification workflows',
      'App store submission preparation & release checklists',
    ],
    includedScope: [
      'Mobile UI/UX, API integration, and QA across target screen sizes',
      'Build packaging for App Store and Google Play review',
    ],
    excludedScope: [
      ...STD_EXCLUDED,
      'Apple Developer & Google Play developer account fees and store review outcomes',
    ],
    legacyServiceId: 'enterprise-software-development',
  },
  {
    id: 'digital-twin-simulation-solutions',
    categoryId: 'enterprise-mobile',
    title: 'Digital Twin & Simulation Solutions',
    shortDescription:
      'Test operational changes, visualize complex facilities, and train teams in interactive virtual environments before committing real-world capital.',
    fullDescription:
      'Custom-scoped 3D spatial and operational simulation platforms connecting live or modeled telemetry to interactive web viewports.',
    iconKind: 'analytics',
    pricing: { model: 'one_time', startingUsd: 5997 },
    capabilities: [
      'Interactive 3D spatial facility & asset modeling (Three.js/WebGL)',
      'Scenario simulation & capacity/throughput visualization',
      'Telemetry feed binding for operational state inspection',
      'Executive presentation & training walkthrough modes',
    ],
    includedScope: [
      'Feasibility assessment, interactive viewport prototype, and data binding layer',
    ],
    excludedScope: [
      ...STD_EXCLUDED,
      'Physical LiDAR scanning, CAD asset cleanup, and industrial PLC hardware',
    ],
    complianceNote: EMERGING_TECH_FEASIBILITY_NOTICE,
    legacyServiceId: 'gaming-interactive-technology',
  },
  {
    id: 'ar-vr-immersive-experiences',
    categoryId: 'enterprise-mobile',
    title: 'AR/VR & Immersive Digital Experiences',
    shortDescription:
      'Captivate buyers and accelerate training with interactive 3D product previews, virtual showrooms, and spatial brand storytelling.',
    fullDescription:
      'Custom-scoped WebXR, Three.js, and interactive 3D experiences enabling customers to inspect products, spaces, and architectural concepts from any device.',
    iconKind: 'multimedia',
    pricing: { model: 'one_time', startingUsd: 4497 },
    capabilities: [
      'Interactive 3D product configurators & virtual showrooms',
      'WebXR / mobile AR placement previews',
      'Real-time lighting, material & shader optimization',
      'Guided interactive tours for sales & onboarding',
    ],
    includedScope: [
      'Feasibility scoping, interactive 3D web experience, and asset pipeline',
    ],
    excludedScope: [
      ...STD_EXCLUDED,
      'VR headset hardware procurement and custom photogrammetry shoots',
    ],
    complianceNote: EMERGING_TECH_FEASIBILITY_NOTICE,
    legacyServiceId: 'gaming-interactive-technology',
  },
  {
    id: 'technology-architecture-advisory',
    categoryId: 'enterprise-mobile',
    title: 'Technology Architecture & Advisory',
    shortDescription:
      'Make high-stakes software, cloud, and AI investment decisions with senior engineering guidance that prevents costly architectural mistakes.',
    fullDescription:
      'Executive technical due diligence, stack modernization planning, build-vs-buy evaluations, and security posture roadmaps.',
    iconKind: 'enterprise',
    pricing: { model: 'hourly', startingUsd: 147, unitLabel: '/hour' },
    capabilities: [
      'System architecture audits & bottleneck diagnosis',
      'AI, cloud & vendor selection advisory',
      'Technical due diligence & modernization roadmaps',
      'Engineering team workflow & CI/CD standards review',
    ],
    includedScope: [
      'Dedicated senior architect consultation hours and written recommendations',
    ],
    excludedScope: STD_EXCLUDED,
    legacyServiceId: 'technology-consulting',
  },

  // =========================================================================
  // 5. AUTOMATION & INTELLIGENT BUSINESS SYSTEMS (BLOCK 6)
  // =========================================================================
  {
    id: 'intelligent-workflow-automation',
    categoryId: 'automation-systems',
    title: 'Intelligent Workflow Automation',
    shortDescription:
      'Eliminate repetitive manual data entry and handoff delays so your team can focus on high-value client work and strategic growth.',
    fullDescription:
      'Event-driven business automations connecting forms, CRMs, spreadsheets, email approvals, and billing alerts with reliable error handling.',
    iconKind: 'automation',
    pricing: { model: 'one_time', startingUsd: 447 },
    capabilities: [
      'Automated cross-app task routing & status notifications',
      'Approval-gated workflow triggers & exception alerts',
      'Scheduled reporting & data synchronization jobs',
      'Idempotent retry handling & execution logs',
    ],
    includedScope: [
      'Workflow mapping, automation build, testing, and handoff documentation',
    ],
    excludedScope: STD_EXCLUDED,
    legacyServiceId: 'ai-solutions-automation',
  },
  {
    id: 'business-intelligence-analytics',
    categoryId: 'automation-systems',
    title: 'Business Intelligence & Analytics',
    shortDescription:
      'Turn scattered operational records into clear executive dashboards that surface revenue trends, bottlenecks, and performance metrics in real time.',
    fullDescription:
      'Centralized KPI dashboards and reporting pipelines unifying sales, finance, operations, and customer engagement metrics.',
    iconKind: 'analytics',
    pricing: { model: 'one_time', startingUsd: 747 },
    capabilities: [
      'Executive KPI dashboards with clean tabular metrics',
      'Multi-source data aggregation & scheduled refreshes',
      'Exportable CSV/PDF management reports',
      'Role-scoped visibility for leadership & department leads',
    ],
    includedScope: [
      'Metric definition, dashboard UI, and automated data connectors',
    ],
    excludedScope: [
      ...STD_EXCLUDED,
      'Third-party BI platform seat licenses if selected over custom web dashboards',
    ],
    legacyServiceId: 'digital-platforms-interactive',
  },
  {
    id: 'api-systems-integration',
    categoryId: 'automation-systems',
    title: 'API & Systems Integration',
    shortDescription:
      'Unify disconnected CRMs, payment processors, ERPs, and internal tools into one reliable flow of accurate, real-time business data.',
    fullDescription:
      'Production REST/GraphQL/webhook integration middleware engineered with schema validation, rate-limit resilience, and observability.',
    iconKind: 'automation',
    pricing: { model: 'one_time', startingUsd: 897 },
    capabilities: [
      'REST, GraphQL & webhook synchronization services',
      'Schema mapping, transformation & payload validation',
      'Exponential backoff retries & dead-letter error handling',
      'Secure credential & OAuth token management',
    ],
    includedScope: [
      'Integration middleware code, endpoint tests, and mapping documentation',
    ],
    excludedScope: [
      ...STD_EXCLUDED,
      'Vendor API access fees or legacy vendor support contracts',
    ],
    legacyServiceId: 'enterprise-software-development',
  },
  {
    id: 'enterprise-data-engineering',
    categoryId: 'automation-systems',
    title: 'Enterprise Data Engineering',
    shortDescription:
      'Build clean, dependable data pipelines and analytical warehouses that make AI initiatives and enterprise reporting trustworthy.',
    fullDescription:
      'Automated ETL/ELT pipelines, data quality validation gates, and structured warehousing engineered for analytical accuracy.',
    iconKind: 'analytics',
    pricing: { model: 'one_time', startingUsd: 2997 },
    capabilities: [
      'Automated ETL/ELT ingestion & transformation pipelines',
      'Data deduplication, validation & lineage tracking',
      'Analytical warehouse modeling for BI & AI workloads',
      'Incremental sync scheduling & failure alerting',
    ],
    includedScope: [
      'Pipeline architecture, transformation scripts, and validation checks',
    ],
    excludedScope: STD_EXCLUDED,
    legacyServiceId: 'cloud-database-integration',
  },
  {
    id: 'intelligent-document-processing',
    categoryId: 'automation-systems',
    title: 'Intelligent Document Processing',
    shortDescription:
      'Extract, validate, and structure data from invoices, forms, contracts, and PDFs automatically—cutting manual review hours dramatically.',
    fullDescription:
      'Multimodal AI and OCR extraction pipelines transforming unstructured documents into validated JSON/database records with human confidence checks.',
    iconKind: 'ai',
    pricing: { model: 'one_time', startingUsd: 1497 },
    capabilities: [
      'Automated PDF, scan & form field extraction',
      'Schema validation & anomaly flagging for human review',
      'Direct export to ERP, accounting, or PostgreSQL tables',
      'Audit trail linking extracted fields to source pages',
    ],
    includedScope: [
      'Extraction pipeline, validation rules, and review interface',
    ],
    excludedScope: STD_EXCLUDED,
    legacyServiceId: 'ai-solutions-automation',
  },
  {
    id: 'computer-vision-intelligent-recognition',
    categoryId: 'automation-systems',
    title: 'Computer Vision & Intelligent Recognition',
    shortDescription:
      'Automate visual inspection, asset tagging, and image/video analysis to improve operational speed and consistency.',
    fullDescription:
      'Custom-scoped visual recognition and media classification pipelines tailored to quality inspection, cataloging, or physical-space analytics.',
    iconKind: 'ai',
    pricing: { model: 'one_time', startingUsd: 2997 },
    capabilities: [
      'Custom-scoped image & video frame analysis pipelines',
      'Automated quality check flagging & media metadata tagging',
      'Confidence thresholds & human verification workflows',
      'Privacy-conscious edge or cloud inference routing',
    ],
    includedScope: [
      'Feasibility validation, model pipeline integration, and test benchmark report',
    ],
    excludedScope: [
      ...STD_EXCLUDED,
      'Industrial camera hardware, lighting rigs, and large-scale manual dataset labeling',
    ],
    complianceNote: EMERGING_TECH_FEASIBILITY_NOTICE,
    legacyServiceId: 'ai-solutions-automation',
  },
  {
    id: 'iot-solutions',
    categoryId: 'automation-systems',
    title: 'Internet of Things (IoT) Solutions',
    shortDescription:
      'Connect field sensors, equipment, and facilities to live cloud dashboards for proactive monitoring and smarter operational decisions.',
    fullDescription:
      'Custom-scoped telemetry ingestion, MQTT/HTTP device gateways, alert thresholds, and real-time operational monitoring interfaces.',
    iconKind: 'cloud',
    pricing: { model: 'one_time', startingUsd: 2997 },
    capabilities: [
      'Device-to-cloud telemetry ingestion & state storage',
      'Threshold alerting & maintenance trigger workflows',
      'Live fleet or facility monitoring dashboards',
      'Device provisioning & credential rotation design',
    ],
    includedScope: [
      'Feasibility scoping, cloud telemetry API, and monitoring dashboard',
    ],
    excludedScope: [
      ...STD_EXCLUDED,
      'Physical sensors, microcontrollers, cellular SIM plans, and on-site electrical installation',
    ],
    complianceNote: EMERGING_TECH_FEASIBILITY_NOTICE,
    legacyServiceId: 'cloud-database-integration',
  },

  // =========================================================================
  // 6. CLOUD, CYBERSECURITY & INFRASTRUCTURE (BLOCK 6)
  // =========================================================================
  {
    id: 'cloud-infrastructure-devops',
    categoryId: 'cloud-cybersecurity',
    title: 'Cloud Infrastructure & DevOps Engineering',
    shortDescription:
      'Keep your applications fast, resilient, and effortless to update with automated deployments, cloud scaling, and proactive reliability.',
    fullDescription:
      'Containerized cloud architecture, automated CI/CD pipelines, environment parity, and zero-downtime deployment workflows.',
    iconKind: 'cloud',
    pricing: { model: 'one_time', startingUsd: 447 },
    capabilities: [
      'Cloud Run, container & serverless deployment pipelines',
      'GitHub Actions CI/CD build, lint & automated checks',
      'Environment secret management & staging parity',
      'Uptime monitoring & automated backup configuration',
    ],
    includedScope: [
      'Infrastructure configuration, CI/CD workflow files, and deployment runbook',
    ],
    excludedScope: [
      ...STD_EXCLUDED,
      'Ongoing monthly cloud compute, bandwidth, and storage bills',
    ],
    legacyServiceId: 'cloud-database-integration',
  },
  {
    id: 'database-architecture-optimization',
    categoryId: 'cloud-cybersecurity',
    title: 'Database Architecture & Optimization',
    shortDescription:
      'Eliminate slow queries and fragile data silos with clean relational schemas, indexing, and reliable disaster recovery.',
    fullDescription:
      'PostgreSQL / Cloud SQL schema architecture, Row-Level Security (RLS), query profiling, and safe zero-downtime migration pipelines.',
    iconKind: 'cloud',
    pricing: { model: 'one_time', startingUsd: 597 },
    capabilities: [
      'Normalized PostgreSQL schema & indexing design',
      'Row-Level Security (RLS) & tenant data isolation',
      'Slow-query profiling & connection pooling tuning',
      'Versioned schema migrations & automated snapshots',
    ],
    includedScope: [
      'Schema blueprint, migration scripts, and performance benchmark summary',
    ],
    excludedScope: STD_EXCLUDED,
    legacyServiceId: 'cloud-database-integration',
  },
  {
    id: 'cybersecurity-digital-protection',
    categoryId: 'cloud-cybersecurity',
    title: 'Cybersecurity & Digital Protection',
    shortDescription:
      'Protect customer trust and business continuity by hardening access controls, APIs, headers, and data workflows against common threats.',
    fullDescription:
      'Practical application and infrastructure security hardening covering authentication boundaries, OWASP mitigation, secret hygiene, and backup readiness.',
    iconKind: 'cybersecurity',
    pricing: { model: 'one_time', startingUsd: 447 },
    capabilities: [
      'Application security posture & OWASP Top-10 review',
      'RBAC, session security & rate-limiting implementation',
      'SSL/TLS, CSP & security header hardening',
      'Dependency vulnerability remediation & secret audit',
    ],
    includedScope: [
      'Security findings report and implementation of core hardening controls',
    ],
    excludedScope: [
      ...STD_EXCLUDED,
      'Formal ISO/SOC2 certification issuance or external legal compliance attestation',
    ],
    legacyServiceId: 'technology-consulting',
  },

  // =========================================================================
  // 7. DIGITAL MODERNIZATION & WEBSITE CARE (BLOCK 7)
  // =========================================================================
  {
    id: 'content-refinement-digital-updates',
    categoryId: 'modernization-care',
    subcategory: 'one-time',
    title: 'Content Refinement & Digital Updates',
    shortDescription:
      'Keep your site accurate and credible with prompt text updates, imagery swaps, pricing revisions, and layout polish.',
    fullDescription:
      'Rapid, clean execution of targeted content, copy, media, and section updates on your existing website without disrupting live traffic.',
    iconKind: 'website',
    pricing: { model: 'one_time', startingUsd: 45 },
    capabilities: [
      'Copy, pricing & visual asset updates',
      'Navigation link & contact detail corrections',
      'Clean formatting & responsive verification',
    ],
    includedScope: ['Single-batch content & visual update with live QA check'],
    excludedScope: STD_EXCLUDED,
    legacyServiceId: 'website-design-development',
  },
  {
    id: 'website-page-expansion',
    categoryId: 'modernization-care',
    subcategory: 'one-time',
    title: 'Website Page Expansion',
    shortDescription:
      'Add new service pages, campaign landing pages, or team/portfolio sections seamlessly aligned with your existing brand design.',
    fullDescription:
      'Design and build of additional responsive pages integrated cleanly into your existing site navigation, design system, and SEO structure.',
    iconKind: 'website',
    pricing: { model: 'one_time', startingUsd: 147 },
    capabilities: [
      'Brand-consistent new page layout & responsive styling',
      'Navigation integration & internal linking',
      'On-page SEO metadata & CTA wiring',
    ],
    includedScope: ['One complete additional page built and QA-tested across viewports'],
    excludedScope: STD_EXCLUDED,
    legacyServiceId: 'website-design-development',
  },
  {
    id: 'responsive-experience-optimization',
    categoryId: 'modernization-care',
    subcategory: 'one-time',
    title: 'Responsive Experience Optimization',
    shortDescription:
      'Fix mobile layout breaks, cramped buttons, and horizontal overflow so mobile visitors convert as smoothly as desktop visitors.',
    fullDescription:
      'Systematic audit and CSS/layout remediation across mobile, tablet, and desktop breakpoints to ensure clean spacing and touch targets.',
    iconKind: 'mobile',
    pricing: { model: 'one_time', startingUsd: 237 },
    capabilities: [
      'Mobile & tablet breakpoint layout fixes',
      'Touch-target sizing & typography legibility tuning',
      'Elimination of horizontal scroll & overlapping elements',
    ],
    includedScope: ['Cross-device responsive audit and CSS/component fixes'],
    excludedScope: STD_EXCLUDED,
    legacyServiceId: 'website-design-development',
  },
  {
    id: 'website-functionality-restoration',
    categoryId: 'modernization-care',
    subcategory: 'one-time',
    title: 'Website Functionality Restoration',
    shortDescription:
      'Diagnose and repair broken forms, failing plugins, layout errors, or post-update crashes to get your site working reliably again.',
    fullDescription:
      'Root-cause debugging and repair for broken UI interactions, contact forms, script errors, or theme/plugin conflicts.',
    iconKind: 'cybersecurity',
    pricing: { model: 'one_time', startingUsd: 147 },
    capabilities: [
      'Console, server & form-submission bug diagnosis',
      'Plugin/dependency conflict resolution',
      'Verification of restored interactive workflows',
    ],
    includedScope: ['Diagnostic review and restoration of targeted broken functionality'],
    excludedScope: STD_EXCLUDED,
    legacyServiceId: 'website-design-development',
  },
  {
    id: 'performance-speed-enhancement',
    categoryId: 'modernization-care',
    subcategory: 'one-time',
    title: 'Performance & Speed Enhancement',
    shortDescription:
      'Accelerate slow page loads and improve Core Web Vitals so visitors stay engaged and search rankings benefit.',
    fullDescription:
      'Asset compression, bundle splitting, caching strategy, lazy loading, and render-blocking elimination measured against Core Web Vitals.',
    iconKind: 'analytics',
    pricing: { model: 'one_time', startingUsd: 297 },
    capabilities: [
      'Image/media compression & lazy-loading implementation',
      'JavaScript/CSS bundle & font delivery optimization',
      'Before/after Lighthouse & Core Web Vitals verification',
    ],
    includedScope: ['Frontend & asset performance pass with benchmark summary'],
    excludedScope: STD_EXCLUDED,
    legacyServiceId: 'website-design-development',
  },
  {
    id: 'complete-digital-experience-redesign',
    categoryId: 'modernization-care',
    subcategory: 'one-time',
    title: 'Complete Digital Experience Redesign',
    shortDescription:
      'Transform an outdated website into a modern, credible, conversion-ready digital experience while preserving SEO equity.',
    fullDescription:
      'End-to-end visual and structural modernization of an existing site with refreshed typography, responsive layouts, and clean URL redirects.',
    iconKind: 'website',
    pricing: { model: 'one_time', startingUsd: 897 },
    capabilities: [
      'Modern UI/UX overhaul aligned with brand positioning',
      'Content restructuring & conversion path clarity',
      'URL redirect mapping to protect search equity',
    ],
    includedScope: ['Complete visual redesign, responsive build, and launch checklist'],
    excludedScope: STD_EXCLUDED,
    legacyServiceId: 'website-design-development',
  },
  {
    id: 'cms-technology-updates',
    categoryId: 'modernization-care',
    subcategory: 'one-time',
    title: 'CMS & Technology Updates',
    shortDescription:
      'Safely update core frameworks, CMS plugins, and runtime dependencies with pre-update backups and regression testing.',
    fullDescription:
      'Controlled dependency and CMS upgrade workflow eliminating known security vulnerabilities and compatibility drift.',
    iconKind: 'cloud',
    pricing: { model: 'one_time', startingUsd: 147 },
    capabilities: [
      'Full pre-update snapshot & staging verification',
      'Core CMS, plugin & npm package updates',
      'Post-update functional & visual regression testing',
    ],
    includedScope: ['Backup, controlled upgrade pass, and verification report'],
    excludedScope: STD_EXCLUDED,
    legacyServiceId: 'cloud-database-integration',
  },
  {
    id: 'website-migration-transition',
    categoryId: 'modernization-care',
    subcategory: 'one-time',
    title: 'Website Migration & Transition',
    shortDescription:
      'Move your website, database, and DNS records to faster, more reliable hosting with minimal downtime and zero lost assets.',
    fullDescription:
      'End-to-end hosting, domain/DNS, database, and SSL cutover management with verification before decommissioning legacy servers.',
    iconKind: 'cloud',
    pricing: { model: 'one_time', startingUsd: 297 },
    capabilities: [
      'Full file, asset & database export/import',
      'DNS, SSL certificate & email record preservation',
      'Zero-gap staging test prior to live DNS cutover',
    ],
    includedScope: ['End-to-end migration execution and post-cutover verification'],
    excludedScope: STD_EXCLUDED,
    legacyServiceId: 'cloud-database-integration',
  },
  {
    id: 'technical-seo-optimization',
    categoryId: 'modernization-care',
    subcategory: 'one-time',
    title: 'Technical SEO Optimization',
    shortDescription:
      'Help search engines accurately index and rank your site with clean metadata, structured Schema.org markup, sitemaps, and crawl fixes.',
    fullDescription:
      'Technical search foundation audit and implementation covering semantic headings, OpenGraph tags, XML sitemaps, robots rules, and JSON-LD.',
    iconKind: 'analytics',
    pricing: { model: 'one_time', startingUsd: 297 },
    capabilities: [
      'Schema.org JSON-LD & OpenGraph / Twitter Card markup',
      'Canonical URLs, XML sitemaps & crawl error resolution',
      'Semantic HTML heading & Core Web Vitals alignment',
    ],
    includedScope: ['Technical SEO audit and on-site technical implementation'],
    excludedScope: [
      ...STD_EXCLUDED,
      'Ongoing monthly link-building or paid search ad spend',
    ],
    legacyServiceId: 'website-design-development',
  },
  {
    id: 'cybersecurity-assessment',
    categoryId: 'modernization-care',
    subcategory: 'one-time',
    title: 'Cybersecurity Assessment',
    shortDescription:
      'Uncover exposed endpoints, weak permissions, and vulnerable dependencies before attackers do—with a clear remediation plan.',
    fullDescription:
      'Structured security assessment evaluating authentication, headers, dependency CVEs, access permissions, and configuration hygiene.',
    iconKind: 'cybersecurity',
    pricing: { model: 'one_time', startingUsd: 447 },
    capabilities: [
      'Dependency & configuration vulnerability audit',
      'Authentication, session & API exposure checks',
      'Prioritized executive & engineering remediation report',
    ],
    includedScope: ['Comprehensive security assessment and actionable findings report'],
    excludedScope: [
      ...STD_EXCLUDED,
      'Compliance certification issuance or 24/7 SOC monitoring',
    ],
    legacyServiceId: 'technology-consulting',
  },
  {
    id: 'malware-remediation',
    categoryId: 'modernization-care',
    subcategory: 'one-time',
    title: 'Malware Remediation',
    shortDescription:
      'Rapidly isolate, clean, and recover compromised websites, remove injected scripts, and lock down entry vectors.',
    fullDescription:
      'Emergency cleanup of malicious code, unauthorized admin accounts, and backdoors paired with credential rotation and post-clean hardening.',
    iconKind: 'cybersecurity',
    pricing: { model: 'one_time', startingUsd: 597 },
    capabilities: [
      'Full file & database malware sweep and removal',
      'Unauthorized account & backdoor eradication',
      'Post-cleanup firewall/header hardening & credential rotation guide',
    ],
    includedScope: ['Site sanitization, restoration verification, and hardening pass'],
    excludedScope: STD_EXCLUDED,
    legacyServiceId: 'technology-consulting',
  },
  {
    id: 'api-payment-integration-repair',
    categoryId: 'modernization-care',
    subcategory: 'one-time',
    title: 'API & Payment Integration Repair',
    shortDescription:
      'Fix failing payment checkouts, expired webhook signatures, or broken third-party API syncs before they cost you revenue.',
    fullDescription:
      'Targeted debugging and restoration of payment gateways, webhook listeners, OAuth refresh flows, and third-party API connectors.',
    iconKind: 'automation',
    pricing: { model: 'one_time', startingUsd: 447 },
    capabilities: [
      'Checkout, webhook signature & callback debugging',
      'API version migration & token refresh fixes',
      'Sandbox & production transaction verification',
    ],
    includedScope: ['Diagnosis, integration repair, and end-to-end test verification'],
    excludedScope: STD_EXCLUDED,
    legacyServiceId: 'enterprise-software-development',
  },
  {
    id: 'deployment-cicd-engineering',
    categoryId: 'modernization-care',
    subcategory: 'one-time',
    title: 'Deployment & CI/CD Engineering',
    shortDescription:
      'Replace risky manual file uploads with automated, repeatable build, test, and rollback deployment pipelines.',
    fullDescription:
      'Clean GitHub Actions or cloud build pipelines automating linting, compilation, preview environments, and safe production releases.',
    iconKind: 'cloud',
    pricing: { model: 'one_time', startingUsd: 447 },
    capabilities: [
      'Automated build, typecheck & lint gates',
      'Branch preview & zero-downtime release workflows',
      'Environment secret separation & rollback readiness',
    ],
    includedScope: ['CI/CD pipeline setup and team deployment guide'],
    excludedScope: STD_EXCLUDED,
    legacyServiceId: 'cloud-database-integration',
  },
  {
    id: 'accessibility-enhancement',
    categoryId: 'modernization-care',
    subcategory: 'one-time',
    title: 'Accessibility Enhancement',
    shortDescription:
      'Make your digital experience usable for every visitor with WCAG-aligned contrast, keyboard navigation, and screen-reader semantics.',
    fullDescription:
      'Focused accessibility remediation covering ARIA landmarks, focus management, color contrast, reduced-motion support, and form labels.',
    iconKind: 'website',
    pricing: { model: 'one_time', startingUsd: 597 },
    capabilities: [
      'WCAG AA contrast, focus-ring & keyboard-navigation fixes',
      'Semantic landmarks, alt text & ARIA attribute alignment',
      'Reduced-motion support & form error announcements',
    ],
    includedScope: ['Accessibility audit and front-end remediation pass'],
    excludedScope: [
      ...STD_EXCLUDED,
      'Formal third-party legal accessibility certification',
    ],
    legacyServiceId: 'website-design-development',
  },
  // Digital Care Memberships (separated cleanly from one-time repair services)
  {
    id: 'essential-care-membership',
    categoryId: 'modernization-care',
    subcategory: 'care-membership',
    title: 'Essential Care',
    shortDescription:
      'Reliable foundational upkeep with scheduled backups, security checks, uptime monitoring, and monthly minor content updates.',
    fullDescription:
      'Peace-of-mind monthly Digital Care Membership keeping smaller corporate sites backed up, patched, monitored, and current.',
    iconKind: 'cybersecurity',
    pricing: { model: 'subscription_monthly', startingUsd: 87 },
    capabilities: [
      'Scheduled off-site backups & uptime monitoring',
      'Monthly core & dependency security patch check',
      'Up to 1 hour/month of minor content or visual updates',
    ],
    includedScope: ['Recurring monthly monitoring, backups, and minor update allocation'],
    excludedScope: [
      ...STD_EXCLUDED,
      'Major redesigns, new feature modules, or emergency malware cleanup',
    ],
    legacyServiceId: 'cloud-database-integration',
  },
  {
    id: 'professional-care-membership',
    categoryId: 'modernization-care',
    subcategory: 'care-membership',
    title: 'Professional Care',
    shortDescription:
      'Proactive performance tuning, staging-tested updates, priority bug fixes, and monthly feature refinements for growing businesses.',
    fullDescription:
      'Active engineering care plan designed for revenue-generating websites and web apps requiring reliable ongoing optimization and rapid support.',
    iconKind: 'cloud',
    pricing: { model: 'subscription_monthly', startingUsd: 237 },
    capabilities: [
      'Weekly backups, staging-tested updates & uptime alerts',
      'Quarterly speed & technical SEO health check',
      'Up to 3 hours/month of enhancements & priority fixes',
    ],
    includedScope: ['Staging-verified monthly updates, performance checks, and priority support'],
    excludedScope: [
      ...STD_EXCLUDED,
      'Full application rebuilds or separate third-party SaaS fees',
    ],
    featuredTier: 'flagship',
    legacyServiceId: 'cloud-database-integration',
  },
  {
    id: 'executive-care-membership',
    categoryId: 'modernization-care',
    subcategory: 'care-membership',
    title: 'Executive Care',
    shortDescription:
      'Dedicated SLA-backed technical stewardship covering continuous security posture, AI/API monitoring, and ongoing engineering capacity.',
    fullDescription:
      'Comprehensive monthly engineering retainer for mission-critical platforms, AI integrations, and high-traffic commercial operations.',
    iconKind: 'enterprise',
    pricing: { model: 'subscription_monthly', startingUsd: 597 },
    capabilities: [
      'Daily backups, continuous observability & priority SLA response',
      'Ongoing API, AI pipeline & database health tuning',
      'Up to 8 hours/month of dedicated engineering & creative refinements',
    ],
    includedScope: ['Dedicated monthly engineering allocation, security watch, and executive reporting'],
    excludedScope: STD_EXCLUDED,
    legacyServiceId: 'enterprise-software-development',
  },

  // =========================================================================
  // 8. CREATIVE MULTIMEDIA & BRAND INNOVATION (BLOCK 8)
  // =========================================================================
  {
    id: 'premium-brand-identity-design',
    categoryId: 'creative-multimedia',
    title: 'Premium Brand Identity & Design',
    shortDescription:
      'Authoritative logos, typography hierarchies, color tokens, and cohesive brand systems built for instant market trust.',
    fullDescription:
      'Strategic visual identity engineering delivering vector marks, brand guidelines, executive stationery, and digital design tokens.',
    iconKind: 'multimedia',
    pricing: { model: 'one_time', startingUsd: 147 },
    capabilities: [
      'Vector logo/monogram & visual identity architecture',
      'Color palette, typography & digital UI design tokens',
      'Executive brand guidelines & marketing templates',
    ],
    includedScope: ['Primary identity concepts, vector exports, and mini brand guide'],
    excludedScope: [
      ...STD_EXCLUDED,
      'Commercial font licensing and physical print production runs',
    ],
    legacyServiceId: 'graphic-design-branding',
  },
  {
    id: 'multimedia-creative-production',
    categoryId: 'creative-multimedia',
    title: 'Multimedia & Creative Production',
    shortDescription:
      'Cinema-grade video production, color grading, motion graphics, and commercial photography tailored for brand authority.',
    fullDescription:
      'End-to-end audio-visual storytelling combining studio cinematography, ACES color mastering, motion graphics, and crisp sound design.',
    iconKind: 'multimedia',
    pricing: { model: 'one_time', startingUsd: 147 },
    capabilities: [
      'Commercial brand films, promos & executive interviews',
      'ACES color grading, VFX compositing & audio mastering',
      'Corporate photography & multi-format social deliverables',
    ],
    includedScope: ['Scoped production or post-production deliverables in web/broadcast formats'],
    excludedScope: [
      ...STD_EXCLUDED,
      'External location permits, talent casting, and travel outside Clark/Pampanga',
    ],
    legacyServiceId: 'multimedia-production',
  },
  {
    id: '3d-visualization-digital-experiences',
    categoryId: 'creative-multimedia',
    title: '3D Visualization & Digital Experiences',
    shortDescription:
      'Photorealistic 3D product renders, architectural visualizations, and interactive browser-ready 3D models.',
    fullDescription:
      'Precision 3D modeling, studio-lit rendering, and WebGL-optimized scenes that showcase products and spaces before physical buildout.',
    iconKind: 'multimedia',
    pricing: { model: 'one_time', startingUsd: 297 },
    capabilities: [
      '3D product modeling, materials & studio lighting renders',
      'Architectural & interior spatial visualizations',
      'Lightweight GLTF/WebGL exports for interactive web viewers',
    ],
    includedScope: ['3D scene/model deliverables and high-resolution render outputs'],
    excludedScope: STD_EXCLUDED,
    legacyServiceId: 'gaming-interactive-technology',
  },
  {
    id: 'digital-marketing-brand-visibility',
    categoryId: 'creative-multimedia',
    title: 'Digital Marketing & Brand Visibility',
    shortDescription:
      'Consistent creative campaigns, content strategy, and conversion-aligned digital visibility engineered for steady audience growth.',
    fullDescription:
      'Ongoing monthly creative campaign direction, branded visual assets, landing optimization, and transparent performance reporting.',
    iconKind: 'analytics',
    pricing: { model: 'subscription_monthly', startingUsd: 297 },
    capabilities: [
      'Monthly campaign creative & branded social media assets',
      'Audience messaging & funnel conversion optimization',
      'Monthly analytics summary & strategic adjustments',
    ],
    includedScope: ['Monthly creative production, campaign calendar, and performance brief'],
    excludedScope: [
      ...STD_EXCLUDED,
      'Paid media ad spend (Meta, Google, LinkedIn) billed directly by ad platforms',
    ],
    legacyServiceId: 'multimedia-production',
  },
  {
    id: 'advanced-ecommerce-integration',
    categoryId: 'creative-multimedia',
    title: 'Advanced E-Commerce Integration',
    shortDescription:
      'Upgrade existing brand sites with high-converting product showcases, payment gateways, shipping rules, and automated order flows.',
    fullDescription:
      'Seamless commercial integration connecting rich multimedia product presentation with secure checkout, tax/shipping logic, and CRM sync.',
    iconKind: 'website',
    pricing: { model: 'one_time', startingUsd: 1497 },
    capabilities: [
      'Rich media product galleries & quick-configure UX',
      'Payment gateway, shipping & tax calculation wiring',
      'Order confirmation & inventory webhook integration',
    ],
    includedScope: ['E-commerce module integration, checkout testing, and merchant guide'],
    excludedScope: STD_EXCLUDED,
    legacyServiceId: 'website-design-development',
  },
  {
    id: 'digital-transformation-advisory',
    categoryId: 'creative-multimedia',
    title: 'Digital Transformation Advisory',
    shortDescription:
      'Align brand experience, AI automation, and software architecture into one practical roadmap tailored to your business stage.',
    fullDescription:
      'Executive advisory sessions translating operational pain points and growth targets into prioritized digital, creative, and AI initiatives.',
    iconKind: 'enterprise',
    pricing: { model: 'hourly', startingUsd: 147, unitLabel: '/hour' },
    capabilities: [
      'Cross-disciplinary brand, AI & software roadmap planning',
      'Workflow bottleneck & ROI prioritization workshops',
      'Vendor & technology investment evaluation',
    ],
    includedScope: ['Live advisory session(s) and concise written action summary'],
    excludedScope: STD_EXCLUDED,
    legacyServiceId: 'technology-consulting',
  },
  {
    id: 'professional-technology-training',
    categoryId: 'creative-multimedia',
    title: 'Professional Technology Training',
    shortDescription:
      'Practical, hands-on workshops empowering your team to operate modern AI tools, CMS platforms, and digital production workflows.',
    fullDescription:
      'Live instructor-led corporate training sessions tailored to your stack—covering safe AI adoption, content management, and workflow tools.',
    iconKind: 'ai',
    pricing: { model: 'per_session', startingUsd: 297, unitLabel: '/session' },
    capabilities: [
      'Live remote or Clark Freeport Zone on-site workshops',
      'Team AI literacy, prompt governance & safety practices',
      'CMS, digital tool & media workflow playbooks',
    ],
    includedScope: ['Structured live training session plus participant reference guide'],
    excludedScope: [
      ...STD_EXCLUDED,
      'Travel/venue expenses for off-site sessions outside Pampanga',
    ],
    legacyServiceId: 'technology-consulting',
  },
  {
    id: 'managed-technical-support',
    categoryId: 'creative-multimedia',
    title: 'Managed Technical Support',
    shortDescription:
      'Dependable on-call technical assistance for troubleshooting, asset updates, user permissions, and day-to-day digital continuity.',
    fullDescription:
      'Monthly support retainer giving your organization direct access to Ophireum engineers for timely operational assistance and guidance.',
    iconKind: 'cloud',
    pricing: { model: 'subscription_monthly', startingUsd: 87 },
    capabilities: [
      'Dedicated ticket & priority email/chat support channel',
      'User account, DNS & minor configuration troubleshooting',
      'Proactive advisory before planned platform changes',
    ],
    includedScope: ['Monthly support hours allocation and incident triage'],
    excludedScope: STD_EXCLUDED,
    legacyServiceId: 'cloud-database-integration',
  },

  // =========================================================================
  // 9. INDUSTRY-SPECIFIC DIGITAL SOLUTIONS (BLOCK 9)
  // =========================================================================
  {
    id: 'industry-beauty-wellness',
    categoryId: 'industry-solutions',
    title: 'Beauty & Wellness Digital Experience',
    shortDescription:
      'Sophisticated brand presentation with effortless appointment booking, treatment menus, loyalty touchpoints, and mobile-first conversion.',
    fullDescription:
      'Tailored for salons, aesthetic clinics, spas, and wellness studios seeking elevated aesthetics paired with automated client scheduling.',
    iconKind: 'multimedia',
    pricing: { model: 'one_time', startingUsd: 1497 },
    capabilities: [
      'Service & treatment showcase with booking integration',
      'Automated appointment reminders & client intake forms',
      'Gift card / membership readiness & visual portfolio',
    ],
    includedScope: ['Responsive brand site, booking workflow, and client inquiry routing'],
    excludedScope: STD_EXCLUDED,
    legacyServiceId: 'website-design-development',
  },
  {
    id: 'industry-hospitality-restaurant',
    categoryId: 'industry-solutions',
    title: 'Hospitality & Restaurant Solutions',
    shortDescription:
      'Drive direct table reservations, showcase digital menus, and streamline private event or catering inquiries without third-party commissions.',
    fullDescription:
      'Built for restaurants, cafes, resorts, and hospitality groups wanting high-appetite visual storytelling and direct guest conversion.',
    iconKind: 'website',
    pricing: { model: 'one_time', startingUsd: 1797 },
    capabilities: [
      'Interactive digital menus & QR dining experiences',
      'Direct reservation & private-event inquiry workflows',
      'Multi-branch location & Google Maps integration',
    ],
    includedScope: ['Hospitality web platform, menu system, and reservation intake'],
    excludedScope: STD_EXCLUDED,
    legacyServiceId: 'website-design-development',
  },
  {
    id: 'industry-real-estate-construction',
    categoryId: 'industry-solutions',
    title: 'Real Estate & Construction Intelligence',
    shortDescription:
      'Showcase developments with interactive property filters, 3D/aerial visuals, broker portals, and qualified buyer lead routing.',
    fullDescription:
      'Engineered for developers, brokerages, and construction firms needing high-trust project showcases and structured buyer qualification.',
    iconKind: 'enterprise',
    pricing: { model: 'one_time', startingUsd: 2097 },
    capabilities: [
      'Searchable property & development portfolio directory',
      'Floor-plan, virtual tour & aerial media integration',
      'Lead qualification & viewing appointment scheduler',
    ],
    includedScope: ['Property showcase platform, interactive filters, and CRM-ready lead capture'],
    excludedScope: STD_EXCLUDED,
    legacyServiceId: 'digital-platforms-interactive',
  },
  {
    id: 'industry-education-school',
    categoryId: 'industry-solutions',
    title: 'Education & School Digital Platforms',
    shortDescription:
      'Modernize admissions inquiries, academic program catalogs, campus announcements, and student/parent information portals.',
    fullDescription:
      'Accessible, structured digital platforms for schools, academies, and training institutions focused on clear enrollment pathways.',
    iconKind: 'website',
    pricing: { model: 'one_time', startingUsd: 1197 },
    capabilities: [
      'Program & curriculum explorer with admissions intake',
      'News, events & downloadable parent/student resources',
      'WCAG AA accessible navigation & mobile-first layout',
    ],
    includedScope: ['Institutional web platform, admissions form, and CMS setup'],
    excludedScope: STD_EXCLUDED,
    legacyServiceId: 'website-design-development',
  },
  {
    id: 'industry-healthcare-clinic',
    categoryId: 'industry-solutions',
    title: 'Healthcare & Clinic Digital Solutions',
    shortDescription:
      'Build patient confidence with accessible practitioner directories, specialty guides, and privacy-conscious appointment intake.',
    fullDescription:
      'Designed for medical clinics, dental practices, and diagnostic centers prioritizing patient clarity, trust, and streamlined scheduling.',
    iconKind: 'cybersecurity',
    pricing: { model: 'one_time', startingUsd: 2397 },
    capabilities: [
      'Practitioner & specialty directory with booking requests',
      'Privacy-conscious intake forms & consent acknowledgements',
      'Accessible typography & multi-branch clinic routing',
    ],
    includedScope: ['Clinic web platform, intake workflow, and security/privacy baseline'],
    excludedScope: [
      ...STD_EXCLUDED,
      'Full certified EMR/EHR clinical compliance suites unless scoped separately',
    ],
    legacyServiceId: 'enterprise-software-development',
  },
  {
    id: 'industry-logistics-transportation',
    categoryId: 'industry-solutions',
    title: 'Logistics & Transportation Intelligence',
    shortDescription:
      'Coordinate dispatch, shipment status portals, fleet visibility, and automated customer notifications in one operational hub.',
    fullDescription:
      'Custom operational software for freight, courier, and fleet organizations replacing manual dispatch spreadsheets with live tracking workflows.',
    iconKind: 'automation',
    pricing: { model: 'one_time', startingUsd: 4497 },
    capabilities: [
      'Dispatch coordination & shipment milestone tracking',
      'Client self-service tracking portal & proof-of-delivery logs',
      'Automated exception alerts & route/API integrations',
    ],
    includedScope: ['Dispatch/tracking web application, database schema, and role views'],
    excludedScope: [
      ...STD_EXCLUDED,
      'Dedicated GPS hardware devices and high-volume mapping API usage',
    ],
    legacyServiceId: 'enterprise-software-development',
  },
  {
    id: 'industry-tax-accounting',
    categoryId: 'industry-solutions',
    title: 'Tax & Accounting Digital Solutions',
    shortDescription:
      'Streamline client document collection, compliance deadline tracking, engagement onboarding, and secure client advisory portals.',
    fullDescription:
      'Built for CPA practices, tax consultancies, and bookkeeping firms seeking encrypted document intake and clear client status visibility.',
    iconKind: 'analytics',
    pricing: { model: 'one_time', startingUsd: 2097 },
    capabilities: [
      'Secure client document upload & checklist tracking',
      'Consultation scheduling & service engagement intake',
      'Role-isolated client folders & audit trail logs',
    ],
    includedScope: ['Firm digital platform, client intake portal, and RBAC setup'],
    excludedScope: STD_EXCLUDED,
    legacyServiceId: 'enterprise-software-development',
  },
  {
    id: 'industry-nonprofit-community',
    categoryId: 'industry-solutions',
    title: 'Nonprofit & Community Impact Platforms',
    shortDescription:
      'Inspire donors, publish transparent impact reports, coordinate volunteers, and streamline online giving workflows.',
    fullDescription:
      'Storytelling-rich platforms for foundations, NGOs, and civic organizations designed to communicate mission impact and mobilize supporters.',
    iconKind: 'multimedia',
    pricing: { model: 'one_time', startingUsd: 1497 },
    capabilities: [
      'Impact storytelling, campaign pages & annual report hubs',
      'Donation & volunteer registration workflows',
      'Accessible design & low-overhead content updates',
    ],
    includedScope: ['Nonprofit platform, donation/volunteer forms, and CMS setup'],
    excludedScope: STD_EXCLUDED,
    legacyServiceId: 'website-design-development',
  },
  {
    id: 'industry-professional-services',
    categoryId: 'industry-solutions',
    title: 'Professional Services Digital Suite',
    shortDescription:
      'Elevate legal, architectural, engineering, and consulting firms with authoritative case studies and automated client discovery.',
    fullDescription:
      'Executive-grade digital presence designed for high-trust advisory practices where credibility and streamlined consultation booking drive revenue.',
    iconKind: 'website',
    pricing: { model: 'one_time', startingUsd: 1197 },
    capabilities: [
      'Partner profiles, practice-area architecture & case briefs',
      'Qualification intake & calendar consultation booking',
      'Technical SEO & executive thought-leadership publishing',
    ],
    includedScope: ['Professional services site, practice templates, and booking integration'],
    excludedScope: STD_EXCLUDED,
    legacyServiceId: 'website-design-development',
  },
  {
    id: 'industry-retail-wholesale',
    categoryId: 'industry-solutions',
    title: 'Retail & Wholesale Commerce Systems',
    shortDescription:
      'Unify B2C storefronts and B2B wholesale ordering with tiered pricing, bulk request-for-quote flows, and inventory synchronization.',
    fullDescription:
      'Scalable commerce infrastructure engineered for distributors, multi-SKU retailers, and wholesale brands expanding digital sales.',
    iconKind: 'enterprise',
    pricing: { model: 'one_time', startingUsd: 2397 },
    capabilities: [
      'Catalog search, variant/tier pricing & bulk RFQ checkout',
      'Merchant order management & stock sync hooks',
      'Payment gateway & delivery workflow integration',
    ],
    includedScope: ['Commerce storefront, B2B/B2C order flow, and admin management'],
    excludedScope: STD_EXCLUDED,
    legacyServiceId: 'enterprise-software-development',
  },
  {
    id: 'industry-hotels-travel-tourism',
    categoryId: 'industry-solutions',
    title: 'Hotels, Travel & Tourism Experiences',
    shortDescription:
      'Convert international and domestic travelers with cinematic destination media, itinerary builders, and direct booking inquiries.',
    fullDescription:
      'Visual-first hospitality and tour platforms uniting immersive multimedia storytelling with clear availability and reservation pathways.',
    iconKind: 'multimedia',
    pricing: { model: 'one_time', startingUsd: 2097 },
    capabilities: [
      'Cinematic destination galleries & package showcases',
      'Direct reservation & custom itinerary request engine',
      'Multilingual-ready structure & map integrations',
    ],
    includedScope: ['Travel experience web platform, package catalog, and booking intake'],
    excludedScope: STD_EXCLUDED,
    legacyServiceId: 'multimedia-production',
  },
  {
    id: 'industry-agriculture-industrial',
    categoryId: 'industry-solutions',
    title: 'Agriculture & Industrial Technology',
    shortDescription:
      'Digitize supply-chain traceability, production batch logs, distributor portals, and facility telemetry for modern operations.',
    fullDescription:
      'Custom-scoped industrial and agri-tech software bridging field operations, batch/quality documentation, and executive oversight.',
    iconKind: 'cloud',
    pricing: { model: 'one_time', startingUsd: 4497 },
    capabilities: [
      'Production batch logging, traceability & distributor portals',
      'Sensor/telemetry dashboard readiness & offline field forms',
      'Automated compliance & export documentation workflows',
    ],
    includedScope: ['Custom operational web platform, data schema, and reporting dashboards'],
    excludedScope: [
      ...STD_EXCLUDED,
      'Field sensor hardware and industrial machinery retrofits',
    ],
    complianceNote: EMERGING_TECH_FEASIBILITY_NOTICE,
    legacyServiceId: 'enterprise-software-development',
  },

  // =========================================================================
  // 10. SIGNATURE BUSINESS TRANSFORMATION PACKAGES (BLOCK 10)
  // =========================================================================
  {
    id: 'signature-1-digital-foundation',
    categoryId: 'signature-packages',
    subcategory: 'signature',
    signatureSubtitle: 'SIGNATURE I',
    title: 'SIGNATURE I — DIGITAL FOUNDATION',
    shortDescription:
      'Launch a credible corporate web flagship paired with essential brand polish, technical SEO, and continuous foundational care.',
    fullDescription:
      'Designed for ambitious emerging organizations establishing an authoritative digital presence backed by reliable monthly technical care.',
    iconKind: 'website',
    pricing: { model: 'setup_plus_monthly', startingUsd: 1197, monthlyUsd: 87 },
    capabilities: [
      'Essential Digital Presence corporate web build',
      'Brand visual alignment & technical SEO setup',
      'Validated inquiry & consultation intake routing',
      'Ongoing Essential Care backups, security & updates',
    ],
    includedScope: [
      'Complete foundational website, SEO baseline, and first-month care onboarding',
    ],
    excludedScope: STD_EXCLUDED,
    featuredTier: 'signature',
    legacyServiceId: 'website-design-development',
  },
  {
    id: 'signature-2-business-elevation',
    categoryId: 'signature-packages',
    subcategory: 'signature',
    signatureSubtitle: 'SIGNATURE II',
    title: 'SIGNATURE II — BUSINESS ELEVATION',
    shortDescription:
      'Elevate market positioning with a bespoke multi-page web experience, workflow automation, analytics, and proactive monthly care.',
    fullDescription:
      'Comprehensive growth package uniting bespoke web engineering, intelligent lead/calendar automation, and ongoing Professional Care optimization.',
    iconKind: 'automation',
    pricing: { model: 'setup_plus_monthly', startingUsd: 2997, monthlyUsd: 237 },
    capabilities: [
      'Signature Business Experience bespoke web platform',
      'Intelligent workflow automation & calendar booking sync',
      'Executive analytics instrumentation & speed tuning',
      'Ongoing Professional Care monthly engineering support',
    ],
    includedScope: [
      'Bespoke multi-page platform, automated lead workflows, and Professional Care plan',
    ],
    excludedScope: STD_EXCLUDED,
    featuredTier: 'signature',
    legacyServiceId: 'website-design-development',
  },
  {
    id: 'signature-3-intelligent-enterprise',
    categoryId: 'signature-packages',
    subcategory: 'signature',
    signatureSubtitle: 'SIGNATURE III',
    title: 'SIGNATURE III — INTELLIGENT ENTERPRISE',
    shortDescription:
      'Deploy an AI-enabled digital ecosystem combining bespoke UX, conversational AI Concierge/Scheduling, CRM workflows, and Executive Care.',
    fullDescription:
      'Built for established enterprises ready to integrate server-side AI assistants, automated customer engagement, and dedicated technical stewardship.',
    iconKind: 'ai',
    pricing: { model: 'setup_plus_monthly', startingUsd: 5997, monthlyUsd: 597 },
    capabilities: [
      'Executive Digital Intelligence flagship web experience',
      'AI Concierge / Scheduling Assistant with human escalation',
      'API & CRM synchronization with executive KPI views',
      'Ongoing Executive Care SLA & continuous AI monitoring',
    ],
    includedScope: [
      'Full-stack platform, server-side AI integration, and Executive Care onboarding',
    ],
    excludedScope: [
      ...STD_EXCLUDED,
      'High-volume external LLM API usage beyond included tier',
    ],
    featuredTier: 'signature',
    interactiveDemoType: 'ai_consultant',
    legacyServiceId: 'ai-solutions-automation',
  },
  {
    id: 'signature-4-enterprise-transformation',
    categoryId: 'signature-packages',
    subcategory: 'signature',
    signatureSubtitle: 'SIGNATURE IV',
    title: 'SIGNATURE IV — ENTERPRISE TRANSFORMATION',
    shortDescription:
      'Flagship multi-disciplinary transformation uniting custom enterprise software, multi-agent AI Command, cloud architecture, and dedicated support.',
    fullDescription:
      'Our premier full-spectrum engagement for complex organizations modernizing core software, deploying governed multi-agent AI, and securing scalable cloud infrastructure.',
    iconKind: 'enterprise',
    pricing: { model: 'setup_plus_monthly', startingUsd: 14997, monthlyUsd: 1497 },
    capabilities: [
      'Enterprise Digital Architecture / bespoke multi-tenant software',
      'AI Enterprise Command multi-agent orchestration & RAG',
      'Cloud SQL, CI/CD & cybersecurity posture hardening',
      'Dedicated ongoing enterprise engineering & transformation care',
    ],
    includedScope: [
      'End-to-end architecture, bespoke engineering, AI command layer, and SLA care',
    ],
    excludedScope: STD_EXCLUDED,
    featuredTier: 'signature',
    interactiveDemoType: 'ai_consultant',
    legacyServiceId: 'enterprise-software-development',
  },
];

export function formatCatalogPrice(
  service: CatalogService,
  currency: 'USD' | 'PHP' = 'USD',
  phpRate: number = DEFAULT_USD_TO_PHP_RATE
): { primaryLabel: string; secondaryLabel?: string; phpEstimateLabel?: string } {
  const fmtUsd = (val: number) => `$${val.toLocaleString('en-US')}`;
  const fmtPhp = (val: number) => `Est. ~₱${Math.round(val * phpRate).toLocaleString('en-US')}`;

  const { model, startingUsd, monthlyUsd, unitLabel } = service.pricing;

  if (model === 'subscription_monthly') {
    return {
      primaryLabel: `Plans starting at ${fmtUsd(startingUsd)}/month`,
      phpEstimateLabel: currency === 'PHP' ? `${fmtPhp(startingUsd)}/month` : undefined,
    };
  }

  if (model === 'setup_plus_monthly' && monthlyUsd) {
    const isAiAgent = service.subcategory === 'agent-plan';
    return {
      primaryLabel: isAiAgent
        ? `Implementation starting at ${fmtUsd(startingUsd)}`
        : `Starting at ${fmtUsd(startingUsd)}`,
      secondaryLabel: isAiAgent
        ? `Ongoing service starting at ${fmtUsd(monthlyUsd)}/month`
        : `Ongoing care starting at ${fmtUsd(monthlyUsd)}/month`,
      phpEstimateLabel:
        currency === 'PHP'
          ? `${fmtPhp(startingUsd)} setup · ${fmtPhp(monthlyUsd)}/month`
          : undefined,
    };
  }

  if (model === 'hourly') {
    return {
      primaryLabel: `Starting at ${fmtUsd(startingUsd)}${unitLabel || '/hour'}`,
      phpEstimateLabel: currency === 'PHP' ? `${fmtPhp(startingUsd)}${unitLabel || '/hour'}` : undefined,
    };
  }

  if (model === 'per_session') {
    return {
      primaryLabel: `Starting at ${fmtUsd(startingUsd)}${unitLabel || '/session'}`,
      phpEstimateLabel: currency === 'PHP' ? `${fmtPhp(startingUsd)}${unitLabel || '/session'}` : undefined,
    };
  }

  return {
    primaryLabel: `Starting at ${fmtUsd(startingUsd)}`,
    phpEstimateLabel: currency === 'PHP' ? fmtPhp(startingUsd) : undefined,
  };
}

const STANDARDIZED_IDS = new Set<string>([
  'essential-digital-presence',
  'signature-business-experience',
  'ai-concierge-elite',
  'ai-scheduling-concierge',
  'ai-communications-executive',
  'content-refinement-digital-updates',
  'website-page-expansion',
  'responsive-experience-optimization',
  'performance-speed-enhancement',
  'technical-seo-optimization',
  'essential-care-membership',
  'professional-care-membership',
  'executive-care-membership',
  'professional-technology-training',
  'signature-1-digital-foundation',
  'signature-2-business-elevation',
]);

const OPTIONS_BY_SERVICE_OR_GROUP = (service: CatalogService): CatalogServiceOption[] => {
  if (service.categoryId === 'website-digital' && service.engagementMode === 'standardized') {
    return [
      {
        id: 'opt-bilingual-i18n',
        label: 'Bilingual EN / Filipino Switcher',
        description: 'Localized UI navigation and dual-language content templates.',
        deltaUsd: 240,
      },
      {
        id: 'opt-cms-workshop',
        label: 'Editorial & CMS Handover Workshop',
        description: 'Live 90-minute training session plus recorded documentation.',
        deltaUsd: 150,
      },
      {
        id: 'opt-priority-sprint',
        label: 'Priority 10-Day Fast-Track Delivery',
        description: 'Dedicated accelerated engineering sprint for faster launch.',
        deltaUsd: 390,
      },
    ];
  }

  if (service.subcategory === 'care-membership') {
    return [
      {
        id: 'opt-weekly-staging',
        label: 'Dedicated Staging & Pre-Deploy QA',
        description: 'Verify monthly updates in an isolated staging environment first.',
        deltaUsd: 0,
        monthlyDeltaUsd: 65,
      },
      {
        id: 'opt-uptime-sms',
        label: '24/7 Real-Time Incident Alert Routing',
        description: 'Priority executive alerting on endpoint or SSL anomalies.',
        deltaUsd: 0,
        monthlyDeltaUsd: 45,
      },
    ];
  }

  if (service.subcategory === 'agent-plan' && service.engagementMode === 'standardized') {
    return [
      {
        id: 'opt-extra-knowledge-pack',
        label: 'Extended Knowledge Base Ingestion (50 Docs)',
        description: 'Index additional service manuals, PDFs, and policy documents.',
        deltaUsd: 190,
        monthlyDeltaUsd: 45,
      },
      {
        id: 'opt-crm-webhook-sync',
        label: 'Direct CRM / Email Webhook Sync',
        description: 'Automatic structured lead dispatch to your existing CRM.',
        deltaUsd: 220,
      },
    ];
  }

  if (service.engagementMode === 'standardized') {
    return [
      {
        id: 'opt-priority-turnaround',
        label: 'Priority Express Scheduling',
        description: 'Expedited engineering queue assignment and verification.',
        deltaUsd: 95,
      },
    ];
  }

  return [];
};

export const SERVICE_CATALOG: CatalogService[] = RAW_SERVICE_CATALOG.map((item) => {
  const mode: ServiceEngagementMode =
    item.engagementMode ||
    (STANDARDIZED_IDS.has(item.id) || item.subcategory === 'care-membership'
      ? 'standardized'
      : 'custom_proposal');

  const withMode: CatalogService = {
    ...item,
    engagementMode: mode,
  };

  return {
    ...withMode,
    configurableOptions: item.configurableOptions ?? OPTIONS_BY_SERVICE_OR_GROUP(withMode),
  };
});

export function getCatalogServiceById(serviceId: string): CatalogService | undefined {
  return SERVICE_CATALOG.find((s) => s.id === serviceId);
}

export function computeConfiguredServiceTotal(
  service: CatalogService,
  selectedOptionIds: string[] = []
): { oneTimeUsd: number; monthlyUsd: number } {
  const options = (service.configurableOptions || []).filter((o) =>
    selectedOptionIds.includes(o.id)
  );
  const optionOneTime = options.reduce((sum, o) => sum + (o.deltaUsd || 0), 0);
  const optionMonthly = options.reduce((sum, o) => sum + (o.monthlyDeltaUsd || 0), 0);

  if (service.pricing.model === 'subscription_monthly') {
    return {
      oneTimeUsd: optionOneTime,
      monthlyUsd: service.pricing.startingUsd + optionMonthly,
    };
  }

  if (service.pricing.model === 'setup_plus_monthly') {
    return {
      oneTimeUsd: service.pricing.startingUsd + optionOneTime,
      monthlyUsd: (service.pricing.monthlyUsd || 0) + optionMonthly,
    };
  }

  return {
    oneTimeUsd: service.pricing.startingUsd + optionOneTime,
    monthlyUsd: optionMonthly,
  };
}

export interface DivisionPriceSummary {
  categoryId: Exclude<CatalogCategoryId, 'all'>;
  number: string;
  label: string;
  minStartingUsd: number;
  maxStartingUsd: number;
  count: number;
}

export const CATALOG_DIVISION_PRICE_RANGES: DivisionPriceSummary[] = CATALOG_CATEGORIES.filter(
  (c): c is CatalogCategoryMeta & { id: Exclude<CatalogCategoryId, 'all'> } => c.id !== 'all'
).map((cat) => {
  const items = SERVICE_CATALOG.filter((s) => s.categoryId === cat.id);
  const prices = items.map((s) => s.pricing.startingUsd);
  return {
    categoryId: cat.id,
    number: cat.number,
    label: cat.label,
    minStartingUsd: prices.length > 0 ? Math.min(...prices) : 0,
    maxStartingUsd: prices.length > 0 ? Math.max(...prices) : 0,
    count: items.length,
  };
});

