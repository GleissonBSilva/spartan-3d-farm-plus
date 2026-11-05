"use client";

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  TrendingUp,
  DollarSign,
  Package,
  Layers,
  Clock3,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Calculator,
  Percent,
  Zap,
  Sparkles,
  Play,
  RotateCcw,
  SlidersHorizontal,
  ChevronRight,
  Printer,
  Scale,
  Gift,
  Flame,
  ArrowUpRight
} from 'lucide-react';
import { toast } from 'sonner';
import { useSaaSData } from '@/context/SaaSDataContext';
import { FilamentoEstoque, ProjetoImpressao3D, ProjectMaterial } from '@/types/saas';

// Peças base de referência caso a farm tenha poucas peças cadastradas ainda
const BENCHMARK_ITEMS = [
  {
    nomePeca: 'Suporte Articulado de Celular / Tablet',
    pesoEstimadoG: 75,
    tempoEstimadoHoras: 2.5,
    precoCobrado: 45.0,
    custoTotal: 11.25,
    lucroLiquido: 33.75,
    margemLucroPercentual: 75,
    categoria: 'Giro Rápido',
  },
  {
    nomePeca: 'Vaso Decorativo Low Poly Espiral',
    pesoEstimadoG: 120,
    tempoEstimadoHoras: 4.2,
    precoCobrado: 69.9,
    custoTotal: 18.5,
    lucroLiquido: 51.4,
    margemLucroPercentual: 73.5,
    categoria: 'Decoração',
  },
  {
    nomePeca: 'Organizador Modular de Cabos & Mesa',
    pesoEstimadoG: 40,
    tempoEstimadoHoras: 1.4,
    precoCobrado: 28.0,
    custoTotal: 6.8,
    lucroLiquido: 21.2,
    margemLucroPercentual: 75.7,
    categoria: 'Organização',
  },
];

// Peças ultra pequenas para aproveitar sobras (< 200g)
const SCRAP_ITEMS = [
  {
    nomePeca: 'Chaveiro / Clip Spartan de Filamento',
    pesoEstimadoG: 12,
    tempoEstimadoHoras: 0.4,
    precoCobrado: 10.0,
    custoTotal: 1.8,
    lucroLiquido: 8.2,
  },
  {
    nomePeca: 'Brinde Especial Spartan para Clientes (Mascote/Moeda)',
    pesoEstimadoG: 18,
    tempoEstimadoHoras: 0.6,
    precoCobrado: 15.0,
    custoTotal: 2.7,
    lucroLiquido: 12.3,
  },
  {
    nomePeca: 'Trava Rápida para Carretel Anti-Emaranhamento',
    pesoEstimadoG: 15,
    tempoEstimadoHoras: 0.5,
    precoCobrado: 12.0,
    custoTotal: 2.2,
    lucroLiquido: 9.8,
  },
];

