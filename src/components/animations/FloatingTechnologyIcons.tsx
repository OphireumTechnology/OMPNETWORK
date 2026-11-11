import React, { useState } from 'react';
import { 
  Cpu, Network, Cloud, Code2, Database, ShieldCheck, 
  Film, Clapperboard, Palette, Globe, Bot, LayoutDashboard,
  Sparkles, ArrowUpRight
} from 'lucide-react';

interface TechIcon {
  id: string;
  name: string;
  category: string;
  icon: React.ReactNode;
  accent: string;
  description: string;
}

export const FloatingTechnologyIcons: React.FC<{ onSelectCategory?: (cat: string) => void }> = ({ onSelectCategory }) => {
  const [activeHover, setActiveHover] = useState<string | null>(null);

  const icons: TechIcon[] = [
    {
      id: 'ai',
      name: 'Artificial Intelligence',
      category: 'Neural Models & LLMs',
      icon: <Cpu className="w-5 h-5 text-[#00C2C7]" />,
      accent: 'border-[#00C2C7]/40 shadow-[#00C2C7]/20',
      description: 'Server-side LLMs, generative pipelines, and autonomous agent orchestration.'
    },
    {
      id: 'blockchain',
      name: 'Blockchain & Distributed Networks',
      category: 'Decentralized Architecture',
      icon: <Network className="w-5 h-5 text-[#00C2C7]" />,
      accent: 'border-[#00C2C7]/40 shadow-[#00C2C7]/20',
      description: 'Distributed ledger topologies, immutable audit logging, and cryptographic verification.'
    },
    {
      id: 'cloud',
      name: 'Cloud Computing',
      category: 'Cloud Run & Scalability',
      icon: <Cloud className="w-5 h-5 text-[#00C2C7]" />,
      accent: 'border-[#00C2C7]/40 shadow-[#00C2C7]/20',
      description: 'Containerized microservices, zero-downtime clustering, and multi-region replication.'
    },
    {
      id: 'software',
      name: 'Software Engineering',
      category: 'Full-Stack Systems',
      icon: <Code2 className="w-5 h-5 text-[#C0C7D1]" />,
      accent: 'border-[#C0C7D1]/40 shadow-[#C0C7D1]/20',
      description: 'Strict TypeScript interfaces, modular Node.js architectures, and robust backend state.'
    },
    {
      id: 'database',
      name: 'Database Infrastructure',
      category: 'PostgreSQL & Cloud SQL',
      icon: <Database className="w-5 h-5 text-[#00C2C7]" />,
      accent: 'border-[#00C2C7]/40 shadow-[#00C2C7]/20',
      description: 'Relational data modeling, schema migration pipelines, and sub-millisecond query execution.'
    },
    {
      id: 'cybersecurity',
      name: 'Cybersecurity & RBAC',
      category: 'Enterprise Protection',
      icon: <ShieldCheck className="w-5 h-5 text-[#D4AF37]" />,
      accent: 'border-[#D4AF37]/40 shadow-[#D4AF37]/20',
      description: 'Multi-factor authentication, tenant-isolated access boundaries, and end-to-end encryption.'
    },
    {
      id: 'multimedia',
      name: 'Multimedia Production',
      category: '4K/8K Cinematography',
      icon: <Film className="w-5 h-5 text-[#D4AF37]" />,
      accent: 'border-[#D4AF37]/40 shadow-[#D4AF37]/20',
      description: 'Full-frame cinema capture, aerial drone operations, and high-stakes commercial filming.'
    },
    {
      id: 'editing',
      name: 'Video Editing & Post-Production',
      category: 'ACES Mastering Suite',
      icon: <Clapperboard className="w-5 h-5 text-[#D4AF37]" />,
      accent: 'border-[#D4AF37]/40 shadow-[#D4AF37]/20',
      description: 'Hardware-calibrated color grading, motion VFX compositing, and spatial audio mastering.'
    },
    {
      id: 'branding',
      name: 'Digital Branding',
      category: 'Design Systems & Tokens',
      icon: <Palette className="w-5 h-5 text-[#C0C7D1]" />,
      accent: 'border-[#C0C7D1]/40 shadow-[#C0C7D1]/20',
      description: 'Corporate emblem engineering, typography hierarchies, and scalable brand guidelines.'
    },
    {
      id: 'website',
      name: 'Website Development',
      category: 'React 19 & Next-Gen Web',
      icon: <Globe className="w-5 h-5 text-[#00C2C7]" />,
      accent: 'border-[#00C2C7]/40 shadow-[#00C2C7]/20',
      description: 'Zero-bloat responsive experiences, accessibility compliance, and high Lighthouse scoring.'
    },
    {
      id: 'automation',
      name: 'Automation & Robotics',
      category: 'Workflow Acceleration',
      icon: <Bot className="w-5 h-5 text-[#00C2C7]" />,
      accent: 'border-[#00C2C7]/40 shadow-[#00C2C7]/20',
      description: 'Automated CI/CD deployment routines, test suites, and continuous health probes.'
    },
    {
      id: 'enterprise',
      name: 'Enterprise Applications',
      category: 'Mission-Critical Portals',
      icon: <LayoutDashboard className="w-5 h-5 text-[#00C2C7]" />,
      accent: 'border-[#00C2C7]/40 shadow-[#00C2C7]/20',
      description: 'Multi-tenant client portals, real-time collaboration engines, and executive dashboards.'
    }
  ];

  return (
    <div className="w-full">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
        {icons.map((tech, index) => {
          const isHovered = activeHover === tech.id;
          return (
            <div
              key={tech.id}
              onMouseEnter={() => setActiveHover(tech.id)}
              onMouseLeave={() => setActiveHover(null)}
              onClick={() => onSelectCategory && onSelectCategory(tech.id)}
              className={`p-3.5 rounded-xl bg-slate-900/80 backdrop-blur-md border border-slate-800 transition-all duration-300 cursor-pointer flex flex-col justify-between group relative overflow-hidden ${
                isHovered ? `border-[#00C2C7]/60 shadow-lg ${tech.accent} -translate-y-1` : 'hover:border-slate-700'
              }`}
              style={{
                // Staggered subtle floating motion delay
                animation: `pulse 4s ease-in-out ${index * 0.25}s infinite`,
              }}
            >
              {/* Subtle top indicator */}
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-lg bg-slate-800/80 flex items-center justify-center border border-slate-700/60 group-hover:border-[#00C2C7]/40 transition-colors">
                  {tech.icon}
                </div>
                <span className="text-[9px] font-mono text-slate-500 uppercase">
                  #{String(index + 1).padStart(2, '0')}
                </span>
              </div>

              <div className="mt-3">
                <span className="text-[10px] font-mono text-[#00C2C7] block uppercase tracking-wider truncate">
                  {tech.category}
                </span>
                <h4 className="text-xs font-bold text-white mt-0.5 group-hover:text-[#00C2C7] transition-colors leading-tight">
                  {tech.name}
                </h4>
              </div>

              {/* Hover description preview */}
              {isHovered && (
                <div className="absolute inset-0 bg-[#0B1220]/95 p-3 flex flex-col justify-between z-10 animate-fade-in border border-[#00C2C7]/50 rounded-xl">
                  <p className="text-[10px] text-slate-300 leading-relaxed">
                    {tech.description}
                  </p>
                  <span className="text-[9px] font-mono text-[#00C2C7] flex items-center gap-1 font-semibold">
                    <span>EXPLORE CAPABILITY</span>
                    <ArrowUpRight className="w-2.5 h-2.5" />
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
