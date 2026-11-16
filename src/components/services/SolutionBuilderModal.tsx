import React, { useState, useEffect, useRef } from 'react';
import { CatalogService } from '../../types';
import {
  formatCatalogPrice,
  computeConfiguredServiceTotal,
  COMMERCIAL_PRICING_NOTICE,
  EXTERNAL_CHARGES_DISCLOSURE,
} from '../../data/serviceCatalog';
import { COMPANY_CONFIG } from '../../data/companyConfig';
import { apiUrl, createIdempotencyKey } from '../../lib/apiClient';
import {
  X,
  Trash2,
  Send,
  CheckCircle2,
  AlertCircle,
  Bot,
  FileText,
  MailCheck,
  MailWarning,
} from 'lucide-react';

interface SolutionBuilderModalProps {
  isOpen: boolean;
  selectedServices: CatalogService[];
  selectedOptionsMap?: Record<string, string[]>;
  currency: 'USD' | 'PHP';
  phpRate: number;
  onClose: () => void;
  onRemoveService: (serviceId: string) => void;
  onClearAll: () => void;
  onConsultAIWithSelection: (services: CatalogService[]) => void;
}

export const SolutionBuilderModal: React.FC<SolutionBuilderModalProps> = ({
  isOpen,
  selectedServices,
  selectedOptionsMap = {},
  currency,
  phpRate,
  onClose,
  onRemoveService,
  onClearAll,
  onConsultAIWithSelection,
}) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [company, setCompany] = useState('');
  const [industry, setIndustry] = useState('');
  const [targetTimeline, setTargetTimeline] = useState('Standard 4 to 8 Weeks');
  const [projectDescription, setProjectDescription] = useState('');
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [websiteHoneypot, setWebsiteHoneypot] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedRecord, setSubmittedRecord] = useState<{
    referenceId: string;
    summaryText: string;
    emailDeliveryStatus: string;
    emailConfigured: boolean;
  } | null>(null);

  // Stable idempotency key per draft submission; reset only when inputs/services change or after completion
  const idempotencyKeyRef = useRef<string>(createIdempotencyKey());
  const draftSignature = JSON.stringify({
    selectedIds: selectedServices.map((s) => s.id),
    selectedOptionsMap,
    fullName,
    email,
    contactNumber,
    company,
    projectDescription,
    targetTimeline,
  });

  useEffect(() => {
    idempotencyKeyRef.current = createIdempotencyKey();
  }, [draftSignature]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const oneTimeStartingTotal = selectedServices.reduce(
    (sum, svc) => sum + computeConfiguredServiceTotal(svc, selectedOptionsMap[svc.id] || []).oneTimeUsd,
    0
  );

  const monthlyStartingTotal = selectedServices.reduce(
    (sum, svc) => sum + computeConfiguredServiceTotal(svc, selectedOptionsMap[svc.id] || []).monthlyUsd,
    0
  );

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (selectedServices.length === 0) {
      errs.services = 'Please select at least one solution to build your project summary.';
    }
    if (!fullName.trim() || fullName.trim().length < 2) {
      errs.fullName = 'Full name is required (minimum 2 characters).';
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = 'A valid business or personal email is required.';
    }
    if (!contactNumber.trim() || contactNumber.replace(/[^0-9]/g, '').length < 5) {
      errs.contactNumber = 'A valid contact phone number is required.';
    }
    if (!company.trim() || company.trim().length < 2) {
      errs.company = 'Organization or brand name is required.';
    }
    if (!projectDescription.trim() || projectDescription.trim().length < 20) {
      errs.projectDescription = 'Please describe your goals and requirements (minimum 20 characters).';
    }
    if (!privacyConsent) {
      errs.privacyConsent = 'Please confirm authorization for confidential project review.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setSubmitError(null);
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(apiUrl('/api/inquiries'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKeyRef.current,
        },
        body: JSON.stringify({
          idempotencyKey: idempotencyKeyRef.current,
          type: 'solution_builder',
          fullName: fullName.trim(),
          email: email.trim(),
          contactNumber: contactNumber.trim(),
          company: company.trim(),
          industry: industry.trim() || undefined,
          targetTimeline,
          selectedServiceIds: selectedServices.map((s) => s.id),
          selectedOptionsMap,
          projectDescription: projectDescription.trim(),
          preferredCurrency: currency,
          phpConversionRate: phpRate,
          privacyConsent,
          websiteHoneypot,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success || !data.referenceId) {
        throw new Error(
          data.error ||
            'Unable to persist your solution request on the server right now. Your inputs have been preserved so you can retry.'
        );
      }

      const summaryLines = [
        `OPHIREUM MULTIMEDIA PRODUCTION — PRELIMINARY PROJECT SUMMARY`,
        `Reference Number: ${data.referenceId}`,
        `Organization: ${company.trim()} (${fullName.trim()})`,
        `Selected Solutions (${selectedServices.length}):`,
        ...selectedServices.map((s) => {
          const p = formatCatalogPrice(s, currency, phpRate);
          return `  - ${s.title}: ${p.primaryLabel}${p.secondaryLabel ? ` | ${p.secondaryLabel}` : ''}`;
        }),
        `Preliminary Server Estimate: $${Number(
          data.inquiry?.estimatedOneTimeStartingUsd ?? oneTimeStartingTotal
        ).toLocaleString('en-US')} USD${
          (data.inquiry?.estimatedMonthlyStartingUsd ?? monthlyStartingTotal) > 0
            ? ` + $${Number(
                data.inquiry?.estimatedMonthlyStartingUsd ?? monthlyStartingTotal
              ).toLocaleString('en-US')}/month`
            : ''
        }`,
        `Note: ${COMMERCIAL_PRICING_NOTICE}`,
      ].join('\n');

      setSubmittedRecord({
        referenceId: data.referenceId,
        summaryText: summaryLines,
        emailDeliveryStatus: data.emailDelivery?.customerStatus || 'unconfigured',
        emailConfigured: Boolean(data.emailDelivery?.emailConfigured),
      });

      // Clear draft selection ONLY after confirmed server persistence
      onClearAll();
      idempotencyKeyRef.current = createIdempotencyKey();
    } catch (err: any) {
      // Preserve form state so user never loses entered requirements
      setSubmitError(
        err?.message || 'Submission failed. Your form entries remain intact so you may retry.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="solution-builder-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[92vh] bg-[#0B1220] border border-slate-700 rounded-2xl flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 bg-[#111827] border-b border-slate-800 flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-mono text-[#00C2C7]">
              Build Your Solution · Preliminary Project Summary
            </div>
            <h3 id="solution-builder-title" className="text-lg font-bold text-white mt-0.5">
              Custom Multi-Service Solution Request
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C2C7]"
            aria-label="Close solution builder"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6">
          {submittedRecord ? (
            <div className="py-4 space-y-5 max-w-2xl mx-auto">
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-[#00C2C7]/15 border border-[#00C2C7]/40 flex items-center justify-center text-[#00C2C7] mx-auto">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h4 className="text-xl font-bold text-white mt-3">
                  Solution Request Confirmed on Server
                </h4>
                <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#111827] border border-[#00C2C7]/40 text-xs font-mono text-[#00C2C7]">
                  <span>Reference Number:</span>
                  <strong className="text-white">{submittedRecord.referenceId}</strong>
                </div>
              </div>

              {/* Exact Required Block 4 Confirmation Copy */}
              <div className="p-5 rounded-xl bg-[#111827] border border-slate-800 text-xs sm:text-sm text-slate-200 leading-relaxed space-y-3 text-left">
                <p>
                  Thank you for submitting your custom solution request to Ophireum Multimedia Production.
                </p>
                <p>
                  Your inquiry has been recorded under reference number{' '}
                  <strong className="font-mono text-[#00C2C7]">{submittedRecord.referenceId}</strong> and assigned for executive and technical review.
                </p>
                <p>
                  All pricing shown on the website represents preliminary starting investments and estimated configurations only. Final project pricing, timelines, deliverables, and third-party infrastructure, licensing, or platform fees will be confirmed in your formal written proposal.
                </p>
                <p>
                  For urgent project requirements, you may also reach us directly at{' '}
                  <a
                    href={COMPANY_CONFIG.mobileLink}
                    className="font-mono text-[#00C2C7] hover:underline font-semibold"
                  >
                    +63 917 966 8814
                  </a>
                  .
                </p>
                <p>
                  You will be contacted using the email and contact details provided in your request.
                </p>
              </div>

              {/* Honest Email Notification Status */}
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                  submittedRecord.emailDeliveryStatus === 'sent'
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                    : 'bg-amber-950/30 border-amber-500/30 text-amber-200'
                }`}
              >
                {submittedRecord.emailDeliveryStatus === 'sent' ? (
                  <>
                    <MailCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>
                      Confirmation email and executive team notification were delivered via our transactional email service.
                    </span>
                  </>
                ) : (
                  <>
                    <MailWarning className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      {submittedRecord.emailConfigured
                        ? 'Your request is safely stored in our database, while automated email notification queued for retry.'
                        : 'Your request is safely persisted in our server database. Automated email confirmation is currently awaiting transactional email configuration.'}
                    </span>
                  </>
                )}
              </div>

              <pre className="text-left p-4 rounded-xl bg-[#111827] border border-slate-800 text-[11px] font-mono text-slate-300 whitespace-pre-wrap overflow-x-auto">
                {submittedRecord.summaryText}
              </pre>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-[#00C2C7]" />
                  <span>Print Summary</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSubmittedRecord(null);
                    onClose();
                  }}
                  className="px-5 py-2 rounded-lg bg-[#00C2C7] hover:bg-[#00d6dc] text-[#0B1220] text-xs font-semibold cursor-pointer"
                >
                  Return to Solutions
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
              {/* Selected Solutions Column */}
              <div className="lg:col-span-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400">
                    Selected Solutions ({selectedServices.length})
                  </h4>
                  {selectedServices.length > 0 && (
                    <button
                      type="button"
                      onClick={onClearAll}
                      className="text-xs text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                    >
                      Clear All
                    </button>
                  )}
                </div>

                {errors.services && <p className="text-xs text-rose-400">{errors.services}</p>}

                {selectedServices.length === 0 ? (
                  <div className="p-6 rounded-xl bg-[#111827] border border-dashed border-slate-700 text-center text-xs text-slate-400">
                    No services selected yet. Add one or more solutions from the catalog to generate a preliminary project summary.
                  </div>
                ) : (
                  <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                    {selectedServices.map((svc) => {
                      const p = formatCatalogPrice(svc, currency, phpRate);
                      const chosenOptionIds = selectedOptionsMap[svc.id] || [];
                      const chosenOptions = (svc.configurableOptions || []).filter((o) =>
                        chosenOptionIds.includes(o.id)
                      );
                      return (
                        <div
                          key={svc.id}
                          className="p-3 rounded-xl bg-[#111827] border border-slate-800 flex items-start justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="text-xs font-semibold text-white truncate">{svc.title}</div>
                            <div className="text-[11px] font-mono text-[#00C2C7] tabular-nums mt-0.5">
                              {p.primaryLabel}
                            </div>
                            {p.secondaryLabel && (
                              <div className="text-[10px] font-mono text-slate-400 tabular-nums">
                                {p.secondaryLabel}
                              </div>
                            )}
                            {chosenOptions.length > 0 && (
                              <div className="mt-1 space-y-0.5">
                                {chosenOptions.map((opt) => (
                                  <div key={opt.id} className="text-[10px] text-slate-300 font-mono truncate">
                                    + {opt.label}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => onRemoveService(svc.id)}
                            className="p-1 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer shrink-0"
                            aria-label={`Remove ${svc.title}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Preliminary Estimate Summary */}
                <div className="p-4 rounded-xl bg-[#111827] border border-slate-800 space-y-2">
                  <div className="text-[11px] font-mono uppercase text-slate-400">
                    Preliminary Starting Investment
                  </div>
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="text-slate-300">One-Time / Setup Starting:</span>
                    <span className="font-mono font-bold text-white tabular-nums">
                      ${oneTimeStartingTotal.toLocaleString('en-US')} USD
                    </span>
                  </div>
                  {monthlyStartingTotal > 0 && (
                    <div className="flex items-baseline justify-between text-xs">
                      <span className="text-slate-300">Monthly Care / Agent Starting:</span>
                      <span className="font-mono font-bold text-[#00C2C7] tabular-nums">
                        ${monthlyStartingTotal.toLocaleString('en-US')}/month
                      </span>
                    </div>
                  )}
                  {currency === 'PHP' && (
                    <div className="flex items-baseline justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                      <span>Est. PHP Equivalent (@ ₱{phpRate}/USD):</span>
                      <span className="font-mono tabular-nums">
                        ~₱{Math.round(oneTimeStartingTotal * phpRate).toLocaleString('en-US')}
                      </span>
                    </div>
                  )}
                  <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-800 leading-relaxed">
                    Preliminary estimate only—final scope and authoritative pricing are calculated server-side and verified in your formal proposal.
                  </p>
                </div>

                {selectedServices.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onConsultAIWithSelection(selectedServices);
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-[#00C2C7]/40 text-[#00C2C7] text-xs font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <Bot className="w-4 h-4" />
                    <span>Discuss This Combination with AI Consultant</span>
                  </button>
                )}
              </div>

              {/* Client Requirements Form Column */}
              <div className="lg:col-span-7">
                <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
                  {/* Honeypot anti-spam field */}
                  <div className="hidden" aria-hidden="true">
                    <label htmlFor="sb-website">Website</label>
                    <input
                      id="sb-website"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={websiteHoneypot}
                      onChange={(e) => setWebsiteHoneypot(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label htmlFor="sb-name" className="block text-xs font-medium text-slate-300 mb-1">
                        Full Name <span className="text-[#00C2C7]">*</span>
                      </label>
                      <input
                        id="sb-name"
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. Elena Reyes"
                        className="w-full px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00C2C7]"
                      />
                      {errors.fullName && <p className="text-[11px] text-rose-400 mt-1">{errors.fullName}</p>}
                    </div>
                    <div>
                      <label htmlFor="sb-email" className="block text-xs font-medium text-slate-300 mb-1">
                        Business Email <span className="text-[#00C2C7]">*</span>
                      </label>
                      <input
                        id="sb-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="name@company.com"
                        className="w-full px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00C2C7]"
                      />
                      {errors.email && <p className="text-[11px] text-rose-400 mt-1">{errors.email}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label htmlFor="sb-phone" className="block text-xs font-medium text-slate-300 mb-1">
                        Phone / WhatsApp <span className="text-[#00C2C7]">*</span>
                      </label>
                      <input
                        id="sb-phone"
                        type="tel"
                        value={contactNumber}
                        onChange={(e) => setContactNumber(e.target.value)}
                        placeholder="+63 9XX XXX XXXX"
                        className="w-full px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00C2C7]"
                      />
                      {errors.contactNumber && (
                        <p className="text-[11px] text-rose-400 mt-1">{errors.contactNumber}</p>
                      )}
                    </div>
                    <div>
                      <label htmlFor="sb-company" className="block text-xs font-medium text-slate-300 mb-1">
                        Organization / Brand <span className="text-[#00C2C7]">*</span>
                      </label>
                      <input
                        id="sb-company"
                        type="text"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        placeholder="Company Name"
                        className="w-full px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00C2C7]"
                      />
                      {errors.company && <p className="text-[11px] text-rose-400 mt-1">{errors.company}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label htmlFor="sb-industry" className="block text-xs font-medium text-slate-300 mb-1">
                        Industry Sector
                      </label>
                      <input
                        id="sb-industry"
                        type="text"
                        value={industry}
                        onChange={(e) => setIndustry(e.target.value)}
                        placeholder="e.g. Healthcare, Logistics, Retail"
                        className="w-full px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00C2C7]"
                      />
                    </div>
                    <div>
                      <label htmlFor="sb-timeline" className="block text-xs font-medium text-slate-300 mb-1">
                        Target Timeline
                      </label>
                      <select
                        id="sb-timeline"
                        value={targetTimeline}
                        onChange={(e) => setTargetTimeline(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-[#00C2C7] cursor-pointer"
                      >
                        <option value="Immediate / Priority (2 to 4 Weeks)">
                          Immediate / Priority (2 to 4 Weeks)
                        </option>
                        <option value="Standard 4 to 8 Weeks">Standard 4 to 8 Weeks</option>
                        <option value="Phased Enterprise Rollout (2 to 4 Months)">
                          Phased Enterprise Rollout (2 to 4 Months)
                        </option>
                        <option value="Exploratory Planning">Exploratory Planning</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="sb-desc" className="block text-xs font-medium text-slate-300 mb-1">
                      Project Requirements & Objectives <span className="text-[#00C2C7]">*</span>
                    </label>
                    <textarea
                      id="sb-desc"
                      rows={3}
                      value={projectDescription}
                      onChange={(e) => setProjectDescription(e.target.value)}
                      placeholder="Describe your operational goals, existing platforms, integrations, or compliance needs..."
                      className="w-full px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00C2C7]"
                    />
                    {errors.projectDescription && (
                      <p className="text-[11px] text-rose-400 mt-1">{errors.projectDescription}</p>
                    )}
                  </div>

                  <div>
                    <label className="flex items-start gap-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={privacyConsent}
                        onChange={(e) => setPrivacyConsent(e.target.checked)}
                        className="mt-0.5 rounded bg-slate-900 border-slate-700 text-[#00C2C7] focus:ring-[#00C2C7]"
                      />
                      <span>
                        I authorize {COMPANY_CONFIG.name} to review this preliminary project summary and acknowledge that final pricing requires an approved formal proposal.
                      </span>
                    </label>
                    {errors.privacyConsent && (
                      <p className="text-[11px] text-rose-400 mt-1">{errors.privacyConsent}</p>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    {EXTERNAL_CHARGES_DISCLOSURE}
                  </p>

                  {submitError && (
                    <div
                      role="alert"
                      className="p-3 rounded-lg bg-rose-950/50 border border-rose-500/40 text-xs text-rose-300 flex items-start gap-2"
                    >
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>{submitError}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 px-5 rounded-lg bg-[#00C2C7] hover:bg-[#00d6dc] disabled:opacity-50 text-[#0B1220] font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    {isSubmitting ? (
                      <span>Persisting & Submitting Request...</span>
                    ) : (
                      <>
                        <span>Submit Preliminary Solution Request</span>
                        <Send className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
