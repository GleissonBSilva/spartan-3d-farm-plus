"use client";

import React, { useState } from 'react';
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

export const AdminOverview: React.FC = () => {
  const { metrics, clients } = useSaaSData();
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiInsight, setAiInsight] = useState('Insights are generated from the current dashboard data.');
  const newThisMonth = clients.filter(client => client.joinedAt && new Date(client.joinedAt).getMonth() === new Date().getMonth() && new Date(client.joinedAt).getFullYear() === new Date().getFullYear()).length;

  const handleGenerateAiInsight = async () => {
    setAiGenerating(true);
    try {
      const { data, error } = await requireSupabase().functions.invoke('ai-assistant', { body: { question: `Analyze these actual subscription metrics and give one practical, evidence-based recommendation. Do not invent missing data. MRR: R$ ${metrics.mrr}; active clients: ${metrics.activeClients}; paid revenue history: ${JSON.stringify(metrics.revenueHistory)}.` } });
      if (error) throw error;
      setAiInsight(data.answer);
      toast.success('Análise gerada com IA.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao gerar análise.');
    } finally { setAiGenerating(false); }
  };
  return (
    <div className="space-y-6">
      {/* AI Growth Copilot Alert Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-indigo-900/60 via-purple-900/40 to-slate-900 border border-indigo-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
        <div className="flex items-start gap-3.5">
          <div className="p-2.5 rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-white text-sm">Copilot de Crescimento & MRR</span>
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
                IA via Supabase
              </Badge>
            </div>
            <p className="text-xs text-slate-300 mt-1 max-w-2xl">{aiInsight}</p>
          </div>
        </div>

        <Button
          onClick={handleGenerateAiInsight}
          disabled={aiGenerating}
          size="sm"
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-300" />
          {aiGenerating ? 'Analisando dados...' : 'Gerar Novo Insight'}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-slate-900/80 border-slate-800 rounded-2xl shadow-lg">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                MRR (Receita Mensal)
              </span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl lg:text-3xl font-black text-white">
                R$ {metrics.mrr.toLocaleString('pt-BR')}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <ArrowUpRight className="w-4 h-4" />
              <span>Calculado com assinaturas ativas</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800 rounded-2xl shadow-lg">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                ARR Projetado
              </span>
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl lg:text-3xl font-black text-white">
                R$ {metrics.arr.toLocaleString('pt-BR')}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-indigo-400 font-medium">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Escala em expansão</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800 rounded-2xl shadow-lg">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Assinantes Ativos
              </span>
              <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <span className="text-2xl lg:text-3xl font-black text-white">
                {metrics.activeClients} empresas
              </span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <ArrowUpRight className="w-4 h-4" />
              <span>{newThisMonth} novos este mês</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900/80 border-slate-800 rounded-2xl shadow-lg">
          <CardContent className="p-5">
            <div className="flex justify-between items-start">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Churn Rate / LTV Médio
              </span>
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400">
                <Activity className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl font-black text-white">{metrics.churnRate}%</span>
              <span className="text-xs text-slate-400">
                LTV: <strong className="text-indigo-300">R$ {metrics.ltv.toLocaleString()}</strong>
              </span>
            </div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
              <span>Indicadores derivados dos dados disponíveis</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 bg-slate-900 border-slate-800 rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base text-white font-bold">Receita recebida</CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Evolução mensal do faturamento recorrente
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
                    formatter={(value: any) => [`R$ ${Number(value).toLocaleString('pt-BR')}`, 'Receita']}
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
                    formatter={(value: any) => [`${value}%`, 'Participação']}
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
    </div>
  );
};