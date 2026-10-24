"use client";

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ArrowRight } from 'lucide-react';

export const ProfitSimulatorSection: React.FC = () => {
  const [printersCount, setPrintersCount] = useState(6);
  const [hoursPerDay, setHoursPerDay] = useState(14);
  const [avgProfitPerHour, setAvgProfitPerHour] = useState(18);

  const monthlyGrossRevenue = printersCount * hoursPerDay * avgProfitPerHour * 26;
  const estimatedEnergyFilamentCost = monthlyGrossRevenue * 0.28;
  const netMonthlyProfit = Math.round(monthlyGrossRevenue - estimatedEnergyFilamentCost);
  const netYearlyProfit = netMonthlyProfit * 12;

  return (
    <section id="calculadora" className="py-20 px-4">
      <div className="container max-w-4xl mx-auto">
        <Card className="bg-gradient-to-b from-slate-900 via-slate-900/90 to-slate-950 border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-8">
          <div className="text-center space-y-2">
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-xs">
              SIMULADOR DE LUCRO SPARTAN
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-black text-white">
              Simule o Lucro da sua Farm de Impressão 3D
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">
              Veja o potencial de faturamento da sua oficina com as máquinas rodando de forma otimizada.
            </p>
          </div>

          <div className="space-y-6">
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-semibold text-slate-300">
                  Número de Impressoras 3D no Parque
                </label>
                <span className="text-base font-black text-indigo-400">
                  {printersCount} máquinas
                </span>
              </div>
              <Slider
                min={1}
                max={50}
                step={1}
                value={[printersCount]}
                onValueChange={v => setPrintersCount(v[0])}
                className="py-4"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-semibold text-slate-300">
                  Horas médias de trabalho por máquina / dia
                </label>
                <span className="text-base font-black text-amber-400">
                  {hoursPerDay} horas/dia
                </span>
              </div>
              <Slider
                min={4}
                max={24}
                step={1}
                value={[hoursPerDay]}
                onValueChange={v => setHoursPerDay(v[0])}
                className="py-4"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-semibold text-slate-300">
                  Valor médio cobrado por hora de máquina (R$)
                </label>
                <span className="text-base font-black text-emerald-400">
                  R$ {avgProfitPerHour},00 / hora
                </span>
              </div>
              <Slider
                min={8}
                max={60}
                step={1}
                value={[avgProfitPerHour]}
                onValueChange={v => setAvgProfitPerHour(v[0])}
                className="py-4"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-6 rounded-2xl bg-slate-950 border border-slate-800 text-center">
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase">Lucro Líquido Estimado / Mês</p>
              <p className="text-2xl sm:text-3xl font-black text-emerald-400 mt-1">
                + R$ {netMonthlyProfit.toLocaleString('pt-BR')}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase">Lucro Anual Projetado</p>
              <p className="text-2xl sm:text-3xl font-black text-indigo-400 mt-1">
                + R$ {netYearlyProfit.toLocaleString('pt-BR')}
              </p>
            </div>
          </div>

          <div className="text-center pt-2">
            <Link to="/register">
              <Button className="bg-gradient-to-r from-amber-500 via-indigo-600 to-cyan-600 hover:opacity-90 text-white font-bold h-12 px-8 rounded-full shadow-lg shadow-indigo-600/30">
                Cadastrar Minha Farm (14 Dias Grátis)
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </section>
  );
};