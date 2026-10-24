"use client";

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calculator, Layers, Cpu } from 'lucide-react';

export const FeaturesSection: React.FC = () => {
  return (
    <section id="recursos" className="py-20 bg-slate-900/40 border-y border-slate-800/80 px-4">
      <div className="container max-w-6xl mx-auto space-y-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/30 text-xs">
            ENGENHARIA & AUTOMAÇÃO 3D
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-black text-white">
            Tudo o que sua oficina de impressão 3D precisa para lucrar
          </h2>
          <p className="text-sm text-slate-400">
            Esqueça anotações em papel e planilhas confusas. O Spartan 3D centraliza todas as etapas da produção.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="bg-slate-900 border-slate-800 rounded-2xl p-6 space-y-4 hover:border-indigo-500/50 transition-all">
            <div className="w-12 h-12 rounded-xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
              <Calculator className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Calculadora com Taxa de Falha & Energia</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Precifique com precisão cirúrgica considerando gramas de filamento/resina, potência da fonte em Watts, tarifa da sua concessionária de energia e margem para impressões com defeito.
            </p>
          </Card>

          <Card className="bg-slate-900 border-slate-800 rounded-2xl p-6 space-y-4 hover:border-amber-500/50 transition-all">
            <div className="w-12 h-12 rounded-xl bg-amber-600/20 text-amber-400 flex items-center justify-center">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Controle de Estoque & Baixa Automática</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Acompanhe o peso restante de cada carretel de PLA, PETG, ABS, TPU e Resina. O sistema deduz as gramas utilizadas em cada projeto e avisa quando o carretel estiver no final.
            </p>
          </Card>

          <Card className="bg-slate-900 border-slate-800 rounded-2xl p-6 space-y-4 hover:border-cyan-500/50 transition-all">
            <div className="w-12 h-12 rounded-xl bg-cyan-600/20 text-cyan-400 flex items-center justify-center">
              <Cpu className="w-6 h-6" />
            </div>
            <h3 className="text-lg font-bold text-white">Monitor de Print Farm & Manutenções</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Monitore o tempo total de extrusão de cada bico (nozzle), programando manutenções preventivas como troca de bicos de latão/aço e lubrificação de guias lineares.
            </p>
          </Card>
        </div>
      </div>
    </section>
  );
};