"use client";

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Sparkles, Crown, MessageSquareCheck, ArrowUpRight } from 'lucide-react';
import { Plan } from '@/types/saas';

interface ClientOverviewCardsProps {
  currentPlan: Plan;
  clientCredits: number;
  onOpenUpgradeModal: () => void;
}

export const ClientOverviewCards: React.FC<ClientOverviewCardsProps> = ({
  currentPlan,
  clientCredits,
  onOpenUpgradeModal,
}) => {
  const maxCredits = currentPlan.creditsAI;
  const usedCreditsPercentage = Math.min(
    100,
    Math.round(((maxCredits - clientCredits) / maxCredits) * 100)
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* CARD 1: Créditos IA Mensais */}
      <Card className="bg-slate-900 border border-indigo-500/30 rounded-2xl shadow-lg hover:border-indigo-500/60 transition-all">
        <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Créditos de IA Mensais</span>
              </div>
              <Badge className="bg-indigo-500/10 border-indigo-500/30 text-indigo-300 text-[10px] px-2 py-0.5 font-bold">
                {clientCredits.toLocaleString()} restantes
              </Badge>
            </div>
            <div className="mt-4">
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-2xl lg:text-3xl font-black text-white tracking-tight">
                  {clientCredits.toLocaleString()}
                </span>
                <span className="text-xs text-slate-400 font-medium">
                  de {currentPlan.creditsAI.toLocaleString()} contratados
                </span>
              </div>
              <Progress value={100 - usedCreditsPercentage} className="h-2 bg-slate-950" />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
            <span className="text-slate-400">Renovação no ciclo</span>
            <button
              onClick={onOpenUpgradeModal}
              className="text-indigo-400 hover:text-indigo-300 font-bold inline-flex items-center gap-0.5 transition-colors"
            >
              + Recarregar / Upgrade <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* CARD 2: Seu Plano Ativo */}
      <Card className="bg-slate-900 border border-amber-500/30 rounded-2xl shadow-lg hover:border-amber-500/60 transition-all">
        <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                  <Crown className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Seu Plano Ativo</span>
              </div>
              <Badge className="bg-amber-500/10 border-amber-500/30 text-amber-300 text-[10px] px-2 py-0.5 font-bold">
                Assinatura Ativa
              </Badge>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl lg:text-3xl font-black text-white tracking-tight">{currentPlan.name}</h3>
              <p className="text-xs text-amber-400 font-semibold mt-1">R$ {currentPlan.priceMonthly}/mês • Renovação automática</p>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
            <span className="text-slate-400">Acesso completo à Farm</span>
            <Button
              size="sm"
              onClick={onOpenUpgradeModal}
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs h-7 px-3 shadow-md shadow-amber-500/20"
            >
              Mudar Plano
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* CARD 3: Gerente de Sucesso */}
      <Card className="bg-slate-900 border border-emerald-500/30 rounded-2xl shadow-lg hover:border-emerald-500/60 transition-all">
        <CardContent className="p-5 flex flex-col justify-between h-full space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <MessageSquareCheck className="w-4 h-4" />
                </div>
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Gerente de Sucesso</span>
              </div>
              <Badge className="bg-emerald-500/10 border-emerald-500/30 text-emerald-300 text-[10px] px-2 py-0.5 font-bold">
                ● Online
              </Badge>
            </div>
            <div className="mt-4">
              <h3 className="text-2xl font-black text-white tracking-tight">Gleison (Head CS)</h3>
              <p className="text-xs text-emerald-400 font-semibold mt-1">Atendimento prioritário para sua operação</p>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
            <span className="text-slate-400">Suporte técnico direto</span>
            <a
              href="https://wa.me/5511999999999"
              target="_blank"
              rel="noreferrer"
            >
              <Button size="sm" variant="outline" className="border-emerald-500/40 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 text-xs rounded-xl h-7 px-3 font-semibold">
                Chamar VIP
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};