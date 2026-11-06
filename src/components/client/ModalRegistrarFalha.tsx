"use client";

import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, 
  X, 
  Wrench, 
  Package, 
  DollarSign, 
  Clock3, 
  Layers, 
  Flame, 
  CheckCircle2, 
  HelpCircle,
  RotateCcw,
  Zap,
  Activity
} from 'lucide-react';
import { toast } from 'sonner';
import { Impressora3D, ProjetoImpressao3D, FilamentoEstoque } from '@/types/saas';
import { useSaaSData } from '@/context/SaaSDataContext';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';

interface ModalRegistrarFalhaProps {
  isOpen: boolean;
  onClose: () => void;
  printer?: Impressora3D | null;
  project?: ProjetoImpressao3D | null;
  initialProgress?: number;
  onSuccess?: () => void;
}

export const MOTIVOS_FALHA = [
  { 
    id: 'cancelamento_operador', 
    label: 'Cancelamento no Meio da Impressão', 
    icon: '⏹️', 
    desc: 'Impressão interrompida antes do fim: o filamento impresso até aqui é contabilizado como desperdício.',
    tarefaManutencao: 'Limpeza de mesa e inspeção'
  },
  { 
    id: 'bico_entupido', 
    label: 'Bico Entupido / Falha de Extrusão', 
    icon: '🔴', 
    desc: 'O filamento parou de sair ou a extrusora começou a estalar (tec-tec).',
    tarefaManutencao: 'Desentupir bico / Limpeza e Cold pull'
  },
  { 
    id: 'warping', 
    label: 'Peça Descolou da Mesa (Warping)', 
    icon: '⚠️', 
    desc: 'Cantos levantaram ou a peça soltou completamente durante a impressão.',
    tarefaManutencao: 'Limpeza profunda da mesa e nivelamento Z-offset'
  },
  { 
    id: 'layer_shift', 
    label: 'Deslocamento de Camada (Layer Shift)', 
    icon: '❌', 
    desc: 'As camadas perderam o alinhamento X/Y por colisão ou correia solta.',
    tarefaManutencao: 'Verificar correias e aperto de polias'
  },
  { 
    id: 'filamento_acabou', 
    label: 'Filamento Enroscou ou Acabou', 
    icon: '🧶', 
    desc: 'Carretel travou, nó no carretel ou sensor de fim de filamento não pausou a tempo.',
    tarefaManutencao: 'Verificar sensor de filamento e guia do carretel'
  },
  { 
    id: 'queda_energia', 
    label: 'Queda de Energia ou Erro Térmico', 
    icon: '⚡', 
    desc: 'Thermal Runaway, desligamento repentino ou travamento de placa.',
    tarefaManutencao: 'Inspecionar conexões do termistor e fonte'
  },
  { 
    id: 'outro', 
    label: 'Outro Problema Técnico', 
    icon: '📝', 
    desc: 'Problema no fatiador G-code, colisão mecânica ou defeito no modelo.',
    tarefaManutencao: 'Revisão geral da máquina'
  },
];

