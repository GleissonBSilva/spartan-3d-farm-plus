import { useCallback, useEffect, useState } from 'react';
import { EventoImpressora, Impressora3D, Plan } from '@/types/saas';
import { FeatureGatingService } from '@/services/featureGatingService';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

type PrinterRow = {
  id: string;
  name: string;
  model: string;
  type: string;
  status: string;
  power_watts: number;
  nozzle_mm: number;
  hours_used: number;
  hours_since_maintenance: number;
  maintenance_interval_hours: number;
  current_project_id: string | null;
  current_project_name: string | null;
  progress_percent: number;
  investment_cost?: number | null;
  purchase_price?: number | null;
  lifespan_hours?: number | null;
  depreciation_per_hour?: number | null;
  hourly_depreciation?: number | null;
};
type PrinterEventRow = { id: string; printer_id: string; event_type: string; payload: Record<string, unknown>; created_at: string };
const fromRow = (row: PrinterRow): Impressora3D => {
  const rawInv = Number(row.investment_cost || row.purchase_price || 0);
  const custoInvestimento = rawInv > 0 ? rawInv : 5000;
  const vidaUtilHoras = row.lifespan_hours !== undefined && row.lifespan_hours !== null && Number(row.lifespan_hours) > 0 ? Number(row.lifespan_hours) : 5000;
  const rawDep = Number(row.depreciation_per_hour || row.hourly_depreciation || 0);
  const depreciacaoHora = rawDep > 0 ? rawDep : Number((custoInvestimento / vidaUtilHoras).toFixed(2));

  return {
    id: row.id,
    nome: row.name,
    modelo: row.model,
    tipo: row.type === 'FDM' ? 'FDM' : 'Resina SLA',
    status: row.status as Impressora3D['status'],
    potenciaWatts: row.power_watts,
    bicoMm: Number(row.nozzle_mm),
    horasUso: Number(row.hours_used),
    horasDesdeManutencao: Number(row.hours_since_maintenance || 0),
    intervaloManutencaoHoras: Number(row.maintenance_interval_hours || 100),
    limiteHorasManutencao: Number(row.maintenance_interval_hours || 100),
    projetoAtualId: row.current_project_id || undefined,
    projetoAtual: row.current_project_name || undefined,
    progressoPercentual: row.progress_percent,
    custoInvestimento,
    vidaUtilHoras,
    depreciacaoHora,
  };
};

