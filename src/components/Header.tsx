import React, { useState } from 'react';
import { Menu, X, ArrowUpRight, Shield, Phone, MapPin } from 'lucide-react';
import { COMPANY_CONFIG } from '../data/companyConfig';

interface HeaderProps {
  onOpenPortal: () => void;
  onNavigate: (sectionId: string) => void;
  activeSection: string;
}

export const Header: React.FC<HeaderProps> = ({ onOpenPortal, onNavigate, activeSection }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'about', label: 'About & Leadership' },
    { id: 'services', label: 'Services' },
    { id: 'portfolio', label: 'Portfolio' },
    { id: 'architecture', label: 'Enterprise Suite' },
    { id: 'contact', label: 'Contact Us' },
  ];

  const handleNavClick = (id: string) => {
    setMobileMenuOpen(false);
    onNavigate(id);
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-[#0B1220]/95 backdrop-blur-md border-b border-slate-800 transition-colors">
      
      {/* Top micro-bar for direct contact & office verification */}
      <div className="hidden md:flex items-center justify-between px-4 sm:px-6 lg:px-8 py-1.5 bg-[#080d18] border-b border-slate-800/80 text-[11px] text-slate-400">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-slate-300">
            <span className="font-semibold text-white">Founder & CEO:</span> {COMPANY_CONFIG.founderCeo}
          </span>
          <span aria-hidden="true" className="text-slate-700">|</span>
          <a
            href={COMPANY_CONFIG.address.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-[#00C2C7] transition-colors truncate max-w-md"
            title="View office location on Google Maps"
          >
            <MapPin className="w-3 h-3 text-[#00C2C7] shrink-0" />
            <span className="truncate">{COMPANY_CONFIG.address.line1}, {COMPANY_CONFIG.address.zone}</span>
          </a>
        </div>

        <div className="flex items-center gap-4">
          <a
            href={COMPANY_CONFIG.mobileLink}
            className="flex items-center gap-1.5 text-[#00C2C7] hover:text-[#00d6dc] font-mono font-medium transition-colors"
          >
            <Phone className="w-3 h-3" />
            <span>{COMPANY_CONFIG.mobile}</span>
          </a>
          <span aria-hidden="true" className="text-slate-700">|</span>
          <span className="font-mono text-slate-500">Pampanga, Philippines</span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-6">
        
        {/* Zone 1: Official Corporate Emblem & Wordmark */}
        <button
          onClick={() => handleNavClick('hero')}
          className="flex items-center gap-3.5 group text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C2C7]"
          aria-label="Ophireum Multimedia Production Homepage"
        >
          <div className="relative w-12 h-12 rounded-full p-0.5 bg-gradient-to-tr from-[#D4AF37] via-[#00C2C7] to-[#C0C7D1] shadow-lg shadow-[#00C2C7]/15 group-hover:shadow-[#00C2C7]/35 transition-all shrink-0">
            <img
              src="/assets/aistudio/OPHIREUM_Logo_6504e623.png"
              alt="OPM Emblem"
              className="w-full h-full object-contain rounded-full bg-[#111827]"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="flex flex-col whitespace-nowrap">
            <span className="text-sm sm:text-base font-extrabold tracking-wider text-white uppercase group-hover:text-[#00C2C7] transition-colors leading-tight">
              {COMPANY_CONFIG.name}
            </span>
            <span className="text-[10px] font-mono tracking-widest text-[#00C2C7] uppercase">
              {COMPANY_CONFIG.platformName}
            </span>
          </div>
        </button>

        {/* Zone 2: Primary Navigation Links */}
        <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-slate-300">
          {navItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`transition-colors whitespace-nowrap cursor-pointer py-1 relative ${
                  isActive ? 'text-[#00C2C7] font-semibold' : 'hover:text-white text-slate-300'
                }`}
              >
                {item.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 w-full h-[2px] bg-[#00C2C7] rounded-full shadow-[0_0_8px_#00C2C7]" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Primary Actions */}
        <div className="hidden sm:flex items-center gap-3 shrink-0">
          <button
            onClick={onOpenPortal}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white border border-slate-700/80 hover:border-[#00C2C7]/50 rounded-lg transition-all bg-[#111827]/70 whitespace-nowrap cursor-pointer"
          >
            <Shield className="w-3.5 h-3.5 text-[#00C2C7]" />
            <span>Enter Network</span>
          </button>

          <button
            onClick={() => handleNavClick('contact')}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#0B1220] bg-[#00C2C7] hover:bg-[#00d6dc] rounded-lg shadow-sm hover:shadow-[#00C2C7]/20 transition-all whitespace-nowrap cursor-pointer"
          >
            <span>Start Your Project</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Mobile Hamburger Toggle */}
        <div className="flex lg:hidden items-center gap-2">
          <a
            href={COMPANY_CONFIG.mobileLink}
            className="p-2 text-[#00C2C7] bg-slate-900 rounded-lg border border-slate-800 sm:hidden"
            aria-label="Call Founder / CEO"
          >
            <Phone className="w-4 h-4" />
          </a>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-300 hover:text-white focus:outline-none cursor-pointer rounded-lg bg-slate-900 border border-slate-800"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6 text-[#00C2C7]" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#0B1220] border-b border-slate-800 px-5 pt-3 pb-6 space-y-4 shadow-2xl">
          {/* Executive info on mobile */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1 text-xs">
            <div className="text-slate-300">
              <span className="font-semibold text-white">Founder & CEO:</span> {COMPANY_CONFIG.founderCeo}
            </div>
            <a href={COMPANY_CONFIG.mobileLink} className="flex items-center gap-1.5 text-[#00C2C7] font-mono">
              <Phone className="w-3.5 h-3.5" />
              <span>{COMPANY_CONFIG.mobile}</span>
            </a>
            <div className="text-[11px] text-slate-400 pt-1">
              {COMPANY_CONFIG.address.line1}, {COMPANY_CONFIG.address.zone}
            </div>
          </div>

          <div className="flex flex-col space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className="text-left py-2.5 px-3 text-sm font-medium text-slate-200 hover:text-[#00C2C7] hover:bg-slate-900/60 rounded-md transition-colors"
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="pt-3 border-t border-slate-800 flex flex-col gap-2.5">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenPortal();
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-200 border border-slate-700 rounded-lg hover:border-[#00C2C7]"
            >
              <Shield className="w-4 h-4 text-[#00C2C7]" />
              <span>Enter OPHIREUM NETWORK</span>
            </button>
            <button
              onClick={() => handleNavClick('contact')}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#0B1220] bg-[#00C2C7] hover:bg-[#00d6dc] rounded-lg"
            >
              <span>Start Your Project</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