export const ModalRegistrarFalha: React.FC<ModalRegistrarFalhaProps> = ({
  isOpen,
  onClose,
  printer,
  project,
  initialProgress,
  onSuccess
}) => {
  const { user } = useAuth();
  const { 
    filamentos, 
    projetos, 
    impressoras, 
    consumirFilamento, 
    estornarMultiplosFilamentos,
    updateImpressora,
    updateProjeto,
    refreshFarmData 
  } = useSaaSData();

  // Identifica o projeto ativo vinculado à impressora caso não tenha sido passado diretamente
  const activeProject = useMemo(() => {
    if (project) return project;
    if (printer?.projetoAtualId) {
      return projetos.find(p => p.id === printer.projetoAtualId) || null;
    }
    return null;
  }, [project, printer, projetos]);

  // Identifica a impressora vinculada ao projeto caso não tenha sido passada diretamente
  const activePrinter = useMemo(() => {
    if (printer) return printer;
    if (activeProject?.impressoraId) {
      return impressoras.find(p => p.id === activeProject.impressoraId) || null;
    }
    return null;
  }, [printer, activeProject, impressoras]);

  // Nome da peça
  const pieceName = activeProject?.nomePeca || activePrinter?.projetoAtual || 'Peça em impressão';

  // Identifica o carretel ativo
  const activeSpool = useMemo<FilamentoEstoque | null>(() => {
    if (activeProject?.materials && activeProject.materials.length > 0) {
      const mat = activeProject.materials[0];
      const match = filamentos.find(f => f.id === mat.materialId || f.tipo.toUpperCase() === mat.filamentType?.toUpperCase());
      if (match) return match;
    }
    return filamentos.find(f => f.tipo.toUpperCase() === 'PLA') || filamentos[0] || null;
  }, [activeProject, filamentos]);

  // Progresso inicial no momento do erro
  const defaultProgress = useMemo(() => {
    if (initialProgress !== undefined && initialProgress >= 0) return initialProgress;
    if (activePrinter?.progressoPercentual !== undefined && activePrinter.progressoPercentual > 0) {
      return activePrinter.progressoPercentual;
    }
    return 30; // 30% padrão se não informado
  }, [initialProgress, activePrinter]);

  // Peso total estimado do projeto
  const totalWeightGrams = useMemo(() => {
    if (activeProject?.pesoEstimadoG && activeProject.pesoEstimadoG > 0) {
      return activeProject.pesoEstimadoG;
    }
    return 50; // peso padrão se avulso
  }, [activeProject]);

  // Estados do formulário
  const [motivoId, setMotivoId] = useState('bico_entupido');
  const [progresso, setProgresso] = useState<number>(defaultProgress);
  const [gramasPerdidas, setGramasPerdidas] = useState<number>(() => {
    return Math.max(1, Math.round(totalWeightGrams * (defaultProgress / 100)));
  });
  const [destinarManutencao, setDestinarManutencao] = useState(true);
  const [observacoes, setObservacoes] = useState('');
  const [salvando, setSalvando] = useState(false);

  // Sincroniza campos quando o modal abre
  useEffect(() => {
    if (isOpen) {
      setMotivoId('bico_entupido');
      setProgresso(defaultProgress);
      const calculatedGrams = Math.max(1, Math.round(totalWeightGrams * (defaultProgress / 100)));
      setGramasPerdidas(calculatedGrams);
      setDestinarManutencao(true);
      setObservacoes('');
    }
  }, [isOpen, defaultProgress, totalWeightGrams]);

  // Recalcula perda sugerida quando o progresso muda
  const handleProgressoChange = (novoProg: number) => {
    const safeProg = Math.min(100, Math.max(0, novoProg));
    setProgresso(safeProg);
    const suggested = Math.max(1, Math.round(totalWeightGrams * (safeProg / 100)));
    setGramasPerdidas(suggested);
  };

  // Preço por kg do carretel
  const precoKg = activeSpool?.precoKg || 120;
  const custoPrejuizoReais = Number(((gramasPerdidas * precoKg) / 1000).toFixed(2));

  // Cálculo de estorno: se o projeto baixou 100g e perdeu 30g, 70g voltam pro carretel
  const saldoNaoGasto = Math.max(0, totalWeightGrams - gramasPerdidas);
  const projetoBaixouEstoque = Boolean(activeProject?.estoqueBaixado);

  const motivoSelecionado = MOTIVOS_FALHA.find(m => m.id === motivoId) || MOTIVOS_FALHA[0];

  if (!isOpen) return null;

  const handleConfirmarFalha = async (e: React.FormEvent) => {
    e.preventDefault();
    if (salvando) return;
    setSalvando(true);

    try {
      const nowIso = new Date().toISOString();
      const motivoLabel = motivoSelecionado.label;

      // 1. REGISTRO E DEDUÇÃO NO ESTOQUE DE FILAMENTO
      if (activeSpool) {
        if (projetoBaixouEstoque && saldoNaoGasto > 0) {
          // O projeto havia consumido o peso total antecipadamente.
          // Devolvemos o saldo não gasto (+saldoNaoGasto) ao carretel, mantendo as gramasPerdidas debitadas.
          const novoSaldo = Math.min(activeSpool.pesoTotalG, activeSpool.pesoRestanteG + saldoNaoGasto);
          
          if (supabase && user?.companyId) {
            await supabase.from('spartan_filaments')
              .update({ remaining_weight_g: novoSaldo, updated_at: nowIso })
              .eq('id', activeSpool.id)
              .eq('company_id', user.companyId);

            await supabase.from('spartan_inventory_events').insert({
              company_id: user.companyId,
              user_id: user.id,
              filament_id: activeSpool.id,
              project_id: activeProject?.id || null,
              event_type: 'adjustment',
              quantity_g: gramasPerdidas,
              note: `Perda/Desperdício por Falha [${motivoLabel}]: ${gramasPerdidas}g desperdiçados na peça "${pieceName}" (Saldo não gasto de ${saldoNaoGasto}g estornado)`,
              created_by: user.id
            });
          }
        } else {
          // Projeto sem baixa prévia ou impressão direta: debita diretamente as gramas perdidas
          const novoSaldo = Math.max(0, activeSpool.pesoRestanteG - gramasPerdidas);
          
          if (supabase && user?.companyId) {
            await supabase.from('spartan_filaments')
              .update({ remaining_weight_g: novoSaldo, updated_at: nowIso })
              .eq('id', activeSpool.id)
              .eq('company_id', user.companyId);

            await supabase.from('spartan_inventory_events').insert({
              company_id: user.companyId,
              user_id: user.id,
              filament_id: activeSpool.id,
              project_id: activeProject?.id || null,
              event_type: 'adjustment',
              quantity_g: gramasPerdidas,
              note: `Perda/Desperdício por Falha [${motivoLabel}]: ${gramasPerdidas}g desperdiçados na peça "${pieceName}"`,
              created_by: user.id
            });
          }
        }
      }

      // 2. ATUALIZAR O PROJETO (Cancelado com registro do prejuízo e perda de gramas)
      if (activeProject) {
        const obsFormatada = `[FALHA DE IMPRESSÃO: ${motivoLabel} aos ${progresso}% | Perda real: ${gramasPerdidas}g (R$ ${custoPrejuizoReais.toFixed(2)})] ${observacoes.trim() ? `· Obs: ${observacoes.trim()}` : ''}`;
        
        if (supabase && user?.companyId) {
          await supabase.from('spartan_projects').update({
            status: 'cancelado',
            estimated_weight_g: gramasPerdidas, // Fixa o peso do projeto exatamente na perda para o relatório financeiro
            material_cost: custoPrejuizoReais,
            total_cost: custoPrejuizoReais,
            notes: obsFormatada,
            stock_deducted: true,
            updated_at: nowIso
          })
          .eq('id', activeProject.id)
          .eq('company_id', user.companyId);
        }
      }

      // 3. ATUALIZAR A IMPRESSORA E REGISTRAR O HISTÓRICO DE ERRO
      if (activePrinter) {
        // Horas efetivamente gastas até o erro
        const tempoEstimadoH = activeProject?.tempoEstimadoHoras || 1.5;
        const horasPerdidas = Number(((tempoEstimadoH * (progresso / 100))).toFixed(2));
        const novasHorasUso = Number((activePrinter.horasUso + horasPerdidas).toFixed(2));
        const novasHorasManut = Number(((activePrinter.horasDesdeManutencao || 0) + horasPerdidas).toFixed(2));

        const novoStatus = destinarManutencao ? 'manutencao' : 'disponivel';

        if (supabase && user?.companyId) {
          // Atualiza dados operacionais da impressora
          await supabase.from('spartan_printers').update({
            status: novoStatus,
            current_project_id: null,
            current_project_name: null,
            progress_percent: 0,
            hours_used: novasHorasUso,
            hours_since_maintenance: novasHorasManut,
            updated_at: nowIso
          })
          .eq('id', activePrinter.id)
          .eq('company_id', user.companyId);

          // Registra o evento de falha no histórico da máquina
          await supabase.from('spartan_printer_events').insert({
            company_id: user.companyId,
            user_id: user.id,
            printer_id: activePrinter.id,
            event_type: 'print_failure',
            payload: {
              motivo_id: motivoId,
              motivo: motivoLabel,
              progresso: progresso,
              gramas_perdidas: gramasPerdidas,
              custo_prejuizo: custoPrejuizoReais,
              projeto_id: activeProject?.id || null,
              projeto_nome: pieceName,
              tarefa_recomendada: motivoSelecionado.tarefaManutencao,
              destinado_manutencao: destinarManutencao,
              observacoes: observacoes.trim() || undefined,
              data: nowIso
            }
          });
        }

        // Limpa timers locais do localStorage para esta impressora
        if (user?.id) {
          try {
            const key = `ph3d_active_print_timers_${user.id}`;
            const raw = localStorage.getItem(key);
            if (raw) {
              const timers = JSON.parse(raw);
              delete timers[activePrinter.id];
              localStorage.setItem(key, JSON.stringify(timers));
            }
          } catch {
            // ignore
          }
        }
      }

      // 4. ATUALIZAR TODA A PLATAFORMA EM TEMPO REAL
      await refreshFarmData();

      toast.success(
        `🚨 Falha registrada com sucesso! ${gramasPerdidas}g (-R$ ${custoPrejuizoReais.toFixed(2)}) contabilizados como desperdício no estoque e relatórios da farm.`,
        { duration: 6000 }
      );

      if (destinarManutencao && activePrinter) {
        toast.info(
          `🔧 Impressora ${activePrinter.nome} colocada em manutenção. Tarefa sugerida: "${motivoSelecionado.tarefaManutencao}".`
        );
      }

      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Erro ao registrar falha de impressão:', error);
      toast.error(`Falha ao registrar interrupção: ${error instanceof Error ? error.message : 'Erro inesperado'}`);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={e => {
        if (e.target === e.currentTarget && !salvando) onClose();
      }}
    >
      <div 
        className="w-full max-w-lg max-h-[92vh] flex flex-col rounded-2xl border border-rose-500/40 bg-slate-900 shadow-2xl shadow-rose-950/40 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* CABEÇALHO */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-rose-950/20 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm flex items-center gap-2">
                Registrar Falha & Contabilizar Perda
              </h3>
              <p className="text-[11px] text-slate-400">
                Interrompa a produção, dê baixa no refugo e aloque a impressora
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={salvando}
            onClick={onClose}
            className="text-slate-400 hover:text-white rounded-lg p-1 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* CORPO DO FORMULÁRIO COM SCROLL */}
        <form onSubmit={handleConfirmarFalha} className="p-5 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* CARTÃO DE IDENTIFICAÇÃO DA PRODUÇÃO */}
          <div className="rounded-xl bg-slate-950 border border-slate-800 p-3.5 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Peça em Impressão
                </span>
                <strong className="text-white text-sm block truncate">
                  {pieceName}
                </strong>
                {activePrinter && (
                  <span className="text-[11px] text-slate-400 block mt-0.5">
                    🖨️ {activePrinter.nome} ({activePrinter.modelo})
                  </span>
                )}
              </div>
              <Badge variant="outline" className="border-rose-500/40 bg-rose-500/10 text-rose-300 text-[10px] shrink-0">
                Interrupção Crítica
              </Badge>
            </div>

            {activeSpool && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px] text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-amber-400" />
                  Carretel: <strong className="text-white">{activeSpool.tipo} {activeSpool.cor}</strong>
                </span>
                <span>
                  Saldo: <strong className="text-emerald-400">{activeSpool.pesoRestanteG}g</strong>
                </span>
              </div>
            )}
          </div>

          {/* MOTIVO DA FALHA */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-200 block flex items-center justify-between">
              <span>Selecione o Motivo da Falha:</span>
              <span className="text-[10px] text-slate-400">Clique para selecionar</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {MOTIVOS_FALHA.map((m) => {
                const isSelected = motivoId === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMotivoId(m.id)}
                    className={`p-2.5 rounded-xl border text-left transition-all flex items-start gap-2 ${
                      isSelected
                        ? 'bg-rose-950/40 border-rose-500/80 shadow-md shadow-rose-950/20'
                        : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <span className="text-base leading-none mt-0.5">{m.icon}</span>
                    <div className="min-w-0">
                      <strong className={`block text-xs leading-tight ${isSelected ? 'text-white' : 'text-slate-300'}`}>
                        {m.label}
                      </strong>
                      <span className="text-[10px] text-slate-400 block line-clamp-1 mt-0.5">
                        {m.desc}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* CALCULADORA DE DESPERDÍCIO E PERDA */}
          <div className="rounded-xl bg-slate-950 border border-slate-800 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-amber-400" />
                Cálculo do Desperdício de Filamento
              </span>
              <span className="text-[10px] text-slate-400">
                Peso total previsto: <strong className="text-white">{totalWeightGrams}g</strong>
              </span>
            </div>

            {/* Slider de Progresso */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-400">Progresso alcançado antes de parar:</span>
                <strong className="text-sky-300">{progresso}%</strong>
              </div>
              <input
                type="range"
                min="1"
                max="100"
                step="1"
                value={progresso}
                onChange={e => handleProgressoChange(Number(e.target.value))}
                className="w-full accent-rose-500"
              />
            </div>

            {/* Grid de Métricas de Perda e Custo */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-center">
              <div className="p-2.5 rounded-xl bg-slate-900 border border-rose-500/30">
                <span className="text-[10px] text-rose-300 block font-medium">Filamento Perdido</span>
                <div className="flex items-center justify-center gap-1 mt-1">
                  <Input
                    type="number"
                    min="1"
                    max={totalWeightGrams * 2}
                    value={gramasPerdidas}
                    onChange={e => setGramasPerdidas(Math.max(1, Number(e.target.value) || 1))}
                    className="h-7 w-16 bg-slate-950 text-center font-bold text-rose-400 text-xs p-1 rounded-lg border-rose-500/50"
                  />
                  <span className="text-xs font-bold text-rose-400">g</span>
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800">
                <span className="text-[10px] text-slate-400 block font-medium">Prejuízo Calculado</span>
                <strong className="text-base font-bold text-amber-400 block mt-1">
                  R$ {custoPrejuizoReais.toFixed(2)}
                </strong>
                <span className="text-[9px] text-slate-500">(R$ {precoKg}/kg)</span>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 col-span-2 sm:col-span-1">
                <span className="text-[10px] text-slate-400 block font-medium">Estorno ao Carretel</span>
                <strong className="text-base font-bold text-emerald-400 block mt-1">
                  {projetoBaixouEstoque ? `+${saldoNaoGasto}g` : '0g'}
                </strong>
                <span className="text-[9px] text-slate-500">
                  {projetoBaixouEstoque ? 'Devolvido ao estoque' : 'Baixa direta da perda'}
                </span>
              </div>
            </div>

            <p className="text-[10px] text-slate-400 leading-relaxed bg-slate-900/60 p-2 rounded-lg border border-slate-800">
              💡 <strong>Dica de Pesagem:</strong> O Spartan calculou a perda automaticamente com base nos {progresso}% de impressão (~{gramasPerdidas}g). Se você pesou o pedaço que saiu na mesa em uma balança de precisão, pode ajustar o número de gramas acima.
            </p>
          </div>

          {/* DESTINO DA IMPRESSORA */}
          {activePrinter && (
            <div className="rounded-xl bg-slate-950 border border-slate-800 p-3.5 space-y-2.5">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-orange-400" />
                Destino da Impressora {activePrinter.nome}
              </span>

              <div className="space-y-2">
                <label className="flex items-start gap-2.5 p-2 rounded-lg border border-slate-800 bg-slate-900 cursor-pointer hover:border-slate-700">
                  <input
                    type="radio"
                    name="destinarManutencao"
                    checked={destinarManutencao}
                    onChange={() => setDestinarManutencao(true)}
                    className="mt-0.5 accent-orange-500"
                  />
                  <div>
                    <strong className="text-xs text-white block">
                      Colocar em Manutenção (Recomendado)
                    </strong>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Bloqueia novas impressões até a revisão. Tarefa sugerida: <em className="text-orange-300">&quot;{motivoSelecionado.tarefaManutencao}&quot;</em>.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-2 rounded-lg border border-slate-800 bg-slate-900 cursor-pointer hover:border-slate-700">
                  <input
                    type="radio"
                    name="destinarManutencao"
                    checked={!destinarManutencao}
                    onChange={() => setDestinarManutencao(false)}
                    className="mt-0.5 accent-emerald-500"
                  />
                  <div>
                    <strong className="text-xs text-white block">
                      Liberar imediatamente como Disponível
                    </strong>
                    <span className="text-[10px] text-slate-400 block mt-0.5">
                      Use caso você já tenha desentupido o bico e limpado a mesa agora mesmo.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* OBSERVAÇÕES OPCIONAIS */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-400 block">
              Observações Técnicas adicionais (opcional):
            </label>
            <Input
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              placeholder="Ex: Fiz cold pull com nylon a 240°C, filamento quebrou na entrada da extrusora..."
              className="bg-slate-950 border-slate-800 text-white rounded-xl h-9 text-xs"
            />
          </div>

          {/* BOTÕES DE AÇÃO */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <Button
              type="button"
              variant="outline"
              disabled={salvando}
              onClick={onClose}
              className="border-slate-700 bg-slate-950 text-slate-300 text-xs rounded-xl h-10 px-4"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={salvando || gramasPerdidas <= 0}
              className="bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs rounded-xl h-10 px-5 shadow-lg shadow-rose-950/40"
            >
              {salvando ? (
                'Contabilizando Perda...'
              ) : (
                <>
                  <AlertTriangle className="w-3.5 h-3.5 mr-1.5" />
                  Confirmar & Contabilizar Perda ({gramasPerdidas}g)
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

