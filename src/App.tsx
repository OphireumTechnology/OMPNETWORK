import React, { useState, useEffect } from 'react';
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

export default function App() {
  const [activeSection, setActiveSection] = useState('hero');
  const [isEnterpriseModalOpen, setIsEnterpriseModalOpen] = useState(false);
  const [enterpriseModalTab, setEnterpriseModalTab] = useState<'portal' | 'studio' | 'agents' | 'admin'>('portal');
  const [selectedServiceIdForInquiry, setSelectedServiceIdForInquiry] = useState<string>('multimedia-production');

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

        {/* 12 Dedicated Proposed Services */}
        <ServicesSection
          onSelectServiceForInquiry={handleSelectServiceForInquiry}
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
      <AIConsultantWidget />
    </div>
  );
}
