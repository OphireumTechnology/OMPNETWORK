import { ServiceItem } from '../types';

export const servicesData: ServiceItem[] = [
  {
    id: 'multimedia-production',
    number: '01',
    title: 'Multimedia Production',
    category: 'creative',
    tagline: 'End-to-end creative audio-visual production for high-stakes corporate campaigns.',
    description: 'Comprehensive media production combining creative concepting, studio direction, cinematography, multi-track audio engineering, and physical-to-digital orchestration.',
    deliverables: [
      'Commercial & Corporate Brand Films',
      'High-Fidelity Product Demonstrations',
      'Multi-Format Social & Broadcast Packages',
      'Studio & On-Location Film Production'
    ],
    technologies: ['4K/8K Cinema Workflows', 'DaVinci Resolve', 'Pro Tools', 'RED & Blackmagic Cine Systems'],
    visualType: 'media',
    status: 'Proposed Specification'
  },
  {
    id: 'photography-videography',
    number: '02',
    title: 'Photography and Videography',
    category: 'creative',
    tagline: 'Cinematic imagery and high-precision visual capture for enterprise assets.',
    description: 'Precision still photography and multi-camera motion capture spanning corporate executive portraits, architectural documentation, industrial facilities, and dynamic event coverage.',
    deliverables: [
      'Executive Leadership & Corporate Headshots',
      'Commercial Product & Industrial Photography',
      'Documentary & Event Coverage Units',
      'Aerial & Drone Cinema Operations'
    ],
    technologies: ['Full-Frame Mirrorless Arrays', 'Prime Cine Glass', 'Studio Strobe Systems', 'FAA-Compliant Aerial Drones'],
    visualType: 'camera',
    status: 'Proposed Specification'
  },
  {
    id: 'video-editing-post-production',
    number: '03',
    title: 'Video Editing and Post-Production',
    category: 'creative',
    tagline: 'Precision pacing, advanced color grading, sound design, and visual mastery.',
    description: 'Post-production assembly leveraging color calibration, motion graphics compositing, spatial audio design, and delivery mastering formatted for multi-screen international distribution.',
    deliverables: [
      'Narrative & Commercial Assembly Editing',
      'ACES-Compliant Color Grading',
      'Motion Graphics, 3D Titling & VFX Compositing',
      '5.1 & Stereo Master Audio Post-Production'
    ],
    technologies: ['Adobe Premiere Pro', 'After Effects', 'DaVinci Resolve Studio', 'Nuke VFX'],
    visualType: 'post',
    status: 'Proposed Specification'
  },
  {
    id: 'graphic-design-branding',
    number: '04',
    title: 'Graphic Design and Corporate Branding',
    category: 'creative',
    tagline: 'Authoritative brand identity systems, typography, and design tokens.',
    description: 'Holistic visual systems built for longevity: comprehensive brand guidelines, vector emblems, typography architectures, marketing collateral, and packaging guidelines.',
    deliverables: [
      'Corporate Identity & Vector Monogram Systems',
      'Enterprise Brand Architecture & Guidelines',
      'Digital Design Systems & UI Style Guides',
      'Print Collateral & Exhibition Environments'
    ],
    technologies: ['Figma Enterprise', 'Adobe Illustrator', 'Custom Typography Systems', 'Design Token Pipelines'],
    visualType: 'design',
    status: 'Proposed Specification'
  },
  {
    id: 'website-design-development',
    number: '05',
    title: 'Website Design and Development',
    category: 'software',
    tagline: 'Lightning-fast, highly accessible corporate web presences built on modern stacks.',
    description: 'Engineered web applications built with clean semantic typography, zero-bloat responsive layouts, SEO schemas, and headless content architectures.',
    deliverables: [
      'Custom React / TypeScript Corporate Platforms',
      'Performance-Optimized Responsive Web Architectures',
      'Accessibility & WCAG AA Compliance Audits',
      'Custom CMS & Headless API Integrations'
    ],
    technologies: ['React 19', 'TypeScript', 'Tailwind CSS', 'Vite', 'Next.js', 'Web Vitals Standards'],
    visualType: 'web',
    status: 'Client Ready'
  },
  {
    id: 'enterprise-software-development',
    number: '06',
    title: 'Enterprise Software Development',
    category: 'software',
    tagline: 'Scalable mission-critical portals, microservices, and internal tooling.',
    description: 'Enterprise-grade distributed systems designed with role-based access control (RBAC), multi-tenant isolation, automated validation workflows, and auditable data persistence.',
    deliverables: [
      'Internal Tooling & Operations Dashboards',
      'Multi-Tenant SaaS Platforms',
      'Secure B2B Client Portals & Workflow Engines',
      'REST & GraphQL Microservices Architecture'
    ],
    technologies: ['Node.js', 'NestJS / Express', 'PostgreSQL', 'Docker', 'Redis', 'OAuth 2.0 / OIDC'],
    visualType: 'enterprise',
    status: 'Client Ready'
  },
  {
    id: 'ai-solutions-automation',
    number: '07',
    title: 'AI Solutions and Automation',
    category: 'ai',
    tagline: 'Autonomous agent pipelines, intelligent classification, and workflow acceleration.',
    description: 'Production integration of generative and predictive intelligence: automated document processing, multi-agent development pipelines, semantic search grounding, and secure server-side model orchestration.',
    deliverables: [
      'Server-Side LLM Pipelines (Gemini / Claude / OpenAI)',
      'Multi-Agent Autonomous Development Workflows',
      'Retrieval-Augmented Generation (RAG) Engines',
      'Enterprise Workflow Process Automation'
    ],
    technologies: ['@google/genai SDK', 'LangChain / LlamaIndex', 'Vector Databases', 'Python / TS Orchestrators'],
    visualType: 'ai',
    status: 'Enterprise Active'
  },
  {
    id: 'cloud-database-integration',
    number: '08',
    title: 'Cloud and Database Integration',
    category: 'software',
    tagline: 'Resilient relational architectures, scale-to-zero databases, and CI/CD pipelines.',
    description: 'Architecting scalable cloud foundations: relational PostgreSQL deployments, schema migration pipelines, automated backup regimes, and zero-downtime container deployments.',
    deliverables: [
      'PostgreSQL & Cloud SQL Managed Configurations',
      'Database Schema Migration & Drizzle/Prisma Setup',
      'Automated Multi-Region Disaster Recovery',
      'GitHub Actions CI/CD Deployment Automation'
    ],
    technologies: ['Google Cloud Platform', 'Cloud Run / Cloud SQL', 'PostgreSQL', 'Terraform', 'GitHub Actions'],
    visualType: 'cloud',
    status: 'Proposed Specification'
  },
  {
    id: 'digital-platforms-interactive',
    number: '09',
    title: 'Digital Platforms and Interactive Experiences',
    category: 'interactive',
    tagline: 'Engaging real-time collaboration tools, data visualizers, and web platforms.',
    description: 'Cross-platform interactive applications featuring live state synchronization, real-time collaboration canvas engines, responsive data analytics, and interactive client review rooms.',
    deliverables: [
      'Real-Time Collaborative Web Workspaces',
      'Interactive Architectural & 3D Web Viewports',
      'Data Visualization & Executive Analytics Hubs',
      'Progressive Web Apps (PWAs) with Offline Caching'
    ],
    technologies: ['WebSockets', 'Canvas API', 'WebGL / Three.js', 'Service Workers', 'IndexedDB'],
    visualType: 'platform',
    status: 'Proposed Specification'
  },
  {
    id: 'gaming-interactive-technology',
    number: '10',
    title: 'Gaming and Interactive Technology',
    category: 'interactive',
    tagline: 'Immersive simulations, gamified training, and interactive 3D environments.',
    description: 'Real-time 2D and 3D interactive graphics engineering for enterprise simulations, gamified corporate training modules, virtual exhibits, and interactive browser experiences.',
    deliverables: [
      'Interactive 3D Web Experiences & Virtual Showrooms',
      'Gamified Training & Educational Simulation Engines',
      'Real-Time Spatial Assets & Shader Pipelines',
      'Cross-Platform WebGL Interactive Prototypes'
    ],
    technologies: ['Three.js', 'GLSL Shaders', 'WebAudio API', 'Phaser', 'Blender Asset Pipelines'],
    visualType: 'game',
    status: 'Proposed Specification'
  },
  {
    id: 'broadcast-streaming-solutions',
    number: '11',
    title: 'Broadcast and Streaming Solutions',
    category: 'interactive',
    tagline: 'Ultra-low-latency streaming, virtual broadcast studios, and live event pipelines.',
    description: 'Broadcast engineering setups combining multi-camera live video ingest, RTMP/SRT streaming pipelines, virtual production backgrounds, and multi-destination streaming syndication.',
    deliverables: [
      'Multi-Destination Live Stream Ingest & Playout',
      'Virtual Studio Keying & Digital Set Extensions',
      'Ultra-Low Latency WebRTC Video Distribution',
      'Broadcast Monitoring & Redundant Transmission Systems'
    ],
    technologies: ['OBS Studio / vMix', 'SRT / RTMP Protocols', 'WebRTC', 'Blackmagic ATEM Hardware', 'NDI Over IP'],
    visualType: 'broadcast',
    status: 'Proposed Specification'
  },
  {
    id: 'technology-consulting',
    number: '12',
    title: 'Technology Consulting',
    category: 'software',
    tagline: 'Strategic enterprise architecture, technical due diligence, and modernization.',
    description: 'Senior architectural advisory for organizations planning high-scale digital transformations: security posture hardening, cloud migration roadmaps, AI workforce integration, and audit reviews.',
    deliverables: [
      'Enterprise Architecture & Infrastructure Audits',
      'AI Strategy & Agent Deployment Roadmaps',
      'Security Compliance & RBAC Review Reports',
      'Technology Stack Selection & Cost Optimization'
    ],
    technologies: ['Cloud Architecture Frameworks', 'SOC2 / ISO 27001 Standards', 'System Invariant Modeling'],
    visualType: 'consulting',
    status: 'Proposed Specification'
  }
];
