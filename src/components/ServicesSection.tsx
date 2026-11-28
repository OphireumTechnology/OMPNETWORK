import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import {
  CATALOG_CATEGORIES,
  SERVICE_CATALOG,
  DEFAULT_USD_TO_PHP_RATE,
  COMMERCIAL_PRICING_NOTICE,
  EXTERNAL_CHARGES_DISCLOSURE,
  BLOCKCHAIN_COMPLIANCE_NOTICE,
  EMERGING_TECH_FEASIBILITY_NOTICE,
  computeConfiguredServiceTotal,
} from '../data/serviceCatalog';
import { CatalogCategoryId, CatalogService } from '../types';
import { ServiceTechIcon } from './animations/ServiceTechIcon';
import { BlockchainNetworkCanvas } from './animations/BlockchainNetworkCanvas';
import { ServiceCard } from './services/ServiceCard';
import { ServiceDetailModal } from './services/ServiceDetailModal';
import { SolutionBuilderModal } from './services/SolutionBuilderModal';
import {
  Search,
  X,
  ArrowUpRight,
  Bot,
  Layers,
  Shield,
  Check,
  Sparkles,
  SlidersHorizontal,
} from 'lucide-react';

interface ServicesSectionProps {
  onSelectServiceForInquiry: (serviceId: string) => void;
  onOpenAIConsultant: (initialPrompt?: string) => void;
}

