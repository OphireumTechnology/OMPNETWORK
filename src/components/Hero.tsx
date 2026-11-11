import React from 'react';
import { ArrowUpRight, Film, Cpu, Code2, Globe, Shield, Sparkles, MapPin } from 'lucide-react';

interface HeroProps {
  onNavigate: (sectionId: string) => void;
  onOpenPortal: () => void;
}

export const Hero: React.FC<HeroProps> = ({ onNavigate, onOpenPortal }) => {
  return (
    <section id="hero" className="relative pt-10 pb-20 lg:pt-16 lg:pb-32 overflow-hidden bg-[#0B1220]">
      {/* Background Subtle Circuit & Gradient Aura */}
      <div className="absolute inset-0 circuit-pattern opacity-40 pointer-events-none" />
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-[#00C2C7]/10 blur-[130px] rounded-full pointer-events-none" />
      <div className="absolute top-1/3 right-10 w-[350px] h-[350px] bg-[#D4AF37]/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Trust & Location Indicator - quiet unboxed text */}
        <div className="flex items-center gap-2 text-xs font-medium text-slate-400 mb-6">
          <MapPin className="w-3.5 h-3.5 text-[#00C2C7]" />
          <span>Mabalacat City, Pampanga, Philippines</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-[#00C2C7]">OPHIREUM NETWORK</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span>Enterprise Platform</span>
        </div>

        {/* 2-Column Split: Editorial Value Proposition & Official Logo Showcase */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Left Column: Heading, Subtitle & 4 Primary Actions */}
          <div className="lg:col-span-7 flex flex-col justify-center">
            
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-5xl font-extrabold tracking-tight text-white text-balance leading-[1.15]">
              OPHIREUM MULTIMEDIA PRODUCTION
            </h1>

            <p className="mt-4 text-xl sm:text-2xl font-semibold text-transparent bg-clip-text bg-gradient-to-r from-[#00C2C7] via-[#C0C7D1] to-[#D4AF37] text-balance">
              Creative Media. Intelligent Technology. Connected Digital Solutions.
            </p>

            <p className="mt-5 text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl text-balance">
              We combine multimedia production, creative design, artificial intelligence, software engineering, and enterprise technology to develop modern digital experiences and intelligent business solutions.
            </p>

            {/* 4 Primary Actions Required by Master Directive */}
            <div className="mt-8 flex flex-wrap items-center gap-3.5">
              <button
                onClick={() => onNavigate('contact')}
                className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-[#0B1220] bg-[#00C2C7] hover:bg-[#00d6dc] rounded-lg shadow-lg shadow-[#00C2C7]/20 hover:shadow-[#00C2C7]/30 transition-all cursor-pointer whitespace-nowrap"
              >
                <span>Start a Project</span>
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
                className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-slate-300 hover:text-white bg-transparent hover:bg-slate-850 border border-slate-800 hover:border-slate-700 rounded-lg transition-all cursor-pointer whitespace-nowrap"
              >
                <span>View Our Portfolio</span>
              </button>

              <button
                onClick={onOpenPortal}
                className="inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold text-[#00C2C7] hover:text-white hover:bg-[#00C2C7]/10 border border-[#00C2C7]/30 rounded-lg transition-all cursor-pointer whitespace-nowrap"
              >
                <Shield className="w-4 h-4 text-[#00C2C7]" />
                <span>Access Client Portal</span>
              </button>
            </div>

            {/* Unboxed Brand Pillars Row */}
            <div className="mt-10 pt-6 border-t border-slate-800/90 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-slate-400">
              <span className="font-semibold text-slate-300">CORE DOMAINS:</span>
              <span className="flex items-center gap-1.5 hover:text-white transition-colors">
                <Film className="w-3.5 h-3.5 text-[#00C2C7]" /> Multimedia Production
              </span>
              <span className="flex items-center gap-1.5 hover:text-white transition-colors">
                <Cpu className="w-3.5 h-3.5 text-[#D4AF37]" /> Artificial Intelligence
              </span>
              <span className="flex items-center gap-1.5 hover:text-white transition-colors">
                <Code2 className="w-3.5 h-3.5 text-[#00C2C7]" /> Software Architecture
              </span>
              <span className="flex items-center gap-1.5 hover:text-white transition-colors">
                <Globe className="w-3.5 h-3.5 text-[#C0C7D1]" /> Digital Platforms
              </span>
            </div>

          </div>

          {/* Right Column: Prominent Official Emblem Showcase & Tech Board Inspiration */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative group max-w-sm sm:max-w-md w-full">
              
              {/* Outer Decorative Circular Halo matching Logo Dimensions */}
              <div className="absolute -inset-2 bg-gradient-to-r from-[#D4AF37]/30 via-[#00C2C7]/30 to-[#C0C7D1]/20 rounded-full blur-xl opacity-75 group-hover:opacity-100 transition duration-700" />
              
              <div className="relative rounded-3xl bg-gradient-to-b from-[#111827] via-[#0B1220] to-[#080d18] border border-slate-700/80 p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center">
                
                {/* Official Circular Logo with Metallic Rim */}
                <div className="relative w-48 h-48 sm:w-60 sm:h-60 rounded-full p-1 bg-gradient-to-br from-[#D4AF37] via-[#00C2C7] to-[#C0C7D1] shadow-2xl glow-cyan-sm transition-transform duration-500 group-hover:scale-[1.02]">
                  <img
                    src="/assets/aistudio/OPHIREUM_Logo_6504e623.png"
                    alt="OPHIREUM MULTIMEDIA PRODUCTION Official Corporate Emblem"
                    className="w-full h-full object-contain rounded-full bg-[#111827]"
                    referrerPolicy="no-referrer"
                  />
                </div>

                <div className="mt-5 space-y-1">
                  <h2 className="text-base font-bold tracking-wider text-white uppercase">
                    OPHIREUM NETWORK
                  </h2>
                  <p className="text-xs text-slate-400 font-mono tracking-wide">
                    MEDIA · TECHNOLOGY · AI · CONTENT · PRODUCTION
                  </p>
                </div>

                {/* Subdued Hexagon Circuit Feature Badges */}
                <div className="mt-5 w-full pt-4 border-t border-slate-800/80 grid grid-cols-3 gap-2 text-center text-[11px]">
                  <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
                    <span className="block text-slate-400">Headquarters</span>
                    <span className="font-semibold text-slate-200">Pampanga</span>
                  </div>
                  <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
                    <span className="block text-slate-400">Enterprise</span>
                    <span className="font-semibold text-[#00C2C7]">OPM Studio</span>
                  </div>
                  <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
                    <span className="block text-slate-400">Standard</span>
                    <span className="font-semibold text-[#D4AF37]">4K/8K & AI</span>
                  </div>
                </div>

              </div>
            </div>
          </div>

        </div>

      </div>
    </section>
  );
};
