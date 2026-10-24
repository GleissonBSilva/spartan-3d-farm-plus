import { useCallback, useEffect, useState } from 'react';
import { ProjetoImpressao3D, ProjectMaterial, Plan, Impressora3D } from '@/types/saas';
import { FeatureGatingService } from '@/services/featureGatingService';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface UseProjetosStateProps {
  currentPlan: Plan;
  impressoras: Impressora3D[];
  refreshFilamentos: () => Promise<void>;
  refreshImpressoras: () => Promise<void>;
}

type ProjectRow = {
  id: string; part_name: string; customer_name: string; customer_phone?: string | null; printer_id: string | null; materials: ProjectMaterial[];
  estimated_weight_g: number; estimated_hours: number; material_cost: number; energy_cost: number;
  depreciation_cost: number; labor_cost: number; other_cost: number; total_cost: number;
  margin_percent: number; charged_price: number; net_profit: number; status: ProjetoImpressao3D['status'];
  stock_deducted: boolean; notes: string | null; created_at: string;
  file_path: string | null;
  image_path: string | null;
  quantity: number; due_date: string | null;
};
const fromRow = (row: ProjectRow): ProjetoImpressao3D => {
  let formaPagamento: ProjetoImpressao3D['formaPagamento'];
  let parcelasCartao: number | undefined;
  let cleanNotes = row.notes || undefined;

  if (row.notes) {
    const payMatch = row.notes.match(/^\[Pagamento:\s*(\w+)(?:\s*\|\s*Parcelas:\s*(\d+))?\]\s*(.*)$/is);
    if (payMatch) {
      formaPagamento = payMatch[1].toLowerCase() as any;
      parcelasCartao = payMatch[2] ? parseInt(payMatch[2], 10) : undefined;
      cleanNotes = payMatch[3] ? payMatch[3].trim() : undefined;
    }
  }

  return {
    id: row.id,
    nomePeca: row.part_name,
    clienteNome: row.customer_name,
    clienteContato: row.customer_phone || undefined,
    impressoraId: row.printer_id || undefined,
    pesoEstimadoG: Number(row.estimated_weight_g),
    tempoEstimadoHoras: Number(row.estimated_hours),
    quantidade: Number(row.quantity || 1),
    dataEntrega: row.due_date || undefined,
    materials: row.materials || [],
    custoMaterial: Number(row.material_cost),
    custoEnergia: Number(row.energy_cost),
    custoDepreciacao: Number(row.depreciation_cost),
    custoMaoDeObra: Number(row.labor_cost),
    outrosCustos: Number(row.other_cost),
    custoTotal: Number(row.total_cost),
    margemLucroPercentual: Number(row.margin_percent),
    precoCobrado: Number(row.charged_price),
    lucroLiquido: Number(row.net_profit),
    status: row.status,
    estoqueBaixado: row.stock_deducted,
    observacoes: cleanNotes,
    formaPagamento,
    parcelasCartao,
    arquivoPath: row.file_path || undefined,
    imagemPath: row.image_path || undefined,
    dataCriacao: row.created_at.slice(0, 10),
  };
};

