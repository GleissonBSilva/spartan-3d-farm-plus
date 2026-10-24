"use client";

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, Layers, Zap, Save, CheckCircle2, Truck, AlertCircle, Sparkles } from 'lucide-react';
import { PricingCalculationResult } from '@/services/pricingService';
import { PaymentCalculationResult } from '@/services/paymentMethodsService';

interface PricingSummaryCardProps {
  nomePeca: string;
  calculationResult: PricingCalculationResult & { valorFrete?: number };
  taxaFalhaPorcento: number;
  hasSimulationData?: boolean;
  paymentResult?: PaymentCalculationResult;
  onSalvarOrcamento: () => void;
  onAprovarProducao: () => void;
  saving?: boolean;
  recalculating?: boolean;
  copying?: boolean;
}

export const PricingSummaryCard: React.FC<PricingSummaryCardProps> = ({
  nomePeca,
  calculationResult,
  taxaFalhaPorcento,
  hasSimulationData = true,
  paymentResult,
  onSalvarOrcamento,
  onAprovarProducao,
  saving = false,
  recalculating = false,
  copying = false,
}) => {
  const displayPrice = hasSimulationData
    ? paymentResult
      ? paymentResult.finalPrice
      : calculationResult.suggestedPrice
    : 0;

  return (
    <Card className="bg-slate-900 border-slate-800 rounded-2xl p-5 space-y-4">
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <DollarSign className="w-5 h-5 text-emerald-400" />
        <div>
          <h3 className="font-bold text-white text-sm">Resumo Financeiro Consolidado</h3>
          <p className="text-[10px] text-slate-400">{nomePeca || 'Nova Peça / Simulação'}</p>
        </div>
      </div>

      {!hasSimulationData && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-200 space-y-1.5">
          <div className="flex items-center gap-2 font-bold text-amber-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>Aguardando dados de simulação</span>
          </div>
          <p className="text-[11px] text-amber-200/80 leading-relaxed">
            Preencha o <strong>tempo de fatiamento</strong> e o <strong>peso em gramas</strong> da peça para calcular os custos reais de fabricação e o preço final de venda.
          </p>
        </div>
      )}

      {/* Detalhamento Item a Item */}
      <div className="space-y-2.5 text-xs">
        <div className="flex justify-between text-slate-300">
          <span className="flex items-center gap-1 text-slate-400">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            Materiais ({calculationResult.totalWeightGrams}g + {taxaFalhaPorcento}% falha):
          </span>
          <span className="font-bold text-white">
            R$ {(hasSimulationData ? calculationResult.materialsWithFailureCost : 0).toFixed(2)}
          </span>
        </div>

        <div className="flex justify-between text-slate-300">
          <span className="flex items-center gap-1 text-slate-400">
            <Zap className="w-3.5 h-3.5 text-amber-400" />
            Energia ({calculationResult.kwhTotal} kWh):
          </span>
          <span className="font-bold text-white">
            R$ {(hasSimulationData ? calculationResult.energyCost : 0).toFixed(2)}
          </span>
        </div>

        <div className="flex justify-between text-slate-300">
          <span className="text-slate-400">Depreciação Máquina & Bico:</span>
          <span className="font-bold text-white">
            R$ {(hasSimulationData ? calculationResult.depreciationCost : 0).toFixed(2)}
          </span>
        </div>

        <div className="flex justify-between text-slate-300">
          <span className="text-slate-400">Mão de Obra / Pós-processamento:</span>
          <span className="font-bold text-white">
            R$ {(hasSimulationData ? calculationResult.laborCost : 0).toFixed(2)}
          </span>
        </div>

        {/* Linha de Frete separada abaixo de Mão de Obra */}
        <div className="flex justify-between text-slate-300 pt-1 border-t border-slate-800/50">
          <span className="flex items-center gap-1 text-slate-400">
            <Truck className="w-3.5 h-3.5 text-cyan-400" />
            Frete:
          </span>
          <span className="font-bold text-white">
            R$ {(calculationResult.valorFrete || 0).toFixed(2)}
          </span>
        </div>

        {/* Impacto da Forma de Pagamento (se houver desconto ou taxa) */}
        {hasSimulationData && paymentResult && paymentResult.adjustmentAmount !== 0 && (
          <div className="flex justify-between text-slate-300 pt-1 border-t border-slate-800/50">
            <span className={`flex items-center gap-1 ${paymentResult.adjustmentType === 'discount' ? 'text-emerald-400' : 'text-amber-400'}`}>
              <Sparkles className="w-3.5 h-3.5" />
              {paymentResult.adjustmentType === 'discount' ? 'Desconto' : 'Taxa'} ({paymentResult.methodName} {paymentResult.adjustmentPercent}%):
            </span>
            <span className={`font-bold ${paymentResult.adjustmentType === 'discount' ? 'text-emerald-400' : 'text-amber-400'}`}>
              {paymentResult.adjustmentType === 'discount' ? '- ' : '+ '}R$ {Math.abs(paymentResult.adjustmentAmount).toFixed(2)}
            </span>
          </div>
        )}
      </div>

      {/* Total e Preço */}
      <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-400">Custo Total de Fabricação:</span>
          <span className={`font-bold text-sm ${hasSimulationData ? 'text-rose-400' : 'text-slate-500'}`}>
            R$ {(hasSimulationData ? calculationResult.totalProductionCost : 0).toFixed(2)}
          </span>
        </div>

        <div className="flex justify-between items-center text-xs">
          <span className="text-slate-400">Lucro Líquido Estimado:</span>
          <span className={`font-bold text-sm ${hasSimulationData ? 'text-emerald-400' : 'text-slate-500'}`}>
            + R$ {(hasSimulationData ? calculationResult.estimatedProfit : 0).toFixed(2)}
          </span>
        </div>

        <div className="pt-2 border-t border-slate-800 flex justify-between items-baseline">
          <span className="text-xs font-bold text-white uppercase">Preço Final:</span>
          <div className="text-right">
            <span className={`text-2xl font-black ${hasSimulationData ? 'text-indigo-400' : 'text-slate-500'}`}>
              R$ {displayPrice.toFixed(2)}
            </span>
            {hasSimulationData && paymentResult && paymentResult.method === 'credito' && paymentResult.installments > 1 && (
              <span className="block text-[11px] text-indigo-300 font-bold">
                {paymentResult.installments}x de R$ {paymentResult.installmentValue.toFixed(2)}
              </span>
            )}
            {hasSimulationData && paymentResult && (
              <span className="block text-[10px] text-slate-400">
                {paymentResult.methodName}
              </span>
            )}
            {!hasSimulationData && (
              <span className="block text-[10px] text-amber-400/80 font-medium">
                (Aguardando tempo e peso)
              </span>
            )}
          </div>
        </div>

        {hasSimulationData && paymentResult && paymentResult.downPaymentAmount > 0 && (
          <div className="flex justify-between items-center text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
            <span>Sinal de Entrada ({paymentResult.downPaymentPercent}%):</span>
            <strong className="text-purple-300 font-bold">
              R$ {paymentResult.downPaymentAmount.toFixed(2)}
            </strong>
          </div>
        )}
      </div>

      {/* Botões de Ação com Fluxo do Estoque */}
      <div className="space-y-2 pt-2">
        <Button
          disabled={saving}
          onClick={onSalvarOrcamento}
          className="w-full bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl h-10"
        >
          <Save className="w-3.5 h-3.5 mr-1 text-amber-400" />
          {recalculating ? 'Atualizar valores do projeto' : copying ? 'Salvar novo orçamento' : 'Salvar como Orçamento (Sem Baixar Estoque)'}
        </Button>

        {!recalculating && !copying && <Button
          disabled={saving}
          onClick={onAprovarProducao}
          className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold rounded-xl h-10 shadow-lg shadow-emerald-600/25"
        >
          <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-white" />
          Aprovar & Iniciar Produção (Baixar Estoque)
        </Button>}

        <p className="text-[10px] text-center text-slate-400 pt-1 leading-relaxed">
          💡 <strong className="text-slate-300">Orçamentos Livres:</strong> Você pode gerar múltiplos orçamentos mesmo sem impressora disponível. A máquina só será exigida na aprovação e início da impressão.
        </p>
      </div>
    </Card>
  );
};