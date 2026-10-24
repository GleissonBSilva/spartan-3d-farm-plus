"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check } from 'lucide-react';
import { Plan } from '@/types/saas';

interface ClientPlansPricingProps {
  plans: Plan[];
  currentPlan: Plan;
  onUpgrade: (planId: string) => void;
}

export const ClientPlansPricing: React.FC<ClientPlansPricingProps> = ({
  plans,
  currentPlan,
  onUpgrade,
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {plans.map(plan => (
        <div
          key={plan.id}
          className={`p-6 rounded-2xl border flex flex-col justify-between ${
            plan.id === currentPlan.id
              ? 'border-emerald-500 bg-emerald-950/20 shadow-xl'
              : 'border-slate-800 bg-slate-900 hover:border-indigo-500'
          }`}
        >
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="font-bold text-white text-base">{plan.name}</span>
              {plan.id === currentPlan.id && (
                <Badge className="bg-emerald-500 text-[10px] text-white">PLANO ATIVO</Badge>
              )}
            </div>
            <p className="text-2xl font-black text-indigo-400">
              R$ {plan.priceMonthly}
              <span className="text-xs text-slate-400 font-normal">/mês</span>
            </p>
            <p className="text-xs text-slate-300">{plan.description}</p>
            <div className="pt-2 border-t border-slate-800 space-y-1.5 text-xs text-slate-300">
              {plan.features.map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span>{f}</span>
                </div>
              ))}
            </div>
          </div>

          <Button
            disabled={plan.id === currentPlan.id}
            onClick={() => onUpgrade(plan.id)}
            className={`w-full mt-6 text-xs font-bold rounded-xl h-10 ${
              plan.id === currentPlan.id
                ? 'bg-slate-800 text-slate-400'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'
            }`}
          >
            {plan.id === currentPlan.id ? 'Seu Plano Atual' : 'Fazer Upgrade Agora'}
          </Button>
        </div>
      ))}
    </div>
  );
};