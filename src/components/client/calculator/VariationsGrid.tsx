"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp } from 'lucide-react';
import { MaterialVariation, ProjectMaterial } from '@/types/saas';

interface VariationsGridProps {
  nomePeca: string;
  variations: MaterialVariation[];
  onSelectVariation: (materials: ProjectMaterial[], colorCount: number) => void;
}

export const VariationsGrid: React.FC<VariationsGridProps> = ({
  nomePeca,
  variations,
  onSelectVariation,
}) => {
  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">
              Simulador de Variações de Cores & Margens Comerciais
            </h3>
            <p className="text-xs text-slate-400">
              Compare o custo de produção e o preço de venda para opções com 1, 2, 3 ou 4 cores para a peça "{nomePeca}".
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          {variations.map(varItem => (
            <div
              key={varItem.id}
              className="p-4 rounded-2xl bg-slate-950 border border-slate-800 flex flex-col justify-between space-y-4 hover:border-indigo-500/60 transition-all"
            >
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-white text-sm">{varItem.name}</span>
                  <Badge className="bg-indigo-500/20 text-indigo-300 text-[10px]">
                    {varItem.colorCount} {varItem.colorCount === 1 ? 'Cor' : 'Cores'}
                  </Badge>
                </div>

                <p className="text-2xl font-black text-indigo-400">
                  R$ {varItem.suggestedPrice.toFixed(2)}
                </p>

                <div className="text-[11px] space-y-1 text-slate-400 pt-2 border-t border-slate-800">
                  <div className="flex justify-between">
                    <span>Peso Total:</span>
                    <span className="text-white font-medium">{varItem.totalWeightGrams}g</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Custo Materiais:</span>
                    <span className="text-white font-medium">R$ {varItem.materialsCost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Custo Fabricação:</span>
                    <span className="text-rose-400 font-medium">R$ {varItem.totalCost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Lucro Líquido:</span>
                    <span className="text-emerald-400 font-bold">+ R$ {varItem.estimatedProfit.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <Button
                size="sm"
                onClick={() => onSelectVariation(varItem.materials, varItem.colorCount)}
                className="w-full bg-slate-800 hover:bg-slate-700 text-white text-xs rounded-xl"
              >
                Usar esta Variação
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};