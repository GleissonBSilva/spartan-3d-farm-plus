"use client";

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { PublicNavbar } from '@/components/layout/PublicNavbar';
import { useSaaSData } from '@/context/SaaSDataContext';

import { HeroSection } from '@/components/landing/HeroSection';
import { FeaturesSection } from '@/components/landing/FeaturesSection';
import { ProfitSimulatorSection } from '@/components/landing/ProfitSimulatorSection';
import { PricingSection } from '@/components/landing/PricingSection';
import { TestimonialsSection } from '@/components/landing/TestimonialsSection';
import { FaqSection } from '@/components/landing/FaqSection';
import { LandingFooter } from '@/components/landing/LandingFooter';

const Index: React.FC = () => {
  const { plans } = useSaaSData();
  const navigate = useNavigate();

  const handleDemoAccess = (_role: 'admin' | 'client') => {
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-600 selection:text-white">
      <PublicNavbar />
      
      <main className="flex-1">
        <HeroSection onDemoAccess={handleDemoAccess} />
        <FeaturesSection />
        <ProfitSimulatorSection />
        <PricingSection plans={plans} />
        <TestimonialsSection />
        <FaqSection />
      </main>

      <LandingFooter />
    </div>
  );
};

export default Index;
