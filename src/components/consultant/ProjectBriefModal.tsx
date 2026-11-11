import React from 'react';
import { ProjectBrief } from '../../services/supabaseService';
import { 
  X, FileText, CheckCircle2, Shield, Calendar, 
  Building, User, Cpu, Download, Copy, Printer 
} from 'lucide-react';

interface ProjectBriefModalProps {
  brief: ProjectBrief | null;
  isOpen: boolean;
  onClose: () => void;
  onScheduleConsultation: () => void;
}

export const ProjectBriefModal: React.FC<ProjectBriefModalProps> = ({
  brief,
  isOpen,
  onClose,
  onScheduleConsultation,
}) => {
  if (!isOpen || !brief) return null;

  const handleCopy = () => {
    const text = `OPHIREUM ENTERPRISE PROJECT BRIEF\nReference: ${brief.referenceCode}\nClient: ${brief.client.fullName} (${brief.client.companyName})\nCategory: ${brief.requirements.category}\nObjectives: ${brief.requirements.businessProblem}\nFeatures: ${brief.requirements.keyFeatures.join(', ')}\nArchitecture: ${brief.technicalArchitecture.suggestedStack.join(', ')}`;
    navigator.clipboard.writeText(text);
    alert('Project brief summary copied to clipboard.');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-md">
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-[#0B1220] border border-slate-700 rounded-2xl flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Top Bar */}
        <div className="px-5 py-4 bg-[#111827] border-b border-slate-800 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#00C2C7]/15 border border-[#00C2C7]/30 flex items-center justify-center text-[#00C2C7]">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm sm:text-base font-bold text-white">
                  Enterprise Project Brief
                </h3>
                <span className="text-[10px] font-mono text-[#00C2C7] bg-[#00C2C7]/10 px-2 py-0.5 rounded border border-[#00C2C7]/30">
                  {brief.referenceCode}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Synthesized by OPHIREUM AI Solutions Consultant · Ready for Architectural Review
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="Copy Summary"
            >
              <Copy className="w-4 h-4" />
            </button>
            <button
              onClick={handlePrint}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="Print Brief"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Brief Document Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-8 space-y-6 text-xs text-slate-300">
          
          {/* Section 1: Client Profile */}
          <div className="p-4 rounded-xl bg-[#111827] border border-slate-800 space-y-3">
            <h4 className="text-[11px] font-mono uppercase text-[#00C2C7] flex items-center gap-2 font-bold tracking-wider">
              <User className="w-3.5 h-3.5" />
              <span>1. Client & Organization Profile</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pt-1">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-mono">Client Name</span>
                <span className="font-semibold text-white text-sm">{brief.client.fullName || 'Not provided'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-mono">Company / Organization</span>
                <span className="font-semibold text-white text-sm">{brief.client.companyName || 'Not provided'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-mono">Contact Email</span>
                <span className="font-mono text-slate-300 truncate block">{brief.client.email || 'Not provided'}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-mono">Phone Number</span>
                <span className="font-mono text-slate-300 block">{brief.client.phone || '+63 (Pending)'}</span>
              </div>
            </div>
          </div>

          {/* Section 2: Project Overview */}
          <div className="p-4 rounded-xl bg-[#111827] border border-slate-800 space-y-3">
            <h4 className="text-[11px] font-mono uppercase text-[#00C2C7] flex items-center gap-2 font-bold tracking-wider">
              <Building className="w-3.5 h-3.5" />
              <span>2. Project Scope & Business Objectives</span>
            </h4>
            <div className="space-y-2">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-mono">Primary Category</span>
                <span className="font-bold text-white text-sm">{brief.requirements.category}</span>
              </div>
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-mono">Identified Business Problem / Goal</span>
                <p className="text-slate-300 leading-relaxed text-xs pt-0.5">{brief.requirements.businessProblem}</p>
              </div>
              {brief.requirements.keyFeatures.length > 0 && (
                <div>
                  <span className="text-slate-500 block text-[10px] uppercase font-mono mb-1">Required Features & Capabilities</span>
                  <div className="flex flex-wrap gap-1.5">
                    {brief.requirements.keyFeatures.map((f, i) => (
                      <span key={i} className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-slate-200 font-mono text-[11px]">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Technical Requirements & Proposed Architecture */}
          <div className="p-4 rounded-xl bg-[#111827] border border-slate-800 space-y-3">
            <h4 className="text-[11px] font-mono uppercase text-[#00C2C7] flex items-center gap-2 font-bold tracking-wider">
              <Cpu className="w-3.5 h-3.5" />
              <span>3. Technical Requirements & Suggested Architecture</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <span className="text-slate-500 block text-[10px] uppercase font-mono">Recommended Modules</span>
                <ul className="space-y-1">
                  {brief.technicalArchitecture.recommendedModules.map((m, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-slate-300">
                      <span className="text-[#00C2C7] font-bold">·</span>
                      <span>{m}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="space-y-1.5">
                <span className="text-slate-500 block text-[10px] uppercase font-mono">Security & Infrastructure</span>
                <p className="text-slate-400 text-[11px] leading-relaxed mb-2">
                  {brief.technicalArchitecture.infrastructure}
                </p>
                <ul className="space-y-1">
                  {brief.technicalArchitecture.securityMeasures.map((s, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-slate-300">
                      <Shield className="w-3 h-3 text-[#D4AF37] shrink-0 mt-0.5" />
                      <span>{s}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Section 4: Commercial Discovery & Staged Roadmap */}
          <div className="p-4 rounded-xl bg-[#111827] border border-slate-800 space-y-3">
            <h4 className="text-[11px] font-mono uppercase text-[#00C2C7] flex items-center gap-2 font-bold tracking-wider">
              <Calendar className="w-3.5 h-3.5" />
              <span>4. Commercial Discovery & Consultation Agenda</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-mono mb-1">Suggested Development Phases</span>
                <ol className="space-y-1.5">
                  {brief.commercialDiscovery.suggestedPhases.map((phase, i) => (
                    <li key={i} className="flex items-start gap-2 text-slate-300">
                      <span className="w-4 h-4 rounded-full bg-slate-900 border border-slate-700 text-[10px] flex items-center justify-center font-mono text-[#00C2C7] shrink-0">
                        {i + 1}
                      </span>
                      <span>{phase}</span>
                    </li>
                  ))}
                </ol>
              </div>

              <div>
                <span className="text-slate-500 block text-[10px] uppercase font-mono mb-1">Consultation Agenda</span>
                <ul className="space-y-1.5">
                  {brief.commercialDiscovery.consultationAgenda.map((agenda, i) => (
                    <li key={i} className="flex items-start gap-2 text-slate-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{agenda}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
            <Shield className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
            <p>
              This document represents an initial consultative assessment. Formal quotation and service level agreements (SLAs) are issued following architectural verification with the client.
            </p>
          </div>

        </div>

        {/* Modal Bottom Actions */}
        <div className="px-5 py-4 bg-[#111827] border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            Close Brief
          </button>

          <button
            onClick={() => {
              onClose();
              onScheduleConsultation();
            }}
            className="px-5 py-2 text-xs font-semibold text-[#0B1220] bg-[#00C2C7] hover:bg-[#00d6dc] rounded-lg shadow-md shadow-[#00C2C7]/20 flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Schedule Executive Consultation</span>
          </button>
        </div>

      </div>
    </div>
  );
};
