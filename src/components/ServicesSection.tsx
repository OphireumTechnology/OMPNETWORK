import React, { useState } from 'react';
import { servicesData } from '../data/servicesData';
import { ServiceItem, ServiceCategory } from '../types';
import { 
  Film, Camera, Clapperboard, Palette, Globe, Server, 
  Cpu, Database, LayoutGrid, Gamepad2, Radio, Terminal,
  ArrowUpRight, Check, X, Shield, ChevronRight
} from 'lucide-react';

interface ServicesSectionProps {
  onSelectServiceForInquiry: (serviceId: string) => void;
}

export const ServicesSection: React.FC<ServicesSectionProps> = ({ onSelectServiceForInquiry }) => {
  const [activeCategory, setActiveCategory] = useState<ServiceCategory>('all');
  const [selectedService, setSelectedService] = useState<ServiceItem | null>(null);

  const filteredServices = servicesData.filter((s) => {
    if (activeCategory === 'all') return true;
    return s.category === activeCategory;
  });

  const getServiceIcon = (type: ServiceItem['visualType']) => {
    switch (type) {
      case 'media': return <Film className="w-5 h-5 text-[#00C2C7]" />;
      case 'camera': return <Camera className="w-5 h-5 text-[#00C2C7]" />;
      case 'post': return <Clapperboard className="w-5 h-5 text-[#D4AF37]" />;
      case 'design': return <Palette className="w-5 h-5 text-[#C0C7D1]" />;
      case 'web': return <Globe className="w-5 h-5 text-[#00C2C7]" />;
      case 'enterprise': return <Server className="w-5 h-5 text-[#00C2C7]" />;
      case 'ai': return <Cpu className="w-5 h-5 text-[#00C2C7]" />;
      case 'cloud': return <Database className="w-5 h-5 text-[#00C2C7]" />;
      case 'platform': return <LayoutGrid className="w-5 h-5 text-[#C0C7D1]" />;
      case 'game': return <Gamepad2 className="w-5 h-5 text-[#D4AF37]" />;
      case 'broadcast': return <Radio className="w-5 h-5 text-[#00C2C7]" />;
      case 'consulting': return <Terminal className="w-5 h-5 text-[#C0C7D1]" />;
      default: return <Film className="w-5 h-5 text-[#00C2C7]" />;
    }
  };

  const getVisualArtwork = (service: ServiceItem) => {
    switch (service.visualType) {
      case 'media':
        return (
          <div className="h-32 w-full rounded-xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-4 relative overflow-hidden border border-slate-800 flex items-center justify-between">
            <div className="space-y-1 z-10">
              <span className="text-[10px] font-mono text-[#00C2C7] uppercase">CINEMA ACES PIPELINE</span>
              <div className="text-xs font-semibold text-white">4K / 8K Cinema Production</div>
              <div className="text-[10px] text-slate-400">RED Monstro · Blackmagic Cine · High Dynamic Range</div>
            </div>
            <div className="w-16 h-16 rounded-full bg-[#00C2C7]/10 flex items-center justify-center shrink-0 border border-[#00C2C7]/30">
              <Film className="w-8 h-8 text-[#00C2C7]" />
            </div>
          </div>
        );
      case 'camera':
        return (
          <div className="h-32 w-full rounded-xl bg-gradient-to-br from-[#111827] via-[#0B1220] to-slate-900 p-4 relative overflow-hidden border border-slate-800 flex items-center justify-between">
            <div className="space-y-1 z-10">
              <span className="text-[10px] font-mono text-[#00C2C7] uppercase">PRECISION SENSING</span>
              <div className="text-xs font-semibold text-white">Still & Motion Acquisition</div>
              <div className="text-[10px] text-slate-400">Full-Frame Arrays · Aerial Gimbal · Studio Lighting</div>
            </div>
            <div className="w-16 h-16 rounded-full bg-[#00C2C7]/10 flex items-center justify-center shrink-0 border border-[#00C2C7]/30">
              <Camera className="w-8 h-8 text-[#00C2C7]" />
            </div>
          </div>
        );
      case 'post':
        return (
          <div className="h-32 w-full rounded-xl bg-gradient-to-br from-slate-900 via-[#111827] to-slate-900 p-4 relative overflow-hidden border border-slate-800 flex items-center justify-between">
            <div className="space-y-1 z-10">
              <span className="text-[10px] font-mono text-[#D4AF37] uppercase">COLOR CALIBRATION</span>
              <div className="text-xs font-semibold text-white">Mastering & Multitrack Suite</div>
              <div className="text-[10px] text-slate-400">DaVinci Resolve · After Effects · Pro Tools</div>
            </div>
            <div className="w-16 h-16 rounded-full bg-[#D4AF37]/10 flex items-center justify-center shrink-0 border border-[#D4AF37]/30">
              <Clapperboard className="w-8 h-8 text-[#D4AF37]" />
            </div>
          </div>
        );
      case 'design':
        return (
          <div className="h-32 w-full rounded-xl bg-gradient-to-br from-[#0B1220] via-slate-900 to-[#111827] p-4 relative overflow-hidden border border-slate-800 flex items-center justify-between">
            <div className="space-y-1 z-10">
              <span className="text-[10px] font-mono text-[#C0C7D1] uppercase">IDENTITY SYSTEMS</span>
              <div className="text-xs font-semibold text-white">Vector Tokens & Monograms</div>
              <div className="text-[10px] text-slate-400">Brand Guidelines · Typography · Packaging Systems</div>
            </div>
            <div className="w-16 h-16 rounded-full bg-[#C0C7D1]/10 flex items-center justify-center shrink-0 border border-[#C0C7D1]/30">
              <Palette className="w-8 h-8 text-[#C0C7D1]" />
            </div>
          </div>
        );
      case 'web':
        return (
          <div className="h-32 w-full rounded-xl bg-gradient-to-br from-slate-900 via-[#0B1220] to-slate-950 p-4 relative overflow-hidden border border-slate-800 flex items-center justify-between">
            <div className="space-y-1 z-10">
              <span className="text-[10px] font-mono text-[#00C2C7] uppercase">REACTIVE FRONTEND</span>
              <div className="text-xs font-semibold text-white">Next-Gen Web Architecture</div>
              <div className="text-[10px] text-slate-400">React 19 · TypeScript · Tailwind CSS · 100 Lighthouse</div>
            </div>
            <div className="w-16 h-16 rounded-full bg-[#00C2C7]/10 flex items-center justify-center shrink-0 border border-[#00C2C7]/30">
              <Globe className="w-8 h-8 text-[#00C2C7]" />
            </div>
          </div>
        );
      case 'enterprise':
        return (
          <div className="h-32 w-full rounded-xl bg-gradient-to-br from-[#111827] via-slate-900 to-[#0B1220] p-4 relative overflow-hidden border border-slate-800 flex items-center justify-between">
            <div className="space-y-1 z-10">
              <span className="text-[10px] font-mono text-[#00C2C7] uppercase">CORE MICROSERVICES</span>
              <div className="text-xs font-semibold text-white">Enterprise Software Portals</div>
              <div className="text-[10px] text-slate-400">Tenant Isolation · RBAC Security · Node.js / Express</div>
            </div>
            <div className="w-16 h-16 rounded-full bg-[#00C2C7]/10 flex items-center justify-center shrink-0 border border-[#00C2C7]/30">
              <Server className="w-8 h-8 text-[#00C2C7]" />
            </div>
          </div>
        );
      case 'ai':
        return (
          <div className="h-32 w-full rounded-xl bg-gradient-to-br from-[#0B1220] via-slate-900 to-[#00C2C7]/15 p-4 relative overflow-hidden border border-slate-800 flex items-center justify-between">
            <div className="space-y-1 z-10">
              <span className="text-[10px] font-mono text-[#00C2C7] uppercase">NEURAL PIPELINES</span>
              <div className="text-xs font-semibold text-white">Autonomous Agent Workforce</div>
              <div className="text-[10px] text-slate-400">@google/genai SDK · Safe Proxies · 12 Development Agents</div>
            </div>
            <div className="w-16 h-16 rounded-full bg-[#00C2C7]/10 flex items-center justify-center shrink-0 border border-[#00C2C7]/30">
              <Cpu className="w-8 h-8 text-[#00C2C7]" />
            </div>
          </div>
        );
      case 'cloud':
        return (
          <div className="h-32 w-full rounded-xl bg-gradient-to-br from-slate-900 via-[#111827] to-slate-950 p-4 relative overflow-hidden border border-slate-800 flex items-center justify-between">
            <div className="space-y-1 z-10">
              <span className="text-[10px] font-mono text-[#00C2C7] uppercase">RELATIONAL CLOUD</span>
              <div className="text-xs font-semibold text-white">Database & Infrastructure</div>
              <div className="text-[10px] text-slate-400">PostgreSQL · Cloud Run · GitHub Actions CI/CD</div>
            </div>
            <div className="w-16 h-16 rounded-full bg-[#00C2C7]/10 flex items-center justify-center shrink-0 border border-[#00C2C7]/30">
              <Database className="w-8 h-8 text-[#00C2C7]" />
            </div>
          </div>
        );
      case 'platform':
        return (
          <div className="h-32 w-full rounded-xl bg-gradient-to-br from-slate-900 via-[#0B1220] to-[#111827] p-4 relative overflow-hidden border border-slate-800 flex items-center justify-between">
            <div className="space-y-1 z-10">
              <span className="text-[10px] font-mono text-[#C0C7D1] uppercase">REAL-TIME FABRIC</span>
              <div className="text-xs font-semibold text-white">Interactive Digital Platforms</div>
              <div className="text-[10px] text-slate-400">WebSockets · Collaborative Canvas · PWA Caching</div>
            </div>
            <div className="w-16 h-16 rounded-full bg-[#C0C7D1]/10 flex items-center justify-center shrink-0 border border-[#C0C7D1]/30">
              <LayoutGrid className="w-8 h-8 text-[#C0C7D1]" />
            </div>
          </div>
        );
      case 'game':
        return (
          <div className="h-32 w-full rounded-xl bg-gradient-to-br from-[#0B1220] via-slate-900 to-[#D4AF37]/15 p-4 relative overflow-hidden border border-slate-800 flex items-center justify-between">
            <div className="space-y-1 z-10">
              <span className="text-[10px] font-mono text-[#D4AF37] uppercase">SPATIAL SHADERS</span>
              <div className="text-xs font-semibold text-white">Interactive 3D & Gaming</div>
              <div className="text-[10px] text-slate-400">Three.js · GLSL Shaders · WebGL Hardware Acceleration</div>
            </div>
            <div className="w-16 h-16 rounded-full bg-[#D4AF37]/10 flex items-center justify-center shrink-0 border border-[#D4AF37]/30">
              <Gamepad2 className="w-8 h-8 text-[#D4AF37]" />
            </div>
          </div>
        );
      case 'broadcast':
        return (
          <div className="h-32 w-full rounded-xl bg-gradient-to-br from-slate-900 via-[#111827] to-[#0B1220] p-4 relative overflow-hidden border border-slate-800 flex items-center justify-between">
            <div className="space-y-1 z-10">
              <span className="text-[10px] font-mono text-[#00C2C7] uppercase">LOW LATENCY FEED</span>
              <div className="text-xs font-semibold text-white">Broadcast & Live Syndication</div>
              <div className="text-[10px] text-slate-400">SRT Transport · WebRTC Multi-View · Virtual Set Ingest</div>
            </div>
            <div className="w-16 h-16 rounded-full bg-[#00C2C7]/10 flex items-center justify-center shrink-0 border border-[#00C2C7]/30">
              <Radio className="w-8 h-8 text-[#00C2C7]" />
            </div>
          </div>
        );
      case 'consulting':
        return (
          <div className="h-32 w-full rounded-xl bg-gradient-to-br from-[#111827] via-slate-900 to-slate-950 p-4 relative overflow-hidden border border-slate-800 flex items-center justify-between">
            <div className="space-y-1 z-10">
              <span className="text-[10px] font-mono text-[#C0C7D1] uppercase">ENTERPRISE ADVISORY</span>
              <div className="text-xs font-semibold text-white">Architecture & Technology Due Diligence</div>
              <div className="text-[10px] text-slate-400">Security Posture · Invariant Modeling · Modernization</div>
            </div>
            <div className="w-16 h-16 rounded-full bg-[#C0C7D1]/10 flex items-center justify-center shrink-0 border border-[#C0C7D1]/30">
              <Terminal className="w-8 h-8 text-[#C0C7D1]" />
            </div>
          </div>
        );
    }
  };

  return (
    <section id="services" className="py-20 lg:py-28 bg-[#0B1220] border-t border-slate-800/80 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#00C2C7] uppercase tracking-wider mb-2">
              <span>Proposed Service Categories</span>
              <span aria-hidden="true">·</span>
              <span>12 Enterprise Disciplines</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white text-balance">
              Full-Spectrum Creative & Engineering Capabilities
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-300 text-balance">
              Every category is architected as an extensible production framework, administratively manageable and configured for enterprise deployment.
            </p>
          </div>

          {/* Category Filter Buttons (Functional Tabs, Not Static Pills) */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-900/90 border border-slate-800 rounded-xl">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                activeCategory === 'all'
                  ? 'bg-[#00C2C7] text-[#0B1220] font-semibold shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              All (12)
            </button>
            <button
              onClick={() => setActiveCategory('creative')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                activeCategory === 'creative'
                  ? 'bg-[#00C2C7] text-[#0B1220] font-semibold shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Creative Media
            </button>
            <button
              onClick={() => setActiveCategory('software')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                activeCategory === 'software'
                  ? 'bg-[#00C2C7] text-[#0B1220] font-semibold shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Software & Cloud
            </button>
            <button
              onClick={() => setActiveCategory('ai')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                activeCategory === 'ai'
                  ? 'bg-[#00C2C7] text-[#0B1220] font-semibold shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Artificial Intelligence
            </button>
            <button
              onClick={() => setActiveCategory('interactive')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                activeCategory === 'interactive'
                  ? 'bg-[#00C2C7] text-[#0B1220] font-semibold shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Interactive & Broadcast
            </button>
          </div>
        </div>

        {/* 12 Services Grid */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServices.map((service) => (
            <div
              key={service.id}
              className="rounded-2xl bg-[#111827] border border-slate-800 p-6 flex flex-col justify-between hover:border-[#00C2C7]/40 transition-all group"
            >
              <div>
                {/* Visual Artwork Tailored to Service */}
                {getVisualArtwork(service)}

                <div className="mt-5 flex items-center justify-between text-xs text-slate-400">
                  <span className="font-mono text-[#00C2C7] font-semibold">{service.number}.</span>
                  <span className="text-[11px] uppercase tracking-wider">{service.category}</span>
                </div>

                <h3 className="mt-2 text-lg font-bold text-white group-hover:text-[#00C2C7] transition-colors">
                  {service.title}
                </h3>

                <p className="mt-2 text-xs text-slate-300 leading-relaxed line-clamp-3">
                  {service.tagline}
                </p>

                {/* Key Deliverables Bullet Preview */}
                <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-1.5">
                  {service.deliverables.slice(0, 2).map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-slate-400">
                      <span className="text-[#00C2C7] mt-0.5">·</span>
                      <span className="truncate">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between gap-3">
                <button
                  onClick={() => setSelectedService(service)}
                  className="text-xs font-semibold text-slate-300 hover:text-[#00C2C7] transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>View Full Scope</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => onSelectServiceForInquiry(service.id)}
                  className="px-3 py-1.5 text-xs font-semibold text-[#0B1220] bg-[#00C2C7] hover:bg-[#00d6dc] rounded-md transition-colors cursor-pointer"
                >
                  Inquire
                </button>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* Service Detail Modal */}
      {selectedService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="relative max-w-2xl w-full bg-[#111827] border border-slate-700 rounded-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto shadow-2xl">
            
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700">
                  {getServiceIcon(selectedService.visualType)}
                </div>
                <div>
                  <span className="text-xs font-mono text-[#00C2C7] font-semibold">SERVICE {selectedService.number}</span>
                  <h3 className="text-xl font-bold text-white">{selectedService.title}</h3>
                </div>
              </div>
              <button
                onClick={() => setSelectedService(null)}
                className="p-1 text-slate-400 hover:text-white rounded-md cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="mt-4 text-sm text-slate-300 leading-relaxed">
              {selectedService.description}
            </p>

            <div className="mt-6 space-y-4">
              <div>
                <h4 className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">Scope of Deliverables</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedService.deliverables.map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
                      <Check className="w-3.5 h-3.5 text-[#00C2C7] mt-0.5 shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">Technologies & Toolchains</h4>
                <div className="flex flex-wrap gap-2 text-xs text-slate-300">
                  {selectedService.technologies.map((tech, idx) => (
                    <span key={idx} className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800">
                      {tech}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                <span>Administrative Status:</span>
                <span className="text-[#00C2C7] font-medium">{selectedService.status}</span>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-800 flex items-center justify-end gap-3">
              <button
                onClick={() => setSelectedService(null)}
                className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-white cursor-pointer"
              >
                Close
              </button>
              <button
                onClick={() => {
                  const sId = selectedService.id;
                  setSelectedService(null);
                  onSelectServiceForInquiry(sId);
                }}
                className="px-5 py-2 text-xs font-semibold text-[#0B1220] bg-[#00C2C7] hover:bg-[#00d6dc] rounded-lg transition-colors cursor-pointer"
              >
                Request Quotation & Proposal
              </button>
            </div>

          </div>
        </div>
      )}
    </section>
  );
};
