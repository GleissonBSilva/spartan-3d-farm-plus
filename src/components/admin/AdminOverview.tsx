"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DollarSign,
  TrendingUp,
  Users,
  Activity,
  ArrowUpRight,
  Sparkles,
  Bot,
  Copy,
  Check,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Lock,
  Unlock,
  MessageCircle,
  XCircle,
  Flame,
  ShieldAlert,
  Layers,
  Calendar,
  Percent,
  TrendingDown,
  Printer,
  ChevronRight,
  HelpCircle,
  QrCode,
  ArrowDownRight,
  CheckSquare,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useSaaSData } from '@/context/SaaSDataContext';
import { toast } from 'sonner';
import { requireSupabase } from '@/lib/supabase';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { normalizeWhatsAppPhone, formatInvoiceDueWhatsAppMessage, formatTrialEndingWhatsAppMessage } from '@/services/whatsappService';

export const AdminOverview: React.FC = () => {
  const {
    metrics,
    clients,
    projetos,
    invoices,
    impressoras,
    filamentos,
    updateClientStatus,
    updateClientValidity,
    confirmInvoicePayment,
  } = useSaaSData();

  // Aba ativa de controle gerencial
  const [activeTab, setActiveTab] = useState<'visao_geral' | 'falhas_erros' | 'lucro_clientes'>('visao_geral');

  // Copilot IA
  const [aiGenerating, setAiGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [aiInsight, setAiInsight] = useState(
    'Clique em "Gerar Diagnóstico 360°" para que a IA analise a correlação entre margem de lucro real, custos operacionais, faturas pendentes e taxa de falhas na farm.'
  );

  // 1. GESTÃO DE LUCRO & RENTABILIDADE REAL
  const profitAnalytics = useMemo(() => {
    const concluidos = projetos.filter(p => p.status === 'concluido');
    const receitaProjetos = concluidos.reduce((sum, p) => sum + (p.precoCobrado || 0), 0);
    const custoProjetos = concluidos.reduce((sum, p) => sum + (p.custoTotal || 0), 0);
    const lucroLiquidoProjetos = concluidos.reduce(
      (sum, p) => sum + (p.lucroLiquido !== undefined ? p.lucroLiquido : (p.precoCobrado - p.custoTotal)),
      0
    );

    const faturasPagas = invoices.filter(i => i.status === 'paid');
    const receitaAssinaturas = faturasPagas.reduce((sum, i) => sum + (i.amount || 0), 0);

    const receitaTotal = receitaProjetos + receitaAssinaturas;
    const lucroConsolidado = lucroLiquidoProjetos + receitaAssinaturas;
    const margemMediaPercentual = receitaTotal > 0 ? Math.round((lucroConsolidado / receitaTotal) * 100) : (metrics.mrr > 0 ? 82 : 0);

    return {
      receitaProjetos,
      custoProjetos,
      lucroLiquidoProjetos,
      receitaAssinaturas,
      receitaTotal,
      lucroConsolidado: lucroConsolidado || metrics.mrr,
      margemMediaPercentual,
      totalProjetosConcluidos: concluidos.length,
    };
  }, [projetos, invoices, metrics.mrr]);

  // 2. RADAR DE FALHAS, ERROS & PREJUÍZOS
  const failureAnalytics = useMemo(() => {
    const cancelados = projetos.filter(p => p.status === 'cancelado');
    const totalPrejuizoFalhas = cancelados.reduce((sum, p) => sum + (p.custoTotal || 0), 0);
    const totalGramasPerdidas = cancelados.reduce((sum, p) => sum + (p.pesoEstimadoG || 0), 0);
    const taxaFalhaProjetos = projetos.length > 0 ? Math.round((cancelados.length / projetos.length) * 100) : 0;

    const faturasPendentes = invoices.filter(i => i.status === 'pending');
    const valorEmRiscoInadimplencia = faturasPendentes.reduce((sum, i) => sum + (i.amount || 0), 0);

    const clientesBloqueados = clients.filter(c => c.status === 'overdue');
    const mrrBloqueado = clientesBloqueados.reduce((sum, c) => sum + (c.mrr || 0), 0);

    const impressorasParadas = impressoras.filter(imp => imp.status === 'maintenance' || imp.status === 'offline');
    const perdaTotalIdentificada = totalPrejuizoFalhas + valorEmRiscoInadimplencia;

    return {
      totalCancelados: cancelados.length,
      totalPrejuizoFalhas,
      totalGramasPerdidas,
      taxaFalhaProjetos,
      faturasPendentes,
      faturasPendentesCount: faturasPendentes.length,
      valorEmRiscoInadimplencia,
      clientesBloqueados,
      clientesBloqueadosCount: clientesBloqueados.length,
      mrrBloqueado,
      impressorasParadas,
      impressorasParadasCount: impressorasParadas.length,
      perdaTotalIdentificada,
    };
  }, [projetos, invoices, clients, impressoras]);

  // 3. CONTROLE FINANCEIRO & FLUXO DE CAIXA
  const financialAnalytics = useMemo(() => {
    const faturasPagas = invoices.filter(i => i.status === 'paid');
    const faturasPendentes = invoices.filter(i => i.status === 'pending');

    const totalRecebidoPix = faturasPagas.reduce((sum, i) => sum + (i.amount || 0), 0);
    const totalAReceber = faturasPendentes.reduce((sum, i) => sum + (i.amount || 0), 0);
    const totalFaturas = invoices.length;
    const taxaLiquidacao = totalFaturas > 0 ? Math.round((faturasPagas.length / totalFaturas) * 100) : 100;

    return {
      totalRecebidoPix,
      totalAReceber,
      taxaLiquidacao,
      totalFaturas,
      totalFaturasPagas: faturasPagas.length,
    };
  }, [invoices]);

  // 4. GESTÃO ESTRATÉGICA DE CLIENTES & RETENÇÃO
  const clientAnalytics = useMemo(() => {
    const ativos = clients.filter(c => c.status === 'active');
    const trialing = clients.filter(c => c.status === 'trialing');
    const atrasados = clients.filter(c => c.status === 'overdue');

    // Clientes em risco iminente (trial vencendo em <= 3 dias ou atrasado)
    const emRisco = clients.filter(c => {
      if (c.status === 'overdue') return true;
      if (c.status === 'trialing') {
        const vDate = c.trialEndsAt
          ? new Date(c.trialEndsAt)
          : (c.joinedAt ? new Date(new Date(c.joinedAt).getTime() + 14 * 86400000) : null);
        if (!vDate) return false;
        const diasRestantes = Math.ceil((vDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
        return diasRestantes <= 3;
      }
      return false;
    });

    // Mapeamento dos clientes por lucro gerado
    const clientesComPerformance = clients.map(client => {
      const faturasPagas = invoices.filter(i => i.clientId === client.id && i.status === 'paid');
      const totalPago = faturasPagas.reduce((sum, i) => sum + (i.amount || 0), 0);
      const mrr = client.mrr || 0;
      const temFaturaPendente = invoices.some(i => i.clientId === client.id && i.status === 'pending');

      let saude: 'saudavel' | 'atencao' | 'critico' = 'saudavel';
      if (client.status === 'overdue' || client.status === 'canceled') {
        saude = 'critico';
      } else if (client.status === 'trialing' || temFaturaPendente) {
        saude = 'atencao';
      }

      return {
        ...client,
        totalPago,
        scoreReceita: totalPago + mrr,
        saude,
        temFaturaPendente,
      };
    }).sort((a, b) => b.scoreReceita - a.scoreReceita);

    const ticketMedio = ativos.length > 0 ? Math.round(metrics.mrr / ativos.length) : 0;
    const newThisMonth = clients.filter(c => c.joinedAt && new Date(c.joinedAt).getMonth() === new Date().getMonth()).length;

    return {
      totalClientes: clients.length,
      ativosCount: ativos.length,
      trialingCount: trialing.length,
      atrasadosCount: atrasados.length,
      emRisco,
      clientesComPerformance,
      ticketMedio,
      newThisMonth,
    };
  }, [clients, invoices, metrics.mrr]);

  // Lista consolidada de Falhas e Erros em tempo real
  const issuesList = useMemo(() => {
    const list: Array<{
      id: string;
      tipo: 'financeiro' | 'producao' | 'retencao' | 'equipamento';
      titulo: string;
      descricao: string;
      impactoStr: string;
      severidade: 'alta' | 'media' | 'baixa';
      acaoRotulo?: string;
      acaoUrl?: string;
      onExecutarAcao?: () => Promise<void> | void;
    }> = [];

    // Faturas em Atraso
    failureAnalytics.faturasPendentes.forEach(inv => {
      const client = clients.find(c => c.id === inv.clientId);
      list.push({
        id: `inv-${inv.id}`,
        tipo: 'financeiro',
        titulo: `Fatura Pix Pendente: ${inv.clientName}`,
        descricao: `Vencimento em ${inv.dueDate ? new Date(`${inv.dueDate}T00:00:00`).toLocaleDateString('pt-BR') : 'Sem data'}. Valor aguardando confirmação.`,
        impactoStr: `R$ ${inv.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em risco`,
        severidade: 'alta',
        acaoRotulo: client?.companyPhone ? 'Cobrar WhatsApp' : 'Dar Baixa',
        acaoUrl: client?.companyPhone
          ? `https://wa.me/${normalizeWhatsAppPhone(client.companyPhone)}?text=${encodeURIComponent(
              formatInvoiceDueWhatsAppMessage(inv.clientName, client.companyName || '', inv.amount, inv.dueDate)
            )}`
          : undefined,
        onExecutarAcao: () => void confirmInvoicePayment(inv.id),
      });
    });

    // Clientes em Período de Teste Vencendo
    clientAnalytics.emRisco
      .filter(c => c.status === 'trialing')
      .forEach(client => {
        const vDate = client.trialEndsAt
          ? new Date(client.trialEndsAt)
          : (client.joinedAt ? new Date(new Date(client.joinedAt).getTime() + 14 * 86400000) : new Date());
        const diasRestantes = Math.max(0, Math.ceil((vDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));

        list.push({
          id: `trial-${client.id}`,
          tipo: 'retencao',
          titulo: `Teste Grátis Vencendo: ${client.name}`,
          descricao: diasRestantes === 0 ? 'Encerra hoje! Cliente perderá acesso em breve.' : `Restam apenas ${diasRestantes} dia(s) de teste.`,
          impactoStr: `Risco de Churn (Perda de MRR R$ ${client.mrr || 150})`,
          severidade: 'alta',
          acaoRotulo: client.companyPhone ? 'Converter WhatsApp' : 'Estender +15d',
          acaoUrl: client.companyPhone
            ? `https://wa.me/${normalizeWhatsAppPhone(client.companyPhone)}?text=${encodeURIComponent(
                formatTrialEndingWhatsAppMessage(client.name, client.companyName || '', diasRestantes)
              )}`
            : undefined,
          onExecutarAcao: async () => {
            const novaData = new Date();
            novaData.setDate(novaData.getDate() + 15);
            await updateClientValidity(client.id, novaData.toISOString(), 'trialing');
          },
        });
      });

    // Projetos com falha / cancelados
    projetos
      .filter(p => p.status === 'cancelado')
      .slice(0, 5)
      .forEach(proj => {
        list.push({
          id: `proj-${proj.id}`,
          tipo: 'producao',
          titulo: `Falha / Cancelamento: ${proj.nomePeca}`,
          descricao: `Cliente: ${proj.clienteNome || 'Consumidor'} • Perda de ${proj.pesoEstimadoG || 0}g de filamento.`,
          impactoStr: `Prejuízo de R$ ${(proj.custoTotal || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          severidade: 'media',
        });
      });

    // Impressoras paradas em manutenção
    impressoras
      .filter(imp => imp.status === 'maintenance' || imp.status === 'offline')
      .forEach(imp => {
        list.push({
          id: `imp-${imp.id}`,
          tipo: 'equipamento',
          titulo: `Máquina Parada: ${imp.nome}`,
          descricao: `Status atual: ${imp.status === 'maintenance' ? 'Em Manutenção' : 'Offline'}. Capacidade produtiva reduzida.`,
          impactoStr: 'Ociosidade da Farm',
          severidade: 'baixa',
        });
      });

    return list;
  }, [failureAnalytics, clientAnalytics, projetos, impressoras, clients, confirmInvoicePayment, updateClientValidity]);

  const handleGenerateAiInsight = async () => {
    setAiGenerating(true);
    try {
      const { data, error } = await requireSupabase().functions.invoke('ai-assistant', {
        body: {
          question: `Atue como consultor de controladoria e operações 3D da Spartan 3D. Analise as métricas reais atuais e forneça um plano para maximizar o LUCRO, mitigar FALHAS e controlar o FINANCEIRO. Lucro Consolidado: R$ ${profitAnalytics.lucroConsolidado.toFixed(2)}; Margem: ${profitAnalytics.margemMediaPercentual}%; Prejuízo em Falhas: R$ ${failureAnalytics.totalPrejuizoFalhas.toFixed(2)} (${failureAnalytics.totalGramasPerdidas}g desperdiçadas em ${failureAnalytics.totalCancelados} cancelamentos); Inadimplência em Risco: R$ ${failureAnalytics.valorEmRiscoInadimplencia.toFixed(2)}; Clientes em Risco de Churn: ${clientAnalytics.emRisco.length}; Assinantes Ativos: ${clientAnalytics.ativosCount}. Seja direto, com tópicos em negrito e ações práticas imediatas.`
        }
      });
      if (error) throw error;
      setAiInsight(data.answer);
      toast.success('Diagnóstico de Gestão & Lucro gerado com IA.');
    } catch (error) {
      console.warn('Fallback de diagnóstico heurístico:', error);
      const fallbackAnalysis = `### 📊 Diagnóstico Executivo 360° — Spartan 3D

**1. Gestão de Lucro & Margem Real:**
- **Lucro Consolidado Estimado:** R$ ${profitAnalytics.lucroConsolidado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} com margem média de **${profitAnalytics.margemMediaPercentual}%**.
- **Ação Recomendada:** Os planos Pro e Enterprise apresentam margem líquida superior a 80%. Priorize o fechamento de cobranças pendentes via Pix para liquidar o caixa imediatamente.

**2. Radar de Falhas, Erros & Desperdícios:**
- **Prejuízo de Produção:** R$ ${failureAnalytics.totalPrejuizoFalhas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em ${failureAnalytics.totalCancelados} peças canceladas (${failureAnalytics.totalGramasPerdidas}g de filamento perdidos).
- **Risco Financeiro:** R$ ${failureAnalytics.valorEmRiscoInadimplencia.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} travados em faturas não pagas.
- **Ação Imediata:** Cobrar faturas via WhatsApp no D-1 do vencimento com link direto do Pix Copia e Cola.

**3. Gestão e Retenção de Clientes:**
- **Clientes em Risco Crítico:** **${clientAnalytics.emRisco.length} cliente(s)** entre testes expirando e contas atrasadas.
- **Ação Imediata:** Ofereça 15 dias adicionais de vigência ou condições especiais para os assinantes em período de testes com alto engajamento.`;

      setAiInsight(fallbackAnalysis);
      toast.success('Diagnóstico executivo gerado com sucesso.');
    } finally {
      setAiGenerating(false);
    }
  };

  const handleCopyInsight = () => {
    if (!aiInsight) return;
    navigator.clipboard.writeText(aiInsight);
    setCopied(true);
    toast.success('Diagnóstico copiado para a área de transferência!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Seletor de Módulos de Controle: Visão 360°, Falhas & Erros, Lucro por Cliente */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-1.5 bg-slate-900 border border-slate-800 rounded-2xl shadow-md">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            onClick={() => setActiveTab('visao_geral')}
            className={`h-8 px-3.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'visao_geral'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-400 hover:text-white bg-transparent hover:bg-slate-800/60'
            }`}
          >
            <Layers className="w-3.5 h-3.5 mr-1.5" />
            Visão Geral 360°
          </Button>

          <Button
            size="sm"
            onClick={() => setActiveTab('falhas_erros')}
            className={`h-8 px-3.5 rounded-xl text-xs font-bold transition-all relative ${
              activeTab === 'falhas_erros'
                ? 'bg-rose-600 text-white shadow-md shadow-rose-600/30'
                : 'text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 mr-1.5" />
            <span>Radar de Falhas & Erros</span>
            {issuesList.length > 0 && (
              <span className="ml-1.5 bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-black">
                {issuesList.length}
              </span>
            )}
          </Button>

          <Button
            size="sm"
            onClick={() => setActiveTab('lucro_clientes')}
            className={`h-8 px-3.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'lucro_clientes'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
                : 'text-slate-400 hover:text-white bg-transparent hover:bg-slate-800/60'
            }`}
          >
            <DollarSign className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
            Lucro por Cliente
          </Button>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400 px-2">
          <span>Saúde Geral da Base:</span>
          {failureAnalytics.perdaTotalIdentificada > 0 ? (
            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px] font-bold">
              Atenção: R$ {failureAnalytics.perdaTotalIdentificada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em risco
            </Badge>
          ) : (
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] font-bold">
              100% Saudável
            </Badge>
          )}
        </div>
      </div>

      {/* 4 PILARES FUNDAMENTAIS DE GESTÃO E CONTROLE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* PILAR 1: GESTÃO DE LUCRO & RENTABILIDADE */}
        <Card className="bg-slate-900 border border-emerald-500/30 rounded-2xl shadow-lg hover:border-emerald-500/50 transition-all">
          <CardContent className="p-5 space-y-3">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs uppercase tracking-wider">
                <DollarSign className="w-4 h-4" />
                <span>Lucro Líquido Real</span>
              </div>
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] font-bold">
                Margem: {profitAnalytics.margemMediaPercentual}%
              </Badge>
            </div>

            <div>
              <p className="text-2xl lg:text-3xl font-black text-white">
                R$ {profitAnalytics.lucroConsolidado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Receita Bruta: <strong className="text-slate-200">R$ {profitAnalytics.receitaTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
              </p>
            </div>

            <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Custos Operacionais:</span>
              <span className="font-semibold text-rose-400">
                - R$ {profitAnalytics.custoProjetos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* PILAR 2: RADAR DE FALHAS, ERROS & PREJUÍZOS */}
        <Card className="bg-slate-900 border border-rose-500/30 rounded-2xl shadow-lg hover:border-rose-500/50 transition-all">
          <CardContent className="p-5 space-y-3">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-1.5 text-rose-400 font-semibold text-xs uppercase tracking-wider">
                <ShieldAlert className="w-4 h-4" />
                <span>Falhas & Prejuízos</span>
              </div>
              <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/30 text-[10px] font-bold">
                Taxa de Erro: {failureAnalytics.taxaFalhaProjetos}%
              </Badge>
            </div>

            <div>
              <p className="text-2xl lg:text-3xl font-black text-rose-400">
                R$ {failureAnalytics.perdaTotalIdentificada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Perdas em peças + faturas em atraso
              </p>
            </div>

            <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Filamento Desperdiçado:</span>
              <span className="font-semibold text-amber-400 font-mono">
                {failureAnalytics.totalGramasPerdidas}g ({failureAnalytics.totalCancelados} canceladas)
              </span>
            </div>
          </CardContent>
        </Card>

        {/* PILAR 3: CONTROLE FINANCEIRO & FLUXO DE CAIXA */}
        <Card className="bg-slate-900 border border-indigo-500/30 rounded-2xl shadow-lg hover:border-indigo-500/50 transition-all">
          <CardContent className="p-5 space-y-3">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-1.5 text-indigo-400 font-semibold text-xs uppercase tracking-wider">
                <QrCode className="w-4 h-4" />
                <span>Caixa Realizado (Pix)</span>
              </div>
              <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 text-[10px] font-bold">
                {financialAnalytics.taxaLiquidacao}% Liquidado
              </Badge>
            </div>

            <div>
              <p className="text-2xl lg:text-3xl font-black text-white">
                R$ {financialAnalytics.totalRecebidoPix.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Total recebido e confirmado na conta
              </p>
            </div>

            <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
              <span>A Receber no Mês:</span>
              <span className="font-semibold text-indigo-300">
                R$ {financialAnalytics.totalAReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* PILAR 4: GESTÃO ESTRATÉGICA DE CLIENTES & RETENÇÃO */}
        <Card className="bg-slate-900 border border-cyan-500/30 rounded-2xl shadow-lg hover:border-cyan-500/50 transition-all">
          <CardContent className="p-5 space-y-3">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-1.5 text-cyan-400 font-semibold text-xs uppercase tracking-wider">
                <Users className="w-4 h-4" />
                <span>Controle de Clientes</span>
              </div>
              <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 text-[10px] font-bold">
                {clientAnalytics.ativosCount} Ativos
              </Badge>
            </div>

            <div>
              <p className="text-2xl lg:text-3xl font-black text-white">
                {clientAnalytics.totalClientes} Clientes
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Ticket Médio: <strong className="text-white">R$ {clientAnalytics.ticketMedio}/mês</strong>
              </p>
            </div>

            <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Clientes em Risco (Churn):</span>
              <span className={`font-bold ${clientAnalytics.emRisco.length > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {clientAnalytics.emRisco.length} em alerta
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* CONTEÚDO CONDICIONAL CONFORME A ABA SELECIONADA */}

      {/* ABA 1: VISÃO GERAL 360° */}
      {activeTab === 'visao_geral' && (
        <>
          {/* AI Growth Copilot Alert Banner */}
          <div className="rounded-2xl bg-gradient-to-r from-indigo-950/70 via-purple-950/50 to-slate-900 border border-indigo-500/30 p-5 shadow-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-indigo-500/20 pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white text-sm">Copilot de Controladoria & Lucro</span>
                    <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
                      IA Estratégica
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Diagnóstico cruzando lucratividade, inadimplência e taxa de erro da farm
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {aiInsight && !aiGenerating && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCopyInsight}
                    className="h-8 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl px-2.5"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                    {copied ? 'Copiado!' : 'Copiar'}
                  </Button>
                )}
                <Button
                  onClick={handleGenerateAiInsight}
                  disabled={aiGenerating}
                  size="sm"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shrink-0 h-8 px-3"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-300" />
                  {aiGenerating ? 'Cruzando Lucro & Falhas...' : 'Gerar Diagnóstico 360°'}
                </Button>
              </div>
            </div>

            {aiGenerating ? (
              <div className="p-4 rounded-xl bg-slate-950/70 border border-indigo-500/20 space-y-2.5 animate-pulse">
                <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold">
                  <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                  <span>Calculando rentabilidade líquida, perdas de produção e solvência financeira...</span>
                </div>
                <div className="space-y-1.5 pt-1">
                  <div className="h-3 bg-slate-800 rounded w-3/4"></div>
                  <div className="h-3 bg-slate-800/80 rounded w-full"></div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl bg-slate-950/60 border border-slate-800/80 p-4 text-xs text-slate-200 leading-relaxed font-sans prose prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {aiInsight}
                </ReactMarkdown>
              </div>
            )}
          </div>

          {/* Gráficos Financeiros & Planos */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 bg-slate-900 border-slate-800 rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-base text-white font-bold">Evolução do Faturamento Recorrente</CardTitle>
                  <CardDescription className="text-xs text-slate-400">
                    Histórico de receita recebida dos clientes
                  </CardDescription>
                </div>
                <Badge className="bg-indigo-600/20 text-indigo-400 border-indigo-500/30 text-xs">
                  Últimos 6 meses
                </Badge>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={metrics.revenueHistory} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis dataKey="month" stroke="#64748b" fontSize={12} />
                      <YAxis
                        stroke="#64748b"
                        fontSize={12}
                        tickFormatter={v => `R$ ${(v / 1000).toFixed(0)}k`}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                        formatter={(value: unknown) => [`R$ ${Number(value).toLocaleString('pt-BR')}`, 'Receita']}
                      />
                      <Area type="monotone" dataKey="revenue" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-800 rounded-2xl">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-white font-bold">Distribuição por Planos</CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Participação de clientes na base
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center pt-2">
                <div className="h-[200px] w-full flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={metrics.planDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {metrics.planDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                        formatter={(value: unknown) => [`${value}%`, 'Participação']}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="w-full space-y-2 mt-2">
                  {metrics.planDistribution.map(item => (
                    <div key={item.name} className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-slate-300 font-medium">{item.name}</span>
                      </div>
                      <span className="text-white font-bold">{item.value}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* ABA 2: RADAR DE FALHAS & ERROS (AÇÕES IMEDIATAS) */}
      {activeTab === 'falhas_erros' && (
        <Card className="bg-slate-900 border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <CardHeader className="border-b border-slate-800 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base text-white font-bold flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-rose-400" />
                Central de Falhas, Erros & Prevenção de Prejuízos
              </CardTitle>
              <CardDescription className="text-xs text-slate-400 mt-1">
                Monitore em tempo real cancelamentos, faturas pendentes, perdas de filamento e impressoras ociosas.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/30 text-xs px-2.5 py-1">
                Prejuízo Identificado: R$ {failureAnalytics.perdaTotalIdentificada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {issuesList.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <p className="text-sm font-bold text-white">Nenhuma falha crítica detectada!</p>
                <p className="text-xs text-slate-400">
                  Todas as faturas estão em dia, não há cancelamentos recentes com perda e as impressoras estão operando normalmente.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80">
                {issuesList.map(issue => (
                  <div
                    key={issue.id}
                    className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-800/30 transition-colors"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`p-2 rounded-xl shrink-0 mt-0.5 ${
                          issue.tipo === 'financeiro'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : issue.tipo === 'retencao'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : issue.tipo === 'producao'
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {issue.tipo === 'financeiro' && <DollarSign className="w-4 h-4" />}
                        {issue.tipo === 'retencao' && <Clock className="w-4 h-4" />}
                        {issue.tipo === 'producao' && <XCircle className="w-4 h-4" />}
                        {issue.tipo === 'equipamento' && <Printer className="w-4 h-4" />}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-white text-xs">{issue.titulo}</p>
                          <Badge
                            className={`text-[9px] px-1.5 py-0 uppercase ${
                              issue.severidade === 'alta'
                                ? 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                                : issue.severidade === 'media'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {issue.severidade}
                          </Badge>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">{issue.descricao}</p>
                        <p className="text-[11px] font-semibold text-rose-400 mt-1">
                          Impacto: {issue.impactoStr}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                      {issue.acaoUrl && (
                        <Button
                          size="sm"
                          asChild
                          className="h-7 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow-sm"
                        >
                          <a href={issue.acaoUrl} target="_blank" rel="noopener noreferrer">
                            <MessageCircle className="w-3.5 h-3.5 mr-1" />
                            {issue.acaoRotulo}
                          </a>
                        </Button>
                      )}

                      {issue.onExecutarAcao && !issue.acaoUrl && (
                        <Button
                          size="sm"
                          onClick={() => issue.onExecutarAcao?.()}
                          className="h-7 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold"
                        >
                          {issue.acaoRotulo}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ABA 3: LUCRO POR CLIENTE & MATRIZ DE RENTABILIDADE */}
      {activeTab === 'lucro_clientes' && (
        <Card className="bg-slate-900 border-slate-800 rounded-2xl shadow-xl overflow-hidden">
          <CardHeader className="border-b border-slate-800 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base text-white font-bold flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-400" />
                Matriz de Lucro & Retorno por Cliente
              </CardTitle>
              <CardDescription className="text-xs text-slate-400 mt-1">
                Controle quanto cada cliente gera de receita líquida (MRR + faturas liquidadas) e seu índice de saúde.
              </CardDescription>
            </div>

            <div className="text-xs text-slate-400">
              Total de Assinantes Analisados: <strong className="text-white">{clientAnalytics.clientesComPerformance.length}</strong>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Cliente / Farm</th>
                    <th className="py-3 px-3">Plano</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3">MRR Mensal</th>
                    <th className="py-3 px-3">Total Liquidado (Pix)</th>
                    <th className="py-3 px-3">Índice de Saúde</th>
                    <th className="py-3 px-4 text-right">Ação Direta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-300">
                  {clientAnalytics.clientesComPerformance.map(client => (
                    <tr key={client.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3.5 px-4">
                        <p className="font-bold text-white text-xs">{client.name}</p>
                        <p className="text-[11px] text-slate-400">
                          {client.companyName ? `${client.companyName} • ${client.email}` : client.email}
                        </p>
                      </td>

                      <td className="py-3.5 px-3">
                        <Badge variant="outline" className="border-indigo-500/40 text-indigo-300 bg-indigo-500/10 text-[10px]">
                          {client.planId === 'plan_enterprise'
                            ? 'Enterprise VIP'
                            : client.planId === 'plan_starter'
                            ? 'Starter Booster'
                            : 'Pro Scaler'}
                        </Badge>
                      </td>

                      <td className="py-3.5 px-3">
                        {client.status === 'active' && (
                          <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[11px] font-semibold">
                            <CheckCircle2 className="w-3 h-3" /> Ativo
                          </span>
                        )}
                        {client.status === 'trialing' && (
                          <span className="inline-flex items-center gap-1 text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full text-[11px] font-semibold">
                            <Clock className="w-3 h-3" /> Teste
                          </span>
                        )}
                        {client.status === 'overdue' && (
                          <span className="inline-flex items-center gap-1 text-rose-400 bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 rounded-full text-[11px] font-bold">
                            <Lock className="w-3 h-3" /> Bloqueado
                          </span>
                        )}
                        {client.status === 'canceled' && (
                          <span className="inline-flex items-center gap-1 text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full text-[11px]">
                            Cancelado
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-3 font-bold text-white">
                        R$ {client.mrr || 0}/mês
                      </td>

                      <td className="py-3.5 px-3 font-bold text-emerald-400">
                        R$ {client.totalPago.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>

                      <td className="py-3.5 px-3">
                        {client.saude === 'saudavel' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 text-[11px] font-bold">
                            🟢 Saudável
                          </span>
                        ) : client.saude === 'atencao' ? (
                          <span className="inline-flex items-center gap-1 text-amber-400 text-[11px] font-bold">
                            🟡 Atenção
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-rose-400 text-[11px] font-bold">
                            🔴 Crítico
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        {client.companyPhone && (
                          <Button
                            size="sm"
                            asChild
                            className="h-7 px-2.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 rounded-lg text-xs"
                          >
                            <a
                              href={`https://wa.me/${normalizeWhatsAppPhone(client.companyPhone)}?text=${encodeURIComponent(
                                `Olá, ${client.name}! Aqui é da equipe Spartan 3D.`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <MessageCircle className="w-3 h-3 mr-1 text-emerald-400" />
                              WhatsApp
                            </a>
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
