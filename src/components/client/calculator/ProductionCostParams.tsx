"use client";

import React from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Zap } from 'lucide-react';

interface ProductionCostParamsProps {
  tarifaKwh: number;
  setTarifaKwh: (val: number) => void;
  depreciacaoHora: number;
  setDepreciacaoHora: (val: number) => void;
  taxaFalhaPorcento: number;
  setTaxaFalhaPorcento: (val: number) => void;
  custoMaoDeObra: number | string;
  setCustoMaoDeObra: (val: number | string) => void;
  margemLucroPorcento: number;
  setMargemLucroPorcento: (val: number) => void;
  marginRealPercent: number;
}

export const ProductionCostParams: React.FC<ProductionCostParamsProps> = ({
  tarifaKwh,
  setTarifaKwh,
  depreciacaoHora,
  setDepreciacaoHora,
  taxaFalhaPorcento,
  setTaxaFalhaPorcento,
  custoMaoDeObra,
  setCustoMaoDeObra,
  margemLucroPorcento,
  setMargemLucroPorcento,
  marginRealPercent,
}) => {
  return (
    <Card className="bg-slate-900 border-slate-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <Zap className="w-4 h-4 text-amber-400" />
        <h3 className="font-bold text-white text-sm">Parâmetros de Produção & Margem</h3>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="text-[11px] text-slate-400 block mb-1">Energia (R$/kWh)</label>
          <Input
            type="number"
            step="0.05"
            value={tarifaKwh}
            onChange={e => setTarifaKwh(Number(e.target.value))}
            className="bg-slate-950 border-slate-750 text-white text-xs rounded-xl h-9"
          />
        </div>

        <div>
          <label className="text-[11px] text-slate-400 block mb-1">Desgaste Bico (R$/h)</label>
          <Input
            type="number"
            step="0.1"
            value={depreciacaoHora}
            onChange={e => setDepreciacaoHora(Number(e.target.value))}
            className="bg-slate-950 border-slate-750 text-white text-xs rounded-xl h-9"
          />
        </div>

        <div>
          <label className="text-[11px] text-slate-400 block mb-1">Taxa de Falha (%)</label>
          <Input
            type="number"
            value={taxaFalhaPorcento}
            onChange={e => setTaxaFalhaPorcento(Number(e.target.value))}
            className="bg-slate-950 border-slate-750 text-white text-xs rounded-xl h-9 text-rose-300"
          />
        </div>

        <div>
          <label className="text-[11px] text-slate-400 block mb-1">Mão de Obra (R$)</label>
          <Input
            type="number"
            value={custoMaoDeObra}
            onChange={e => setCustoMaoDeObra(e.target.value === '' ? '' : Number(e.target.value))}
            className="bg-slate-950 border-slate-750 text-white text-xs rounded-xl h-9"
          />
        </div>
      </div>

      <div>
        <label className="text-[11px] text-slate-400 block mb-1">
          Margem de Lucro Desejada sobre o Custo (%)
        </label>
        <div className="flex items-center gap-3">
          <Input
            type="number"
            value={margemLucroPorcento}
            onChange={e => setMargemLucroPorcento(Number(e.target.value))}
            className="bg-slate-950 border-slate-750 text-white text-xs rounded-xl h-9 font-bold text-emerald-400 w-32"
          />
          <span className="text-xs text-slate-400">
            Equivale a uma margem líquida real de{' '}
            <strong className="text-emerald-400">{marginRealPercent}%</strong>
          </span>
        </div>
      </div>
    </Card>
  );
};