export const SpartanAiFarmStrategy: React.FC = () => {
  const navigate = useNavigate();
  const { filamentos, projetos, impressoras, updateProjetoStatus, addProjeto } = useSaaSData();

  const [selectedSpoolFilter, setSelectedSpoolFilter] = useState<string>('todos');
  const [sortBy, setSortBy] = useState<'lucro' | 'margem' | 'lucroHora' | 'quantidade'>('lucro');

  const formatCurrency = (val: number) => {
    return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // 1. Extração do Catálogo de Peças conhecidas da Farm (a partir dos projetos já orçados/executados)
  const farmPieces = useMemo(() => {
    const map = new Map<string, {
      nomePeca: string;
      pesoEstimadoG: number;
      tempoEstimadoHoras: number;
      precoCobrado: number;
      custoTotal: number;
      lucroLiquido: number;
      margemLucroPercentual: number;
      isFromDb: boolean;
      originalProject?: ProjetoImpressao3D;
    }>();

    projetos.forEach(p => {
      if (!p.nomePeca || p.pesoEstimadoG <= 0) return;
      const key = p.nomePeca.trim().toLowerCase();
      if (!map.has(key)) {
        const preco = Number(p.precoCobrado) || 0;
        const custo = Number(p.custoTotal) || 0;
        const lucro = preco - custo;
        const margem = preco > 0 ? (lucro / preco) * 100 : 0;
        map.set(key, {
          nomePeca: p.nomePeca,
          pesoEstimadoG: Number(p.pesoEstimadoG) || 50,
          tempoEstimadoHoras: Number(p.tempoEstimadoHoras) || 2,
          precoCobrado: preco,
          custoTotal: custo,
          lucroLiquido: lucro,
          margemLucroPercentual: margem,
          isFromDb: true,
          originalProject: p,
        });
      }
    });

    // Se a farm tiver menos de 3 peças no banco, complementa com itens benchmark testados
    const list = Array.from(map.values());
    if (list.length < 3) {
      BENCHMARK_ITEMS.forEach(bench => {
        const key = bench.nomePeca.trim().toLowerCase();
        if (!map.has(key)) {
          list.push({
            ...bench,
            isFromDb: false,
          });
        }
      });
    }

    return list;
  }, [projetos]);

  // 2. Carretéis disponíveis com saldo > 0
  const availableSpools = useMemo(() => {
    return filamentos.filter(f => (f.pesoRestanteG || 0) > 0);
  }, [filamentos]);

  // 3. Orçamentos e Pedidos em Aberto com Verificação de Estoque
  const openQuotesAnalysis = useMemo(() => {
    const openList = projetos.filter(p => p.status === 'orcamento' || p.status === 'aprovado');
    return openList.map(proj => {
      const pesoNecessario = Number(proj.pesoEstimadoG) || 0;
      
      // Tenta achar carretel correspondente por tipo/cor ou qualquer com peso suficiente
      const matchingSpool = availableSpools.find(sp => {
        const matchType = proj.filamentoUtilizado 
          ? proj.filamentoUtilizado.toLowerCase().includes(sp.tipo.toLowerCase())
          : true;
        return matchType && sp.pesoRestanteG >= pesoNecessario;
      }) || availableSpools.find(sp => sp.pesoRestanteG >= pesoNecessario);

      const hasStock = Boolean(matchingSpool);
      const remainingAfterPrint = matchingSpool ? matchingSpool.pesoRestanteG - pesoNecessario : 0;

      return {
        project: proj,
        pesoNecessario,
        hasStock,
        spoolUsed: matchingSpool,
        remainingAfterPrint,
      };
    });
  }, [projetos, availableSpools]);

  // 4. Cruzamento Inteligente: Oportunidades de Lotes por Carretel
  const spoolOpportunities = useMemo(() => {
    const opps: Array<{
      id: string;
      spool: FilamentoEstoque;
      piece: typeof farmPieces[0];
      capacidadeLote: number;
      pesoTotalConsumidoG: number;
      sobraCarretelG: number;
      tempoTotalHoras: number;
      custoMaterialLote: number;
      custoTotalLote: number;
      faturamentoLote: number;
      lucroLiquidoLote: number;
      margemPercentual: number;
      lucroPorHora: number;
      percentualUsoCarretel: number;
    }> = [];

    const spoolsToEvaluate = selectedSpoolFilter === 'todos'
      ? availableSpools
      : availableSpools.filter(s => s.id === selectedSpoolFilter);

    spoolsToEvaluate.forEach(spool => {
      const spoolWeight = spool.pesoRestanteG || 0;
      if (spoolWeight <= 0) return;

      const custoGram = (spool.precoKg || 120) / 1000;

      farmPieces.forEach(piece => {
        const pesoPeca = piece.pesoEstimadoG;
        if (pesoPeca <= 0) return;

        const capacidade = Math.floor(spoolWeight / pesoPeca);
        if (capacidade < 1) return;

        const pesoTotalConsumido = capacidade * pesoPeca;
        const sobra = spoolWeight - pesoTotalConsumido;
        const tempoTotal = capacidade * piece.tempoEstimadoHoras;

        // Custo real ajustado ao preço deste carretel específico
        const custoMaterialUnitario = custoGram * pesoPeca;
        // Energia (~0.25kW * R$ 0.85/kWh = ~R$ 0.21/h) + depreciação média (~R$ 1.50/h)
        const outrosCustosUnitarios = piece.tempoEstimadoHoras * (0.21 + 1.50);
        const custoTotalUnitario = piece.custoTotal > 0 
          ? (piece.custoTotal - (piece.pesoEstimadoG * 0.12) + custoMaterialUnitario)
          : (custoMaterialUnitario + outrosCustosUnitarios);

        const precoUnitario = piece.precoCobrado > 0 
          ? piece.precoCobrado 
          : (custoTotalUnitario * 2.8);

        const faturamento = capacidade * precoUnitario;
        const custoTotal = capacidade * custoTotalUnitario;
        const lucroLiquido = faturamento - custoTotal;
        const margem = faturamento > 0 ? (lucroLiquido / faturamento) * 100 : 0;
        const lucroHora = tempoTotal > 0 ? (lucroLiquido / tempoTotal) : 0;
        const usoPercentual = Math.min(100, Math.round((pesoTotalConsumido / spoolWeight) * 100));

        opps.push({
          id: `${spool.id}-${piece.nomePeca}`,
          spool,
          piece,
          capacidadeLote: capacidade,
          pesoTotalConsumidoG: pesoTotalConsumido,
          sobraCarretelG: sobra,
          tempoTotalHoras: tempoTotal,
          custoMaterialLote: capacidade * custoMaterialUnitario,
          custoTotalLote: custoTotal,
          faturamentoLote: faturamento,
          lucroLiquidoLote: lucroLiquido,
          margemPercentual: margem,
          lucroPorHora: lucroHora,
          percentualUsoCarretel: usoPercentual,
        });
      });
    });

    // Ordenação
    return opps.sort((a, b) => {
      if (sortBy === 'lucro') return b.lucroLiquidoLote - a.lucroLiquidoLote;
      if (sortBy === 'margem') return b.margemPercentual - a.margemPercentual;
      if (sortBy === 'lucroHora') return b.lucroPorHora - a.lucroPorHora;
      if (sortBy === 'quantidade') return b.capacidadeLote - a.capacidadeLote;
      return 0;
    });
  }, [availableSpools, farmPieces, selectedSpoolFilter, sortBy]);

  // 5. Aproveitamento Inteligente de Sobras (< 200g)
  const lowWeightSpools = useMemo(() => {
    return availableSpools.filter(s => s.pesoRestanteG > 0 && s.pesoRestanteG <= 220);
  }, [availableSpools]);

  // 6. Indicadores Executivos Globais
  const topKpis = useMemo(() => {
    const totalEstoqueG = availableSpools.reduce((acc, s) => acc + (s.pesoRestanteG || 0), 0);
    const totalEstoqueKg = (totalEstoqueG / 1000).toFixed(2);

    // Orçamentos em aberto
    const orcamentosProntos = openQuotesAnalysis.filter(q => q.hasStock);
    const valorOrcamentosProntos = orcamentosProntos.reduce((acc, q) => acc + (q.project.precoCobrado || 0), 0);
    const lucroOrcamentosProntos = orcamentosProntos.reduce((acc, q) => acc + (q.project.lucroLiquido || 0), 0);

    // Potencial máximo projetado da melhor combinação para cada carretel
    const bestPerSpool = new Map<string, typeof spoolOpportunities[0]>();
    spoolOpportunities.forEach(opp => {
      const existing = bestPerSpool.get(opp.spool.id);
      if (!existing || opp.lucroLiquidoLote > existing.lucroLiquidoLote) {
        bestPerSpool.set(opp.spool.id, opp);
      }
    });

    const faturamentoPotencialTotal = Array.from(bestPerSpool.values()).reduce((acc, o) => acc + o.faturamentoLote, 0);
    const lucroPotencialTotal = Array.from(bestPerSpool.values()).reduce((acc, o) => acc + o.lucroLiquidoLote, 0);

    return {
      totalEstoqueKg,
      totalCarreteis: availableSpools.length,
      orcamentosProntosCount: orcamentosProntos.length,
      orcamentosTotalCount: openQuotesAnalysis.length,
      valorOrcamentosProntos,
      lucroOrcamentosProntos,
      faturamentoPotencialTotal,
      lucroPotencialTotal,
    };
  }, [availableSpools, openQuotesAnalysis, spoolOpportunities]);

  // Ações Rápidas
  const handleSimulateInCalculator = (opp: typeof spoolOpportunities[0]) => {
    navigate('/cliente/calculadora', {
      state: {
        copyProject: {
          nomePeca: `${opp.piece.nomePeca} (Lote ${opp.capacidadeLote}x)`,
          pesoEstimadoG: opp.piece.pesoEstimadoG,
          tempoEstimadoHoras: opp.piece.tempoEstimadoHoras,
          quantidadeLote: opp.capacidadeLote,
          quantidade: opp.capacidadeLote,
          precoCobrado: (opp.faturamentoLote / opp.capacidadeLote),
          custoTotal: (opp.custoTotalLote / opp.capacidadeLote),
          materials: [
            {
              id: `mat-${Date.now()}`,
              materialId: opp.spool.id,
              materialName: `${opp.spool.tipo} ${opp.spool.cor}`,
              color: opp.spool.cor,
              colorHex: opp.spool.corHex,
              filamentType: opp.spool.tipo,
              weightGrams: opp.piece.pesoEstimadoG,
              costPerGram: (opp.spool.precoKg || 120) / 1000,
              totalCost: ((opp.spool.precoKg || 120) / 1000) * opp.piece.pesoEstimadoG,
            }
          ] as ProjectMaterial[],
        }
      }
    });
    toast.info(`Simulação do lote de ${opp.capacidadeLote}x "${opp.piece.nomePeca}" carregada na Calculadora 3D!`);
  };

  const handleStartQuoteProduction = async (quote: typeof openQuotesAnalysis[0]) => {
    const availablePrinter = impressoras.find(i => i.status === 'disponivel');
    
    if (availablePrinter) {
      await updateProjetoStatus(quote.project.id, 'em_impressao', availablePrinter.id);
      toast.success(`Orçamento "${quote.project.nomePeca}" iniciado na impressora ${availablePrinter.nome}!`);
    } else {
      await updateProjetoStatus(quote.project.id, 'aprovado');
      toast.success(`Orçamento aprovado e posicionado na fila de produção (aguardando impressora livre)!`);
    }
  };

  const handleCreateBatchProject = async (opp: typeof spoolOpportunities[0]) => {
    const availablePrinter = impressoras.find(i => i.status === 'disponivel');

    const newProjectData: Omit<ProjetoImpressao3D, 'id' | 'dataCriacao' | 'estoqueBaixado'> = {
      nomePeca: `${opp.piece.nomePeca} (Lote ${opp.capacidadeLote} un)`,
      clienteNome: 'Produção para Estoque Farm',
      clienteContato: '',
      impressoraId: availablePrinter?.id,
      impressoraNome: availablePrinter?.nome,
      pesoEstimadoG: opp.pesoTotalConsumidoG,
      tempoEstimadoHoras: opp.tempoTotalHoras,
      quantidadeLote: opp.capacidadeLote,
      quantidade: opp.capacidadeLote,
      filamentoUtilizado: `${opp.spool.tipo} ${opp.spool.cor} (${opp.spool.marca})`,
      materials: [
        {
          id: `mat-${Date.now()}`,
          materialId: opp.spool.id,
          materialName: `${opp.spool.tipo} ${opp.spool.cor}`,
          color: opp.spool.cor,
          colorHex: opp.spool.corHex,
          filamentType: opp.spool.tipo,
          weightGrams: opp.pesoTotalConsumidoG,
          costPerGram: (opp.spool.precoKg || 120) / 1000,
          totalCost: opp.custoMaterialLote,
        }
      ],
      custoMaterial: opp.custoMaterialLote,
      custoEnergia: opp.tempoTotalHoras * 0.25 * 0.85,
      custoDepreciacao: opp.tempoTotalHoras * 1.5,
      custoTotal: opp.custoTotalLote,
      precoCobrado: opp.faturamentoLote,
      lucroLiquido: opp.lucroLiquidoLote,
      margemLucroPercentual: opp.margemPercentual,
      status: availablePrinter ? 'em_impressao' : 'aprovado',
      observacoes: `Lote inteligente sugerido pela IA Spartan Farm. Aproveitamento de ${opp.percentualUsoCarretel}% do carretel ${opp.spool.tipo} ${opp.spool.cor}.`,
    };

    const ok = addProjeto(newProjectData);
    if (ok) {
      if (availablePrinter) {
        toast.success(`Lote de ${opp.capacidadeLote}x "${opp.piece.nomePeca}" enviado diretamente para ${availablePrinter.nome}!`);
      } else {
        toast.success(`Lote de ${opp.capacidadeLote}x criado e adicionado à fila de produção!`);
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. TOP CARDS EXECUTIVOS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Potencial de Lucro */}
        <Card className="bg-slate-900/90 border-slate-800 rounded-2xl relative overflow-hidden shadow-lg hover:border-emerald-500/40 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Potencial de Lucro</span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <CardTitle className="text-2xl font-black text-white mt-1">
              {formatCurrency(topKpis.lucroPotencialTotal)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              Com os {topKpis.totalCarreteis} carretéis atuais da farm
            </p>
          </CardContent>
        </Card>

        {/* Faturamento Projetado */}
        <Card className="bg-slate-900/90 border-slate-800 rounded-2xl relative overflow-hidden shadow-lg hover:border-indigo-500/40 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Faturamento Projetado</span>
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <CardTitle className="text-2xl font-black text-white mt-1">
              {formatCurrency(topKpis.faturamentoPotencialTotal)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              Receita bruta se converter estoque em peças
            </p>
          </CardContent>
        </Card>

        {/* Estoque Total Disponível */}
        <Card className="bg-slate-900/90 border-slate-800 rounded-2xl relative overflow-hidden shadow-lg hover:border-amber-500/40 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Estoque Disponível</span>
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
                <Package className="w-4 h-4" />
              </div>
            </div>
            <CardTitle className="text-2xl font-black text-white mt-1">
              {topKpis.totalEstoqueKg} <span className="text-sm font-semibold text-slate-400">kg</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              {topKpis.totalCarreteis} carretéis ativos prontos para imprimir
            </p>
          </CardContent>
        </Card>

        {/* Orçamentos Prontos com Estoque */}
        <Card className="bg-slate-900/90 border-slate-800 rounded-2xl relative overflow-hidden shadow-lg hover:border-cyan-500/40 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Orçamentos Prontos</span>
              <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                <Zap className="w-4 h-4" />
              </div>
            </div>
            <CardTitle className="text-2xl font-black text-white mt-1">
              {topKpis.orcamentosProntosCount}{' '}
              <span className="text-xs font-normal text-slate-400">de {topKpis.orcamentosTotalCount} em aberto</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <span className="text-emerald-400 font-bold">{formatCurrency(topKpis.valorOrcamentosProntos)}</span>
              garantidos com filamento em estoque
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 2. SEÇÃO: ORÇAMENTOS EM ABERTO COM ESTOQUE GARANTIDO */}
      {openQuotesAnalysis.length > 0 && (
        <Card className="bg-slate-900 border-slate-800 rounded-2xl">
          <CardHeader className="pb-3 border-b border-slate-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base text-white font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  Orçamentos em Aberto & Validação de Estoque
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Orçamentos de clientes cruzados automaticamente com o peso restante dos seus carretéis
                </CardDescription>
              </div>
              <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-xs w-fit">
                {topKpis.orcamentosProntosCount} Orçamento(s) Pronto(s) para Início
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {openQuotesAnalysis.map(({ project, pesoNecessario, hasStock, spoolUsed, remainingAfterPrint }) => (
              <div
                key={project.id}
                className="p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-bold text-white text-sm">{project.nomePeca}</span>
                    <Badge variant="outline" className="text-xs bg-slate-900 text-slate-300 border-slate-750">
                      Cliente: {project.clienteNome || 'Geral'}
                    </Badge>
                    {hasStock ? (
                      <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[11px] flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        100% Estoque Garantido
                      </Badge>
                    ) : (
                      <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/30 text-[11px] flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 text-rose-400" />
                        Estoque Insuficiente
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-400 flex-wrap">
                    <span className="flex items-center gap-1">
                      <Scale className="w-3.5 h-3.5 text-slate-500" />
                      Consumo: <strong className="text-slate-200">{pesoNecessario}g</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock3 className="w-3.5 h-3.5 text-slate-500" />
                      Tempo: <strong className="text-slate-200">{project.tempoEstimadoHoras}h</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                      Preço: <strong className="text-emerald-400">{formatCurrency(project.precoCobrado)}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
                      Lucro Líquido: <strong className="text-indigo-300">{formatCurrency(project.lucroLiquido)}</strong>
                    </span>
                  </div>

                  {spoolUsed && (
                    <p className="text-[11px] text-slate-400 pt-0.5">
                      🧵 Alocação sugerida: <span className="text-amber-300 font-semibold">{spoolUsed.tipo} {spoolUsed.cor}</span> ({spoolUsed.pesoRestanteG}g disponíveis · restam {remainingAfterPrint}g após impressão).
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate('/cliente/calculadora', { state: { recalculateProject: project } })}
                    className="border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs rounded-xl h-9"
                  >
                    <Calculator className="w-3.5 h-3.5 mr-1 text-slate-400" />
                    Abrir Calculadora
                  </Button>
                  <Button
                    size="sm"
                    disabled={!hasStock}
                    onClick={() => handleStartQuoteProduction({ project, pesoNecessario, hasStock, spoolUsed, remainingAfterPrint })}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl h-9 px-3.5 shadow-md shadow-emerald-950"
                  >
                    <Play className="w-3.5 h-3.5 mr-1" />
                    Iniciar Produção
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 3. SEÇÃO PRINCIPAL: O QUE IMPRIMIR COM O ESTOQUE (OPORTUNIDADES DE LOTES) */}
      <Card className="bg-slate-900 border-slate-800 rounded-2xl">
        <CardHeader className="pb-3 border-b border-slate-800">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base text-white font-bold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-400" />
                O que Imprimir com seu Estoque · Oportunidades de Lotes
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                A IA Spartan analisa quantos itens do seu portfólio cabem em cada carretel e projeta o lucro líquido total
              </CardDescription>
            </div>

            {/* Controles de Filtro e Ordenação */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Filtro por Carretel */}
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1">
                <span className="text-[11px] text-slate-400 font-medium">Carretel:</span>
                <select
                  value={selectedSpoolFilter}
                  onChange={e => setSelectedSpoolFilter(e.target.value)}
                  className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
                >
                  <option value="todos" className="bg-slate-900 text-white">Todos os Carretéis ({availableSpools.length})</option>
                  {availableSpools.map(spool => (
                    <option key={spool.id} value={spool.id} className="bg-slate-900 text-white">
                      {spool.tipo} {spool.cor} ({spool.pesoRestanteG}g)
                    </option>
                  ))}
                </select>
              </div>

              {/* Ordenar Por */}
              <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1">
                <span className="text-[11px] text-slate-400 font-medium">Ordenar:</span>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as any)}
                  className="bg-transparent text-xs text-white focus:outline-none cursor-pointer"
                >
                  <option value="lucro" className="bg-slate-900 text-white">Maior Lucro Total (R$)</option>
                  <option value="margem" className="bg-slate-900 text-white">Maior Margem (%)</option>
                  <option value="lucroHora" className="bg-slate-900 text-white">Maior Lucro / Hora</option>
                  <option value="quantidade" className="bg-slate-900 text-white">Mais Peças por Carretel</option>
                </select>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-4 space-y-4">
          {spoolOpportunities.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <Package className="w-10 h-10 mx-auto text-slate-600 mb-2" />
              <p className="text-sm font-semibold text-white">Nenhuma oportunidade identificada com os filtros atuais.</p>
              <p className="text-xs">Cadastre filamentos com saldo no estoque ou projetos na Calculadora 3D para gerar sugestões.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {spoolOpportunities.map(opp => (
                <div
                  key={opp.id}
                  className="rounded-2xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-all p-4 space-y-3.5 flex flex-col justify-between"
                >
                  {/* Topo do Card */}
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-bold text-white text-sm leading-tight">{opp.piece.nomePeca}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-full border border-slate-700"
                            style={{ backgroundColor: opp.spool.corHex || '#ffffff' }}
                          />
                          <span className="text-xs text-slate-300 font-medium">
                            {opp.spool.tipo} {opp.spool.cor}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            ({opp.spool.pesoRestanteG}g disponíveis)
                          </span>
                        </div>
                      </div>

                      {/* Badges de Destaque */}
                      <div className="flex flex-col items-end gap-1">
                        {opp.margemPercentual >= 65 && (
                          <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[10px] py-0 px-2">
                            Alta Margem
                          </Badge>
                        )}
                        {opp.piece.tempoEstimadoHoras <= 2 && (
                          <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-[10px] py-0 px-2">
                            Giro Rápido
                          </Badge>
                        )}
                        {opp.lucroPorHora >= 15 && (
                          <Badge className="bg-indigo-500/15 text-indigo-300 border-indigo-500/30 text-[10px] py-0 px-2">
                            Alta Eficiência
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Barra de Aproveitamento do Carretel */}
                    <div className="space-y-1 pt-1">
                      <div className="flex justify-between items-center text-[11px] text-slate-400">
                        <span>Aproveitamento do Carretel</span>
                        <strong className="text-white">{opp.percentualUsoCarretel}% do filamento</strong>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-1.5 rounded-full"
                          style={{ width: `${opp.percentualUsoCarretel}%` }}
                        />
                      </div>
                    </div>

                    {/* Grid com Métricas do Lote */}
                    <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                      <div className="p-2 rounded-xl bg-slate-900 border border-slate-800/80">
                        <span className="text-[11px] text-slate-400 block">Capacidade do Lote</span>
                        <span className="text-sm font-bold text-white">
                          {opp.capacidadeLote} un <span className="text-[11px] font-normal text-slate-400">({opp.pesoTotalConsumidoG}g)</span>
                        </span>
                        <span className="text-[10px] text-slate-500 block">Sobra: {opp.sobraCarretelG}g</span>
                      </div>

                      <div className="p-2 rounded-xl bg-slate-900 border border-slate-800/80">
                        <span className="text-[11px] text-slate-400 block">Tempo Total</span>
                        <span className="text-sm font-bold text-white">{opp.tempoTotalHoras.toFixed(1)}h</span>
                        <span className="text-[10px] text-slate-500 block">{(opp.tempoTotalHoras / opp.capacidadeLote).toFixed(1)}h por unidade</span>
                      </div>

                      <div className="p-2 rounded-xl bg-slate-900 border border-slate-800/80">
                        <span className="text-[11px] text-slate-400 block">Faturamento Lote</span>
                        <span className="text-sm font-bold text-indigo-300">{formatCurrency(opp.faturamentoLote)}</span>
                        <span className="text-[10px] text-slate-500 block">Custo total: {formatCurrency(opp.custoTotalLote)}</span>
                      </div>

                      <div className="p-2 rounded-xl bg-emerald-950/30 border border-emerald-500/30">
                        <span className="text-[11px] text-emerald-400 block font-medium">Lucro Líquido</span>
                        <span className="text-sm font-black text-emerald-300">{formatCurrency(opp.lucroLiquidoLote)}</span>
                        <span className="text-[10px] text-emerald-400/80 block font-semibold">{opp.margemPercentual.toFixed(1)}% margem</span>
                      </div>
                    </div>
                  </div>

                  {/* Ações do Card */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-900">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSimulateInCalculator(opp)}
                      className="w-1/2 border-slate-700 bg-slate-900 hover:bg-slate-850 text-slate-300 text-xs rounded-xl h-9"
                    >
                      <Calculator className="w-3.5 h-3.5 mr-1 text-slate-400" />
                      Simular Lote
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleCreateBatchProject(opp)}
                      className="w-1/2 bg-gradient-to-r from-amber-500 to-indigo-600 hover:opacity-90 text-white font-bold text-xs rounded-xl h-9 shadow-md"
                    >
                      <Zap className="w-3.5 h-3.5 mr-1" />
                      Produzir Lote
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. SEÇÃO: APROVEITAMENTO DE SOBRAS & ZERO DESPERDÍCIO */}
      {lowWeightSpools.length > 0 && (
        <Card className="bg-slate-900 border-slate-800 rounded-2xl">
          <CardHeader className="pb-3 border-b border-slate-800">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base text-white font-bold flex items-center gap-2">
                  <Gift className="w-5 h-5 text-amber-400" />
                  Aproveitamento de Sobras · Zero Desperdício
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Carretéis com menos de 220g ideais para brindes de clientes, chaveiros e travas rápidas
                </CardDescription>
              </div>
              <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-xs">
                {lowWeightSpools.length} Carretel(is) com Sobra
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {SCRAP_ITEMS.map((item, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex justify-between items-start gap-2">
                    <span className="font-bold text-white text-xs leading-snug">{item.nomePeca}</span>
                    <Badge variant="outline" className="text-[10px] text-amber-300 border-amber-500/30">
                      {item.pesoEstimadoG}g
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Lucro unitário: <strong className="text-emerald-400">{formatCurrency(item.lucroLiquido)}</strong></span>
                    <span>Tempo: <strong className="text-slate-200">{item.tempoEstimadoHoras}h</strong></span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const firstSpool = lowWeightSpools[0] || availableSpools[0];
                      const capacity = Math.floor(firstSpool.pesoRestanteG / item.pesoEstimadoG);
                      navigate('/cliente/calculadora', {
                        state: {
                          copyProject: {
                            nomePeca: `${item.nomePeca} (Sobra ${capacity}x)`,
                            pesoEstimadoG: item.pesoEstimadoG,
                            tempoEstimadoHoras: item.tempoEstimadoHoras,
                            quantidadeLote: Math.max(1, capacity),
                            quantidade: Math.max(1, capacity),
                            precoCobrado: item.precoCobrado,
                            custoTotal: item.custoTotal,
                          }
                        }
                      });
                    }}
                    className="w-full h-8 text-xs text-indigo-300 hover:text-white hover:bg-slate-850 rounded-lg justify-center"
                  >
                    Simular Produção de Brindes <ChevronRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 5. SEÇÃO: INSIGHTS ESTRATÉGICOS DA IA SPARTAN */}
      <Card className="bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border-slate-800 rounded-2xl p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shrink-0">
            <Sparkles className="w-5 h-5 text-indigo-400" />
          </div>
          <div className="space-y-1 text-xs leading-relaxed">
            <h4 className="font-bold text-white text-sm">Diretrizes da IA Spartan para Máxima Rentabilidade</h4>
            <p className="text-slate-300">
              • <strong>Foco na Taxa de Ocupação:</strong> Suas impressoras geram maior lucro por hora quando trabalham em lotes contínuos com peças de alta margem (&gt;65%).
            </p>
            <p className="text-slate-300">
              • <strong>Priorização de Pedidos Prontos:</strong> Priorize o início dos orçamentos com matéria-prima em estoque para reduzir o prazo de entrega ao cliente e antecipar o fluxo de caixa.
            </p>
            <p className="text-slate-300">
              • <strong>Sobras de Carretéis:</strong> Ao atingir os últimos 150g de um carretel, transforme o filamento restante em peças de brinde Spartan para encantar seus compradores e evitar perda de estoque.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};
