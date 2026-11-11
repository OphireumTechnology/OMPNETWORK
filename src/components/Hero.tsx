import React from 'react';
import { ArrowUpRight, Shield, MapPin, Sparkles, Phone, Compass, Cpu } from 'lucide-react';
import { BlockchainNetworkCanvas } from './animations/BlockchainNetworkCanvas';
import { FloatingTechnologyIcons } from './animations/FloatingTechnologyIcons';
import { COMPANY_CONFIG } from '../data/companyConfig';

interface HeroProps {
  onNavigate: (sectionId: string) => void;
  onOpenPortal: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onNavigate, onOpenPortal }) => {
  return (
    <section id="hero" className="relative pt-8 pb-20 lg:pt-14 lg:pb-28 overflow-hidden bg-[#0B1220]">
      {/* Dynamic Animated Blockchain Network Background Canvas */}
      <div className="absolute inset-0 pointer-events-auto opacity-75">
        <BlockchainNetworkCanvas nodeCount={55} interactive={true} />
      </div>

      {/* Atmospheric lighting halos */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[750px] h-[550px] bg-[#00C2C7]/12 blur-[140px] rounded-full pointer-events-none" />
      <div className="absolute top-1/3 right-10 w-[400px] h-[400px] bg-[#D4AF37]/8 blur-[130px] rounded-full pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pointer-events-none">
        
        {/* Trust & Location Indicator - clickable maps & phone link */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-slate-400 mb-6 pointer-events-auto">
          <a
            href={COMPANY_CONFIG.address.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 hover:text-[#00C2C7] transition-colors"
          >
            <MapPin className="w-3.5 h-3.5 text-[#00C2C7] shrink-0" />
            <span>{COMPANY_CONFIG.address.line1} · {COMPANY_CONFIG.address.zone}</span>
          </a>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-[#00C2C7] font-semibold">{COMPANY_CONFIG.platformName}</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-slate-300">Pampanga, Philippines</span>
        </div>

        {/* 2-Column Split: Editorial Value Proposition & Official Logo Showcase */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
          
          {/* Left Column: Heading, Subtitle & 4 Primary Actions */}
          <div className="lg:col-span-7 flex flex-col justify-center pointer-events-auto">
            
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-[3.25rem] font-extrabold tracking-tight text-white text-balance leading-[1.12]">
              {COMPANY_CONFIG.headline}
            </h1>

            <p className="mt-4 text-xl sm:text-2xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-[#00C2C7] via-[#C0C7D1] to-[#D4AF37] text-balance">
              {COMPANY_CONFIG.subheadline}
            </p>

            <p className="mt-5 text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl text-balance">
              {COMPANY_CONFIG.heroDescription}
            </p>

            {/* 4 Required Hero Buttons */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                onClick={() => onNavigate('contact')}
                className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-[#0B1220] bg-[#00C2C7] hover:bg-[#00d6dc] rounded-lg shadow-lg shadow-[#00C2C7]/20 hover:shadow-[#00C2C7]/30 transition-all cursor-pointer whitespace-nowrap"
              >
                <span>Start Your Project</span>
                <ArrowUpRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => onNavigate('services')}
                className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-white bg-slate-800/90 hover:bg-slate-800 border border-slate-700 hover:border-[#00C2C7]/50 rounded-lg transition-all cursor-pointer whitespace-nowrap"
              >
                <span>Explore Our Services</span>
              </button>

              <button
                onClick={() => onNavigate('portfolio')}
                className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-slate-300 hover:text-white bg-transparent hover:bg-slate-800/60 border border-slate-800 hover:border-slate-700 rounded-lg transition-all cursor-pointer whitespace-nowrap"
              >
                <span>View Our Portfolio</span>
              </button>

              <button
                onClick={onOpenPortal}
                className="inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold text-[#00C2C7] hover:text-white hover:bg-[#00C2C7]/10 border border-[#00C2C7]/40 rounded-lg transition-all cursor-pointer whitespace-nowrap"
              >
                <Shield className="w-4 h-4 text-[#00C2C7]" />
                <span>Enter OPHIREUM NETWORK</span>
              </button>
            </div>

            {/* Corporate Leadership & Registration Badge */}
            <div className="mt-8 pt-6 border-t border-slate-800/80 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-400">
              <span className="text-slate-300">
                <span className="font-semibold text-white">Founder & CEO:</span> {COMPANY_CONFIG.founderCeo}
              </span>
              <span aria-hidden="true" className="text-slate-700 hidden sm:inline">·</span>
              <a href={COMPANY_CONFIG.mobileLink} className="text-[#00C2C7] hover:underline font-mono">
                {COMPANY_CONFIG.mobile}
              </a>
              <span aria-hidden="true" className="text-slate-700 hidden sm:inline">·</span>
              <span className="text-slate-400">Clark Freeport Zone</span>
            </div>

          </div>

          {/* Right Column: Prominent Official Emblem Showcase & Dimensional Circuit Framing */}
          <div className="lg:col-span-5 flex justify-center pointer-events-auto">
            <div className="relative group max-w-sm sm:max-w-md w-full">
              
              {/* Outer Decorative Circular Halo matching Logo Dimensions */}
              <div className="absolute -inset-2 bg-gradient-to-r from-[#D4AF37]/35 via-[#00C2C7]/35 to-[#C0C7D1]/25 rounded-full blur-xl opacity-80 group-hover:opacity-100 transition duration-700" />
              
              <div className="relative rounded-3xl bg-gradient-to-b from-[#111827] via-[#0B1220] to-[#080d18] border border-slate-700/90 p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center backdrop-blur-md">
                
                {/* Official Circular Logo with Metallic Rim */}
                <div className="relative w-52 h-52 sm:w-64 sm:h-64 rounded-full p-1 bg-gradient-to-br from-[#D4AF37] via-[#00C2C7] to-[#C0C7D1] shadow-2xl glow-cyan-sm transition-transform duration-500 group-hover:scale-[1.02]">
                  <img
                    src="/assets/aistudio/OPHIREUM_Logo_6504e623.png"
                    alt="OPHIREUM MULTIMEDIA PRODUCTION Official Corporate Emblem"
                    className="w-full h-full object-contain rounded-full bg-[#111827]"
                    referrerPolicy="no-referrer"
                  />
                </div>

                <div className="mt-5 space-y-1">
                  <h2 className="text-base font-bold tracking-wider text-white uppercase">
                    {COMPANY_CONFIG.platformName}
                  </h2>
                  <p className="text-xs text-slate-400 font-mono tracking-wide">
                    MEDIA · TECHNOLOGY · AI · CONTENT · PRODUCTION
                  </p>
                </div>

                {/* Subdued Hexagon Circuit Indicators */}
                <div className="mt-5 w-full pt-4 border-t border-slate-800/80 grid grid-cols-3 gap-2 text-center text-[11px]">
                  <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
                    <span className="block text-slate-400">Headquarters</span>
                    <span className="font-semibold text-slate-200">Clark Zone</span>
                  </div>
                  <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
                    <span className="block text-slate-400">Network Tier</span>
                    <span className="font-semibold text-[#00C2C7]">Enterprise</span>
                  </div>
                  <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
                    <span className="block text-slate-400">Standards</span>
                    <span className="font-semibold text-[#D4AF37]">ACES & AI</span>
                  </div>
                </div>

              </div>
            </div>
          </div>

        </div>

        {/* Floating Technology Disciplines Strip (12 Core Icons) */}
        <div className="mt-16 pt-8 border-t border-slate-800/80 pointer-events-auto">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
              Interconnected Technology Disciplines (12 Core Domains)
            </span>
            <span className="text-[11px] font-mono text-[#00C2C7]">Hover to inspect scope</span>
          </div>
          <FloatingTechnologyIcons onSelectCategory={() => onNavigate('services')} />
        </div>

      </div>
    </section>
  );
};
