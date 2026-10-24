"use client";

import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useSaaSData } from '@/context/SaaSDataContext';
import { useAuth } from '@/context/AuthContext';
import {
  TrendingUp,
  CircleDollarSign,
  Cpu,
  AlertTriangle,
  Clock3,
  CheckCircle2,
  XCircle,
  Layers,
  Wrench,
  ArrowRight,
  Play,
  Plus,
  RefreshCw,
  FolderKanban,
  Zap,
  Package,
  Calendar,
  AlertCircle,
  ChevronRight,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

const formatMoney = (val: number): string =>
  `R$ ${Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const formatDetailedMoney = (val: number): string =>
  `R$ ${Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatGrams = (val: number): string => {
  const g = Number(val || 0);
  if (g >= 1000) return `${(g / 1000).toFixed(2)} kg`;
  return `${g.toFixed(0)} g`;
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
  return totalSeconds > 720 * 3600 || isNaN(totalSeconds) || totalSeconds <= 0 ? 18 * 3600 : totalSeconds;
};

const formatSecondsToTime = (totalSeconds: number) => {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  return `${minutes}m`;
};

const dateInputValue = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const CentroDeComandoFarm: React.FC = () => {
  const { user } = useAuth();
  const { filamentos, impressoras, projetos, historicoImpressoras, refreshFarmData } = useSaaSData();

  const [periodDays, setPeriodDays] = useState<number>(30);
  const [customPeriod, setCustomPeriod] = useState(false);
  const [customStart, setCustomStart] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 29);
    return dateInputValue(date);
  });
  const [customEnd, setCustomEnd] = useState(() => dateInputValue(new Date()));
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshFarmData();
    } finally {
      setRefreshing(false);
    }
  };

  const todayIso = new Date();
  const todayKey = `${todayIso.getFullYear()}-${String(todayIso.getMonth() + 1).padStart(2, '0')}-${String(todayIso.getDate()).padStart(2, '0')}`;

  // Consolidação Financeira e Operacional Limpa
  const metrics = useMemo(() => {
    const now = new Date();
    const start = customPeriod ? new Date(`${customStart}T00:00:00`) : new Date(now);
    if (!customPeriod) start.setDate(now.getDate() - periodDays + 1);
    start.setHours(0, 0, 0, 0);
    const end = customPeriod ? new Date(`${customEnd}T23:59:59.999`) : new Date(now);

    const rangeDays = Math.max(1, Math.floor((new Date(dateInputValue(end)).getTime() - start.getTime()) / 86400000) + 1);

    // Projetos dentro do período selecionado
    const recentProjects = projetos.filter(p => {
      const pDate = new Date(`${p.dataCriacao}T00:00:00`);
      return pDate >= start && pDate <= end;
    });

    const completedProjects = recentProjects.filter(p => p.status === 'concluido');
    const inProductionProjects = projetos.filter(p => p.status === 'em_impressao');
    const approvedQueueProjects = projetos.filter(p => p.status === 'aprovado');
    const quotesProjects = recentProjects.filter(p => p.status === 'orcamento');
    const canceledProjects = recentProjects.filter(p => p.status === 'cancelado');

    // Faturamento e Custos com Consistência Matemática Rigorosa
    const revenue = completedProjects.reduce((sum, p) => sum + (Number(p.precoCobrado) || 0), 0);
    const cost = completedProjects.reduce((sum, p) => sum + (Number(p.custoTotal) || 0), 0);
    const profit = Math.max(0, revenue - cost);
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

    // Pedidos Atrasados e Prazos em Risco
    const overdueProjects = projetos.filter(
      p => p.dataEntrega && p.dataEntrega < todayKey && !['concluido', 'cancelado'].includes(p.status)
    );
    const upcomingDeadlines = projetos
      .filter(
        p =>
          p.dataEntrega &&
          p.dataEntrega >= todayKey &&
          p.dataEntrega <= new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10) &&
          !['concluido', 'cancelado'].includes(p.status)
      )
      .sort((a, b) => (a.dataEntrega || '').localeCompare(b.dataEntrega || ''));

    // Situação das Impressoras
    const totalPrinters = impressoras.length;
    const printingPrinters = impressoras.filter(p => p.status === 'imprimindo');
    const pausedPrinters = impressoras.filter(p => p.status === 'pausada');
    const availablePrinters = impressoras.filter(p => p.status === 'disponivel');
    const maintenancePrinters = impressoras.filter(p => p.status === 'manutencao' || p.status === 'desconectada');
    const occupiedCount = printingPrinters.length + pausedPrinters.length;
    const occupancyRate = totalPrinters > 0 ? Math.round((occupiedCount / totalPrinters) * 100) : 0;

    // Alertas Críticos de Atenção
    const lowStockFilaments = filamentos.filter(item => item.pesoRestanteG <= (item.pesoMinimoG ?? 200));
    const maintenanceDuePrinters = impressoras.filter(
      p =>
        (p.intervaloManutencaoHoras || 0) > 0 &&
        (p.horasDesdeManutencao || 0) / (p.intervaloManutencaoHoras || 1) >= 0.8
    );

    // Perdas reais em cancelamentos e desperdício de material
    const canceledGrams = canceledProjects.reduce((sum, p) => sum + (p.pesoEstimadoG || 0), 0);
    const canceledCost = canceledProjects.reduce((sum, p) => sum + (p.custoMaterial || p.custoTotal || 0), 0);

    // Próximo projeto recomendado para imprimir (Fila de Produção)
    const nextProjectToPrint = approvedQueueProjects.length > 0
      ? approvedQueueProjects.sort((a, b) => {
          if (a.dataEntrega && b.dataEntrega) return a.dataEntrega.localeCompare(b.dataEntrega);
          if (a.dataEntrega) return -1;
          if (b.dataEntrega) return 1;
          return (b.precoCobrado || 0) - (a.precoCobrado || 0);
        })[0]
      : null;

    // Série temporal limpa para o gráfico de faturamento, custo e lucro
    const stepDays = Math.max(1, Math.ceil(rangeDays / 30));
    const dailyChartData = Array.from({ length: Math.ceil(rangeDays / stepDays) }, (_, idx) => {
      const bStart = new Date(start);
      bStart.setDate(start.getDate() + idx * stepDays);
      const bEnd = new Date(bStart);
      bEnd.setDate(bStart.getDate() + stepDays - 1);
      if (bEnd > end) bEnd.setTime(end.getTime());

      const sKey = dateInputValue(bStart);
      const eKey = dateInputValue(bEnd);

      const bucketItems = completedProjects.filter(p => p.dataCriacao >= sKey && p.dataCriacao <= eKey);
      const bRevenue = bucketItems.reduce((acc, p) => acc + (p.precoCobrado || 0), 0);
      const bCost = bucketItems.reduce((acc, p) => acc + (p.custoTotal || 0), 0);
      const bProfit = Math.max(0, bRevenue - bCost);

      return {
        date: bStart.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
        faturamento: bRevenue,
        custos: bCost,
        lucro: bProfit,
      };
    });

    // Top 4 Produtos mais rentáveis
    const topProfitableProducts = [...completedProjects]
      .sort((a, b) => (b.lucroLiquido || b.precoCobrado - b.custoTotal) - (a.lucroLiquido || a.precoCobrado - a.custoTotal))
      .slice(0, 4);

    return {
      revenue,
      cost,
      profit,
      margin,
      completedCount: completedProjects.length,
      overdueProjects,
      upcomingDeadlines,
      totalPrinters,
      printingPrinters,
      pausedPrinters,
      availablePrinters,
      maintenancePrinters,
      occupiedCount,
      occupancyRate,
      lowStockFilaments,
      maintenanceDuePrinters,
      canceledGrams,
      canceledCost,
      nextProjectToPrint,
      dailyChartData,
      topProfitableProducts,
    };
  }, [projetos, impressoras, filamentos, periodDays, customPeriod, customStart, customEnd, todayKey]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* 1. CABEÇALHO DO CENTRO DE COMANDO */}
      <section className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/60 p-4 sm:p-5 rounded-2xl border border-slate-800 backdrop-blur-sm">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h2 className="text-lg font-bold text-white tracking-tight">
              Centro de Comando · {user?.companyName || 'Minha Farm 3D'}
            </h2>
            <Badge variant="outline" className="text-[10px] border-emerald-500/30 bg-emerald-500/10 text-emerald-300 font-semibold">
              Operação Monitorada
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Status operacional em tempo real, rentabilidade e prioridades para a tomada de decisão.
          </p>
        </div>

        {/* Seletor Rápido de Período */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs">
            <button
              onClick={() => { setPeriodDays(1); setCustomPeriod(false); }}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${!customPeriod && periodDays === 1 ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Hoje
            </button>
            <button
              onClick={() => { setPeriodDays(7); setCustomPeriod(false); }}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${!customPeriod && periodDays === 7 ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              7 dias
            </button>
            <button
              onClick={() => { setPeriodDays(30); setCustomPeriod(false); }}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${!customPeriod && periodDays === 30 ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              30 dias
            </button>
            <button
              onClick={() => { setPeriodDays(90); setCustomPeriod(false); }}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${!customPeriod && periodDays === 90 ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              90 dias
            </button>
            <button
              onClick={() => setCustomPeriod(true)}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${customPeriod ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Personalizado
            </button>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => void handleRefresh()}
            disabled={refreshing}
            className="h-8 border-slate-700 bg-slate-950 text-xs text-slate-200 hover:border-indigo-500"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {customPeriod && (
          <div className="w-full flex items-center justify-end gap-2 text-xs text-slate-400 pt-2 border-t border-slate-800/80">
            <span>De:</span>
            <input
              type="date"
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-white text-xs"
            />
            <span>Até:</span>
            <input
              type="date"
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-white text-xs"
            />
          </div>
        )}
      </section>

      {/* 2. PRIMEIRA DOBRA: OS 4 INDICADORES PRINCIPAIS OBJETIVOS COM DESIGN EXECUTIVO */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Lucro Líquido Estimado */}
        <Link to="/cliente/financeiro" className="block group">
          <Card className="bg-slate-900 border border-emerald-500/30 rounded-2xl shadow-lg group-hover:border-emerald-500/60 transition-all">
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs uppercase tracking-wider">
                  <TrendingUp className="w-4 h-4" />
                  <span>Lucro Estimado</span>
                </div>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] font-bold">
                  {metrics.margin.toFixed(0)}% Margem
                </Badge>
              </div>
              <div>
                <p className="text-2xl lg:text-3xl font-black text-emerald-400">
                  {formatMoney(metrics.profit)}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Lucro líquido livre dos custos cadastrados
                </p>
              </div>
              <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Ver financeiro</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400 transition-colors" />
              </div>
            </div>
          </Card>
        </Link>

        {/* Card 2: Faturamento Concluído */}
        <Link to="/cliente/financeiro" className="block group">
          <Card className="bg-slate-900 border border-indigo-500/30 rounded-2xl shadow-lg group-hover:border-indigo-500/60 transition-all">
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-indigo-400 font-semibold text-xs uppercase tracking-wider">
                  <CircleDollarSign className="w-4 h-4" />
                  <span>Faturamento Concluído</span>
                </div>
                <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 text-[10px] font-bold">
                  {metrics.completedCount} entregues
                </Badge>
              </div>
              <div>
                <p className="text-2xl lg:text-3xl font-black text-white">
                  {formatMoney(metrics.revenue)}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Custo total absorvido: {formatMoney(metrics.cost)}
                </p>
              </div>
              <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Detalhamento contábil</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 transition-colors" />
              </div>
            </div>
          </Card>
        </Link>

        {/* Card 3: Impressoras Ocupadas */}
        <Link to="/cliente/impressoras" className="block group">
          <Card className="bg-slate-900 border border-sky-500/30 rounded-2xl shadow-lg group-hover:border-sky-500/60 transition-all">
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-sky-400 font-semibold text-xs uppercase tracking-wider">
                  <Cpu className="w-4 h-4" />
                  <span>Parque em Produção</span>
                </div>
                <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/30 text-[10px] font-bold">
                  {metrics.occupancyRate}% Ocupação
                </Badge>
              </div>
              <div>
                <p className="text-2xl lg:text-3xl font-black text-white">
                  {metrics.occupiedCount} de {metrics.totalPrinters}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {metrics.printingPrinters.length} imprimindo · {metrics.availablePrinters.length} livre(s)
                </p>
              </div>
              <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Gerenciar máquinas</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-sky-400 transition-colors" />
              </div>
            </div>
          </Card>
        </Link>

        {/* Card 4: Pedidos em Risco & Prazos */}
        <Link to="/cliente/projetos" className="block group">
          <Card className={`bg-slate-900 rounded-2xl shadow-lg transition-all border ${
            metrics.overdueProjects.length > 0
              ? 'border-rose-500/40 group-hover:border-rose-500/70'
              : 'border-amber-500/30 group-hover:border-amber-500/60'
          }`}>
            <div className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className={`flex items-center gap-1.5 font-semibold text-xs uppercase tracking-wider ${
                  metrics.overdueProjects.length > 0 ? 'text-rose-400' : 'text-amber-400'
                }`}>
                  <Clock3 className="w-4 h-4" />
                  <span>Prazos & Pedidos</span>
                </div>
                <Badge className={`text-[10px] font-bold ${
                  metrics.overdueProjects.length > 0
                    ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                    : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                }`}>
                  {metrics.overdueProjects.length > 0 ? 'Atrasos Ativos' : 'Prazos em Dia'}
                </Badge>
              </div>
              <div>
                <p className={`text-2xl lg:text-3xl font-black ${
                  metrics.overdueProjects.length > 0 ? 'text-rose-400' : 'text-emerald-400'
                }`}>
                  {metrics.overdueProjects.length > 0 ? `${metrics.overdueProjects.length} atrasado(s)` : '0 atrasos'}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {metrics.upcomingDeadlines.length > 0
                    ? `${metrics.upcomingDeadlines.length} entrega(s) nos próximos 3 dias`
                    : 'Fila de pedidos sem risco de estouro de prazo'}
                </p>
              </div>
              <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
                <span>Ver pedidos e fila</span>
                <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white transition-colors" />
              </div>
            </div>
          </Card>
        </Link>
      </section>

      {/* 3. SEGUNDA DOBRA: "SUA OPERAÇÃO AGORA" (SITUAÇÃO DA PRINT FARM EM PRIMEIRO PLANO) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-400" />
              Sua Operação Agora
            </h3>
            <p className="text-xs text-slate-400">
              Acompanhamento direto das máquinas e decisão de qual impressão iniciar a seguir.
            </p>
          </div>
          <Link
            to="/cliente/impressoras"
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
          >
            Ver todas as impressoras <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid gap-3.5 lg:grid-cols-3">
          {/* Coluna 1 & 2: Impressoras Ativas em Produção */}
          <div className="lg:col-span-2 space-y-3">
            {metrics.printingPrinters.length === 0 && metrics.pausedPrinters.length === 0 ? (
              <Card className="p-6 bg-slate-900 border-slate-800 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Todas as impressoras estão disponíveis</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Nenhuma máquina está ocupada no momento. Selecione o próximo projeto aprovado para iniciar.
                    </p>
                  </div>
                </div>
                <Link to="/cliente/projetos">
                  <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-xl font-bold">
                    <Play className="w-3.5 h-3.5 mr-1.5" /> Iniciar Impressão
                  </Button>
                </Link>
              </Card>
            ) : (
              [...metrics.printingPrinters, ...metrics.pausedPrinters].map(printer => {
                const project = projetos.find(p => p.id === printer.projetoAtualId);
                const progress = Math.min(100, Math.max(0, printer.progressoPercentual ?? 0));
                const rawTime = project?.tempoEstimadoHoras ?? 18;
                const totalSec = parseAndSanitizeEstimatedSeconds(rawTime);
                const remSec = Math.max(0, Math.round(totalSec * (1 - progress / 100)));

                return (
                  <Card key={printer.id} className="p-4 bg-slate-900 border-slate-800 rounded-2xl space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-white truncate">🖨️ {printer.nome}</h4>
                          <span className="text-[11px] text-slate-500">· {printer.modelo}</span>
                        </div>
                        <p className="text-xs text-slate-300 font-medium truncate mt-0.5">
                          Peça: <span className="text-white">{printer.projetoAtual || project?.nomePeca || 'Projeto em andamento'}</span>
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${printer.status === 'imprimindo' ? 'border-sky-500/30 bg-sky-500/10 text-sky-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-300'}`}
                        >
                          {printer.status === 'imprimindo' ? 'Imprimindo' : 'Pausada'}
                        </Badge>
                        <span className="text-[11px] text-slate-400 block mt-1">
                          ~{formatSecondsToTime(remSec)} restantes
                        </span>
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                        <span>Progresso informado</span>
                        <strong className="text-sky-300">{progress.toFixed(1)}%</strong>
                      </div>
                      <Progress value={progress} className="h-2 bg-slate-800 [&>div]:bg-sky-500" />
                    </div>
                  </Card>
                );
              })
            )}
          </div>

          {/* Coluna 3: Próxima Impressão Recomendada na Fila */}
          <div>
            <Card className="p-4 bg-slate-900 border-slate-800 rounded-2xl h-full flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <FolderKanban className="w-3.5 h-3.5 text-amber-400" />
                    Próxima Impressão na Fila
                  </span>
                  <Badge variant="outline" className="text-[10px] border-slate-700 bg-slate-950 text-slate-400">
                    Aprovados
                  </Badge>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Ordem recomendada por prazo de entrega e disponibilidade.
                </p>

                {metrics.nextProjectToPrint ? (
                  <div className="mt-3 p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                    <div className="flex justify-between items-start gap-2">
                      <strong className="text-xs text-white truncate block">
                        {metrics.nextProjectToPrint.nomePeca}
                      </strong>
                      <span className="text-xs font-bold text-emerald-400 shrink-0">
                        {formatMoney(metrics.nextProjectToPrint.precoCobrado)}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 flex items-center justify-between">
                      <span>Cliente: {metrics.nextProjectToPrint.clienteNome || 'Não informado'}</span>
                      <span>~{metrics.nextProjectToPrint.tempoEstimadoHoras}h de impressão</span>
                    </div>

                    {metrics.nextProjectToPrint.dataEntrega && (
                      <div className="text-[10px] text-amber-300 font-medium">
                        Prazo: {new Date(`${metrics.nextProjectToPrint.dataEntrega}T00:00:00`).toLocaleDateString('pt-BR')}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="mt-3 p-4 bg-slate-950 rounded-xl border border-slate-800 text-center text-xs text-slate-500">
                    Nenhum projeto aprovado aguardando na fila.
                  </div>
                )}
              </div>

              <div className="pt-2">
                {metrics.nextProjectToPrint ? (
                  <Link to="/cliente/projetos" className="w-full block">
                    <Button size="sm" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl">
                      <Play className="w-3.5 h-3.5 mr-1.5" /> Iniciar Produção Deste Pedido
                    </Button>
                  </Link>
                ) : (
                  <Link to="/cliente/calculadora" className="w-full block">
                    <Button size="sm" variant="outline" className="w-full border-slate-700 bg-slate-950 text-xs text-slate-200 hover:text-white rounded-xl">
                      <Plus className="w-3.5 h-3.5 mr-1.5" /> Criar Novo Orçamento
                    </Button>
                  </Link>
                )}
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* 4. TERCEIRA DOBRA: "O QUE PRECISA DA SUA ATENÇÃO HOJE?" (ALERTAS E DECISÕES) */}
      <section className="space-y-3">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            O Que Precisa da Sua Atenção Hoje?
          </h3>
          <p className="text-xs text-slate-400">
            Avisos preventivos para evitar atrasos na entrega e perdas de material.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Alerta 1: Estoque Baixo */}
          <Link to="/cliente/estoque" className="block group">
            <Card className="p-3.5 bg-slate-900 border-slate-800 rounded-2xl group-hover:border-amber-500/50 transition-all h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-amber-400" /> Estoque de Filamento
                  </span>
                  {metrics.lowStockFilaments.length > 0 && (
                    <Badge variant="outline" className="text-[10px] border-amber-500/30 bg-amber-500/10 text-amber-300">
                      {metrics.lowStockFilaments.length} baixo(s)
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  {metrics.lowStockFilaments.length > 0
                    ? `${metrics.lowStockFilaments[0].tipo} ${metrics.lowStockFilaments[0].cor}: restam ${metrics.lowStockFilaments[0].pesoRestanteG}g`
                    : 'Nenhum carretel abaixo do estoque mínimo.'}
                </p>
              </div>
              <span className="text-[11px] text-indigo-400 font-semibold group-hover:underline mt-2 flex items-center gap-1">
                Ver estoque <ArrowRight className="w-3 h-3" />
              </span>
            </Card>
          </Link>

          {/* Alerta 2: Pedidos Atrasados */}
          <Link to="/cliente/projetos" className="block group">
            <Card className="p-3.5 bg-slate-900 border-slate-800 rounded-2xl group-hover:border-rose-500/50 transition-all h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <Clock3 className="w-3.5 h-3.5 text-rose-400" /> Prazos de Entrega
                  </span>
                  {metrics.overdueProjects.length > 0 && (
                    <Badge variant="outline" className="text-[10px] border-rose-500/30 bg-rose-500/10 text-rose-300">
                      Atrasado
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  {metrics.overdueProjects.length > 0
                    ? `${metrics.overdueProjects[0].nomePeca}: prazo vencido em ${metrics.overdueProjects[0].dataEntrega}`
                    : 'Todos os pedidos em produção estão dentro do prazo.'}
                </p>
              </div>
              <span className="text-[11px] text-indigo-400 font-semibold group-hover:underline mt-2 flex items-center gap-1">
                Ver pedidos <ArrowRight className="w-3 h-3" />
              </span>
            </Card>
          </Link>

          {/* Alerta 3: Desperdício de Material */}
          <Link to="/cliente/financeiro" className="block group">
            <Card className="p-3.5 bg-slate-900 border-slate-800 rounded-2xl group-hover:border-cyan-500/50 transition-all h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-cyan-400" /> Perdas & Desperdício
                  </span>
                  {metrics.canceledGrams > 0 && (
                    <Badge variant="outline" className="text-[10px] border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                      {formatGrams(metrics.canceledGrams)}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  {metrics.canceledGrams > 0
                    ? `Perda financeira de ${formatMoney(metrics.canceledCost)} em cancelamentos/falhas`
                    : 'Nenhum cancelamento com perda de filamento no período.'}
                </p>
              </div>
              <span className="text-[11px] text-indigo-400 font-semibold group-hover:underline mt-2 flex items-center gap-1">
                Auditar perdas <ArrowRight className="w-3 h-3" />
              </span>
            </Card>
          </Link>

          {/* Alerta 4: Manutenções Pendentes */}
          <Link to="/cliente/impressoras" className="block group">
            <Card className="p-3.5 bg-slate-900 border-slate-800 rounded-2xl group-hover:border-orange-500/50 transition-all h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5 text-orange-400" /> Manutenção Preventiva
                  </span>
                  {metrics.maintenanceDuePrinters.length > 0 && (
                    <Badge variant="outline" className="text-[10px] border-orange-500/30 bg-orange-500/10 text-orange-300">
                      Revisão
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  {metrics.maintenanceDuePrinters.length > 0
                    ? `${metrics.maintenanceDuePrinters[0].nome} atingiu 80% do intervalo de lubrificação.`
                    : 'Todas as impressoras estão com manutenção e eixos em dia.'}
                </p>
              </div>
              <span className="text-[11px] text-indigo-400 font-semibold group-hover:underline mt-2 flex items-center gap-1">
                Ver revisões <ArrowRight className="w-3 h-3" />
              </span>
            </Card>
          </Link>
        </div>
      </section>

      {/* 5. QUARTA DOBRA: DESEMPENHO LIMPO & PRODUTOS MAIS RENTÁVEIS */}
      <section className="grid gap-4 lg:grid-cols-3">
        {/* Gráfico Simplificado de Desempenho (2 colunas) */}
        <Card className="lg:col-span-2 p-5 bg-slate-900 border-slate-800 rounded-2xl space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h3 className="font-bold text-white text-sm">Desempenho da Farm (Faturamento, Custos e Lucro)</h3>
              <p className="text-xs text-slate-400">Valores faturados e apurados ao longo do tempo sem curvas artificiais.</p>
            </div>
            <Link to="/cliente/financeiro" className="text-xs font-semibold text-indigo-400 hover:text-indigo-300">
              Ver Financeiro & Lucro →
            </Link>
          </div>

          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metrics.dailyChartData}>
                <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" stroke="#64748b" tick={{ fill: '#94a3b8', fontSize: 10 }} />
                <YAxis
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 10 }}
                  tickFormatter={val => `R$${val}`}
                  width={55}
                />
                <Tooltip
                  formatter={(val: number) => formatDetailedMoney(val)}
                  contentStyle={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 12, color: '#e2e8f0' }}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                <Line type="monotone" dataKey="faturamento" name="Faturamento (R$)" stroke="#818cf8" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="custos" name="Custos (R$)" stroke="#fb7185" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="lucro" name="Lucro Estimado (R$)" stroke="#34d399" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Top 4 Produtos Mais Rentáveis (1 coluna) */}
        <Card className="p-5 bg-slate-900 border-slate-800 rounded-2xl space-y-3.5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-white text-sm">Produtos Mais Rentáveis</h3>
              <span className="text-[10px] text-slate-500">Concluídos</span>
            </div>
            <p className="text-xs text-slate-400">
              Peças que geraram o maior lucro líquido no período.
            </p>

            <div className="space-y-2.5 mt-3">
              {metrics.topProfitableProducts.length === 0 ? (
                <p className="text-xs text-slate-500 py-6 text-center">
                  Conclua impressões para rankear as peças mais lucrativas.
                </p>
              ) : (
                metrics.topProfitableProducts.map(p => {
                  const lucro = p.lucroLiquido || (p.precoCobrado - p.custoTotal);
                  const margem = p.precoCobrado > 0 ? (lucro / p.precoCobrado) * 100 : 0;
                  return (
                    <div key={p.id} className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <strong className="text-white block truncate" title={p.nomePeca}>
                          {p.nomePeca}
                        </strong>
                        <span className="text-[10px] text-slate-500">
                          Preço: {formatMoney(p.precoCobrado)}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <strong className="text-emerald-400 block font-bold">
                          +{formatMoney(lucro)}
                        </strong>
                        <span className="text-[10px] text-slate-400">
                          {margem.toFixed(0)}% margem
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800">
            <Link
              to="/cliente/financeiro"
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center justify-between w-full"
            >
              <span>Abrir fluxo financeiro completo</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </Card>
      </section>
    </div>
  );
};