export function useImpressorasState(currentPlan: Plan) {
  const { user } = useAuth();
  const [impressoras, setImpressoras] = useState<Impressora3D[]>([]);
  const [historicoImpressoras, setHistoricoImpressoras] = useState<EventoImpressora[]>([]);

  const refreshImpressoras = useCallback(async () => {
    if (!user?.id || !user?.companyId || !supabase) { setImpressoras([]); setHistoricoImpressoras([]); return; }
    const [printerResult, eventResult] = await Promise.all([
      supabase.from('spartan_printers').select('*').eq('company_id', user.companyId).order('created_at', { ascending: false }),
      supabase.from('spartan_printer_events').select('id, printer_id, event_type, payload, created_at').eq('company_id', user.companyId).order('created_at', { ascending: false }).limit(100),
    ]);
    if (printerResult.error) throw printerResult.error;
    if (eventResult.error) throw eventResult.error;
    const filterByOwner = <T extends Record<string, unknown>>(rows: T[]) =>
      rows.filter(r => !('user_id' in r) || !r.user_id || r.user_id === user.id);
    setImpressoras(filterByOwner((printerResult.data || []) as unknown as Record<string, unknown>[]).map(r => fromRow(r as unknown as PrinterRow)));
    setHistoricoImpressoras(filterByOwner((eventResult.data || []) as unknown as Record<string, unknown>[]).map(r => {
      const row = r as unknown as PrinterEventRow;
      return { id: row.id, impressoraId: row.printer_id, tipo: row.event_type, payload: row.payload || {}, data: row.created_at };
    }));
  }, [user?.id, user?.companyId]);

  useEffect(() => {
    setImpressoras([]);
    setHistoricoImpressoras([]);
    void refreshImpressoras().catch(error => toast.error(`Falha ao carregar impressoras: ${error.message}`));
    if (!user?.id || !user?.companyId || !supabase) return;
    const channel = supabase.channel(`spartan-printers-${user.id}-${user.companyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'spartan_printers', filter: `company_id=eq.${user.companyId}` }, () => {
        void refreshImpressoras().catch(error => toast.error(`Falha ao sincronizar impressoras: ${error.message}`));
      }).subscribe();
    const eventsChannel = supabase.channel(`spartan-printer-events-${user.id}-${user.companyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'spartan_printer_events', filter: `company_id=eq.${user.companyId}` }, () => {
        void refreshImpressoras().catch(error => toast.error(`Falha ao sincronizar histórico da impressora: ${error.message}`));
      }).subscribe();
    const onFocus = () => { void refreshImpressoras().catch(() => undefined); };
    window.addEventListener('focus', onFocus);
    return () => { window.removeEventListener('focus', onFocus); void supabase!.removeChannel(channel); void supabase!.removeChannel(eventsChannel); };
  }, [refreshImpressoras, user?.id, user?.companyId]);

  const addImpressora = (imp: Omit<Impressora3D, 'id'>): boolean => {
    const gate = FeatureGatingService.canAddPrinter(impressoras.length, currentPlan);
    if (!gate.allowed) { toast.error(gate.status.message || 'Limite de impressoras atingido.'); return false; }
    if (!user?.companyId || !supabase) { toast.error('Entre na conta para salvar a impressora.'); return false; }
    const invCost = imp.custoInvestimento !== undefined ? Number(imp.custoInvestimento) : 5000;
    const lifeHours = imp.vidaUtilHoras !== undefined && Number(imp.vidaUtilHoras) > 0 ? Number(imp.vidaUtilHoras) : 5000;
    const depHour = imp.depreciacaoHora !== undefined ? Number(imp.depreciacaoHora) : Number((invCost / lifeHours).toFixed(2));
    void Promise.resolve(supabase.from('spartan_printers').insert({
      company_id: user.companyId, name: imp.nome, model: imp.modelo, type: imp.tipo === 'FDM' ? 'FDM' : 'SLA',
      status: imp.status, power_watts: imp.potenciaWatts, nozzle_mm: imp.bicoMm, hours_used: imp.horasUso,
      maintenance_interval_hours: imp.intervaloManutencaoHoras || 100,
      current_project_id: imp.projetoAtualId || null, current_project_name: imp.projetoAtual || null,
      progress_percent: imp.progressoPercentual || 0,
      investment_cost: invCost,
      lifespan_hours: lifeHours,
      depreciation_per_hour: depHour,
    }).select('*').single()).then(({ data, error }) => {
      if (error) throw error;
      setImpressoras(prev => [fromRow(data as PrinterRow), ...prev]);
      toast.success(`Impressora ${imp.nome} salva no Supabase.`);
    }).catch(error => toast.error(`Não foi possível salvar a impressora: ${error.message}`));
    return true;
  };

  const updateImpressoraStatus = (id: string, status: Impressora3D['status'], _meta?: { projetoId?: string; projetoNome?: string }) => {
    if (!supabase) return;
    void Promise.resolve(supabase.rpc('spartan_set_printer_status', { p_printer_id: id, p_status: status })).then(({ error }) => {
      if (error) throw error;
      return refreshImpressoras();
    }).catch(error => toast.error(`Falha ao atualizar impressora: ${error.message}`));
  };

  const updatePrinterProgress = async (id: string, progress: number): Promise<boolean> => {
    if (!supabase) return false;
    const safeProgress = Math.min(100, Math.max(0, Math.round(Number(progress) || 0)));
    setImpressoras(prev => prev.map(p => p.id === id ? { ...p, progressoPercentual: safeProgress } : p));
    const { error } = await supabase.rpc('spartan_update_printer_progress', { p_printer_id: id, p_progress: safeProgress });
    if (error) { toast.error(`Não foi possível atualizar o progresso: ${error.message}`); return false; }
    await refreshImpressoras();
    return true;
  };

  const recordMaintenance = async (id: string, tasks: string[], note: string): Promise<boolean> => {
    if (!supabase) return false;
    const { error } = await supabase.rpc('spartan_record_printer_maintenance', { p_printer_id: id, p_tasks: tasks, p_note: note });
    if (error) { toast.error(`Não foi possível registrar a manutenção: ${error.message}`); return false; }
    await refreshImpressoras();
    toast.success('Manutenção registrada. O contador desde a última revisão foi reiniciado.');
    return true;
  };

  const updateImpressora = async (id: string, imp: Partial<Impressora3D>): Promise<boolean> => {
    if (!user?.companyId || !supabase) { toast.error('Entre na conta para editar a impressora.'); return false; }
    try {
      const updateData: Record<string, unknown> = {};
      if (imp.nome !== undefined) updateData.name = imp.nome;
      if (imp.modelo !== undefined) updateData.model = imp.modelo;
      if (imp.potenciaWatts !== undefined) updateData.power_watts = imp.potenciaWatts;
      if (imp.bicoMm !== undefined) updateData.nozzle_mm = imp.bicoMm;
      if (imp.intervaloManutencaoHoras !== undefined) updateData.maintenance_interval_hours = imp.intervaloManutencaoHoras;
      if (imp.horasUso !== undefined) updateData.hours_used = imp.horasUso;
      if (imp.horasDesdeManutencao !== undefined) updateData.hours_since_maintenance = imp.horasDesdeManutencao;
      if (imp.custoInvestimento !== undefined) updateData.investment_cost = imp.custoInvestimento;
      if (imp.vidaUtilHoras !== undefined) updateData.lifespan_hours = imp.vidaUtilHoras;
      if (imp.depreciacaoHora !== undefined) updateData.depreciation_per_hour = imp.depreciacaoHora;

      const { data, error } = await supabase.from('spartan_printers')
        .update(updateData)
        .eq('id', id)
        .eq('company_id', user.companyId)
        .select('*')
        .maybeSingle();

      if (error) throw error;
      if (data) {
        setImpressoras(prev => prev.map(p => p.id === id ? fromRow(data as PrinterRow) : p));
      }
      return true;
    } catch (error) {
      toast.error(`Falha ao atualizar impressora: ${error instanceof Error ? error.message : 'erro inesperado'}`);
      return false;
    }
  };

  const deleteImpressora = async (id: string): Promise<boolean> => {
    if (!user?.companyId || !supabase) { toast.error('Entre na conta para excluir a impressora.'); return false; }
    try {
      const { error } = await supabase.from('spartan_printers')
        .delete()
        .eq('id', id)
        .eq('company_id', user.companyId);

      if (error) throw error;
      setImpressoras(prev => prev.filter(p => p.id !== id));
      return true;
    } catch (error) {
      toast.error(`Falha ao excluir impressora: ${error instanceof Error ? error.message : 'erro inesperado'}`);
      return false;
    }
  };

  return { impressoras, historicoImpressoras, addImpressora, updateImpressora, deleteImpressora, updateImpressoraStatus, updatePrinterProgress, recordMaintenance, refreshImpressoras };
}
