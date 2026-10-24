"use client";

import React, { useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useSaaSData } from '@/context/SaaSDataContext';
import { ProjetoImpressao3D } from '@/types/saas';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  CreditCard,
  QrCode,
  Banknote,
  Calendar,
  AlertTriangle,
  FolderKanban,
  Zap,
  Package,
  Layers,
  Wrench,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Percent,
  Clock,
  CheckCircle2,
  XCircle,
  Clock3,
} from 'lucide-react';

const formatMoney = (val: number): string =>
  `R$ ${Number(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const formatGrams = (val: number): string => {
  const g = Number(val || 0);
  if (g >= 1000) return `${(g / 1000).toFixed(2)} kg`;
  return `${g.toFixed(0)} g`;
};

type PeriodPreset = 'hoje' | '7dias' | 'mes_atual' | 'mes_anterior' | 'ano_atual' | 'todos' | 'custom';

export const FinanceiroFarm: React.FC = () => {
  const { projetos, filamentos, impressoras, historicoImpressoras } = useSaaSData();

  // Estados dos Filtros
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('mes_atual');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'concluido' | 'em_impressao' | 'aprovado' | 'cancelado' | 'orcamento'>('todos');
  const [paymentFilter, setPaymentFilter] = useState<'todos' | 'pix' | 'credito' | 'debito' | 'dinheiro'>('todos');
  const [searchQuery, setSearchQuery] = useState('');

  // Datas para o filtro customizado
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date(today.getFullYear(), today.getMonth(), 1);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(todayStr);

  // Manipulador de troca de presets
  const handlePresetChange = (preset: PeriodPreset) => {
    setPeriodPreset(preset);
    const now = new Date();
    if (preset === 'hoje') {
      const s = now.toISOString().slice(0, 10);
      setStartDate(s);
      setEndDate(s);
    } else if (preset === '7dias') {
      const past = new Date(now);
      past.setDate(now.getDate() - 6);
      setStartDate(past.toISOString().slice(0, 10));
      setEndDate(now.toISOString().slice(0, 10));
    } else if (preset === 'mes_atual') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(firstDay.toISOString().slice(0, 10));
      setEndDate(now.toISOString().slice(0, 10));
    } else if (preset === 'mes_anterior') {
      const firstPrev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastPrev = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(firstPrev.toISOString().slice(0, 10));
      setEndDate(lastPrev.toISOString().slice(0, 10));
    } else if (preset === 'ano_atual') {
      const firstYear = new Date(now.getFullYear(), 0, 1);
      setStartDate(firstYear.toISOString().slice(0, 10));
      setEndDate(now.toISOString().slice(0, 10));
    } else if (preset === 'todos') {
      setStartDate('2020-01-01');
      setEndDate(now.toISOString().slice(0, 10));
    }
  };

  // Filtragem dos projetos com base nas datas e filtros
  const filteredProjects = useMemo(() => {
    return projetos.filter(proj => {
      // 1. Filtro por data de criação
      const projDate = (proj.dataCriacao || '').slice(0, 10);
      if (periodPreset !== 'todos') {
        if (startDate && projDate < startDate) return false;
        if (endDate && projDate > endDate) return false;
      }

      // 2. Filtro por status
      if (statusFilter !== 'todos' && proj.status !== statusFilter) return false;

      // 3. Filtro por forma de pagamento
      if (paymentFilter !== 'todos') {
        const pay = proj.formaPagamento?.toLowerCase();
        if (pay !== paymentFilter) return false;
      }

      // 4. Busca textual
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = proj.nomePeca.toLowerCase().includes(q);
        const matchesClient = (proj.clienteNome || '').toLowerCase().includes(q);
        if (!matchesName && !matchesClient) return false;
      }

      return true;
    });
  }, [projetos, periodPreset, startDate, endDate, statusFilter, paymentFilter, searchQuery]);

  // Cálculos consolidados dos projetos filtrados
  const financialMetrics = useMemo(() => {
    // Projetos concluídos (receita efetivamente realizada)
    const completedProjects = filteredProjects.filter(p => p.status === 'concluido');
    
    // Projetos ativos/em produção/aprovados (a receber)
    const pendingProductionProjects = filteredProjects.filter(p => p.status === 'em_impressao' || p.status === 'aprovado');
    
    // Orçamentos em negociação
    const quotesProjects = filteredProjects.filter(p => p.status === 'orcamento');

    // Projetos cancelados (perdas)
    const canceledProjects = filteredProjects.filter(p => p.status === 'cancelado');

    // Métricas financeiras de projetos CONCLUÍDOS
    const totalReceitaConcluida = completedProjects.reduce((acc, p) => acc + (Number(p.precoCobrado) || 0), 0);
    const totalCustoMaterial = completedProjects.reduce((acc, p) => acc + (Number(p.custoMaterial) || 0), 0);
    const totalCustoEnergia = completedProjects.reduce((acc, p) => acc + (Number(p.custoEnergia) || 0), 0);
    const totalCustoDepreciacao = completedProjects.reduce((acc, p) => acc + (Number(p.custoDepreciacao) || 0), 0);
    const totalCustoMaoDeObra = completedProjects.reduce((acc, p) => acc + (Number(p.custoMaoDeObra) || 0), 0);
    const totalOutrosCustos = completedProjects.reduce((acc, p) => acc + (Number(p.outrosCustos) || 0), 0);
    const totalEmbalagemBrinde = completedProjects.reduce(
      (acc, p) => acc + (Number(p.custoEmbalagem) || 0) + (Number(p.custoBrinde) || 0),
      0
    );
    const totalFrete = completedProjects.reduce((acc, p) => acc + (Number(p.valorFrete) || 0), 0);

    const totalCustosConcluidos =
      totalCustoMaterial +
      totalCustoEnergia +
      totalCustoDepreciacao +
      totalCustoMaoDeObra +
      totalOutrosCustos +
      totalEmbalagemBrinde;

    const totalLucroLiquido = totalReceitaConcluida - totalCustosConcluidos - totalFrete;
    const margemMediaPercent = totalReceitaConcluida > 0 ? (totalLucroLiquido / totalReceitaConcluida) * 100 : 0;

    // Métricas de produção ativa (em andamento)
    const receitaEmAndamento = pendingProductionProjects.reduce((acc, p) => acc + (Number(p.precoCobrado) || 0), 0);
    const custoEmAndamento = pendingProductionProjects.reduce((acc, p) => acc + (Number(p.custoTotal) || 0), 0);
    const lucroPrevistoEmAndamento = receitaEmAndamento - custoEmAndamento;

    // Métricas de orçamentos (pipeline comercial)
    const valorTotalOrcamentos = quotesProjects.reduce((acc, p) => acc + (Number(p.precoCobrado) || 0), 0);

    // Métricas de PERDAS (projetos cancelados que baixaram estoque ou falharam)
    const perdasMaterialGramas = canceledProjects.reduce((acc, p) => acc + (Number(p.pesoEstimadoG) || 0), 0);
    const perdasCustoFinanceiro = canceledProjects.reduce((acc, p) => acc + (Number(p.custoMaterial) || Number(p.custoTotal) || 0), 0);

    // Distribuição por Forma de Pagamento (somente sobre pedidos faturados/concluídos e ativos)
    const revenueByPayment: Record<string, { total: number; count: number }> = {
      pix: { total: 0, count: 0 },
      credito: { total: 0, count: 0 },
      debito: { total: 0, count: 0 },
      dinheiro: { total: 0, count: 0 },
      outros: { total: 0, count: 0 },
    };

    [...completedProjects, ...pendingProductionProjects].forEach(p => {
      const method = (p.formaPagamento?.toLowerCase() || 'outros') as keyof typeof revenueByPayment;
      const target = revenueByPayment[method] ? method : 'outros';
      revenueByPayment[target].total += Number(p.precoCobrado) || 0;
      revenueByPayment[target].count += 1;
    });

    return {
      completedCount: completedProjects.length,
      pendingCount: pendingProductionProjects.length,
      quotesCount: quotesProjects.length,
      canceledCount: canceledProjects.length,
      totalReceitaConcluida,
      totalCustosConcluidos,
      totalLucroLiquido,
      margemMediaPercent,
      totalCustoMaterial,
      totalCustoEnergia,
      totalCustoDepreciacao,
      totalCustoMaoDeObra,
      totalOutrosCustos,
      totalEmbalagemBrinde,
      totalFrete,
      receitaEmAndamento,
      lucroPrevistoEmAndamento,
      valorTotalOrcamentos,
      perdasMaterialGramas,
      perdasCustoFinanceiro,
      revenueByPayment,
    };
  }, [filteredProjects]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Aba Financeira */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-emerald-400" />
            Controle Financeiro da Farm
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Visão contábil e de rentabilidade real dos projetos, custos operacionais, formas de pagamento e perdas.
          </p>
        </div>

        {/* Seletor rápido de Período */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-900 border border-slate-800 p-1 rounded-xl">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handlePresetChange('hoje')}
            className={`text-xs h-7 px-2.5 rounded-lg ${periodPreset === 'hoje' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
          >
            Hoje
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handlePresetChange('7dias')}
            className={`text-xs h-7 px-2.5 rounded-lg ${periodPreset === '7dias' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
          >
            7 dias
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handlePresetChange('mes_atual')}
            className={`text-xs h-7 px-2.5 rounded-lg ${periodPreset === 'mes_atual' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
          >
            Este Mês
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handlePresetChange('mes_anterior')}
            className={`text-xs h-7 px-2.5 rounded-lg ${periodPreset === 'mes_anterior' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
          >
            Mês Anterior
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handlePresetChange('ano_atual')}
            className={`text-xs h-7 px-2.5 rounded-lg ${periodPreset === 'ano_atual' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
          >
            Este Ano
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => handlePresetChange('todos')}
            className={`text-xs h-7 px-2.5 rounded-lg ${periodPreset === 'todos' ? 'bg-indigo-600 text-white font-bold' : 'text-slate-400 hover:text-white'}`}
          >
            Tudo
          </Button>
        </div>
      </div>

      {/* Linha de Filtros Detalhados */}
      <Card className="p-4 bg-slate-900 border-slate-800 rounded-2xl grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 items-end">
        {/* Intervalo de Datas */}
        <div className="xl:col-span-4 sm:col-span-2">
          <label className="text-[11px] font-semibold text-slate-400 block mb-1.5">Intervalo de Datas</label>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
            <Input
              type="date"
              value={startDate}
              onChange={e => {
                setPeriodPreset('custom');
                setStartDate(e.target.value);
              }}
              className="h-9 text-xs bg-slate-950 border-slate-700 text-white min-w-0 [color-scheme:dark]"
            />
            <span className="text-slate-500 text-xs px-0.5 text-center">até</span>
            <Input
              type="date"
              value={endDate}
              onChange={e => {
                setPeriodPreset('custom');
                setEndDate(e.target.value);
              }}
              className="h-9 text-xs bg-slate-950 border-slate-700 text-white min-w-0 [color-scheme:dark]"
            />
          </div>
        </div>

        {/* Status do Projeto */}
        <div className="xl:col-span-3 sm:col-span-1">
          <label className="text-[11px] font-semibold text-slate-400 block mb-1.5">Status do Projeto</label>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as typeof statusFilter)}
            className="w-full h-9 text-xs rounded-lg bg-slate-950 border border-slate-700 text-slate-200 px-2.5 focus:outline-none focus:border-cyan-500"
          >
            <option value="todos">Todos os Status</option>
            <option value="concluido">Concluídos (Faturados)</option>
            <option value="em_impressao">Em Produção</option>
            <option value="aprovado">Aprovados</option>
            <option value="orcamento">Orçamentos</option>
            <option value="cancelado">Cancelados (Perdas)</option>
          </select>
        </div>

        {/* Forma de Pagamento */}
        <div className="xl:col-span-2 sm:col-span-1">
          <label className="text-[11px] font-semibold text-slate-400 block mb-1.5">Forma de Pagamento</label>
          <select
            value={paymentFilter}
            onChange={e => setPaymentFilter(e.target.value as typeof paymentFilter)}
            className="w-full h-9 text-xs rounded-lg bg-slate-950 border border-slate-700 text-slate-200 px-2.5 focus:outline-none focus:border-cyan-500"
          >
            <option value="todos">Todas as Formas</option>
            <option value="pix">Pix</option>
            <option value="credito">Cartão de Crédito</option>
            <option value="debito">Cartão de Débito</option>
            <option value="dinheiro">Dinheiro / Espécie</option>
          </select>
        </div>

        {/* Buscar Peça ou Cliente */}
        <div className="xl:col-span-3 sm:col-span-2">
          <label className="text-[11px] font-semibold text-slate-400 block mb-1.5">Buscar Peça ou Cliente</label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input
              placeholder="Ex: Luminária, João..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-9 pl-9 text-xs bg-slate-950 border-slate-700 text-white placeholder:text-slate-500 rounded-lg w-full"
            />
          </div>
        </div>
      </Card>

      {/* Cards de Métricas Principais com Design Executivo */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Receita Concluída */}
        <Card className="bg-slate-900 border border-emerald-500/30 rounded-2xl shadow-lg hover:border-emerald-500/50 transition-all">
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs uppercase tracking-wider">
                <TrendingUp className="w-4 h-4" />
                <span>Faturamento Realizado</span>
              </div>
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] font-bold">
                {financialMetrics.completedCount} peças
              </Badge>
            </div>
            <div>
              <p className="text-2xl lg:text-3xl font-black text-white">
                {formatMoney(financialMetrics.totalReceitaConcluida)}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Total bruto cobrado de pedidos entregues
              </p>
            </div>
            <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Projetos Faturados:</span>
              <span className="font-semibold text-emerald-400">
                100% finalizados
              </span>
            </div>
          </div>
        </Card>

        {/* Custos Operacionais */}
        <Card className="bg-slate-900 border border-rose-500/30 rounded-2xl shadow-lg hover:border-rose-500/50 transition-all">
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-rose-400 font-semibold text-xs uppercase tracking-wider">
                <TrendingDown className="w-4 h-4" />
                <span>Custos Operacionais</span>
              </div>
              <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/30 text-[10px] font-bold">
                Produção Real
              </Badge>
            </div>
            <div>
              <p className="text-2xl lg:text-3xl font-black text-rose-400">
                {formatMoney(financialMetrics.totalCustosConcluidos)}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Material, luz, desgaste de bico e insumos
              </p>
            </div>
            <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Despesas Totais:</span>
              <span className="font-semibold text-rose-400">
                {formatMoney(financialMetrics.totalCustosConcluidos)}
              </span>
            </div>
          </div>
        </Card>

        {/* Lucro Líquido Real */}
        <Card className="bg-slate-900 border border-indigo-500/30 rounded-2xl shadow-lg hover:border-indigo-500/50 transition-all">
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-indigo-400 font-semibold text-xs uppercase tracking-wider">
                <DollarSign className="w-4 h-4" />
                <span>Lucro Líquido Real</span>
              </div>
              <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 text-[10px] font-bold">
                {financialMetrics.margemMediaPercent.toFixed(1)}% Margem
              </Badge>
            </div>
            <div>
              <p className={`text-2xl lg:text-3xl font-black ${financialMetrics.totalLucroLiquido >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatMoney(financialMetrics.totalLucroLiquido)}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Dinheiro livre de custos no bolso
              </p>
            </div>
            <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Rentabilidade Média:</span>
              <span className="font-semibold text-emerald-400">
                {financialMetrics.margemMediaPercent.toFixed(0)}% de margem
              </span>
            </div>
          </div>
        </Card>

        {/* A Receber / Em Produção */}
        <Card className="bg-slate-900 border border-amber-500/30 rounded-2xl shadow-lg hover:border-amber-500/50 transition-all">
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-amber-400 font-semibold text-xs uppercase tracking-wider">
                <Clock className="w-4 h-4" />
                <span>A Receber / Em Curso</span>
              </div>
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px] font-bold">
                {financialMetrics.pendingCount} em aberto
              </Badge>
            </div>
            <div>
              <p className="text-2xl lg:text-3xl font-black text-amber-400">
                {formatMoney(financialMetrics.receitaEmAndamento)}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Lucro previsto: <strong className="text-slate-200">{formatMoney(financialMetrics.lucroPrevistoEmAndamento)}</strong>
              </p>
            </div>
            <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Status dos Pedidos:</span>
              <span className="font-semibold text-amber-300">
                Em fila ou impressão
              </span>
            </div>
          </div>
        </Card>
      </section>

      {/* Grid: Detalhamento de Custos & Formas de Pagamento & Perdas */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Bloco 1: Onde foi o dinheiro (Custos Reais de Produção) */}
        <Card className="p-5 bg-slate-900 border-slate-800 rounded-2xl space-y-3.5">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            Detalhamento de Custos (Concluídos)
          </h3>
          <p className="text-xs text-slate-400">
            Composição detalhada dos custos operacionais no período selecionado.
          </p>

          <div className="space-y-2.5 pt-1 text-xs">
            <div className="flex items-center justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" /> Filamento / Resina:
              </span>
              <strong className="text-white">{formatMoney(financialMetrics.totalCustoMaterial)}</strong>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" /> Energia Elétrica:
              </span>
              <strong className="text-white">{formatMoney(financialMetrics.totalCustoEnergia)}</strong>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Wrench className="w-3.5 h-3.5 text-sky-400" /> Depreciação de Máquina:
              </span>
              <strong className="text-white">{formatMoney(financialMetrics.totalCustoDepreciacao)}</strong>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-400" /> Mão de Obra Operacional:
              </span>
              <strong className="text-white">{formatMoney(financialMetrics.totalCustoMaoDeObra)}</strong>
            </div>

            <div className="flex items-center justify-between py-1 border-b border-slate-800">
              <span className="text-slate-400 flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-pink-400" /> Embalagem, Brindes & Extras:
              </span>
              <strong className="text-white">{formatMoney(financialMetrics.totalEmbalagemBrinde + financialMetrics.totalOutrosCustos)}</strong>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-700 font-bold text-sm">
              <span className="text-slate-300">Custo Total de Fabricação:</span>
              <span className="text-rose-400">{formatMoney(financialMetrics.totalCustosConcluidos)}</span>
            </div>
          </div>
        </Card>

        {/* Bloco 2: Recebimentos por Forma de Pagamento */}
        <Card className="p-5 bg-slate-900 border-slate-800 rounded-2xl space-y-3.5">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-indigo-400" />
            Recebimento por Forma de Pagamento
          </h3>
          <p className="text-xs text-slate-400">
            Volume bruto movimentado por cada meio de pagamento configurado na farm.
          </p>

          <div className="space-y-3 pt-1 text-xs">
            {/* Pix */}
            <div className="rounded-xl bg-slate-950 p-2.5 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <QrCode className="w-4 h-4" />
                </span>
                <div>
                  <strong className="text-white block">Pix</strong>
                  <span className="text-[10px] text-slate-500">{financialMetrics.revenueByPayment.pix.count} transação(ões)</span>
                </div>
              </div>
              <span className="text-sm font-bold text-emerald-300">
                {formatMoney(financialMetrics.revenueByPayment.pix.total)}
              </span>
            </div>

            {/* Cartão de Crédito */}
            <div className="rounded-xl bg-slate-950 p-2.5 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400">
                  <CreditCard className="w-4 h-4" />
                </span>
                <div>
                  <strong className="text-white block">Cartão de Crédito</strong>
                  <span className="text-[10px] text-slate-500">{financialMetrics.revenueByPayment.credito.count} transação(ões)</span>
                </div>
              </div>
              <span className="text-sm font-bold text-sky-300">
                {formatMoney(financialMetrics.revenueByPayment.credito.total)}
              </span>
            </div>

            {/* Cartão de Débito */}
            <div className="rounded-xl bg-slate-950 p-2.5 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
                  <CreditCard className="w-4 h-4" />
                </span>
                <div>
                  <strong className="text-white block">Cartão de Débito</strong>
                  <span className="text-[10px] text-slate-500">{financialMetrics.revenueByPayment.debito.count} transação(ões)</span>
                </div>
              </div>
              <span className="text-sm font-bold text-cyan-300">
                {formatMoney(financialMetrics.revenueByPayment.debito.total)}
              </span>
            </div>

            {/* Dinheiro */}
            <div className="rounded-xl bg-slate-950 p-2.5 border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
                  <Banknote className="w-4 h-4" />
                </span>
                <div>
                  <strong className="text-white block">Dinheiro / À Vista</strong>
                  <span className="text-[10px] text-slate-500">{financialMetrics.revenueByPayment.dinheiro.count} transação(ões)</span>
                </div>
              </div>
              <span className="text-sm font-bold text-amber-300">
                {formatMoney(financialMetrics.revenueByPayment.dinheiro.total)}
              </span>
            </div>
          </div>
        </Card>

        {/* Bloco 3: Perdas, Falhas e Desperdício */}
        <Card className="p-5 bg-slate-900 border-slate-800 rounded-2xl space-y-3.5">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Perdas e Desperdícios
          </h3>
          <p className="text-xs text-slate-400">
            Material perdido em cancelamentos e despesas decorrentes de falhas de impressão.
          </p>

          <div className="space-y-3 pt-1 text-xs">
            <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
              <span className="text-slate-400 block text-[11px]">Material Descartado em Cancelamentos</span>
              <strong className="text-lg font-black text-amber-300 block mt-0.5">
                {formatGrams(financialMetrics.perdasMaterialGramas)}
              </strong>
              <span className="text-[10px] text-slate-500 mt-1 block">
                {financialMetrics.canceledCount} projeto(s) cancelado(s) com baixa efetuada
              </span>
            </div>

            <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/20">
              <span className="text-slate-400 block text-[11px]">Custo Financeiro das Perdas</span>
              <strong className="text-lg font-black text-rose-300 block mt-0.5">
                {formatMoney(financialMetrics.perdasCustoFinanceiro)}
              </strong>
              <span className="text-[10px] text-slate-500 mt-1 block">
                Valor estimado do filamento e energia consumidos sem receita
              </span>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 leading-relaxed">
              💡 <strong>Dica de Rentabilidade:</strong> Reduzir a taxa de falha com calibração periódica da mesa e bico economiza até 12% nos custos diretos de filamento.
            </div>
          </div>
        </Card>
      </div>

      {/* Extrato Detalhado de Projetos do Período */}
      <Card className="p-5 bg-slate-900 border-slate-800 rounded-2xl space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div>
            <h3 className="font-bold text-white flex items-center gap-2 text-sm">
              <FolderKanban className="w-4 h-4 text-indigo-400" />
              Extrato Financeiro por Projeto ({filteredProjects.length})
            </h3>
            <p className="text-xs text-slate-400">
              Receita cobrada, custos totais calculados, lucro líquido e margem real de cada peça.
            </p>
          </div>

          <div className="text-xs text-slate-400">
            Total filtrado: <strong className="text-white">{formatMoney(filteredProjects.reduce((acc, p) => acc + (p.precoCobrado || 0), 0))}</strong>
          </div>
        </div>

        {filteredProjects.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500 bg-slate-950 rounded-xl border border-slate-800">
            Nenhum projeto encontrado para os filtros selecionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400">
                  <th className="py-2.5 px-3 font-semibold">Data</th>
                  <th className="py-2.5 px-3 font-semibold">Peça / Projeto</th>
                  <th className="py-2.5 px-3 font-semibold">Cliente</th>
                  <th className="py-2.5 px-3 font-semibold">Pagamento</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Preço Cobrado</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Custo Produção</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Lucro Líquido</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Margem %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredProjects.map(p => {
                  const lucro = Number(p.lucroLiquido ?? (p.precoCobrado - p.custoTotal));
                  const margem = p.precoCobrado > 0 ? (lucro / p.precoCobrado) * 100 : 0;
                  const dataFormatada = p.dataCriacao ? new Date(`${p.dataCriacao}T00:00:00`).toLocaleDateString('pt-BR') : '-';

                  return (
                    <tr key={p.id} className="hover:bg-slate-850/40 transition-colors">
                      <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">{dataFormatada}</td>
                      <td className="py-2.5 px-3 text-white font-medium">
                        <span className="truncate max-w-[180px] block" title={p.nomePeca}>
                          {p.nomePeca}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300">
                        {p.clienteNome || <span className="text-slate-600">-</span>}
                      </td>
                      <td className="py-2.5 px-3 uppercase text-[10px] font-semibold text-slate-300">
                        {p.formaPagamento === 'pix' ? (
                          <span className="text-emerald-400">Pix</span>
                        ) : p.formaPagamento === 'credito' ? (
                          <span className="text-sky-400">Crédito {p.parcelasCartao ? `${p.parcelasCartao}x` : ''}</span>
                        ) : p.formaPagamento === 'debito' ? (
                          <span className="text-cyan-400">Débito</span>
                        ) : p.formaPagamento === 'dinheiro' ? (
                          <span className="text-amber-400">Dinheiro</span>
                        ) : (
                          <span className="text-slate-500">A definir</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {p.status === 'concluido' ? (
                          <Badge variant="outline" className="text-[10px] py-0 px-2 border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
                            Concluído
                          </Badge>
                        ) : p.status === 'em_impressao' ? (
                          <Badge variant="outline" className="text-[10px] py-0 px-2 border-sky-500/30 bg-sky-500/10 text-sky-400">
                            Imprimindo
                          </Badge>
                        ) : p.status === 'aprovado' ? (
                          <Badge variant="outline" className="text-[10px] py-0 px-2 border-indigo-500/30 bg-indigo-500/10 text-indigo-400">
                            Aprovado
                          </Badge>
                        ) : p.status === 'cancelado' ? (
                          <Badge variant="outline" className="text-[10px] py-0 px-2 border-rose-500/30 bg-rose-500/10 text-rose-400">
                            Cancelado
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] py-0 px-2 border-slate-700 bg-slate-800 text-slate-400">
                            Orçamento
                          </Badge>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-white whitespace-nowrap">
                        {formatMoney(p.precoCobrado)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-rose-300 whitespace-nowrap">
                        {formatMoney(p.custoTotal)}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-bold whitespace-nowrap ${lucro >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {formatMoney(lucro)}
                      </td>
                      <td className={`py-2.5 px-3 text-right font-semibold whitespace-nowrap ${margem >= 50 ? 'text-emerald-400' : margem >= 20 ? 'text-sky-400' : 'text-amber-400'}`}>
                        {margem.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
