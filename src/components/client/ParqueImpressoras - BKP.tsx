"use client";

import React, { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, ArrowRight, CheckCircle2, CirclePower, Clock3, Cpu, History, Pause, Play, Plus, Wrench, X } from 'lucide-react';
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
    if (numericValue > 1000 && !String(inputTime).includes('.')) {
      totalSeconds = numericValue;
    } else {
      totalSeconds = Math.round(numericValue * 3600);
    }
  }

  if (totalSeconds > 720 * 3600 || isNaN(totalSeconds) || totalSeconds < 0) {
    totalSeconds = 18 * 3600; 
  }

  return totalSeconds;
};

const formatSecondsToTime = (totalSeconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  return `${hours}h${String(minutes).padStart(2, '0')}m${String(seconds).padStart(2, '0')}s`;
};

const formatHours = (inputTime: number | string) => {
  const totalSeconds = parseAndSanitizeEstimatedSeconds(inputTime);
  return formatSecondsToTime(totalSeconds);
};

export const ParqueImpressoras: React.FC = () => {
  const { impressoras, projetos, historicoImpressoras, addImpressora, updateImpressoraStatus, updatePrinterProgress, recordMaintenance } = useSaaSData();
  const [showAddForm, setShowAddForm] = useState(false);
  const [maintenancePrinter, setMaintenancePrinter] = useState<string | null>(null);
  const [maintenanceTasks, setMaintenanceTasks] = useState<string[]>([]);
  const [maintenanceNote, setMaintenanceNote] = useState('');
  const [savingMaintenance, setSavingMaintenance] = useState(false);
  const [progressDraft, setProgressDraft] = useState<Record<string, number>>({});
  
  // Estado para controlar os segundos restantes de forma autónoma por impressora
  const [remainingSecondsMap, setRemainingSecondsMap] = useState<Record<string, number>>({});

  const [nome, setNome] = useState('');
  const [modelo, setModelo] = useState('');
  const [potencia, setPotencia] = useState(350);
  const [bico, setBico] = useState(0.4);
  const [serviceInterval, setServiceInterval] = useState(100);

  // Sincronizar e decrementar os segundos ativamente a cada segundo
  useEffect(() => {
    const printingPrinters = impressoras.filter(p => p.status === 'imprimindo');
    if (printingPrinters.length === 0) return;

    // Inicializar os segundos restantes caso ainda não existam no estado local
    setRemainingSecondsMap(prev => {
      const next = { ...prev };
      let changed = false;
      printingPrinters.forEach(p => {
        if (next[p.id] === undefined) {
          const currentProject = projetos.find(proj => proj.id === p.projetoAtualId);
          const rawTempo = currentProject?.tempoEstimadoHoras ?? 18;
          const totalSecs = parseAndSanitizeEstimatedSeconds(rawTempo);
          const progress = p.progressoPercentual ?? 0;
          next[p.id] = Math.round(totalSecs * (1 - (progress / 100)));
          changed = true;
        }
      });
      return changed ? next : prev;
    });

    const interval = setInterval(() => {
      setProgressDraft(prevProgress => {
        const nextProgress = { ...prevProgress };
        let progressChanged = false;

        setRemainingSecondsMap(prevSecs => {
          const nextSecs = { ...prevSecs };
          let secsChanged = false;

          printingPrinters.forEach(p => {
            // Decrementar 1 segundo de forma estritamente sequencial
            const currentSecs = nextSecs[p.id];
            if (currentSecs !== undefined && currentSecs > 0) {
              nextSecs[p.id] = currentSecs - 1;
              secsChanged = true;

              // Atualizar também o progresso proporcionalmente para manter a barra sincronizada
              const currentProject = projetos.find(proj => proj.id === p.projetoAtualId);
              const totalSecs = parseAndSanitizeEstimatedSeconds(currentProject?.tempoEstimadoHoras ?? 18);
              if (totalSecs > 0) {
                const calculatedProgress = Number((((totalSecs - nextSecs[p.id]) / totalSecs) * 100).toFixed(2));
                nextProgress[p.id] = Math.min(100, calculatedProgress);
                progressChanged = true;
              }
            }
          });

          return secsChanged ? nextSecs : prevSecs;
        });

        return progressChanged ? nextProgress : prevProgress;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [impressoras, projetos]);

  const counts = useMemo(() => ({
    active: impressoras.filter(item => item.status === 'disponivel' || item.status === 'imprimindo').length,
    paused: impressoras.filter(item => item.status === 'pausada').length,
    offline: impressoras.filter(item => item.status === 'desconectada').length,
    maintenance: impressoras.filter(item => item.status === 'manutencao').length,
  }), [impressoras]);

  const handleAdd = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!nome.trim() || potencia <= 0 || bico <= 0 || serviceInterval <= 0) return;
    const saved = addImpressora({ nome: nome.trim(), modelo: modelo.trim() || 'Impressora 3D', tipo: 'FDM', status: 'disponivel', potenciaWatts: potencia, bicoMm: bico, horasUso: 0, horasDesdeManutencao: 0, intervaloManutencaoHoras: serviceInterval });
    if (saved) { setNome(''); setModelo(''); setShowAddForm(false); }
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
      <SummaryCard label="Ativas" value={counts.active} tone="emerald" icon={CirclePower} />
      <SummaryCard label="Pausadas" value={counts.paused} tone="amber" icon={Pause} />
      <SummaryCard label="Offline" value={counts.offline} tone="rose" icon={CirclePower} />
      <SummaryCard label="Manutenção" value={counts.maintenance} tone="orange" icon={Wrench} />
    </section>

    {showAddForm && <Card className="rounded-2xl border-slate-800 bg-slate-900 p-5"><h3 className="mb-4 font-bold text-white">Cadastrar impressora</h3><form onSubmit={handleAdd} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      <Field label="Nome da impressora"><Input required maxLength={100} placeholder="Ex.: BambuLab A1 Combo" value={nome} onChange={event => setNome(event.target.value)} className="border-slate-700 bg-slate-950 text-white" /></Field>
      <Field label="Fabricante / modelo"><Input maxLength={120} placeholder="Ex.: Bambu Lab A1" value={modelo} onChange={event => setModelo(event.target.value)} className="border-slate-700 bg-slate-950 text-white" /></Field>
      <Field label="Potência (W)"><Input type="number" min="1" value={potencia} onChange={event => setPotencia(Number(event.target.value))} className="border-slate-700 bg-slate-950 text-white" /></Field>
      <Field label="Bico (mm)"><Input type="number" min="0.1" step="0.1" value={bico} onChange={event => setBico(Number(event.target.value))} className="border-slate-700 bg-slate-950 text-white" /></Field>
      <Field label="Manutenção a cada (h)"><Input type="number" min="1" step="1" value={serviceInterval} onChange={event => setServiceInterval(Number(event.target.value))} className="border-slate-700 bg-slate-950 text-white" /></Field>
      <div className="flex items-end gap-2 lg:col-span-5"><Button type="submit" className="bg-indigo-600 text-white hover:bg-indigo-500">Salvar impressora</Button><Button type="button" variant="outline" onClick={() => setShowAddForm(false)} className="border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800 hover:text-white">Cancelar</Button></div>
    </form></Card>}

    {!impressoras.length && <Card className="rounded-2xl border-slate-800 bg-slate-900 p-8 text-center"><Cpu className="mx-auto h-8 w-8 text-slate-500" /><p className="mt-3 text-sm text-slate-300">Adicione sua primeira impressora para acompanhar a produção.</p></Card>}

    <section className="grid gap-4 xl:grid-cols-2">
      {impressoras.map(printer => {
        const status = STATUS[printer.status];
        const remainingService = Math.max(0, (printer.intervaloManutencaoHoras || 100) - (printer.horasDesdeManutencao || 0));
        const serviceDue = remainingService <= 0;
        const serviceSoon = remainingService > 0 && remainingService <= 10;
        const currentProject = projetos.find(project => project.id === printer.projetoAtualId);
        const progress = progressDraft[printer.id] ?? printer.progressoPercentual ?? 0;
        
        const rawTempoEstimado = currentProject?.tempoEstimadoHoras ?? 18;
        const totalSecondsEstimated = parseAndSanitizeEstimatedSeconds(rawTempoEstimado);

        // Obter os segundos restantes diretamente do mapa autónomo ou calcular se não existir
        const remainingPrintSeconds = remainingSecondsMap[printer.id] ?? Math.round(totalSecondsEstimated * (1 - (Math.min(100, Math.max(0, progress)) / 100)));

        const events = historicoImpressoras.filter(event => event.impressoraId === printer.id).slice(0, 5);
        const lastMaintenance = historicoImpressoras.find(event => event.impressoraId === printer.id && event.tipo === 'maintenance_completed');
        return <Card key={printer.id} className="space-y-4 rounded-2xl border-slate-800 bg-slate-900 p-5">
          <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate text-base font-bold text-white">🖨 {printer.nome}</h3><p className="mt-1 text-xs text-slate-400">{printer.modelo} <span className="px-1">·</span> Bico {printer.bicoMm} mm <span className="px-1">·</span> {printer.potenciaWatts} W</p></div><Badge variant="outline" className={`shrink-0 ${status.badge}`}><span className={`mr-1.5 h-1.5 w-1.5 rounded-full ${status.dot}`} />{status.label}</Badge></div>

          {printer.projetoAtualId ? <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950 p-4"><div className="flex items-start justify-between gap-2"><div><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Projeto atual</p><p className="mt-1 font-semibold text-white">{printer.projetoAtual || currentProject?.nomePeca || 'Projeto em andamento'}</p></div><span className="shrink-0 text-right text-xs text-slate-400"><Clock3 className="mr-1 inline h-3.5 w-3.5" />~{formatSecondsToTime(remainingPrintSeconds)} restantes</span></div>
            <div><div className="mb-1 flex justify-between text-xs"><span className="text-slate-400">Progresso informado</span><strong className="text-sky-300">{Number(progress).toFixed(1)}%</strong></div><Progress value={progress} className="h-2 bg-slate-800 [&>div]:bg-sky-500" /><input aria-label={`Progresso de ${printer.nome}`} type="range" min="0" max="100" step="0.1" value={progress} onChange={event => { const val = Number(event.target.value); setProgressDraft(previous => ({ ...previous, [printer.id]: val })); setRemainingSecondsMap(previous => ({ ...previous, [printer.id]: Math.round(totalSecondsEstimated * (1 - (val / 100))) })); }} onPointerUp={event => { const value = Number(event.currentTarget.value); void updatePrinterProgress(printer.id, value).then(saved => { if (saved) setProgressDraft(previous => { const next = { ...previous }; delete next[printer.id]; return next; }); }); }} onKeyUp={event => { const value = Number(event.currentTarget.value); void updatePrinterProgress(printer.id, value); }} disabled={!['imprimindo', 'pausada'].includes(printer.status)} className="mt-2 w-full accent-sky-500 disabled:opacity-40" /></div>
            {currentProject && <p className="text-xs text-slate-400">Tempo previsto do projeto: {formatHours(currentProject.tempoEstimadoHoras)}</p>}
          </div> : <div className="rounded-xl bg-slate-950 px-4 py-3 text-sm text-slate-400">Nenhum trabalho em produção.</div>}

          <div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-slate-950 p-3"><p className="text-[11px] text-slate-500">Horas de impressão</p><p className="mt-1 font-semibold text-white">{formatHours(printer.horasUso)}</p><p className="text-[10px] text-slate-500">Estimadas em projetos concluídos</p></div><div className={`rounded-xl p-3 ${serviceDue ? 'bg-orange-500/10' : serviceSoon ? 'bg-amber-500/10' : 'bg-slate-950'}`}><p className="text-[11px] text-slate-500">Próxima manutenção</p><p className={`mt-1 font-semibold ${serviceDue ? 'text-orange-300' : serviceSoon ? 'text-amber-300' : 'text-white'}`}>{serviceDue ? 'Manutenção necessária' : `Em ${formatHours(remainingService)}`}</p><p className="text-[10px] text-slate-500">Intervalo: {printer.intervaloManutencaoHoras || 100} h · Última: {lastMaintenance ? new Date(lastMaintenance.data).toLocaleDateString('pt-BR') : 'sem registro'}</p></div></div>

          <div className="flex flex-wrap gap-2 border-t border-slate-800 pt-3">
            {printer.status === 'imprimindo' && <Button size="sm" variant="outline" onClick={() => updateImpressoraStatus(printer.id, 'pausada')} className="border-slate-700 bg-slate-950 text-xs text-white hover:bg-slate-800"><Pause className="mr-1.5 h-3.5 w-3.5" />Pausar</Button>}
            {printer.status === 'pausada' && <Button size="sm" onClick={() => updateImpressoraStatus(printer.id, 'imprimindo')} className="bg-sky-600 text-xs text-white hover:bg-sky-500"><Play className="mr-1.5 h-3.5 w-3.5" />Retomar</Button>}
            {printer.status === 'disponivel' && <Link to="/cliente/projetos"><Button size="sm" className="bg-indigo-600 text-xs text-white hover:bg-indigo-500"><Play className="mr-1.5 h-3.5 w-3.5" />Iniciar impressão</Button></Link>}
            {printer.status === 'disponivel' && <Button size="sm" variant="outline" onClick={() => updateImpressoraStatus(printer.id, 'desconectada')} className="border-slate-700 bg-slate-950 text-xs text-slate-200 hover:bg-slate-800 hover:text-white">Marcar offline</Button>}
            {printer.status === 'desconectada' && <Button size="sm" variant="outline" onClick={() => updateImpressoraStatus(printer.id, 'disponivel')} className="border-slate-700 bg-slate-950 text-xs text-white hover:bg-slate-800">Marcar disponível</Button>}
            {!printer.projetoAtualId && printer.status !== 'manutencao' && <Button size="sm" variant="ghost" onClick={() => updateImpressoraStatus(printer.id, 'manutencao')} className="text-xs text-slate-300 hover:text-orange-300"><Wrench className="mr-1.5 h-3.5 w-3.5" />Iniciar manutenção</Button>}
            {!printer.projetoAtualId && printer.status === 'manutencao' && <Button size="sm" variant="ghost" onClick={() => setMaintenancePrinter(printer.id)} className="text-xs text-orange-300 hover:text-orange-200"><Wrench className="mr-1.5 h-3.5 w-3.5" />Registrar manutenção concluída</Button>}
            {printer.projetoAtualId && <span className="self-center text-[11px] text-slate-500">Finalize ou cancele o projeto antes da manutenção.</span>}
          </div>

          {events.length > 0 && <div className="border-t border-slate-800 pt-3"><p className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-300"><History className="h-3.5 w-3.5" />Histórico recente</p><div className="space-y-2">{events.map(event => <div key={event.id} className="flex items-center justify-between gap-2 text-xs"><div className="min-w-0"><span className="text-slate-300">{event.tipo === 'project_completed' ? `Concluiu: ${String(event.payload.project_name || 'Projeto')}` : event.tipo === 'maintenance_completed' ? 'Manutenção registrada' : `Status: ${STATUS[String(event.payload.to) as Impressora3D['status']]?.label || event.payload.to || 'atualizado'}`}</span>{event.tipo === 'maintenance_completed' && Array.isArray(event.payload.tasks) && <p className="truncate text-[10px] text-slate-500">{(event.payload.tasks as string[]).join(' · ')}</p>}</div><span className="shrink-0 text-slate-500">{new Date(event.data).toLocaleDateString('pt-BR')}{event.tipo === 'project_completed' ? ` · ${formatHours(Number(event.payload.hours || 0))}` : ''}</span></div>)}</div></div>}
          {(serviceDue || serviceSoon) && <p className={`flex items-center gap-2 text-xs ${serviceDue ? 'text-orange-300' : 'text-amber-300'}`}><AlertTriangle className="h-4 w-4" />{serviceDue ? 'Manutenção no intervalo atingido.' : 'Manutenção próxima.'}</p>}
        </Card>;
      })}
    </section>

    {maintenancePrinter && <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/80 p-3 sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget && !savingMaintenance) setMaintenancePrinter(null); }}><form onSubmit={submitMaintenance} className="my-auto w-full max-w-lg space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5 sm:p-6"><div className="flex items-start justify-between"><div><h3 className="font-bold text-white">Registrar manutenção</h3><p className="text-sm text-slate-400">{impressoras.find(item => item.id === maintenancePrinter)?.nome}</p></div><Button type="button" variant="ghost" size="icon" onClick={() => setMaintenancePrinter(null)}><X className="h-4 w-4" /></Button></div><fieldset className="space-y-2"><legend className="mb-2 text-xs font-semibold text-slate-300">O que foi feito?</legend>{MAINTENANCE_TASKS.map(task => <label key={task} className="flex items-center gap-3 rounded-lg bg-slate-950 px-3 py-2.5 text-sm text-slate-200"><input type="checkbox" checked={maintenanceTasks.includes(task)} onChange={event => setMaintenanceTasks(previous => event.target.checked ? [...previous, task] : previous.filter(value => value !== task))} className="accent-indigo-500" />{task}</label>)}</fieldset><label className="block text-xs text-slate-300">Observação<textarea rows={3} value={maintenanceNote} onChange={event => setMaintenanceNote(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white" placeholder="Detalhes opcionais" /></label><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setMaintenancePrinter(null)} className="border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800 hover:text-white">Cancelar</Button><Button type="submit" disabled={savingMaintenance} className="bg-indigo-600 text-white hover:bg-indigo-500">{savingMaintenance ? 'Salvando…' : 'Registrar manutenção'}</Button></div></form></div>}
  </div>;
};

const SummaryCard: React.FC<{ label: string; value: number; tone: 'emerald' | 'amber' | 'rose' | 'orange'; icon: typeof Cpu }> = ({ label, value, tone, icon: Icon }) => {
  const colors = { emerald: 'text-emerald-400 bg-emerald-500/10', amber: 'text-amber-400 bg-amber-500/10', rose: 'text-rose-400 bg-rose-500/10', orange: 'text-orange-400 bg-orange-500/10' };
  return <Card className="rounded-2xl border-slate-800 bg-slate-900 p-4"><div className="flex items-center justify-between"><span className="text-sm text-slate-400">{label}</span><span className={`rounded-lg p-2 ${colors[tone]}`}><Icon className="h-4 w-4" /></span></div><p className="mt-2 text-2xl font-black text-white">{value}</p></Card>;
};
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => <label className="block space-y-1 text-xs text-slate-300">{label}{children}</label>;