import React, { useState, useEffect, useCallback } from 'react';
import { aiAgentsData } from '../data/aiAgentsData';
import {
  X,
  Shield,
  Cpu,
  Code2,
  LayoutDashboard,
  CheckCircle2,
  Clock,
  Lock,
  RefreshCw,
  Send,
  Phone,
  MapPin,
  Calendar,
  ExternalLink,
  LogOut,
  AlertCircle,
  FileCheck,
} from 'lucide-react';
import { AIProcessingVisualizer } from './animations/AIProcessingVisualizer';
import { COMPANY_CONFIG } from '../data/companyConfig';
import { apiUrl } from '../lib/apiClient';
import { navigateToPortalPath } from '../portal/PortalRouter';

interface EnterpriseModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'portal' | 'studio' | 'agents' | 'admin';
}

export const EnterpriseModal: React.FC<EnterpriseModalProps> = ({
  isOpen,
  onClose,
  defaultTab = 'portal',
}) => {
  const [activeTab, setActiveTab] = useState<'portal' | 'studio' | 'agents' | 'admin'>(defaultTab);
  const [adminSubTab, setAdminSubTab] = useState<'appointments' | 'inquiries' | 'audit'>('inquiries');

  // Admin auth session state (server-verified JWT/session token only)
  const [adminToken, setAdminToken] = useState<string>(() => {
    try {
      return sessionStorage.getItem('opm_admin_token') || '';
    } catch {
      return '';
    }
  });
  const [adminProfile, setAdminProfile] = useState<{ email: string; role: string } | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const [solutionRequests, setSolutionRequests] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [adminDataError, setAdminDataError] = useState<string | null>(null);
  const [isLoadingAdminData, setIsLoadingAdminData] = useState(false);

  const [promptInput, setPromptInput] = useState('');
  const [studioGenerating, setStudioGenerating] = useState(false);
  const [studioOutput, setStudioOutput] = useState<string | null>(null);

  const loadAuthorizedAdminData = useCallback(async (tokenToUse: string) => {
    if (!tokenToUse) {
      setAdminProfile(null);
      return;
    }

    setIsLoadingAdminData(true);
    setAdminDataError(null);

    try {
      const headers = { Authorization: `Bearer ${tokenToUse}` };
      const sessionRes = await fetch(apiUrl('/api/admin/auth/session'), { headers });
      if (!sessionRes.ok) {
        const errData = await sessionRes.json().catch(() => ({}));
        setAdminToken('');
        setAdminProfile(null);
        try {
          sessionStorage.removeItem('opm_admin_token');
        } catch {}
        setAuthError(errData.error || 'Administrator session expired. Please sign in again.');
        setIsLoadingAdminData(false);
        return;
      }

      const sessionJson = await sessionRes.json();
      setAdminProfile(sessionJson.admin || null);

      const [reqRes, aptRes, auditRes] = await Promise.all([
        fetch(apiUrl('/api/admin/solution-requests?limit=25&offset=0'), { headers }),
        fetch(apiUrl('/api/admin/appointments?limit=25&offset=0'), { headers }),
        fetch(apiUrl('/api/admin/audit-logs?limit=25&offset=0'), { headers }),
      ]);

      const reqJson = await reqRes.json().catch(() => ({}));
      const aptJson = await aptRes.json().catch(() => ({}));
      const auditJson = await auditRes.json().catch(() => ({}));

      if (!reqRes.ok || !aptRes.ok) {
        setAdminDataError(
          reqJson.error || aptJson.error || 'Database persistence unavailable or not configured.'
        );
      } else {
        setSolutionRequests(Array.isArray(reqJson.records) ? reqJson.records : []);
        setAppointments(Array.isArray(aptJson.records) ? aptJson.records : []);
        setAuditLogs(Array.isArray(auditJson.records) ? auditJson.records : []);
      }
    } catch {
      setAdminDataError('Unable to connect to the authorized admin API endpoints.');
    } finally {
      setIsLoadingAdminData(false);
    }
  }, []);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    if (isOpen && activeTab === 'admin' && adminToken) {
      void loadAuthorizedAdminData(adminToken);
    }
  }, [isOpen, activeTab, adminToken, loadAuthorizedAdminData]);

  if (!isOpen) return null;

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAuthenticating) return;
    setAuthError(null);
    setIsAuthenticating(true);
    try {
      const res = await fetch(apiUrl('/api/admin/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: loginEmail.trim(),
          password: loginPassword,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || !data.token) {
        throw new Error(data.error || 'Administrator authentication failed.');
      }

      setAdminToken(data.token);
      setAdminProfile(data.admin || null);
      setLoginPassword('');
      try {
        sessionStorage.setItem('opm_admin_token', data.token);
      } catch {}
      await loadAuthorizedAdminData(data.token);
    } catch (err: any) {
      setAuthError(err?.message || 'Unable to verify administrator credentials.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleAdminLogout = () => {
    setAdminToken('');
    setAdminProfile(null);
    setSolutionRequests([]);
    setAppointments([]);
    setAuditLogs([]);
    setAdminDataError(null);
    try {
      sessionStorage.removeItem('opm_admin_token');
    } catch {}
  };

  const handleRunStudioSimulation = () => {
    if (!promptInput.trim()) return;
    setStudioGenerating(true);
    setTimeout(() => {
      setStudioGenerating(false);
      setStudioOutput(
        `// Ophireum AI Studio Architecture Blueprint Preview\n// Prompt: "${promptInput}"\n\nimport React from 'react';\n\nexport const EnterpriseView: React.FC = () => {\n  return (\n    <section className="bg-slate-950 p-8 rounded-2xl border border-cyan-500/30 shadow-2xl">\n      <h2 className="text-xl font-bold text-white tracking-tight">Ophireum Distributed Media Hub</h2>\n      <p className="text-sm text-slate-400 mt-2">Verified Architecture Specification Blueprint</p>\n    </section>\n  );\n};`
      );
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md">
      <div className="relative w-full max-w-6xl max-h-[92vh] bg-[#0B1220] border border-slate-700 rounded-2xl flex flex-col shadow-2xl overflow-hidden">
        {/* Top Bar */}
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
                <span className="text-xs font-bold text-white uppercase tracking-wider">
                  {COMPANY_CONFIG.platformName}
                </span>
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

        {/* Tabs */}
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
            <span className="text-[10px] opacity-75 font-mono">RBAC PROTECTED</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6">
          {activeTab === 'portal' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-start justify-between flex-wrap gap-4">
                <div>
                  <span className="text-[11px] font-mono text-[#00C2C7] uppercase">
                    Enterprise Client Portal Specification
                  </span>
                  <h3 className="text-lg font-bold text-white mt-0.5">Authorized Client Workspace</h3>
                  <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                    Tenants log in with MFA-protected credentials to track deliverables, approve milestone sign-offs, inspect high-bitrate video review links, and communicate directly with project coordinators.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                    <Lock className="w-3.5 h-3.5 text-[#00C2C7]" />
                    <span>Tenant Isolation: Active</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      navigateToPortalPath('/portal/login');
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00C2C7] hover:bg-[#00d8de] text-[#0B1220] text-xs font-semibold transition-colors cursor-pointer"
                  >
                    <span>Open Client Portal</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="rounded-xl bg-[#111827] border border-slate-800 p-5">
                <h4 className="text-xs font-mono uppercase text-slate-400 mb-4">
                  Sample Milestone Architecture Preview (Demonstration)
                </h4>
                <div className="space-y-3.5">
                  <div className="p-4 rounded-lg bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="text-xs font-semibold text-white">
                          Phase 1: Creative Concept &amp; Architecture Specification
                        </span>
                        <p className="text-[11px] text-slate-400">Deliverable Approved</p>
                      </div>
                    </div>
                    <span className="text-xs font-mono text-emerald-400 font-medium">
                      Completed &amp; Signed
                    </span>
                  </div>

                  <div className="p-4 rounded-lg bg-slate-900/90 border border-[#00C2C7]/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <Clock className="w-5 h-5 text-[#00C2C7] shrink-0 mt-0.5" />
                      <div>
                        <span className="text-xs font-semibold text-white">
                          Phase 2: Production &amp; Core Engineering Build
                        </span>
                        <p className="text-[11px] text-slate-400">KMC One West Aeropark production pipeline</p>
                      </div>
                    </div>
                    <span className="text-xs font-mono text-[#00C2C7] font-medium">In Progress</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="p-5 rounded-xl bg-[#111827] border border-slate-800 space-y-2">
                  <h4 className="text-xs font-mono uppercase text-slate-400">Dedicated Production Lead</h4>
                  <div className="text-sm font-bold text-white">{COMPANY_CONFIG.founderCeo}</div>
                  <a
                    href={COMPANY_CONFIG.mobileLink}
                    className="text-xs font-mono text-[#00C2C7] hover:underline flex items-center gap-1.5"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>{COMPANY_CONFIG.mobile}</span>
                  </a>
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

          {activeTab === 'studio' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[11px] font-mono text-[#00C2C7] uppercase">
                  Ophireum AI Studio Specification
                </span>
                <h3 className="text-lg font-bold text-white mt-0.5">
                  Natural-Language Website &amp; Application Builder
                </h3>
                <p className="text-xs text-slate-300 mt-1">
                  Engineered to synthesize React 19 components, configure responsive layouts, and manage design tokens.
                </p>
              </div>
              <div className="rounded-xl bg-slate-950 border border-slate-800 overflow-hidden">
                <AIProcessingVisualizer className="w-full h-44" />
              </div>
              <div className="rounded-xl bg-[#111827] border border-slate-800 p-5 space-y-4">
                <label className="block text-xs font-mono text-slate-400 uppercase">
                  Prompt-To-Code Architecture Preview
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={promptInput}
                    onChange={(e) => setPromptInput(e.target.value)}
                    placeholder="e.g. Build a high-performance video gallery component..."
                    className="flex-1 px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00C2C7]"
                  />
                  <button
                    onClick={handleRunStudioSimulation}
                    disabled={studioGenerating || !promptInput.trim()}
                    className="px-4 py-2.5 text-xs font-semibold text-[#0B1220] bg-[#00C2C7] hover:bg-[#00d6dc] disabled:opacity-50 rounded-lg flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    {studioGenerating ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    <span>Generate Preview</span>
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

          {activeTab === 'agents' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-start justify-between">
                <div>
                  <span className="text-[11px] font-mono text-[#00C2C7] uppercase">
                    Autonomous Workforce Architecture
                  </span>
                  <h3 className="text-lg font-bold text-white mt-0.5">
                    12 Specialized AI Development Agents
                  </h3>
                  <p className="text-xs text-slate-300 mt-1 max-w-2xl">
                    Operating through server-side adapters (@google/genai SDK) within strict permission boundaries and immutable audit logs.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {aiAgentsData.map((agent) => (
                  <div
                    key={agent.id}
                    className="p-4 rounded-xl bg-[#111827] border border-slate-800 flex flex-col justify-between space-y-3"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-[#00C2C7] bg-[#00C2C7]/10 px-2 py-0.5 rounded border border-[#00C2C7]/30">
                          {agent.code}
                        </span>
                        <span
                          className={`text-[10px] font-mono ${
                            agent.status === 'Active' ? 'text-emerald-400' : 'text-[#D4AF37]'
                          }`}
                        >
                          ● {agent.status}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white mt-2">{agent.name}</h4>
                      <p className="text-[11px] text-slate-400 mt-0.5">{agent.focus}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: AUTHENTICATED SUPER ADMINISTRATOR CONTROL */}
          {activeTab === 'admin' && (
            <div className="space-y-6">
              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <span className="text-[11px] font-mono text-[#00C2C7] uppercase">
                    Server-Verified Governance Console
                  </span>
                  <h3 className="text-lg font-bold text-white mt-0.5">
                    Super Administrator Operations Center
                  </h3>
                  <p className="text-xs text-slate-300 mt-1">
                    Access to customer inquiries, solution requests, appointments, and audit logs is strictly protected by server-side RBAC authentication.
                  </p>
                </div>

                {adminProfile && (
                  <div className="flex items-center gap-3">
                    <div className="text-right text-xs">
                      <div className="text-white font-semibold">{adminProfile.email}</div>
                      <div className="text-[10px] font-mono text-emerald-400 uppercase">
                        Role: {adminProfile.role}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleAdminLogout}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                )}
              </div>

              {!adminProfile ? (
                <div className="max-w-md mx-auto p-6 rounded-2xl bg-[#111827] border border-slate-800 space-y-4">
                  <div className="flex items-center gap-2.5 text-white">
                    <Lock className="w-5 h-5 text-[#00C2C7]" />
                    <h4 className="text-sm font-bold">Administrator Authentication Required</h4>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Sign in with verified administrator credentials. Unauthenticated requests to administrative endpoints return HTTP 401.
                  </p>

                  <form onSubmit={handleAdminLogin} className="space-y-3">
                    <div>
                      <label htmlFor="admin-email" className="block text-xs text-slate-300 mb-1">
                        Administrator Email
                      </label>
                      <input
                        id="admin-email"
                        type="email"
                        required
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        placeholder="admin@ophireum.com"
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label htmlFor="admin-password" className="block text-xs text-slate-300 mb-1">
                        Password
                      </label>
                      <input
                        id="admin-password"
                        type="password"
                        required
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                      />
                    </div>

                    {authError && (
                      <div className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-500/40 text-xs text-rose-300 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <span>{authError}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isAuthenticating}
                      className="w-full py-2.5 px-4 rounded-lg bg-[#00C2C7] hover:bg-[#00d6dc] disabled:opacity-50 text-[#0B1220] text-xs font-bold cursor-pointer"
                    >
                      {isAuthenticating ? 'Verifying Credentials...' : 'Sign In as Administrator'}
                    </button>
                  </form>
                </div>
              ) : (
                <div className="rounded-xl bg-[#111827] border border-slate-800 p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setAdminSubTab('inquiries')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono cursor-pointer flex items-center gap-1.5 ${
                          adminSubTab === 'inquiries'
                            ? 'bg-[#00C2C7] text-[#0B1220] font-bold'
                            : 'bg-slate-900 text-slate-300 border border-slate-800'
                        }`}
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Solution Requests ({solutionRequests.length})</span>
                      </button>

                      <button
                        onClick={() => setAdminSubTab('appointments')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono cursor-pointer flex items-center gap-1.5 ${
                          adminSubTab === 'appointments'
                            ? 'bg-[#00C2C7] text-[#0B1220] font-bold'
                            : 'bg-slate-900 text-slate-300 border border-slate-800'
                        }`}
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>Consultations ({appointments.length})</span>
                      </button>

                      <button
                        onClick={() => setAdminSubTab('audit')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-mono cursor-pointer flex items-center gap-1.5 ${
                          adminSubTab === 'audit'
                            ? 'bg-[#00C2C7] text-[#0B1220] font-bold'
                            : 'bg-slate-900 text-slate-300 border border-slate-800'
                        }`}
                      >
                        <FileCheck className="w-3.5 h-3.5" />
                        <span>Audit Logs ({auditLogs.length})</span>
                      </button>
                    </div>

                    <button
                      onClick={() => loadAuthorizedAdminData(adminToken)}
                      disabled={isLoadingAdminData}
                      className="p-1.5 text-slate-400 hover:text-[#00C2C7] bg-slate-900 rounded-lg border border-slate-800 cursor-pointer flex items-center gap-1 text-[11px] font-mono"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoadingAdminData ? 'animate-spin' : ''}`} />
                      <span>Sync</span>
                    </button>
                  </div>

                  {adminDataError && (
                    <div className="p-3 rounded-lg bg-amber-950/50 border border-amber-500/40 text-xs text-amber-200">
                      {adminDataError}
                    </div>
                  )}

                  {adminSubTab === 'inquiries' && (
                    <div className="overflow-x-auto">
                      {solutionRequests.length === 0 ? (
                        <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
                          No persisted solution requests found in PostgreSQL database.
                        </div>
                      ) : (
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                              <th className="pb-2">REFERENCE</th>
                              <th className="pb-2">CLIENT &amp; ORG</th>
                              <th className="pb-2">SERVICES</th>
                              <th className="pb-2">ESTIMATE</th>
                              <th className="pb-2">EMAIL STATUS</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/80">
                            {solutionRequests.map((reqItem) => (
                              <tr key={reqItem.referenceCode} className="text-slate-300">
                                <td className="py-2.5 font-mono text-[#00C2C7]">{reqItem.referenceCode}</td>
                                <td className="py-2.5">
                                  <span className="font-semibold text-white block">{reqItem.fullName}</span>
                                  <span className="text-slate-400 text-[11px]">
                                    {reqItem.company} · {reqItem.email}
                                  </span>
                                </td>
                                <td className="py-2.5 max-w-[200px] truncate">{reqItem.serviceTitle}</td>
                                <td className="py-2.5 font-mono text-slate-300">{reqItem.estimatedBudget}</td>
                                <td className="py-2.5 font-mono text-[11px] uppercase">
                                  {reqItem.emailDeliveryStatus}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {adminSubTab === 'appointments' && (
                    <div className="overflow-x-auto">
                      {appointments.length === 0 ? (
                        <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
                          No persisted consultation scheduling requests found.
                        </div>
                      ) : (
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                              <th className="pb-2">REFERENCE</th>
                              <th className="pb-2">CLIENT &amp; ORG</th>
                              <th className="pb-2">DATE &amp; SLOT</th>
                              <th className="pb-2">CHANNEL</th>
                              <th className="pb-2">STATUS</th>
                              <th className="pb-2 text-right">CALENDAR</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/80">
                            {appointments.map((appt) => (
                              <tr key={appt.referenceCode} className="text-slate-300">
                                <td className="py-2.5 font-mono text-[#00C2C7]">{appt.referenceCode}</td>
                                <td className="py-2.5">
                                  <span className="font-semibold text-white block">{appt.fullName}</span>
                                  <span className="text-slate-400 text-[11px]">
                                    {appt.companyName} · {appt.email}
                                  </span>
                                </td>
                                <td className="py-2.5 font-mono">
                                  {appt.scheduledDate} ({appt.scheduledTimeSlot})
                                </td>
                                <td className="py-2.5 uppercase font-mono text-[11px]">
                                  {appt.consultationType}
                                </td>
                                <td className="py-2.5 font-mono text-[11px] uppercase">{appt.status}</td>
                                <td className="py-2.5 text-right font-mono text-[11px]">
                                  {appt.meetingLink ? (
                                    <a
                                      href={appt.meetingLink}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[#00C2C7] hover:underline"
                                    >
                                      <span>Event</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  ) : (
                                    <span className="text-slate-500">{appt.calendarSyncStatus}</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {adminSubTab === 'audit' && (
                    <div className="overflow-x-auto">
                      {auditLogs.length === 0 ? (
                        <div className="p-8 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
                          No audit logs recorded yet.
                        </div>
                      ) : (
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                              <th className="pb-2">TIMESTAMP</th>
                              <th className="pb-2">ACTOR</th>
                              <th className="pb-2">ACTION</th>
                              <th className="pb-2">ENTITY</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/80">
                            {auditLogs.map((logItem) => (
                              <tr key={logItem.id} className="text-slate-300">
                                <td className="py-2 font-mono text-[11px]">{logItem.createdAt}</td>
                                <td className="py-2 font-mono text-[11px]">{logItem.actor}</td>
                                <td className="py-2 text-[#00C2C7] font-mono text-[11px]">
                                  {logItem.action}
                                </td>
                                <td className="py-2 font-mono text-[11px]">
                                  {logItem.entityType} {logItem.entityId ? `(${logItem.entityId})` : ''}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Bottom bar */}
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
