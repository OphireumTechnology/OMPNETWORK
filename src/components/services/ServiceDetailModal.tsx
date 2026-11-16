import React, { useEffect } from 'react';
import { CatalogService } from '../../types';
import {
  formatCatalogPrice,
  COMMERCIAL_PRICING_NOTICE,
  EXTERNAL_CHARGES_DISCLOSURE,
  CATALOG_CATEGORIES,
} from '../../data/serviceCatalog';
import { ServiceTechIcon } from '../animations/ServiceTechIcon';
import { BlockchainNetworkCanvas } from '../animations/BlockchainNetworkCanvas';
import { X, Check, AlertCircle, Shield, Bot, Plus, ArrowUpRight } from 'lucide-react';

interface ServiceDetailModalProps {
  service: CatalogService | null;
  currency: 'USD' | 'PHP';
  phpRate: number;
  isSelected: boolean;
  onClose: () => void;
  onToggleSelect: (service: CatalogService) => void;
  onRequestProposal: (service: CatalogService) => void;
  onConsultAI: (service: CatalogService) => void;
}

export const ServiceDetailModal: React.FC<ServiceDetailModalProps> = ({
  service,
  currency,
  phpRate,
  isSelected,
  onClose,
  onToggleSelect,
  onRequestProposal,
  onConsultAI,
}) => {
  useEffect(() => {
    if (!service) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [service, onClose]);

  if (!service) return null;

  const priceInfo = formatCatalogPrice(service, currency, phpRate);
  const categoryMeta = CATALOG_CATEGORIES.find((c) => c.id === service.categoryId);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="service-detail-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[92vh] bg-[#0B1220] border border-slate-700 rounded-2xl flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-[#111827] border-b border-slate-800 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <ServiceTechIcon
              kind={service.iconKind}
              size="lg"
              ambient={true}
              accent={service.featuredTier === 'signature' ? 'gold' : 'cyan'}
            />
            <div>
              <div className="text-xs font-mono text-[#00C2C7]">
                {categoryMeta?.label || service.categoryId}
              </div>
              <h3 id="service-detail-title" className="text-lg sm:text-xl font-bold text-white mt-0.5">
                {service.title}
              </h3>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C2C7]"
            aria-label="Close solution details"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-6 text-xs sm:text-sm text-slate-300">
          {/* Overview & Pricing Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
            <p className="text-slate-200 leading-relaxed max-w-xl">
              {service.fullDescription}
            </p>
            <div className="shrink-0 sm:text-right font-mono tabular-nums">
              <div className="text-base font-bold text-[#00C2C7]">{priceInfo.primaryLabel}</div>
              {priceInfo.secondaryLabel && (
                <div className="text-xs text-slate-200 mt-0.5">{priceInfo.secondaryLabel}</div>
              )}
              {priceInfo.phpEstimateLabel && (
                <div className="text-[11px] text-slate-400 mt-1">{priceInfo.phpEstimateLabel} (estimate)</div>
              )}
            </div>
          </div>

          {/* Interactive Blockchain Visualization if Blockchain service */}
          {service.interactiveDemoType === 'blockchain_canvas' && (
            <div className="rounded-xl border border-slate-800 bg-[#070c16] overflow-hidden">
              <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
                <span className="text-[#00C2C7]">Interactive Distributed Ledger Topology</span>
                <span>Visual Preview</span>
              </div>
              <BlockchainNetworkCanvas className="w-full h-36" nodeCount={26} interactive={true} />
            </div>
          )}

          {/* Key Capabilities */}
          <div>
            <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-3">
              Key Capabilities
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {service.capabilities.map((cap, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2.5 p-3 rounded-xl bg-[#111827] border border-slate-800 text-xs text-slate-200"
                >
                  <Check className="w-4 h-4 text-[#00C2C7] shrink-0 mt-0.5" />
                  <span>{cap}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Included vs Excluded Scope */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            <div>
              <h4 className="text-xs font-mono uppercase tracking-wider text-emerald-400 mb-2.5">
                Included in Starting Scope
              </h4>
              <ul className="space-y-2 text-xs text-slate-300">
                {service.includedScope.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2.5">
                Excluded / Billed Separately
              </h4>
              <ul className="space-y-2 text-xs text-slate-400">
                {service.excludedScope.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-slate-500 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Compliance Notice if applicable */}
          {service.complianceNote && (
            <div className="p-4 rounded-xl bg-[#111827] border border-[#D4AF37]/40 flex items-start gap-3 text-xs text-slate-300">
              <Shield className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold text-[#D4AF37] mb-1">Compliance & Feasibility Notice</div>
                <p className="leading-relaxed">{service.complianceNote}</p>
              </div>
            </div>
          )}

          {/* Commercial Pricing & External Charges Notice */}
          <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 space-y-2 text-[11px] text-slate-400 leading-relaxed">
            <p>{COMMERCIAL_PRICING_NOTICE}</p>
            <p>{EXTERNAL_CHARGES_DISCLOSURE}</p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 bg-[#111827] border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onToggleSelect(service)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C2C7] ${
                isSelected
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
            >
              {isSelected ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              <span>{isSelected ? 'Added to Solution Builder' : 'Add to Solution Builder'}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                onConsultAI(service);
              }}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-[#00C2C7] border border-[#00C2C7]/40 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C2C7]"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Ask AI Consultant</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              onClose();
              onRequestProposal(service);
            }}
            className="px-4 py-2 rounded-lg bg-[#00C2C7] hover:bg-[#00d6dc] text-[#0B1220] text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C2C7]"
          >
            <span>Request Personalized Proposal</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
