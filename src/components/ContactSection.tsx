import React, { useState, useEffect, useRef } from 'react';
import { servicesData } from '../data/servicesData';
import { CATALOG_CATEGORIES, SERVICE_CATALOG } from '../data/serviceCatalog';
import { InquiryFormData } from '../types';
import {
  Send,
  CheckCircle2,
  AlertCircle,
  Paperclip,
  FileText,
  Shield,
  MapPin,
  Building,
  Phone,
  Mail,
  ExternalLink,
  User,
} from 'lucide-react';
import { COMPANY_CONFIG } from '../data/companyConfig';
import { apiUrl, createIdempotencyKey } from '../lib/apiClient';

interface ContactSectionProps {
  selectedServiceId?: string;
  onInquirySubmitted?: (inquiry: any) => void;
}

export const ContactSection: React.FC<ContactSectionProps> = ({
  selectedServiceId,
  onInquirySubmitted,
}) => {
  const [formData, setFormData] = useState<InquiryFormData>({
    fullName: '',
    email: '',
    contactNumber: '',
    company: '',
    serviceId: selectedServiceId || 'multimedia-production',
    projectDescription: '',
    estimatedBudget: 'undisclosed',
    fileName: '',
    privacyConsent: false,
  });

  useEffect(() => {
    if (selectedServiceId) {
      setFormData((prev) => ({ ...prev, serviceId: selectedServiceId }));
    }
  }, [selectedServiceId]);

  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [websiteHoneypot, setWebsiteHoneypot] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedRecord, setSubmittedRecord] = useState<{
    referenceId: string;
    emailDeliveryStatus: string;
    emailConfigured: boolean;
  } | null>(null);

  const idempotencyKeyRef = useRef<string>(createIdempotencyKey());
  useEffect(() => {
    idempotencyKeyRef.current = createIdempotencyKey();
  }, [formData]);

  const budgetOptions = [
    { value: 'undisclosed', label: 'To be determined / Flexible' },
    { value: 'under-50k', label: 'Under ₱50,000 / $1,000' },
    { value: '50k-150k', label: '₱50,000 - ₱150,000 / $1,000 - $3,000' },
    { value: '150k-500k', label: '₱150,000 - ₱500,000 / $3,000 - $10,000' },
    { value: '500k-plus', label: '₱500,000+ / $10,000+ Enterprise Tier' },
  ];

  const validate = (): boolean => {
    const errs: { [key: string]: string } = {};

    if (!formData.fullName.trim() || formData.fullName.trim().length < 2) {
      errs.fullName = 'Full legal name is required.';
    }

    if (!formData.email.trim()) {
      errs.email = 'Corporate or personal email address is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errs.email = 'Please provide a valid email format.';
    }

    if (!formData.contactNumber.trim() || formData.contactNumber.replace(/[^0-9]/g, '').length < 5) {
      errs.contactNumber = 'Contact phone number is required.';
    }

    if (!formData.company.trim() || formData.company.trim().length < 2) {
      errs.company = 'Organization or brand name is required.';
    }

    if (!formData.projectDescription.trim() || formData.projectDescription.trim().length < 20) {
      errs.projectDescription = 'Please describe your project scope in at least 20 characters.';
    }

    if (!formData.privacyConsent) {
      errs.privacyConsent = 'You must acknowledge the enterprise data privacy terms.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 25 * 1024 * 1024) {
        setErrors((prev) => ({ ...prev, fileName: 'File size exceeds 25MB limit.' }));
      } else {
        setFormData((prev) => ({ ...prev, fileName: file.name }));
        setErrors((prev) => {
          const rest = { ...prev };
          delete rest.fileName;
          return rest;
        });
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setSubmitError(null);
    if (!validate()) return;

    setIsSubmitting(true);

    const matchedCatalog = SERVICE_CATALOG.find((s) => s.id === formData.serviceId);
    const matchedLegacy = servicesData.find((s) => s.id === formData.serviceId);
    const resolvedTitle = matchedCatalog?.title || matchedLegacy?.title || formData.serviceId;

    try {
      const response = await fetch(apiUrl('/api/inquiries'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKeyRef.current,
        },
        body: JSON.stringify({
          idempotencyKey: idempotencyKeyRef.current,
          type: 'contact_form',
          fullName: formData.fullName.trim(),
          email: formData.email.trim(),
          contactNumber: formData.contactNumber.trim(),
          company: formData.company.trim(),
          serviceId: formData.serviceId,
          serviceTitle: resolvedTitle,
          selectedServiceIds: matchedCatalog ? [matchedCatalog.id] : [],
          estimatedBudget: formData.estimatedBudget,
          projectDescription: formData.projectDescription.trim(),
          fileName: formData.fileName || undefined,
          privacyConsent: formData.privacyConsent,
          websiteHoneypot,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success || !data.referenceId) {
        throw new Error(
          data.error ||
            'Unable to persist your inquiry on the server right now. Your inputs remain intact so you can retry.'
        );
      }

      if (onInquirySubmitted) {
        onInquirySubmitted(data.inquiry);
      }

      setSubmittedRecord({
        referenceId: data.referenceId,
        emailDeliveryStatus: data.emailDelivery?.customerStatus || 'unconfigured',
        emailConfigured: Boolean(data.emailDelivery?.emailConfigured),
      });
      idempotencyKeyRef.current = createIdempotencyKey();
    } catch (err: any) {
      setSubmitError(
        err?.message || 'Submission failed. Your details are preserved—please review or contact us directly.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      fullName: '',
      email: '',
      contactNumber: '',
      company: '',
      serviceId: 'multimedia-production',
      projectDescription: '',
      estimatedBudget: 'undisclosed',
      fileName: '',
      privacyConsent: false,
    });
    setSubmittedRecord(null);
    setErrors({});
    setSubmitError(null);
  };

  return (
    <section id="contact" className="py-20 lg:py-28 bg-[#0B1220] border-t border-slate-800/80 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16">
          {/* Left Column */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-8">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#00C2C7] uppercase tracking-wider mb-2">
                <span>Start Your Project</span>
                <span aria-hidden="true">·</span>
                <span>Direct Executive Routing</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white text-balance">
                Engage Ophireum Network for Your Next Assignment
              </h2>
              <p className="mt-4 text-sm sm:text-base text-slate-300 leading-relaxed text-balance">
                Submissions are received directly by the executive production and engineering leads of {COMPANY_CONFIG.name}. Every brief receives an initial technical review within 24 business hours.
              </p>

              <div className="mt-8 space-y-4">
                <div className="p-4 rounded-xl bg-[#111827] border border-slate-800 flex items-start gap-3.5">
                  <User className="w-5 h-5 text-[#00C2C7] shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-mono text-slate-400 block uppercase">
                      Founder / Chief Executive Officer
                    </span>
                    <span className="text-sm font-semibold text-white">{COMPANY_CONFIG.founderCeo}</span>
                    <div className="mt-1">
                      <a
                        href={COMPANY_CONFIG.mobileLink}
                        className="inline-flex items-center gap-1.5 text-xs font-mono text-[#00C2C7] hover:underline"
                      >
                        <Phone className="w-3 h-3" />
                        <span>{COMPANY_CONFIG.mobile}</span>
                      </a>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#111827] border border-slate-800 flex items-start gap-3.5">
                  <Building className="w-5 h-5 text-[#00C2C7] shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="text-xs font-mono text-slate-400 block uppercase">
                      Official Office Address
                    </span>
                    <span className="text-sm font-semibold text-white">{COMPANY_CONFIG.address.line1}</span>
                    <p className="text-xs text-slate-300">{COMPANY_CONFIG.address.line2}</p>
                    <p className="text-xs text-slate-300">{COMPANY_CONFIG.address.zone}</p>
                    <p className="text-xs text-slate-400 font-mono">{COMPANY_CONFIG.address.cityPostal}</p>
                    <div className="pt-2">
                      <a
                        href={COMPANY_CONFIG.address.mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-[#00C2C7] hover:text-white transition-colors"
                      >
                        <MapPin className="w-3 h-3" />
                        <span>View Office on Google Maps</span>
                        <ExternalLink className="w-3 h-3 ml-0.5" />
                      </a>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#111827] border border-slate-800 flex items-start gap-3.5">
                  <Shield className="w-5 h-5 text-[#D4AF37] shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-mono text-slate-400 block uppercase">
                      Non-Disclosure & Confidentiality
                    </span>
                    <span className="text-sm font-semibold text-white">
                      Strict Enterprise Non-Disclosure Guarantee
                    </span>
                    <p className="text-xs text-slate-400 mt-0.5">
                      All shared project briefs and documents are protected under proprietary commercial confidentiality.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#111827] border border-slate-800 flex items-start gap-3.5">
                  <Mail className="w-5 h-5 text-[#C0C7D1] shrink-0 mt-0.5" />
                  <div>
                    <span className="text-xs font-mono text-slate-400 block uppercase">
                      Administrative Dispatch Routing
                    </span>
                    <span className="text-sm font-semibold text-white font-mono">
                      {COMPANY_CONFIG.configurableEmail}
                    </span>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Configurable company dispatch channel monitored by executive administrators.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800/80 text-xs text-slate-400">
              <span>Direct inquiries are monitored Monday to Friday, 8:00 AM – 6:00 PM (PST / UTC+8).</span>
            </div>
          </div>

          {/* Right Column */}
          <div className="lg:col-span-7">
            <div className="rounded-2xl bg-[#111827] border border-slate-800 p-6 sm:p-8 relative shadow-2xl">
              {submittedRecord ? (
                <div className="py-8 text-center space-y-4">
                  <div className="w-14 h-14 rounded-full bg-[#00C2C7]/10 border border-[#00C2C7]/30 flex items-center justify-center text-[#00C2C7] mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-white">Inquiry Recorded Successfully</h3>
                  <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                    Your inquiry has been persisted under reference number{' '}
                    <span className="font-mono text-[#00C2C7] font-bold">
                      {submittedRecord.referenceId}
                    </span>{' '}
                    and assigned for review by Founder & CEO{' '}
                    <span className="text-white font-semibold">{COMPANY_CONFIG.founderCeo}</span> and the engineering team.
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-md mx-auto">
                    {submittedRecord.emailDeliveryStatus === 'sent'
                      ? 'Confirmation email dispatched to your inbox.'
                      : 'Database persistence verified. Automated email notification awaits transactional email configuration.'}
                  </p>
                  <div className="pt-4 flex justify-center gap-3">
                    <button
                      onClick={resetForm}
                      className="px-5 py-2.5 text-xs font-semibold text-[#0B1220] bg-[#00C2C7] hover:bg-[#00d6dc] rounded-lg cursor-pointer transition-all"
                    >
                      Submit Another Inquiry
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                  <div className="hidden" aria-hidden="true">
                    <label htmlFor="contact-website-hp">Company Website</label>
                    <input
                      id="contact-website-hp"
                      type="text"
                      tabIndex={-1}
                      autoComplete="off"
                      value={websiteHoneypot}
                      onChange={(e) => setWebsiteHoneypot(e.target.value)}
                    />
                  </div>
                  {submitError && (
                    <div
                      role="alert"
                      className="p-3 rounded-lg bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200 flex items-start gap-2"
                    >
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                      <span>{submitError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Full Legal Name <span className="text-[#00C2C7]">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        placeholder="e.g. Maria Santos"
                        className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00C2C7] focus:ring-1 focus:ring-[#00C2C7]"
                      />
                      {errors.fullName && <p className="text-[11px] text-rose-400 mt-1">{errors.fullName}</p>}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Corporate or Contact Email <span className="text-[#00C2C7]">*</span>
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        placeholder="e.g. contact@organization.com"
                        className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00C2C7] focus:ring-1 focus:ring-[#00C2C7]"
                      />
                      {errors.email && <p className="text-[11px] text-rose-400 mt-1">{errors.email}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Contact Phone / Mobile <span className="text-[#00C2C7]">*</span>
                      </label>
                      <input
                        type="tel"
                        value={formData.contactNumber}
                        onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                        placeholder="+63 9XX XXX XXXX"
                        className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00C2C7] focus:ring-1 focus:ring-[#00C2C7]"
                      />
                      {errors.contactNumber && (
                        <p className="text-[11px] text-rose-400 mt-1">{errors.contactNumber}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Company or Brand Name <span className="text-[#00C2C7]">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.company}
                        onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                        placeholder="e.g. Clark Aero Dynamics"
                        className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00C2C7] focus:ring-1 focus:ring-[#00C2C7]"
                      />
                      {errors.company && <p className="text-[11px] text-rose-400 mt-1">{errors.company}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Service Category Required <span className="text-[#00C2C7]">*</span>
                      </label>
                      <select
                        value={formData.serviceId}
                        onChange={(e) => setFormData({ ...formData, serviceId: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-[#00C2C7] focus:ring-1 focus:ring-[#00C2C7] cursor-pointer"
                      >
                        <optgroup label="Core Company Disciplines">
                          {servicesData.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.number}. {s.title}
                            </option>
                          ))}
                        </optgroup>
                        {CATALOG_CATEGORIES.filter((c) => c.id !== 'all').map((cat) => (
                          <optgroup key={cat.id} label={`${cat.number}. ${cat.label}`}>
                            {SERVICE_CATALOG.filter((item) => item.categoryId === cat.id).map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.title} (Starting at ${item.pricing.startingUsd.toLocaleString('en-US')}
                                {item.pricing.model === 'subscription_monthly' ? '/mo' : ''})
                              </option>
                            ))}
                          </optgroup>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Estimated Budget Range (Optional)
                      </label>
                      <select
                        value={formData.estimatedBudget}
                        onChange={(e) => setFormData({ ...formData, estimatedBudget: e.target.value })}
                        className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white focus:outline-none focus:border-[#00C2C7] focus:ring-1 focus:ring-[#00C2C7] cursor-pointer"
                      >
                        {budgetOptions.map((b) => (
                          <option key={b.value} value={b.value}>
                            {b.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Project Scope & Objectives <span className="text-[#00C2C7]">*</span>
                    </label>
                    <textarea
                      rows={4}
                      value={formData.projectDescription}
                      onChange={(e) => setFormData({ ...formData, projectDescription: e.target.value })}
                      placeholder="Outline your target deliverables, timeline expectations, media format requirements, or software specifications..."
                      className="w-full px-3.5 py-2.5 rounded-lg bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00C2C7] focus:ring-1 focus:ring-[#00C2C7]"
                    />
                    {errors.projectDescription && (
                      <p className="text-[11px] text-rose-400 mt-1">{errors.projectDescription}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Reference Brief Filename (Optional — Metadata Only; Full Uploads Inside Client Portal)
                    </label>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-200 cursor-pointer transition-colors">
                        <Paperclip className="w-3.5 h-3.5 text-[#00C2C7]" />
                        <span>Select Reference File</span>
                        <input
                          type="file"
                          onChange={handleFileUpload}
                          className="hidden"
                          accept=".pdf,.doc,.docx,.zip,.png,.jpg,.jpeg"
                        />
                      </label>
                      {formData.fileName ? (
                        <span className="text-xs text-[#00C2C7] truncate flex items-center gap-1.5 font-mono">
                          <FileText className="w-3.5 h-3.5" />
                          {formData.fileName}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">Logs filename reference only (PDF, Word, ZIP, Image)</span>
                      )}
                    </div>
                    {errors.fileName && <p className="text-[11px] text-rose-400 mt-1">{errors.fileName}</p>}
                  </div>

                  <div className="pt-2">
                    <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={formData.privacyConsent}
                        onChange={(e) => setFormData({ ...formData, privacyConsent: e.target.checked })}
                        className="mt-0.5 rounded bg-slate-900 border-slate-700 text-[#00C2C7] focus:ring-[#00C2C7]"
                      />
                      <span>
                        I acknowledge and authorize {COMPANY_CONFIG.name} to process this project brief under corporate confidentiality and data privacy guidelines.
                      </span>
                    </label>
                    {errors.privacyConsent && (
                      <p className="text-[11px] text-rose-400 mt-1">{errors.privacyConsent}</p>
                    )}
                  </div>

                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-3 px-6 text-sm font-semibold text-[#0B1220] bg-[#00C2C7] hover:bg-[#00d6dc] disabled:opacity-50 rounded-lg shadow-lg shadow-[#00C2C7]/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isSubmitting ? (
                        <span>Validating and Saving Request...</span>
                      ) : (
                        <>
                          <span>Submit Project Brief</span>
                          <Send className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
