import React, { useState } from 'react';
import { portfolioData } from '../data/portfolioData';
import { PortfolioItem } from '../types';
import { Layers, ArrowUpRight, Check, X, Shield, Cpu, Film, ExternalLink } from 'lucide-react';

export const PortfolioSection: React.FC = () => {
  const [selectedProject, setSelectedProject] = useState<PortfolioItem | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const filteredProjects = portfolioData.filter((item) => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'multimedia') return item.category.toLowerCase().includes('multimedia') || item.category.toLowerCase().includes('broadcast');
    if (activeFilter === 'software') return item.category.toLowerCase().includes('software') || item.category.toLowerCase().includes('enterprise');
    if (activeFilter === 'ai') return item.category.toLowerCase().includes('artificial') || item.category.toLowerCase().includes('ai');
    if (activeFilter === 'interactive') return item.category.toLowerCase().includes('interactive') || item.category.toLowerCase().includes('3d');
    return true;
  });

  return (
    <section id="portfolio" className="py-20 lg:py-28 bg-[#0B1220] border-t border-slate-800/80 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#00C2C7] uppercase tracking-wider mb-2">
              <span>Verified Portfolios & Engineering Blueprints</span>
              <span aria-hidden="true">·</span>
              <span>Architecture Showcases</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white text-balance">
              Production Frameworks & Technical Showcases
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-300 text-balance">
              Rigorous corporate architectures, ACES color grading setups, and multi-agent AI matrices developed under Ophireum Network governance.
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-900/90 border border-slate-800 rounded-xl">
            <button
              onClick={() => setActiveFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                activeFilter === 'all'
                  ? 'bg-[#00C2C7] text-[#0B1220] font-semibold shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              All Frameworks
            </button>
            <button
              onClick={() => setActiveFilter('multimedia')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                activeFilter === 'multimedia'
                  ? 'bg-[#00C2C7] text-[#0B1220] font-semibold shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Media & Cinema
            </button>
            <button
              onClick={() => setActiveFilter('software')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                activeFilter === 'software'
                  ? 'bg-[#00C2C7] text-[#0B1220] font-semibold shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Enterprise Software
            </button>
            <button
              onClick={() => setActiveFilter('ai')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                activeFilter === 'ai'
                  ? 'bg-[#00C2C7] text-[#0B1220] font-semibold shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              AI & Automation
            </button>
          </div>
        </div>

        {/* Portfolio Showcase Grid */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              className="rounded-2xl bg-[#111827] border border-slate-800 overflow-hidden flex flex-col justify-between hover:border-[#00C2C7]/50 transition-all group"
            >
              <div>
                {/* Visual Header Representation */}
                <div className={`h-44 w-full bg-gradient-to-br ${project.imagePlaceholderGradient} p-5 flex flex-col justify-between relative border-b border-slate-800`}>
                  <div className="flex items-center justify-between z-10">
                    <span className="text-[10px] font-mono text-[#00C2C7] bg-[#0B1220]/80 px-2 py-0.5 rounded border border-slate-700/60 uppercase">
                      {project.year} · {project.status}
                    </span>
                    <Layers className="w-4 h-4 text-slate-400 group-hover:text-[#00C2C7] transition-colors" />
                  </div>
                  <div className="z-10">
                    <span className="text-xs font-mono text-slate-300 block">{project.category}</span>
                    <h3 className="text-base font-bold text-white mt-0.5 group-hover:text-[#00C2C7] transition-colors line-clamp-1">
                      {project.title}
                    </h3>
                  </div>
                </div>

                <div className="p-6">
                  <p className="text-xs text-slate-300 leading-relaxed line-clamp-3">
                    {project.description}
                  </p>

                  {/* Tech Stack Chips */}
                  <div className="mt-4 pt-4 border-t border-slate-800/80 flex flex-wrap gap-1.5">
                    {project.technologies.slice(0, 4).map((tech, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-400"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="p-6 pt-0">
                <button
                  onClick={() => setSelectedProject(project)}
                  className="w-full py-2.5 px-4 text-xs font-semibold text-slate-200 hover:text-white bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>Review Blueprint & Specs</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-[#00C2C7]" />
                </button>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* Project Detail Modal */}
      {selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
          <div className="relative max-w-2xl w-full bg-[#111827] border border-slate-700 rounded-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto shadow-2xl">
            
            <div className="flex items-start justify-between gap-4">
              <div>
                <span className="text-xs font-mono text-[#00C2C7] uppercase">{selectedProject.category} · {selectedProject.year}</span>
                <h3 className="text-xl font-bold text-white mt-1">{selectedProject.title}</h3>
                <span className="text-xs text-slate-400 block mt-0.5">{selectedProject.clientType}</span>
              </div>
              <button
                onClick={() => setSelectedProject(null)}
                className="p-1 text-slate-400 hover:text-white rounded-md cursor-pointer"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-5 space-y-5">
              <div>
                <h4 className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-1">Architecture Overview</h4>
                <p className="text-sm text-slate-300 leading-relaxed">
                  {selectedProject.description}
                </p>
              </div>

              <div>
                <h4 className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">Architectural Deliverables</h4>
                <div className="space-y-2">
                  {selectedProject.deliverables.map((deliv, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300">
                      <Check className="w-3.5 h-3.5 text-[#00C2C7] mt-0.5 shrink-0" />
                      <span>{deliv}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-mono text-slate-400 uppercase tracking-wider mb-2">Technology Stack</h4>
                <div className="flex flex-wrap gap-2 text-xs text-slate-300 font-mono">
                  {selectedProject.technologies.map((t, idx) => (
                    <span key={idx} className="px-2.5 py-1 rounded bg-slate-900 border border-slate-800">
                      {t}
                    </span>
                  ))}
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                <span>Verification State:</span>
                <span className="text-[#00C2C7] font-medium">{selectedProject.status}</span>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setSelectedProject(null)}
                className="px-5 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                Close Specification
              </button>
            </div>

          </div>
        </div>
      )}
    </section>
  );
};
