"use client";

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check } from 'lucide-react';
import { Plan } from '@/types/saas';

interface PricingSectionProps {
  plans: Plan[];
}

export const PricingSection: React.FC<PricingSectionProps> = ({ plans }) => {
  const [annualBilling, setAnnualBilling] = useState(false);

  return (
    <section id="precos" className="py-20 bg-slate-900/30 border-t border-slate-800/80 px-4">
      <div className="container max-w-6xl mx-auto space-y-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs">
            PLANOS TRANSPARENTES
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-black text-white">
            Planos Feitos na Medida para o seu Negócio 3D
          </h2>
          <p className="text-sm text-slate-400">
            Do hobbista que vende peças sob encomenda até grandes fazendas de manufatura aditiva.
          </p>

          <div className="pt-4 flex items-center justify-center gap-3">
            <span className={`text-xs font-medium ${!annualBilling ? 'text-white' : 'text-slate-400'}`}>
              Mensal
            </span>
            <button
              onClick={() => setAnnualBilling(!annualBilling)}
              className={`w-12 h-6 rounded-full transition-colors relative p-0.5 ${
                annualBilling ? 'bg-indigo-600' : 'bg-slate-800'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-transform ${
                  annualBilling ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
            <span className={`text-xs font-medium flex items-center gap-1 ${annualBilling ? 'text-white' : 'text-slate-400'}`}>
              Anual
              <Badge className="bg-emerald-500 text-[10px] text-white py-0 px-1.5 font-bold">
                20% OFF
              </Badge>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {plans.map(plan => {
            const price = annualBilling ? plan.priceYearly : plan.priceMonthly;
            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col justify-between rounded-3xl transition-all ${
                  plan.popular
                    ? 'bg-slate-900 border-2 border-indigo-500 shadow-2xl shadow-indigo-500/20 scale-105 z-10'
                    : 'bg-slate-950 border-slate-800'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-500 to-indigo-600 text-white text-[11px] font-black px-4 py-0.5 rounded-full shadow-md">
                    RECOMENDADO P/ FARMS
                  </div>
                )}

                <CardHeader className="p-6 pb-4">
                  <CardTitle className="text-xl font-bold text-white">{plan.name}</CardTitle>
                  <CardDescription className="text-xs text-slate-400 mt-1 min-h-[36px]">
                    {plan.description}
                  </CardDescription>

                  <div className="pt-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-xs text-slate-400">R$</span>
                      <span className="text-4xl font-black text-white">{price}</span>
                      <span className="text-xs text-slate-400">/mês</span>
                    </div>
                    {annualBilling && (
                      <p className="text-[10px] text-emerald-400 mt-1">Faturado anualmente com desconto Spartan</p>
                    )}
                  </div>
                </CardHeader>

                <CardContent className="p-6 pt-2 space-y-6 flex-1 flex flex-col justify-between">
                  <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      O que está incluso:
                    </p>
                    {plan.features.map((feature, i) => (
                      <div key={i} className="flex items-start gap-2.5 text-xs text-slate-300">
                        <Check className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>

                  <Link to="/register" className="w-full">
                    <Button
                      className={`w-full h-11 rounded-xl text-xs font-bold transition-all ${
                        plan.popular
                          ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30'
                          : 'bg-slate-800 hover:bg-slate-700 text-white'
                      }`}
                    >
                      Começar 14 Dias Grátis
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};