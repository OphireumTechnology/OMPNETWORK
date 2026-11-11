import React, { useState } from 'react';
import { Menu, X, ArrowUpRight, Shield, Sparkles } from 'lucide-react';

interface HeaderProps {
  onOpenPortal: () => void;
  onNavigate: (sectionId: string) => void;
  activeSection: string;
}

export const Header: React.FC<HeaderProps> = ({ onOpenPortal, onNavigate, activeSection }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { id: 'about', label: 'About Us' },
    { id: 'services', label: 'Services' },
    { id: 'portfolio', label: 'Portfolio' },
    { id: 'architecture', label: 'Enterprise Suite' },
    { id: 'contact', label: 'Contact' },
  ];

  const handleNavClick = (id: string) => {
    setMobileMenuOpen(false);
    onNavigate(id);
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-[#0B1220]/90 backdrop-blur-md border-b border-slate-800/80 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-6">
        
        {/* Zone 1: Brand Wordmark & Official Emblem */}
        <button
          onClick={() => handleNavClick('hero')}
          className="flex items-center gap-3.5 group text-left cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C2C7]"
          aria-label="Ophireum Multimedia Production Homepage"
        >
          <div className="relative w-11 h-11 rounded-full p-0.5 bg-gradient-to-tr from-[#D4AF37] via-[#00C2C7] to-[#C0C7D1] shadow-lg shadow-[#00C2C7]/10 group-hover:shadow-[#00C2C7]/30 transition-all shrink-0">
            <img
              src="/assets/aistudio/OPHIREUM_Logo_6504e623.png"
              alt="OPM Emblem"
              className="w-full h-full object-contain rounded-full bg-[#111827]"
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="flex flex-col whitespace-nowrap">
            <span className="text-sm font-extrabold tracking-wider text-white uppercase group-hover:text-[#00C2C7] transition-colors">
              OPHIREUM
            </span>
            <span className="text-[10px] font-medium tracking-widest text-slate-400 uppercase -mt-0.5">
              MULTIMEDIA PRODUCTION
            </span>
          </div>
        </button>

        {/* Zone 2: 4-5 concise single-line text navigation links */}
        <nav className="hidden lg:flex items-center gap-8 text-sm font-medium text-slate-300">
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
                  <span className="absolute bottom-0 left-0 w-full h-[2px] bg-[#00C2C7] rounded-full" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Primary Action & Portal Access */}
        <div className="hidden sm:flex items-center gap-3 shrink-0">
          <button
            onClick={onOpenPortal}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white border border-slate-700/80 hover:border-[#00C2C7]/50 rounded-lg transition-all bg-[#111827]/60 whitespace-nowrap cursor-pointer"
          >
            <Shield className="w-3.5 h-3.5 text-[#00C2C7]" />
            <span>Client Portal</span>
          </button>

          <button
            onClick={() => handleNavClick('contact')}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#0B1220] bg-[#00C2C7] hover:bg-[#00d6dc] rounded-lg shadow-sm hover:shadow-[#00C2C7]/20 transition-all whitespace-nowrap cursor-pointer"
          >
            <span>Start a Project</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Mobile Hamburger Button */}
        <div className="flex sm:hidden items-center gap-2">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-300 hover:text-white focus:outline-none cursor-pointer"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6 text-[#00C2C7]" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#0B1220] border-b border-slate-800 px-5 pt-3 pb-6 space-y-3 shadow-xl">
          <div className="flex flex-col space-y-2">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className="text-left py-2 px-3 text-sm font-medium text-slate-200 hover:text-[#00C2C7] hover:bg-slate-900/60 rounded-md transition-colors"
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-800 flex flex-col gap-2.5">
            <button
              onClick={() => {
                setMobileMenuOpen(false);
                onOpenPortal();
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-200 border border-slate-700 rounded-lg hover:border-[#00C2C7]"
            >
              <Shield className="w-4 h-4 text-[#00C2C7]" />
              <span>Client Portal & Enterprise Suite</span>
            </button>
            <button
              onClick={() => handleNavClick('contact')}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-[#0B1220] bg-[#00C2C7] hover:bg-[#00d6dc] rounded-lg"
            >
              <span>Start a Project</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
