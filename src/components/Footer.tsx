import React from 'react';
import { Building, Shield, MapPin, ArrowUpRight, Phone, Mail, ExternalLink, User } from 'lucide-react';
import { COMPANY_CONFIG } from '../data/companyConfig';

interface FooterProps {
  onNavigate: (sectionId: string) => void;
  onOpenPortal: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate, onOpenPortal }) => {
  return (
    <footer className="bg-[#080d18] border-t border-slate-800 text-slate-400 text-xs relative">
      {/* Subtle cyan accent glow border line */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#00C2C7]/50 to-transparent" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10">
          
          {/* Brand & Executive Lockup (Cols 1-4) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full p-0.5 bg-gradient-to-tr from-[#D4AF37] via-[#00C2C7] to-[#C0C7D1] shrink-0">
                <img
                  src="/assets/aistudio/OPHIREUM_Logo_6504e623.png"
                  alt="OPHIREUM MULTIMEDIA PRODUCTION Emblem"
                  className="w-full h-full object-contain rounded-full bg-[#111827]"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <span className="text-sm font-extrabold tracking-wider text-white uppercase block">
                  {COMPANY_CONFIG.name}
                </span>
                <span className="text-[10px] font-mono text-[#00C2C7] tracking-wider block">
                  {COMPANY_CONFIG.platformName}
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Transforming digital experiences through multimedia production, artificial intelligence, enterprise software engineering, creative technology, and intelligent digital platforms.
            </p>

            {/* Founder / CEO Information */}
            <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5 text-xs">
              <div className="flex items-center gap-2 text-slate-300 font-medium">
                <User className="w-3.5 h-3.5 text-[#00C2C7]" />
                <span>Founder & CEO: <strong className="text-white">{COMPANY_CONFIG.founderCeo}</strong></span>
              </div>

              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-[#00C2C7]" />
                <a href={COMPANY_CONFIG.mobileLink} className="text-[#00C2C7] hover:underline font-mono">
                  {COMPANY_CONFIG.mobile}
                </a>
              </div>
            </div>
          </div>

          {/* Office Address Location (Cols 5-7) */}
          <div className="lg:col-span-3 space-y-3">
            <h4 className="text-xs font-mono uppercase text-white tracking-wider flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-[#00C2C7]" />
              <span>Official Office Address</span>
            </h4>
            <div className="space-y-1 text-xs text-slate-300 leading-relaxed">
              <p className="font-semibold text-white">{COMPANY_CONFIG.address.line1}</p>
              <p>{COMPANY_CONFIG.address.line2}</p>
              <p>{COMPANY_CONFIG.address.zone}</p>
              <p className="font-mono text-slate-400">{COMPANY_CONFIG.address.cityPostal}</p>
            </div>
            <div className="pt-2">
              <a
                href={COMPANY_CONFIG.address.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-[#00C2C7] hover:underline"
              >
                <span>Google Maps Location</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Quick Links (Cols 8-9) */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="text-xs font-mono uppercase text-white tracking-wider">Navigation</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={() => onNavigate('hero')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Homepage
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('about')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  About & Governance
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('services')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  12 Services
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('portfolio')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Portfolio Showcases
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('contact')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Project Brief
                </button>
              </li>
            </ul>
          </div>

          {/* Enterprise Network Links (Cols 10-12) */}
          <div className="lg:col-span-3 space-y-3">
            <h4 className="text-xs font-mono uppercase text-white tracking-wider">Enterprise Network</h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={onOpenPortal}
                  className="hover:text-[#00C2C7] transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span>Client Portal (Phase 2)</span>
                  <ArrowUpRight className="w-3 h-3 text-[#00C2C7]" />
                </button>
              </li>
              <li>
                <button
                  onClick={onOpenPortal}
                  className="hover:text-[#00C2C7] transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span>AI Development Studio (Phase 3)</span>
                  <ArrowUpRight className="w-3 h-3 text-[#00C2C7]" />
                </button>
              </li>
              <li>
                <button
                  onClick={onOpenPortal}
                  className="hover:text-[#00C2C7] transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span>AI Agent Workforce Matrix (Phase 5/7)</span>
                  <ArrowUpRight className="w-3 h-3 text-[#00C2C7]" />
                </button>
              </li>
              <li>
                <button
                  onClick={onOpenPortal}
                  className="hover:text-[#00C2C7] transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span>Super Admin Center (Phase 9)</span>
                  <ArrowUpRight className="w-3 h-3 text-[#00C2C7]" />
                </button>
              </li>
            </ul>

            <div className="pt-2 text-[11px] text-slate-500 font-mono">
              Graphite #111827 · Cyan #00C2C7 · Gold #D4AF37
            </div>
          </div>

        </div>

        {/* Bottom Legal & Regulatory Bar */}
        <div className="mt-12 pt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
          <div>
            © 2026 {COMPANY_CONFIG.name}. All rights reserved.
          </div>
          <div className="flex flex-wrap items-center gap-4 text-slate-400">
            <span>Privacy Policy</span>
            <span>·</span>
            <span>Terms of Use</span>
            <span>·</span>
            <span>Clark Freeport Zone, Pampanga</span>
          </div>
        </div>

      </div>
    </footer>
  );
};
