import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  Shield,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Send,
} from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { COMPANY_CONFIG } from '../data/companyConfig';
import { apiUrl } from '../lib/apiClient';
import { getCurrentPortalLocation, navigateToAppPath } from '../portal/PortalRouter';

interface PolicyDoc {
  slug: string;
  title: string;
  versionTag: string;
  reviewStatus: 'pending_legal_review' | 'approved';
  applicableLaws: string[];
  summary: string;
  sections: Array<{ heading: string; body: string }>;
}

export const LegalPagesApp: React.FC = () => {
  const [policies, setPolicies] = useState<PolicyDoc[]>([]);
  const [legalReviewNotice, setLegalReviewNotice] = useState('');
  const [activeSlug, setActiveSlug] = useState<string>(() => {
    const loc = getCurrentPortalLocation().pathname;
    const slug = loc.replace(/^\/legal\/?/, '').split('/')[0];
    return slug || 'privacy-policy';
  });
  const [loading, setLoading] = useState(true);

  // Consent acknowledgement
  const [consentEmail, setConsentEmail] = useState('');
  const [consentStatus, setConsentStatus] = useState<string | null>(null);

  // Data Subject Request / Complaint form
  const [dsrName, setDsrName] = useState('');
  const [dsrEmail, setDsrEmail] = useState('');
  const [dsrType, setDsrType] = useState<
    'data_access' | 'data_export' | 'rectification' | 'erasure' | 'objection' | 'complaint'
  >('data_access');
  const [dsrDetails, setDsrDetails] = useState('');
  const [dsrSubmitting, setDsrSubmitting] = useState(false);
  const [dsrResult, setDsrResult] = useState<{ referenceCode?: string; error?: string } | null>(null);

  useEffect(() => {
    fetch(apiUrl('/api/legal/policies'))
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.policies)) setPolicies(data.policies);
        if (data.legalReviewNotice) setLegalReviewNotice(data.legalReviewNotice);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const sync = () => {
      const loc = getCurrentPortalLocation().pathname;
      const slug = loc.replace(/^\/legal\/?/, '').split('/')[0];
      if (slug) setActiveSlug(slug);
    };
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    window.addEventListener('opm:routechange', sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('opm:routechange', sync);
    };
  }, []);

  const currentPolicy = policies.find((p) => p.slug === activeSlug) || policies[0];

  const handleSelectPolicy = (slug: string) => {
    setActiveSlug(slug);
    navigateToAppPath(`/legal/${slug}`);
  };

  const handleRecordConsent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPolicy || !consentEmail.trim()) return;
    setConsentStatus(null);
    try {
      const res = await fetch(apiUrl('/api/legal/consents'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: consentEmail.trim(),
          policySlug: currentPolicy.slug,
          accepted: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not record consent.');
      setConsentStatus(`Consent recorded (${data.consent.policyVersion}) at ${data.consent.createdAt}.`);
    } catch (err: any) {
      setConsentStatus(err?.message || 'Consent recording failed.');
    }
  };

  const handleSubmitDsr = async (e: React.FormEvent) => {
    e.preventDefault();
    setDsrSubmitting(true);
    setDsrResult(null);
    try {
      const res = await fetch(apiUrl('/api/legal/privacy-requests'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requesterName: dsrName.trim(),
          requesterEmail: dsrEmail.trim(),
          requestType: dsrType,
          details: dsrDetails.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Submission failed.');
      setDsrResult({ referenceCode: data.request.referenceCode });
      setDsrDetails('');
    } catch (err: any) {
      setDsrResult({ error: err?.message || 'Unable to submit request.' });
    } finally {
      setDsrSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1220] text-slate-100 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-[#111827]/95 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BrandLogo variant="emblem" size="sm" ring="gold" eager decorative />
            <div>
              <span className="text-xs font-bold tracking-wider uppercase text-white block">
                {COMPANY_CONFIG.name}
              </span>
              <span className="text-[11px] font-mono text-[#00C2C7]">
                Legal, Privacy &amp; Compliance Center
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateToAppPath('/portal/privacy')}
              className="px-3 py-1.5 rounded-lg border border-slate-700 text-xs text-slate-200 hover:border-[#00C2C7] cursor-pointer"
            >
              Portal Privacy Controls
            </button>
            <button
              onClick={() => navigateToAppPath('/')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-white cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Public Site</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Mandatory Legal Review Governance Banner */}
        <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-500/40 flex items-start gap-3 text-xs text-amber-100">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-300 uppercase font-mono tracking-wide">
              Governance Notice · Pending Owner &amp; Qualified Legal Review
            </p>
            <p className="mt-1 text-amber-100/90 leading-relaxed">
              {legalReviewNotice ||
                'All legal, privacy, refund, licensing, and AI disclosure documents below are compliance-ready drafts awaiting final sign-off by OPHIREUM MULTIMEDIA PRODUCTION ownership and qualified Philippine legal counsel.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Policy Directory Sidebar */}
          <aside className="lg:col-span-4 space-y-2">
            <div className="bg-[#111827] border border-slate-800 rounded-xl p-4">
              <h2 className="text-xs font-mono uppercase text-slate-400 tracking-wider mb-3 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-[#00C2C7]" />
                <span>Policy Documents ({policies.length})</span>
              </h2>
              <div className="space-y-1">
                {policies.map((p) => (
                  <button
                    key={p.slug}
                    onClick={() => handleSelectPolicy(p.slug)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition-colors cursor-pointer flex items-center justify-between gap-2 ${
                      currentPolicy?.slug === p.slug
                        ? 'bg-[#00C2C7]/15 border border-[#00C2C7]/40 text-white font-semibold'
                        : 'text-slate-300 hover:bg-slate-800/80 border border-transparent'
                    }`}
                  >
                    <span className="truncate">{p.title}</span>
                    <span className="font-mono text-[10px] text-amber-300 shrink-0">{p.versionTag}</span>
                  </button>
                ))}
              </div>
            </div>
          </aside>

          {/* Policy Reader & Interactive Intake */}
          <section className="lg:col-span-8 space-y-6">
            {loading ? (
              <div className="p-8 rounded-xl bg-[#111827] border border-slate-800 text-sm text-slate-400">
                Loading legal policies...
              </div>
            ) : currentPolicy ? (
              <article className="p-6 rounded-xl bg-[#111827] border border-slate-800 space-y-5">
                <div className="border-b border-slate-800 pb-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] font-mono text-[#00C2C7] uppercase">
                      Version {currentPolicy.versionTag} · Status: {currentPolicy.reviewStatus}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      DTI Reg. No. {COMPANY_CONFIG.dti.registrationNo}
                    </span>
                  </div>
                  <h1 className="text-2xl font-bold text-white mt-2">{currentPolicy.title}</h1>
                  <p className="text-sm text-slate-300 mt-2">{currentPolicy.summary}</p>
                  <p className="text-xs font-mono text-slate-400 mt-2">
                    Regulatory Reference: {currentPolicy.applicableLaws.join(' · ')}
                  </p>
                </div>

                <div className="space-y-4">
                  {currentPolicy.sections.map((sec) => (
                    <div key={sec.heading} className="space-y-1.5">
                      <h3 className="text-sm font-semibold text-white">{sec.heading}</h3>
                      <p className="text-sm text-slate-300 leading-relaxed">{sec.body}</p>
                    </div>
                  ))}
                </div>

                {/* Consent Recorder */}
                <form
                  onSubmit={handleRecordConsent}
                  className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center gap-2"
                >
                  <input
                    type="email"
                    required
                    value={consentEmail}
                    onChange={(e) => setConsentEmail(e.target.value)}
                    placeholder="Enter your email to log policy acknowledgement..."
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-[#00C2C7] hover:bg-[#00d6dc] text-[#0B1220] text-xs font-semibold cursor-pointer whitespace-nowrap"
                  >
                    Record Consent
                  </button>
                </form>
                {consentStatus && (
                  <p className="text-xs text-emerald-400 font-mono flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{consentStatus}</span>
                  </p>
                )}
              </article>
            ) : null}

            {/* Data Subject Request & Complaint Intake */}
            <div className="p-6 rounded-xl bg-[#111827] border border-slate-800 space-y-4">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-[#00C2C7]" />
                <h2 className="text-base font-bold text-white">
                  Data Subject Request (RA 10173) &amp; Customer Complaint Intake
                </h2>
              </div>
              <form onSubmit={handleSubmitDsr} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    required
                    value={dsrName}
                    onChange={(e) => setDsrName(e.target.value)}
                    placeholder="Full Name"
                    className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                  />
                  <input
                    type="email"
                    required
                    value={dsrEmail}
                    onChange={(e) => setDsrEmail(e.target.value)}
                    placeholder="Email Address"
                    className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                  />
                  <select
                    value={dsrType}
                    onChange={(e) => setDsrType(e.target.value as any)}
                    className="px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                  >
                    <option value="data_access">Data Access Request</option>
                    <option value="data_export">Data Portability / Export</option>
                    <option value="rectification">Data Rectification</option>
                    <option value="erasure">Data Erasure / Deletion</option>
                    <option value="objection">Objection to Processing</option>
                    <option value="complaint">Customer / Dispute Complaint</option>
                  </select>
                </div>
                <textarea
                  rows={3}
                  required
                  value={dsrDetails}
                  onChange={(e) => setDsrDetails(e.target.value)}
                  placeholder="Describe your privacy request, affected account email, or dispute reference..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                />
                <button
                  type="submit"
                  disabled={dsrSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#00C2C7] hover:bg-[#00d6dc] text-[#0B1220] text-xs font-semibold disabled:opacity-50 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{dsrSubmitting ? 'Logging Request...' : 'Submit Formal Request'}</span>
                </button>
              </form>
              {dsrResult?.referenceCode && (
                <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-xs text-emerald-200 font-mono">
                  Request logged successfully. Tracking Reference: {dsrResult.referenceCode}
                </div>
              )}
              {dsrResult?.error && (
                <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200">
                  {dsrResult.error}
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default LegalPagesApp;