export const ServicesSection: React.FC<ServicesSectionProps> = ({
  onSelectServiceForInquiry,
  onOpenAIConsultant,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const catalogRef = useRef<HTMLDivElement>(null);

  const [activeCategory, setActiveCategory] = useState<CatalogCategoryId>('website-digital');
  const [searchQuery, setSearchQuery] = useState('');
  const [currency, setCurrency] = useState<'USD' | 'PHP'>('USD');
  const [phpRate, setPhpRate] = useState<number>(DEFAULT_USD_TO_PHP_RATE);
  const [showRateEditor, setShowRateEditor] = useState(false);

  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('opm_pending_selection_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed?.selectedIds)) return parsed.selectedIds;
      }
    } catch {
      // ignore storage errors
    }
    return [];
  });
  const [selectedOptionsMap, setSelectedOptionsMap] = useState<Record<string, string[]>>(() => {
    try {
      const saved = localStorage.getItem('opm_pending_selection_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.selectedOptionsMap && typeof parsed.selectedOptionsMap === 'object') {
          return parsed.selectedOptionsMap;
        }
      }
    } catch {
      // ignore storage errors
    }
    return {};
  });
  const [detailService, setDetailService] = useState<CatalogService | null>(null);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);

  React.useEffect(() => {
    try {
      localStorage.setItem(
        'opm_pending_selection_v1',
        JSON.stringify({ selectedIds, selectedOptionsMap })
      );
    } catch {
      // ignore storage errors
    }
  }, [selectedIds, selectedOptionsMap]);

  const activeCategoryMeta = useMemo(
    () => CATALOG_CATEGORIES.find((c) => c.id === activeCategory) || CATALOG_CATEGORIES[0],
    [activeCategory]
  );

  const filteredServices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return SERVICE_CATALOG.filter((svc) => {
      const matchesCategory = q ? (activeCategory === 'all' ? true : svc.categoryId === activeCategory) : activeCategory === 'all' || svc.categoryId === activeCategory;
      if (!matchesCategory) return false;
      if (!q) return true;
      return (
        svc.title.toLowerCase().includes(q) ||
        svc.shortDescription.toLowerCase().includes(q) ||
        svc.capabilities.some((cap) => cap.toLowerCase().includes(q))
      );
    });
  }, [activeCategory, searchQuery]);

  const selectedServices = useMemo(
    () => SERVICE_CATALOG.filter((s) => selectedIds.includes(s.id)),
    [selectedIds]
  );

  const toggleSelectService = (service: CatalogService) => {
    setSelectedIds((prev) =>
      prev.includes(service.id) ? prev.filter((id) => id !== service.id) : [...prev, service.id]
    );
  };

  const toggleServiceOption = (serviceId: string, optionId: string) => {
    setSelectedOptionsMap((prev) => {
      const existing = prev[serviceId] || [];
      const next = existing.includes(optionId)
        ? existing.filter((id) => id !== optionId)
        : [...existing, optionId];
      return { ...prev, [serviceId]: next };
    });
    setSelectedIds((prev) => (prev.includes(serviceId) ? prev : [...prev, serviceId]));
  };

  const handleRequestProposal = (service: CatalogService) => {
    if (!selectedIds.includes(service.id)) {
      setSelectedIds((prev) => [...prev, service.id]);
    }
    onSelectServiceForInquiry(service.legacyServiceId || 'enterprise-software-development');
    setIsBuilderOpen(true);
  };

  const handleConsultAIForService = (service: CatalogService) => {
    onOpenAIConsultant(
      `I would like to explore "${service.title}" (starting at $${service.pricing.startingUsd.toLocaleString('en-US')}) and understand how it fits our business requirements.`
    );
  };

  const handleConsultAIWithSelection = (services: CatalogService[]) => {
    const names = services.map((s) => s.title).join(', ');
    onOpenAIConsultant(
      `I selected the following solutions in Build Your Solution: ${names}. Can you help me scope the right architecture and next steps?`
    );
  };

  const scrollToCatalog = (category?: CatalogCategoryId) => {
    if (category) setActiveCategory(category);
    catalogRef.current?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
  };

  const oneTimeModernization = filteredServices.filter(
    (s) => s.categoryId === 'modernization-care' && s.subcategory === 'one-time'
  );
  const careMemberships = filteredServices.filter(
    (s) => s.categoryId === 'modernization-care' && s.subcategory === 'care-membership'
  );
  const otherServices = filteredServices.filter((s) => s.categoryId !== 'modernization-care');

  const selectedOneTimeTotal = selectedServices.reduce(
    (sum, s) => sum + computeConfiguredServiceTotal(s, selectedOptionsMap[s.id] || []).oneTimeUsd,
    0
  );

  const selectedMonthlyTotal = selectedServices.reduce(
    (sum, s) => sum + computeConfiguredServiceTotal(s, selectedOptionsMap[s.id] || []).monthlyUsd,
    0
  );

  return (
    <section
      id="services"
      aria-labelledby="services-marketplace-heading"
      className="py-20 lg:py-28 bg-[#0B1220] border-t border-slate-800/80 relative"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* =================================================================
            BLOCK 1: UNIFIED SERVICES HEADER & PRIMARY ACTIONS
            ================================================================= */}
        <div className="max-w-4xl">
          <div className="text-xs font-mono font-semibold text-[#00C2C7] uppercase tracking-wider mb-3">
            OUR SERVICES &amp; ADVANCED TECHNOLOGY SOLUTIONS
          </div>

          <h2
            id="services-marketplace-heading"
            className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-white leading-[1.12] text-balance"
          >
            Engineering the Future of Digital Innovation.
          </h2>

          <p className="mt-4 text-base sm:text-lg text-slate-200 leading-relaxed text-balance">
            From intelligent AI ecosystems and blockchain infrastructure to enterprise software, premium digital experiences, and next-generation automation, OPHIREUM delivers sophisticated technology solutions engineered to accelerate business transformation.
          </p>

          <p className="mt-3 text-sm text-slate-400 leading-relaxed max-w-3xl">
            We combine creative excellence, intelligent engineering, and strategic innovation to help ambitious businesses build, automate, secure, and scale their digital operations.
          </p>

          {/* Primary Actions */}
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => scrollToCatalog('all')}
              className="inline-flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-semibold text-[#0B1220] bg-[#00C2C7] hover:bg-[#00d6dc] rounded-lg transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C2C7]"
            >
              <span>Explore Our Solutions</span>
              <ArrowUpRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => setIsBuilderOpen(true)}
              className="inline-flex items-center gap-2 px-4 sm:px-5 py-3 text-xs sm:text-sm font-semibold text-white bg-[#111827] hover:bg-slate-800 border border-slate-700 hover:border-[#D4AF37]/60 rounded-lg transition-colors cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C2C7]"
            >
              <Layers className="w-4 h-4 text-[#D4AF37] shrink-0" />
              <span>Request a Personalized Proposal</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenAIConsultant()}
              className="inline-flex items-center gap-2 px-4 sm:px-5 py-3 text-xs sm:text-sm font-semibold text-[#00C2C7] hover:text-white bg-transparent hover:bg-[#00C2C7]/10 border border-[#00C2C7]/45 rounded-lg transition-colors cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C2C7]"
            >
              <Bot className="w-4 h-4 shrink-0" />
              <span>Speak With Our AI Solutions Consultant</span>
            </button>
          </div>
        </div>

        {/* =================================================================
            INTERACTIVE DISCOVERY BAR: SEARCH, CURRENCY & 10 CATEGORIES
            ================================================================= */}
        <div ref={catalogRef} className="mt-14 space-y-5 scroll-mt-28">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-2xl bg-[#111827] border border-slate-800">
            {/* Search Input */}
            <div className="relative flex-1 max-w-xl">
              <label htmlFor="service-catalog-search" className="sr-only">
                Search Ophireum services and capabilities
              </label>
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="service-catalog-search"
                type="search"
                value={searchQuery}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchQuery(val);
                  if (val.trim() && activeCategory !== 'all') {
                    setActiveCategory('all');
                  }
                }}
                placeholder="Search solutions, AI agents, blockchain, industries, or prices..."
                className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-[#0B1220] border border-slate-700 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00C2C7]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Currency Switcher & Build Your Solution Trigger */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0B1220] border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setCurrency('USD')}
                  aria-pressed={currency === 'USD'}
                  className={`px-3 py-1.5 rounded-lg font-mono font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    currency === 'USD'
                      ? 'bg-[#00C2C7] text-[#0B1220]'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  USD
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency('PHP')}
                  aria-pressed={currency === 'PHP'}
                  className={`px-3 py-1.5 rounded-lg font-mono font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    currency === 'PHP'
                      ? 'bg-[#00C2C7] text-[#0B1220]'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  USD + PHP Est.
                </button>
              </div>

              {currency === 'PHP' && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowRateEditor((v) => !v)}
                    className="px-2.5 py-2 rounded-lg bg-[#0B1220] border border-slate-700 text-[11px] font-mono text-slate-300 hover:text-white flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                    title="Configure estimated USD to PHP exchange rate"
                  >
                    <SlidersHorizontal className="w-3 h-3 text-[#00C2C7]" />
                    <span>1 USD ≈ ₱{phpRate}</span>
                  </button>
                  {showRateEditor && (
                    <div className="absolute right-0 mt-2 p-3 rounded-xl bg-[#111827] border border-slate-700 shadow-xl z-20 w-56 space-y-2">
                      <label htmlFor="php-rate-input" className="block text-[11px] font-mono text-slate-300">
                        Configurable PHP Estimate Rate
                      </label>
                      <input
                        id="php-rate-input"
                        type="number"
                        min={40}
                        max={80}
                        step={0.5}
                        value={phpRate}
                        onChange={(e) => {
                          const num = parseFloat(e.target.value);
                          if (!Number.isNaN(num) && num > 0) setPhpRate(num);
                        }}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-[#0B1220] border border-slate-700 text-xs font-mono text-white"
                      />
                      <p className="text-[10px] text-slate-400">
                        PHP figures are displayed strictly as estimates alongside USD pricing.
                      </p>
                    </div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => setIsBuilderOpen(true)}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-[#D4AF37]/45 text-xs font-semibold text-white flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Layers className="w-3.5 h-3.5 text-[#D4AF37]" />
                <span>Build Your Solution ({selectedIds.length})</span>
              </button>
            </div>
          </div>

          {/* 10-Category Navigation Bar + All Solutions */}
          <nav
            aria-label="Service categories"
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2"
          >
            {CATALOG_CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  aria-pressed={isActive}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00C2C7] ${
                    isActive
                      ? 'bg-[#131d31] border-[#00C2C7] text-white'
                      : 'bg-[#111827] border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white'
                  }`}
                >
                  <ServiceTechIcon
                    kind={cat.iconKind}
                    size="sm"
                    ambient={isActive}
                    accent={cat.id === 'signature-packages' ? 'gold' : 'cyan'}
                  />
                  <div className="min-w-0">
                    <div className="text-[10px] font-mono text-slate-400">
                      {cat.id === 'all' ? 'CATALOG' : cat.number}
                    </div>
                    <div className="text-xs font-semibold truncate">{cat.shortLabel}</div>
                  </div>
                </button>
              );
            })}
          </nav>
        </div>

        {/* =================================================================
            ACTIVE CATEGORY SHOWCASE BANNER & DIVISION SPECIALS
            ================================================================= */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeCategory}
            initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -6 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="mt-10 space-y-8"
          >
            {/* Active Category Banner */}
            <div
              className={`rounded-2xl p-6 sm:p-8 border ${
                activeCategory === 'signature-packages'
                  ? 'bg-gradient-to-r from-[#151e30] via-[#111827] to-[#151e30] border-[#D4AF37]/45'
                  : 'bg-[#111827] border-slate-800'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-start gap-4 max-w-3xl">
                  <ServiceTechIcon
                    kind={activeCategoryMeta.iconKind}
                    size="lg"
                    ambient={true}
                    accent={activeCategory === 'signature-packages' ? 'gold' : 'cyan'}
                  />
                  <div>
                    <div className="text-xs font-mono text-[#00C2C7] uppercase tracking-wider">
                      {activeCategoryMeta.label}
                    </div>
                    <h3 className="text-xl sm:text-2xl font-bold text-white mt-1 text-balance">
                      {activeCategoryMeta.headline}
                    </h3>
                    <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
                      {activeCategoryMeta.description}
                    </p>
                  </div>
                </div>

                {/* Contextual Division Action */}
                {activeCategory === 'ai-agents' && (
                  <div className="shrink-0 flex flex-col items-start lg:items-end gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onOpenAIConsultant(
                          'Can you walk me through OPHIREUM AI agents and help recommend the right setup for our organization?'
                        )
                      }
                      className="px-4 py-2.5 rounded-lg bg-[#00C2C7] hover:bg-[#00d6dc] text-[#0B1220] text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <Bot className="w-4 h-4" />
                      <span>Launch Live AI Solutions Demo</span>
                    </button>
                    <span className="text-[11px] font-mono text-slate-400">
                      Connected to live OPHIREUM AI Solutions Consultant
                    </span>
                  </div>
                )}
              </div>

              {/* BLOCK 5: Blockchain & Web3 Featured Network Visual, Capabilities & Compliance */}
              {activeCategory === 'blockchain-web3' && (
                <div className="mt-6 pt-6 border-t border-slate-800 space-y-5">
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                    <div className="lg:col-span-6 rounded-xl bg-[#070c16] border border-slate-800 overflow-hidden">
                      <div className="px-4 py-2 border-b border-slate-800 flex items-center justify-between text-[11px] font-mono text-slate-400">
                        <span className="text-[#00C2C7]">Distributed Ledger Network Visualization</span>
                        <span>Interactive Topology</span>
                      </div>
                      <BlockchainNetworkCanvas className="w-full h-48" nodeCount={34} interactive={true} />
                    </div>

                    <div className="lg:col-span-6 space-y-3">
                      <div className="text-xs font-mono uppercase text-slate-400">
                        Advanced Blockchain Capabilities
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-200">
                        {[
                          'Smart contracts',
                          'Distributed ledger systems',
                          'Blockchain API integration',
                          'Web3 application development',
                          'Tokenization architecture',
                          'Blockchain-based document verification',
                          'Digital identity & credential verification',
                          'Supply-chain traceability',
                          'Permissioned enterprise blockchain networks',
                          'Tamper-evident audit trails',
                        ].map((item) => (
                          <div key={item} className="flex items-start gap-2">
                            <Check className="w-3.5 h-3.5 text-[#00C2C7] shrink-0 mt-0.5" />
                            <span>{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#0B1220] border border-[#D4AF37]/40 flex items-start gap-3 text-xs text-slate-300">
                    <Shield className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                    <p className="leading-relaxed">
                      <strong className="text-[#D4AF37]">Regulatory &amp; Security Disclosure: </strong>
                      {BLOCKCHAIN_COMPLIANCE_NOTICE}
                    </p>
                  </div>
                </div>
              )}

              {/* BLOCK 6: Emerging Technology Feasibility Disclosure */}
              {(activeCategory === 'enterprise-mobile' || activeCategory === 'automation-systems') && (
                <div className="mt-5 pt-4 border-t border-slate-800 text-xs text-slate-400 flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-[#00C2C7] shrink-0 mt-0.5" />
                  <p>{EMERGING_TECH_FEASIBILITY_NOTICE}</p>
                </div>
              )}
            </div>

            {/* ===============================================================
                SERVICE CARDS GRID (OR SEPARATED MODERNIZATION + CARE GRIDS)
                =============================================================== */}
            {filteredServices.length === 0 ? (
              <div className="p-12 rounded-2xl bg-[#111827] border border-slate-800 text-center space-y-3">
                <p className="text-sm font-semibold text-white">
                  No solutions matched "{searchQuery}".
                </p>
                <p className="text-xs text-slate-400">
                  Try clearing your search or ask our AI Solutions Consultant for a custom-scoped architecture recommendation.
                </p>
                <div className="pt-2 flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setActiveCategory('all');
                    }}
                    className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-white cursor-pointer"
                  >
                    Reset Filters
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenAIConsultant(`I am looking for a solution related to: ${searchQuery}`)}
                    className="px-4 py-2 rounded-lg bg-[#00C2C7] hover:bg-[#00d6dc] text-xs font-semibold text-[#0B1220] cursor-pointer"
                  >
                    Ask AI Consultant
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-12">
                {/* Non-Modernization Services Grid */}
                {otherServices.length > 0 && (
                  <div
                    className={`grid gap-6 ${
                      activeCategory === 'signature-packages'
                        ? 'grid-cols-1 md:grid-cols-2'
                        : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                    }`}
                  >
                    {otherServices.map((service) => (
                      <ServiceCard
                        key={service.id}
                        service={service}
                        currency={currency}
                        phpRate={phpRate}
                        isSelected={selectedIds.includes(service.id)}
                        onToggleSelect={toggleSelectService}
                        onExplore={setDetailService}
                        onRequestProposal={handleRequestProposal}
                        onConsultAI={handleConsultAIForService}
                      />
                    ))}
                  </div>
                )}

                {/* BLOCK 7: Separate One-Time Modernization Services vs Digital Care Memberships */}
                {oneTimeModernization.length > 0 && (
                  <div className="space-y-5">
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-3 border-b border-slate-800">
                      <div>
                        <div className="text-xs font-mono text-[#00C2C7] uppercase">
                          One-Time Modernization &amp; Repair Services
                        </div>
                        <h4 className="text-lg font-bold text-white mt-0.5">
                          Targeted Upgrades, Restorations &amp; Security Remediation ({oneTimeModernization.length})
                        </h4>
                      </div>
                      <span className="text-xs text-slate-400 font-mono">
                        Scoped per assignment
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {oneTimeModernization.map((service) => (
                        <ServiceCard
                          key={service.id}
                          service={service}
                          currency={currency}
                          phpRate={phpRate}
                          isSelected={selectedIds.includes(service.id)}
                          onToggleSelect={toggleSelectService}
                          onExplore={setDetailService}
                          onRequestProposal={handleRequestProposal}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {careMemberships.length > 0 && (
                  <div className="space-y-5 pt-4">
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-3 border-b border-slate-800">
                      <div>
                        <div className="text-xs font-mono text-[#D4AF37] uppercase">
                          Digital Care Memberships
                        </div>
                        <h4 className="text-lg font-bold text-white mt-0.5">
                          Ongoing Monthly Maintenance, Monitoring &amp; Technical Stewardship
                        </h4>
                      </div>
                      <span className="text-xs text-slate-400 font-mono">
                        Recurring monthly plans
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {careMemberships.map((service) => (
                        <ServiceCard
                          key={service.id}
                          service={service}
                          currency={currency}
                          phpRate={phpRate}
                          isSelected={selectedIds.includes(service.id)}
                          onToggleSelect={toggleSelectService}
                          onExplore={setDetailService}
                          onRequestProposal={handleRequestProposal}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* =================================================================
            BLOCK 13: PRICING & COMMERCIAL POLICY DISCLOSURE
            ================================================================= */}
        <div className="mt-14 p-6 rounded-2xl bg-[#111827] border border-slate-800 space-y-2.5 text-xs text-slate-300 leading-relaxed">
          <div className="text-[11px] font-mono uppercase tracking-wider text-[#00C2C7] font-semibold">
            Commercial Pricing &amp; Engagement Notice
          </div>
          <p>{COMMERCIAL_PRICING_NOTICE}</p>
          <p className="text-slate-400">{EXTERNAL_CHARGES_DISCLOSURE}</p>
        </div>

        {/* =================================================================
            FINAL DESIGN DIRECTION: CLOSING CALL TO ACTION
            ================================================================= */}
        <div className="mt-12 rounded-2xl bg-gradient-to-br from-[#151e30] via-[#111827] to-[#0B1220] border border-slate-700/80 p-8 sm:p-10 text-center space-y-5">
          <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight text-balance">
            Your Vision Deserves Extraordinary Technology.
          </h3>
          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
            Discover a smarter approach to digital transformation through solutions thoughtfully engineered for your business.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => scrollToCatalog('signature-packages')}
              className="px-5 py-2.5 rounded-lg bg-[#00C2C7] hover:bg-[#00d6dc] text-[#0B1220] text-xs sm:text-sm font-semibold transition-colors cursor-pointer whitespace-nowrap"
            >
              Explore Our Solutions
            </button>
            <button
              type="button"
              onClick={() => setIsBuilderOpen(true)}
              className="px-4 sm:px-5 py-2.5 rounded-lg bg-[#D4AF37] hover:bg-[#e3be48] text-[#0B1220] text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
            >
              Request a Personalized Proposal
            </button>
            <button
              type="button"
              onClick={() => onOpenAIConsultant()}
              className="px-4 sm:px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-[#00C2C7]/45 text-[#00C2C7] hover:text-white text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
            >
              Speak With Our AI Solutions Consultant
            </button>
          </div>

          <div className="pt-4 border-t border-slate-800/80 text-xs text-slate-400">
            <span className="font-bold text-white tracking-wide">OPHIREUM MULTIMEDIA PRODUCTION</span>
            <span className="mx-2 text-slate-600" aria-hidden="true">·</span>
            <em className="text-[#D4AF37] not-italic">Where Creative Excellence Meets Intelligent Technology.</em>
          </div>
        </div>
      </div>

      {/* =================================================================
          STICKY MULTI-SERVICE SOLUTION BUILDER BAR (Avoids AI launcher overlap on mobile)
          ================================================================= */}
      {selectedServices.length > 0 && (
        <div className="fixed bottom-4 left-3 right-20 sm:left-1/2 sm:-translate-x-1/2 sm:right-auto sm:w-full sm:max-w-xl z-30 bg-[#111827]/95 backdrop-blur-md border border-[#00C2C7]/60 rounded-2xl px-3.5 sm:px-4 py-2.5 sm:py-3 shadow-2xl flex items-center justify-between gap-2.5 sm:gap-3">
          <div className="min-w-0">
            <div className="text-xs font-bold text-white truncate">
              {selectedServices.length} {selectedServices.length === 1 ? 'Solution' : 'Solutions'} Selected
            </div>
            <div className="text-[11px] font-mono text-[#00C2C7] tabular-nums truncate">
              {selectedOneTimeTotal > 0 ? `Est. $${selectedOneTimeTotal.toLocaleString('en-US')}` : 'Est. Custom'}
              {selectedMonthlyTotal > 0 ? ` + $${selectedMonthlyTotal.toLocaleString('en-US')}/mo` : ''}
              {currency === 'PHP' && selectedOneTimeTotal > 0
                ? ` (≈ ₱${Math.round(selectedOneTimeTotal * phpRate).toLocaleString('en-US')})`
                : ''}
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setSelectedIds([]);
                setSelectedOptionsMap({});
              }}
              className="px-2 py-1.5 text-xs text-slate-400 hover:text-white cursor-pointer"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setIsBuilderOpen(true)}
              className="px-3 sm:px-4 py-2 rounded-lg bg-[#00C2C7] hover:bg-[#00d6dc] text-[#0B1220] text-xs font-semibold cursor-pointer whitespace-nowrap"
            >
              Review
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <ServiceDetailModal
        service={detailService}
        currency={currency}
        phpRate={phpRate}
        isSelected={detailService ? selectedIds.includes(detailService.id) : false}
        selectedOptionIds={detailService ? selectedOptionsMap[detailService.id] || [] : []}
        onClose={() => setDetailService(null)}
        onToggleSelect={toggleSelectService}
        onToggleOption={toggleServiceOption}
        onRequestProposal={handleRequestProposal}
        onConsultAI={handleConsultAIForService}
      />

      <SolutionBuilderModal
        isOpen={isBuilderOpen}
        selectedServices={selectedServices}
        selectedOptionsMap={selectedOptionsMap}
        currency={currency}
        phpRate={phpRate}
        onClose={() => setIsBuilderOpen(false)}
        onRemoveService={(id) => {
          setSelectedIds((prev) => prev.filter((item) => item !== id));
          setSelectedOptionsMap((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        }}
        onClearAll={() => {
          setSelectedIds([]);
          setSelectedOptionsMap({});
        }}
        onConsultAIWithSelection={handleConsultAIWithSelection}
      />
    </section>
  );
};
