"use client";

import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useSaaSData } from '@/context/SaaSDataContext';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { Calculadora3D } from '@/components/client/Calculadora3D';
import { FinanceiroFarm } from '@/components/client/FinanceiroFarm';
import { CentroDeComandoFarm } from '@/components/client/CentroDeComandoFarm';
import { EstoqueFilamentos } from '@/components/client/EstoqueFilamentos';
import { ParqueImpressoras } from '@/components/client/ParqueImpressoras';
import { ProjetosManager } from '@/components/client/ProjetosManager';
import { SpartanAiAssistant } from '@/components/client/SpartanAiAssistant';
import { ClientInvoicesList } from '@/components/client/ClientInvoicesList';
import { ClientPlansPricing } from '@/components/client/ClientPlansPricing';
import { ClientSettingsForm } from '@/components/client/ClientSettingsForm';
import { ClientUpgradeModal } from '@/components/client/ClientUpgradeModal';

export const ClientPortal: React.FC = () => {
  const currentPath = useLocation().pathname;
  const { user, updateUserProfile } = useAuth();
  const { currentPlan, plans, changeClientPlan, invoices, openInvoiceCheckout } = useSaaSData();
  const [upgradeModal, setUpgradeModal] = useState(false);

  const handleUpgrade = (planId: string) => {
    changeClientPlan(planId);
    setUpgradeModal(false);
    toast.info('O plano será atualizado após a confirmação do pagamento.');
  };

  const isCalculadora = currentPath === '/cliente/calculadora';
  const isFinanceiro = currentPath === '/cliente/financeiro';
  const isEstoque = currentPath === '/cliente/estoque';
  const isImpressoras = currentPath === '/cliente/impressoras';
  const isProjetos = currentPath === '/cliente/projetos';
  const isAiCopilot = currentPath === '/cliente/ia-copilot';
  const isPlanos = currentPath === '/cliente/planos';
  const isFaturas = currentPath === '/cliente/faturas';
  const isConfig = currentPath === '/cliente/configuracoes';
  const isOverview = !isCalculadora && !isFinanceiro && !isEstoque && !isImpressoras && !isProjetos && !isAiCopilot && !isPlanos && !isFaturas && !isConfig;

  const title = isCalculadora ? 'Calculadora de Impressão 3D'
    : isFinanceiro ? 'Financeiro & Lucro da Farm'
    : isEstoque ? 'Estoque de Filamentos & Resinas'
    : isImpressoras ? 'Parque de Impressoras 3D'
    : isProjetos ? 'Projetos & Orçamentos Salvos'
    : isAiCopilot ? 'SPARTAN AI — Copilot & Diagnóstico 3D'
    : isPlanos ? 'Planos & Capacidade da Farm'
    : isFaturas ? 'Minhas Faturas & Assinatura'
    : isConfig ? 'Configurações da Farm'
    : `Meu Painel 3D${user?.name ? ` — ${user.name}` : ''}`;

  return (
    <DashboardLayout
      key={user?.id || 'guest'}
      title={title}
      subtitle={`Estúdio: ${user?.companyName || 'Minha farm'} · Plano: ${currentPlan.name}`}
      badgeText={currentPlan.badge || 'MAKER ATIVO'}
    >
      {isOverview && <CentroDeComandoFarm />}
      {isFinanceiro && <FinanceiroFarm />}
      {isCalculadora && <Calculadora3D />}
      {isEstoque && <EstoqueFilamentos />}
      {isImpressoras && <ParqueImpressoras />}
      {isProjetos && <ProjetosManager />}
      {isAiCopilot && <SpartanAiAssistant />}
      {isPlanos && <ClientPlansPricing plans={plans} currentPlan={currentPlan} onUpgrade={handleUpgrade} />}
      {isFaturas && <ClientInvoicesList invoices={invoices} currentPlan={currentPlan} onOpenPixModal={openInvoiceCheckout} />}
      {isConfig && <ClientSettingsForm user={user} onUpdateUserProfile={updateUserProfile} />}
      <ClientUpgradeModal
        isOpen={upgradeModal}
        onClose={() => setUpgradeModal(false)}
        plans={plans}
        currentPlan={currentPlan}
        onUpgrade={handleUpgrade}
      />
    </DashboardLayout>
  );
};

export default ClientPortal;
