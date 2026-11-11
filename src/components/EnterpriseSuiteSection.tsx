import React from 'react';
import { 
  Globe, Film, Code2, Shield, FolderGit2, 
  Cpu, LayoutDashboard, ArrowUpRight, CheckCircle2, Lock 
} from 'lucide-react';

interface EnterpriseSuiteSectionProps {
  onOpenPortalTab: (tab: 'portal' | 'studio' | 'agents' | 'admin') => void;
}

export const EnterpriseSuiteSection: React.FC<EnterpriseSuiteSectionProps> = ({ onOpenPortalTab }) => {
  const pillars = [
    {
      id: 'pillar-1',
      number: '01',
      title: 'Public Corporate Website',
      phase: 'Phase 1 · Operational',
      status: 'active',
      description: 'Authoritative brand presentation, corporate governance, registered business location, and direct inquiry dispatching.',
      icon: <Globe className="w-5 h-5 text-[#00C2C7]" />,
      actionLabel: 'Current View',
      action: () => window.scrollTo({ top: 0, behavior: 'smooth' })
    },
    {
      id: 'pillar-2',
      number: '02',
      title: 'Multimedia & Creative Portfolio',
      phase: 'Phase 1 · Operational',
      status: 'active',
      description: 'Cinema ACES workflows, full-frame photography pipelines, color calibration, and architectural blueprints.',
      icon: <Film className="w-5 h-5 text-[#D4AF37]" />,
      actionLabel: 'View Portfolio',
      action: () => {
        const el = document.getElementById('portfolio');
        el?.scrollIntoView({ behavior: 'smooth' });
      }
    },
    {
      id: 'pillar-3',
      number: '03',
      title: 'AI Website & Software Studio',
      phase: 'Phase 3 · Specification',
      status: 'preview',
      description: 'Natural-language prompt-to-app generator, React 19 component synthesis, live responsive canvas, and export pipelines.',
      icon: <Code2 className="w-5 h-5 text-[#00C2C7]" />,
      actionLabel: 'Explore Studio',
      action: () => onOpenPortalTab('studio')
    },
    {
      id: 'pillar-4',
      number: '04',
      title: 'Enterprise Client Portal',
      phase: 'Phase 2 · Specification',
      status: 'preview',
      description: 'Tenant-isolated accounts, milestone sign-offs, timecode media review, invoice statuses, and support tickets.',
      icon: <Shield className="w-5 h-5 text-[#00C2C7]" />,
      actionLabel: 'Access Portal',
      action: () => onOpenPortalTab('portal')
    },
    {
      id: 'pillar-5',
      number: '05',
      title: 'Project Management Engine',
      phase: 'Phase 2 · Specification',
      status: 'preview',
      description: 'Centralized deliverable dependency mapping, critical path tracking, and automated client notifications.',
      icon: <CheckCircle2 className="w-5 h-5 text-[#C0C7D1]" />,
      actionLabel: 'Review Engine',
      action: () => onOpenPortalTab('portal')
    },
    {
      id: 'pillar-6',
      number: '06',
      title: 'GitHub & Cloud Deployments',
      phase: 'Phase 4 · Specification',
      status: 'preview',
      description: 'Repository syncing, automated branch previews, GitHub Actions CI verification, and rollback control.',
      icon: <FolderGit2 className="w-5 h-5 text-[#00C2C7]" />,
      actionLabel: 'Inspect Pipeline',
      action: () => onOpenPortalTab('admin')
    },
    {
      id: 'pillar-7',
      number: '07',
      title: 'AI Agent Workforce (12 Roles)',
      phase: 'Phase 5/7 · Active Matrix',
      status: 'preview',
      description: 'Autonomous development agents covering requirements, architecture, UI, frontend, backend, database, QA, and security.',
      icon: <Cpu className="w-5 h-5 text-[#00C2C7]" />,
      actionLabel: 'Inspect 12 Agents',
      action: () => onOpenPortalTab('agents')
    },
    {
      id: 'pillar-8',
      number: '08',
      title: 'Super Administrator Center',
      phase: 'Phase 9 · Specification',
      status: 'preview',
      description: 'Executive control over client tenants, live brief dispatch queues, billing records, and audit event logs.',
      icon: <LayoutDashboard className="w-5 h-5 text-[#D4AF37]" />,
      actionLabel: 'Open Admin Center',
      action: () => onOpenPortalTab('admin')
    }
  ];

  return (
    <section id="architecture" className="py-20 lg:py-28 bg-[#0B1220] border-t border-slate-800/80 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#00C2C7] uppercase tracking-wider mb-2">
            <span>Enterprise System Architecture</span>
            <span aria-hidden="true">·</span>
            <span>The 8 Platform Pillars</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white text-balance">
            The Ophireum Network Ecosystem
          </h2>
          <p className="mt-4 text-base text-slate-300 leading-relaxed text-balance">
            A real, extensible architecture designed to unite creative multimedia production with cloud engineering, client governance, and autonomous AI systems.
          </p>
        </div>

        {/* 8 Pillars Asymmetric Grid */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {pillars.map((pillar) => (
            <div
              key={pillar.id}
              className="rounded-2xl bg-[#111827] border border-slate-800 p-6 flex flex-col justify-between hover:border-[#00C2C7]/40 transition-all group"
            >
              <div>
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center">
                    {pillar.icon}
                  </div>
                  <span className="text-[10px] font-mono text-[#00C2C7] bg-[#00C2C7]/10 px-2 py-0.5 rounded border border-[#00C2C7]/20 uppercase">
                    {pillar.phase}
                  </span>
                </div>

                <div className="mt-4">
                  <span className="text-xs font-mono text-slate-500">{pillar.number}.</span>
                  <h3 className="text-base font-bold text-white mt-0.5 group-hover:text-[#00C2C7] transition-colors">
                    {pillar.title}
                  </h3>
                  <p className="mt-2 text-xs text-slate-300 leading-relaxed">
                    {pillar.description}
                  </p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800/80">
                <button
                  onClick={pillar.action}
                  className="w-full py-2 px-3 text-xs font-semibold text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>{pillar.actionLabel}</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-[#00C2C7]" />
                </button>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};
