import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Header } from './components/Header';
import { Hero } from './components/Hero';
import { AboutSection } from './components/AboutSection';
import { ServicesSection } from './components/ServicesSection';
import { PortfolioSection } from './components/PortfolioSection';
import { EnterpriseSuiteSection } from './components/EnterpriseSuiteSection';
import { ContactSection } from './components/ContactSection';
import { EnterpriseModal } from './components/EnterpriseModal';
import { AIConsultantWidget } from './components/consultant/AIConsultantWidget';
import { Footer } from './components/Footer';
import { BrandLogo } from './components/BrandLogo';
import { isAdminRoute, isLegalRoute, isPortalRoute } from './portal/PortalRouter';

const ClientPortalApp = lazy(() => import('./portal/ClientPortalApp'));
const AdminConsoleApp = lazy(() => import('./admin/AdminConsoleApp'));
const LegalPagesApp = lazy(() => import('./legal/LegalPagesApp'));

export default function App() {
  const [routeMode, setRouteMode] = useState<'public' | 'portal' | 'admin' | 'legal'>(() =>
    isPortalRoute() ? 'portal' : isAdminRoute() ? 'admin' : isLegalRoute() ? 'legal' : 'public'
  );
  const [activeSection, setActiveSection] = useState('hero');
  const [isEnterpriseModalOpen, setIsEnterpriseModalOpen] = useState(false);
  const [enterpriseModalTab, setEnterpriseModalTab] = useState<'portal' | 'studio' | 'agents' | 'admin'>('portal');
  const [selectedServiceIdForInquiry, setSelectedServiceIdForInquiry] = useState<string>('multimedia-production');
  const [consultantOpenRequest, setConsultantOpenRequest] = useState<{
    nonce: number;
    initialPrompt?: string;
  } | null>(null);

  useEffect(() => {
    const syncAppRoute = () =>
      setRouteMode(
        isPortalRoute() ? 'portal' : isAdminRoute() ? 'admin' : isLegalRoute() ? 'legal' : 'public'
      );
    window.addEventListener('popstate', syncAppRoute);
    window.addEventListener('hashchange', syncAppRoute);
    window.addEventListener('opm:routechange', syncAppRoute);
    return () => {
      window.removeEventListener('popstate', syncAppRoute);
      window.removeEventListener('hashchange', syncAppRoute);
      window.removeEventListener('opm:routechange', syncAppRoute);
    };
  }, []);

  // Handle smooth navigation
  const handleNavigate = (sectionId: string) => {
    setActiveSection(sectionId);
    if (sectionId === 'hero') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      const el = document.getElementById(sectionId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  // Open enterprise modal to a specific tab
  const handleOpenEnterpriseModal = (tab: 'portal' | 'studio' | 'agents' | 'admin' = 'portal') => {
    setEnterpriseModalTab(tab);
    setIsEnterpriseModalOpen(true);
  };

  // When a user selects a service to inquire about
  const handleSelectServiceForInquiry = (serviceId: string) => {
    setSelectedServiceIdForInquiry(serviceId);
    handleNavigate('contact');
  };

  // Open AI Solutions Consultant widget with an optional pre-seeded context prompt
  const handleOpenAIConsultant = (initialPrompt?: string) => {
    setConsultantOpenRequest({
      nonce: Date.now(),
      initialPrompt,
    });
  };

  // Scroll listener to update activeSection
  useEffect(() => {
    const handleScroll = () => {
      const sections = ['hero', 'about', 'services', 'portfolio', 'architecture', 'contact'];
      const scrollY = window.scrollY;

      for (const section of sections) {
        const el = document.getElementById(section);
        if (el) {
          const top = el.offsetTop - 120;
          const height = el.offsetHeight;
          if (scrollY >= top && scrollY < top + height) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  if (routeMode === 'portal') {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen bg-[#FAF8F4] text-[#0F1D36] flex items-center justify-center p-6">
            <div className="text-center space-y-3 flex flex-col items-center">
              <BrandLogo variant="emblem" size="lg" ring="gold" eager />
              <div className="w-6 h-6 rounded-full border-2 border-[#0F4C3A] border-t-transparent animate-spin" />
              <p className="text-xs font-medium text-[#64748B]">Loading Ophireum Client Portal...</p>
            </div>
          </div>
        }
      >
        <ClientPortalApp />
      </Suspense>
    );
  }

  if (routeMode === 'admin') {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen bg-[#0B1220] text-slate-200 flex items-center justify-center p-6">
            <div className="text-center space-y-3 flex flex-col items-center">
              <BrandLogo variant="emblem" size="lg" ring="gold" eager />
              <div className="w-6 h-6 rounded-full border-2 border-[#00C2C7] border-t-transparent animate-spin" />
              <p className="text-xs font-mono text-slate-400">Loading Ophireum Admin Command Center...</p>
            </div>
          </div>
        }
      >
        <AdminConsoleApp />
      </Suspense>
    );
  }

  if (routeMode === 'legal') {
    return (
      <Suspense
        fallback={
          <div className="min-h-screen bg-[#0B1220] text-slate-200 flex items-center justify-center p-6">
            <div className="text-center space-y-3 flex flex-col items-center">
              <BrandLogo variant="emblem" size="lg" ring="gold" eager />
              <p className="text-xs font-mono text-slate-400">Loading Legal &amp; Compliance Center...</p>
            </div>
          </div>
        }
      >
        <LegalPagesApp />
      </Suspense>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1220] text-slate-100 flex flex-col selection:bg-[#00C2C7]/20 selection:text-[#00C2C7]">
      {/* Sticky Top Bar Contract */}
      <Header
        onOpenPortal={() => handleOpenEnterpriseModal('portal')}
        onNavigate={handleNavigate}
        activeSection={activeSection}
      />

      {/* Main Content Area */}
      <main className="flex-1">
        {/* Homepage Hero */}
        <Hero
          onNavigate={handleNavigate}
          onOpenPortal={() => handleOpenEnterpriseModal('portal')}
        />

        {/* Company Profile & Governance */}
        <AboutSection
          onOpenPortal={() => handleOpenEnterpriseModal('portal')}
        />

        {/* Unified Premium Services Marketplace & Advanced Technology Solutions */}
        <ServicesSection
          onSelectServiceForInquiry={handleSelectServiceForInquiry}
          onOpenAIConsultant={handleOpenAIConsultant}
        />

        {/* Portfolio & Architectural Blueprints */}
        <PortfolioSection />

        {/* The 8 Enterprise Pillars Ecosystem */}
        <EnterpriseSuiteSection
          onOpenPortalTab={handleOpenEnterpriseModal}
        />

        {/* Working Inquiry Brief Routing Form */}
        <ContactSection
          selectedServiceId={selectedServiceIdForInquiry}
        />
      </main>

      {/* Enterprise Suite Workspace Modal (Portal, Studio, Agents, Admin) */}
      <EnterpriseModal
        isOpen={isEnterpriseModalOpen}
        onClose={() => setIsEnterpriseModalOpen(false)}
        defaultTab={enterpriseModalTab}
      />

      {/* Corporate Footer */}
      <Footer
        onNavigate={handleNavigate}
        onOpenPortal={() => handleOpenEnterpriseModal('portal')}
      />

      {/* AI Solutions Consultant Floating Assistant & Booking System */}
      <AIConsultantWidget externalOpenRequest={consultantOpenRequest} />
    </div>
  );
}
