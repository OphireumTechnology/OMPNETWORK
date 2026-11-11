import React, { useState } from 'react';
import { servicesData } from '../data/servicesData';
import { ServiceItem, ServiceCategory } from '../types';
import { 
  Film, Camera, Clapperboard, Palette, Globe, Server, 
  Cpu, Database, LayoutGrid, Gamepad2, Radio, Terminal,
  ArrowUpRight, Check, X, Shield, ChevronRight, Activity,
  Lock, GitBranch, Play
} from 'lucide-react';
import { AIProcessingVisualizer } from './animations/AIProcessingVisualizer';

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

  // Distinct technological animated illustration for each individual service
  const getVisualArtwork = (service: ServiceItem) => {
    switch (service.visualType) {
      case 'media':
        // Animated camera, sensor & cinema timeline
        return (
          <div className="h-36 w-full rounded-xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-4 relative overflow-hidden border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[10px] font-mono text-[#00C2C7]">
              <span>8K RAW INGEST</span>
              <span className="flex items-center gap-1 text-[#D4AF37]"><Play className="w-2.5 h-2.5 fill-current" /> 24.000 FPS</span>
            </div>
            
            {/* Animated cinema timeline track */}
            <div className="my-2 space-y-1">
              <div className="h-2 w-full rounded bg-slate-800 overflow-hidden flex">
                <div className="h-full bg-[#00C2C7] w-2/5 animate-pulse" />
                <div className="h-full bg-[#D4AF37] w-1/4" />
                <div className="h-full bg-cyan-700 w-1/3" />
              </div>
              <div className="flex justify-between text-[8px] font-mono text-slate-500">
                <span>00:00:00</span>
                <span>00:14:28:12 (ACES CCT)</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
              <span className="text-[11px] font-semibold text-white">RED & Blackmagic Cine Systems</span>
              <div className="w-6 h-6 rounded-md bg-[#00C2C7]/15 flex items-center justify-center text-[#00C2C7]">
                <Film className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        );

      case 'camera':
        // Optical sensor array & focal grid
        return (
          <div className="h-36 w-full rounded-xl bg-gradient-to-br from-[#111827] via-[#0B1220] to-slate-900 p-4 relative overflow-hidden border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[10px] font-mono text-[#00C2C7]">
              <span>FULL-FRAME ACQUISITION</span>
              <span>ISO 800 · ƒ/1.4</span>
            </div>

            {/* Focal grid viewfinder */}
            <div className="relative h-12 w-full border border-dashed border-cyan-500/30 rounded flex items-center justify-center">
              <div className="w-4 h-4 border border-[#00C2C7] rounded-sm flex items-center justify-center">
                <div className="w-1 h-1 bg-[#D4AF37] rounded-full animate-ping" />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
              <span className="text-[11px] font-semibold text-white">Aerial & Studio Glass Arrays</span>
              <div className="w-6 h-6 rounded-md bg-[#00C2C7]/15 flex items-center justify-center text-[#00C2C7]">
                <Camera className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        );

      case 'post':
        // Color wheels & waveform monitor
        return (
          <div className="h-36 w-full rounded-xl bg-gradient-to-br from-slate-900 via-[#111827] to-slate-900 p-4 relative overflow-hidden border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[10px] font-mono text-[#D4AF37]">
              <span>ACES COLOR CALIBRATION</span>
              <span>DCI-P3 / REC.709</span>
            </div>

            {/* Tri-color waveform simulation */}
            <div className="flex items-end gap-1 h-10 w-full pt-2">
              {[45, 65, 30, 85, 95, 40, 70, 90, 60, 75, 50, 80, 65, 90].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 bg-gradient-to-t from-[#00C2C7] to-[#D4AF37] rounded-t-sm"
                  style={{ height: `${h}%`, opacity: 0.75 }}
                />
              ))}
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
              <span className="text-[11px] font-semibold text-white">DaVinci Resolve Studio & Pro Tools</span>
              <div className="w-6 h-6 rounded-md bg-[#D4AF37]/15 flex items-center justify-center text-[#D4AF37]">
                <Clapperboard className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        );

      case 'design':
        // Vector grid & design tokens
        return (
          <div className="h-36 w-full rounded-xl bg-gradient-to-br from-[#0B1220] via-slate-900 to-[#111827] p-4 relative overflow-hidden border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[10px] font-mono text-[#C0C7D1]">
              <span>IDENTITY TOKENS</span>
              <span>BEZIER CURVATURE</span>
            </div>

            {/* Vector monogram bezier preview */}
            <div className="flex items-center justify-around py-1">
              <span className="w-7 h-7 rounded border border-cyan-400/50 flex items-center justify-center font-bold text-xs text-white">
                O
              </span>
              <div className="w-8 h-0.5 bg-[#00C2C7]" />
              <span className="w-7 h-7 rounded border border-yellow-400/50 flex items-center justify-center font-bold text-xs text-white">
                P
              </span>
              <div className="w-8 h-0.5 bg-[#D4AF37]" />
              <span className="w-7 h-7 rounded border border-slate-400/50 flex items-center justify-center font-bold text-xs text-white">
                M
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
              <span className="text-[11px] font-semibold text-white">Corporate Guidelines & Token Repos</span>
              <div className="w-6 h-6 rounded-md bg-[#C0C7D1]/15 flex items-center justify-center text-[#C0C7D1]">
                <Palette className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        );

      case 'web':
        // Responsive code DOM & Lighthouse meters
        return (
          <div className="h-36 w-full rounded-xl bg-gradient-to-br from-slate-900 via-[#0B1220] to-slate-950 p-4 relative overflow-hidden border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[10px] font-mono text-[#00C2C7]">
              <span>REACT 19 / TAILWIND V4</span>
              <span className="text-emerald-400">100 LIGHTHOUSE</span>
            </div>

            {/* Code lines simulation */}
            <div className="space-y-1 font-mono text-[9px] text-slate-400">
              <div className="text-[#00C2C7]">export const PlatformView: FC = () =&gt; &#123;</div>
              <div className="pl-3 text-slate-300">return &lt;InteractiveExperience theme="dark" /&gt;;</div>
              <div className="text-[#00C2C7]">&#125;;</div>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
              <span className="text-[11px] font-semibold text-white">Semantic Web & Responsive Layouts</span>
              <div className="w-6 h-6 rounded-md bg-[#00C2C7]/15 flex items-center justify-center text-[#00C2C7]">
                <Globe className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        );

      case 'enterprise':
        // Microservices & RBAC gateway
        return (
          <div className="h-36 w-full rounded-xl bg-gradient-to-br from-[#111827] via-slate-900 to-[#0B1220] p-4 relative overflow-hidden border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[10px] font-mono text-[#00C2C7]">
              <span>RBAC TENANT ISOLATION</span>
              <span className="text-emerald-400 font-mono">JWT / MFA</span>
            </div>

            {/* Connected microservice nodes */}
            <div className="flex items-center justify-between py-1">
              <div className="p-1 px-2 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-white">
                Auth Gate
              </div>
              <div className="h-0.5 flex-1 bg-gradient-to-r from-[#00C2C7] to-slate-700 mx-2" />
              <div className="p-1 px-2 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-white">
                Tenant DB
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
              <span className="text-[11px] font-semibold text-white">Mission-Critical Portals & APIs</span>
              <div className="w-6 h-6 rounded-md bg-[#00C2C7]/15 flex items-center justify-center text-[#00C2C7]">
                <Server className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        );

      case 'ai':
        // Neural network & model stream
        return (
          <div className="h-36 w-full rounded-xl bg-gradient-to-br from-[#0B1220] via-slate-900 to-[#00C2C7]/15 p-4 relative overflow-hidden border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[10px] font-mono text-[#00C2C7]">
              <span>AGENTIC PIPELINE</span>
              <span className="text-[#D4AF37] font-mono">@google/genai</span>
            </div>

            {/* Neural nodes pulse */}
            <div className="flex items-center justify-center gap-3 py-1">
              <div className="w-2.5 h-2.5 rounded-full bg-[#00C2C7] animate-ping" />
              <div className="w-2 h-2 rounded-full bg-slate-400" />
              <div className="w-3 h-3 rounded-full bg-[#D4AF37] shadow-lg shadow-[#D4AF37]/50" />
              <div className="w-2 h-2 rounded-full bg-slate-400" />
              <div className="w-2.5 h-2.5 rounded-full bg-[#00C2C7]" />
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
              <span className="text-[11px] font-semibold text-white">12 Autonomous AI Agent Workforce</span>
              <div className="w-6 h-6 rounded-md bg-[#00C2C7]/15 flex items-center justify-center text-[#00C2C7]">
                <Cpu className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        );

      case 'cloud':
        // Server cluster & PostgreSQL schema
        return (
          <div className="h-36 w-full rounded-xl bg-gradient-to-br from-slate-900 via-[#111827] to-slate-950 p-4 relative overflow-hidden border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[10px] font-mono text-[#00C2C7]">
              <span>CLOUD SQL POSTGRESQL</span>
              <span className="text-emerald-400">99.99% SLA</span>
            </div>

            {/* Stacked database disks */}
            <div className="space-y-1 py-1">
              <div className="h-2 w-full rounded bg-slate-800 border border-slate-700 flex items-center px-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <div className="h-2 w-full rounded bg-slate-800 border border-slate-700 flex items-center px-1">
                <div className="w-1.5 h-1.5 rounded-full bg-[#00C2C7]" />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
              <span className="text-[11px] font-semibold text-white">Relational Data & Disaster Recovery</span>
              <div className="w-6 h-6 rounded-md bg-[#00C2C7]/15 flex items-center justify-center text-[#00C2C7]">
                <Database className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        );

      case 'platform':
        // Real-time canvas & WebSockets
        return (
          <div className="h-36 w-full rounded-xl bg-gradient-to-br from-slate-900 via-[#0B1220] to-[#111827] p-4 relative overflow-hidden border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[10px] font-mono text-[#C0C7D1]">
              <span>WEBSOCKET SYNC</span>
              <span className="text-[#00C2C7]">&lt; 15MS LATENCY</span>
            </div>

            {/* Real-time pulse bars */}
            <div className="flex items-center gap-1 py-1">
              <div className="h-1 flex-1 bg-[#00C2C7] rounded" />
              <div className="h-3 w-1 bg-[#D4AF37] rounded" />
              <div className="h-1 flex-1 bg-[#00C2C7] rounded" />
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
              <span className="text-[11px] font-semibold text-white">Collaborative Interactive Workspaces</span>
              <div className="w-6 h-6 rounded-md bg-[#C0C7D1]/15 flex items-center justify-center text-[#C0C7D1]">
                <LayoutGrid className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        );

      case 'game':
        // WebGL / Three.js spatial axes
        return (
          <div className="h-36 w-full rounded-xl bg-gradient-to-br from-[#0B1220] via-slate-900 to-[#D4AF37]/15 p-4 relative overflow-hidden border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[10px] font-mono text-[#D4AF37]">
              <span>WEBGL 3D SPATIAL</span>
              <span>60 FPS GLSL</span>
            </div>

            {/* 3D wireframe cube projection */}
            <div className="flex items-center justify-center py-1">
              <div className="w-8 h-8 border border-[#D4AF37] rotate-45 transform flex items-center justify-center">
                <div className="w-4 h-4 border border-[#00C2C7]" />
              </div>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
              <span className="text-[11px] font-semibold text-white">Three.js Spatial Graphics & Simulators</span>
              <div className="w-6 h-6 rounded-md bg-[#D4AF37]/15 flex items-center justify-center text-[#D4AF37]">
                <Gamepad2 className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        );

      case 'broadcast':
        // SRT streaming uplink & multiviewer
        return (
          <div className="h-36 w-full rounded-xl bg-gradient-to-br from-slate-900 via-[#111827] to-[#0B1220] p-4 relative overflow-hidden border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[10px] font-mono text-[#00C2C7]">
              <span>SRT TRANSMISSION</span>
              <span className="text-rose-400 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping" /> LIVE</span>
            </div>

            {/* Multicam 4-split preview */}
            <div className="grid grid-cols-2 gap-1 py-1">
              <div className="h-3 rounded bg-slate-800 border border-slate-700/60" />
              <div className="h-3 rounded bg-slate-800 border border-slate-700/60" />
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
              <span className="text-[11px] font-semibold text-white">Ultra-Low Latency Cloud Syndication</span>
              <div className="w-6 h-6 rounded-md bg-[#00C2C7]/15 flex items-center justify-center text-[#00C2C7]">
                <Radio className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        );

      case 'consulting':
        // Enterprise invariant models & terminal
        return (
          <div className="h-36 w-full rounded-xl bg-gradient-to-br from-[#111827] via-slate-900 to-slate-950 p-4 relative overflow-hidden border border-slate-800 flex flex-col justify-between">
            <div className="flex items-center justify-between text-[10px] font-mono text-[#C0C7D1]">
              <span>SYSTEM INVARIANTS</span>
              <span>AUDIT REVIEW</span>
            </div>

            {/* Terminal prompt */}
            <div className="p-1 px-2 rounded bg-black/80 font-mono text-[9px] text-[#00C2C7]">
              $ ophireum audit --verify-compliance
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
              <span className="text-[11px] font-semibold text-white">Enterprise Advisory & Security Posture</span>
              <div className="w-6 h-6 rounded-md bg-[#C0C7D1]/15 flex items-center justify-center text-[#C0C7D1]">
                <Terminal className="w-3.5 h-3.5" />
              </div>
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
              <span>Proposed Service Specifications</span>
              <span aria-hidden="true">·</span>
              <span>12 Enterprise Disciplines</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white text-balance">
              Full-Spectrum Creative & Technological Capabilities
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-300 text-balance">
              Each discipline is architected as an extensible production framework, administratively manageable and configured for enterprise deployment.
            </p>
          </div>

          {/* Category Filter Buttons */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-900/90 border border-slate-800 rounded-xl">
            <button
              onClick={() => setActiveCategory('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                activeCategory === 'all'
                  ? 'bg-[#00C2C7] text-[#0B1220] font-semibold shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              All Disciplines (12)
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

        {/* 12 Services Grid with Unique Visualizations */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredServices.map((service) => (
            <div
              key={service.id}
              className="rounded-2xl bg-[#111827] border border-slate-800 p-6 flex flex-col justify-between hover:border-[#00C2C7]/50 transition-all group shadow-lg"
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
                  className="px-3.5 py-1.5 text-xs font-semibold text-[#0B1220] bg-[#00C2C7] hover:bg-[#00d6dc] rounded-md transition-colors cursor-pointer"
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

            {/* If AI service is selected, show embedded AI processing visualizer */}
            {selectedService.visualType === 'ai' && (
              <div className="mt-4 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden">
                <AIProcessingVisualizer className="w-full h-44" />
              </div>
            )}

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
