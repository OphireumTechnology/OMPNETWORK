import React, { useState } from 'react';
import { 
  Building, Phone, MapPin, Eye, Check, Target, 
  Compass, UserCheck, ExternalLink, ShieldCheck, FileCheck,
  Maximize2, X, Download, ShieldAlert, BadgeCheck
} from 'lucide-react';
import { GlobalDigitalGlobe } from './animations/GlobalDigitalGlobe';
import { COMPANY_CONFIG } from '../data/companyConfig';

interface AboutSectionProps {
  onOpenPortal: () => void;
}

export const AboutSection: React.FC<AboutSectionProps> = ({ onOpenPortal }) => {
  const [showBrandBoardModal, setShowBrandBoardModal] = useState(false);
  const [showCertificateModal, setShowCertificateModal] = useState(false);

  return (
    <section id="about" className="py-20 lg:py-28 bg-[#0B1220] border-t border-slate-800/80 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#00C2C7] uppercase tracking-wider mb-2 font-mono">
            <span>Corporate Profile & Governance</span>
            <span aria-hidden="true">·</span>
            <span>Clark Freeport Zone Headquarters</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white text-balance leading-tight">
            Engineered for Media Excellence and Connected Technology
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-300 leading-relaxed text-balance">
            {COMPANY_CONFIG.name} operates at the nexus of cinema-grade production, autonomous artificial intelligence, and enterprise software engineering.
          </p>
        </div>

        {/* Founder / CEO Profile & Official Office Location Highlight Card */}
        <div className="mt-12 rounded-2xl bg-gradient-to-br from-[#111827] via-[#0B1220] to-[#111827] border border-slate-700/80 p-6 sm:p-8 shadow-xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Executive Leadership Left Block */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center gap-2 text-xs font-mono text-[#00C2C7] uppercase tracking-wider">
                <UserCheck className="w-4 h-4 text-[#00C2C7]" />
                <span>Executive Leadership Profile</span>
              </div>

              <div>
                <span className="text-xs text-slate-400 uppercase tracking-wider font-mono">Founder / Chief Executive Officer</span>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                  {COMPANY_CONFIG.founderCeo}
                </h3>
                <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                  Leading the strategic convergence of high-impact multimedia artistry with cutting-edge artificial intelligence, distributed cloud infrastructure, and modern enterprise software systems.
                </p>
              </div>

              {/* Direct Official Contact Strip */}
              <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-mono">
                <a
                  href={COMPANY_CONFIG.mobileLink}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-700 text-[#00C2C7] hover:border-[#00C2C7] transition-all"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>{COMPANY_CONFIG.mobile}</span>
                </a>

                <div className="text-slate-400">
                  Direct Executive Line · Mon–Fri 8:00 AM–6:00 PM (PST)
                </div>
              </div>
            </div>

            {/* Official Office Address Right Block with Maps Action */}
            <div className="lg:col-span-5 p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-mono text-[#00C2C7] uppercase">Corporate Office Address</span>
                <Building className="w-4 h-4 text-slate-400" />
              </div>

              <div className="space-y-1 text-sm">
                <p className="font-bold text-white">{COMPANY_CONFIG.address.line1}</p>
                <p className="text-slate-300 text-xs">{COMPANY_CONFIG.address.line2}</p>
                <p className="text-slate-300 text-xs">{COMPANY_CONFIG.address.zone}</p>
                <p className="text-slate-400 text-xs font-mono">{COMPANY_CONFIG.address.cityPostal}</p>
              </div>

              <div className="pt-2 border-t border-slate-800/80">
                <a
                  href={COMPANY_CONFIG.address.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#00C2C7] hover:text-white transition-colors"
                >
                  <span>Open Location in Google Maps</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

          </div>
        </div>

        {/* DTI BUSINESS REGISTRATION SECTION — 2-COLUMN LUXURY ENTERPRISE LAYOUT */}
        <div id="registration" className="mt-14 rounded-2xl bg-gradient-to-br from-[#111827] via-[#0B1220] to-[#111827] border border-slate-700/80 p-6 sm:p-10 shadow-2xl relative overflow-hidden">
          
          {/* Subtle gold accent lighting halo */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-[#D4AF37]/5 blur-[120px] rounded-full pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#00C2C7]/5 blur-[120px] rounded-full pointer-events-none" />

          {/* Section Header */}
          <div className="flex items-center justify-between border-b border-slate-800 pb-5 mb-8 flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-mono text-[#D4AF37] uppercase tracking-wider mb-1">
                <BadgeCheck className="w-4 h-4 text-[#D4AF37]" />
                <span>Republic of the Philippines · Department of Trade and Industry</span>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white">
                Official Business Registration
              </h3>
            </div>
            <div className="px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-xs font-mono text-[#D4AF37]">
              BN Registration No. {COMPANY_CONFIG.dti.registrationNo}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            {/* Left Column: Official Registration Details */}
            <div className="lg:col-span-7 space-y-6">
              
              <div className="space-y-4">
                <div>
                  <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block">Registered Business Name</span>
                  <div className="text-lg sm:text-xl font-bold text-white mt-0.5 tracking-wide">
                    {COMPANY_CONFIG.dti.businessName}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                    <span className="text-[11px] font-mono text-slate-400 uppercase block">Registration Number</span>
                    <span className="text-sm font-bold text-[#00C2C7] font-mono mt-0.5 block">
                      {COMPANY_CONFIG.dti.registrationNo}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800">
                    <span className="text-[11px] font-mono text-slate-400 uppercase block">Registered Owner</span>
                    <span className="text-sm font-bold text-white mt-0.5 block">
                      {COMPANY_CONFIG.dti.registeredOwner}
                    </span>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                  <div>
                    <span className="text-[11px] font-mono text-slate-400 uppercase block">Scope / Jurisdiction</span>
                    <span className="text-xs sm:text-sm font-medium text-slate-200 mt-0.5 block">
                      {COMPANY_CONFIG.dti.scopeLocation}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-800 flex flex-wrap items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-400 font-mono text-[11px] block">Registration Validity:</span>
                      <span className="font-semibold text-emerald-400 font-mono">
                        {COMPANY_CONFIG.dti.validity}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 font-mono text-[11px] block">Statutory Act:</span>
                      <span className="text-slate-300 font-mono">Act 3883 / RA 863</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons & Notice */}
              <div className="pt-2 flex flex-wrap items-center gap-3">
                <button
                  onClick={() => setShowCertificateModal(true)}
                  className="px-4 py-2.5 rounded-lg bg-[#D4AF37]/15 hover:bg-[#D4AF37]/25 text-[#D4AF37] border border-[#D4AF37]/40 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span>Enlarge Certificate Preview</span>
                </button>

                <button
                  onClick={() => setShowCertificateModal(true)}
                  className="px-4 py-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer"
                >
                  <FileCheck className="w-3.5 h-3.5 text-[#00C2C7]" />
                  <span>View Original DTI Certificate</span>
                </button>
              </div>

              <div className="text-[11px] text-slate-400 flex items-start gap-2 pt-1">
                <ShieldAlert className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  Refer to the official original DTI certificate for legal, contractual, and regulatory compliance.
                </p>
              </div>

            </div>

            {/* Right Column: Certificate Image Presentation in Gold Accent Frame */}
            <div className="lg:col-span-5 flex flex-col items-center">
              
              <div 
                onClick={() => setShowCertificateModal(true)}
                className="relative group cursor-pointer w-full max-w-[340px] sm:max-w-[380px] rounded-2xl p-2.5 bg-gradient-to-b from-[#1c2436] via-[#111827] to-[#0B1220] border border-[#D4AF37]/40 shadow-2xl transition-all duration-300 hover:border-[#D4AF37] hover:shadow-[#D4AF37]/15"
                title="Click to view full-screen certificate presentation"
              >
                {/* Gold outer rim lining */}
                <div className="relative rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center border border-[#D4AF37]/30">
                  <img
                    src={COMPANY_CONFIG.dtiCertificateUrl}
                    alt="Philippines DTI Certificate of Business Name Registration for OPHIREUM MULTIMEDIA PRODUCTION"
                    className="w-full h-auto max-h-[460px] object-contain transition-transform duration-500 group-hover:scale-[1.01]"
                    loading="lazy"
                  />

                  {/* Hover Overlay Prompt */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center p-4 text-center">
                    <div className="w-10 h-10 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37] flex items-center justify-center text-[#D4AF37] mb-2 shadow-lg">
                      <Maximize2 className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-white tracking-wide">
                      Click to Enlarge Certificate
                    </span>
                    <span className="text-[10px] text-slate-300 mt-1">
                      Full-Screen High-Resolution View
                    </span>
                  </div>
                </div>

                {/* Metallic Gold Corner Accents */}
                <div className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 border-[#D4AF37]" />
                <div className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 border-[#D4AF37]" />
                <div className="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 border-[#D4AF37]" />
                <div className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 border-[#D4AF37]" />
              </div>

              {/* Mandatory Caption Below Certificate */}
              <div className="mt-3 text-center max-w-sm">
                <p className="text-[10.5px] font-mono text-slate-400 italic leading-snug">
                  Illustrative Certificate Presentation — Refer to the original DTI certificate for official documentation.
                </p>
              </div>

            </div>

          </div>

        </div>

        {/* Global Digital Network Globe & Corporate Vision / Mission Grid */}
        <div className="mt-14 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          
          {/* Animated Global Digital Network Visualization */}
          <div className="lg:col-span-6 rounded-2xl bg-[#111827] border border-slate-800 p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono text-[#00C2C7] uppercase">Global Network Topology</span>
                <span className="text-[10px] font-mono text-slate-400">Pampanga Node to World Hubs</span>
              </div>
              <h3 className="text-lg font-bold text-white">Distributed Enterprise Presence</h3>
              <p className="text-xs text-slate-300 mt-1">
                Synchronized communication links connecting Clark Freeport Zone HQ to international media centers and cloud regions.
              </p>
            </div>

            <div className="mt-4 h-72 w-full rounded-xl bg-slate-950/80 border border-slate-800/80 overflow-hidden relative">
              <GlobalDigitalGlobe className="w-full h-full" />
            </div>
          </div>

          {/* Vision and Mission Cards */}
          <div className="lg:col-span-6 space-y-6">
            
            <div className="rounded-2xl bg-[#111827] border border-slate-800 p-6 group hover:border-[#00C2C7]/40 transition-all">
              <div className="w-10 h-10 rounded-lg bg-[#00C2C7]/10 flex items-center justify-center text-[#00C2C7] mb-4">
                <Target className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Corporate Vision</h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
                To establish {COMPANY_CONFIG.platformName} as an international multimedia powerhouse and AI engineering nexus—originating from Central Luzon to the global stage, bridging cinematic storytelling with intelligent software infrastructure.
              </p>
            </div>

            <div className="rounded-2xl bg-[#111827] border border-slate-800 p-6 group hover:border-[#D4AF37]/40 transition-all">
              <div className="w-10 h-10 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center text-[#D4AF37] mb-4">
                <Compass className="w-5 h-5" />
              </div>
              <h3 className="text-lg font-bold text-white">Strategic Mission</h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
                To deliver verifiable excellence across multimedia production, custom enterprise applications, and server-side AI solutions through unyielding engineering rigor, authentic governance, and client-first execution.
              </p>
            </div>

          </div>

        </div>

        {/* Brand Board Reference Banner */}
        <div className="mt-10 rounded-2xl bg-gradient-to-r from-[#111827] via-[#0B1220] to-[#111827] border border-slate-700/80 p-6 sm:p-8 flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-700 shrink-0">
              <img
                src={COMPANY_CONFIG.brandBoardUrl}
                alt="Brand Board Reference"
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
            <div>
              <span className="text-xs font-mono text-[#00C2C7] uppercase">Official Brand Board & Design Standard</span>
              <h4 className="text-base font-bold text-white">Graphite #111827 · Technology Cyan #00C2C7 · Silver Gray #F3F4F6</h4>
              <p className="text-xs text-slate-400 mt-1">
                Visual identity standard approved for corporate media, technological interfaces, and digital broadcasts.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowBrandBoardModal(true)}
            className="px-4 py-2 text-xs font-semibold text-slate-200 hover:text-white border border-slate-600 hover:border-[#00C2C7] rounded-lg transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5 text-[#00C2C7]" />
            <span>Inspect Brand Board</span>
          </button>
        </div>

        {/* Corporate Governance Standards */}
        <div className="mt-14">
          <div className="max-w-2xl mb-8">
            <h3 className="text-xl font-bold text-white">Corporate Governance & Engineering Invariants</h3>
            <p className="text-xs text-slate-400 mt-1">
              Operational parameters strictly enforced across all creative, media, and development assignments.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="p-5 rounded-xl bg-[#111827] border border-slate-800">
              <div className="flex items-center gap-2 font-semibold text-white text-sm mb-2">
                <Check className="w-4 h-4 text-[#00C2C7]" />
                <span>Zero-Hallucination Policy</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                All production metrics, capabilities, and system outputs reflect real verified engineering without inflated claims.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-[#111827] border border-slate-800">
              <div className="flex items-center gap-2 font-semibold text-white text-sm mb-2">
                <Check className="w-4 h-4 text-[#00C2C7]" />
                <span>Strict Tenant Isolation</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Client creative footage, proprietary code, and enterprise databases are strictly segregated with fine-grained access control.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-[#111827] border border-slate-800">
              <div className="flex items-center gap-2 font-semibold text-white text-sm mb-2">
                <Check className="w-4 h-4 text-[#00C2C7]" />
                <span>Human-in-the-Loop</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                AI agents draft and propose; senior engineers and directors review, validate, and authorize all final deliverables.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-[#111827] border border-slate-800">
              <div className="flex items-center gap-2 font-semibold text-white text-sm mb-2">
                <Check className="w-4 h-4 text-[#00C2C7]" />
                <span>Local Root, Global Reach</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">
                Operating from Clark Freeport Zone, Mabalacat City, Pampanga, adhering to international industry standards in cinematography and software.
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* DTI Certificate Full-Screen Modal Preview */}
      {showCertificateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md">
          <div className="relative max-w-3xl w-full max-h-[95vh] bg-[#111827] border border-[#D4AF37]/50 rounded-2xl overflow-hidden flex flex-col shadow-2xl">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <BadgeCheck className="w-4 h-4 text-[#D4AF37]" />
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    Philippines DTI Business Registration Certificate
                  </h3>
                </div>
                <p className="text-[11px] font-mono text-slate-400 mt-0.5">
                  Registration No. {COMPANY_CONFIG.dti.registrationNo} · Valid: {COMPANY_CONFIG.dti.validity}
                </p>
              </div>

              <button
                onClick={() => setShowCertificateModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors cursor-pointer"
                aria-label="Close certificate preview"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: High Resolution Certificate Image */}
            <div className="p-4 sm:p-6 overflow-auto flex flex-col items-center justify-center bg-[#080d18] flex-1">
              <img
                src={COMPANY_CONFIG.dtiCertificateUrl}
                alt="Philippines DTI Certificate of Business Name Registration for OPHIREUM MULTIMEDIA PRODUCTION"
                className="w-auto h-auto max-h-[75vh] max-w-full object-contain rounded-lg shadow-2xl border border-slate-800"
              />
              <p className="text-[11px] font-mono text-slate-400 italic text-center mt-3">
                Illustrative Certificate Presentation — Refer to the original DTI certificate for official documentation.
              </p>
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 border-t border-slate-800 bg-slate-900 flex items-center justify-between text-xs text-slate-400">
              <span className="font-mono text-[11px]">
                Owner: {COMPANY_CONFIG.dti.registeredOwner}
              </span>
              <button
                onClick={() => setShowCertificateModal(false)}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                Close Preview
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Brand Board Modal */}
      {showBrandBoardModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="relative max-w-4xl w-full max-h-[90vh] bg-[#111827] border border-slate-700 rounded-2xl overflow-hidden flex flex-col shadow-2xl">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">OPHIREUM Multimedia Tech Brand Board</h3>
                <p className="text-xs text-slate-400">Official visual reference asset for color scheme, typography & technology styling</p>
              </div>
              <button
                onClick={() => setShowBrandBoardModal(false)}
                className="px-3 py-1 text-xs font-semibold text-slate-300 hover:text-white border border-slate-700 rounded-md cursor-pointer"
              >
                Close
              </button>
            </div>
            <div className="p-4 sm:p-6 overflow-auto flex items-center justify-center bg-[#0B1220]">
              <img
                src={COMPANY_CONFIG.brandBoardUrl}
                alt="OPHIREUM Multimedia Tech Brand Board (1)"
                className="w-full max-h-[70vh] object-contain rounded-lg border border-slate-800"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
