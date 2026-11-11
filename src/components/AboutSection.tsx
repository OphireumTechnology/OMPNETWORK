import React, { useState } from 'react';
import { Shield, Target, Compass, Award, Building, Eye, ChevronRight, Check } from 'lucide-react';

interface AboutSectionProps {
  onOpenPortal: () => void;
}

export const AboutSection: React.FC<AboutSectionProps> = ({ onOpenPortal }) => {
  const [showBrandBoardModal, setShowBrandBoardModal] = useState(false);

  return (
    <section id="about" className="py-20 lg:py-28 bg-[#0B1220] border-t border-slate-800/80 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#00C2C7] uppercase tracking-wider mb-2">
            <span>Corporate Profile & Governance</span>
            <span aria-hidden="true">·</span>
            <span>Registration Overview</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white text-balance">
            Engineered for Media Excellence and Intelligent Innovation
          </h2>
          <p className="mt-4 text-base sm:text-lg text-slate-300 leading-relaxed text-balance">
            OPHIREUM MULTIMEDIA PRODUCTION operates at the intersection of cinematic artistry, artificial intelligence, and high-performance software engineering.
          </p>
        </div>

        {/* Corporate Registration & Location Card */}
        <div className="mt-12 rounded-2xl bg-[#111827] border border-slate-800 p-6 sm:p-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 divide-y md:divide-y-0 md:divide-x divide-slate-800">
            
            <div className="space-y-2">
              <span className="text-xs font-mono uppercase text-slate-400">Registered Entity</span>
              <h3 className="text-lg font-bold text-white">OPHIREUM MULTIMEDIA PRODUCTION</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Legally registered commercial production and technology enterprise.
              </p>
            </div>

            <div className="pt-6 md:pt-0 md:pl-8 space-y-2">
              <span className="text-xs font-mono uppercase text-slate-400">Official Location</span>
              <div className="flex items-center gap-2 text-white font-semibold">
                <Building className="w-4 h-4 text-[#00C2C7]" />
                <span>Mabalacat City, Pampanga</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Central Luzon, Philippines. Serving enterprise clients nationwide and internationally.
              </p>
            </div>

            <div className="pt-6 md:pt-0 md:pl-8 space-y-2">
              <span className="text-xs font-mono uppercase text-slate-400">Platform Designation</span>
              <div className="text-white font-semibold text-sm">
                OPHIREUM NETWORK
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Integrated digital infrastructure uniting creative studios, AI agent workflows, and client portals.
              </p>
            </div>

          </div>
        </div>

        {/* Vision & Mission Grid */}
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-8">
          
          <div className="rounded-2xl bg-[#111827]/80 border border-slate-800/90 p-8 relative overflow-hidden group hover:border-[#00C2C7]/40 transition-all">
            <div className="w-10 h-10 rounded-lg bg-[#00C2C7]/10 flex items-center justify-center text-[#00C2C7] mb-5">
              <Target className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-white">Our Vision</h3>
            <p className="mt-3 text-sm text-slate-300 leading-relaxed">
              To be the premier multimedia and technology powerhouse from Central Luzon to the global stage, pioneering seamless convergence between high-impact visual media, autonomous artificial intelligence, and enterprise-grade software platforms.
            </p>
          </div>

          <div className="rounded-2xl bg-[#111827]/80 border border-slate-800/90 p-8 relative overflow-hidden group hover:border-[#D4AF37]/40 transition-all">
            <div className="w-10 h-10 rounded-lg bg-[#D4AF37]/10 flex items-center justify-center text-[#D4AF37] mb-5">
              <Compass className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-white">Our Mission</h3>
            <p className="mt-3 text-sm text-slate-300 leading-relaxed">
              To empower modern organizations, creators, and institutions with uncompromising creative productions and reliable technological solutions—delivered through transparent governance, verified engineering, and client-first execution.
            </p>
          </div>

        </div>

        {/* Brand Board Reference Banner */}
        <div className="mt-10 rounded-2xl bg-gradient-to-r from-[#111827] via-[#0B1220] to-[#111827] border border-slate-700/80 p-6 sm:p-8 flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-slate-700 shrink-0">
              <img
                src="/assets/aistudio/Ophireum_Multimedia_Tech_Brand_Board_aa50d48b.png"
                alt="Brand Board Preview"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <span className="text-xs font-mono text-[#00C2C7] uppercase">Official Brand Board & Design System</span>
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

        {/* Verified Governance & Leadership Principles */}
        <div className="mt-14">
          <div className="max-w-2xl mb-8">
            <h3 className="text-xl font-bold text-white">Corporate Governance & Quality Standards</h3>
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
                Proudly based in Mabalacat City, Pampanga, adhering to international industry standards in cinematography and software.
              </p>
            </div>
          </div>
        </div>

      </div>

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
                src="/assets/aistudio/Ophireum_Multimedia_Tech_Brand_Board_aa50d48b.png"
                alt="OPHIREUM Multimedia Tech Brand Board (1)"
                className="w-full max-h-[70vh] object-contain rounded-lg border border-slate-800"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
