import { PortfolioItem } from '../types';

export const portfolioData: PortfolioItem[] = [
  {
    id: 'ophireum-network-platform',
    title: 'Ophireum Network Platform Architecture',
    category: 'Enterprise Software & Cloud',
    tagline: 'Multi-tenant enterprise foundation uniting creative assets, client portals, and automated deployment.',
    description: 'A modular, high-security enterprise platform foundation engineered for multimedia asset distribution, fine-grained RBAC permissioning, audit-logged client interactions, and continuous cloud deployment.',
    clientType: 'Enterprise Framework Specification',
    deliverables: [
      'Role-Based Access Control (Super Admin, Client, Reviewer)',
      'High-Throughput Media File Storage & Previewing',
      'Automated GitHub Actions CI/CD Pipeline Configuration',
      'Real-Time Project Milestone Tracking Module'
    ],
    technologies: ['React 19', 'TypeScript', 'Tailwind CSS', 'Node.js', 'PostgreSQL', 'Docker'],
    status: 'Enterprise Blueprint',
    imagePlaceholderGradient: 'from-[#0B1220] via-[#111827] to-[#00C2C7]/30',
    year: '2026'
  },
  {
    id: 'cinetech-aces-pipeline',
    title: 'CineTech 8K ACES Post-Production Suite',
    category: 'Multimedia & Cinema',
    tagline: 'Color-calibrated digital intermediate and multi-track audio mastering pipeline.',
    description: 'Engineered post-production assembly protocol designed for high-bitrate RAW footage ingest, ACES color managed pipeline, spatial dialogue mixdown, and multi-format delivery mastering.',
    clientType: 'Production Workflow Framework',
    deliverables: [
      'Standardized RAW to ACES Proxy Workflows',
      'Color Calibration Target Profiles (Rec.709, DCI-P3, HDR10)',
      'Multi-Stem Broadcast Audio Mastering Standards',
      'LTO Archive & Secure Asset Storage Strategy'
    ],
    technologies: ['DaVinci Resolve Studio', 'Pro Tools Ultimate', 'ACES 1.3', '10GbE NAS Network'],
    status: 'Verified Showcase',
    imagePlaceholderGradient: 'from-[#111827] via-[#0B1220] to-[#D4AF37]/30',
    year: '2026'
  },
  {
    id: 'agentic-ai-command-matrix',
    title: 'Agentic AI Workforce Command Matrix',
    category: 'Artificial Intelligence & Automation',
    tagline: 'Twelve-agent synchronized pipeline for automated requirements, testing, and security auditing.',
    description: 'Server-side orchestration architecture coordinating specialized AI agents across software development life cycles: from natural-language specification to UI rendering, unit test generation, and pull request audits.',
    clientType: 'Ophireum Intelligence Initiative',
    deliverables: [
      '12 Role-Specific Agent Prompts & Context Constraints',
      'Safe Server-Side LLM Proxy Adapter (@google/genai)',
      'Continuous Security Review & Invariant Verification Agent',
      'Auditable Human-in-the-Loop Approval Gateways'
    ],
    technologies: ['@google/genai SDK', 'TypeScript', 'Express', 'Vector Embeddings', 'GitHub Webhooks'],
    status: 'Enterprise Blueprint',
    imagePlaceholderGradient: 'from-[#081528] via-[#00C2C7]/20 to-[#0B1220]',
    year: '2026'
  },
  {
    id: 'pampanga-spatial-3d-archive',
    title: 'Mabalacat Cultural & Spatial 3D Archive',
    category: 'Interactive Technology & 3D',
    tagline: 'Interactive WebGL spatial preservation showcase celebrating Pampanga heritage and architecture.',
    description: 'An interactive browser-based 3D environment featuring photogrammetric scans and architectural models of heritage locations in Mabalacat City, Pampanga, optimized for 60fps mobile and desktop playback.',
    clientType: 'Heritage & Spatial Research Prototype',
    deliverables: [
      'Low-Poly Photogrammetry Optimization Pipeline',
      'Three.js / WebGL Spatial Camera Navigation',
      'Interactive Historical Architectural Hotspots',
      'Responsive Touch Controls for Mobile Browsers'
    ],
    technologies: ['Three.js', 'WebGL', 'GLTF/DRACO Compression', 'Tailwind CSS', 'Vite'],
    status: 'Verified Showcase',
    imagePlaceholderGradient: 'from-[#111827] via-[#D4AF37]/20 to-[#00C2C7]/20',
    year: '2026'
  },
  {
    id: 'ultrastream-broadcast-cluster',
    title: 'UltraStream Hybrid Broadcast Cluster',
    category: 'Broadcast & Streaming',
    tagline: 'Multi-camera low-latency remote video mixing and SRT broadcast syndication infrastructure.',
    description: 'A hybrid cloud and on-premise broadcast architecture delivering synchronised multi-camera feeds with under 200ms transport latency, real-time lower thirds, and redundant cloud distribution.',
    clientType: 'Broadcast Engineering Blueprint',
    deliverables: [
      'Redundant SRT Transmission Links with Automatic Failover',
      'WebRTC Multi-Viewer Remote Director Feed',
      'Dynamic HTML5 Broadcast Graphic Overlays',
      'Automated Cloud Recording & Instant Replay Archiving'
    ],
    technologies: ['SRT Protocol', 'WebRTC', 'Blackmagic Design Hardware', 'Node.js', 'FFmpeg'],
    status: 'Production Architecture',
    imagePlaceholderGradient: 'from-[#0B1220] via-[#111827] to-[#00C2C7]/30',
    year: '2026'
  }
];
