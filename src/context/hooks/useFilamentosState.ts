import { useCallback, useEffect, useState } from 'react';
import { FilamentoEstoque, MovimentacaoEstoque, ProjectMaterial, Plan } from '@/types/saas';
import { FeatureGatingService } from '@/services/featureGatingService';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

type FilamentRow = {
  id: string; type: FilamentoEstoque['tipo']; color: string; color_hex: string; brand: string;
  total_weight_g: number; remaining_weight_g: number; price_per_kg: number; minimum_stock_g: number;
  nozzle_temperature: string | null; bed_temperature: string | null;
};
type InventoryEventRow = {
  id: string; filament_id: string; project_id: string | null;
  event_type: MovimentacaoEstoque['tipo']; quantity_g: number; note: string | null; created_at: string;
};
const fromRow = (row: FilamentRow): FilamentoEstoque => ({
  id: row.id, tipo: row.type, cor: row.color, corHex: row.color_hex, marca: row.brand,
  pesoTotalG: row.total_weight_g, pesoRestanteG: row.remaining_weight_g, precoKg: Number(row.price_per_kg),
  pesoMinimoG: row.minimum_stock_g ?? 200,
  temperaturaBico: row.nozzle_temperature || undefined, temperaturaMesa: row.bed_temperature || undefined,
});
const fromEventRow = (row: InventoryEventRow): MovimentacaoEstoque => ({
  id: row.id, filamentoId: row.filament_id, projetoId: row.project_id || undefined,
  tipo: row.event_type, quantidadeGramas: row.quantity_g, data: row.created_at, motivo: row.note || undefined,
});

