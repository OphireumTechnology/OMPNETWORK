import React from 'react';
import { CatalogService } from '../../types';
import { formatCatalogPrice, CATALOG_CATEGORIES } from '../../data/serviceCatalog';
import { ServiceTechIcon } from '../animations/ServiceTechIcon';
import { Check, ChevronRight, Plus, ArrowUpRight } from 'lucide-react';

interface ServiceCardProps {
  service: CatalogService;
  currency: 'USD' | 'PHP';
  phpRate: number;
  isSelected: boolean;
  onToggleSelect: (service: CatalogService) => void;
  onExplore: (service: CatalogService) => void;
  onRequestProposal: (service: CatalogService) => void;
  onConsultAI?: (service: CatalogService) => void;
}

export const ServiceCard: React.FC<ServiceCardProps> = ({
  service,
  currency,
  phpRate,
  isSelected,
  onToggleSelect,
  onExplore,
  onRequestProposal,
  onConsultAI,
}) => {
  const isSignature = service.featuredTier === 'signature';
  const isFlagship = service.featuredTier === 'flagship';
  const isStandardized = service.engagementMode === 'standardized';
  const priceInfo = formatCatalogPrice(service, currency, phpRate);
  const categoryMeta = CATALOG_CATEGORIES.find((c) => c.id === service.categoryId);

  return (
    <article
      className={`group rounded-2xl p-6 flex flex-col justify-between transition-all duration-200 border ${
        isSelected
          ? 'bg-[#131d31] border-[#00C2C7] ring-1 ring-[#00C2C7]/40'
          : isSignature
          ? 'bg-gradient-to-b from-[#151e30] to-[#111827] border-[#D4AF37]/45 hover:border-[#D4AF37]'
          : 'bg-[#111827] border-slate-800 hover:border-[#00C2C7]/50'
      }`}
    >
      <div>
        {/* Top Row: Animated Tech Icon & Clean Unboxed Metadata */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <ServiceTechIcon
              kind={service.iconKind}
              size="md"
              ambient={isSignature}
              accent={isSignature ? 'gold' : 'cyan'}
            />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] font-mono text-slate-400">
                <span className={isSignature ? 'text-[#D4AF37] font-semibold' : 'text-[#00C2C7]'}>
                  {categoryMeta?.shortLabel || service.categoryId}
                </span>
                <span aria-hidden="true">·</span>
                <span className={isStandardized ? 'text-emerald-400' : 'text-slate-400'}>
                  {isStandardized ? 'Standardized' : 'Custom-Scoped'}
                </span>
                {isFlagship && !isSignature && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-[#D4AF37]">Flagship</span>
                  </>
                )}
              </div>
              <h3 className="text-base sm:text-[17px] font-bold text-white leading-snug group-hover:text-[#00C2C7] transition-colors mt-0.5">
                {service.title}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onToggleSelect(service)}
            aria-pressed={isSelected}
            aria-label={isSelected ? `Remove ${service.title} from solution builder` : `Add ${service.title} to solution builder`}
            className={`shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C2C7] ${
              isSelected
                ? 'bg-[#00C2C7] text-[#0B1220]'
                : 'bg-slate-900 text-slate-300 hover:text-white border border-slate-700 hover:border-[#00C2C7]/60'
            }`}
          >
            {isSelected ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            <span>{isSelected ? 'Selected' : 'Add'}</span>
          </button>
        </div>

        {/* Outcome-Focused Description */}
        <p className="mt-4 text-xs sm:text-[13px] text-slate-300 leading-relaxed">
          {service.shortDescription}
        </p>

        {/* Pricing Block */}
        <div className="mt-4 pt-3.5 border-t border-slate-800/80">
          <div className="text-sm font-bold text-white font-mono tabular-nums">
            <span className={isSignature ? 'text-[#D4AF37]' : 'text-[#00C2C7]'}>
              {priceInfo.primaryLabel}
            </span>
          </div>
          {priceInfo.secondaryLabel && (
            <div className="text-xs text-slate-300 font-mono tabular-nums mt-0.5">
              {priceInfo.secondaryLabel}
            </div>
          )}
          {priceInfo.phpEstimateLabel && (
            <div className="text-[11px] text-slate-400 font-mono tabular-nums mt-1">
              {priceInfo.phpEstimateLabel} (estimate)
            </div>
          )}
        </div>

        {/* Key Capabilities */}
        <ul className="mt-4 pt-3.5 border-t border-slate-800/80 space-y-1.5">
          {service.capabilities.slice(0, 4).map((cap, idx) => (
            <li key={idx} className="flex items-start gap-2 text-xs text-slate-300">
              <span
                className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${
                  isSignature ? 'bg-[#D4AF37]' : 'bg-[#00C2C7]'
                }`}
                aria-hidden="true"
              />
              <span className="leading-snug">{cap}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Actions */}
      <div className="mt-6 pt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onExplore(service)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-slate-200 hover:text-[#00C2C7] transition-colors cursor-pointer py-1.5 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C2C7] rounded"
        >
          <span>Explore Solution</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>

        <div className="flex items-center gap-2">
          {onConsultAI && service.interactiveDemoType === 'ai_consultant' && (
            <button
              type="button"
              onClick={() => onConsultAI(service)}
              className="px-2.5 py-1.5 text-[11px] font-semibold text-[#00C2C7] hover:text-white bg-slate-900 hover:bg-slate-800 border border-[#00C2C7]/40 rounded-lg transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C2C7]"
            >
              Live AI Demo
            </button>
          )}
          <button
            type="button"
            onClick={() => (isStandardized ? onExplore(service) : onRequestProposal(service))}
            className={`inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C2C7] ${
              isSignature
                ? 'bg-[#D4AF37] hover:bg-[#e3be48] text-[#0B1220]'
                : 'bg-[#00C2C7] hover:bg-[#00d6dc] text-[#0B1220]'
            }`}
          >
            <span>{isStandardized ? 'Configure Package' : 'Request Proposal'}</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </article>
  );
};