export function useProjetosState({ currentPlan, impressoras, refreshFilamentos, refreshImpressoras }: UseProjetosStateProps) {
  const { user } = useAuth();
  const [projetos, setProjetos] = useState<ProjetoImpressao3D[]>([]);

  const refreshProjetos = useCallback(async () => {
    if (!user?.id || !user?.companyId || !supabase) { setProjetos([]); return; }
    const { data, error } = await supabase
      .from('spartan_projects')
      .select('*')
      .eq('company_id', user.companyId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    const rows = ((data || []) as (ProjectRow & { user_id?: string | null; created_by?: string | null })[]).filter(
      r => (!r.user_id && !r.created_by) || r.user_id === user.id || r.created_by === user.id
    );
    setProjetos(rows.map(fromRow));
  }, [user?.id, user?.companyId]);

  useEffect(() => {
    setProjetos([]);
    void refreshProjetos().catch(error => toast.error(`Falha ao carregar projetos: ${error.message}`));
    if (!user?.id || !user?.companyId || !supabase) return;
    const channel = supabase.channel(`spartan-projects-${user.id}-${user.companyId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'spartan_projects', filter: `company_id=eq.${user.companyId}` }, () => {
        void refreshProjetos().catch(error => toast.error(`Falha ao sincronizar projetos: ${error.message}`));
      }).subscribe();
    const onFocus = () => { void refreshProjetos().catch(() => undefined); };
    window.addEventListener('focus', onFocus);
    return () => { window.removeEventListener('focus', onFocus); void supabase!.removeChannel(channel); };
  }, [refreshProjetos, user?.id, user?.companyId]);

  const addProjeto = (proj: Omit<ProjetoImpressao3D, 'id' | 'dataCriacao' | 'estoqueBaixado'>): boolean => {
    const gate = FeatureGatingService.canAddProject(projetos.length, currentPlan);
    if (!gate.allowed) { toast.error(gate.status.message || 'Limite de projetos atingido.'); return false; }
    if (!user?.companyId || !supabase) { toast.error('Entre na conta para salvar o projeto.'); return false; }
    const startsProduction = proj.status === 'em_impressao';
    if (startsProduction) {
      if (!proj.impressoraId) {
        toast.error('Selecione uma impressora antes de iniciar a produção.');
        return false;
      }
      const printer = impressoras.find(item => item.id === proj.impressoraId);
      if (!printer || printer.status !== 'disponivel') {
        toast.error('Escolha uma impressora disponível antes de iniciar a produção.');
        return false;
      }
    }
    const productionStarted = startsProduction;
    const encodedNotes = proj.formaPagamento
      ? `[Pagamento: ${proj.formaPagamento}${proj.parcelasCartao ? ` | Parcelas: ${proj.parcelasCartao}` : ''}] ${proj.observacoes || ''}`.trim()
      : (proj.observacoes || null);

    void Promise.resolve(supabase.from('spartan_projects').insert({
      company_id: user.companyId, created_by: user.id, part_name: proj.nomePeca, customer_name: proj.clienteNome,
      customer_phone: proj.clienteContato?.trim() || null,
      printer_id: proj.impressoraId || null, materials: proj.materials, estimated_weight_g: proj.pesoEstimadoG,
      estimated_hours: proj.tempoEstimadoHoras, material_cost: proj.custoMaterial, energy_cost: proj.custoEnergia,
      depreciation_cost: proj.custoDepreciacao, labor_cost: proj.custoMaoDeObra || 0, other_cost: proj.outrosCustos || 0,
      total_cost: proj.custoTotal, margin_percent: proj.margemLucroPercentual || 0,
      charged_price: proj.precoCobrado, net_profit: proj.lucroLiquido, status: productionStarted ? 'orcamento' : proj.status,
      stock_deducted: false, notes: encodedNotes || null, file_path: proj.arquivoPath || null,
      image_path: proj.imagemPath || null,
      quantity: proj.quantidade || 1,
      due_date: proj.dataEntrega || null,
    }).select('*').single()).then(async ({ data, error }) => {
      if (error) throw error;
      const row = data as ProjectRow;
      if (productionStarted) {
        const { error: startError } = await supabase!.rpc('spartan_set_project_status', { p_project_id: row.id, p_status: proj.status });
        if (startError) throw startError;
        row.status = proj.status;
        row.stock_deducted = true;
      }
      const saved = fromRow(row);
      setProjetos(prev => [saved, ...prev]);
      if (productionStarted) await Promise.all([refreshFilamentos(), refreshImpressoras()]);
      toast.success(productionStarted ? `Projeto ${proj.nomePeca} salvo e produção iniciada.` : `Orçamento ${proj.nomePeca} salvo com sucesso!`);
    }).catch(error => toast.error(`Não foi possível salvar o projeto: ${error.message}`));
    return true;
  };

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
      return (error as { message: string }).message;
    }
    return 'erro inesperado';
  };

  const updateProjetoStatus = async (
    id: string,
    newStatus: ProjetoImpressao3D['status'],
    overridePrinterId?: string
  ): Promise<boolean> => {
    const project = projetos.find(item => item.id === id);
    if (!project || !supabase) return false;
    const effectivePrinterId = overridePrinterId || project.impressoraId;
    const startsProduction = newStatus === 'em_impressao' && !project.estoqueBaixado;
    if (startsProduction) {
      if (!effectivePrinterId) {
        toast.error('Selecione uma impressora antes de iniciar a produção.');
        return false;
      }
      const printer = impressoras.find(item => item.id === effectivePrinterId);
      if (!printer || (printer.status !== 'disponivel' && printer.projetoAtualId !== id)) {
        toast.error(`A impressora ${printer?.nome || ''} não está disponível no momento. Escolha uma máquina livre para iniciar.`);
        return false;
      }
    }
    try {
      const { error } = await supabase.rpc('spartan_set_project_status', { p_project_id: id, p_status: newStatus });
      if (error) throw error;
      await Promise.all([refreshFilamentos(), refreshImpressoras()]);
      setProjetos(prev =>
        prev.map(item =>
          item.id === id
            ? {
                ...item,
                impressoraId: effectivePrinterId || item.impressoraId,
                status: newStatus,
                estoqueBaixado: startsProduction || (item.estoqueBaixado && newStatus !== 'cancelado'),
              }
            : item
        )
      );
      if (newStatus === 'concluido') {
        toast.success(`Projeto "${project.nomePeca}" marcado como concluído! Impressora liberada.`);
      } else if (newStatus === 'em_impressao') {
        toast.success(`Produção de "${project.nomePeca}" iniciada com sucesso!`);
      } else {
        toast.success('Status do projeto atualizado.');
      }
      return true;
    } catch (error) {
      toast.error(`Não foi possível atualizar o projeto: ${getErrorMessage(error)}`);
      return false;
    }
  };

  const updateProjeto = async (id: string, changes: Partial<ProjetoImpressao3D>): Promise<boolean> => {
    if (!user?.companyId || !supabase) { toast.error('Entre na conta para editar o projeto.'); return false; }
    const currentProject = projetos.find(project => project.id === id);
    const update = {
      ...(changes.nomePeca !== undefined ? { part_name: changes.nomePeca.trim() } : {}),
      ...(changes.clienteNome !== undefined ? { customer_name: changes.clienteNome.trim() } : {}),
      ...(changes.clienteContato !== undefined ? { customer_phone: changes.clienteContato.trim() || null } : {}),
      ...(changes.impressoraId !== undefined ? { printer_id: changes.impressoraId || null } : {}),
      ...(changes.quantidade !== undefined ? { quantity: changes.quantidade } : {}),
      ...(changes.dataEntrega !== undefined ? { due_date: changes.dataEntrega || null } : {}),
      ...(changes.materials !== undefined ? { materials: changes.materials } : {}),
      ...(changes.pesoEstimadoG !== undefined ? { estimated_weight_g: changes.pesoEstimadoG } : {}),
      ...(changes.tempoEstimadoHoras !== undefined ? { estimated_hours: changes.tempoEstimadoHoras } : {}),
      ...(changes.custoMaterial !== undefined ? { material_cost: changes.custoMaterial } : {}),
      ...(changes.custoEnergia !== undefined ? { energy_cost: changes.custoEnergia } : {}),
      ...(changes.custoDepreciacao !== undefined ? { depreciation_cost: changes.custoDepreciacao } : {}),
      ...(changes.custoMaoDeObra !== undefined ? { labor_cost: changes.custoMaoDeObra } : {}),
      ...(changes.outrosCustos !== undefined ? { other_cost: changes.outrosCustos } : {}),
      ...(changes.custoTotal !== undefined ? { total_cost: changes.custoTotal } : {}),
      ...(changes.margemLucroPercentual !== undefined ? { margin_percent: changes.margemLucroPercentual } : {}),
      ...(changes.precoCobrado !== undefined ? { charged_price: changes.precoCobrado } : {}),
      ...(changes.observacoes !== undefined || changes.formaPagamento !== undefined || changes.parcelasCartao !== undefined
        ? {
            notes: (changes.formaPagamento ?? currentProject?.formaPagamento)
              ? `[Pagamento: ${changes.formaPagamento ?? currentProject?.formaPagamento}${changes.parcelasCartao ?? currentProject?.parcelasCartao ? ` | Parcelas: ${changes.parcelasCartao ?? currentProject?.parcelasCartao}` : ''}] ${changes.observacoes ?? currentProject?.observacoes ?? ''}`.trim()
              : (changes.observacoes ?? currentProject?.observacoes ?? null),
          }
        : {}),
      ...(changes.imagemPath !== undefined ? { image_path: changes.imagemPath || null } : {}),
    };
    if (!Object.keys(update).length) return true;
    try {
      const { data, error } = await supabase.from('spartan_projects').update(update)
        .eq('id', id).eq('company_id', user.companyId).eq('created_by', user.id).select('*').maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Sem permissão para editar este projeto.');
      const updated = fromRow(data as ProjectRow);
      setProjetos(prev => prev.map(item => item.id === id ? updated : item));
      toast.success('Projeto atualizado.');
      return true;
    } catch (error) {
      toast.error(`Não foi possível editar o projeto: ${getErrorMessage(error)}`);
      return false;
    }
  };

  const deleteProjeto = async (id: string): Promise<boolean> => {
    const project = projetos.find(item => item.id === id);
    if (!project || !user?.companyId || !supabase) return false;
    try {
      if (project.estoqueBaixado && (project.status === 'em_impressao' || project.status === 'aprovado')) {
        const { error: cancelError } = await supabase.rpc('spartan_set_project_status', { p_project_id: id, p_status: 'cancelado' });
        if (cancelError) throw cancelError;
      }
      const { data, error } = await supabase.from('spartan_projects').delete()
        .eq('id', id).eq('company_id', user.companyId).eq('created_by', user.id).select('id').maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Sem permissão para excluir este projeto.');
      setProjetos(prev => prev.filter(item => item.id !== id));
      await Promise.all([refreshFilamentos(), refreshImpressoras()]);
      toast.success('Projeto excluído.');
      return true;
    } catch (error) {
      toast.error(`Não foi possível excluir o projeto: ${getErrorMessage(error)}`);
      return false;
    }
  };

  return { projetos, addProjeto, updateProjetoStatus, updateProjeto, deleteProjeto, refreshProjetos };
}
