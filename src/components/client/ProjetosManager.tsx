"use client";

import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ArrowRight, Box, Calculator, Check, Clock3, Copy, Eye, FileText, FolderKanban, ImagePlus, MoreHorizontal, Pencil, Play, Plus, RefreshCw, Search, Trash2, UserRound, Weight, X } from 'lucide-react';
import { useSaaSData } from '@/context/SaaSDataContext';
import { OrcamentoPdfModal } from './OrcamentoPdfModal';
import { toast } from 'sonner';
import { ProjetoImpressao3D } from '@/types/saas';
import { createModelSignedUrl, uploadModelFile } from '@/services/fileService';
import { useAuth } from '@/context/AuthContext';

const ModelPreview = lazy(() => import('./ModelPreview').then(module => ({ default: module.ModelPreview })));
const money = (value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const statusLabel: Record<ProjetoImpressao3D['status'], string> = { orcamento: 'Orçamento · aguardando aprovação', aprovado: 'Aprovado · aguardando produção', em_impressao: 'Em produção', concluido: 'Concluído', cancelado: 'Cancelado' };
const statusClass: Record<ProjetoImpressao3D['status'], string> = {
  orcamento: 'border-amber-500/30 bg-amber-500/10 text-amber-300', aprovado: 'border-sky-500/30 bg-sky-500/10 text-sky-300',
  em_impressao: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300', concluido: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300', cancelado: 'border-slate-700 bg-slate-800 text-slate-400',
};

// Formatação rigorosa de horas decimais para HHhMMmSSs
const formatHours = (decimalHours: number) => {
  const safeValue = Math.max(0, decimalHours);
  const hours = Math.floor(safeValue);
  const minutes = Math.round((safeValue - hours) * 60);
  const seconds = 0;

  return `${hours}h${String(minutes).padStart(2, '0')}m${String(seconds).padStart(2, '0')}s`;
};

const useSignedImage = (path?: string) => {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let active = true;
    if (!path) { setUrl(''); return; }
    void createModelSignedUrl(path).then(value => { if (active) setUrl(value); }).catch(() => { if (active) setUrl(''); });
    return () => { active = false; };
  }, [path]);
  return url;
};

