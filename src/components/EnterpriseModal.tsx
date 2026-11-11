import React, { useState, useEffect } from 'react';
import { aiAgentsData } from '../data/aiAgentsData';
import { 
  X, Shield, Cpu, Code2, Users, LayoutDashboard, 
  CheckCircle2, Clock, Terminal, GitBranch, Key, Activity,
  Lock, ArrowRight, RefreshCw, Send, Layers
} from 'lucide-react';

interface EnterpriseModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'portal' | 'studio' | 'agents' | 'admin';
}

export const EnterpriseModal: React.FC<EnterpriseModalProps> = ({ isOpen, onClose, defaultTab = 'portal' }) => {
  const [activeTab, setActiveTab] = useState<'portal' | 'studio' | 'agents' | 'admin'>(defaultTab);
  const [recentInquiries, setRecentInquiries] = useState<any[]>([]);
  const [promptInput, setPromptInput] = useState('');
  const [studioGenerating, setStudioGenerating] = useState(false);
  const [studioOutput, setStudioOutput] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    if (isOpen) {
      try {
        const stored = JSON.parse(localStorage.getItem('opm_inquiries') || '[]');
        setRecentInquiries(stored);
      } catch (e) {
        setRecentInquiries([]);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRunStudioSimulation = () => {
    if (!promptInput.trim()) return;
    setStudioGenerating(true);
    setTimeout(() => {
      setStudioGenerating(false);
      setStudioOutput(`// Ophireum AI Studio Generated Component\n// Prompt: "${promptInput}"\n\nimport React from 'react';\n\nexport const EnterpriseView: React.FC = () => {\n  return (\n    <section className="bg-slate-950 p-8 rounded-2xl border border-cyan-500/30">\n      <h2 className="text-xl font-bold text-white">Dynamic Production Engine</h2>\n      <p className="text-sm text-slate-400 mt-2">Verified Component Blueprint synthesized by Ophireum AI Agent AGT-04-FED</p>\n    </section>\n  );\n};`);
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md">
      <div className="relative w-full max-w-6xl max-h-[92vh] bg-[#0B1220] border border-slate-700 rounded-2xl flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Top Bar */}
        <div className="px-5 py-4 bg-[#111827] border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full p-0.5 bg-gradient-to-tr from-[#D4AF37] via-[#00C2C7] to-[#C0C7D1]">
              <img
                src="/assets/aistudio/OPHIREUM_Logo_6504e623.png"
                alt="OPM Emblem"
                className="w-full h-full object-contain rounded-full bg-[#111827]"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider">OPHIREUM NETWORK</span>
                <span className="text-[10px] font-mono text-[#00C2C7] bg-[#00C2C7]/10 px-2 py-0.5 rounded border border-[#00C2C7]/30">
                  ENTERPRISE PLATFORM ARCHITECTURE
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Integrated Systems Workspace (Phase 2-7 Architectural Blueprint)</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation Controls */}
        <div className="px-5 py-2.5 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center gap-2 text-xs">
          <button
            onClick={() => setActiveTab('portal')}
            className={`px-3.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'portal'
                ? 'bg-[#00C2C7] text-[#0B1220] font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Client Portal</span>
            <span className="text-[10px] opacity-75 font-mono">PHASE 2</span>
          </button>

          <button
            onClick={() => setActiveTab('studio')}
            className={`px-3.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'studio'
                ? 'bg-[#00C2C7] text-[#0B1220] font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>AI Website & Software Studio</span>
            <span className="text-[10px] opacity-75 font-mono">PHASE 3</span>
          </button>

          <button
            onClick={() => setActiveTab('agents')}
            className={`px-3.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'agents'
                ? 'bg-[#00C2C7] text-[#0B1220] font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>AI Agent Workforce (12 Roles)</span>
            <span className="text-[10px] opacity-75 font-mono">PHASE 5/7</span>
          </button>

          <button
            onClick={() => setActiveTab('admin')}
            className={`px-3.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'admin'
                ? 'bg-[#00C2C7] text-[#0B1220] font-semibold'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <LayoutDashboard className="w-3.5 h-3.5" />
            <span>Super Administrator Control</span>
            <span className="text-[10px] opacity-75 font-mono">PHASE 9</span>
          </button>
        </div>

        {/* Modal Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6">

          {/* TAB 1: CLIENT PORTAL WORKSPACE */}
          {activeTab === 'portal' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-mono text-[#00C2C7] uppercase">Enterprise Client Portal Specification</span>
                  <h3 className="text-lg font-bold text-white mt-0.5">Authorized Client Workspace</h3>
                  <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                    Tenants log in with MFA-protected credentials to track deliverables, approve milestone sign-offs, inspect high-bitrate video review links, and process invoicing.
                  </p>
                </div>
                <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                  <Lock className="w-3.5 h-3.5 text-[#00C2C7]" />
                  <span>Tenant Isolation: Active</span>
                </div>
              </div>

              {/* Mock Milestone Tracker */}
              <div className="rounded-xl bg-[#111827] border border-slate-800 p-5">
                <h4 className="text-xs font-mono uppercase text-slate-400 mb-4">Live Assignment Milestones (Demo Tenant: Clark Aero Dynamics)</h4>
                <div className="space-y-4">
                  
                  <div className="p-4 rounded-lg bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-xs font-semibold text-white">Phase 1: Creative Concept & Screenplay Treatment</span>
                        <p className="text-[11px] text-slate-400">Validated by Creative Director · Deliverable Approved</p>
                      </div>
                    </div>
                    <span className="text-xs font-mono text-emerald-400 font-medium">Completed & Signed</span>
                  </div>

                  <div className="p-4 rounded-lg bg-slate-900/90 border border-[#00C2C7]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <Clock className="w-5 h-5 text-[#00C2C7] shrink-0 mt-0.5" />
                      <div>
                        <span className="text-xs font-semibold text-white">Phase 2: 4K Cinema Capture & Drone Orthomapping</span>
                        <p className="text-[11px] text-slate-400">Footage ingested into ACES suite · Proxy generation ready</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-[#00C2C7] font-medium">In Progress (85%)</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-slate-900/40 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 opacity-75">
                    <div className="flex items-start gap-3">
                      <Clock className="w-5 h-5 text-slate-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-xs font-semibold text-slate-300">Phase 3: Color Master & Enterprise Portal Deployment</span>
                        <p className="text-[11px] text-slate-500">Scheduled upon completion of Phase 2 milestone</p>
                      </div>
                    </div>
                    <span className="text-xs font-mono text-slate-500">Pending Dependency</span>
                  </div>

                </div>
              </div>

              {/* File Sharing & Support Ticket Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="p-5 rounded-xl bg-[#111827] border border-slate-800">
                  <h4 className="text-xs font-mono uppercase text-slate-400 mb-2">Secure Media Review Vault</h4>
                  <p className="text-xs text-slate-300 mb-3">Timecode-commented video player with frame-accurate review.</p>
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                    <span>OPM_ACES_RoughCut_v03.mov</span>
                    <span className="text-[#00C2C7] font-mono">1.8 GB · Reviewable</span>
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-[#111827] border border-slate-800">
                  <h4 className="text-xs font-mono uppercase text-slate-400 mb-2">Change Requests & Support Tickets</h4>
                  <p className="text-xs text-slate-300 mb-3">Direct pipeline to project coordinators and solution architects.</p>
                  <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                    <span>Active Ticket: #CR-882 (Color grading tone adjustment)</span>
                    <span className="text-[#D4AF37] font-mono">Under Review</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: AI WEBSITE & APPLICATION BUILDER */}
          {activeTab === 'studio' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[11px] font-mono text-[#00C2C7] uppercase">Ophireum AI Studio Specification</span>
                <h3 className="text-lg font-bold text-white mt-0.5">Natural-Language Website & Application Builder</h3>
                <p className="text-xs text-slate-300 mt-1">
                  Engineered to synthesize React 19 components, configure responsive layouts, manage design tokens, and push verified code directly to GitHub.
                </p>
              </div>

              {/* Natural Language Prompt Interactive Testbed */}
              <div className="rounded-xl bg-[#111827] border border-slate-800 p-5 space-y-4">
                <label className="block text-xs font-mono text-slate-400 uppercase">
                  Prompt-To-Code Generator Simulator
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promptInput}
                    onChange={(e) => setPromptInput(e.target.value)}
                    placeholder="e.g. Build a high-performance video gallery component with ACES metadata..."
                    className="flex-1 px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00C2C7]"
                  />
                  <button
                    onClick={handleRunStudioSimulation}
                    disabled={studioGenerating || !promptInput.trim()}
                    className="px-4 py-2.5 text-xs font-semibold text-[#0B1220] bg-[#00C2C7] hover:bg-[#00d6dc] disabled:opacity-50 rounded-lg flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    {studioGenerating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span>Generate Component</span>
                  </button>
                </div>

                {studioOutput && (
                  <div className="mt-4 p-4 rounded-lg bg-slate-950 border border-slate-800 font-mono text-xs text-[#00C2C7] overflow-x-auto">
                    <pre>{studioOutput}</pre>
                  </div>
                )}
              </div>

              {/* Studio Capabilities Overview */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-[#111827] border border-slate-800">
                  <span className="text-xs font-semibold text-white block">React 19 & Tailwind</span>
                  <p className="text-[11px] text-slate-400 mt-1">Strict TypeScript interfaces, semantic markup, and zero-pill discipline.</p>
                </div>
                <div className="p-4 rounded-xl bg-[#111827] border border-slate-800">
                  <span className="text-xs font-semibold text-white block">GitHub CI/CD Push</span>
                  <p className="text-[11px] text-slate-400 mt-1">Automated branch creation, pull request generation, and preview hosting.</p>
                </div>
                <div className="p-4 rounded-xl bg-[#111827] border border-slate-800">
                  <span className="text-xs font-semibold text-white block">Audit & Test Gate</span>
                  <p className="text-[11px] text-slate-400 mt-1">QA Testing Agent and Security Review Agent verify before merge.</p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AI AGENT WORKFORCE (12 ROLES) */}
          {activeTab === 'agents' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-mono text-[#00C2C7] uppercase">Autonomous Workforce Architecture</span>
                  <h3 className="text-lg font-bold text-white mt-0.5">12 Specialized AI Development Agents</h3>
                  <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                    Operating through server-side adapters (@google/genai SDK) within strict permission boundaries, human approval gates, and immutable audit logs.
                  </p>
                </div>
                <div className="hidden sm:block text-right">
                  <span className="text-xs font-mono text-emerald-400">10 Active · 2 Supervised</span>
                </div>
              </div>

              {/* 12 Agents Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {aiAgentsData.map((agent) => (
                  <div key={agent.id} className="p-4 rounded-xl bg-[#111827] border border-slate-800 flex flex-col justify-between space-y-3">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-[#00C2C7] bg-[#00C2C7]/10 px-2 py-0.5 rounded border border-[#00C2C7]/30">
                          {agent.code}
                        </span>
                        <span className={`text-[10px] font-mono ${agent.status === 'Active' ? 'text-emerald-400' : 'text-[#D4AF37]'}`}>
                          ● {agent.status}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white mt-2">{agent.name}</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">{agent.focus}</p>
                    </div>

                    <div className="pt-2 border-t border-slate-800/80 space-y-1">
                      {agent.capabilities.map((cap, i) => (
                        <div key={i} className="text-[11px] text-slate-400 flex items-start gap-1.5">
                          <span className="text-[#00C2C7]">·</span>
                          <span className="truncate">{cap}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: SUPER ADMINISTRATOR CONTROL */}
          {activeTab === 'admin' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[11px] font-mono text-[#00C2C7] uppercase">Executive Governance Suite</span>
                <h3 className="text-lg font-bold text-white mt-0.5">Super Administrator Operations Center</h3>
                <p className="text-xs text-slate-300 mt-1">
                  Centralized command console for client organizations, live brief queues, billing statuses, and system audit logs.
                </p>
              </div>

              {/* Live Inquiries Table */}
              <div className="rounded-xl bg-[#111827] border border-slate-800 p-5">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-xs font-mono uppercase text-slate-400">Incoming Project Inquiries & Briefs</h4>
                  <span className="text-xs font-mono text-[#00C2C7]">{recentInquiries.length} Inquiries Logged</span>
                </div>

                {recentInquiries.length === 0 ? (
                  <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
                    No inquiries submitted yet. Submit a brief in the Contact section to see real-time dispatch logging here.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                          <th className="pb-2">TICKET REF</th>
                          <th className="pb-2">NAME & COMPANY</th>
                          <th className="pb-2">SERVICE</th>
                          <th className="pb-2">BUDGET</th>
                          <th className="pb-2">STATUS</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80">
                        {recentInquiries.map((inq, idx) => (
                          <tr key={idx} className="text-slate-300">
                            <td className="py-2.5 font-mono text-[#00C2C7]">{inq.referenceId}</td>
                            <td className="py-2.5">
                              <span className="font-semibold text-white block">{inq.fullName}</span>
                              <span className="text-slate-400 text-[11px]">{inq.company}</span>
                            </td>
                            <td className="py-2.5 max-w-[180px] truncate">{inq.serviceTitle}</td>
                            <td className="py-2.5 font-mono text-slate-400">{inq.estimatedBudget}</td>
                            <td className="py-2.5">
                              <span className="text-[10px] font-mono text-[#D4AF37] bg-[#D4AF37]/10 px-2 py-0.5 rounded border border-[#D4AF37]/30">
                                {inq.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Health Metrics Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-[#111827] border border-slate-800">
                  <span className="text-[11px] font-mono text-slate-400 block uppercase">SYSTEM HEALTH</span>
                  <span className="text-lg font-bold text-emerald-400 mt-1 block">Optimal</span>
                  <span className="text-[10px] text-slate-500">All services responsive</span>
                </div>
                <div className="p-4 rounded-xl bg-[#111827] border border-slate-800">
                  <span className="text-[11px] font-mono text-slate-400 block uppercase">DATABASE STATUS</span>
                  <span className="text-lg font-bold text-white mt-1 block">PostgreSQL</span>
                  <span className="text-[10px] text-slate-500">Tenant isolated tables</span>
                </div>
                <div className="p-4 rounded-xl bg-[#111827] border border-slate-800">
                  <span className="text-[11px] font-mono text-slate-400 block uppercase">GITHUB ACTIONS</span>
                  <span className="text-lg font-bold text-white mt-1 block">CI Passing</span>
                  <span className="text-[10px] text-slate-500">Automated build checks</span>
                </div>
                <div className="p-4 rounded-xl bg-[#111827] border border-slate-800">
                  <span className="text-[11px] font-mono text-slate-400 block uppercase">MODEL ADAPTER</span>
                  <span className="text-lg font-bold text-[#00C2C7] mt-1 block">@google/genai</span>
                  <span className="text-[10px] text-slate-500">Server-side proxy ready</span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Bottom Actions */}
        <div className="px-5 py-3.5 bg-[#111827] border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>Enterprise Platform Specification · Governed by Ophireum Network Master Directive</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            Close Suite Preview
          </button>
        </div>

      </div>
    </div>
  );
};
