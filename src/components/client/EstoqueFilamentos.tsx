"use client";

import React, { useMemo, useState } from 'react';
import { useSaaSData } from '@/context/SaaSDataContext';
import { FilamentoEstoque } from '@/types/saas';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, History, Layers, Package, Pencil, Plus, Search, X } from 'lucide-react';

const TIPOS: FilamentoEstoque['tipo'][] = ['PLA', 'PETG', 'ABS', 'TPU', 'ASA', 'RESINA', 'NYLON', 'PC'];
type FormValues = { tipo: FilamentoEstoque['tipo']; cor: string; corHex: string; pesoTotalG: number; pesoRestanteG: number; precoCarretel: number; pesoMinimoG: number };
const EMPTY_FORM: FormValues = { tipo: 'PLA', cor: '', corHex: '#eab308', pesoTotalG: 1000, pesoRestanteG: 1000, precoCarretel: 110, pesoMinimoG: 200 };
const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const eventName: Record<string, string> = { purchase: 'Entrada', consumption: 'Consumo', return: 'Devolução', adjustment: 'Ajuste' };

export const EstoqueFilamentos: React.FC = () => {
  const { filamentos, movimentacoes, projetos, addFilamento, updateFilamento } = useSaaSData();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormValues>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'todos' | 'filamento' | 'resina'>('todos');
  const lowStock = filamentos.filter(item => item.pesoRestanteG <= (item.pesoMinimoG ?? 200));
  const stockValue = filamentos.reduce((sum, item) => sum + item.pesoRestanteG * item.precoKg / 1000, 0);
  const visible = useMemo(() => filamentos.filter(item => {
    const matchesQuery = `${item.tipo} ${item.cor} ${item.marca}`.toLocaleLowerCase().includes(query.toLocaleLowerCase());
    return matchesQuery && (filter === 'todos' || (filter === 'resina' ? item.tipo === 'RESINA' : item.tipo !== 'RESINA'));
  }), [filamentos, filter, query]);

  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(EMPTY_FORM); };
  const startEdit = (item: FilamentoEstoque) => {
    setEditingId(item.id);
    setForm({ tipo: item.tipo, cor: item.cor, corHex: item.corHex || '#eab308', pesoTotalG: item.pesoTotalG,
      pesoRestanteG: item.pesoRestanteG, precoCarretel: item.precoKg * item.pesoTotalG / 1000, pesoMinimoG: item.pesoMinimoG ?? 200 });
    setShowForm(true);
  };
  const setField = <K extends keyof FormValues>(key: K, value: FormValues[K]) => setForm(current => ({ ...current, [key]: value }));
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.cor.trim() || form.pesoTotalG <= 0 || form.pesoRestanteG < 0 || form.pesoRestanteG > form.pesoTotalG || form.precoCarretel < 0 || form.pesoMinimoG < 0) return;
    setSaving(true);
    const payload = { tipo: form.tipo, cor: form.cor.trim(), corHex: form.corHex, marca: editingId ? filamentos.find(item => item.id === editingId)?.marca || 'Sem marca' : 'Sem marca', pesoTotalG: form.pesoTotalG, pesoRestanteG: form.pesoRestanteG, precoKg: form.precoCarretel / (form.pesoTotalG / 1000), pesoMinimoG: form.pesoMinimoG };
    try { const ok = editingId ? await updateFilamento(editingId, payload) : await addFilamento(payload); if (ok) closeForm(); }
    finally { setSaving(false); }
  };

  return <div className="space-y-6">
    <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div><h2 className="flex items-center gap-2 text-xl font-bold text-white"><Layers className="h-5 w-5 text-indigo-400" />Estoque de Filamentos &amp; Resinas</h2><p className="mt-1 text-sm text-slate-400">Veja o que tem, quanto resta e o que precisa repor.</p></div>
      <Button onClick={() => { if (showForm) closeForm(); else { setForm(EMPTY_FORM); setEditingId(null); setShowForm(true); } }} className="rounded-xl bg-indigo-600 text-white hover:bg-indigo-500">{showForm ? <X className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}{showForm ? 'Fechar' : 'Novo carretel'}</Button>
    </header>

    <section className="grid gap-3 sm:grid-cols-3">
      <SummaryCard 
        icon={Package} 
        label="Carretéis cadastrados" 
        value={`${filamentos.length}`} 
        detail="Filamentos e resinas catalogados" 
        badge={`${filamentos.length} disponíveis`}
        tone="indigo"
      />
      <SummaryCard 
        icon={Layers} 
        label="Valor em estoque" 
        value={money(stockValue)} 
        detail="Estimativa patrimonial pelo peso restante" 
        badge="Ativo circulante"
        tone="emerald"
      />
      <SummaryCard 
        icon={AlertTriangle} 
        label="Estoque baixo" 
        value={`${lowStock.length}`} 
        detail={lowStock.length > 0 ? "Abaixo do peso mínimo configurado" : "Nenhum material em estado crítico"} 
        badge={lowStock.length > 0 ? "Reposição imediata" : "Nível seguro"}
        tone={lowStock.length > 0 ? "rose" : "amber"}
      />
    </section>

    {showForm && <Card className="rounded-2xl border-slate-800 bg-slate-900 p-5">
      <h3 className="mb-4 text-base font-bold text-white">{editingId ? 'Editar carretel' : 'Adicionar carretel'}</h3>
      <form onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Material"><select value={form.tipo} onChange={e => setField('tipo', e.target.value as FilamentoEstoque['tipo'])} className="h-10 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 text-sm text-white">{TIPOS.map(type => <option key={type}>{type}</option>)}</select></Field>
        <Field label="Cor"><Input required maxLength={80} placeholder="Ex.: Preto fosco" value={form.cor} onChange={e => setField('cor', e.target.value)} className="border-slate-700 bg-slate-950 text-white" /></Field>
        <Field label="Amostra da cor"><div className="flex h-10 items-center gap-3 rounded-xl border border-slate-700 bg-slate-950 px-3"><input type="color" aria-label="Selecionar cor" value={form.corHex} onChange={e => setField('corHex', e.target.value)} className="h-7 w-9 cursor-pointer bg-transparent" /><span className="font-mono text-xs text-slate-300">{form.corHex.toUpperCase()}</span></div></Field>
        <Field label="Peso inicial (g)"><Input type="number" required min="1" step="1" value={form.pesoTotalG} onChange={e => setField('pesoTotalG', Number(e.target.value))} className="border-slate-700 bg-slate-950 text-white" /></Field>
        <Field label="Peso atual (g)"><Input type="number" required min="0" max={form.pesoTotalG} step="1" value={form.pesoRestanteG} onChange={e => setField('pesoRestanteG', Number(e.target.value))} className="border-slate-700 bg-slate-950 text-white" /></Field>
        <Field label="Preço do carretel (R$)"><Input type="number" required min="0" step="0.01" value={form.precoCarretel} onChange={e => setField('precoCarretel', Number(e.target.value))} className="border-slate-700 bg-slate-950 text-white" /></Field>
        <Field label="Avisar quando restar (g)"><Input type="number" required min="0" step="1" value={form.pesoMinimoG} onChange={e => setField('pesoMinimoG', Number(e.target.value))} className="border-slate-700 bg-slate-950 text-white" /></Field>
        <p className="self-end pb-2 text-xs text-slate-400">Custo calculado: {money(form.pesoTotalG ? form.precoCarretel / form.pesoTotalG : 0)}/g</p>
        <div className="flex items-end gap-2"><Button type="submit" disabled={saving} className="bg-indigo-600 text-white hover:bg-indigo-500">{saving ? 'Salvando…' : 'Salvar'}</Button><Button type="button" variant="outline" onClick={closeForm}>Cancelar</Button></div>
      </form>
    </Card>}

    <section className="flex flex-col gap-3 sm:flex-row">
      <div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" /><Input aria-label="Buscar material" placeholder="Buscar material ou cor" value={query} onChange={e => setQuery(e.target.value)} className="border-slate-800 bg-slate-900 pl-9 text-white" /></div>
      <div className="flex gap-2">{(['todos', 'filamento', 'resina'] as const).map(value => <button key={value} onClick={() => setFilter(value)} className={`rounded-lg border px-3 py-2 text-xs font-semibold capitalize ${filter === value ? 'border-indigo-500 bg-indigo-600 text-white' : 'border-slate-800 bg-slate-900 text-slate-300'}`}>{value === 'todos' ? 'Todos' : value === 'resina' ? 'Resina' : 'Filamento'}</button>)}</div>
    </section>

    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {visible.map(item => {
        const percent = item.pesoTotalG ? Math.min(100, Math.round(item.pesoRestanteG / item.pesoTotalG * 100)) : 0;
        const threshold = item.pesoMinimoG ?? 200; const isLow = item.pesoRestanteG <= threshold;
        const remainingValue = item.pesoRestanteG * item.precoKg / 1000;
        return <Card key={item.id} className={`space-y-4 rounded-2xl border bg-slate-900 p-5 ${isLow ? 'border-amber-500/40' : 'border-slate-800'}`}>
          <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-3"><span className="h-5 w-5 shrink-0 rounded-full border border-white/20" style={{ backgroundColor: item.corHex || '#64748b' }} /><div className="min-w-0"><h3 className="font-bold text-white">{item.tipo}</h3><p className="truncate text-sm text-slate-300">{item.cor}</p></div></div><Button variant="ghost" size="icon" aria-label={`Editar ${item.tipo} ${item.cor}`} onClick={() => startEdit(item)} className="shrink-0 text-slate-300 hover:text-white"><Pencil className="h-4 w-4" /></Button></div>
          <div><div className="mb-2 flex items-center justify-between text-sm"><span className="text-slate-400">Peso restante</span><strong className={isLow ? 'text-amber-300' : 'text-white'}>{item.pesoRestanteG.toLocaleString('pt-BR')} g</strong></div><Progress value={percent} className={`h-2 bg-slate-950 ${isLow ? '[&>div]:bg-amber-500' : '[&>div]:bg-indigo-500'}`} /><p className="mt-1 text-right text-xs text-slate-500">de {item.pesoTotalG.toLocaleString('pt-BR')} g · {percent}%</p></div>
          <div className="grid grid-cols-2 gap-3 border-t border-slate-800 pt-3"><div><p className="text-xs text-slate-500">Custo</p><p className="text-sm font-semibold text-white">{money(item.precoKg / 1000)}/g</p></div><div><p className="text-xs text-slate-500">Valor restante</p><p className="text-sm font-semibold text-white">{money(remainingValue)}</p></div></div>
          <p className={`flex items-center gap-2 text-xs font-semibold ${isLow ? 'text-amber-300' : 'text-emerald-300'}`}>{isLow ? <AlertTriangle className="h-4 w-4" /> : <span className="h-2 w-2 rounded-full bg-emerald-400" />}{isLow ? 'Estoque baixo' : 'Estoque normal'}<span className="ml-auto font-normal text-slate-500">Mín. {threshold} g</span></p>
        </Card>;
      })}
    </section>
    {!visible.length && <p className="py-8 text-center text-sm text-slate-400">{filamentos.length ? 'Nenhum material encontrado.' : 'Seu estoque está vazio. Adicione o primeiro carretel para começar.'}</p>}

    <Card className="rounded-2xl border-slate-800 bg-slate-900 p-5">
      <div className="mb-4 flex items-center gap-2"><History className="h-4 w-4 text-indigo-400" /><h3 className="font-bold text-white">Movimentações recentes</h3></div>
      <div className="divide-y divide-slate-800">{movimentacoes.slice(0, 8).map(event => {
        const item = filamentos.find(filament => filament.id === event.filamentoId);
        const project = event.projetoId ? projetos.find(value => value.id === event.projetoId) : undefined;
        const isReduction = event.tipo === 'consumption' || (event.tipo === 'adjustment' && event.motivo?.includes('redução'));
        return <div key={event.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><div><p className="font-medium text-slate-200">{eventName[event.tipo]} · {item ? `${item.tipo} ${item.cor}` : 'Material'}</p><p className="text-xs text-slate-500">{new Date(event.data).toLocaleString('pt-BR')}{project ? ` · Projeto: ${project.nomePeca}` : ''}{event.motivo ? ` · ${event.motivo}` : ''}</p></div><span className="font-semibold text-slate-300">{isReduction ? '−' : '+'}{event.quantidadeGramas} g</span></div>;
      })}</div>
      {!movimentacoes.length && <p className="text-sm text-slate-400">As entradas e baixas de material aparecerão aqui.</p>}
    </Card>
  </div>;
};

interface SummaryCardProps {
  icon: typeof Package;
  label: string;
  value: string;
  detail: string;
  badge: string;
  tone: 'indigo' | 'emerald' | 'amber' | 'rose';
}

const SummaryCard: React.FC<SummaryCardProps> = ({ icon: Icon, label, value, detail, badge, tone }) => {
  const toneMap = {
    indigo: {
      border: 'border-indigo-500/30 hover:border-indigo-500/60',
      iconBox: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400',
      badge: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300',
    },
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
          <Badge className={`${theme.badge} text-[10px] px-2 py-0.5 font-bold`}>
            {badge}
          </Badge>
        </div>
        <div>
          <p className="text-2xl lg:text-3xl font-black text-white tracking-tight">{value}</p>
        </div>
        <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
          <span>{detail}</span>
        </div>
      </div>
    </Card>
  );
};
const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => <label className="block space-y-1 text-xs text-slate-300">{label}{children}</label>;