const ProjectCard: React.FC<{
  project: ProjetoImpressao3D; printerName?: string; printerCanStart?: boolean;
  onView: (project: ProjetoImpressao3D) => void; onEdit: (project: ProjetoImpressao3D) => void;
  onDelete: (project: ProjetoImpressao3D) => void; onPdf: (project: ProjetoImpressao3D) => void;
  onStatus: (id: string, status: ProjetoImpressao3D['status']) => void;
  onStartWithPrinter: (project: ProjetoImpressao3D) => void;
}> = ({ project, printerName, printerCanStart, onView, onEdit, onDelete, onPdf, onStatus, onStartWithPrinter }) => {
  const image = useSignedImage(project.imagemPath);
  const materials = project.materials || [];
  const reference = project.id.replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase();
  const canStart = project.status === 'aprovado' && Boolean(project.impressoraId) && Boolean(printerCanStart);
  const deadline = project.dataEntrega ? new Date(`${project.dataEntrega}T00:00:00`) : undefined;
  const late = Boolean(deadline && deadline < new Date(new Date().toDateString()) && !['concluido', 'cancelado'].includes(project.status));
  return <Card className="overflow-hidden rounded-2xl border-slate-800 bg-slate-900">
    <button type="button" onClick={() => onView(project)} aria-label={`Abrir projeto ${project.nomePeca}`} className="group relative flex h-48 w-full items-center justify-center overflow-hidden bg-slate-950">
      {image ? <img src={image} alt={`Imagem de ${project.nomePeca}`} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" /> : <div className="flex flex-col items-center gap-2 text-slate-500"><Box className="h-9 w-9" /><span className="text-xs">Imagem ou modelo 3D não anexado</span></div>}
      <Badge variant="outline" className={`absolute left-3 top-3 backdrop-blur ${statusClass[project.status]}`}>{statusLabel[project.status]}</Badge>
    </button>
    <div className="space-y-4 p-4">
      <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="truncate font-bold text-white">{project.nomePeca}</h3><p className="mt-1 text-xs text-slate-400">Projeto #{reference} · Cliente: {project.clienteNome || 'Não informado'}</p></div><details className="relative shrink-0"><summary aria-label="Mais ações" className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-white"><MoreHorizontal className="h-4 w-4" /></summary><div className="absolute right-0 z-20 mt-1 w-48 rounded-xl border border-slate-700 bg-slate-950 p-1 shadow-xl"><button onClick={() => onEdit(project)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-800"><Pencil className="h-3.5 w-3.5" />Editar projeto</button><button onClick={() => onPdf(project)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-slate-200 hover:bg-slate-800"><FileText className="h-3.5 w-3.5" />Gerar proposta</button><button onClick={() => onDelete(project)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-rose-300 hover:bg-rose-500/10"><Trash2 className="h-3.5 w-3.5" />Excluir projeto</button></div></details></div>
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-300">
        <span>{project.quantidade || 1} {project.quantidade === 1 ? 'peça' : 'peças'}</span>
        <span><Weight className="mr-1 inline h-3.5 w-3.5 text-slate-500" />{project.pesoEstimadoG} g</span>
        <span><Clock3 className="mr-1 inline h-3.5 w-3.5 text-slate-500" />{formatHours(project.tempoEstimadoHoras)}</span>
        <span>{materials.length ? materials.map(item => `${item.filamentType} ${item.color}`).join(' + ') : 'Material não informado'}</span>
        {project.formaPagamento && (
          <span className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-emerald-400 border border-slate-700">
            {project.formaPagamento === 'pix' && '⚡ Pix'}
            {project.formaPagamento === 'credito' && `💳 Crédito ${project.parcelasCartao && project.parcelasCartao > 1 ? `${project.parcelasCartao}x` : '1x'}`}
            {project.formaPagamento === 'debito' && '💳 Débito'}
            {project.formaPagamento === 'dinheiro' && '💵 Dinheiro'}
          </span>
        )}
      </div>
      {deadline && <p className={`text-xs ${late ? 'font-semibold text-rose-300' : 'text-slate-400'}`}>{late ? 'Atrasado · ' : 'Entrega prevista · '}{deadline.toLocaleDateString('pt-BR')}</p>}
      <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-950 p-3"><MoneyCell label="Custo estimado" value={money(project.custoTotal)} /><MoneyCell label="Preço de venda" value={money(project.precoCobrado)} /><MoneyCell label="Lucro estimado" value={money(project.lucroLiquido)} highlight /></div>
      <div className={`flex items-center gap-2 text-xs ${project.impressoraId ? 'text-slate-400' : ['aprovado', 'em_impressao'].includes(project.status) ? 'text-amber-300' : 'text-slate-500'}`}>{!project.impressoraId && ['aprovado', 'em_impressao'].includes(project.status) && <AlertTriangle className="h-3.5 w-3.5" />}Impressora: {printerName || (project.status === 'orcamento' ? 'A definir na aprovação' : 'Não definida')}</div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-3"><Button size="sm" onClick={() => onView(project)} className="bg-indigo-600 text-xs text-white hover:bg-indigo-500"><Eye className="mr-1.5 h-3.5 w-3.5" />Abrir projeto</Button>
        {project.status === 'orcamento' && <Button size="sm" onClick={() => onStatus(project.id, 'aprovado')} className="bg-emerald-600 text-xs text-white hover:bg-emerald-500"><Check className="mr-1.5 h-3.5 w-3.5" />Aprovar orçamento</Button>}
        {project.status === 'aprovado' && (canStart ? <Button size="sm" onClick={() => onStatus(project.id, 'em_impressao')} className="bg-sky-600 text-xs text-white hover:bg-sky-500"><Play className="mr-1.5 h-3.5 w-3.5" />Iniciar produção</Button> : <Button size="sm" onClick={() => onStartWithPrinter(project)} className="bg-sky-600 text-xs text-white hover:bg-sky-500"><Play className="mr-1.5 h-3.5 w-3.5" />Escolher impressora & Iniciar</Button>)}
        {project.status === 'em_impressao' && <Button size="sm" onClick={() => onStatus(project.id, 'concluido')} className="bg-indigo-600 text-xs text-white hover:bg-indigo-500"><Check className="mr-1.5 h-3.5 w-3.5" />Marcar como concluído</Button>}
      </div>
    </div>
  </Card>;
};

const MoneyCell: React.FC<{ label: string; value: string; highlight?: boolean }> = ({ label, value, highlight }) => <div><p className="text-[10px] leading-tight text-slate-500">{label}</p><p className={`mt-1 text-xs font-bold ${highlight ? 'text-emerald-300' : 'text-white'}`}>{value}</p></div>;

export const ProjetosManager: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { projetos, impressoras, updateProjetoStatus, updateProjeto, deleteProjeto, refreshFarmData } = useSaaSData();
  const [filtro, setFiltro] = useState<'todos' | 'orcamento' | 'producao' | 'concluido'>('todos');
  const [periodo, setPeriodo] = useState<1 | 7 | 30 | 90>(30);
  const [refreshing, setRefreshing] = useState(false);
  const [busca, setBusca] = useState('');
  const [selectedProjetoPdf, setSelectedProjetoPdf] = useState<ProjetoImpressao3D | null>(null);
  const [viewProject, setViewProject] = useState<ProjetoImpressao3D | null>(null);
  const [failedModelPath, setFailedModelPath] = useState<string | null>(null);
  const [editProject, setEditProject] = useState<ProjetoImpressao3D | null>(null);
  const [saving, setSaving] = useState(false);
  const [startProductionProject, setStartProductionProject] = useState<ProjetoImpressao3D | null>(null);
  const [selectedStartPrinterId, setSelectedStartPrinterId] = useState('');
  const [startingProduction, setStartingProduction] = useState(false);

  const handleOpenStartProduction = (project: ProjetoImpressao3D) => {
    setStartProductionProject(project);
    const availablePrinter = impressoras.find(p => p.status === 'disponivel');
    setSelectedStartPrinterId(availablePrinter?.id || '');
  };

  const handleConfirmStartProduction = async () => {
    if (!startProductionProject || !selectedStartPrinterId) return;
    setStartingProduction(true);
    try {
      const updated = await updateProjeto(startProductionProject.id, { impressoraId: selectedStartPrinterId });
      if (updated) {
        const started = await updateProjetoStatus(startProductionProject.id, 'em_impressao', selectedStartPrinterId);
        if (started !== false) {
          setStartProductionProject(null);
          setSelectedStartPrinterId('');
        }
      }
    } catch {
      toast.error('Não foi possível alocar a impressora.');
    } finally {
      setStartingProduction(false);
    }
  };

  const handleDelete = async (project: ProjetoImpressao3D) => {
    const confirmed = window.confirm(`Excluir "${project.nomePeca}"? Esta ação não pode ser desfeita.`);
    if (confirmed) await deleteProjeto(project.id);
  };
  const openPdf = (project: ProjetoImpressao3D) => setSelectedProjetoPdf({ ...project, impressoraNome: impressoras.find(printer => printer.id === project.impressoraId)?.nome });
  const handleSaveEdit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!editProject) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get('name') || '').trim(); const client = String(form.get('client') || '').trim();
    const clientPhone = String(form.get('clientPhone') || '').trim();
    const weight = Number(form.get('weight')); const time = Number(form.get('time')); const price = Number(form.get('price'));
    const printerId = String(form.get('printer') || ''); const notes = String(form.get('notes') || '').trim();
    const quantity = Number(form.get('quantity')); const dueDate = String(form.get('dueDate') || '');
    if (!name || weight < 0 || time < 0 || price < 0 || !Number.isInteger(quantity) || quantity < 1) { toast.error('Confira o nome, peso, tempo, quantidade e preço.'); return; }
    const imageFile = form.get('image') as File | null; setSaving(true);
    try {
      let imagePath = editProject.imagemPath;
      if (imageFile?.size) { if (!user?.companyId) throw new Error('Sua conta não está vinculada a uma empresa.'); imagePath = await uploadModelFile(imageFile, user.companyId); }
      else if (form.get('removeImage') === 'on') imagePath = undefined;
      const saved = await updateProjeto(editProject.id, { nomePeca: name, clienteNome: client, clienteContato: clientPhone, impressoraId: printerId, quantidade: quantity, dataEntrega: dueDate, pesoEstimadoG: weight, tempoEstimadoHoras: time, precoCobrado: price, observacoes: notes, imagemPath: imagePath || '' });
      if (saved) setEditProject(null);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível salvar as alterações.'); }
    finally { setSaving(false); }
  };
  const openCostCalculator = () => {
    if (!editProject) return;
    if (editProject.estoqueBaixado || ['concluido', 'cancelado'].includes(editProject.status)) {
      toast.error('Este projeto já teve a produção iniciada ou encerrada. Os custos não podem ser recalculados por esta tela para preservar o histórico do estoque.');
      return;
    }
    navigate('/cliente/calculadora', { state: { recalculateProject: editProject } });
    setEditProject(null);
  };
  const createBasedOnProject = () => {
    if (!editProject) return;
    navigate('/cliente/calculadora', { state: { copyProject: editProject } });
    setEditProject(null);
  };

  const periodStart = new Date();
  periodStart.setDate(periodStart.getDate() - periodo + 1);
  const periodStartKey = `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, '0')}-${String(periodStart.getDate()).padStart(2, '0')}`;
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const projectsInPeriod = projetos.filter(project => project.dataCriacao >= (periodo === 1 ? todayKey : periodStartKey));
  const counts = useMemo(() => ({ todos: projectsInPeriod.length, orcamento: projectsInPeriod.filter(project => project.status === 'orcamento').length, producao: projectsInPeriod.filter(project => project.status === 'aprovado' || project.status === 'em_impressao').length, concluido: projectsInPeriod.filter(project => project.status === 'concluido').length }), [projectsInPeriod]);
  const projectsFiltered = projectsInPeriod.filter(project => {
    const matchesFilter = filtro === 'todos' || (filtro === 'orcamento' ? project.status === 'orcamento' : filtro === 'producao' ? ['aprovado', 'em_impressao'].includes(project.status) : project.status === 'concluido');
    return matchesFilter && `${project.nomePeca} ${project.clienteNome} ${project.id}`.toLocaleLowerCase().includes(busca.toLocaleLowerCase());
  });
  const handleRefresh = async () => {
    setRefreshing(true);
    try { await refreshFarmData(); toast.success('Projetos atualizados.'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar os projetos.'); }
    finally { setRefreshing(false); }
  };
  const mediaPath = viewProject?.arquivoPath; const mediaExt = mediaPath?.split('.').pop()?.toLowerCase();
  const show3D = Boolean(mediaPath && ['stl', '3mf'].includes(mediaExt || ''));
  const viewImage = useSignedImage(viewProject?.imagemPath);
  const modelFailed = Boolean(mediaPath && failedModelPath === mediaPath);
  const handleModelError = useCallback(() => {
    if (mediaPath) setFailedModelPath(mediaPath);
  }, [mediaPath]);
  const viewMaterials = viewProject?.materials || [];
  const printerName = viewProject ? impressoras.find(printer => printer.id === viewProject.impressoraId)?.nome : undefined;

  return <div className="space-y-6">
    <div className="flex flex-col items-start justify-between gap-4 xl:flex-row xl:items-center"><div><h2 className="flex items-center gap-2 text-xl font-bold text-white"><FolderKanban className="h-5 w-5 text-indigo-400" />Projetos e orçamentos</h2><p className="mt-1 text-sm text-slate-400">Acompanhe cada trabalho do orçamento à produção.</p></div><div className="flex flex-wrap items-center gap-2"><div className="flex gap-1 rounded-xl border border-slate-800 bg-slate-900 p-1">{([{ days: 1, label: 'Hoje' }, { days: 7, label: '7 dias' }, { days: 30, label: '30 dias' }, { days: 90, label: '90 dias' }] as const).map(option => <button type="button" key={option.days} onClick={() => setPeriodo(option.days)} aria-pressed={periodo === option.days} className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${periodo === option.days ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>{option.label}</button>)}</div><Button type="button" variant="outline" onClick={() => void handleRefresh()} disabled={refreshing} className="h-10 border-slate-700 bg-slate-900 text-slate-200 hover:border-indigo-500"><RefreshCw className={`mr-2 h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />Atualizar</Button><Link to="/cliente/calculadora"><Button size="sm" className="h-10 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500"><Plus className="mr-1 h-4 w-4" />Novo projeto / orçamento</Button></Link></div></div>

    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {([
        { 
          id: 'todos' as const, 
          label: 'Todos os Trabalhos', 
          count: counts.todos, 
          badge: 'Geral', 
          detail: 'Histórico e ativos',
          activeBg: 'border-indigo-500 ring-2 ring-indigo-500/30',
          idleBg: 'border-indigo-500/30 hover:border-indigo-500/60',
          badgeClass: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300',
        },
        { 
          id: 'orcamento' as const, 
          label: 'Orçamentos', 
          count: counts.orcamento, 
          badge: 'Aguardando', 
          detail: 'Propostas abertas',
          activeBg: 'border-amber-500 ring-2 ring-amber-500/30',
          idleBg: 'border-amber-500/30 hover:border-amber-500/60',
          badgeClass: 'bg-amber-500/10 border-amber-500/30 text-amber-300',
        },
        { 
          id: 'producao' as const, 
          label: 'Em Produção', 
          count: counts.producao, 
          badge: 'Fila & Máquinas', 
          detail: 'Na fila ou imprimindo',
          activeBg: 'border-sky-500 ring-2 ring-sky-500/30',
          idleBg: 'border-sky-500/30 hover:border-sky-500/60',
          badgeClass: 'bg-sky-500/10 border-sky-500/30 text-sky-300',
        },
        { 
          id: 'concluido' as const, 
          label: 'Concluídos', 
          count: counts.concluido, 
          badge: 'Entregues', 
          detail: 'Peças finalizadas',
          activeBg: 'border-emerald-500 ring-2 ring-emerald-500/30',
          idleBg: 'border-emerald-500/30 hover:border-emerald-500/60',
          badgeClass: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300',
        },
      ]).map(item => {
        const isSelected = filtro === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setFiltro(item.id)}
            className={`text-left rounded-2xl border bg-slate-900 transition-all shadow-lg ${
              isSelected ? item.activeBg : item.idleBg
            }`}
          >
            <div className="p-4 sm:p-5 flex flex-col justify-between h-full space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  {item.label}
                </span>
                <Badge className={`${item.badgeClass} text-[10px] px-2 py-0.5 font-bold`}>
                  {item.badge}
                </Badge>
              </div>
              <div>
                <strong className="text-2xl lg:text-3xl font-black text-white tracking-tight">
                  {item.count}
                </strong>
              </div>
              <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
                <span>{item.detail}</span>
                {isSelected && (
                  <span className="text-[10px] font-bold text-indigo-400">Ativo</span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </section>
    <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><Input value={busca} onChange={event => setBusca(event.target.value)} placeholder="Buscar projeto ou cliente" aria-label="Buscar projeto ou cliente" className="border-slate-800 bg-slate-900 pl-9 text-white" /></div>

    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{projectsFiltered.map(project => { const assignedPrinter = impressoras.find(printer => printer.id === project.impressoraId); return <ProjectCard key={project.id} project={project} printerName={assignedPrinter?.nome} printerCanStart={assignedPrinter?.status === 'disponivel'} onView={setViewProject} onEdit={setEditProject} onDelete={handleDelete} onPdf={openPdf} onStatus={updateProjetoStatus} onStartWithPrinter={handleOpenStartProduction} />; })}</section>
    {projectsFiltered.length === 0 && <Card className="border-slate-800 bg-slate-900 p-10 text-center"><FolderKanban className="mx-auto h-8 w-8 text-slate-500" /><p className="mt-3 text-sm text-slate-300">{busca ? 'Nenhum projeto corresponde à busca.' : 'Nenhum projeto nesta categoria.'}</p><Link to="/cliente/calculadora"><Button className="mt-4 bg-indigo-600 text-white"><Plus className="mr-2 h-4 w-4" />Criar primeiro projeto</Button></Link></Card>}

    {viewProject && <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/80 p-3 sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget) setViewProject(null); }}><article className="my-auto w-full max-w-xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
      <header className="flex items-center justify-between border-b border-slate-800 px-5 py-4"><div className="flex items-center gap-2"><Eye className="h-4 w-4 text-amber-400" /><h3 className="font-bold text-white">Visualização do produto</h3></div><Button variant="ghost" size="icon" aria-label="Fechar visualização" onClick={() => setViewProject(null)} className="text-slate-400 hover:text-white"><X className="h-5 w-5" /></Button></header>
      <div className="space-y-4 p-4 sm:p-5"><div className="flex h-44 items-center justify-center overflow-hidden rounded-xl border border-slate-700 bg-slate-950 sm:h-52">{show3D && !modelFailed ? <Suspense fallback={viewImage ? <img src={viewImage} alt={`Imagem de ${viewProject.nomePeca}`} className="h-full w-full object-contain" /> : <span className="text-sm text-slate-400">Carregando modelo 3D…</span>}><ModelPreview key={mediaPath} filePath={mediaPath!} onLoadError={handleModelError} /></Suspense> : viewImage ? <img src={viewImage} alt={`Imagem de ${viewProject.nomePeca}`} className="h-full w-full object-contain" /> : <div className="flex flex-col items-center gap-2 text-slate-500"><ImagePlus className="h-8 w-8" /><span className="text-xs">{show3D ? 'Não foi possível visualizar o modelo e nenhuma imagem foi anexada' : 'Nenhuma imagem ou modelo foi anexado'}</span></div>}</div>
        <div className="flex items-start justify-between gap-2"><div><h4 className="text-lg font-bold text-white">{viewProject.nomePeca}</h4><p className="text-xs text-slate-400">Projeto #{viewProject.id.replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase()}</p></div><Badge variant="outline" className={statusClass[viewProject.status]}>{statusLabel[viewProject.status]}</Badge></div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <InfoCell label="Cliente / solicitante" value={viewProject.clienteNome || 'Não informado'} icon={UserRound} />
          <InfoCell label="Contato do cliente" value={viewProject.clienteContato || 'Não informado'} />
          <InfoCell label="Data de criação" value={new Date(`${viewProject.dataCriacao}T00:00:00`).toLocaleDateString('pt-BR')} />
          <InfoCell label="Quantidade" value={`${viewProject.quantidade || 1} peça(s)`} />
          <InfoCell label="Material e peso" value={viewMaterials.length ? viewMaterials.map(material => `${material.filamentType} (${material.weightGrams} g)`).join(' · ') : `${viewProject.pesoEstimadoG} g`} icon={Weight} />
          <InfoCell label="Tempo de impressão" value={formatHours(viewProject.tempoEstimadoHoras)} icon={Clock3} />
          <InfoCell label="Impressora" value={printerName || (viewProject.status === 'orcamento' ? 'A definir na aprovação' : 'Não definida')} icon={viewProject.status === 'orcamento' ? undefined : AlertTriangle} />
          <InfoCell label="Entrega prevista" value={viewProject.dataEntrega ? new Date(`${viewProject.dataEntrega}T00:00:00`).toLocaleDateString('pt-BR') : 'Não definida'} />
          <InfoCell label="Custo total estimado" value={money(viewProject.custoTotal)} />
          <div>
            <InfoCell 
              label="Forma de Pagamento" 
              value={
                viewProject.detalhesPagamento || (
                  viewProject.formaPagamento === 'pix' ? 'Pix à Vista' :
                  viewProject.formaPagamento === 'credito' ? `Cartão de Crédito (${viewProject.parcelasCartao || 1}x)` :
                  viewProject.formaPagamento === 'debito' ? 'Cartão de Débito' :
                  viewProject.formaPagamento === 'dinheiro' ? 'Dinheiro em Espécie' : 'A definir'
                )
              } 
            />
          </div>
        </div>
        {viewMaterials.length > 0 && <div className="flex flex-wrap gap-2">{viewMaterials.map((material, index) => <span key={material.id || index} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-[11px] text-slate-300"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: material.colorHex || '#6366f1' }} />{material.filamentType} · {material.color}: {material.weightGrams} g</span>)}</div>}
        <div className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-950 px-4 py-3"><div><p className="text-[10px] uppercase text-slate-500">Lucro estimado</p><p className="text-xs font-semibold text-emerald-300">{money(viewProject.lucroLiquido)}</p></div><div className="text-right"><p className="text-[10px] uppercase text-slate-500">Preço sugerido</p><p className="text-xl font-black text-amber-400">{money(viewProject.precoCobrado)}</p></div></div>
        <div className="flex flex-col gap-2 sm:flex-row"><Button onClick={() => { setSelectedProjetoPdf({ ...viewProject, impressoraNome: printerName }); setViewProject(null); }} className="flex-1 bg-amber-600 text-white hover:bg-amber-500"><FileText className="mr-2 h-4 w-4" />Gerar orçamento comercial</Button><Button variant="outline" onClick={() => setViewProject(null)} className="border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800">Fechar</Button></div>
      </div>
    </article></div>}

    {editProject && <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/80 p-3 sm:p-6"><form onSubmit={handleSaveEdit} className="my-auto max-h-[95vh] w-full max-w-2xl space-y-4 overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 sm:p-6"><div className="flex items-start justify-between"><div><h3 className="text-lg font-bold text-white">Editar projeto</h3><p className="text-sm text-slate-400">Atualize os dados e a imagem do produto.</p></div><Button type="button" variant="ghost" size="icon" aria-label="Fechar edição" onClick={() => setEditProject(null)}><X className="h-5 w-5" /></Button></div>
      <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm text-slate-300">Nome do produto<Input name="name" required maxLength={160} defaultValue={editProject.nomePeca} className="mt-1 bg-slate-950 text-white" /></label><label className="text-sm text-slate-300">Cliente (opcional)<Input name="client" maxLength={160} defaultValue={editProject.clienteNome} className="mt-1 bg-slate-950 text-white" /></label><label className="text-sm text-slate-300">Contato do cliente (opcional)<Input name="clientPhone" type="tel" maxLength={60} defaultValue={editProject.clienteContato || ''} placeholder="Ex: (11) 99999-9999" className="mt-1 bg-slate-950 text-white" /></label><label className="text-sm text-slate-300">Impressora<select name="printer" defaultValue={editProject.impressoraId || ''} disabled={editProject.status === 'em_impressao'} className="mt-1 h-10 w-full rounded-md border border-slate-700 bg-slate-950 px-3 text-sm text-white disabled:opacity-60"><option value="">Não definida</option>{impressoras.filter(printer => printer.status === 'disponivel' || printer.id === editProject.impressoraId).map(printer => <option key={printer.id} value={printer.id}>{printer.nome} · {printer.status === 'disponivel' ? 'Disponível' : 'Selecionada'}</option>)}</select>{editProject.status === 'em_impressao' && <input type="hidden" name="printer" value={editProject.impressoraId || ''} />}</label><label className="text-sm text-slate-300">Quantidade de peças<Input name="quantity" type="number" required min="1" step="1" defaultValue={editProject.quantidade || 1} className="mt-1 bg-slate-950 text-white" /></label><label className="text-sm text-slate-300">Entrega prevista<Input name="dueDate" type="date" defaultValue={editProject.dataEntrega || ''} className="mt-1 bg-slate-950 text-white" /></label><label className="text-sm text-slate-300">Peso estimado total (g)<Input name="weight" type="number" min="0" step="0.1" defaultValue={editProject.pesoEstimadoG} className="mt-1 bg-slate-950 text-white" /></label><label className="text-sm text-slate-300">Tempo estimado total (h)<Input name="time" type="number" min="0" step="0.1" defaultValue={editProject.tempoEstimadoHoras} className="mt-1 bg-slate-950 text-white" /></label><label className="text-sm text-slate-300">Preço de venda (R$)<Input name="price" type="number" min="0" step="0.01" defaultValue={editProject.precoCobrado} className="mt-1 bg-slate-950 text-white" /></label><label className="text-sm text-slate-300 sm:col-span-2">Observações<textarea name="notes" rows={3} defaultValue={editProject.observacoes || ''} className="mt-1 w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-white" /></label><label className="text-sm text-slate-300 sm:col-span-2">Imagem do produto (JPG, PNG ou WebP)<input name="image" type="file" accept="image/jpeg,image/png,image/webp" className="mt-2 block w-full text-xs text-slate-300 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-600 file:px-3 file:py-2 file:text-white" /></label>{editProject.imagemPath && <label className="flex items-center gap-2 text-xs text-slate-400 sm:col-span-2"><input type="checkbox" name="removeImage" />Remover imagem atual</label>}</div>
      <div className="flex flex-col justify-between gap-2 border-t border-slate-800 pt-4 sm:flex-row"><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={openCostCalculator} disabled={Boolean(editProject.estoqueBaixado || ['concluido', 'cancelado'].includes(editProject.status))} className="border-indigo-500/40 bg-indigo-500/10 text-indigo-200 hover:bg-indigo-500/20 disabled:opacity-50"><Calculator className="mr-2 h-4 w-4" />Recalcular custos</Button><Button type="button" variant="outline" onClick={createBasedOnProject} className="border-emerald-500/40 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"><Copy className="mr-2 h-4 w-4" />Usar como base</Button></div><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setEditProject(null)} className="border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800">Cancelar</Button><Button type="submit" disabled={saving} className="bg-indigo-600 text-white">{saving ? 'Salvando…' : 'Salvar alterações'}</Button></div></div></form></div>}

    {startProductionProject && (
      <div className="fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/80 p-3 sm:p-6" onMouseDown={event => { if (event.target === event.currentTarget) setStartProductionProject(null); }}>
        <div className="my-auto w-full max-w-lg overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 p-6 shadow-2xl">
          <div className="flex items-start justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Play className="h-4 w-4 text-sky-400" />
                Alocar Impressora & Iniciar Produção
              </h3>
              <p className="mt-0.5 text-xs text-slate-400">
                {startProductionProject.nomePeca} · Cliente: {startProductionProject.clienteNome || 'Não informado'}
              </p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setStartProductionProject(null)} className="text-slate-400 hover:text-white">
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="py-4 space-y-4 text-xs text-slate-300">
            <div className="grid grid-cols-2 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div><span className="text-slate-500 block">Tempo estimado:</span><strong className="text-white">{formatHours(startProductionProject.tempoEstimadoHoras)}</strong></div>
              <div><span className="text-slate-500 block">Peso total:</span><strong className="text-white">{startProductionProject.pesoEstimadoG} g</strong></div>
            </div>

            {impressoras.filter(p => p.status === 'disponivel').length > 0 ? (
              <div>
                <label className="text-xs font-semibold text-slate-200 block mb-1.5">
                  Escolha uma impressora disponível na Farm:
                </label>
                <select
                  value={selectedStartPrinterId}
                  onChange={e => setSelectedStartPrinterId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl h-11 px-3 text-xs focus:outline-none focus:border-indigo-500"
                >
                  <option value="">Selecione uma máquina livre...</option>
                  {impressoras.filter(p => p.status === 'disponivel').map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nome} ({p.potenciaWatts}W · Disponível)
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-amber-200">
                <p className="font-semibold flex items-center gap-1.5 mb-1">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  Nenhuma impressora disponível no momento
                </p>
                <p className="text-[11px] text-amber-300/80 leading-relaxed">
                  Todas as {impressoras.length} máquinas da farm estão ocupadas ou em manutenção. Aguarde uma impressão finalizar ou libere uma máquina para iniciar este trabalho.
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-slate-800 pt-3">
            <Button variant="outline" onClick={() => setStartProductionProject(null)} className="border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800 text-xs">
              Cancelar
            </Button>
            {impressoras.filter(p => p.status === 'disponivel').length > 0 && (
              <Button
                disabled={!selectedStartPrinterId || startingProduction}
                onClick={handleConfirmStartProduction}
                className="bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold"
              >
                {startingProduction ? 'Iniciando...' : 'Confirmar & Iniciar Produção'}
              </Button>
            )}
          </div>
        </div>
      </div>
    )}

    {selectedProjetoPdf && <OrcamentoPdfModal isOpen onClose={() => setSelectedProjetoPdf(null)} projeto={selectedProjetoPdf} />}
  </div>;
};

const InfoCell: React.FC<{ label: string; value: string; icon?: typeof UserRound }> = ({ label, value, icon: Icon }) => <div className="min-w-0 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2.5">{Icon && <span className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase text-slate-500"> <Icon className="h-3 w-3" />{label}</span>}{!Icon && <span className="mb-1 block text-[10px] font-bold uppercase text-slate-500">{label}</span>}<strong className="block truncate text-xs text-white">{value}</strong></div>;