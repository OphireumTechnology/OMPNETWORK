import React from 'react';
import { Building, Shield, MapPin, ArrowUpRight } from 'lucide-react';

interface FooterProps {
  onNavigate: (sectionId: string) => void;
  onOpenPortal: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate, onOpenPortal }) => {
  return (
    <footer className="bg-[#080d18] border-t border-slate-800 text-slate-400 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
          
          {/* Brand & Emblem Lockup */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full p-0.5 bg-gradient-to-tr from-[#D4AF37] via-[#00C2C7] to-[#C0C7D1] shrink-0">
                <img
                  src="/assets/aistudio/OPHIREUM_Logo_6504e623.png"
                  alt="OPHIREUM MULTIMEDIA PRODUCTION Emblem"
                  className="w-full h-full object-contain rounded-full bg-[#111827]"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <span className="text-sm font-extrabold tracking-wider text-white uppercase block">
                  OPHIREUM MULTIMEDIA PRODUCTION
                </span>
                <span className="text-[10px] font-mono text-[#00C2C7] tracking-wider block">
                  OPHIREUM NETWORK
                </span>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
              Creative Media, Intelligent Technology, and Connected Digital Solutions. Combining high-impact cinematography, artificial intelligence, software engineering, and enterprise cloud systems.
            </p>

            <div className="flex items-center gap-2 text-slate-300 font-medium pt-1">
              <MapPin className="w-4 h-4 text-[#00C2C7] shrink-0" />
              <span>Mabalacat City, Pampanga, Philippines</span>
            </div>
          </div>

          {/* Navigation Links */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono uppercase text-white tracking-wider">Corporate Site</h4>
            <ul className="space-y-2">
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
                  About Us & Governance
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('services')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  12 Proposed Services
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('portfolio')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Portfolio & Blueprints
                </button>
              </li>
              <li>
                <button
                  onClick={() => onNavigate('contact')}
                  className="hover:text-white transition-colors cursor-pointer"
                >
                  Inquiry & Brief Routing
                </button>
              </li>
            </ul>
          </div>

          {/* Enterprise Platform */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono uppercase text-white tracking-wider">Enterprise Network</h4>
            <ul className="space-y-2">
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
                  <span>AI Website Studio (Phase 3)</span>
                  <ArrowUpRight className="w-3 h-3 text-[#00C2C7]" />
                </button>
              </li>
              <li>
                <button
                  onClick={onOpenPortal}
                  className="hover:text-[#00C2C7] transition-colors cursor-pointer flex items-center gap-1"
                >
                  <span>AI Agent Workforce (Phase 5/7)</span>
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
          </div>

          {/* Standards & Brand System */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono uppercase text-white tracking-wider">Brand & Standards</h4>
            <ul className="space-y-1.5 text-[11px] text-slate-400">
              <li>Graphite: <span className="font-mono text-slate-300">#111827</span></li>
              <li>Technology Cyan: <span className="font-mono text-[#00C2C7]">#00C2C7</span></li>
              <li>Silver Gray: <span className="font-mono text-slate-300">#F3F4F6</span></li>
              <li>Metallic Gold: <span className="font-mono text-[#D4AF37]">#D4AF37</span></li>
              <li className="pt-2 text-slate-400">
                Official Emblem: Circular OPM monogram with interconnected circuits.
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="mt-12 pt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-slate-500">
          <div>
            © 2026 OPHIREUM MULTIMEDIA PRODUCTION. All rights reserved.
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Enterprise Terms</span>
            <span>·</span>
            <span>Data Privacy Policy</span>
            <span>·</span>
            <span>Mabalacat City, Pampanga</span>
          </div>
        </div>

      </div>
    </footer>
  );
};
