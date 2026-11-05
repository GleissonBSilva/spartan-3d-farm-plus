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
  Calculator,
  Percent,
  Zap,
  Sparkles,
  Play,
  RotateCcw,
  SlidersHorizontal,
  ChevronRight,
  Scale,
  Gift,
  Flame,
  ArrowUpRight,
  Check
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

// Peças ultra pequenas para zerar sobras de carretel (< 200g) sem desperdício
const SCRAP_ITEMS = [
  {
    nomePeca: 'Chaveiro / Mascote Spartan',
    pesoEstimadoG: 12,
    tempoEstimadoHoras: 0.4,
    precoCobrado: 10.0,
    custoTotal: 1.8,
    lucroLiquido: 8.2,
  },
  {
    nomePeca: 'Brinde Especial para Clientes',
    pesoEstimadoG: 18,
    tempoEstimadoHoras: 0.6,
    precoCobrado: 15.0,
    custoTotal: 2.7,
    lucroLiquido: 12.3,
  },
  {
    nomePeca: 'Clip / Trava Anti-Emaranhamento',
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
  const [sortBy, setSortBy] = useState<'lucro' | 'margem' | 'desperdicio' | 'lucroHora' | 'quantidade'>('lucro');

  const formatCurrency = (val: number) => {
    return (val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  // 1. Extração de Peças Únicas do Catálogo da Farm (SEM REPETIÇÃO)
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

  // 4. OPORTUNIDADES POR PROJETO ÚNICO (SEM REPETIÇÃO) VISANDO LUCRO & DESPERDÍCIO
  const projectOpportunities = useMemo(() => {
    const result: Array<{
      id: string;
      piece: typeof farmPieces[0];
      bestSpool: FilamentoEstoque;
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
      totalCompativelSpools: number;
      isLowWaste: boolean;
    }> = [];

    const spoolsToEvaluate = selectedSpoolFilter === 'todos'
      ? availableSpools
      : availableSpools.filter(s => s.id === selectedSpoolFilter);

    farmPieces.forEach(piece => {
      const pesoPeca = piece.pesoEstimadoG;
      if (pesoPeca <= 0) return;

      const validSpools = spoolsToEvaluate.map(spool => {
        const spoolWeight = spool.pesoRestanteG || 0;
        const capacidade = Math.floor(spoolWeight / pesoPeca);
        if (capacidade < 1) return null;

        const pesoTotalConsumido = capacidade * pesoPeca;
        const sobra = spoolWeight - pesoTotalConsumido;
        const percentualUso = Math.min(100, Math.round((pesoTotalConsumido / spoolWeight) * 100));

        const custoGram = (spool.precoKg || 120) / 1000;
        const custoMaterialUnitario = custoGram * pesoPeca;
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
        const tempoTotal = capacidade * piece.tempoEstimadoHoras;
        const lucroHora = tempoTotal > 0 ? (lucroLiquido / tempoTotal) : 0;

        return {
          spool,
          capacidade,
          pesoTotalConsumido,
          sobra,
          percentualUso,
          custoMaterialUnitario,
          custoTotalUnitario,
          precoUnitario,
          faturamento,
          custoTotal,
          lucroLiquido,
          margem,
          tempoTotal,
          lucroHora,
        };
      }).filter(Boolean);

      if (validSpools.length === 0) return;

      validSpools.sort((a, b) => {
        if (Math.abs(b!.lucroLiquido - a!.lucroLiquido) > 5) {
          return b!.lucroLiquido - a!.lucroLiquido;
        }
        return a!.sobra - b!.sobra;
      });

      const best = validSpools[0]!;
      const isLowWaste = best.sobra <= 45 || best.percentualUso >= 92;

      result.push({
        id: `piece-${piece.nomePeca}`,
        piece,
        bestSpool: best.spool,
        capacidadeLote: best.capacidade,
        pesoTotalConsumidoG: best.pesoTotalConsumido,
        sobraCarretelG: best.sobra,
        tempoTotalHoras: best.tempoTotal,
        custoMaterialLote: best.capacidade * best.custoMaterialUnitario,
        custoTotalLote: best.custoTotal,
        faturamentoLote: best.faturamento,
        lucroLiquidoLote: best.lucroLiquido,
        margemPercentual: best.margem,
        lucroPorHora: best.lucroHora,
        percentualUsoCarretel: best.percentualUso,
        totalCompativelSpools: validSpools.length,
        isLowWaste,
      });
    });

    return result.sort((a, b) => {
      if (sortBy === 'lucro') return b.lucroLiquidoLote - a.lucroLiquidoLote;
      if (sortBy === 'margem') return b.margemPercentual - a.margemPercentual;
      if (sortBy === 'desperdicio') return a.sobraCarretelG - b.sobraCarretelG;
      if (sortBy === 'lucroHora') return b.lucroPorHora - a.lucroPorHora;
      if (sortBy === 'quantidade') return b.capacidadeLote - a.capacidadeLote;
      return 0;
    });
  }, [farmPieces, availableSpools, selectedSpoolFilter, sortBy]);

  // 5. Carretéis com sobra (< 220g)
  const lowWeightSpools = useMemo(() => {
    return availableSpools.filter(s => s.pesoRestanteG > 0 && s.pesoRestanteG <= 220);
  }, [availableSpools]);

  // 6. Indicadores Executivos Globais
  const topKpis = useMemo(() => {
    const totalEstoqueG = availableSpools.reduce((acc, s) => acc + (s.pesoRestanteG || 0), 0);
    const totalEstoqueKg = (totalEstoqueG / 1000).toFixed(2);

    const orcamentosProntos = openQuotesAnalysis.filter(q => q.hasStock);
    const valorOrcamentosProntos = orcamentosProntos.reduce((acc, q) => acc + (q.project.precoCobrado || 0), 0);

    const faturamentoPotencialTotal = projectOpportunities.reduce((acc, o) => acc + o.faturamentoLote, 0);
    const lucroPotencialTotal = projectOpportunities.reduce((acc, o) => acc + o.lucroLiquidoLote, 0);

    return {
      totalEstoqueKg,
      totalCarreteis: availableSpools.length,
      orcamentosProntosCount: orcamentosProntos.length,
      orcamentosTotalCount: openQuotesAnalysis.length,
      valorOrcamentosProntos,
      faturamentoPotencialTotal,
      lucroPotencialTotal,
    };
  }, [availableSpools, openQuotesAnalysis, projectOpportunities]);

  // Ações Rápidas
  const handleSimulateInCalculator = (opp: typeof projectOpportunities[0]) => {
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
              materialId: opp.bestSpool.id,
              materialName: `${opp.bestSpool.tipo} ${opp.bestSpool.cor}`,
              color: opp.bestSpool.cor,
              colorHex: opp.bestSpool.corHex,
              filamentType: opp.bestSpool.tipo,
              weightGrams: opp.piece.pesoEstimadoG,
              costPerGram: (opp.bestSpool.precoKg || 120) / 1000,
              totalCost: ((opp.bestSpool.precoKg || 120) / 1000) * opp.piece.pesoEstimadoG,
            }
          ] as ProjectMaterial[],
        }
      }
    });
    toast.info(`Lote de ${opp.capacidadeLote}x "${opp.piece.nomePeca}" carregado na Calculadora 3D!`);
  };

  const handleStartQuoteProduction = async (quote: typeof openQuotesAnalysis[0]) => {
    const availablePrinter = impressoras.find(i => i.status === 'disponivel');
    
    if (availablePrinter) {
      await updateProjetoStatus(quote.project.id, 'em_impressao', availablePrinter.id);
      toast.success(`Orçamento "${quote.project.nomePeca}" iniciado na impressora ${availablePrinter.nome}!`);
    } else {
      await updateProjetoStatus(quote.project.id, 'aprovado');
      toast.success(`Orçamento aprovado e posicionado na fila de produção!`);
    }
  };

  const handleCreateBatchProject = async (opp: typeof projectOpportunities[0]) => {
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
      filamentoUtilizado: `${opp.bestSpool.tipo} ${opp.bestSpool.cor} (${opp.bestSpool.marca})`,
      materials: [
        {
          id: `mat-${Date.now()}`,
          materialId: opp.bestSpool.id,
          materialName: `${opp.bestSpool.tipo} ${opp.bestSpool.cor}`,
          color: opp.bestSpool.cor,
          colorHex: opp.bestSpool.corHex,
          filamentType: opp.bestSpool.tipo,
          weightGrams: opp.pesoTotalConsumidoG,
          costPerGram: (opp.bestSpool.precoKg || 120) / 1000,
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
      observacoes: `Lote inteligente Spartan AI. Aproveitamento de ${opp.percentualUsoCarretel}% do carretel ${opp.bestSpool.tipo} ${opp.bestSpool.cor} (sobra mínima de ${opp.sobraCarretelG}g).`,
    };

    const ok = addProjeto(newProjectData);
    if (ok) {
      if (availablePrinter) {
        toast.success(`Lote de ${opp.capacidadeLote}x "${opp.piece.nomePeca}" enviado para ${availablePrinter.nome}!`);
      } else {
        toast.success(`Lote de ${opp.capacidadeLote}x criado e adicionado à fila de produção!`);
      }
    }
  };

  return (
    <div className="space-y-3.5">
      {/* 1. TOP CARDS EXECUTIVOS (COMPACTOS) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
        <Card className="bg-slate-900 border-slate-800 rounded-xl p-2.5 shadow-sm hover:border-emerald-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Potencial Lucro</span>
            <div className="p-1 rounded-md bg-emerald-500/10 text-emerald-400">
              <DollarSign className="w-3 h-3" />
            </div>
          </div>
          <div className="text-base sm:text-lg font-black text-emerald-400 mt-0.5">
            {formatCurrency(topKpis.lucroPotencialTotal)}
          </div>
          <p className="text-[9px] text-slate-400 mt-0.5 flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5 text-amber-400 shrink-0" />
            Em {projectOpportunities.length} projetos únicos
          </p>
        </Card>

        <Card className="bg-slate-900 border-slate-800 rounded-xl p-2.5 shadow-sm hover:border-indigo-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Faturamento</span>
            <div className="p-1 rounded-md bg-indigo-500/10 text-indigo-400">
              <TrendingUp className="w-3 h-3" />
            </div>
          </div>
          <div className="text-base sm:text-lg font-black text-indigo-300 mt-0.5">
            {formatCurrency(topKpis.faturamentoPotencialTotal)}
          </div>
          <p className="text-[9px] text-slate-400 mt-0.5 flex items-center gap-1">
            <Layers className="w-2.5 h-2.5 text-indigo-400 shrink-0" />
            Receita bruta projetada
          </p>
        </Card>

        <Card className="bg-slate-900 border-slate-800 rounded-xl p-2.5 shadow-sm hover:border-amber-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Estoque Farm</span>
            <div className="p-1 rounded-md bg-amber-500/10 text-amber-400">
              <Package className="w-3 h-3" />
            </div>
          </div>
          <div className="text-base sm:text-lg font-black text-white mt-0.5">
            {topKpis.totalEstoqueKg} <span className="text-xs font-semibold text-slate-400">kg</span>
          </div>
          <p className="text-[9px] text-slate-400 mt-0.5 flex items-center gap-1">
            <Check className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
            {topKpis.totalCarreteis} carretéis ativos
          </p>
        </Card>

        <Card className="bg-slate-900 border-slate-800 rounded-xl p-2.5 shadow-sm hover:border-cyan-500/30 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Orçamentos Prontos</span>
            <div className="p-1 rounded-md bg-cyan-500/10 text-cyan-400">
              <Zap className="w-3 h-3" />
            </div>
          </div>
          <div className="text-base sm:text-lg font-black text-cyan-300 mt-0.5">
            {topKpis.orcamentosProntosCount}{' '}
            <span className="text-xs font-normal text-slate-400">de {topKpis.orcamentosTotalCount}</span>
          </div>
          <p className="text-[9px] text-slate-400 mt-0.5 truncate">
            {formatCurrency(topKpis.valorOrcamentosProntos)} garantidos em filamento
          </p>
        </Card>
      </div>

      {/* 2. SEÇÃO: ORÇAMENTOS EM ABERTO (COMPACTA & SUPER ORGANIZADA) */}
      {openQuotesAnalysis.length > 0 && (
        <Card className="bg-slate-900 border-slate-800 rounded-xl overflow-hidden shadow-sm">
          <CardHeader className="py-2 px-3 border-b border-slate-800 bg-slate-900/90">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-xs font-bold text-white">
                  Orçamentos de Clientes & Cobertura de Estoque
                </span>
              </div>
              <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[9px] py-0 px-1.5 font-semibold">
                {topKpis.orcamentosProntosCount} pronto(s) para máquina
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-2 space-y-1.5">
            {openQuotesAnalysis.map(({ project, pesoNecessario, hasStock, spoolUsed, remainingAfterPrint }) => (
              <div
                key={project.id}
                className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/90 hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${hasStock ? 'bg-emerald-400 shadow-sm shadow-emerald-500/50' : 'bg-rose-400'}`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-white text-xs truncate max-w-[180px] sm:max-w-xs">{project.nomePeca}</span>
                      <span className="text-[10px] text-slate-400 truncate">· {project.clienteNome || 'Cliente não informado'}</span>
                      {hasStock ? (
                        <span className="text-[9px] text-emerald-400 font-semibold bg-emerald-950/40 border border-emerald-500/30 px-1.5 py-0.2 rounded">
                          Pronto ({pesoNecessario}g · restam {remainingAfterPrint}g)
                        </span>
                      ) : (
                        <span className="text-[9px] text-rose-400 font-semibold bg-rose-950/40 border border-rose-500/30 px-1.5 py-0.2 rounded">
                          Falta filamento
                        </span>
                      )}
                    </div>
                    {spoolUsed && (
                      <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                        🧵 Usar <strong className="text-amber-300">{spoolUsed.tipo} {spoolUsed.cor}</strong> ({spoolUsed.pesoRestanteG}g disponíveis)
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-2.5 shrink-0">
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    <span>Venda: <strong className="text-white">{formatCurrency(project.precoCobrado)}</strong></span>
                    <span>Lucro: <strong className="text-emerald-400 font-bold">{formatCurrency(project.lucroLiquido)}</strong></span>
                    <span>Tempo: <strong className="text-slate-300">{project.tempoEstimadoHoras}h</strong></span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate('/cliente/calculadora', { state: { recalculateProject: project } })}
                      className="border-slate-750 bg-slate-900 text-slate-300 text-[10px] rounded-md h-6 px-2"
                      title="Abrir na Calculadora"
                    >
                      <Calculator className="w-2.5 h-2.5 mr-1 text-slate-400" />
                      Calculadora
                    </Button>
                    <Button
                      size="sm"
                      disabled={!hasStock}
                      onClick={() => handleStartQuoteProduction({ project, pesoNecessario, hasStock, spoolUsed, remainingAfterPrint })}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] rounded-md h-6 px-2.5 shadow-sm"
                      title="Enviar para impressão"
                    >
                      <Play className="w-2.5 h-2.5 mr-1" />
                      Iniciar
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* 3. SEÇÃO PRINCIPAL: O QUE IMPRIMIR COM O ESTOQUE (CARDS MENORES & SEM REPETIÇÃO) */}
      <Card className="bg-slate-900 border-slate-800 rounded-xl">
        <CardHeader className="py-2 px-3.5 border-b border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
            <div>
              <CardTitle className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                O que Imprimir · Oportunidades Únicas por Peça
              </CardTitle>
              <CardDescription className="text-[10px] text-slate-400">
                Uma recomendação otimizada por projeto com o melhor carretel, visando lucro máximo e desperdício mínimo
              </CardDescription>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-0.5">
                <span className="text-[10px] text-slate-400">Carretel:</span>
                <select
                  value={selectedSpoolFilter}
                  onChange={e => setSelectedSpoolFilter(e.target.value)}
                  className="bg-transparent text-[10px] text-white focus:outline-none cursor-pointer"
                >
                  <option value="todos" className="bg-slate-900 text-white">Todos ({availableSpools.length})</option>
                  {availableSpools.map(spool => (
                    <option key={spool.id} value={spool.id} className="bg-slate-900 text-white">
                      {spool.tipo} {spool.cor} ({spool.pesoRestanteG}g)
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg px-2 py-0.5">
                <span className="text-[10px] text-slate-400">Ordenar:</span>
                <select
                  value={sortBy}
                  onChange={e => setSortBy(e.target.value as any)}
                  className="bg-transparent text-[10px] text-white focus:outline-none cursor-pointer"
                >
                  <option value="lucro" className="bg-slate-900 text-white">💰 Maior Lucro (R$)</option>
                  <option value="desperdicio" className="bg-slate-900 text-white">♻️ Mínimo Desperdício (Sobra)</option>
                  <option value="margem" className="bg-slate-900 text-white">📈 Maior Margem (%)</option>
                  <option value="lucroHora" className="bg-slate-900 text-white">⏱️ Maior Lucro/Hora</option>
                  <option value="quantidade" className="bg-slate-900 text-white">📦 Mais Peças / Lote</option>
                </select>
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-2.5">
          {projectOpportunities.length === 0 ? (
            <div className="text-center py-6 text-slate-400 space-y-1">
              <Package className="w-7 h-7 mx-auto text-slate-600 mb-1" />
              <p className="text-xs font-semibold text-white">Nenhum projeto cabe no estoque atual com os filtros selecionados.</p>
              <p className="text-[10px]">Adicione filamentos com saldo no estoque ou crie novos projetos na Calculadora 3D.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {projectOpportunities.map(opp => (
                <div
                  key={opp.id}
                  className="rounded-xl bg-slate-950 border border-slate-800/90 hover:border-slate-700 transition-all p-2.5 flex flex-col justify-between space-y-2 shadow-sm"
                >
                  <div className="space-y-1">
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="min-w-0">
                        <h4 className="font-bold text-white text-xs truncate" title={opp.piece.nomePeca}>
                          {opp.piece.nomePeca}
                        </h4>
                        <div className="flex items-center gap-1 mt-0.5">
                          <span
                            className="w-2 h-2 rounded-full shrink-0 border border-slate-700"
                            style={{ backgroundColor: opp.bestSpool.corHex || '#ffffff' }}
                          />
                          <span className="text-[10px] text-slate-300 font-medium truncate">
                            {opp.bestSpool.tipo} {opp.bestSpool.cor}
                          </span>
                          <span className="text-[9px] text-slate-500">
                            ({opp.bestSpool.pesoRestanteG}g)
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {opp.isLowWaste ? (
                          <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[9px] py-0 px-1 font-semibold">
                            ♻️ Zero Desperdício
                          </Badge>
                        ) : opp.margemPercentual >= 70 ? (
                          <Badge className="bg-indigo-500/15 text-indigo-300 border-indigo-500/30 text-[9px] py-0 px-1 font-semibold">
                            💎 Alta Margem
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[9px] text-slate-400 border-slate-750 py-0 px-1">
                            Giro Farm
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="space-y-0.5 pt-0.5">
                      <div className="flex justify-between items-center text-[9px] text-slate-400">
                        <span>Aproveitamento</span>
                        <strong className="text-white">{opp.percentualUsoCarretel}% do filamento</strong>
                      </div>
                      <div className="w-full bg-slate-900 rounded-full h-1 overflow-hidden">
                        <div
                          className={`h-1 rounded-full ${
                            opp.isLowWaste
                              ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                              : 'bg-gradient-to-r from-indigo-500 to-emerald-500'
                          }`}
                          style={{ width: `${opp.percentualUsoCarretel}%` }}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1 pt-0.5 text-xs">
                      <div className="p-1 rounded-md bg-slate-900 border border-slate-800/80">
                        <span className="text-[9px] text-slate-400 block leading-tight">Lote Máximo</span>
                        <span className="text-[11px] font-bold text-white">
                          {opp.capacidadeLote} un{' '}
                          <span className="text-[9px] font-normal text-slate-400">({opp.pesoTotalConsumidoG}g)</span>
                        </span>
                        <span className={`text-[9px] block mt-0.5 ${opp.isLowWaste ? 'text-emerald-400 font-semibold' : 'text-slate-500'}`}>
                          Sobra: {opp.sobraCarretelG}g
                        </span>
                      </div>

                      <div className="p-1 rounded-md bg-emerald-950/25 border border-emerald-500/30">
                        <span className="text-[9px] text-emerald-400 block font-medium leading-tight">Lucro Líquido</span>
                        <span className="text-[11px] font-black text-emerald-300 block">
                          +{formatCurrency(opp.lucroLiquidoLote)}
                        </span>
                        <span className="text-[9px] text-emerald-400/90 block font-semibold">
                          {opp.margemPercentual.toFixed(0)}% margem
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-400 px-0.5 pt-0.5">
                      <span>Fatura: <strong className="text-slate-200">{formatCurrency(opp.faturamentoLote)}</strong></span>
                      <span>Tempo: <strong className="text-slate-300">{opp.tempoTotalHoras.toFixed(1)}h</strong></span>
                      <span>R$/h: <strong className="text-indigo-300">{formatCurrency(opp.lucroPorHora)}/h</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 pt-1 border-t border-slate-900">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleSimulateInCalculator(opp)}
                      className="w-1/2 border-slate-750 bg-slate-900 hover:bg-slate-850 text-slate-300 text-[10px] rounded-md h-6 px-1.5"
                      title="Abrir simulação na Calculadora 3D"
                    >
                      <Calculator className="w-2.5 h-2.5 mr-1 text-slate-400" />
                      Simular
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleCreateBatchProject(opp)}
                      className="w-1/2 bg-gradient-to-r from-amber-500 to-indigo-600 hover:opacity-90 text-white font-bold text-[10px] rounded-md h-6 px-1.5 shadow-sm"
                      title="Enviar lote para produção na farm"
                    >
                      <Zap className="w-2.5 h-2.5 mr-1" />
                      Produzir
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 4. SEÇÃO: APROVEITAMENTO DE SOBRAS & ZERO DESPERDÍCIO (COMPACTA) */}
      {lowWeightSpools.length > 0 && (
        <Card className="bg-slate-900 border-slate-800 rounded-xl">
          <CardHeader className="py-2 px-3.5 border-b border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Gift className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-xs font-bold text-white">
                  Aproveitamento de Sobras · Zero Desperdício (Carretéis &lt; 220g)
                </span>
              </div>
              <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-[9px] py-0 px-1">
                {lowWeightSpools.length} carretel(is) com sobra
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-2.5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {SCRAP_ITEMS.map((item, idx) => (
                <div key={idx} className="p-2 rounded-lg bg-slate-950 border border-slate-800 space-y-1">
                  <div className="flex justify-between items-center gap-1">
                    <span className="font-bold text-white text-[10px] truncate">{item.nomePeca}</span>
                    <Badge variant="outline" className="text-[9px] text-amber-300 border-amber-500/30 py-0 px-1">
                      {item.pesoEstimadoG}g
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-[9px] text-slate-400">
                    <span>Lucro: <strong className="text-emerald-400">{formatCurrency(item.lucroLiquido)}</strong></span>
                    <span>Tempo: {item.tempoEstimadoHoras}h</span>
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
                    className="w-full h-5 text-[9px] text-indigo-300 hover:text-white hover:bg-slate-850 rounded justify-center"
                  >
                    Simular Brindes <ChevronRight className="w-2.5 h-2.5 ml-0.5" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 5. DIRETRIZES DA IA SPARTAN */}
      <div className="rounded-xl bg-slate-900/80 border border-slate-800 p-2.5 flex items-center gap-2 text-xs text-slate-300">
        <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span className="text-[10px] sm:text-[11px] leading-relaxed">
          <strong className="text-white">Dica da Farm:</strong> Priorize peças com badge <strong className="text-emerald-300">♻️ Zero Desperdício</strong> e margem acima de 65%. Assim você converte 100% do filamento em lucro líquido sem sobras mortas na prateleira.
        </span>
      </div>
    </div>
  );
};
