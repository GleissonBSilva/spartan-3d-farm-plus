"use client";

import React, { createContext, useContext, useState, useMemo, useEffect, useCallback } from 'react';
import { Plan, Invoice, FilamentoEstoque, Impressora3D, ProjetoImpressao3D, ProjectMaterial, User, SaaSMetrics, MovimentacaoEstoque, EventoImpressora } from '@/types/saas';
import { INITIAL_PLANS } from '@/data/saasInitialData';
import { useFilamentosState } from './hooks/useFilamentosState';
import { useImpressorasState } from './hooks/useImpressorasState';
import { useProjetosState } from './hooks/useProjetosState';
import { useBillingState } from './hooks/useBillingState';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { canAccessAdmin } from '@/lib/permissions';

export { INITIAL_PLANS };

export interface SaaSDataContextType {
  plans: Plan[];
  clients: User[];
  invoices: Invoice[];
  filamentos: FilamentoEstoque[];
  movimentacoes: MovimentacaoEstoque[];
  impressoras: Impressora3D[];
  projetos: ProjetoImpressao3D[];
  currentPlan: Plan;
  metrics: SaaSMetrics;
  clientCredits: number;
  consumeCredits: (amount: number) => Promise<boolean>;
  addFilamento: (fil: Omit<FilamentoEstoque, 'id'>) => Promise<boolean>;
  updateFilamento: (id: string, fil: Omit<FilamentoEstoque, 'id' | 'companyId'>) => Promise<boolean>;
  consumirFilamento: (filamentoId: string, gramas: number) => void;
  consumirMultiplosFilamentos: (materials: ProjectMaterial[]) => void;
  estornarMultiplosFilamentos: (materials: ProjectMaterial[]) => void;
  addImpressora: (imp: Omit<Impressora3D, 'id'>) => boolean;
  updateImpressora: (id: string, imp: Partial<Impressora3D>) => Promise<boolean>;
  deleteImpressora: (id: string) => Promise<boolean>;
  updateImpressoraStatus: (id: string, status: Impressora3D['status'], meta?: { projetoId?: string; projetoNome?: string }) => void;
  updatePrinterProgress: (id: string, progress: number) => Promise<boolean>;
  recordMaintenance: (id: string, tasks: string[], note: string) => Promise<boolean>;
  historicoImpressoras: EventoImpressora[];
  addProjeto: (proj: Omit<ProjetoImpressao3D, 'id' | 'dataCriacao' | 'estoqueBaixado'>) => boolean;
  updateProjetoStatus: (id: string, newStatus: ProjetoImpressao3D['status'], overridePrinterId?: string) => Promise<boolean> | void;
  updateProjeto: (id: string, changes: Partial<ProjetoImpressao3D>) => Promise<boolean>;
  deleteProjeto: (id: string) => Promise<boolean>;
  refreshFarmData: () => Promise<void>;
  changeClientPlan: (planId: string) => void;
  updatePlan: (planId: string, changes: Partial<Pick<Plan, 'priceMonthly' | 'priceYearly' | 'maxProjects' | 'maxPrinters' | 'maxFilaments' | 'maxUsers' | 'creditsAI'>>) => void;
  addClient: (client: Partial<User>) => void;
  updateClientStatus: (id: string, status: User['status']) => void;
  updateClientValidity: (clientId: string, newDateIso: string, newStatus?: User['status']) => Promise<void>;
  updateMultipleClientsValidity: (clientIds: string[], newDateIso: string, newStatus?: User['status']) => Promise<void>;
  updateMultipleClientsStatus: (clientIds: string[], newStatus: User['status']) => Promise<void>;
  deleteClient: (id: string) => Promise<boolean>;
  createInvoice: (clientId: string, amount: number, method?: Invoice['method'], planId?: string) => void;
  createDirectInvoice: (params: { clientId: string; amount: number; dueDate?: string; planId?: string; method?: Invoice['method'] }) => Promise<Record<string, unknown> | null>;
  confirmInvoicePayment: (invoiceId: string) => Promise<void>;
  cancelInvoice: (invoiceId: string) => Promise<void>;
  openInvoiceCheckout: (invoiceId: string) => void;
  payInvoice: (invoiceId: string) => void;
  refreshBilling: () => Promise<void>;
}

