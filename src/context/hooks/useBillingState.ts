import { useCallback, useEffect, useState } from 'react';
import { User, Invoice } from '@/types/saas';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { canAccessAdmin } from '@/lib/permissions';

export function useBillingState() {
  const { user } = useAuth();
  const [clients, setClients] = useState<User[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);

  const load = useCallback(async () => {
    if (!user || !supabase) { setClients([]); setInvoices([]); return; }
    await Promise.resolve(supabase.rpc('spartan_sync_expired_trials')).catch(() => undefined);
    if (canAccessAdmin(user)) {
      const [{ data: users, error: userError }, { data: invoiceRows, error: invoiceError }, { data: planRows, error: planError }] = await Promise.all([
        supabase.from('spartan_profiles').select('id, email, full_name, role, status, plan_id, company_id, company_name, company_phone, created_at, trial_ends_at').eq('role', 'client'),
        supabase.from('spartan_invoices').select('*').order('created_at', { ascending: false }),
        supabase.from('spartan_plans').select('id, price_monthly'),
      ]);
      if (userError) throw userError;
      if (invoiceError) throw invoiceError;
      if (planError) throw planError;
      const monthlyPrices = new Map((planRows || []).map((plan: any) => [plan.id, Number(plan.price_monthly)]));
      const mappedClients = (users || []).map((row: any) => ({
        id: row.id, email: row.email || '', name: row.full_name || 'Cliente', role: row.role,
        avatar: '', companyId: row.company_id, companyName: row.company_name, companyPhone: row.company_phone || '', planId: row.plan_id, status: row.status, mrr: monthlyPrices.get(row.plan_id) || 0,
        joinedAt: row.created_at,
        trialEndsAt: row.trial_ends_at || undefined,
      })) as User[];
      setClients(mappedClients);
      const names = new Map(mappedClients.map(client => [client.id, client.name]));
      setInvoices((invoiceRows || []).map((row: any) => ({
        id: row.id, clientId: row.user_id, clientName: names.get(row.user_id) || 'Assinante', amount: Number(row.amount),
        status: row.status === 'paid' ? 'paid' : (row.status === 'failed' || row.status === 'canceled') ? 'failed' : 'pending',
        dueDate: row.due_date, paidAt: row.paid_at || undefined, method: row.method,
      })) as Invoice[]);
    } else {
      const { data, error } = await supabase.from('spartan_invoices').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
      if (error) throw error;
      setInvoices((data || []).map((row: any) => ({
        id: row.id, clientId: row.user_id, clientName: user.name, amount: Number(row.amount),
        status: row.status === 'paid' ? 'paid' : (row.status === 'failed' || row.status === 'canceled') ? 'failed' : 'pending',
        dueDate: row.due_date, paidAt: row.paid_at || undefined, method: row.method,
      })) as Invoice[]);
      setClients([]);
    }
  }, [user]);

  useEffect(() => { void load().catch(error => toast.error(`Falha ao carregar faturamento: ${error.message}`)); }, [load]);

  const addClient = (data: Partial<User>) => {
    if (!supabase || !canAccessAdmin(user)) { toast.error('Apenas administradores podem convidar clientes.'); return; }
    void supabase.functions.invoke('invite-client', { body: { email: data.email, name: data.name, companyName: data.companyName, planId: data.planId } })
      .then(({ data: result, error }) => {
        if (error) throw error;
        toast.success(result?.message || 'Convite enviado por e-mail.');
        return load();
      }).catch(error => toast.error(`Não foi possível convidar o cliente: ${error.message}`));
  };

  const updateClientStatus = (id: string, status: User['status']) => {
    if (!supabase) return;
    void Promise.resolve(supabase.from('spartan_profiles').update({ status }).eq('id', id)).then(({ error }) => {
      if (error) throw error;
      setClients(prev => prev.map(client => client.id === id ? { ...client, status } : client));
      if (status === 'overdue') {
        toast.error('Status alterado para Atrasado. O acesso do cliente foi bloqueado imediatamente.');
      } else if (status === 'active') {
        toast.success('Status alterado para Ativo. O acesso do cliente foi liberado imediatamente.');
      } else if (status === 'canceled') {
        toast.info('Status alterado para Cancelado. O acesso do cliente foi suspenso.');
      } else {
        toast.success('Status do cliente atualizado com sucesso.');
      }
    }).catch(error => toast.error(`Falha ao atualizar cliente: ${error.message}`));
  };

  const updateClientValidity = async (clientId: string, newDateIso: string, newStatus?: User['status']) => {
    if (!supabase) return;
    try {
      const patch: Record<string, unknown> = {
        trial_ends_at: newDateIso,
        updated_at: new Date().toISOString(),
      };
      if (newStatus) {
        patch.status = newStatus;
      }
      const { error } = await supabase.from('spartan_profiles').update(patch).eq('id', clientId);
      if (error) throw error;
      setClients(prev => prev.map(c => c.id === clientId ? { ...c, trialEndsAt: newDateIso, status: newStatus || c.status } : c));
      toast.success('Data de vencimento e vigência atualizada com sucesso!');
    } catch (error) {
      toast.error(`Falha ao atualizar validade: ${error instanceof Error ? error.message : 'erro inesperado'}`);
    }
  };

  const updateMultipleClientsValidity = async (clientIds: string[], newDateIso: string, newStatus?: User['status']) => {
    if (!supabase || clientIds.length === 0) return;
    try {
      const patch: Record<string, unknown> = {
        trial_ends_at: newDateIso,
        updated_at: new Date().toISOString(),
      };
      if (newStatus) {
        patch.status = newStatus;
      }
      const { error } = await supabase.from('spartan_profiles').update(patch).in('id', clientIds);
      if (error) throw error;
      setClients(prev => prev.map(c => clientIds.includes(c.id) ? { ...c, trialEndsAt: newDateIso, status: newStatus || c.status } : c));
      toast.success(`Vigência atualizada para ${clientIds.length} cliente(s)!`);
    } catch (error) {
      toast.error(`Falha ao atualizar vigência em lote: ${error instanceof Error ? error.message : 'erro inesperado'}`);
    }
  };

  const updateMultipleClientsStatus = async (clientIds: string[], newStatus: User['status']) => {
    if (!supabase || clientIds.length === 0) return;
    try {
      const { error } = await supabase.from('spartan_profiles').update({ status: newStatus, updated_at: new Date().toISOString() }).in('id', clientIds);
      if (error) throw error;
      setClients(prev => prev.map(c => clientIds.includes(c.id) ? { ...c, status: newStatus } : c));
      toast.success(`Status atualizado para ${clientIds.length} cliente(s)!`);
    } catch (error) {
      toast.error(`Falha ao atualizar status em lote: ${error instanceof Error ? error.message : 'erro inesperado'}`);
    }
  };

  const createInvoice = async (clientId: string, amount: number, method: Invoice['method'] = 'pix', planId?: string) => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', { body: { clientId, amount, method, planId } });
      if (error) throw error;
      if (data?.checkoutUrl && !data.checkoutUrl.includes('/cliente/faturas')) {
        window.location.assign(data.checkoutUrl);
        return;
      }
      toast.success('Cobrança Pix criada com sucesso! Disponível na área Financeiro & Pix.');
      await load();
    } catch (edgeError) {
      console.warn('Fallback para cobrança direta:', edgeError);
      const direct = await createDirectInvoice({
        clientId,
        amount: amount > 0 ? amount : 150,
        planId,
        method: method || 'pix',
      });
      if (direct) {
        toast.success('Fatura Pix gerada com sucesso no painel financeiro!');
      }
    }
  };

  const openInvoiceCheckout = async (invoiceId: string) => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', { body: { invoiceId } });
      if (error) throw error;
      if (data?.checkoutUrl && !data.checkoutUrl.includes('/cliente/faturas')) {
        window.location.assign(data.checkoutUrl);
        return;
      }
      toast.info('Cobrança pronta para pagamento via Pix.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível abrir o pagamento.');
    }
  };

  const payInvoice = (invoiceId: string) => {
    openInvoiceCheckout(invoiceId);
  };

  const confirmInvoicePayment = async (invoiceId: string) => {
    if (!supabase) return;
    try {
      const nowIso = new Date().toISOString();
      const { data: invoiceData, error: invoiceErr } = await supabase
        .from('spartan_invoices')
        .update({ status: 'paid', paid_at: nowIso })
        .eq('id', invoiceId)
        .select('*')
        .single();
      if (invoiceErr) throw invoiceErr;

      // Ao liquidar a fatura (pagamento confirmado pelo Admin), ativa a conta do cliente (seja de teste ou em atraso)
      if (invoiceData?.user_id) {
        const { data: profile } = await supabase
          .from('spartan_profiles')
          .select('status')
          .eq('id', invoiceData.user_id)
          .single();
        if (profile?.status !== 'active') {
          await supabase.from('spartan_profiles').update({ status: 'active' }).eq('id', invoiceData.user_id);
          setClients(prev => prev.map(c => c.id === invoiceData.user_id ? { ...c, status: 'active' } : c));
        }
      }

      setInvoices(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, status: 'paid', paidAt: nowIso.slice(0, 10) } : inv));
      toast.success('Pagamento liquidado com sucesso! Acesso do cliente verificado.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao confirmar pagamento da fatura.');
    }
  };

  const cancelInvoice = async (invoiceId: string) => {
    if (!supabase) {
      setInvoices(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, status: 'failed' } : inv));
      toast.info('Fatura cancelada com sucesso.');
      return;
    }
    try {
      const { error } = await supabase.from('spartan_invoices').update({ status: 'canceled' }).eq('id', invoiceId);
      if (error) throw error;
      setInvoices(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, status: 'failed' } : inv));
      toast.info('Fatura cancelada com sucesso.');
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao cancelar fatura.');
    }
  };

  const createDirectInvoice = async (params: { clientId: string; amount: number; dueDate?: string; planId?: string; method?: Invoice['method'] }) => {
    if (!supabase) return null;
    try {
      const targetClient = clients.find(c => c.id === params.clientId);
      const companyId = targetClient?.companyId || user?.companyId;
      const dueDate = params.dueDate || new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10);
      const { data, error } = await supabase.from('spartan_invoices').insert({
        company_id: companyId,
        user_id: params.clientId,
        amount: params.amount,
        method: params.method || 'pix',
        plan_id: params.planId || targetClient?.planId || 'plan_pro',
        currency: 'BRL',
        status: 'pending',
        due_date: dueDate,
        provider: 'pix_direto',
      }).select('*').single();
      if (error) throw error;
      toast.success('Cobrança Pix criada com sucesso!');
      await load();
      return data;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao criar cobrança.');
      return null;
    }
  };

  const deleteClient = async (id: string): Promise<boolean> => {
    if (!supabase || !canAccessAdmin(user)) {
      toast.error('Apenas administradores podem excluir usuários.');
      return false;
    }
    try {
      const { error } = await supabase.rpc('spartan_admin_delete_user', {
        p_target_user_id: id,
      });
      if (error) throw error;
      setClients(prev => prev.filter(client => client.id !== id));
      setInvoices(prev => prev.filter(inv => inv.clientId !== id));
      toast.success('Usuário e todos os seus dados foram excluídos permanentemente do Supabase. O e-mail está livre para novo cadastro.');
      return true;
    } catch (error) {
      toast.error(
        `Falha ao excluir usuário: ${error instanceof Error ? error.message : 'erro inesperado'}`
      );
      return false;
    }
  };

  return {
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
    refreshBilling: load,
  };
}
