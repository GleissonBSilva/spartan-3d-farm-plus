"use client";

import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Flame, ArrowRight, Play, CheckCircle2, Sparkles } from 'lucide-react';

interface HeroSectionProps {
  onDemoAccess: (role: 'admin' | 'client') => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({ onDemoAccess }) => {
  return (
    <section className="relative pt-20 pb-24 md:pt-28 md:pb-36 px-4 overflow-hidden">
      {/* Glow Effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gradient-to-tr from-amber-500/10 via-indigo-600/20 to-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="container max-w-6xl mx-auto text-center relative z-10 space-y-8">
        {/* Top Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/90 border border-indigo-500/30 text-xs font-semibold text-indigo-300 shadow-xl backdrop-blur-md">
          <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
          <span>O Sistema Operacional para Makers, Farms & Prototipagem 3D</span>
        </div>

        {/* Main Title */}
        <h1 className="text-4xl sm:text-6xl md:text-7xl font-black tracking-tight text-white max-w-4xl mx-auto leading-[1.1]">
          Precifique, Gerencie e Escale sua{' '}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-400 via-indigo-300 to-cyan-400">
            Fazenda de Impressão 3D
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-xl text-slate-300 max-w-2xl mx-auto leading-relaxed">
          Elimine planilhas manuais. Calcule custos reais de filamento, resina, kWh e depreciação com 1 clique, controle seu estoque de carretéis e envie orçamentos profissionais via WhatsApp.
        </p>

        {/* Action CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
          <Link to="/register" className="w-full sm:w-auto">
            <Button className="w-full sm:w-auto h-14 px-8 text-base font-bold bg-gradient-to-r from-amber-500 via-indigo-600 to-cyan-600 hover:opacity-95 text-white rounded-full shadow-2xl shadow-indigo-600/40 hover:scale-105 transition-all">
              Começar Teste de 14 Dias Grátis
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>

          <Button
            onClick={() => onDemoAccess('client')}
            variant="outline"
            className="w-full sm:w-auto h-14 px-7 text-sm font-semibold bg-slate-900/80 border-slate-750 hover:bg-slate-800 text-slate-200 rounded-full"
          >
            <Play className="w-4 h-4 mr-2 text-cyan-400 fill-cyan-400" />
            Entrar no painel
          </Button>
        </div>

        {/* Trust Proof */}
        <div className="pt-6 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Compatível com Bambu Lab, Creality, Elegoo e Prusa
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Integração com arquivos STL / Gcode do Cura e OrcaSlicer
          </div>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" /> Sem necessidade de cartão no teste
          </div>
        </div>

        {/* Interactive Print Farm Mockup */}
        <div className="pt-10 max-w-5xl mx-auto">
          <div className="p-3 bg-gradient-to-b from-slate-800/80 via-slate-900/60 to-slate-950 rounded-3xl border border-slate-750/80 shadow-2xl backdrop-blur-2xl">
            <div className="bg-slate-950 rounded-2xl p-4 sm:p-6 border border-slate-800/80 space-y-5 text-left">
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500" />
                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500" />
                  <span className="text-xs text-slate-400 font-mono ml-2">spartan3d.app/maker/farm</span>
                </div>
                <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
                  ● 4 MÁQUINAS EXTRUDANDO
                </Badge>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-slate-400">Bambu P1S #01</span>
                    <span className="text-[10px] text-indigo-400 font-bold">74%</span>
                  </div>
                  <p className="text-sm font-bold text-white mt-1 truncate">Luminária Voronoi</p>
                  <span className="text-[10px] text-emerald-400">PLA Preto • 2h restantes</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-slate-400">Creality K1 Max</span>
                    <span className="text-[10px] text-amber-400 font-bold">45%</span>
                  </div>
                  <p className="text-sm font-bold text-white mt-1 truncate">Gabinete Eletrônico</p>
                  <span className="text-[10px] text-cyan-400">PETG Cinza • 6h restantes</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-slate-400">Elegoo Saturn 4</span>
                    <span className="text-[10px] text-emerald-400 font-bold">LIVRE</span>
                  </div>
                  <p className="text-sm font-bold text-white mt-1">Pronta p/ Resina</p>
                  <span className="text-[10px] text-slate-400">Tanque 8K nivelado</span>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="flex justify-between items-center">
                    <span className="text-[11px] text-slate-400">Lucro do Dia</span>
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <p className="text-lg font-black text-emerald-400 mt-1">+ R$ 485,00</p>
                  <span className="text-[10px] text-slate-400">5 orçamentos fechados</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={() => onDemoAccess('client')}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-xl"
                >
                  Acessar Calculadora & Painel Maker
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
