"use client";

import React, { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useSaaSData } from '@/context/SaaSDataContext';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { Calculadora3D } from '@/components/client/Calculadora3D';
import { EstoqueFilamentos } from '@/components/client/EstoqueFilamentos';
import { ParqueImpressoras } from '@/components/client/ParqueImpressoras';
import { ProjetosManager } from '@/components/client/ProjetosManager';
import { SpartanAiAssistant } from '@/components/client/SpartanAiAssistant';
import { ClientInvoicesList } from '@/components/client/ClientInvoicesList';
import { ClientPlansPricing } from '@/components/client/ClientPlansPricing';
import { ClientSettingsForm } from '@/components/client/ClientSettingsForm';
import { ClientUpgradeModal } from '@/components/client/ClientUpgradeModal';
import { Card } from '@/components/ui/card';
import { AlertTriangle, ArrowRight, CheckCircle2, CircleDollarSign, Clock3, Cpu, FolderKanban, Layers, Plus, RefreshCw, TrendingUp, Wrench } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const money = (value: number) => `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
const periodOptions = [{ value: 1, label: 'Hoje' }, { value: 7, label: '7 dias' }, { value: 30, label: '30 dias' }, { value: 90, label: '90 dias' }] as const;
const dateInputValue = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const ClientPortal: React.FC = () => {
  const currentPath = useLocation().pathname;
  const { user, updateUserProfile } = useAuth();
  const { currentPlan, plans, filamentos, impressoras, projetos, historicoImpressoras, changeClientPlan, invoices, openInvoiceCheckout, refreshFarmData } = useSaaSData();
  const [upgradeModal, setUpgradeModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<number>(30);
  const [customPeriod, setCustomPeriod] = useState(false);
  const [customStart, setCustomStart] = useState(() => { const date = new Date(); date.setDate(date.getDate() - 29); return dateInputValue(date); });
  const [customEnd, setCustomEnd] = useState(() => dateInputValue(new Date()));
  const [chartMode, setChartMode] = useState<'finance' | 'revenue' | 'profit' | 'cost' | 'orders' | 'production'>('finance');
  const handleUpgrade = (planId: string) => { changeClientPlan(planId); setUpgradeModal(false); toast.info('O plano será atualizado após a confirmação do pagamento.'); };
  const handleRefresh = async () => {
    setRefreshing(true);
    try { await refreshFarmData(); toast.success('Dados da farm atualizados.'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível atualizar os dados.'); }
    finally { setRefreshing(false); }
  };

  const isCalculadora = currentPath === '/cliente/calculadora';
  const isEstoque = currentPath === '/cliente/estoque';
  const isImpressoras = currentPath === '/cliente/impressoras';
  const isProjetos = currentPath === '/cliente/projetos';
  const isAiCopilot = currentPath === '/cliente/ia-copilot';
  const isPlanos = currentPath === '/cliente/planos';
  const isFaturas = currentPath === '/cliente/faturas';
  const isConfig = currentPath === '/cliente/configuracoes';
  const isOverview = !isCalculadora && !isEstoque && !isImpressoras && !isProjetos && !isAiCopilot && !isPlanos && !isFaturas && !isConfig;

  const title = isCalculadora ? 'Calculadora de Impressão 3D'
    : isEstoque ? 'Estoque de Filamentos & Resinas'
    : isImpressoras ? 'Parque de Impressoras 3D'
    : isProjetos ? 'Projetos & Orçamentos Salvos'
    : isAiCopilot ? 'SPARTAN AI — Copilot & Diagnóstico 3D'
    : isPlanos ? 'Planos & Capacidade da Farm'
    : isFaturas ? 'Minhas Faturas & Assinatura'
    : isConfig ? 'Configurações da Farm'
    : `Meu Painel 3D${user?.name ? ` — ${user.name}` : ''}`;

  const lowStock = filamentos.filter(item => item.pesoRestanteG <= (item.pesoMinimoG ?? 200));
  const servicePrinters = impressoras.filter(printer => ['manutencao', 'desconectada'].includes(printer.status));
  const printing = impressoras.filter(printer => printer.status === 'imprimindo').length;
  const activeProjects = projetos.filter(project => ['aprovado', 'em_impressao'].includes(project.status)).length;
  const todayIso = new Date();
  const todayKey = `${todayIso.getFullYear()}-${String(todayIso.getMonth() + 1).padStart(2, '0')}-${String(todayIso.getDate()).padStart(2, '0')}`;
  const overdueProjectsNow = projetos.filter(project => project.dataEntrega && project.dataEntrega < todayKey && !['concluido', 'cancelado'].includes(project.status));
  const maintenanceDueNow = impressoras.filter(printer => (printer.intervaloManutencaoHoras || 0) > 0 && (printer.horasDesdeManutencao || 0) / (printer.intervaloManutencaoHoras || 1) >= 0.8);
  const attentionCount = lowStock.length + servicePrinters.length + overdueProjectsNow.length + maintenanceDueNow.length + projetos.filter(project => project.status === 'orcamento').length;

  const overview = useMemo(() => {
    const now = new Date();
    const start = customPeriod ? new Date(`${customStart}T00:00:00`) : new Date(now);
    if (!customPeriod) start.setDate(now.getDate() - period + 1);
    start.setHours(0, 0, 0, 0);
    const end = customPeriod ? new Date(`${customEnd}T23:59:59.999`) : new Date(now);
    const rangeDays = Math.max(1, Math.floor((new Date(dateInputValue(end)).getTime() - start.getTime()) / 86400000) + 1);
    const recent = projetos.filter(project => new Date(`${project.dataCriacao}T00:00:00`) >= start && new Date(`${project.dataCriacao}T00:00:00`) <= end);
    const completed = recent.filter(project => project.status === 'concluido');
    const revenue = completed.reduce((sum, project) => sum + project.precoCobrado, 0);
    const cost = completed.reduce((sum, project) => sum + project.custoTotal, 0);
    const profit = completed.reduce((sum, project) => sum + project.lucroLiquido, 0);
    const margin = revenue ? profit / revenue * 100 : 0;
    const hours = completed.reduce((sum, project) => sum + project.tempoEstimadoHoras, 0);
    const stepDays = Math.max(1, Math.ceil(rangeDays / 90));
    const daily = Array.from({ length: Math.ceil(rangeDays / stepDays) }, (_, index) => {
      const bucketStart = new Date(start); bucketStart.setDate(start.getDate() + index * stepDays);
      const bucketEnd = new Date(bucketStart); bucketEnd.setDate(bucketStart.getDate() + stepDays - 1);
      if (bucketEnd > end) bucketEnd.setTime(end.getTime());
      const bucketStartKey = dateInputValue(bucketStart); const bucketEndKey = dateInputValue(bucketEnd);
      const entries = recent.filter(project => project.dataCriacao >= bucketStartKey && project.dataCriacao <= bucketEndKey);
      return { date: stepDays > 1 ? `${bucketStart.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}–${bucketEnd.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}` : bucketStart.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }), value: entries.reduce((sum, project) => sum + project.precoCobrado, 0), cost: entries.reduce((sum, project) => sum + project.custoTotal, 0), profit: entries.reduce((sum, project) => sum + project.lucroLiquido, 0), orders: entries.length, production: entries.reduce((sum, project) => sum + project.tempoEstimadoHoras, 0) };
    });
    const materials = recent.filter(project => project.estoqueBaixado).flatMap(project => project.materials || []).reduce<Record<string, number>>((totals, item) => { totals[item.filamentType] = (totals[item.filamentType] || 0) + item.weightGrams; return totals; }, {});
    const costs = completed.reduce((totals, project) => ({
      material: totals.material + project.custoMaterial,
      energy: totals.energy + project.custoEnergia,
      maintenance: totals.maintenance,
      labor: totals.labor + (project.custoMaoDeObra || 0),
      depreciation: totals.depreciation + project.custoDepreciacao,
      other: totals.other + (project.outrosCustos || 0),
    }), { material: 0, energy: 0, maintenance: 0, labor: 0, depreciation: 0, other: 0 });
    const profitableProducts = [...completed].sort((a, b) => b.lucroLiquido - a.lucroLiquido).slice(0, 5);
    return { recent, completed, revenue, cost, profit, margin, hours, daily, materials, costs, profitableProducts };
  }, [customEnd, customPeriod, customStart, period, projetos]);

  const operational = useMemo(() => {
    const startDate = customPeriod ? new Date(`${customStart}T00:00:00`) : new Date();
    if (!customPeriod) { startDate.setHours(0, 0, 0, 0); startDate.setDate(startDate.getDate() - period + 1); }
    const endDate = customPeriod ? new Date(`${customEnd}T23:59:59.999`) : new Date();
    const rangeDays = Math.max(1, Math.floor((new Date(dateInputValue(endDate)).getTime() - startDate.getTime()) / 86400000) + 1);
    const capacityHours = impressoras.length * 24 * rangeDays;
    const periodStart = startDate;
    const completedEvents = historicoImpressoras.filter(event => event.tipo === 'project_completed' && new Date(event.data) >= periodStart);
    const completedHours = completedEvents.reduce((sum, event) => sum + (Number(event.payload.hours) || 0), 0);
    const occupancy = impressoras.length ? Math.round(impressoras.filter(printer => ['imprimindo', 'pausada'].includes(printer.status)).length / impressoras.length * 100) : 0;
    const failureEvents = historicoImpressoras.filter(event => /fail|failure|falha|erro/i.test(event.tipo) && new Date(event.data) >= periodStart);
    const printerUtilization = impressoras.map(printer => {
      const hours = completedEvents.filter(event => event.impressoraId === printer.id).reduce((sum, event) => sum + (Number(event.payload.hours) || 0), 0);
      return { printer, hours, percent: rangeDays > 0 ? Math.min(100, hours / (24 * rangeDays) * 100) : 0 };
    }).sort((a, b) => b.percent - a.percent);
    const overdueProjects = overdueProjectsNow;
    const upcomingDeliveries = projetos.filter(project => project.dataEntrega && project.dataEntrega >= todayKey && project.dataEntrega <= new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10) && !['concluido', 'cancelado'].includes(project.status)).sort((a, b) => (a.dataEntrega || '').localeCompare(b.dataEntrega || '')).slice(0, 5);
    const maintenanceDue = maintenanceDueNow;
    const materialKg = Object.values(overview.materials).reduce((sum, grams) => sum + grams, 0) / 1000;
    const healthScore = Math.max(0, 100 - impressoras.filter(printer => printer.status === 'desconectada').length * 20 - impressoras.filter(printer => printer.status === 'manutencao').length * 15 - lowStock.length * 10 - overdueProjects.length * 15 - maintenanceDue.length * 10 - failureEvents.length * 5);
    const healthLabel = healthScore >= 80 ? 'Saudável' : healthScore >= 50 ? 'Atenção' : 'Crítico';
    return { capacityHours, completedHours, occupancy, printerUtilization, failureEvents, overdueProjects, upcomingDeliveries, maintenanceDue, materialKg, healthScore, healthLabel };
  }, [customEnd, customPeriod, customStart, historicoImpressoras, impressoras, lowStock.length, maintenanceDueNow, overview.hours, overview.materials, overdueProjectsNow, period, projetos, todayKey]);

  return <DashboardLayout title={title} subtitle={`Estúdio: ${user?.companyName || 'Minha farm'} · Plano: ${currentPlan.name}`} badgeText={currentPlan.badge || 'MAKER ATIVO'}>
    {isOverview && <div className="mx-auto max-w-6xl space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold text-white">Visão administrativa da farm</h2><p className="text-sm text-slate-400">Indicadores calculados a partir dos projetos, máquinas e estoque registrados.</p><p className="mt-1 text-[11px] text-slate-500">Os valores de projetos são estimativas; pagamentos conciliados não são registrados.</p></div><div className="flex flex-wrap items-center gap-2"><div className="flex gap-1 rounded-xl border border-slate-800 bg-slate-900 p-1">{periodOptions.map(option => <button key={option.value} onClick={() => { setPeriod(option.value); setCustomPeriod(false); }} className={`rounded-lg px-3 py-2 text-xs font-semibold ${!customPeriod && period === option.value ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>{option.label}</button>)}<button onClick={() => setCustomPeriod(true)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${customPeriod ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}>Personalizado</button></div><button type="button" onClick={() => void handleRefresh()} disabled={refreshing} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 text-xs font-semibold text-slate-200 hover:border-indigo-500 disabled:opacity-60"><RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />Atualizar</button></div>{customPeriod && <div className="flex w-full flex-wrap items-center justify-end gap-2 text-xs text-slate-400"><label>De <input type="date" value={customStart} max={customEnd} onChange={event => setCustomStart(event.target.value)} className="ml-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-slate-200" /></label><label>Até <input type="date" value={customEnd} min={customStart} max={todayKey} onChange={event => setCustomEnd(event.target.value)} className="ml-1 rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-slate-200" /></label></div>}</section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={CircleDollarSign} label="Valor de projetos concluídos" value={money(overview.revenue)} detail={`${overview.completed.length} projetos no período`} tone="emerald" />
        <MetricCard icon={TrendingUp} label="Lucro estimado" value={money(overview.profit)} detail={`Custo estimado: ${money(overview.cost)}`} tone="indigo" />
        <MetricCard icon={TrendingUp} label="Margem estimada" value={`${overview.margin.toFixed(1)}%`} detail="Nos projetos concluídos" tone="cyan" />
        <MetricCard icon={Clock3} label="Horas previstas" value={`${overview.hours.toFixed(1)} h`} detail={`${overview.completed.length} projetos concluídos`} tone="amber" />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Cpu} label="Impressoras ocupadas agora" value={`${printing}/${impressoras.length}`} detail={`${operational.occupancy}% imprimindo ou pausadas`} tone="indigo" />
        <MetricCard icon={Layers} label="Material baixado no período" value={`${operational.materialKg.toFixed(2)} kg`} detail="Conforme projetos com baixa de estoque" tone="cyan" />
        <MetricCard icon={CheckCircle2} label="Projetos concluídos" value={`${overview.completed.length}`} detail="No período selecionado" tone="emerald" />
        <MetricCard icon={AlertTriangle} label="Falhas registradas" value={operational.failureEvents.length ? `${operational.failureEvents.length}` : 'Sem dados'} detail={operational.failureEvents.length ? 'Eventos encontrados no histórico' : 'O sistema ainda não registra falhas'} tone="amber" />
      </section>

      <Card className="rounded-2xl border-slate-800 bg-slate-900 p-4 sm:p-5"><div className="mb-4 flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-bold text-white">Desempenho da farm</h3><p className="text-xs text-slate-400">Valores e produção registrados no período.</p></div><div className="flex items-center gap-3"><select aria-label="Métrica do gráfico" value={chartMode} onChange={event => setChartMode(event.target.value as typeof chartMode)} className="h-9 rounded-lg border border-slate-700 bg-slate-950 px-2 text-xs text-slate-200"><option value="finance">Valores, custos e lucro</option><option value="revenue">Valor dos projetos</option><option value="profit">Lucro estimado</option><option value="cost">Custos</option><option value="orders">Pedidos</option><option value="production">Produção (horas)</option></select><Link to="/cliente/projetos" className="text-xs font-semibold text-indigo-300">Ver projetos <ArrowRight className="inline h-3.5 w-3.5" /></Link></div></div><div className="h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={overview.daily}><CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 10 }} interval="preserveStartEnd" /><YAxis stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 10 }} tickFormatter={value => ['orders', 'production'].includes(chartMode) ? `${value}${chartMode === 'production' ? 'h' : ''}` : `R$${value}`} width={58} /><Tooltip formatter={value => chartMode === 'orders' ? `${Number(value)} projetos` : chartMode === 'production' ? `${Number(value).toFixed(1)} h` : money(Number(value))} contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, color: '#e2e8f0' }} /><Legend />{(chartMode === 'finance' || chartMode === 'revenue') && <Line type="monotone" dataKey="value" name="Valor dos projetos" stroke="#818cf8" strokeWidth={2} dot={false} />}{chartMode === 'finance' && <Line type="monotone" dataKey="cost" name="Custos" stroke="#fb7185" strokeWidth={2} dot={false} />}{(chartMode === 'finance' || chartMode === 'profit') && <Line type="monotone" dataKey="profit" name="Lucro estimado" stroke="#34d399" strokeWidth={2} dot={false} />}{chartMode === 'orders' && <Line type="monotone" dataKey="orders" name="Projetos" stroke="#38bdf8" strokeWidth={2} dot={false} />}{chartMode === 'production' && <Line type="monotone" dataKey="production" name="Horas previstas" stroke="#fbbf24" strokeWidth={2} dot={false} />}{chartMode === 'cost' && <Line type="monotone" dataKey="cost" name="Custos" stroke="#fb7185" strokeWidth={2} dot={false} />}</LineChart></ResponsiveContainer></div></Card>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-2xl border-slate-800 bg-slate-900 p-5">
          <h3 className="font-bold text-white">Financeiro da operação</h3><p className="mb-4 text-xs text-slate-400">Custos cadastrados nos projetos concluídos do período</p>
          <div className="space-y-3">{[{ label: 'Materiais', value: overview.costs.material }, { label: 'Energia', value: overview.costs.energy }, { label: 'Mão de obra', value: overview.costs.labor }, { label: 'Depreciação', value: overview.costs.depreciation }, { label: 'Outros custos', value: overview.costs.other }].map(item => <div key={item.label} className="flex items-center justify-between text-sm"><span className="text-slate-400">{item.label}</span><strong className="text-slate-100">{money(item.value)}</strong></div>)}
            <div className="flex items-center justify-between border-t border-slate-800 pt-3 text-sm"><span className="text-slate-300">Custo total estimado</span><strong className="text-rose-300">{money(overview.cost)}</strong></div>
          </div><p className="mt-3 text-[11px] text-slate-500">Manutenção e falhas não são discriminadas separadamente nos custos dos projetos.</p>
        </Card>
        <Card className="rounded-2xl border-slate-800 bg-slate-900 p-5">
          <h3 className="font-bold text-white">Produtos mais rentáveis</h3><p className="mb-4 text-xs text-slate-400">Projetos concluídos, ordenados pelo lucro estimado</p>
          {overview.profitableProducts.length ? <div className="space-y-3">{overview.profitableProducts.map(project => <div key={project.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-slate-800 pb-2 text-xs last:border-0"><span className="truncate font-medium text-slate-200">{project.nomePeca}</span><span className="text-slate-400">{money(project.precoCobrado)}</span><span className="text-right font-semibold text-emerald-300">{money(project.lucroLiquido)} · {project.precoCobrado ? (project.lucroLiquido / project.precoCobrado * 100).toFixed(0) : '0'}%</span></div>)}</div> : <p className="py-4 text-sm text-slate-400">Conclua projetos para ver a rentabilidade registrada.</p>}
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-2xl border-slate-800 bg-slate-900 p-5">
          <h3 className="font-bold text-white">Capacidade da farm</h3><p className="mb-4 text-xs text-slate-400">Estimativa teórica considerando operação contínua, 24 h por dia</p>
          <div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-slate-950 p-3"><p className="text-xs text-slate-500">Capacidade no período</p><strong className="mt-1 block text-lg text-white">{operational.capacityHours.toFixed(0)} h</strong></div><div className="rounded-xl bg-slate-950 p-3"><p className="text-xs text-slate-500">Horas de projetos concluídos</p><strong className="mt-1 block text-lg text-cyan-300">{operational.completedHours.toFixed(1)} h</strong></div></div>
          <div className="mt-4 h-2 rounded-full bg-slate-800"><div className="h-2 rounded-full bg-cyan-500" style={{ width: `${Math.min(100, operational.capacityHours ? operational.completedHours / operational.capacityHours * 100 : 0)}%` }} /></div><p className="mt-2 text-xs text-slate-400">{Math.max(0, operational.capacityHours - operational.completedHours).toFixed(0)} h de capacidade teórica restante · não considera disponibilidade diária nem pausas.</p>
          {operational.printerUtilization.length > 0 && <div className="mt-4 space-y-2 border-t border-slate-800 pt-3"><p className="text-[11px] font-semibold text-slate-500">Uso registrado por impressora · projetos concluídos</p>{operational.printerUtilization.slice(0, 5).map(({ printer, hours, percent }) => <div key={printer.id}><div className="mb-1 flex justify-between text-xs"><span className="text-slate-300">{printer.nome}</span><span className="text-slate-400">{hours.toFixed(1)} h · {percent.toFixed(1)}%</span></div><div className="h-1.5 rounded-full bg-slate-800"><div className="h-1.5 rounded-full bg-indigo-500" style={{ width: `${percent}%` }} /></div></div>)}</div>}
        </Card>
        <Card className="rounded-2xl border-slate-800 bg-slate-900 p-5">
          <div className="mb-4 flex items-center justify-between"><div><h3 className="font-bold text-white">Pedidos e prazos</h3><p className="text-xs text-slate-400">Entregas previstas e projetos atrasados</p></div><Link to="/cliente/projetos" className="text-xs font-semibold text-indigo-300">Projetos</Link></div>
          <div className="mb-3 flex items-center gap-3 text-xs"><span className="rounded-lg bg-rose-500/10 px-3 py-2 text-rose-300">{operational.overdueProjects.length} atrasados</span><span className="rounded-lg bg-amber-500/10 px-3 py-2 text-amber-200">{operational.upcomingDeliveries.length} entregas em 7 dias</span></div>
          {operational.upcomingDeliveries.length ? <div className="space-y-2">{operational.upcomingDeliveries.map(project => <div key={project.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-950 px-3 py-2 text-xs"><span className="truncate text-slate-200">{project.nomePeca} · {project.clienteNome || 'Cliente não informado'}</span><span className="shrink-0 text-slate-400">{new Date(`${project.dataEntrega}T00:00:00`).toLocaleDateString('pt-BR')}</span></div>)}</div> : <p className="text-sm text-slate-400">Nenhuma entrega prevista para os próximos 7 dias.</p>}
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-2xl border-slate-800 bg-slate-900 p-5">
          <div className="mb-4 flex items-center justify-between"><div><h3 className="font-bold text-white">Saúde da produção</h3><p className="text-xs text-slate-400">Estado atual das máquinas cadastradas</p></div><span className="text-xs text-slate-300">{printing}/{impressoras.length} imprimindo</span></div>
          {impressoras.length ? <div className="space-y-2">{impressoras.slice(0, 5).map(printer => <div key={printer.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-950/70 p-3"><span className="truncate text-sm font-medium text-slate-200">{printer.nome}</span><span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold ${printer.status === 'imprimindo' ? 'bg-emerald-500/10 text-emerald-300' : printer.status === 'disponivel' ? 'bg-indigo-500/10 text-indigo-300' : 'bg-amber-500/10 text-amber-300'}`}>{printer.status === 'imprimindo' ? `Imprimindo · ${printer.progressoPercentual ?? 0}%` : printer.status === 'disponivel' ? 'Disponível' : printer.status === 'pausada' ? 'Pausada' : printer.status === 'manutencao' ? 'Manutenção' : 'Desconectada'}</span></div>)}</div> : <Empty text="Cadastre uma impressora para acompanhar a produção." href="/cliente/impressoras" action="Cadastrar impressora" />}
        </Card>

        <Card className="rounded-2xl border-slate-800 bg-slate-900 p-5">
          <div className="mb-4 flex items-center justify-between"><div><h3 className="font-bold text-white">Consumo de materiais</h3><p className="text-xs text-slate-400">Baixas dos projetos no período</p></div><Link to="/cliente/estoque" className="text-xs font-semibold text-indigo-300">Estoque</Link></div>
          <div className="space-y-3">{Object.entries(overview.materials).sort((a, b) => b[1] - a[1]).map(([type, grams]) => <div key={type}><div className="mb-1 flex justify-between text-xs"><span className="text-slate-300">{type}</span><span className="font-semibold text-white">{(grams / 1000).toFixed(2)} kg</span></div><div className="h-2 rounded-full bg-slate-800"><div className="h-2 rounded-full bg-cyan-500" style={{ width: `${Math.min(100, grams / Math.max(1, ...Object.values(overview.materials)) * 100)}%` }} /></div></div>)}{!Object.keys(overview.materials).length && <p className="py-4 text-sm text-slate-400">Ainda não há consumo registrado neste período.</p>}</div><p className="mt-4 text-[11px] text-slate-500">Materiais vinculados aos projetos iniciados. Suportes, falhas e desperdício não são registrados separadamente.</p>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-2xl border-slate-800 bg-slate-900 p-5"><h3 className="mb-1 font-bold text-white">Fluxo de projetos</h3><p className="mb-4 text-xs text-slate-400">Projetos criados no período selecionado</p><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[['Orçamentos', overview.recent.filter(p => p.status === 'orcamento').length], ['Em produção', overview.recent.filter(p => p.status === 'em_impressao' || p.status === 'aprovado').length], ['Concluídos', overview.recent.filter(p => p.status === 'concluido').length], ['Cancelados', overview.recent.filter(p => p.status === 'cancelado').length]].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-950 p-3"><p className="text-xs text-slate-400">{label}</p><p className="mt-1 text-xl font-black text-white">{value}</p></div>)}</div><Link to="/cliente/projetos" className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-indigo-300">Abrir projetos <ArrowRight className="h-3.5 w-3.5" /></Link></Card>

        <Card className="rounded-2xl border-slate-800 bg-slate-900 p-5">
          <div className="mb-4 flex items-center justify-between"><div><h3 className="font-bold text-white">Atenção necessária</h3><p className="text-xs text-slate-400">Alertas baseados nos dados atuais</p></div><AlertTriangle className="h-4 w-4 text-amber-400" /></div>
          <div className="space-y-2">
            {lowStock.slice(0, 4).map(item => <Link key={item.id} to="/cliente/estoque" className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-200"><span>{item.tipo} {item.cor}: restam {item.pesoRestanteG} g</span><ArrowRight className="h-4 w-4" /></Link>)}
            {servicePrinters.slice(0, 4).map(printer => <Link key={printer.id} to="/cliente/impressoras" className="flex items-center justify-between rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-sm text-rose-200"><span>{printer.nome}: {printer.status === 'manutencao' ? 'precisa de manutenção' : 'está desconectada'}</span><ArrowRight className="h-4 w-4" /></Link>)}
            {operational.maintenanceDue.filter(printer => printer.status !== 'manutencao').slice(0, 3).map(printer => <Link key={`maint-${printer.id}`} to="/cliente/impressoras" className="flex items-center justify-between rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-200"><span>{printer.nome}: revisão próxima ({printer.horasDesdeManutencao || 0}/{printer.intervaloManutencaoHoras || 0} h)</span><Wrench className="h-4 w-4 shrink-0" /></Link>)}
            {operational.overdueProjects.map(project => <Link key={`late-${project.id}`} to="/cliente/projetos" className="flex items-center justify-between rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-sm text-rose-200"><span>{project.nomePeca}: prazo vencido em {project.dataEntrega ? new Date(`${project.dataEntrega}T00:00:00`).toLocaleDateString('pt-BR') : ''}</span><ArrowRight className="h-4 w-4" /></Link>)}
            {operational.failureEvents.slice(0, 3).map(event => <Link key={`failure-${event.id}`} to="/cliente/impressoras" className="flex items-center justify-between rounded-xl border border-rose-500/20 bg-rose-500/5 p-3 text-sm text-rose-200"><span>{impressoras.find(printer => printer.id === event.impressoraId)?.nome || 'Impressora'}: falha registrada</span><ArrowRight className="h-4 w-4" /></Link>)}
            {projetos.filter(project => project.status === 'orcamento').slice(0, 3).map(project => <Link key={project.id} to="/cliente/projetos" className="flex items-center justify-between rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-3 text-sm text-indigo-200"><span>Orçamento aguardando: {project.nomePeca}</span><ArrowRight className="h-4 w-4" /></Link>)}
            {!attentionCount && !operational.failureEvents.length && <p className="flex items-center gap-2 py-2 text-sm text-emerald-300"><CheckCircle2 className="h-4 w-4" />Tudo em ordem por enquanto.</p>}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="rounded-2xl border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between"><div><h3 className="font-bold text-white">Índice de saúde da farm</h3><p className="text-xs text-slate-400">Resumo operacional calculado a partir dos alertas cadastrados</p></div><span className={`rounded-xl px-3 py-2 text-lg font-black ${operational.healthScore >= 80 ? 'bg-emerald-500/10 text-emerald-300' : operational.healthScore >= 50 ? 'bg-amber-500/10 text-amber-200' : 'bg-rose-500/10 text-rose-300'}`}>{operational.healthScore} · {operational.healthLabel}</span></div>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3"><HealthFact label="Produção agora" value={`${printing}/${impressoras.length} imprimindo`} /><HealthFact label="Estoque baixo" value={`${lowStock.length} materiais`} /><HealthFact label="Manutenção próxima" value={`${operational.maintenanceDue.length} impressoras`} /><HealthFact label="Prazos vencidos" value={`${operational.overdueProjects.length} projetos`} /><HealthFact label="Falhas no histórico" value={operational.failureEvents.length ? `${operational.failureEvents.length} eventos` : 'Sem registros'} /><HealthFact label="Margem concluída" value={`${overview.margin.toFixed(1)}%`} /></div>
          <p className="mt-3 text-[11px] text-slate-500">Regra transparente: parte de 100 pontos e desconta alertas de impressora, estoque, prazo, manutenção e falhas registradas. Não representa uma auditoria de qualidade.</p>
        </Card>
        <Card className="rounded-2xl border-slate-800 bg-slate-900 p-5">
          <div className="flex items-center justify-between"><div><h3 className="font-bold text-white">Desperdício e qualidade</h3><p className="text-xs text-slate-400">Acompanhamento do material e de falhas registradas</p></div><AlertTriangle className="h-4 w-4 text-amber-400" /></div>
          <div className="mt-4 grid grid-cols-2 gap-3"><div className="rounded-xl bg-slate-950 p-3"><p className="text-xs text-slate-500">Material baixado</p><strong className="mt-1 block text-lg text-cyan-300">{operational.materialKg.toFixed(2)} kg</strong></div><div className="rounded-xl bg-slate-950 p-3"><p className="text-xs text-slate-500">Falhas registradas</p><strong className="mt-1 block text-lg text-amber-200">{operational.failureEvents.length || 'Sem dados'}</strong></div></div>
          <p className="mt-3 text-xs leading-relaxed text-slate-400">O sistema ainda não separa o material usado na peça, suportes e peças perdidas. Por isso, não calcula desperdício nem taxa de falha sem registros próprios.</p>
        </Card>
      </section>

      <Card className="rounded-2xl border-slate-800 bg-slate-900 p-5"><div className="flex flex-wrap items-center justify-between gap-2"><div><h3 className="font-bold text-white">Leitura administrativa</h3><p className="text-xs text-slate-400">Observações automáticas baseadas nos dados registrados; sem previsões inventadas.</p></div><Link to="/cliente/ia-copilot" className="text-xs font-semibold text-indigo-300">Abrir SPARTAN AI <ArrowRight className="inline h-3.5 w-3.5" /></Link></div><div className="mt-4 grid gap-2 sm:grid-cols-2">{[
        lowStock.length ? `${lowStock.length} material(is) abaixo do nível mínimo configurado.` : 'Nenhum material está abaixo do mínimo cadastrado.',
        operational.maintenanceDue.length ? `${operational.maintenanceDue.length} impressora(s) estão próximas do intervalo de manutenção.` : 'Nenhuma impressora atingiu 80% do intervalo de manutenção cadastrado.',
        operational.overdueProjects.length ? `${operational.overdueProjects.length} projeto(s) estão com entrega atrasada.` : 'Nenhum projeto ativo está atrasado.',
        overview.completed.length ? `A margem estimada dos projetos concluídos no período é ${overview.margin.toFixed(1)}%.` : 'Ainda não há projetos concluídos neste período para analisar a margem.',
      ].map((insight, index) => <p key={index} className="rounded-xl bg-slate-950 p-3 text-sm text-slate-300">{insight}</p>)}</div></Card>

      <section className="grid gap-3 sm:grid-cols-3"><QuickLink href="/cliente/estoque" icon={Layers} label="Abrir estoque" detail="Ver materiais e quantidades" /><QuickLink href="/cliente/projetos" icon={FolderKanban} label="Abrir projetos" detail={`${activeProjects} em andamento · ${projetos.length} no total`} /><QuickLink href="/cliente/calculadora" icon={Plus} label="Novo orçamento" detail="Calcular uma nova impressão" /></section>
    </div>}

    {isCalculadora && <Calculadora3D />}
    {isEstoque && <EstoqueFilamentos />}
    {isImpressoras && <ParqueImpressoras />}
    {isProjetos && <ProjetosManager />}
    {isAiCopilot && <SpartanAiAssistant />}
    {isPlanos && <ClientPlansPricing plans={plans} currentPlan={currentPlan} onUpgrade={handleUpgrade} />}
    {isFaturas && <ClientInvoicesList invoices={invoices} currentPlan={currentPlan} onOpenPixModal={openInvoiceCheckout} />}
    {isConfig && <ClientSettingsForm user={user} onUpdateUserProfile={updateUserProfile} />}
    <ClientUpgradeModal isOpen={upgradeModal} onClose={() => setUpgradeModal(false)} plans={plans} currentPlan={currentPlan} onUpgrade={handleUpgrade} />
  </DashboardLayout>;
};

const MetricCard: React.FC<{ icon: typeof Cpu; label: string; value: string; detail: string; tone: 'indigo' | 'cyan' | 'emerald' | 'amber' }> = ({ icon: Icon, label, value, detail, tone }) => {
  const colors = { indigo: 'text-indigo-400 bg-indigo-500/10', cyan: 'text-cyan-400 bg-cyan-500/10', emerald: 'text-emerald-400 bg-emerald-500/10', amber: 'text-amber-400 bg-amber-500/10' };
  return <Card className="rounded-2xl border-slate-800 bg-slate-900 p-4"><div className="flex items-center justify-between"><span className="text-sm text-slate-400">{label}</span><span className={`rounded-lg p-2 ${colors[tone]}`}><Icon className="h-4 w-4" /></span></div><p className="mt-3 text-2xl font-black text-white">{value}</p><p className="text-xs text-slate-500">{detail}</p></Card>;
};
const HealthFact: React.FC<{ label: string; value: string }> = ({ label, value }) => <div className="rounded-lg bg-slate-950 p-3"><p className="text-slate-500">{label}</p><strong className="mt-1 block text-slate-200">{value}</strong></div>;
const QuickLink: React.FC<{ href: string; icon: typeof Layers; label: string; detail: string }> = ({ href, icon: Icon, label, detail }) => <Link to={href} className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 hover:border-indigo-500/50"><span className="rounded-xl bg-indigo-500/10 p-2 text-indigo-300"><Icon className="h-4 w-4" /></span><span><strong className="block text-sm text-white">{label}</strong><span className="text-xs text-slate-400">{detail}</span></span><ArrowRight className="ml-auto h-4 w-4 text-slate-500" /></Link>;
const Empty: React.FC<{ text: string; href: string; action: string }> = ({ text, href, action }) => <div className="py-3"><p className="mb-3 text-sm text-slate-400">{text}</p><Link to={href} className="text-xs font-semibold text-indigo-300">{action} <ArrowRight className="inline h-3.5 w-3.5" /></Link></div>;

export default ClientPortal;
