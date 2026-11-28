import React, { useState, useEffect, useRef } from 'react';
import { Menu, X, ArrowUpRight, Shield, Phone, MapPin } from 'lucide-react';
import { COMPANY_CONFIG } from '../data/companyConfig';
import { BrandLogo } from './BrandLogo';

interface HeaderProps {
  onOpenPortal: () => void;
  onNavigate: (sectionId: string) => void;
  activeSection: string;
}

export const Header: React.FC<HeaderProps> = ({ onOpenPortal, onNavigate, activeSection }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const mobileToggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
        mobileToggleRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

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
    <header className="sticky top-0 z-50 w-full bg-[#0B1220]/95 backdrop-blur-md border-b border-slate-800 transition-colors shadow-lg">

      {/* Top Executive Micro-Bar (Seamlessly Integrated) */}
      <div className="hidden xl:block bg-[#080d18] border-b border-slate-800/80 text-[11px] text-slate-400">
        <div className="max-w-7xl mx-auto px-6 py-1.5 flex items-center justify-between gap-4 min-w-0">
          <div className="flex items-center gap-4 min-w-0">
            <span className="flex items-center gap-1.5 text-slate-300 shrink-0">
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

          <div className="flex items-center gap-4 shrink-0">
            <a
              href={COMPANY_CONFIG.mobileLink}
              className="flex items-center gap-1.5 text-[#00C2C7] hover:text-[#00d6dc] font-mono font-medium transition-colors"
            >
              <Phone className="w-3 h-3" />
              <span>{COMPANY_CONFIG.mobile}</span>
            </a>
            <span aria-hidden="true" className="text-slate-700">|</span>
            <span className="font-mono text-slate-400">2010 Pampanga, Philippines</span>
          </div>
        </div>
      </div>

      {/* Main Navigation Bar — Responsive Zero-Overflow Layout (320px–2560px) */}
      <div className="max-w-7xl mx-auto px-3 sm:px-5 xl:px-6 min-h-[72px] sm:h-[82px] py-2 sm:py-0 flex items-center justify-between gap-2 sm:gap-3">

        {/* Zone 1: Official Corporate Emblem & Exact Registered Name */}
        <button
          type="button"
          onClick={() => handleNavClick('hero')}
          className="flex items-center gap-2.5 sm:gap-3 group text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C2C7] min-w-0 flex-1 md:flex-initial xl:shrink-0"
          aria-label={`${COMPANY_CONFIG.name} Homepage`}
        >
          {/* Official Logo: 44px on mobile, 48px on tablet/desktop */}
          <BrandLogo
            variant="emblem"
            size="lg"
            ring="brand"
            eager
            decorative
            className="shrink-0 group-hover:shadow-[#00C2C7]/40 transition-all"
          />

          <div className="flex flex-col justify-center min-w-0">
            {/* Main company name: responsive sizing & wrapping so 320px-2560px never overflows */}
            <span className="text-[12px] min-[390px]:text-[13.5px] sm:text-[15px] xl:text-[14.5px] 2xl:text-[16px] font-bold tracking-normal 2xl:tracking-wide text-white uppercase group-hover:text-[#00C2C7] transition-colors leading-tight break-words md:whitespace-nowrap">
              {COMPANY_CONFIG.name}
            </span>
            {/* Secondary brand: 10px cyan medium */}
            <span className="text-[9.5px] sm:text-[10px] font-medium tracking-widest text-[#00C2C7] uppercase mt-0.5 font-mono truncate">
              {COMPANY_CONFIG.platformName}
            </span>
          </div>
        </button>

        {/* Zone 2: Navigation Links (inline on xl 1280px+, drawer below xl for guaranteed zero overflow) */}
        <nav aria-label="Primary navigation" className="hidden xl:flex items-center gap-4 2xl:gap-7 text-[13px] font-medium text-slate-300 min-w-0">
          {navItems.map((item) => {
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={`transition-colors whitespace-nowrap cursor-pointer py-2 relative leading-normal ${
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

        {/* Zone 3: Primary Action Buttons (visible from md 768px+; inside drawer on smaller screens) */}
        <div className="hidden md:flex items-center gap-2 xl:gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onOpenPortal}
            className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold text-slate-200 hover:text-white border border-slate-700/80 hover:border-[#00C2C7]/50 rounded-lg transition-all bg-[#111827]/80 whitespace-nowrap cursor-pointer hover:bg-slate-800"
          >
            <Shield className="w-3.5 h-3.5 text-[#00C2C7]" />
            <span>Enter Network</span>
          </button>

          <button
            type="button"
            onClick={() => handleNavClick('contact')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-[12px] font-semibold text-[#0B1220] bg-[#00C2C7] hover:bg-[#00d6dc] rounded-lg shadow-sm hover:shadow-[#00C2C7]/25 transition-all whitespace-nowrap cursor-pointer"
          >
            <span>Start Your Project</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Mobile / Tablet Hamburger & Direct Call Button */}
        <div className="flex xl:hidden items-center gap-2 shrink-0">
          <a
            href={COMPANY_CONFIG.mobileLink}
            className="p-2 text-[#00C2C7] bg-slate-900 rounded-lg border border-slate-800 sm:hidden"
            aria-label={`Call ${COMPANY_CONFIG.mobile}`}
          >
            <Phone className="w-4 h-4" />
          </a>
          <button
            ref={mobileToggleRef}
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2.5 text-slate-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C2C7] cursor-pointer rounded-lg bg-slate-900 border border-slate-800"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-primary-nav"
          >
            {mobileMenuOpen ? <X className="w-5 h-5 text-[#00C2C7]" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile / Tablet Drawer Menu */}
      {mobileMenuOpen && (
        <nav
          id="mobile-primary-nav"
          aria-label="Mobile navigation"
          className="xl:hidden bg-[#0B1220] border-b border-slate-800 px-5 pt-3 pb-6 space-y-4 shadow-2xl"
        >
          {/* Executive info on mobile */}
          <div className="p-3.5 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1.5 text-xs">
            <div className="text-slate-300">
              <span className="font-semibold text-white">Founder & CEO:</span> {COMPANY_CONFIG.founderCeo}
            </div>
            <a href={COMPANY_CONFIG.mobileLink} className="flex items-center gap-1.5 text-[#00C2C7] font-mono font-medium">
              <Phone className="w-3.5 h-3.5" />
              <span>{COMPANY_CONFIG.mobile}</span>
            </a>
            <div className="text-[11px] text-slate-400 pt-0.5">
              {COMPANY_CONFIG.address.line1}, {COMPANY_CONFIG.address.zone}
            </div>
          </div>

          <div className="flex flex-col space-y-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className="text-left py-2.5 px-3 text-[13.5px] font-medium text-slate-200 hover:text-[#00C2C7] hover:bg-slate-900/60 rounded-md transition-colors"
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
        </nav>
      )}
    </header>
  );
};
