import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  Bot,
  Briefcase,
  CheckCircle2,
  CreditCard,
  Download,
  KeyRound,
  Lock,
  LogOut,
  RefreshCw,
  Send,
  Settings,
  Shield,
  Users,
  AlertCircle,
  BookOpen,
} from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { COMPANY_CONFIG } from '../data/companyConfig';
import { apiUrl } from '../lib/apiClient';
import { navigateToAppPath } from '../portal/PortalRouter';

type AdminTab =
  | 'analytics'
  | 'inquiries'
  | 'commerce'
  | 'clients'
  | 'ai'
  | 'operations';

// Strictly in-memory token (never localStorage or sessionStorage); HttpOnly cookie handles persistence.
let memoryAdminToken = '';

export const AdminConsoleApp: React.FC = () => {
  const [adminProfile, setAdminProfile] = useState<{
    id: string;
    email: string;
    fullName: string;
    role: string;
    permissions?: string[];
    mfaEnabled?: boolean;
  } | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [activeTab, setActiveTab] = useState<AdminTab>('analytics');

  // Login form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [mfaRequiredPrompt, setMfaRequiredPrompt] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  // Operational state
  const [syncing, setSyncing] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  // Data slices
  const [currencyFilter, setCurrencyFilter] = useState<'ALL' | 'USD' | 'PHP'>('ALL');
  const [analytics, setAnalytics] = useState<any>(null);
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [paymentsData, setPaymentsData] = useState<{
    payments: any[];
    invoices: any[];
    subscriptions: any[];
    refunds: any[];
    providers: any[];
  }>({ payments: [], invoices: [], subscriptions: [], refunds: [], providers: [] });
  const [promotions, setPromotions] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [executions, setExecutions] = useState<any[]>([]);
  const [escalations, setEscalations] = useState<any[]>([]);
  const [knowledgeDocs, setKnowledgeDocs] = useState<any[]>([]);
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [configs, setConfigs] = useState<any[]>([]);
  const [rolesMatrix, setRolesMatrix] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Forms inside tabs
  const [selectedAgentCode, setSelectedAgentCode] = useState('A00');
  const [agentPrompt, setAgentPrompt] = useState('');
  const [runningAgent, setRunningAgent] = useState(false);
  const [kbTitle, setKbTitle] = useState('');
  const [kbCategory, setKbCategory] = useState('operations');
  const [kbVisibility, setKbVisibility] = useState<'public' | 'internal_admin'>('internal_admin');
  const [kbContent, setKbContent] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [promoValue, setPromoValue] = useState('10');
  const [ticketReplyMap, setTicketReplyMap] = useState<Record<string, string>>({});
  const [aiDashboard, setAiDashboard] = useState<any>(null);
  const [mfaEnrollment, setMfaEnrollment] = useState<{ secret: string; otpAuthUri: string } | null>(null);
  const [mfaRecoveryCodes, setMfaRecoveryCodes] = useState<string[]>([]);
  const [mfaConfirmCode, setMfaConfirmCode] = useState('');

  const adminFetch = useCallback(async (path: string, init?: RequestInit) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Requested-With': 'fetch',
      ...(init?.headers as Record<string, string> | undefined),
    };
    if (memoryAdminToken) {
      headers['Authorization'] = `Bearer ${memoryAdminToken}`;
    }
    const res = await fetch(apiUrl(path), {
      ...init,
      credentials: 'include',
      headers,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  }, []);

  const syncAll = useCallback(async () => {
    setSyncing(true);
    try {
      const [
        analyticsRes,
        inqRes,
        aptRes,
        ordRes,
        payRes,
        promoRes,
        custRes,
        projRes,
        tickRes,
        agentRes,
        execRes,
        aiDashRes,
        kbRes,
        healthRes,
        cfgRes,
        rolesRes,
        auditRes,
      ] = await Promise.all([
        adminFetch(`/api/admin/analytics/overview?currency=${currencyFilter}`),
        adminFetch('/api/admin/solution-requests?limit=30&offset=0'),
        adminFetch('/api/admin/appointments?limit=30&offset=0'),
        adminFetch('/api/admin/orders'),
        adminFetch('/api/admin/payments'),
        adminFetch('/api/admin/promotions'),
        adminFetch('/api/admin/customers'),
        adminFetch('/api/admin/projects'),
        adminFetch('/api/admin/tickets'),
        adminFetch('/api/ai/agents'),
        adminFetch('/api/ai/executions?limit=40'),
        adminFetch('/api/ai/dashboard'),
        adminFetch('/api/ai/knowledge/documents'),
        adminFetch('/api/admin/integrations/health'),
        adminFetch('/api/admin/config'),
        adminFetch('/api/admin/rbac/roles'),
        adminFetch('/api/admin/audit-logs?limit=40&offset=0'),
      ]);

      if (analyticsRes.ok) setAnalytics(analyticsRes.data.analytics);
      if (inqRes.ok) setInquiries(inqRes.data.records || []);
      if (aptRes.ok) setAppointments(aptRes.data.records || []);
      if (ordRes.ok) setOrders(ordRes.data.records || []);
      if (payRes.ok) {
        setPaymentsData({
          payments: payRes.data.payments || [],
          invoices: payRes.data.invoices || [],
          subscriptions: payRes.data.subscriptions || [],
          refunds: payRes.data.refunds || [],
          providers: payRes.data.providers || [],
        });
      }
      if (promoRes.ok) setPromotions(promoRes.data.promotions || []);
      if (custRes.ok) setCustomers(custRes.data.records || []);
      if (projRes.ok) setProjects(projRes.data.records || []);
      if (tickRes.ok) setTickets(tickRes.data.records || []);
      if (agentRes.ok) setAgents(agentRes.data.agents || []);
      if (execRes.ok) {
        setExecutions(execRes.data.executions || []);
        setEscalations(execRes.data.escalations || []);
      }
      if (aiDashRes.ok) setAiDashboard(aiDashRes.data.dashboard || null);
      if (kbRes.ok) setKnowledgeDocs(kbRes.data.documents || []);
      if (healthRes.ok) setIntegrations(healthRes.data.integrations || []);
      if (cfgRes.ok) setConfigs(cfgRes.data.configs || []);
      if (rolesRes.ok) setRolesMatrix(rolesRes.data.roles || []);
      if (auditRes.ok) setAuditLogs(auditRes.data.records || []);
    } finally {
      setSyncing(false);
    }
  }, [adminFetch, currencyFilter]);

  useEffect(() => {
    adminFetch('/api/admin/auth/session')
      .then((res) => {
        if (res.ok && res.data.admin) {
          setAdminProfile(res.data.admin);
        }
      })
      .finally(() => setCheckingSession(false));
  }, [adminFetch]);

  useEffect(() => {
    if (adminProfile) {
      void syncAll();
    }
  }, [adminProfile, syncAll]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setLoggingIn(true);
    try {
      const res = await adminFetch('/api/admin/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          password,
          totpCode: totpCode.trim() || undefined,
        }),
      });
      if (!res.ok) {
        if (res.data.mfaRequired) setMfaRequiredPrompt(true);
        throw new Error(res.data.error || 'Administrator sign-in failed.');
      }
      memoryAdminToken = res.data.token || '';
      setAdminProfile(res.data.admin);
      setPassword('');
      setTotpCode('');
      setMfaRequiredPrompt(false);
    } catch (err: any) {
      setAuthError(err?.message || 'Unable to sign in.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await adminFetch('/api/admin/auth/logout', { method: 'POST' });
    memoryAdminToken = '';
    setAdminProfile(null);
    setStatusBanner(null);
  };

  const handleExportCsv = async () => {
    const headers: Record<string, string> = {};
    if (memoryAdminToken) headers['Authorization'] = `Bearer ${memoryAdminToken}`;
    const res = await fetch(apiUrl(`/api/admin/analytics/export.csv?currency=${currencyFilter}`), {
      credentials: 'include',
      headers,
    });
    if (!res.ok) {
      setStatusBanner('CSV export denied or unavailable for your role.');
      return;
    }
    const csv = await res.text();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ophireum-bi-analytics-${currencyFilter.toLowerCase()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleOrderStatusChange = async (orderId: string, status: string) => {
    const res = await adminFetch(`/api/admin/orders/${encodeURIComponent(orderId)}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    setStatusBanner(res.ok ? `Order ${orderId} updated to ${status}.` : res.data.error || 'Update failed.');
    if (res.ok) void syncAll();
  };

  const handleProjectStageChange = async (projectId: string, stage: string) => {
    const res = await adminFetch(`/api/admin/projects/${encodeURIComponent(projectId)}/stage`, {
      method: 'PATCH',
      body: JSON.stringify({ stage }),
    });
    setStatusBanner(res.ok ? `Project ${projectId} moved to ${stage}.` : res.data.error || 'Stage update failed.');
    if (res.ok) void syncAll();
  };

  const handleTicketReply = async (ticketId: string) => {
    const body = (ticketReplyMap[ticketId] || '').trim();
    if (!body) return;
    const res = await adminFetch(`/api/admin/tickets/${encodeURIComponent(ticketId)}/reply`, {
      method: 'POST',
      body: JSON.stringify({ body, status: 'waiting_for_client' }),
    });
    if (res.ok) {
      setTicketReplyMap((prev) => ({ ...prev, [ticketId]: '' }));
      setStatusBanner(`Reply sent on ticket ${ticketId}.`);
      void syncAll();
    } else {
      setStatusBanner(res.data.error || 'Reply failed.');
    }
  };

  const handleCreatePromo = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await adminFetch('/api/admin/promotions', {
      method: 'POST',
      body: JSON.stringify({
        code: promoCode.trim().toUpperCase(),
        discountType: 'percent',
        value: Number(promoValue),
        isActive: true,
      }),
    });
    setStatusBanner(res.ok ? `Promotion ${promoCode.toUpperCase()} saved.` : res.data.error || 'Promo failed.');
    if (res.ok) {
      setPromoCode('');
      void syncAll();
    }
  };

  const handleExecuteAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentPrompt.trim() || runningAgent) return;
    setRunningAgent(true);
    try {
      const res = await adminFetch(`/api/ai/agents/${encodeURIComponent(selectedAgentCode)}/execute`, {
        method: 'POST',
        body: JSON.stringify({ prompt: agentPrompt.trim() }),
      });
      if (res.ok) {
        setStatusBanner(
          res.data.execution.status === 'pending_approval'
            ? `Agent ${selectedAgentCode} queued for human executive approval (${res.data.execution.id}).`
            : `Agent ${selectedAgentCode} completed execution.`
        );
        setAgentPrompt('');
        void syncAll();
      } else {
        setStatusBanner(res.data.error || 'Agent execution blocked.');
      }
    } finally {
      setRunningAgent(false);
    }
  };

  const handleDecideApproval = async (executionId: string, decision: 'approved' | 'rejected') => {
    const res = await adminFetch(`/api/ai/approvals/${encodeURIComponent(executionId)}/decide`, {
      method: 'POST',
      body: JSON.stringify({ decision }),
    });
    setStatusBanner(res.ok ? `Execution ${executionId} ${decision}.` : res.data.error || 'Decision failed.');
    if (res.ok) void syncAll();
  };

  const handleCancelApproval = async (executionId: string) => {
    const res = await adminFetch(`/api/ai/approvals/${encodeURIComponent(executionId)}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ note: 'Cancelled from Admin Console' }),
    });
    setStatusBanner(res.ok ? `Pending execution ${executionId} cancelled.` : res.data.error || 'Cancel failed.');
    if (res.ok) void syncAll();
  };

  const handleDecideRefund = async (refundId: string, decision: 'approved' | 'rejected') => {
    const res = await adminFetch(`/api/admin/refunds/${encodeURIComponent(refundId)}/decide`, {
      method: 'POST',
      body: JSON.stringify({ decision }),
    });
    setStatusBanner(res.ok ? `Refund ${refundId} marked ${decision}.` : res.data.error || 'Refund decision failed.');
    if (res.ok) void syncAll();
  };

  const handleToggleCustomerSuspension = async (userId: string, isSuspended: boolean) => {
    const endpoint = isSuspended
      ? `/api/admin/customers/${encodeURIComponent(userId)}/reactivate`
      : `/api/admin/customers/${encodeURIComponent(userId)}/suspend`;
    const res = await adminFetch(endpoint, {
      method: 'POST',
      body: JSON.stringify({ reason: 'Administrative review' }),
    });
    setStatusBanner(
      res.ok
        ? `Customer ${userId} ${isSuspended ? 'reactivated' : 'suspended'}.`
        : res.data.error || 'Customer status update failed.'
    );
    if (res.ok) void syncAll();
  };

  const handleGrantCustomerCredit = async (userId: string) => {
    const res = await adminFetch(`/api/admin/customers/${encodeURIComponent(userId)}/credits`, {
      method: 'POST',
      body: JSON.stringify({ amountMinor: 2500, currency: 'USD', reason: 'Admin goodwill credit' }),
    });
    setStatusBanner(res.ok ? 'Issued $25.00 USD credit to customer.' : res.data.error || 'Credit adjustment failed.');
    if (res.ok) void syncAll();
  };

  const handleIngestKnowledge = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await adminFetch('/api/ai/knowledge/documents', {
      method: 'POST',
      body: JSON.stringify({
        title: kbTitle.trim(),
        category: kbCategory,
        visibility: kbVisibility,
        rawContent: kbContent.trim(),
        approvalStatus: 'approved',
      }),
    });
    setStatusBanner(res.ok ? `Knowledge document "${kbTitle}" ingested and indexed.` : res.data.error || 'Ingest failed.');
    if (res.ok) {
      setKbTitle('');
      setKbContent('');
      void syncAll();
    }
  };

  const handleOutboxRetry = async () => {
    const res = await adminFetch('/api/admin/outbox/retry', { method: 'POST' });
    setStatusBanner(
      res.ok ? `Email outbox retry processed ${res.data.processed ?? 0} queued items.` : res.data.error || 'Retry failed.'
    );
  };

  const handleStartMfa = async () => {
    const res = await adminFetch('/api/admin/auth/mfa/enroll', { method: 'POST' });
    if (res.ok) {
      setMfaEnrollment({
        secret: res.data.secret,
        otpAuthUri: res.data.otpAuthUri || res.data.otpauthUri || '',
      });
      setMfaRecoveryCodes([]);
    }
  };

  const handleConfirmMfa = async () => {
    const res = await adminFetch('/api/admin/auth/mfa/confirm', {
      method: 'POST',
      body: JSON.stringify({ code: mfaConfirmCode.trim() }),
    });
    if (res.ok) {
      setMfaEnrollment(null);
      setMfaConfirmCode('');
      setMfaRecoveryCodes(Array.isArray(res.data.recoveryCodes) ? res.data.recoveryCodes : []);
      setStatusBanner('Administrator TOTP MFA enabled. Save your single-use recovery codes below.');
    } else {
      setStatusBanner(res.data.error || 'Invalid 6-digit MFA code.');
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-[#0B1220] text-slate-200 flex items-center justify-center">
        <div className="text-center space-y-3">
          <BrandLogo variant="emblem" size="md" ring="gold" eager />
          <p className="text-xs font-mono text-slate-400">Verifying Administrator Session...</p>
        </div>
      </div>
    );
  }

  if (!adminProfile) {
    return (
      <div className="min-h-screen bg-[#0B1220] text-slate-100 flex flex-col">
        <header className="h-16 px-6 border-b border-slate-800 bg-[#111827] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandLogo variant="emblem" size="sm" ring="gold" eager decorative />
            <span className="text-xs font-bold tracking-wider uppercase">{COMPANY_CONFIG.platformName} · Admin Command Center</span>
          </div>
          <button
            onClick={() => navigateToAppPath('/')}
            className="inline-flex items-center gap-1.5 text-xs text-slate-300 hover:text-white cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Website</span>
          </button>
        </header>

        <main className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md bg-[#111827] border border-slate-800 rounded-xl p-6 space-y-5">
            <div className="flex items-center gap-2.5">
              <Lock className="w-5 h-5 text-[#00C2C7]" />
              <div>
                <h1 className="text-base font-bold text-white">Enterprise Admin Authentication</h1>
                <p className="text-xs text-slate-400">RBAC + HttpOnly Session + TOTP MFA Protected</p>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Administrator Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@ophireummultimedia.com"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">
                  Authenticator Code (6 digits — {mfaRequiredPrompt ? 'Required' : 'If MFA Enabled'})
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  placeholder="000000"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white"
                />
              </div>

              {authError && (
                <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{authError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loggingIn}
                className="w-full py-2.5 rounded-lg bg-[#00C2C7] hover:bg-[#00d6dc] text-[#0B1220] text-xs font-bold disabled:opacity-50 cursor-pointer"
              >
                {loggingIn ? 'Authenticating...' : 'Sign In to Admin Command Center'}
              </button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  const tabs: Array<{ id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'analytics', label: 'Executive BI', icon: BarChart3 },
    { id: 'inquiries', label: 'Inquiries & Bookings', icon: Send },
    { id: 'commerce', label: 'Orders & Finance', icon: CreditCard },
    { id: 'clients', label: 'Clients, Projects & Support', icon: Users },
    { id: 'ai', label: 'AI Workforce (25) & KB', icon: Bot },
    { id: 'operations', label: 'Health, RBAC & Audit', icon: Settings },
  ];

  const kpis = analytics?.kpis;

  return (
    <div className="min-h-screen bg-[#0B1220] text-slate-100 flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-30 bg-[#111827]/95 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <BrandLogo variant="emblem" size="sm" ring="gold" eager decorative />
          <div className="min-w-0">
            <span className="text-xs font-bold uppercase tracking-wider text-white block truncate">
              OPHIREUM Admin Command Center
            </span>
            <span className="text-[11px] font-mono text-[#00C2C7]">
              {adminProfile.email} · {adminProfile.role}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => void syncAll()}
            disabled={syncing}
            className="px-3 py-1.5 rounded-lg border border-slate-700 hover:border-[#00C2C7] text-xs text-slate-200 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span>Sync</span>
          </button>
          <button
            onClick={() => navigateToAppPath('/')}
            className="px-3 py-1.5 rounded-lg border border-slate-700 hover:bg-slate-800 text-xs text-slate-200 cursor-pointer"
          >
            Public Site
          </button>
          <button
            onClick={handleLogout}
            className="px-3 py-1.5 rounded-lg bg-rose-950/60 border border-rose-500/40 hover:bg-rose-900/60 text-xs text-rose-200 flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Sub-Nav */}
      <nav className="bg-[#111827] border-b border-slate-800 px-4 sm:px-6 py-2 flex items-center gap-2 overflow-x-auto">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                active
                  ? 'bg-[#00C2C7] text-[#0B1220] font-semibold'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          );
        })}
      </nav>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {statusBanner && (
          <div className="p-3 rounded-lg bg-slate-900 border border-[#00C2C7]/40 text-xs text-[#00C2C7] flex items-center justify-between gap-2">
            <span>{statusBanner}</span>
            <button onClick={() => setStatusBanner(null)} className="text-slate-400 hover:text-white cursor-pointer">
              Dismiss
            </button>
          </div>
        )}

        {/* TAB 1: EXECUTIVE BI ANALYTICS */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-lg font-bold text-white">Executive Business Intelligence</h1>
                <p className="text-xs text-slate-400">
                  {analytics?.dataSourceNote || 'Computed strictly from real persisted platform records.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={currencyFilter}
                  onChange={(e) => setCurrencyFilter(e.target.value as any)}
                  className="px-3 py-1.5 rounded-lg bg-[#111827] border border-slate-700 text-xs font-mono text-white"
                >
                  <option value="ALL">All Currencies</option>
                  <option value="USD">USD Only</option>
                  <option value="PHP">PHP Only</option>
                </select>
                <button
                  onClick={handleExportCsv}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00C2C7] text-[#0B1220] text-xs font-semibold cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Verified Revenue (USD)', value: `$${((kpis?.revenueUsdMinor || 0) / 100).toLocaleString('en-US')}` },
                { label: 'Verified Revenue (PHP)', value: `₱${((kpis?.revenuePhpMinor || 0) / 100).toLocaleString('en-US')}` },
                { label: 'Orders (Paid / Total)', value: `${kpis?.paidOrders ?? 0} / ${kpis?.totalOrders ?? 0}` },
                { label: 'Registered Clients', value: String(kpis?.registeredCustomers ?? 0) },
                { label: 'Inquiries Logged', value: String(kpis?.totalInquiries ?? 0) },
                { label: 'Consultations (Conf. %)', value: `${kpis?.totalAppointments ?? 0} (${kpis?.appointmentConfirmationRatePct ?? 0}%)` },
                { label: 'Projects (Completed %)', value: `${kpis?.totalProjects ?? 0} (${kpis?.projectCompletionRatePct ?? 0}%)` },
                { label: 'AI Runs / Pending Approvals', value: `${kpis?.aiExecutionsTotal ?? 0} / ${kpis?.aiPendingApprovals ?? 0}` },
              ].map((card) => (
                <div key={card.label} className="p-4 rounded-xl bg-[#111827] border border-slate-800">
                  <div className="text-[11px] font-mono text-slate-400">{card.label}</div>
                  <div className="text-xl font-bold font-mono tabular-nums text-white mt-1.5">{card.value}</div>
                </div>
              ))}
            </div>

            <div className="p-5 rounded-xl bg-[#111827] border border-slate-800">
              <h2 className="text-xs font-mono uppercase text-slate-400 mb-3">Top Ordered Services (Real DB Counts)</h2>
              {!analytics?.topServices || analytics.topServices.length === 0 ? (
                <p className="text-xs text-slate-500">Zero orders recorded for the selected filter range.</p>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-mono">
                      <th className="pb-2">SERVICE</th>
                      <th className="pb-2 text-right">ORDERS</th>
                      <th className="pb-2 text-right">UNITS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {analytics.topServices.map((s: any) => (
                      <tr key={s.productName}>
                        <td className="py-2 text-white">{s.productName}</td>
                        <td className="py-2 text-right font-mono tabular-nums">{s.orders}</td>
                        <td className="py-2 text-right font-mono tabular-nums">{s.units}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: INQUIRIES & APPOINTMENTS */}
        {activeTab === 'inquiries' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-5 rounded-xl bg-[#111827] border border-slate-800 space-y-3">
              <h2 className="text-sm font-bold text-white">Solution Requests ({inquiries.length})</h2>
              {inquiries.length === 0 ? (
                <p className="text-xs text-slate-500">No solution requests persisted in active database.</p>
              ) : (
                <div className="space-y-2">
                  {inquiries.map((inq) => (
                    <div key={inq.referenceCode} className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-[#00C2C7]">{inq.referenceCode}</span>
                        <span className="font-mono uppercase text-slate-400">{inq.status}</span>
                      </div>
                      <p className="font-semibold text-white">{inq.fullName} · {inq.company}</p>
                      <p className="text-slate-400">{inq.serviceTitle}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-5 rounded-xl bg-[#111827] border border-slate-800 space-y-3">
              <h2 className="text-sm font-bold text-white">Consultations ({appointments.length})</h2>
              {appointments.length === 0 ? (
                <p className="text-xs text-slate-500">No consultation appointments persisted in active database.</p>
              ) : (
                <div className="space-y-2">
                  {appointments.map((apt) => (
                    <div key={apt.referenceCode} className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[#00C2C7]">{apt.referenceCode}</span>
                        <span className="font-mono uppercase text-slate-400">{apt.status}</span>
                      </div>
                      <p className="font-semibold text-white">{apt.fullName} · {apt.scheduledDate} {apt.scheduledTimeSlot}</p>
                      <p className="text-slate-400">Calendar Sync: {apt.calendarSyncStatus}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: COMMERCE, ORDERS, PAYMENTS, REFUNDS & PROMOTIONS */}
        {activeTab === 'commerce' && (
          <div className="space-y-6">
            <div className="p-5 rounded-xl bg-[#111827] border border-slate-800 space-y-3">
              <h2 className="text-sm font-bold text-white">Orders ({orders.length})</h2>
              {orders.length === 0 ? (
                <p className="text-xs text-slate-500">No orders placed yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-mono">
                        <th className="pb-2">ORDER</th>
                        <th className="pb-2">TOTAL</th>
                        <th className="pb-2">PAYMENT</th>
                        <th className="pb-2">FULFILLMENT STATUS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {orders.map((o) => (
                        <tr key={o.id}>
                          <td className="py-2 font-mono text-[#00C2C7]">{o.orderNumber}</td>
                          <td className="py-2 font-mono tabular-nums">
                            {o.currency} {(o.totalMinor / 100).toLocaleString('en-US')}
                          </td>
                          <td className="py-2 font-mono uppercase">{o.paymentStatus}</td>
                          <td className="py-2">
                            <select
                              value={o.fulfillmentStatus || o.status || 'pending_payment'}
                              onChange={(e) => handleOrderStatusChange(o.id, e.target.value)}
                              className="px-2 py-1 rounded bg-slate-900 border border-slate-700 text-xs text-white"
                            >
                              {[
                                'pending_payment',
                                'confirmed',
                                'in_production',
                                'quality_review',
                                'awaiting_client_review',
                                'completed',
                                'cancelled',
                              ].map((st) => (
                                <option key={st} value={st}>
                                  {st}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {paymentsData.refunds.length > 0 && (
              <div className="p-5 rounded-xl bg-[#111827] border border-slate-800 space-y-3">
                <h2 className="text-sm font-bold text-white">Refund Requests ({paymentsData.refunds.length})</h2>
                <div className="space-y-2">
                  {paymentsData.refunds.map((rf) => (
                    <div key={rf.id} className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div>
                        <span className="font-mono text-[#00C2C7]">{rf.id}</span> ·{' '}
                        <span className="font-mono text-white">
                          {rf.currency} {(rf.amountMinor / 100).toLocaleString('en-US')}
                        </span>
                        <p className="text-slate-400">{rf.reason} ({rf.status})</p>
                      </div>
                      {rf.status === 'requested' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleDecideRefund(rf.id, 'approved')}
                            className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleDecideRefund(rf.id, 'rejected')}
                            className="px-2.5 py-1 rounded bg-rose-700 hover:bg-rose-600 text-white font-semibold cursor-pointer"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-5 rounded-xl bg-[#111827] border border-slate-800 space-y-3">
                <h2 className="text-sm font-bold text-white">Payment Gateways ({paymentsData.providers.length})</h2>
                <div className="space-y-2">
                  {paymentsData.providers.map((p) => (
                    <div key={p.provider || p.id} className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs gap-2">
                      <div>
                        <span className="font-semibold text-white block">{p.displayName}</span>
                        <span className="text-slate-400">{p.unavailableMessage || p.readinessNote}</span>
                      </div>
                      <span className="font-mono uppercase text-amber-300 shrink-0">
                        {p.integrationStatus || p.mode || 'disabled'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-5 rounded-xl bg-[#111827] border border-slate-800 space-y-4">
                <h2 className="text-sm font-bold text-white">Promotions ({promotions.length})</h2>
                <form onSubmit={handleCreatePromo} className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    placeholder="PROMO CODE"
                    className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono uppercase text-white"
                  />
                  <input
                    type="number"
                    min={1}
                    max={80}
                    value={promoValue}
                    onChange={(e) => setPromoValue(e.target.value)}
                    className="w-20 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono text-white"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg bg-[#00C2C7] text-[#0B1220] text-xs font-semibold cursor-pointer"
                  >
                    Save %
                  </button>
                </form>
                <div className="space-y-1.5 text-xs">
                  {promotions.map((pr) => (
                    <div key={pr.code} className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800">
                      <span className="font-mono text-[#00C2C7]">{pr.code}</span>
                      <span className="text-slate-300">{pr.discountType === 'percent' ? `${pr.value}%` : `$${pr.value / 100}`}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: CUSTOMERS, PROJECTS & SUPPORT */}
        {activeTab === 'clients' && (
          <div className="space-y-6">
            <div className="p-5 rounded-xl bg-[#111827] border border-slate-800 space-y-3">
              <h2 className="text-sm font-bold text-white">Registered Customers ({customers.length})</h2>
              {customers.length === 0 ? (
                <p className="text-xs text-slate-500">No portal customers registered yet.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {customers.map((entry) => {
                    const user = entry.user || entry;
                    const profile = entry.profile || entry;
                    const isSuspended = user.accountStatus === 'suspended';
                    return (
                      <div key={user.id} className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-white truncate">{profile.fullName || user.email}</p>
                          <span className={`font-mono text-[10px] uppercase ${isSuspended ? 'text-rose-400' : 'text-emerald-400'}`}>
                            {user.accountStatus || 'active'}
                          </span>
                        </div>
                        <p className="font-mono text-[#00C2C7] truncate">{user.email}</p>
                        <p className="text-slate-400">{profile.companyName || 'Individual Client'}</p>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => handleToggleCustomerSuspension(user.id, isSuspended)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-200 cursor-pointer"
                          >
                            {isSuspended ? 'Reactivate' : 'Suspend'}
                          </button>
                          <button
                            onClick={() => handleGrantCustomerCredit(user.id)}
                            className="px-2 py-1 rounded bg-[#00C2C7]/15 hover:bg-[#00C2C7]/30 text-[11px] text-[#00C2C7] cursor-pointer"
                          >
                            +$25 Credit
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-5 rounded-xl bg-[#111827] border border-slate-800 space-y-3">
                <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Briefcase className="w-4 h-4 text-[#00C2C7]" />
                  <span>Client Projects ({projects.length})</span>
                </h2>
                {projects.length === 0 ? (
                  <p className="text-xs text-slate-500">No active projects yet.</p>
                ) : (
                  projects.map((proj) => (
                    <div key={proj.id} className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs flex items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-white">{proj.title}</p>
                        <p className="font-mono text-slate-400">{proj.referenceNumber || proj.projectCode}</p>
                      </div>
                      <select
                        value={proj.currentStage}
                        onChange={(e) => handleProjectStageChange(proj.id, e.target.value)}
                        className="px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs text-white"
                      >
                        {[
                          'order_confirmed',
                          'requirements_submitted',
                          'in_planning',
                          'in_production',
                          'review_feedback',
                          'revision_stage',
                          'final_delivery',
                          'completed',
                        ].map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))
                )}
              </div>

              <div className="p-5 rounded-xl bg-[#111827] border border-slate-800 space-y-3">
                <h2 className="text-sm font-bold text-white">Support Tickets ({tickets.length})</h2>
                {tickets.length === 0 ? (
                  <p className="text-xs text-slate-500">No support tickets logged.</p>
                ) : (
                  tickets.map((tk) => (
                    <div key={tk.id} className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[#00C2C7]">{tk.ticketNumber}</span>
                        <span className="font-mono uppercase text-slate-400">{tk.status}</span>
                      </div>
                      <p className="font-semibold text-white">{tk.subject}</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={ticketReplyMap[tk.id] || ''}
                          onChange={(e) => setTicketReplyMap((prev) => ({ ...prev, [tk.id]: e.target.value }))}
                          placeholder="Write admin reply..."
                          className="flex-1 px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-xs text-white"
                        />
                        <button
                          onClick={() => handleTicketReply(tk.id)}
                          className="px-3 py-1.5 rounded bg-[#00C2C7] text-[#0B1220] font-semibold cursor-pointer"
                        >
                          Reply
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: 25-AGENT ENTERPRISE AI WORKFORCE & CENTRAL KNOWLEDGE BASE */}
        {activeTab === 'ai' && (
          <div className="space-y-6">
            {aiDashboard && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { label: 'Active Agents', value: String(aiDashboard.totalAgents ?? agents.length) },
                  { label: 'Total Executions', value: String(aiDashboard.totalExecutions ?? 0) },
                  { label: 'Pending Approvals', value: String(aiDashboard.pendingApprovals ?? 0) },
                  { label: 'Failed Runs', value: String(aiDashboard.failedExecutions ?? 0) },
                  {
                    label: 'Tokens / Est. Cost',
                    value: `${aiDashboard.totalTokens ?? 0} ($${Number(aiDashboard.estimatedCostUsd ?? 0).toFixed(4)})`,
                  },
                ].map((m) => (
                  <div key={m.label} className="p-3 rounded-xl bg-[#111827] border border-slate-800">
                    <div className="text-[10px] font-mono uppercase text-slate-400">{m.label}</div>
                    <div className="text-sm font-bold font-mono text-white mt-1 tabular-nums">{m.value}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 p-5 rounded-xl bg-[#111827] border border-slate-800 space-y-4">
                <h2 className="text-sm font-bold text-white">
                  Commissioned Enterprise AI Workforce ({agents.length} Agents · A00–A24)
                </h2>
                <form onSubmit={handleExecuteAgent} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <select
                      value={selectedAgentCode}
                      onChange={(e) => setSelectedAgentCode(e.target.value)}
                      className="sm:col-span-2 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                    >
                      {agents.map((a) => (
                        <option key={a.code} value={a.code}>
                          {a.code} — {a.name} ({a.riskTier.toUpperCase()})
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      disabled={runningAgent || !agentPrompt.trim()}
                      className="px-3 py-2 rounded-lg bg-[#00C2C7] text-[#0B1220] text-xs font-bold disabled:opacity-50 cursor-pointer"
                    >
                      {runningAgent ? 'Executing...' : 'Run Agent'}
                    </button>
                  </div>
                  <textarea
                    rows={3}
                    value={agentPrompt}
                    onChange={(e) => setAgentPrompt(e.target.value)}
                    placeholder="Enter task objective for the selected agent (high-risk agents automatically queue for executive approval)..."
                    className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                  />
                </form>

                <div className="space-y-2 max-h-[340px] overflow-y-auto">
                  {executions.map((ex) => {
                    const renderedOutput = ex.outputText || ex.output;
                    return (
                      <div key={ex.id} className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[#00C2C7]">
                            {ex.agentCode} · {ex.agentName}
                          </span>
                          <span className="font-mono uppercase text-amber-300">{ex.status}</span>
                        </div>
                        <p className="text-slate-300">{ex.prompt}</p>
                        {renderedOutput && (
                          <pre className="p-2 rounded bg-slate-950 text-slate-200 whitespace-pre-wrap font-mono text-[11px]">
                            {renderedOutput}
                          </pre>
                        )}
                        {ex.status === 'pending_approval' && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            <button
                              onClick={() => handleDecideApproval(ex.id, 'approved')}
                              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold cursor-pointer"
                            >
                              Approve &amp; Execute
                            </button>
                            <button
                              onClick={() => handleDecideApproval(ex.id, 'rejected')}
                              className="px-2.5 py-1 rounded bg-rose-700 hover:bg-rose-600 text-white font-semibold cursor-pointer"
                            >
                              Reject
                            </button>
                            <button
                              onClick={() => handleCancelApproval(ex.id)}
                              className="px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 font-semibold cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="lg:col-span-5 p-5 rounded-xl bg-[#111827] border border-slate-800 space-y-4">
                <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-[#00C2C7]" />
                  <span>Central AI Knowledge Base ({knowledgeDocs.length})</span>
                </h2>
                <form onSubmit={handleIngestKnowledge} className="space-y-2">
                  <input
                    type="text"
                    required
                    value={kbTitle}
                    onChange={(e) => setKbTitle(e.target.value)}
                    placeholder="Document Title"
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={kbCategory}
                      onChange={(e) => setKbCategory(e.target.value)}
                      placeholder="Category"
                      className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                    />
                    <select
                      value={kbVisibility}
                      onChange={(e) => setKbVisibility(e.target.value as any)}
                      className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                    >
                      <option value="internal_admin">Internal Admin</option>
                      <option value="public">Public Approved</option>
                    </select>
                  </div>
                  <textarea
                    rows={3}
                    required
                    value={kbContent}
                    onChange={(e) => setKbContent(e.target.value)}
                    placeholder="Knowledge document content for vector/hybrid grounding..."
                    className="w-full px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                  />
                  <button
                    type="submit"
                    className="w-full py-2 rounded-lg bg-[#00C2C7] text-[#0B1220] text-xs font-bold cursor-pointer"
                  >
                    Ingest &amp; Approve Document
                  </button>
                </form>

                <div className="space-y-1.5 max-h-[220px] overflow-y-auto text-xs">
                  {knowledgeDocs.map((doc) => (
                    <div key={doc.id} className="p-2.5 rounded bg-slate-900 border border-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white truncate">{doc.title}</span>
                        <span className="font-mono text-[10px] text-[#00C2C7]">v{doc.version}</span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-400">
                        {doc.visibility} · {doc.approvalStatus}
                      </span>
                    </div>
                  ))}
                </div>

                {escalations.length > 0 && (
                  <div className="pt-3 border-t border-slate-800 space-y-1.5">
                    <h3 className="text-xs font-mono text-amber-300 uppercase">Human Escalations ({escalations.length})</h3>
                    {escalations.slice(0, 5).map((esc) => (
                      <div key={esc.id} className="p-2 rounded bg-amber-950/30 border border-amber-500/30 text-xs">
                        <p className="text-white">{esc.reason}</p>
                        <span className="font-mono text-[10px] text-amber-300">
                          {esc.priority} · {esc.userEmail || 'anonymous'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: OPERATIONS, HEALTH, MFA, RBAC & IMMUTABLE AUDIT LOGS */}
        {activeTab === 'operations' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="p-5 rounded-xl bg-[#111827] border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-bold text-white">Integration Health</h2>
                  <button
                    onClick={handleOutboxRetry}
                    className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-[#00C2C7] cursor-pointer"
                  >
                    Trigger Outbox Retry
                  </button>
                </div>
                <div className="space-y-2">
                  {integrations.map((intg) => (
                    <div key={intg.key} className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs gap-2">
                      <div>
                        <p className="font-semibold text-white">{intg.name}</p>
                        <p className="text-slate-400">{intg.detail}</p>
                      </div>
                      <span
                        className={`font-mono uppercase shrink-0 ${
                          intg.status === 'healthy'
                            ? 'text-emerald-400'
                            : intg.status === 'sandbox'
                              ? 'text-[#00C2C7]'
                              : 'text-amber-300'
                        }`}
                      >
                        {intg.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-5 rounded-xl bg-[#111827] border border-slate-800 space-y-4">
                <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <KeyRound className="w-4 h-4 text-[#00C2C7]" />
                  <span>Admin TOTP MFA &amp; System Configuration</span>
                </h2>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 space-y-2 text-xs">
                  <p className="text-slate-300">Enroll RFC 6238 Authenticator for your administrator account:</p>
                  {!mfaEnrollment ? (
                    <button
                      onClick={handleStartMfa}
                      className="px-3 py-1.5 rounded-lg bg-[#00C2C7] text-[#0B1220] font-semibold cursor-pointer"
                    >
                      Generate TOTP Secret
                    </button>
                  ) : (
                    <div className="space-y-2">
                      <p className="font-mono text-[#00C2C7] break-all">Secret: {mfaEnrollment.secret}</p>
                      {mfaEnrollment.otpAuthUri && (
                        <p className="font-mono text-[10px] text-slate-400 break-all">
                          URI: {mfaEnrollment.otpAuthUri}
                        </p>
                      )}
                      <div className="flex gap-2">
                        <input
                          type="text"
                          maxLength={6}
                          value={mfaConfirmCode}
                          onChange={(e) => setMfaConfirmCode(e.target.value)}
                          placeholder="6-digit code"
                          className="w-32 px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 font-mono text-white"
                        />
                        <button
                          onClick={handleConfirmMfa}
                          className="px-3 py-1.5 rounded bg-emerald-600 text-white font-semibold cursor-pointer"
                        >
                          Confirm MFA
                        </button>
                      </div>
                    </div>
                  )}
                  {mfaRecoveryCodes.length > 0 && (
                    <div className="p-2.5 rounded bg-slate-950 border border-amber-500/40 space-y-1.5">
                      <p className="font-semibold text-amber-300">Single-Use Recovery Codes (save securely now):</p>
                      <div className="grid grid-cols-2 gap-1 font-mono text-[11px] text-slate-200">
                        {mfaRecoveryCodes.map((code) => (
                          <span key={code}>{code}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  {configs.map((cfg) => (
                    <div key={cfg.key} className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-[#00C2C7]">{cfg.key}</span>
                        <span className="font-mono text-white">{String(cfg.value)}</span>
                      </div>
                      <p className="text-slate-400 mt-1">{cfg.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-5 rounded-xl bg-[#111827] border border-slate-800 space-y-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-[#00C2C7]" />
                <span>RBAC Role Matrix ({rolesMatrix.length} Enterprise Roles)</span>
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {rolesMatrix.map((r) => (
                  <div key={r.role} className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs">
                    <p className="font-mono font-bold text-[#00C2C7]">{r.role}</p>
                    <p className="text-slate-400 mt-1 leading-relaxed">{r.permissions.join(', ')}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 rounded-xl bg-[#111827] border border-slate-800 space-y-3">
              <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Immutable Audit Logs ({auditLogs.length})</span>
              </h2>
              {auditLogs.length === 0 ? (
                <p className="text-xs text-slate-500">No audit entries recorded in active database.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-mono">
                        <th className="pb-2">TIMESTAMP</th>
                        <th className="pb-2">ACTOR</th>
                        <th className="pb-2">ACTION</th>
                        <th className="pb-2">ENTITY</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {auditLogs.map((log) => (
                        <tr key={log.id}>
                          <td className="py-2 font-mono text-slate-400">{log.createdAt}</td>
                          <td className="py-2 font-mono">{log.actor}</td>
                          <td className="py-2 font-mono text-[#00C2C7]">{log.action}</td>
                          <td className="py-2 font-mono">{log.entityType}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default AdminConsoleApp;
