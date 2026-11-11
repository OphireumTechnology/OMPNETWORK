import { AIAgentRole } from '../types';

export const aiAgentsData: AIAgentRole[] = [
  {
    id: 'agent-req',
    name: 'Requirements Analyst',
    code: 'AGT-01-REQ',
    focus: 'User Story Synthesis & Scope Boundary Formulation',
    capabilities: ['Translates executive briefs into functional specs', 'Extracts acceptance criteria & edge cases', 'Enforces strict scope constraints'],
    status: 'Active',
    icon: 'FileText'
  },
  {
    id: 'agent-arch',
    name: 'Solution Architect',
    code: 'AGT-02-ARCH',
    focus: 'System Invariants & Data Flow Design',
    capabilities: ['Defines modular service boundaries', 'Formulates entity relationships & interfaces', 'Validates non-functional invariants'],
    status: 'Active',
    icon: 'Layers'
  },
  {
    id: 'agent-uiux',
    name: 'UI/UX Designer',
    code: 'AGT-03-UIUX',
    focus: 'Design Systems & Ergonomic Layouts',
    capabilities: ['Generates cohesive design tokens & typographic scales', 'Enforces accessibility & WCAG AA contrast', 'Designs responsive spatial hierarchies'],
    status: 'Active',
    icon: 'Palette'
  },
  {
    id: 'agent-fe',
    name: 'Frontend Developer',
    code: 'AGT-04-FED',
    focus: 'React 19 & TypeScript Component Architecture',
    capabilities: ['Assembles component trees with strict typing', 'Implements micro-interactions & responsive states', 'Eliminates layout shifts & dead clicks'],
    status: 'Active',
    icon: 'Code'
  },
  {
    id: 'agent-be',
    name: 'Backend Developer',
    code: 'AGT-05-BED',
    focus: 'Secure APIs, State Engines & Microservices',
    capabilities: ['Engineers authenticated endpoints (Node.js/Express)', 'Enforces input validation & rate limits', 'Manages session lifecycles'],
    status: 'Active',
    icon: 'Server'
  },
  {
    id: 'agent-db',
    name: 'Database Engineer',
    code: 'AGT-06-DBE',
    focus: 'PostgreSQL Schemas & Data Normalization',
    capabilities: ['Authors migrations & Drizzle ORM schemas', 'Designs indexing strategies & query performance', 'Enforces foreign key integrity'],
    status: 'Active',
    icon: 'Database'
  },
  {
    id: 'agent-qa',
    name: 'QA Testing Agent',
    code: 'AGT-07-QAT',
    focus: 'Automated Test Suites & Regression Verification',
    capabilities: ['Generates unit & integration tests', 'Simulates edge conditions & fault injection', 'Reports test coverage metrics'],
    status: 'Supervised',
    icon: 'CheckCircle'
  },
  {
    id: 'agent-sec',
    name: 'Security Review Agent',
    code: 'AGT-08-SEC',
    focus: 'Vulnerability Scanning & RBAC Verification',
    capabilities: ['Audits authentication tokens & CORS policies', 'Inspects code for secret leaks & injection flaws', 'Enforces least-privilege principles'],
    status: 'Active',
    icon: 'ShieldCheck'
  },
  {
    id: 'agent-ops',
    name: 'DevOps Agent',
    code: 'AGT-09-OPS',
    focus: 'GitHub Actions & Container Deployment',
    capabilities: ['Maintains build pipelines & Dockerfiles', 'Configures preview environments', 'Executes automated health checks'],
    status: 'Supervised',
    icon: 'Terminal'
  },
  {
    id: 'agent-doc',
    name: 'Documentation Agent',
    code: 'AGT-10-DOC',
    focus: 'API References, System Blueprints & Manuals',
    capabilities: ['Maintains live OpenAPI specs', 'Documents architecture change records', 'Publishes user & client manuals'],
    status: 'Standby',
    icon: 'BookOpen'
  },
  {
    id: 'agent-coord',
    name: 'Project Coordination Agent',
    code: 'AGT-11-PRJ',
    focus: 'Task Orchestration & Milestone Dependencies',
    capabilities: ['Synchronizes work orders across agents', 'Tracks deliverable deadlines', 'Flags blocking dependencies'],
    status: 'Active',
    icon: 'Compass'
  },
  {
    id: 'agent-mon',
    name: 'Monitoring & Incident Agent',
    code: 'AGT-12-MON',
    focus: 'Telemetry Observation & Emergency Stop Enforcement',
    capabilities: ['Monitors runtime health & error budgets', 'Triggers human intervention when invariants fail', 'Maintains incident audit trail'],
    status: 'Active',
    icon: 'Activity'
  }
];
