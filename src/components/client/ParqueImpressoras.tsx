"use client";

import React, { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, CheckCircle2, CirclePower, Clock3, Cpu, History, Pause, Play, Plus, Wrench, X, DollarSign, Trash2, Edit2 } from 'lucide-react';
import { useSaaSData } from '@/context/SaaSDataContext';
import { Impressora3D } from '@/types/saas';
import { toast } from 'sonner';

const MAINTENANCE_TASKS = ['Limpar bico', 'Lubrificar eixos', 'Limpar mesa', 'Verificar correias', 'Verificar ventiladores'];
const STATUS: Record<Impressora3D['status'], { label: string; badge: string; dot: string }> = {
  disponivel: { label: 'Disponível', badge: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300', dot: 'bg-emerald-400' },
  imprimindo: { label: 'Imprimindo', badge: 'border-sky-500/30 bg-sky-500/10 text-sky-300', dot: 'bg-sky-400' },
  pausada: { label: 'Pausada', badge: 'border-amber-500/30 bg-amber-500/10 text-amber-300', dot: 'bg-amber-400' },
  manutencao: { label: 'Manutenção', badge: 'border-orange-500/30 bg-orange-500/10 text-orange-300', dot: 'bg-orange-400' },
  desconectada: { label: 'Offline', badge: 'border-rose-500/30 bg-rose-500/10 text-rose-300', dot: 'bg-rose-400' },
};

const parseAndSanitizeEstimatedSeconds = (inputTime: number | string): number => {
  let totalSeconds = 0;
  if (typeof inputTime === 'string' && inputTime.includes(':')) {
    const parts = inputTime.split(':').map(Number);
    totalSeconds = (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  } else {
    const numericValue = Number(inputTime) || 0;
    totalSeconds = numericValue > 1000 && !String(inputTime).includes('.') ? numericValue : Math.round(numericValue * 3600);
  }
  return totalSeconds > 720 * 3600 || isNaN(totalSeconds) || totalSeconds < 0 ? 18 * 3600 : totalSeconds;
};

const formatSecondsToTime = (totalSeconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return `${hours}h${String(minutes).padStart(2, '0')}m${String(seconds).padStart(2, '0')}s`;
};

const formatHours = (inputTime: number | string) => formatSecondsToTime(parseAndSanitizeEstimatedSeconds(inputTime));

import { useAuth } from '@/context/AuthContext';

export const ParqueImpressoras: React.FC = () => {
  const { user } = useAuth();
  const { impressoras: rawImpressoras, projetos, historicoImpressoras, addImpressora, updateImpressora, deleteImpressora, updateImpressoraStatus, updatePrinterProgress, recordMaintenance, updateProjetoStatus, refreshFarmData } = useSaaSData();
  
  // Estado local para exclusão manual garantida e metadados customizados (estritamente isolados por user.id)
  const [deletedPrinterIds, setDeletedPrinterIds] = useState<string[]>([]);
  const [customInvestments, setCustomInvestments] = useState<Record<string, { custoInvestimento: number; vidaUtilHoras: number; depreciacaoHora: number }>>({});

  useEffect(() => {
    if (!user?.id) {
      setDeletedPrinterIds([]);
      setCustomInvestments({});
      return;
    }
    try {
      const savedDel = localStorage.getItem(`ph3d_deleted_printers_${user.id}`);
      setDeletedPrinterIds(savedDel ? JSON.parse(savedDel) : []);

      const savedInv = localStorage.getItem(`ph3d_printer_investments_v2_${user.id}`);
      setCustomInvestments(savedInv ? JSON.parse(savedInv) : {});
    } catch (e) {
      console.error('Erro ao carregar dados do parque de impressoras do localStorage:', e);
    }
  }, [user?.id]);

  // Filtra as impressoras removendo as que foram marcadas como deletadas localmente
  // e garante vínculo automático caso haja um projeto 'em_impressao' alocado para a máquina
  const impressoras = useMemo(() => {
    return rawImpressoras
      .filter(p => !deletedPrinterIds.includes(p.id))
      .map(p => {
        const custom = customInvestments[p.id];
        const activeProjForPrinter =
          projetos.find(
            proj =>
              proj.status === 'em_impressao' &&
              (proj.id === p.projetoAtualId || proj.impressoraId === p.id)
          ) ||
          (p.status === 'imprimindo' || p.status === 'pausada'
            ? projetos.find(proj => proj.status === 'em_impressao') ||
              projetos.find(proj => proj.impressoraId === p.id && proj.status !== 'concluido' && proj.status !== 'cancelado')
            : undefined);

        const effectiveStatus: Impressora3D['status'] =
          activeProjForPrinter && p.status === 'disponivel' ? 'imprimindo' : p.status;

        const resolvedProjectId =
          p.projetoAtualId ||
          activeProjForPrinter?.id ||
          (effectiveStatus === 'imprimindo' || effectiveStatus === 'pausada' ? `active_${p.id}` : undefined);

        const basePrinter: Impressora3D = {
          ...p,
          status: effectiveStatus,
          projetoAtualId: resolvedProjectId,
          projetoAtual: p.projetoAtual || activeProjForPrinter?.nomePeca || (resolvedProjectId ? 'Projeto em produção' : undefined),
        };

        if (custom && custom.custoInvestimento > 0) {
          return {
            ...basePrinter,
            custoInvestimento: custom.custoInvestimento,
            vidaUtilHoras: custom.vidaUtilHoras,
            depreciacaoHora: custom.depreciacaoHora
          };
        }
        return basePrinter;
      });
  }, [rawImpressoras, deletedPrinterIds, customInvestments, projetos]);

  const [showAddForm, setShowAddForm] = useState(false);
  const [maintenancePrinter, setMaintenancePrinter] = useState<string | null>(null);
  const [maintenanceTasks, setMaintenanceTasks] = useState<string[]>([]);
  const [maintenanceNote, setMaintenanceNote] = useState('');
  const [savingMaintenance, setSavingMaintenance] = useState(false);
  const [progressDraft, setProgressDraft] = useState<Record<string, number>>({});
  
  const [editingPrinterId, setEditingPrinterId] = useState<string | null>(null);
  const [editNome, setEditNome] = useState('');
  const [editModelo, setEditModelo] = useState('');
  const [editPotencia, setEditPotencia] = useState<number | string>(350);
  const [editBico, setEditBico] = useState<number | string>(0.4);
  const [editPrecoCompra, setEditPrecoCompra] = useState<number | string>(5000);
  const [editVidaUtil, setEditVidaUtil] = useState<number | string>(5000);
  const [editIntervaloManutencao, setEditIntervaloManutencao] = useState<number | string>(100);
  const [editHorasUso, setEditHorasUso] = useState<number | string>(0);

  const [remainingSecondsMap, setRemainingSecondsMap] = useState<Record<string, number>>({});
  const completingPrintersRef = React.useRef<Set<string>>(new Set());

  const getTimerStorageKey = () => (user?.id ? `ph3d_active_print_timers_${user.id}` : null);

  const readStoredTimers = (): Record<string, { projectId: string; targetEndMs: number; pausedRemainingSecs?: number; totalSecs: number }> => {
    const key = getTimerStorageKey();
    if (!key) return {};
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  };

  const writeStoredTimers = (timers: Record<string, { projectId: string; targetEndMs: number; pausedRemainingSecs?: number; totalSecs: number }>) => {
    const key = getTimerStorageKey();
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify(timers));
    } catch {
      // ignore storage quota errors
    }
  };

  const handleConcluirTrabalho = async (printer: Impressora3D, isAuto = false) => {
    if (completingPrintersRef.current.has(printer.id)) return;
    completingPrintersRef.current.add(printer.id);

    const rawProjectId = printer.projetoAtualId && !printer.projetoAtualId.startsWith('active_')
      ? printer.projetoAtualId
      : projetos.find(proj => (proj.impressoraId === printer.id || !proj.impressoraId) && proj.status === 'em_impressao')?.id;
    const currentProject = projetos.find(proj => proj.id === rawProjectId);
    const projectName = currentProject?.nomePeca || printer.projetoAtual || 'Projeto';

    try {
      // 1. Zera e limpa do mapa de contagem local e do localStorage
      setRemainingSecondsMap(prev => {
        const next = { ...prev };
        delete next[printer.id];
        return next;
      });
      setProgressDraft(prev => {
        const next = { ...prev };
        delete next[printer.id];
        return next;
      });
      const stored = readStoredTimers();
      if (stored[printer.id]) {
        delete stored[printer.id];
        writeStoredTimers(stored);
      }

      // 2. Dá baixa no projeto e libera a impressora
      if (rawProjectId) {
        await updateProjetoStatus(rawProjectId, 'concluido');
      } else {
        updateImpressoraStatus(printer.id, 'disponivel');
      }

      await refreshFarmData();

      if (isAuto) {
        toast.success(
          `⏰ Tempo zerado! A peça "${projectName}" foi finalizada, com baixa automática efetuada. A impressora ${printer.nome} agora está disponível!`,
          { duration: 6000 }
        );
      } else {
        toast.success(
          `✅ Impressão de "${projectName}" concluída com sucesso! Impressora ${printer.nome} liberada e pronta para nova produção.`,
          { duration: 5000 }
        );
      }
    } catch (e) {
      console.error('Erro ao concluir trabalho da impressora:', e);
      toast.error('Erro ao registrar a conclusão da impressão.');
    } finally {
      setTimeout(() => {
        completingPrintersRef.current.delete(printer.id);
      }, 3000);
    }
  };

  const [nome, setNome] = useState('');
  const [modelo, setModelo] = useState('');
  const [potencia, setPotencia] = useState(350);
  const [bico, setBico] = useState(0.4);
  const [serviceInterval, setServiceInterval] = useState(100);
  const [precoCompra, setPrecoCompra] = useState<number | string>(5000); 
  const [vidaUtilHoras, setVidaUtilHoras] = useState<number | string>(5000); 

  useEffect(() => {
    const activePrinters = impressoras.filter(p => (p.status === 'imprimindo' || p.status === 'pausada') && p.projetoAtualId);
    if (activePrinters.length === 0) return;

    const syncTick = () => {
      const now = Date.now();
      const stored = readStoredTimers();
      let storedChanged = false;
      const nextSecs: Record<string, number> = {};
      const nextProgress: Record<string, number> = {};

      activePrinters.forEach(p => {
        const projectId = p.projetoAtualId!;
        const currentProject = projetos.find(proj => proj.id === projectId);
        const rawTempo = currentProject?.tempoEstimadoHoras ?? 18;
        const totalSecs = Math.max(1, parseAndSanitizeEstimatedSeconds(rawTempo));
        const dbProgress = Math.min(100, Math.max(0, Number(p.progressoPercentual ?? 0)));
        const defaultRemaining = Math.max(1, Math.round(totalSecs * (1 - dbProgress / 100)));

        let entry = stored[p.id];
        if (!entry || entry.projectId !== projectId || entry.totalSecs !== totalSecs) {
          entry = {
            projectId,
            totalSecs,
            targetEndMs: now + defaultRemaining * 1000,
            pausedRemainingSecs: p.status === 'pausada' ? defaultRemaining : undefined,
          };
          stored[p.id] = entry;
          storedChanged = true;
        } else if (p.status === 'pausada' && entry.pausedRemainingSecs === undefined) {
          entry.pausedRemainingSecs = Math.max(0, Math.round((entry.targetEndMs - now) / 1000));
          storedChanged = true;
        } else if (p.status === 'imprimindo' && entry.pausedRemainingSecs !== undefined) {
          entry.targetEndMs = now + entry.pausedRemainingSecs * 1000;
          delete entry.pausedRemainingSecs;
          storedChanged = true;
        }

        const remaining =
          p.status === 'pausada'
            ? (entry.pausedRemainingSecs ?? defaultRemaining)
            : Math.max(0, Math.round((entry.targetEndMs - now) / 1000));

        nextSecs[p.id] = remaining;
        const calcProgress = Number((((totalSecs - remaining) / totalSecs) * 100).toFixed(2));
        nextProgress[p.id] = Math.min(100, Math.max(0, calcProgress));

        if (p.status === 'imprimindo' && remaining <= 0) {
          void handleConcluirTrabalho(p, true);
        }
      });

      if (storedChanged) {
        writeStoredTimers(stored);
      }

      setRemainingSecondsMap(prev => ({ ...prev, ...nextSecs }));
      setProgressDraft(prev => ({ ...prev, ...nextProgress }));
    };

    syncTick();
    const interval = setInterval(syncTick, 1000);
    return () => clearInterval(interval);
  }, [impressoras, projetos, user?.id]);

  const counts = useMemo(() => ({
    active: impressoras.filter(item => item.status === 'disponivel' || item.status === 'imprimindo').length,
    paused: impressoras.filter(item => item.status === 'pausada').length,
    offline: impressoras.filter(item => item.status === 'desconectada').length,
    maintenance: impressoras.filter(item => item.status === 'manutencao').length,
  }), [impressoras]);

  const handleAdd = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!nome.trim() || potencia <= 0 || bico <= 0 || serviceInterval <= 0) return;
    
    const valorInvestimento = Number(precoCompra) || 0;
    const horasVidaUtil = Number(vidaUtilHoras) || 5000;
    const depreciacaoCalculada = horasVidaUtil > 0 ? Number((valorInvestimento / horasVidaUtil).toFixed(2)) : 0.50;

    const saved = addImpressora({ 
      nome: nome.trim(), 
      modelo: modelo.trim() || 'Impressora 3D', 
      tipo: 'FDM', 
      status: 'disponivel', 
      potenciaWatts: potencia, 
      bicoMm: bico, 
      horasUso: 0, 
      horasDesdeManutencao: 0, 
      intervaloManutencaoHoras: serviceInterval,
      custoInvestimento: valorInvestimento,
      vidaUtilHoras: horasVidaUtil,
      depreciacaoHora: depreciacaoCalculada
    });

    if (saved) { 
      setNome(''); 
      setModelo(''); 
      setShowAddForm(false); 
      toast.success(`Impressora cadastrada! Depreciação: R$ ${depreciacaoCalculada.toFixed(2)}/h`);
    }
  };

  const handleOpenEdit = (printer: Impressora3D) => {
    setEditingPrinterId(printer.id);
    setEditNome(printer.nome || '');
    setEditModelo(printer.modelo || '');
    setEditPotencia(printer.potenciaWatts || 350);
    setEditBico(printer.bicoMm || 0.4);
    setEditIntervaloManutencao(printer.intervaloManutencaoHoras || 100);
    setEditHorasUso(printer.horasUso ?? 0);
    
    const currentCustom = customInvestments[printer.id];
    setEditPrecoCompra(currentCustom && currentCustom.custoInvestimento > 0 ? currentCustom.custoInvestimento : (printer.custoInvestimento || 5000));
    setEditVidaUtil(currentCustom && currentCustom.vidaUtilHoras > 0 ? currentCustom.vidaUtilHoras : (printer.vidaUtilHoras || 5000));
  };

  const handleUpdate = (event: React.FormEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    if (!editingPrinterId) return;

    const valorInvestimento = parseFloat(String(editPrecoCompra)) || 0;
    const horasVidaUtil = parseFloat(String(editVidaUtil)) || 5000;
    const depreciacaoCalculada = horasVidaUtil > 0 ? Number((valorInvestimento / horasVidaUtil).toFixed(2)) : 0.50;
    const novoIntervaloManutencao = Math.max(1, Number(editIntervaloManutencao) || 100);
    const novasHorasUso = Math.max(0, Number(editHorasUso) || 0);

    const printerToUpdate = impressoras.find(p => p.id === editingPrinterId);
    if (!printerToUpdate) return;

    const updatedCustoms = {
      ...customInvestments,
      [editingPrinterId]: {
        custoInvestimento: valorInvestimento,
        vidaUtilHoras: horasVidaUtil,
        depreciacaoHora: depreciacaoCalculada
      }
    };

    setCustomInvestments(updatedCustoms);
    if (user?.id) {
      try {
        localStorage.setItem(`ph3d_printer_investments_v2_${user.id}`, JSON.stringify(updatedCustoms));
      } catch (e) {
        console.error('Erro ao salvar investimentos customizados no localStorage:', e);
      }
    }

    void updateImpressora(editingPrinterId, {
      nome: editNome.trim(),
      modelo: editModelo.trim(),
      potenciaWatts: Number(editPotencia) || 350,
      bicoMm: Number(editBico) || 0.4,
      intervaloManutencaoHoras: novoIntervaloManutencao,
      horasUso: novasHorasUso,
      custoInvestimento: valorInvestimento,
      vidaUtilHoras: horasVidaUtil,
      depreciacaoHora: depreciacaoCalculada,
    });

    toast.success('Dados, investimento e vida útil salvos com sucesso!');
    setEditingPrinterId(null);
  };

  const handleDelete = async (id: string, nomeImpressora: string) => {
    if (confirm(`Tem certeza que deseja excluir a impressora "${nomeImpressora}"?`)) {
      // 1. Apaga no Supabase / contexto global
      await deleteImpressora(id);

      // 2. Remove dos investimentos locais
      const newDeleted = [...deletedPrinterIds, id];
      setDeletedPrinterIds(newDeleted);

      const updatedCustoms = { ...customInvestments };
      delete updatedCustoms[id];
      setCustomInvestments(updatedCustoms);

      if (user?.id) {
        try {
          localStorage.setItem(`ph3d_deleted_printers_${user.id}`, JSON.stringify(newDeleted));
          localStorage.setItem(`ph3d_printer_investments_v2_${user.id}`, JSON.stringify(updatedCustoms));
        } catch (e) {
          console.error('Erro ao salvar impressoras excluídas no localStorage:', e);
        }
      }

      toast.success('Impressora excluída com sucesso.');
    }
  };

  const submitMaintenance = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!maintenancePrinter || !maintenanceTasks.length) { toast.error('Marque pelo menos uma tarefa realizada.'); return; }
    setSavingMaintenance(true);
    try {
      if (await recordMaintenance(maintenancePrinter, maintenanceTasks, maintenanceNote.trim())) {
        setMaintenancePrinter(null); setMaintenanceTasks([]); setMaintenanceNote('');
      }
    } finally { setSavingMaintenance(false); }
  };

  return <div className="space-y-6">
    <header className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
      <div><h2 className="flex items-center gap-2 text-xl font-bold text-white"><Cpu className="h-5 w-5 text-indigo-400" />Parque de Impressoras 3D</h2><p className="mt-1 text-sm text-slate-400">Acompanhe suas impressoras, produção e manutenções.</p></div>
      <Button onClick={() => setShowAddForm(value => !value)} className="rounded-xl bg-indigo-600 text-white hover:bg-indigo-500">{showAddForm ? <X className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}{showAddForm ? 'Fechar' : 'Adicionar impressora'}</Button>
    </header>

    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <SummaryCard 
        label="Ativas" 
        value={counts.active} 
        tone="emerald" 
        icon={CirclePower} 
        badge={counts.active > 0 ? "Em operação" : "Paradas"}
        detail="Disponíveis e imprimindo"
      />
      <SummaryCard 
        label="Pausadas" 
        value={counts.paused} 
        tone="amber" 
        icon={Pause} 
        badge={counts.paused > 0 ? "Interrompidas" : "Nenhuma pausa"}
        detail="Aguardando retomada manual"
      />
      <SummaryCard 
        label="Offline" 
        value={counts.offline} 
        tone="rose" 
        icon={CirclePower} 
        badge={counts.offline > 0 ? "Desconectadas" : "Rede 100% online"}
        detail="Sem sinal ou desligadas"
      />
      <SummaryCard 
        label="Manutenção" 
        value={counts.maintenance} 
        tone="orange" 
        icon={Wrench} 
        badge={counts.maintenance > 0 ? "Revisão pendente" : "Parque calibrado"}
        detail="Preventiva e calibração de bico"
      />
    </section>

    {showAddForm && <Card className="rounded-2xl border-slate-800 bg-slate-900 p-5">
      <h3 className="mb-4 font-bold text-white flex items-center gap-2"><DollarSign className="w-4 h-4 text-emerald-400"/> Cadastrar Impressora & Custo de Investimento</h3>
      <form onSubmit={handleAdd} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Nome da impressora"><Input required maxLength={100} placeholder="Ex.: BambuLab A1 Combo" value={nome} onChange={event => setNome(event.target.value)} className="border-slate-700 bg-slate-950 text-white" /></Field>
        <Field label="Fabricante / modelo"><Input maxLength={120} placeholder="Ex.: Bambu Lab A1" value={modelo} onChange={event => setModelo(event.target.value)} className="border-slate-700 bg-slate-950 text-white" /></Field>
        <Field label="Potência (W)"><Input type="number" min="1" value={potencia} onChange={event => setPotencia(Number(event.target.value))} className="border-slate-700 bg-slate-950 text-white" /></Field>
        <Field label="Bico (mm)"><Input type="number" min="0.1" step="0.1" value={bico} onChange={event => setBico(Number(event.target.value))} className="border-slate-700 bg-slate-950 text-white" /></Field>
        <Field label="Preço de Investimento / Compra (R$)"><Input type="number" min="0" step="0.01" placeholder="Ex: 5000.00" value={precoCompra} onChange={event => setPrecoCompra(event.target.value)} className="border-slate-700 bg-slate-950 text-white" /></Field>
        <Field label="Vida útil estimada (Horas de uso)"><Input type="number" min="100" step="100" placeholder="Ex: 5000" value={vidaUtilHoras} onChange={event => setVidaUtilHoras(event.target.value)} className="border-slate-700 bg-slate-950 text-white" /></Field>
        <Field label="Manutenção a cada (h)"><Input type="number" min="1" step="1" value={serviceInterval} onChange={event => setServiceInterval(Number(event.target.value))} className="border-slate-700 bg-slate-950 text-white" /></Field>
        <div className="flex items-end gap-2 lg:col-span-4 mt-2">
          <Button type="submit" className="bg-indigo-600 text-white hover:bg-indigo-500">Salvar impressora com ROI</Button>
          <Button type="button" variant="outline" onClick={() => setShowAddForm(false)} className="border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800 hover:text-white">Cancelar</Button>
        </div>
      </form>
    </Card>}

    {!impressoras.length && <Card className="rounded-2xl border-slate-800 bg-slate-900 p-8 text-center"><Cpu className="mx-auto h-8 w-8 text-slate-500" /><p className="mt-3 text-sm text-slate-300">Adicione sua primeira impressora para acompanhar a produção.</p></Card>}

    <section className="grid gap-4 xl:grid-cols-2">
      {impressoras.map(printer => {
        const status = STATUS[printer.status];
        const currentProject = projetos.find(project => project.id === printer.projetoAtualId);
        const progress = progressDraft[printer.id] ?? printer.progressoPercentual ?? 0;
        
        const rawTempoEstimado = currentProject?.tempoEstimadoHoras ?? 18;
        const totalSecondsEstimated = parseAndSanitizeEstimatedSeconds(rawTempoEstimado);
        const remainingPrintSeconds = remainingSecondsMap[printer.id] ?? Math.round(totalSecondsEstimated * (1 - (Math.min(100, Math.max(0, progress)) / 100)));
        const elapsedPrintSeconds =
          printer.projetoAtualId && (printer.status === 'imprimindo' || printer.status === 'pausada')
            ? Math.max(0, totalSecondsEstimated - remainingPrintSeconds)
            : 0;

        const baseUsageSeconds = parseAndSanitizeEstimatedSeconds(printer.horasUso);
        const effectiveUsageSeconds = baseUsageSeconds + elapsedPrintSeconds;

        const baseRemainingServiceSecs = Math.max(0, ((printer.intervaloManutencaoHoras || 100) - (printer.horasDesdeManutencao || 0)) * 3600);
        const effectiveRemainingServiceSecs = Math.max(0, baseRemainingServiceSecs - elapsedPrintSeconds);
        const remainingServiceHours = effectiveRemainingServiceSecs / 3600;
        const serviceDue = remainingServiceHours <= 0;
        const serviceSoon = remainingServiceHours > 0 && remainingServiceHours <= 10;

        const events = historicoImpressoras.filter(event => event.impressoraId === printer.id).slice(0, 5);
        const lastMaintenance = historicoImpressoras.find(event => event.impressoraId === printer.id && event.tipo === 'maintenance_completed');
        
        const customMeta = customInvestments[printer.id];
        const custoInvestimento = customMeta && customMeta.custoInvestimento > 0 ? customMeta.custoInvestimento : (printer.custoInvestimento && printer.custoInvestimento > 0 ? printer.custoInvestimento : 5000);
        const vidaUtil = customMeta && customMeta.vidaUtilHoras > 0 ? customMeta.vidaUtilHoras : (printer.vidaUtilHoras && printer.vidaUtilHoras > 0 ? printer.vidaUtilHoras : 5000);
        const depreciacaoH = customMeta && customMeta.depreciacaoHora > 0 ? customMeta.depreciacaoHora : (printer.depreciacaoHora && printer.depreciacaoHora > 0 ? printer.depreciacaoHora : (vidaUtil > 0 ? custoInvestimento / vidaUtil : 1.00));

        return <Card key={printer.id} className="space-y-4 rounded-2xl border-slate-800 bg-slate-900 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h3 className="truncate text-base font-bold text-white">🖨 {printer.nome}</h3>
              <p className="mt-1 text-xs text-slate-400">{printer.modelo} <span className="px-1">·</span> Bico {printer.bicoMm} mm <span className="px-1">·</span> {printer.potenciaWatts} W</p>
            </div>
            
            <div className="flex items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => handleOpenEdit(printer)} className="h-8 border-slate-700 bg-slate-950 text-indigo-300 hover:bg-indigo-950/40 text-xs">
                <Edit2 className="w-3.5 h-3.5 mr-1"/> Editar
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => handleDelete(printer.id, printer.nome)} className="h-8 border-slate-700 bg-slate-950 text-rose-400 hover:bg-rose-950/40 text-xs">
                <Trash2 className="w-3.5 h-3.5"/>
              </Button>
              <Badge variant="outline" className={`shrink-0 ${status.badge}`}><span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${status.dot}`} />{status.label}</Badge>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-indigo-950/20 border border-indigo-500/20 px-4 py-2.5 text-xs">
            <span className="text-indigo-300 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              Investimento: <strong className="text-white">R$ {Number(custoInvestimento).toFixed(2)}</strong> ({vidaUtil}h úteis)
            </span>
            <span className="text-slate-300">Depreciação: <strong className="text-emerald-400">R$ {depreciacaoH.toFixed(2)}/h</strong></span>
          </div>

          {printer.projetoAtualId ? (
            <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950 p-4">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Projeto atual</p>
                  <p className="mt-1 font-semibold text-white">{printer.projetoAtual || currentProject?.nomePeca || 'Projeto em andamento'}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-right text-xs text-slate-400">
                    <Clock3 className="mr-1 inline h-3.5 w-3.5 text-sky-400" />
                    ~{formatSecondsToTime(remainingPrintSeconds)} restantes
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleConcluirTrabalho(printer, false)}
                    title="Zerar tempo e concluir projeto agora"
                    className="h-7 px-2.5 text-[11px] font-semibold border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 hover:text-white rounded-lg transition-colors"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                    Zerar tempo & Dar baixa
                  </Button>
                </div>
              </div>

              <div>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-slate-400">Progresso informado</span>
                  <strong className="text-sky-300">{Number(progress).toFixed(1)}%</strong>
                </div>
                <Progress value={progress} className="h-2 bg-slate-800 [&>div]:bg-sky-500" />
                <input
                  aria-label={`Progresso de ${printer.nome}`}
                  type="range"
                  min="0"
                  max="100"
                  step="0.1"
                  value={progress}
                  onChange={event => {
                    const val = Number(event.target.value);
                    const newRemaining = Math.max(0, Math.round(totalSecondsEstimated * (1 - (val / 100))));
                    setProgressDraft(previous => ({ ...previous, [printer.id]: val }));
                    setRemainingSecondsMap(previous => ({ ...previous, [printer.id]: newRemaining }));
                    if (printer.projetoAtualId) {
                      const stored = readStoredTimers();
                      stored[printer.id] = {
                        projectId: printer.projetoAtualId,
                        totalSecs: Math.max(1, totalSecondsEstimated),
                        targetEndMs: Date.now() + newRemaining * 1000,
                        pausedRemainingSecs: printer.status === 'pausada' ? newRemaining : undefined,
                      };
                      writeStoredTimers(stored);
                    }
                  }}
                  onPointerUp={event => {
                    const value = Number(event.currentTarget.value);
                    if (value >= 100) {
                      void handleConcluirTrabalho(printer, false);
                    } else {
                      void updatePrinterProgress(printer.id, Math.round(value));
                    }
                  }}
                  onKeyUp={event => {
                    const value = Number(event.currentTarget.value);
                    if (value >= 100) {
                      void handleConcluirTrabalho(printer, false);
                    } else {
                      void updatePrinterProgress(printer.id, Math.round(value));
                    }
                  }}
                  disabled={!['imprimindo', 'pausada'].includes(printer.status)}
                  className="mt-2 w-full accent-sky-500 disabled:opacity-40"
                />
              </div>
              {currentProject && <p className="text-xs text-slate-400">Tempo previsto do projeto: {formatHours(currentProject.tempoEstimadoHoras)}</p>}
            </div>
          ) : (
            <div className="rounded-xl bg-slate-950 px-4 py-3 text-sm text-slate-400">Nenhum trabalho em produção.</div>
          )}

          <div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-slate-950 p-3"><p className="text-[11px] text-slate-500">Horas de impressão</p><p className="mt-1 font-semibold text-white">{formatSecondsToTime(effectiveUsageSeconds)}</p><p className="text-[10px] text-slate-500">{elapsedPrintSeconds > 0 ? 'Em produção + concluídos' : 'Estimadas em projetos concluídos'}</p></div><div className={`rounded-xl p-3 ${serviceDue ? 'bg-orange-500/10' : serviceSoon ? 'bg-amber-500/10' : 'bg-slate-950'}`}><p className="text-[11px] text-slate-500">Próxima manutenção</p><p className={`mt-1 font-semibold ${serviceDue ? 'text-orange-300' : serviceSoon ? 'text-amber-300' : 'text-white'}`}>{serviceDue ? 'Manutenção necessária' : `Em ${formatSecondsToTime(effectiveRemainingServiceSecs)}`}</p><p className="text-[10px] text-slate-500">Intervalo: {printer.intervaloManutencaoHoras || 100} h · Última: {lastMaintenance ? new Date(lastMaintenance.data).toLocaleDateString('pt-BR') : 'sem registro'}</p></div></div>

          <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-3">
            {printer.status === 'imprimindo' && (
              <>
                <Button size="sm" variant="outline" onClick={() => updateImpressoraStatus(printer.id, 'pausada')} className="border-slate-700 bg-slate-950 text-xs text-white hover:bg-slate-800">
                  <Pause className="mr-1.5 h-3.5 w-3.5" />Pausar
                </Button>
                <Button size="sm" onClick={() => handleConcluirTrabalho(printer, false)} className="bg-emerald-600 hover:bg-emerald-500 text-xs text-white font-bold shadow-md shadow-emerald-600/20">
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Concluir & Liberar Máquina
                </Button>
              </>
            )}
            {printer.status === 'pausada' && (
              <>
                <Button size="sm" onClick={() => updateImpressoraStatus(printer.id, 'imprimindo')} className="bg-sky-600 text-xs text-white hover:bg-sky-500">
                  <Play className="mr-1.5 h-3.5 w-3.5" />Retomar
                </Button>
                <Button size="sm" onClick={() => handleConcluirTrabalho(printer, false)} className="bg-emerald-600 hover:bg-emerald-500 text-xs text-white font-bold">
                  <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Concluir & Liberar Máquina
                </Button>
              </>
            )}
            {printer.status === 'disponivel' && <Link to="/cliente/projetos"><Button size="sm" className="bg-indigo-600 text-xs text-white hover:bg-indigo-500"><Play className="mr-1.5 h-3.5 w-3.5" />Iniciar impressão</Button></Link>}
            {printer.status === 'disponivel' && <Button size="sm" variant="outline" onClick={() => updateImpressoraStatus(printer.id, 'desconectada')} className="border-slate-700 bg-slate-950 text-xs text-slate-200 hover:bg-slate-800 hover:text-white">Marcar offline</Button>}
            {printer.status === 'disponivel' && <Button size="sm" variant="ghost" onClick={() => updateImpressoraStatus(printer.id, 'manutencao')} className="text-xs text-slate-300 hover:text-orange-300"><Wrench className="mr-1.5 h-3.5 w-3.5" />Iniciar manutenção</Button>}
            {printer.status === 'desconectada' && <Button size="sm" variant="outline" onClick={() => updateImpressoraStatus(printer.id, 'disponivel')} className="border-slate-700 bg-slate-950 text-xs text-white hover:bg-slate-800">Marcar disponível</Button>}
            {!printer.projetoAtualId && printer.status !== 'manutencao' && printer.status !== 'disponivel' && <Button size="sm" variant="ghost" onClick={() => updateImpressoraStatus(printer.id, 'manutencao')} className="text-xs text-slate-300 hover:text-orange-300"><Wrench className="mr-1.5 h-3.5 w-3.5" />Iniciar manutenção</Button>}
            {!printer.projetoAtualId && printer.status === 'manutencao' && <Button size="sm" variant="ghost" onClick={() => setMaintenancePrinter(printer.id)} className="text-xs text-orange-300 hover:text-orange-200"><Wrench className="mr-1.5 h-3.5 w-3.5" />Registrar manutenção concluída</Button>}
            {printer.projetoAtualId && <span className="self-center text-[11px] text-slate-500">Finalize ou cancele o projeto antes da manutenção.</span>}
          </div>

          {events.length > 0 && <div className="border-t border-slate-800 pt-3"><p className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-300"><History className="h-3.5 w-3.5" />Histórico recente</p><div className="space-y-2">{events.map(event => <div key={event.id} className="flex items-center justify-between gap-2 text-xs"><div className="min-w-0"><span className="text-slate-300">{event.tipo === 'project_completed' ? `Concluiu: ${String(event.payload.project_name || 'Projeto')}` : event.tipo === 'maintenance_completed' ? 'Manutenção registrada' : `Status: ${STATUS[String(event.payload.to) as Impressora3D['status']]?.label || event.payload.to || 'atualizado'}${event.payload.project ? ` (${String(event.payload.project)})` : ''}`}</span>{event.tipo === 'maintenance_completed' && Array.isArray(event.payload.tasks) && <p className="truncate text-[10px] text-slate-500">{(event.payload.tasks as string[]).join(' · ')}</p>}</div><span className="shrink-0 text-slate-500">{new Date(event.data).toLocaleDateString('pt-BR')}{event.tipo === 'project_completed' ? ` · ${formatHours(Number(event.payload.hours || 0))}` : ''}</span></div>)}</div></div>}
          {(serviceDue || serviceSoon) && <p className={`flex items-center gap-2 text-xs ${serviceDue ? 'text-orange-300' : 'text-amber-300'}`}><AlertTriangle className="h-4 w-4" />{serviceDue ? 'Manutenção no intervalo atingido.' : 'Manutenção próxima.'}</p>}
        </Card>;
      })}
    </section>

    {/* MODAL DE EDIÇÃO DA IMPRESSORA */}
    {editingPrinterId && (
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-3 sm:p-6" onClick={() => setEditingPrinterId(null)}>
        <div className="w-full max-w-lg space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5 sm:p-6" onClick={e => e.stopPropagation()}>
          <div className="flex items-start justify-between">
            <h3 className="font-bold text-white">Editar Impressora & Custos</h3>
            <Button type="button" variant="ghost" size="icon" onClick={() => setEditingPrinterId(null)}><X className="h-4 w-4" /></Button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nome"><Input value={editNome} onChange={e => setEditNome(e.target.value)} className="bg-slate-950 text-white border-slate-700" /></Field>
            <Field label="Modelo"><Input value={editModelo} onChange={e => setEditModelo(e.target.value)} className="bg-slate-950 text-white border-slate-700" /></Field>
            <Field label="Potência (W)"><Input type="number" value={editPotencia} onChange={e => setEditPotencia(e.target.value)} className="bg-slate-950 text-white border-slate-700" /></Field>
            <Field label="Bico (mm)"><Input type="number" step="0.1" value={editBico} onChange={e => setEditBico(e.target.value)} className="bg-slate-950 text-white border-slate-700" /></Field>
            <Field label="Preço Investimento (R$)"><Input type="number" step="0.01" value={editPrecoCompra} onChange={e => setEditPrecoCompra(e.target.value)} className="bg-slate-950 text-white border-slate-700" /></Field>
            <Field label="Vida útil (Horas)"><Input type="number" step="100" value={editVidaUtil} onChange={e => setEditVidaUtil(e.target.value)} className="bg-slate-950 text-white border-slate-700" /></Field>
            <Field label="Manutenção a cada (h)"><Input type="number" min="1" step="1" value={editIntervaloManutencao} onChange={e => setEditIntervaloManutencao(e.target.value)} className="bg-slate-950 text-white border-slate-700" /></Field>
            <Field label="Horas de impressão acumuladas"><Input type="number" min="0" step="0.5" value={editHorasUso} onChange={e => setEditHorasUso(e.target.value)} className="bg-slate-950 text-white border-slate-700" /></Field>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setEditingPrinterId(null)} className="border-slate-700 bg-slate-950 text-slate-200">Cancelar</Button>
            <Button type="button" onClick={handleUpdate} className="bg-indigo-600 text-white hover:bg-indigo-500">Salvar Alterações</Button>
          </div>
        </div>
      </div>
    )}

    {maintenancePrinter && <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/80 p-3 sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget && !savingMaintenance) setMaintenancePrinter(null); }}><form onSubmit={submitMaintenance} className="my-auto w-full max-w-lg space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5 sm:p-6"><div className="flex items-start justify-between"><div><h3 className="font-bold text-white">Registrar manutenção</h3><p className="text-sm text-slate-400">{impressoras.find(item => item.id === maintenancePrinter)?.nome}</p></div><Button type="button" variant="ghost" size="icon" onClick={() => setMaintenancePrinter(null)}><X className="h-4 w-4" /></Button></div><fieldset className="space-y-2"><legend className="mb-2 text-xs font-semibold text-slate-300">O que foi feito?</legend>{MAINTENANCE_TASKS.map(task => <label key={task} className="flex items-center gap-3 rounded-lg bg-slate-950 px-3 py-2.5 text-sm text-slate-200"><input type="checkbox" checked={maintenanceTasks.includes(task)} onChange={event => setMaintenanceTasks(previous => event.target.checked ? [...previous, task] : previous.filter(value => value !== task))} className="accent-indigo-500" />{task}</label>)}</fieldset><label className="block text-xs text-slate-300">Observação<textarea rows={3} value={maintenanceNote} onChange={event => setMaintenanceNote(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white" placeholder="Detalhes opcionais" /></label><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setMaintenancePrinter(null)} className="border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800 hover:text-white">Cancelar</Button><Button type="submit" disabled={savingMaintenance} className="bg-indigo-600 text-white hover:bg-indigo-500">{savingMaintenance ? 'Salvando…' : 'Registrar manutenção'}</Button></div></form></div>}
  </div>;
};

interface SummaryCardProps {
  label: string;
  value: number;
  tone: 'emerald' | 'amber' | 'rose' | 'orange';
  icon: typeof Cpu;
  badge?: string;
  detail?: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({ label, value, tone, icon: Icon, badge, detail }) => {
  const toneMap = {
    emerald: {
      border: 'border-emerald-500/30 hover:border-emerald-500/60',
      iconBox: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
      badge: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
    },
    amber: {
      border: 'border-amber-500/30 hover:border-amber-500/60',
      iconBox: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
      badge: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
    },
    rose: {
      border: 'border-rose-500/30 hover:border-rose-500/60',
      iconBox: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
      badge: 'bg-rose-500/10 border-rose-500/30 text-rose-300',
    },
    orange: {
      border: 'border-orange-500/30 hover:border-orange-500/60',
      iconBox: 'bg-orange-500/10 border-orange-500/20 text-orange-400',
      badge: 'bg-orange-500/10 border-orange-500/30 text-orange-300',
    },
  };
  const theme = toneMap[tone];

  return (
    <Card className={`bg-slate-900 border ${theme.border} rounded-2xl shadow-lg transition-all`}>
      <div className="p-5 flex flex-col justify-between h-full space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg border ${theme.iconBox}`}>
              <Icon className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{label}</span>
          </div>
          {badge && (
            <Badge className={`${theme.badge} text-[10px] px-2 py-0.5 font-bold`}>
              {badge}
            </Badge>
          )}
        </div>
        <div>
          <p className="text-2xl lg:text-3xl font-black text-white tracking-tight">{value}</p>
        </div>
        {detail && (
          <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
            <span>{detail}</span>
          </div>
        )}
      </div>
    </Card>
  );
};
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => <label className="block space-y-1 text-xs text-slate-300">{label}{children}</label>;