export function useFilamentosState(currentPlan: Plan) {
  const { user } = useAuth();
  const [filamentos, setFilamentos] = useState<FilamentoEstoque[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<MovimentacaoEstoque[]>([]);

  const refreshFilamentos = useCallback(async () => {
    if (!user?.id || !user?.companyId || !supabase) { setFilamentos([]); setMovimentacoes([]); return; }
    const [stockResult, eventsResult] = await Promise.all([
      supabase.from('spartan_filaments').select('*').eq('company_id', user.companyId).order('created_at', { ascending: false }),
      supabase.from('spartan_inventory_events').select('id, filament_id, project_id, event_type, quantity_g, note, created_at').eq('company_id', user.companyId).order('created_at', { ascending: false }).limit(12),
    ]);
    if (stockResult.error) throw stockResult.error;
    if (eventsResult.error) throw eventsResult.error;
    const filterByOwner = <T extends Record<string, unknown>>(rows: T[]) =>
      rows.filter(r => !('user_id' in r) || !r.user_id || r.user_id === user.id);
    setFilamentos(filterByOwner((stockResult.data || []) as unknown as Record<string, unknown>[]).map(r => fromRow(r as unknown as FilamentRow)));
    setMovimentacoes(filterByOwner((eventsResult.data || []) as unknown as Record<string, unknown>[]).map(r => fromEventRow(r as unknown as InventoryEventRow)));
  }, [user?.id, user?.companyId]);

  useEffect(() => {
    setFilamentos([]);
    setMovimentacoes([]);
    void refreshFilamentos().catch(error => toast.error(`Falha ao carregar estoque: ${error.message}`));
    if (!user?.id || !user?.companyId || !supabase) return;
    const channel = supabase.channel(`spartan-filaments-${user.id}-${user.companyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'spartan_filaments', filter: `company_id=eq.${user.companyId}` }, () => {
        void refreshFilamentos().catch(error => toast.error(`Falha ao sincronizar estoque: ${error.message}`));
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'spartan_inventory_events', filter: `company_id=eq.${user.companyId}` }, () => {
        void refreshFilamentos().catch(error => toast.error(`Falha ao sincronizar histórico: ${error.message}`));
      }).subscribe();
    const onFocus = () => { void refreshFilamentos().catch(() => undefined); };
    window.addEventListener('focus', onFocus);
    return () => { window.removeEventListener('focus', onFocus); void supabase!.removeChannel(channel); };
  }, [refreshFilamentos, user?.id, user?.companyId]);

  const addFilamento = async (fil: Omit<FilamentoEstoque, 'id'>): Promise<boolean> => {
    const gate = FeatureGatingService.canAddFilament(filamentos.length, currentPlan);
    if (!gate.allowed) { toast.error(gate.status.message || 'Limite de carretéis atingido.'); return false; }
    if (!user?.companyId || !supabase) { toast.error('Entre na conta para salvar o estoque.'); return false; }
    try {
      const { data, error } = await supabase.from('spartan_filaments').insert({
        company_id: user.companyId, type: fil.tipo, color: fil.cor, color_hex: fil.corHex, brand: fil.marca || 'Sem marca',
        total_weight_g: fil.pesoTotalG, remaining_weight_g: fil.pesoRestanteG, price_per_kg: fil.precoKg,
        minimum_stock_g: fil.pesoMinimoG ?? 200, nozzle_temperature: fil.temperaturaBico || null, bed_temperature: fil.temperaturaMesa || null,
      }).select('*').single();
      if (error) throw error;
      const { error: eventError } = await supabase.from('spartan_inventory_events').insert({ company_id: user.companyId, filament_id: data.id, event_type: 'purchase', quantity_g: fil.pesoRestanteG, note: 'Entrada inicial do carretel' });
      if (eventError) toast.warning(`Carretel salvo, mas o histórico não foi registrado: ${eventError.message}`);
      setFilamentos(prev => [fromRow(data as FilamentRow), ...prev]);
      if (!eventError) setMovimentacoes(prev => [{ id: crypto.randomUUID(), filamentoId: data.id, tipo: 'purchase', quantidadeGramas: fil.pesoRestanteG, data: new Date().toISOString(), motivo: 'Entrada inicial do carretel' }, ...prev].slice(0, 12));
      toast.success(`Carretel ${fil.tipo} (${fil.cor}) salvo no Supabase.`);
      return true;
    } catch (error) {
      toast.error(`Falha ao salvar carretel: ${error instanceof Error ? error.message : 'erro inesperado'}`);
      return false;
    }
  };

  const updateFilamento = async (id: string, fil: Omit<FilamentoEstoque, 'id' | 'companyId'>): Promise<boolean> => {
    if (!user?.companyId || !supabase) { toast.error('Entre na conta para editar o estoque.'); return false; }
    try {
      const previous = filamentos.find(item => item.id === id);
      const { data, error } = await supabase.from('spartan_filaments').update({
        type: fil.tipo, color: fil.cor, color_hex: fil.corHex, brand: previous?.marca || 'Sem marca',
        total_weight_g: fil.pesoTotalG, remaining_weight_g: fil.pesoRestanteG, price_per_kg: fil.precoKg,
        minimum_stock_g: fil.pesoMinimoG ?? 200, nozzle_temperature: null, bed_temperature: null,
      }).eq('id', id).eq('company_id', user.companyId).select('*').maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Sem permissão para editar este carretel.');
      const difference = fil.pesoRestanteG - (previous?.pesoRestanteG ?? fil.pesoRestanteG);
      if (difference !== 0) {
        const note = `Ajuste manual: ${difference > 0 ? 'entrada' : 'redução'} de peso`;
        const { error: eventError } = await supabase.from('spartan_inventory_events').insert({ company_id: user.companyId, filament_id: id, event_type: 'adjustment', quantity_g: Math.abs(difference), note });
        if (eventError) toast.warning(`Estoque atualizado, mas o histórico não foi registrado: ${eventError.message}`);
        else setMovimentacoes(prev => [{ id: crypto.randomUUID(), filamentoId: id, tipo: 'adjustment', quantidadeGramas: Math.abs(difference), data: new Date().toISOString(), motivo: note }, ...prev].slice(0, 12));
      }
      setFilamentos(prev => prev.map(item => item.id === id ? fromRow(data as FilamentRow) : item));
      toast.success('Carretel atualizado no Supabase.');
      return true;
    } catch (error) {
      toast.error(`Falha ao editar carretel: ${error instanceof Error ? error.message : 'erro inesperado'}`);
      return false;
    }
  };

  const applyStockChange = useCallback(async (materials: ProjectMaterial[], direction: 'consume' | 'return') => {
    if (!materials?.length || !supabase) return;
    const rows = materials.filter(material => material.materialId).map(material => ({ filament_id: material.materialId, quantity_g: Math.max(0, Math.round(material.weightGrams || 0)) }));
    if (!rows.length) return;
    const { error } = await supabase.rpc(direction === 'consume' ? 'spartan_consume_filaments' : 'spartan_return_filaments', { p_materials: rows });
    if (error) { toast.error(`Falha na movimentação de estoque: ${error.message}`); throw error; }
    await refreshFilamentos();
  }, [refreshFilamentos]);

  const consumirFilamento = (filamentoId: string, gramas: number) => {
    void applyStockChange([{ id: 'single', materialId: filamentoId, materialName: '', color: '', filamentType: 'PLA', weightGrams: gramas, costPerGram: 0, totalCost: 0 }], 'consume').catch(() => undefined);
  };
  const consumirMultiplosFilamentos = (materials: ProjectMaterial[]) => { void applyStockChange(materials, 'consume').catch(() => undefined); };
  const estornarMultiplosFilamentos = (materials: ProjectMaterial[]) => { void applyStockChange(materials, 'return').catch(() => undefined); };

  return { filamentos, movimentacoes, addFilamento, updateFilamento, consumirFilamento, consumirMultiplosFilamentos, estornarMultiplosFilamentos, refreshFilamentos };
}