const SaaSDataContext = createContext<SaaSDataContextType | undefined>(undefined);

export const SaaSDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [plans, setPlans] = useState<Plan[]>(INITIAL_PLANS);
  const { user } = useAuth();

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    Promise.resolve(supabase.from('spartan_plans').select('*').eq('active', true).order('price_monthly'))
      .then(({ data, error }) => {
        if (error) throw error;
        if (active && data?.length) setPlans(data.map((row: any) => ({
          id: row.id, name: row.name, description: row.description, priceMonthly: Number(row.price_monthly),
          priceYearly: Number(row.price_yearly), maxProjects: row.max_projects, maxPrinters: row.max_printers,
          maxFilaments: row.max_filaments, maxUsers: row.max_users, creditsAI: row.ai_credits,
          features: Array.isArray(row.features) ? row.features : [],
          popular: row.id === 'plan_pro', badge: row.id === 'plan_enterprise' ? 'ESCALA' : undefined,
        })));
      }).catch(error => console.error('Could not load plans from Supabase', error));
    return () => { active = false; };
  }, []);

  const currentPlan = useMemo(
    () => plans.find(p => p.id === user?.planId) || plans.find(p => p.id === 'plan_pro') || plans[0],
    [plans, user?.planId]
  );

  // 1. Filamentos & Estoque
  const {
    filamentos,
    movimentacoes,
    addFilamento,
    updateFilamento,
    consumirFilamento,
    consumirMultiplosFilamentos,
    estornarMultiplosFilamentos,
    refreshFilamentos,
  } = useFilamentosState(currentPlan);

  // 2. Parque de Impressoras
  const {
    impressoras,
    addImpressora,
    updateImpressora,
    deleteImpressora,
    updateImpressoraStatus,
    updatePrinterProgress,
    recordMaintenance,
    historicoImpressoras,
    refreshImpressoras,
  } = useImpressorasState(currentPlan);

  // 3. Projetos & Orçamentos (interligado com estoque e impressoras)
  const {
    projetos,
    addProjeto,
    updateProjetoStatus,
    updateProjeto,
    deleteProjeto,
    refreshProjetos,
  } = useProjetosState({ currentPlan, impressoras, refreshFilamentos, refreshImpressoras });

  // 4. Clientes & Faturamento
  const {
    clients,
    invoices,
    addClient,
    updateClientStatus,
    updateClientValidity,
    updateMultipleClientsValidity,
    updateMultipleClientsStatus,
    deleteClient,
    createInvoice,
    createDirectInvoice,
    confirmInvoicePayment,
    cancelInvoice,
    openInvoiceCheckout,
    payInvoice,
    refreshBilling,
  } = useBillingState();

  const refreshFarmData = useCallback(async () => {
    const results = await Promise.allSettled([refreshFilamentos(), refreshImpressoras(), refreshProjetos()]);
    const failure = results.find(result => result.status === 'rejected');
    if (failure?.status === 'rejected') throw failure.reason;
  }, [refreshFilamentos, refreshImpressoras, refreshProjetos]);

  const metrics = useMemo(() => {
    const activeClients = clients.filter(client => client.status === 'active');
    const mrr = activeClients.reduce((total, client) => total + (plans.find(plan => plan.id === client.planId)?.priceMonthly || 0), 0);
    const revenueHistory = Array.from({ length: 6 }, (_, offset) => {
      const month = new Date(); month.setMonth(month.getMonth() - (5 - offset));
      const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
      const paid = invoices.filter(invoice => invoice.status === 'paid' && invoice.paidAt?.startsWith(monthKey)).reduce((sum, invoice) => sum + invoice.amount, 0);
      return { month: month.toLocaleDateString('pt-BR', { month: 'short' }), revenue: paid };
    });
    const colors = ['#38bdf8', '#6366f1', '#ec4899'];
    const planDistribution = plans.map((plan, index) => ({ name: plan.name, value: activeClients.filter(client => client.planId === plan.id).length, color: colors[index % colors.length] })).filter(plan => plan.value > 0);
    return { mrr, arr: mrr * 12, activeClients: activeClients.length, churnRate: 0, ltv: 0, revenueHistory, planDistribution };
  }, [clients, invoices, plans]);

  const clientCredits = user?.aiCreditsRemaining || 0;

  const consumeCredits = async (amount: number): Promise<boolean> => {
    if (clientCredits < amount || !supabase) {
      toast.error('Créditos de IA insuficientes ou serviço indisponível.');
      return false;
    }
    const { error } = await supabase.rpc('spartan_consume_ai_credits', { p_amount: amount });
    if (error) { toast.error(`Não foi possível consumir créditos: ${error.message}`); return false; }
    return true;
  };
  const changeClientPlan = (planId: string) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan || !user) return;
    createInvoice(user.id, plan.priceMonthly, 'pix', planId);
  };

  const updatePlan = (planId: string, changes: Partial<Pick<Plan, 'priceMonthly' | 'priceYearly' | 'maxProjects' | 'maxPrinters' | 'maxFilaments' | 'maxUsers' | 'creditsAI'>>) => {
    if (!supabase || !canAccessAdmin(user)) { toast.error('Apenas administradores podem alterar planos.'); return; }
    const columns: Record<string, unknown> = {
      ...(changes.priceMonthly !== undefined ? { price_monthly: changes.priceMonthly } : {}),
      ...(changes.priceYearly !== undefined ? { price_yearly: changes.priceYearly } : {}),
      ...(changes.maxProjects !== undefined ? { max_projects: changes.maxProjects } : {}),
      ...(changes.maxPrinters !== undefined ? { max_printers: changes.maxPrinters } : {}),
      ...(changes.maxFilaments !== undefined ? { max_filaments: changes.maxFilaments } : {}),
      ...(changes.maxUsers !== undefined ? { max_users: changes.maxUsers } : {}),
      ...(changes.creditsAI !== undefined ? { ai_credits: changes.creditsAI } : {}),
    };
    void Promise.resolve(supabase.from('spartan_plans').update(columns).eq('id', planId)).then(({ error }) => {
      if (error) throw error;
      setPlans(previous => previous.map(plan => plan.id === planId ? { ...plan, ...changes } : plan));
      toast.success('Plano atualizado no Supabase.');
    }).catch(error => toast.error(`Falha ao salvar o plano: ${error.message}`));
  };

  return (
    <SaaSDataContext.Provider
      value={{
        plans,
        clients,
        invoices,
        filamentos,
        movimentacoes,
        impressoras,
        projetos,
        currentPlan,
        metrics,
        clientCredits,
        consumeCredits,
        addFilamento,
        updateFilamento,
        consumirFilamento,
        consumirMultiplosFilamentos,
        estornarMultiplosFilamentos,
        addImpressora,
        updateImpressora,
        deleteImpressora,
        updateImpressoraStatus,
        updatePrinterProgress,
        recordMaintenance,
        historicoImpressoras,
        addProjeto,
        updateProjetoStatus,
        updateProjeto,
        deleteProjeto,
        refreshFarmData,
        changeClientPlan,
        updatePlan,
        addClient,
        updateClientStatus,
        updateClientValidity,
        updateMultipleClientsValidity,
        updateMultipleClientsStatus,
        deleteClient,
        createInvoice,
        createDirectInvoice,
        confirmInvoicePayment,
        cancelInvoice,
        openInvoiceCheckout,
        payInvoice,
        refreshBilling,
      }}
    >
      {children}
    </SaaSDataContext.Provider>
  );
};

export const useSaaSData = () => {
  const context = useContext(SaaSDataContext);
  if (!context) {
    throw new Error('useSaaSData must be used within a SaaSDataProvider');
  }
  return context;
};
