"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plan } from '@/types/saas';

interface ClientUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  plans: Plan[];
  currentPlan: Plan;
  onUpgrade: (planId: string) => void;
}

export const ClientUpgradeModal: React.FC<ClientUpgradeModalProps> = ({
  isOpen,
  onClose,
  plans,
  currentPlan,
  onUpgrade,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 space-y-5 shadow-2xl">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="text-xl font-bold text-white">Faça Upgrade e Aumente seus Resultados</h3>
            <p className="text-xs text-slate-400">
              Desbloqueie mais créditos de IA, mais usuários e automações ilimitadas
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {plans.map(plan => (
            <div
              key={plan.id}
              className={`p-4 rounded-xl border flex flex-col justify-between ${
                plan.id === currentPlan.id
                  ? 'border-emerald-500 bg-emerald-950/20'
                  : 'border-slate-800 bg-slate-950/60 hover:border-indigo-500'
              }`}
            >
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-white text-sm">{plan.name}</span>
                  {plan.id === currentPlan.id && (
                    <Badge className="bg-emerald-500 text-[9px] text-white">ATUAL</Badge>
                  )}
                </div>
                <p className="text-xl font-black text-indigo-400">
                  R$ {plan.priceMonthly}
                  <span className="text-xs text-slate-400 font-normal">/mês</span>
                </p>
                <p className="text-[11px] text-slate-400">{plan.creditsAI.toLocaleString()} créditos de IA</p>
              </div>

              <Button
                disabled={plan.id === currentPlan.id}
                onClick={() => onUpgrade(plan.id)}
                className={`w-full mt-4 text-xs font-bold rounded-xl ${
                  plan.id === currentPlan.id
                    ? 'bg-slate-800 text-slate-400'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
              >
                {plan.id === currentPlan.id ? 'Plano Atual' : 'Escolher este'}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};