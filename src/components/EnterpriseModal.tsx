import React, { useState, useEffect } from 'react';
import { aiAgentsData } from '../data/aiAgentsData';
import { 
  X, Shield, Cpu, Code2, Users, LayoutDashboard, 
  CheckCircle2, Clock, Terminal, GitBranch, Key, Activity,
  Lock, ArrowRight, RefreshCw, Send, Layers, Phone, MapPin, Building,
  Calendar, Video, FileCheck, ExternalLink, FileText
} from 'lucide-react';
import { AIProcessingVisualizer } from './animations/AIProcessingVisualizer';
import { COMPANY_CONFIG } from '../data/companyConfig';
import { supabaseService, AppointmentRecord, ProjectBrief } from '../services/supabaseService';

interface EnterpriseModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'portal' | 'studio' | 'agents' | 'admin';
}

export const EnterpriseModal: React.FC<EnterpriseModalProps> = ({ isOpen, onClose, defaultTab = 'portal' }) => {
  const [activeTab, setActiveTab] = useState<'portal' | 'studio' | 'agents' | 'admin'>(defaultTab);
  const [adminSubTab, setAdminSubTab] = useState<'appointments' | 'briefs' | 'inquiries'>('appointments');
  const [recentInquiries, setRecentInquiries] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<AppointmentRecord[]>([]);
  const [projectBriefs, setProjectBriefs] = useState<ProjectBrief[]>([]);
  const [promptInput, setPromptInput] = useState('');
  const [studioGenerating, setStudioGenerating] = useState(false);
  const [studioOutput, setStudioOutput] = useState<string | null>(null);

  const loadAdminData = () => {
    try {
      const stored = JSON.parse(localStorage.getItem('opm_inquiries') || '[]');
      setRecentInquiries(stored);
    } catch (e) {
      setRecentInquiries([]);
    }
    const appts = supabaseService.getLocalAppointments();
    setAppointments(appts);
    const briefs = supabaseService.getLocalBriefs();
    setProjectBriefs(briefs);
  };

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    if (isOpen) {
      loadAdminData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRunStudioSimulation = () => {
    if (!promptInput.trim()) return;
    setStudioGenerating(true);
    setTimeout(() => {
      setStudioGenerating(false);
      setStudioOutput(`// Ophireum AI Studio Generated Component\n// Synthesis Engine: @google/genai Model Adapter\n// Prompt: "${promptInput}"\n\nimport React from 'react';\n\nexport const EnterpriseView: React.FC = () => {\n  return (\n    <section className="bg-slate-950 p-8 rounded-2xl border border-cyan-500/30 shadow-2xl">\n      <h2 className="text-xl font-bold text-white tracking-tight">Ophireum Distributed Media Hub</h2>\n      <p className="text-sm text-slate-400 mt-2">Verified Component Blueprint synthesized by Ophireum AI Agent AGT-04-FED</p>\n      <div className="mt-4 flex gap-2 font-mono text-xs text-cyan-400">\n        <span>LATENCY: &lt; 12ms</span>\n        <span>·</span>\n        <span>ACES REC.709 COLOR</span>\n      </div>\n    </section>\n  );\n};`);
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md">
      <div className="relative w-full max-w-6xl max-h-[92vh] bg-[#0B1220] border border-slate-700 rounded-2xl flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Top Bar */}
        <div className="px-5 py-4 bg-[#111827] border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full p-0.5 bg-gradient-to-tr from-[#D4AF37] via-[#00C2C7] to-[#C0C7D1]">
              <img
                src={COMPANY_CONFIG.logoUrl}
                alt=""
                aria-hidden="true"
                className="w-full h-full object-contain rounded-full bg-[#111827]"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-white uppercase tracking-wider">{COMPANY_CONFIG.platformName}</span>
                <span className="text-[10px] font-mono text-[#00C2C7] bg-[#00C2C7]/10 px-2 py-0.5 rounded border border-[#00C2C7]/30">
                  ENTERPRISE PLATFORM ARCHITECTURE
                </span>
              </div>
              <p className="text-[11px] text-slate-400">Headquarters: {COMPANY_CONFIG.address.zone}</p>
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
                ? 'bg-[#00C2C7] text-[#0B1220] font-semibold shadow-sm'
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
                ? 'bg-[#00C2C7] text-[#0B1220] font-semibold shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>AI Development Studio</span>
            <span className="text-[10px] opacity-75 font-mono">PHASE 3</span>
          </button>

          <button
            onClick={() => setActiveTab('agents')}
            className={`px-3.5 py-1.5 rounded-lg font-medium transition-colors cursor-pointer flex items-center gap-2 whitespace-nowrap ${
              activeTab === 'agents'
                ? 'bg-[#00C2C7] text-[#0B1220] font-semibold shadow-sm'
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
                ? 'bg-[#00C2C7] text-[#0B1220] font-semibold shadow-sm'
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
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-start justify-between flex-wrap gap-4">
                <div>
                  <span className="text-[11px] font-mono text-[#00C2C7] uppercase">Enterprise Client Portal Specification</span>
                  <h3 className="text-lg font-bold text-white mt-0.5">Authorized Client Workspace</h3>
                  <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                    Tenants log in with MFA-protected credentials to track deliverables, approve milestone sign-offs, inspect high-bitrate video review links, and communicate directly with project coordinators.
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                  <Lock className="w-3.5 h-3.5 text-[#00C2C7]" />
                  <span>Tenant Isolation: Active</span>
                </div>
              </div>

              {/* Mock Milestone Tracker */}
              <div className="rounded-xl bg-[#111827] border border-slate-800 p-5">
                <h4 className="text-xs font-mono uppercase text-slate-400 mb-4">Live Assignment Milestones (Demo Client: Clark Aero Dynamics)</h4>
                <div className="space-y-3.5">
                  
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
                        <p className="text-[11px] text-slate-400">Ingested at KMC One West Aeropark post-production suite · Proxy ready</p>
                      </div>
                    </div>
                    <span className="text-xs font-mono text-[#00C2C7] font-medium">In Progress (85%)</span>
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

              {/* Direct Support Lead & Office Card */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="p-5 rounded-xl bg-[#111827] border border-slate-800 space-y-2">
                  <h4 className="text-xs font-mono uppercase text-slate-400">Dedicated Production Lead</h4>
                  <div className="text-sm font-bold text-white">{COMPANY_CONFIG.founderCeo}</div>
                  <a href={COMPANY_CONFIG.mobileLink} className="text-xs font-mono text-[#00C2C7] hover:underline flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5" />
                    <span>{COMPANY_CONFIG.mobile}</span>
                  </a>
                  <p className="text-xs text-slate-400 pt-1">
                    Direct executive line for priority project escalations and change requests.
                  </p>
                </div>

                <div className="p-5 rounded-xl bg-[#111827] border border-slate-800 space-y-2">
                  <h4 className="text-xs font-mono uppercase text-slate-400">Physical Studio Location</h4>
                  <div className="text-sm font-bold text-white">{COMPANY_CONFIG.address.line1}</div>
                  <div className="text-xs text-slate-300">{COMPANY_CONFIG.address.zone}</div>
                  <a
                    href={COMPANY_CONFIG.address.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#00C2C7] hover:underline flex items-center gap-1 pt-1"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>Open Maps Navigation</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: AI DEVELOPMENT STUDIO */}
          {activeTab === 'studio' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[11px] font-mono text-[#00C2C7] uppercase">Ophireum AI Studio Specification</span>
                <h3 className="text-lg font-bold text-white mt-0.5">Natural-Language Website & Application Builder</h3>
                <p className="text-xs text-slate-300 mt-1">
                  Engineered to synthesize React 19 components, configure responsive layouts, manage design tokens, and push verified code directly to GitHub.
                </p>
              </div>

              {/* Embedded Neural Visualizer */}
              <div className="rounded-xl bg-slate-950 border border-slate-800 overflow-hidden">
                <AIProcessingVisualizer className="w-full h-44" />
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
                  Centralized command console for client organizations, live brief queues, billing records, and system audit logs.
                </p>
              </div>

              {/* Consultations & Inquiries Command Center */}
              <div className="rounded-xl bg-[#111827] border border-slate-800 p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setAdminSubTab('appointments')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                        adminSubTab === 'appointments'
                          ? 'bg-[#00C2C7] text-[#0B1220] font-bold shadow'
                          : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
                      }`}
                    >
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Consultation Appointments ({appointments.length})</span>
                    </button>

                    <button
                      onClick={() => setAdminSubTab('briefs')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                        adminSubTab === 'briefs'
                          ? 'bg-[#00C2C7] text-[#0B1220] font-bold shadow'
                          : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
                      }`}
                    >
                      <FileCheck className="w-3.5 h-3.5" />
                      <span>Project Briefs ({projectBriefs.length})</span>
                    </button>

                    <button
                      onClick={() => setAdminSubTab('inquiries')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                        adminSubTab === 'inquiries'
                          ? 'bg-[#00C2C7] text-[#0B1220] font-bold shadow'
                          : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-800'
                      }`}
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Web Inquiries ({recentInquiries.length})</span>
                    </button>
                  </div>

                  <button
                    onClick={loadAdminData}
                    className="p-1.5 text-slate-400 hover:text-[#00C2C7] bg-slate-900 hover:bg-slate-800 rounded-lg border border-slate-800 transition-colors cursor-pointer flex items-center gap-1 text-[11px] font-mono"
                    title="Refresh data"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Sync</span>
                  </button>
                </div>

                {/* SUBTAB 1: CONSULTATION APPOINTMENTS */}
                {adminSubTab === 'appointments' && (
                  <div>
                    {appointments.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
                        No client consultation appointments booked yet. Clients can book sessions via the floating AI Solutions Consultant or services cards.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                              <th className="pb-2">APPOINTMENT REF</th>
                              <th className="pb-2">CLIENT & ORG</th>
                              <th className="pb-2">DATE & SLOT</th>
                              <th className="pb-2">TYPE</th>
                              <th className="pb-2">STATUS</th>
                              <th className="pb-2 text-right">CALENDAR SYNC</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/80">
                            {appointments.map((appt) => (
                              <tr key={appt.id || appt.referenceCode} className="text-slate-300">
                                <td className="py-2.5 font-mono text-[#00C2C7] font-semibold">{appt.referenceCode}</td>
                                <td className="py-2.5">
                                  <span className="font-semibold text-white block">{appt.client?.fullName || 'Client'}</span>
                                  <span className="text-slate-400 text-[11px]">
                                    {appt.client?.companyName || 'Independent'} · {appt.client?.email || 'N/A'}
                                  </span>
                                </td>
                                <td className="py-2.5">
                                  <span className="text-white font-medium block">{appt.scheduledDate}</span>
                                  <span className="text-slate-400 text-[11px] font-mono">{appt.scheduledTimeSlot} ({appt.clientTimezone})</span>
                                </td>
                                <td className="py-2.5">
                                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                                    {appt.consultationType}
                                  </span>
                                </td>
                                <td className="py-2.5">
                                  <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30">
                                    {appt.status.toUpperCase()}
                                  </span>
                                </td>
                                <td className="py-2.5 text-right">
                                  <a
                                    href={supabaseService.generateGoogleCalendarUrl(appt)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-[#00C2C7] text-slate-300 hover:text-[#0B1220] transition-colors text-[11px] font-mono"
                                  >
                                    <span>G-Cal</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* SUBTAB 2: PROJECT BRIEFS */}
                {adminSubTab === 'briefs' && (
                  <div>
                    {projectBriefs.length === 0 ? (
                      <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
                        No structured project briefs saved yet. Engage the AI Solutions Consultant to generate and store scoped enterprise briefs.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                              <th className="pb-2">BRIEF REF</th>
                              <th className="pb-2">CLIENT & ORG</th>
                              <th className="pb-2">CATEGORY / DISCIPLINE</th>
                              <th className="pb-2">SYNTHESIS DATE</th>
                              <th className="pb-2">STATUS</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/80">
                            {projectBriefs.map((brf, idx) => (
                              <tr key={idx} className="text-slate-300">
                                <td className="py-2.5 font-mono text-[#D4AF37] font-semibold">{brf.referenceCode}</td>
                                <td className="py-2.5">
                                  <span className="font-semibold text-white block">{brf.client.fullName}</span>
                                  <span className="text-slate-400 text-[11px]">{brf.client.companyName}</span>
                                </td>
                                <td className="py-2.5 text-white max-w-[200px] truncate">{brf.requirements.category}</td>
                                <td className="py-2.5 font-mono text-slate-400">
                                  {new Date(brf.createdAt).toLocaleDateString()}
                                </td>
                                <td className="py-2.5">
                                  <span className="text-[10px] font-mono text-[#00C2C7] bg-[#00C2C7]/10 px-2 py-0.5 rounded border border-[#00C2C7]/30">
                                    {brf.status?.toUpperCase() || 'DRAFT'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* SUBTAB 3: WEB INQUIRIES */}
                {adminSubTab === 'inquiries' && (
                  <div>
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
                )}
              </div>

              {/* Administrative Settings & Health Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-[#111827] border border-slate-800">
                  <span className="text-[11px] font-mono text-slate-400 block uppercase">DISPATCH ROUTE</span>
                  <span className="text-xs font-mono text-[#00C2C7] mt-1 block truncate">{COMPANY_CONFIG.configurableEmail}</span>
                  <span className="text-[10px] text-slate-500">Configurable company inbox</span>
                </div>
                <div className="p-4 rounded-xl bg-[#111827] border border-slate-800">
                  <span className="text-[11px] font-mono text-slate-400 block uppercase">EXECUTIVE LEAD</span>
                  <span className="text-xs font-semibold text-white mt-1 block">{COMPANY_CONFIG.founderCeo}</span>
                  <span className="text-[10px] text-slate-500">{COMPANY_CONFIG.mobile}</span>
                </div>
                <div className="p-4 rounded-xl bg-[#111827] border border-slate-800">
                  <span className="text-[11px] font-mono text-slate-400 block uppercase">GITHUB ACTIONS</span>
                  <span className="text-xs font-bold text-white mt-1 block">CI Passing</span>
                  <span className="text-[10px] text-slate-500">Automated build checks</span>
                </div>
                <div className="p-4 rounded-xl bg-[#111827] border border-slate-800">
                  <span className="text-[11px] font-mono text-slate-400 block uppercase">MODEL ADAPTER</span>
                  <span className="text-xs font-bold text-[#00C2C7] mt-1 block">@google/genai</span>
                  <span className="text-[10px] text-slate-500">Server-side proxy ready</span>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Bottom Actions */}
        <div className="px-5 py-3.5 bg-[#111827] border-t border-slate-800 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
          <span>Enterprise Platform Specification · Governed by {COMPANY_CONFIG.name}</span>
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
