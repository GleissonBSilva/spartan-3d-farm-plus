"use client";

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CreditCard,
  QrCode,
  Banknote,
  Settings2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import {
  PaymentMethodsService,
  PaymentMethodType,
  FarmPaymentSettings,
  PaymentCalculationResult,
} from '@/services/paymentMethodsService';
import { ManagePaymentMethodsModal } from './ManagePaymentMethodsModal';

interface PaymentMethodSelectorProps {
  selectedMethod: PaymentMethodType;
  selectedInstallments: number;
  paymentResult?: PaymentCalculationResult;
  basePrice?: number;
  paymentSettings: FarmPaymentSettings;
  onSelectMethod?: (method: PaymentMethodType) => void;
  onChangeMethod?: (method: PaymentMethodType) => void;
  onSelectInstallments?: (installments: number) => void;
  onChangeInstallments?: (installments: number) => void;
  onUpdateSettings?: (settings: FarmPaymentSettings) => void;
  onRefreshSettings?: () => void;
}

export const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({
  selectedMethod,
  onChangeMethod,
  onSelectMethod,
  selectedInstallments,
  onChangeInstallments,
  onSelectInstallments,
  paymentResult,
  basePrice = 0,
  paymentSettings,
  onRefreshSettings,
  onUpdateSettings,
}) => {
  const [modalOpen, setModalOpen] = useState(false);

  const handleSelectMethod = onSelectMethod || onChangeMethod || (() => {});
  const handleSelectInstallments = onSelectInstallments || onChangeInstallments || (() => {});

  // Garante que o resultado do cálculo nunca seja nulo ou indefinido
  const safePaymentResult: PaymentCalculationResult =
    paymentResult ||
    PaymentMethodsService.calculatePaymentEffect(
      basePrice,
      selectedMethod,
      selectedInstallments,
      paymentSettings
    );

  const methodsList: {
    type: PaymentMethodType;
    label: string;
    icon: typeof QrCode;
    badgeText?: string;
    badgeTone?: 'emerald' | 'indigo' | 'cyan' | 'amber';
    enabled: boolean;
  }[] = [
    {
      type: 'pix',
      label: 'Pix Instantâneo',
      icon: QrCode,
      badgeText: paymentSettings.methods?.pix?.discountPercent
        ? `-${paymentSettings.methods.pix.discountPercent}% OFF`
        : 'À vista',
      badgeTone: 'emerald',
      enabled: paymentSettings.methods?.pix?.enabled ?? true,
    },
    {
      type: 'credito',
      label: 'Cartão de Crédito',
      icon: CreditCard,
      badgeText: `Até ${paymentSettings.methods?.credito?.maxInstallments || 12}x`,
      badgeTone: 'indigo',
      enabled: paymentSettings.methods?.credito?.enabled ?? true,
    },
    {
      type: 'debito',
      label: 'Cartão de Débito',
      icon: CreditCard,
      badgeText: paymentSettings.methods?.debito?.feePercent
        ? `Taxa ${paymentSettings.methods.debito.feePercent}%`
        : 'À vista',
      badgeTone: 'cyan',
      enabled: paymentSettings.methods?.debito?.enabled ?? true,
    },
    {
      type: 'dinheiro',
      label: 'Dinheiro em Espécie',
      icon: Banknote,
      badgeText: paymentSettings.methods?.dinheiro?.discountPercent
        ? `-${paymentSettings.methods.dinheiro.discountPercent}% OFF`
        : 'À vista',
      badgeTone: 'amber',
      enabled: paymentSettings.methods?.dinheiro?.enabled ?? true,
    },
  ];

  const maxInstallments = paymentSettings.methods?.credito?.maxInstallments || 12;
  const installmentOptions = Array.from({ length: maxInstallments }, (_, i) => i + 1);

  return (
    <Card className="bg-[hsla(222,47%,11%,0.95)] border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-emerald-400" />
          <div>
            <h3 className="font-bold text-white text-sm">
              Forma de Pagamento & Condições Comerciais
            </h3>
            <p className="text-[11px] text-slate-400">
              Personalize como o cliente efetuará o pagamento deste orçamento
            </p>
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setModalOpen(true)}
          className="bg-slate-950 border-slate-700 hover:border-indigo-500 text-indigo-300 hover:text-white text-xs rounded-xl h-8 self-start sm:self-auto"
        >
          <Settings2 className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
          Gerenciar Formas & Taxas
        </Button>
      </div>

      {/* Grid com as 4 opções de pagamento */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {methodsList.map(item => {
          const isSelected = selectedMethod === item.type;
          const Icon = item.icon;

          return (
            <button
              key={item.type}
              type="button"
              disabled={!item.enabled}
              onClick={() => handleSelectMethod(item.type)}
              className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between min-h-[82px] ${
                !item.enabled
                  ? 'opacity-40 cursor-not-allowed border-slate-800 bg-slate-950'
                  : isSelected
                  ? 'border-indigo-500 bg-indigo-950/40 ring-1 ring-indigo-500 shadow-md shadow-indigo-600/20'
                  : 'border-slate-800 bg-slate-950/70 hover:border-slate-700 hover:bg-slate-900'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <div
                  className={`p-1.5 rounded-lg ${
                    isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </div>
                {item.badgeText && (
                  <Badge
                    className={`text-[9px] px-1.5 py-0 font-bold border ${
                      item.badgeTone === 'emerald'
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                        : item.badgeTone === 'amber'
                        ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                        : item.badgeTone === 'cyan'
                        ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30'
                        : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                    }`}
                  >
                    {item.badgeText}
                  </Badge>
                )}
              </div>

              <div>
                <span className="font-bold text-xs text-white block truncate">
                  {item.label}
                </span>
                <span className="text-[10px] text-slate-400 block">
                  {item.type === 'pix'
                    ? 'Instantâneo'
                    : item.type === 'credito'
                    ? 'Parcelável'
                    : item.type === 'debito'
                    ? 'Débito à vista'
                    : 'Em espécie'}
                </span>
              </div>

              {isSelected && (
                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
              )}
            </button>
          );
        })}
      </div>

      {/* Opções específicas do método selecionado */}
      <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
        {selectedMethod === 'credito' && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Número de Parcelas no Cartão de Crédito
              </label>
              <p className="text-[11px] text-slate-400">
                Selecione o parcelamento oferecido ao cliente para esta simulação
              </p>
            </div>

            <select
              value={selectedInstallments}
              onChange={e => handleSelectInstallments(Number(e.target.value))}
              className="bg-slate-900 border border-slate-750 text-white text-xs font-bold rounded-xl h-9 px-3 focus:outline-none focus:border-indigo-500 sm:w-56"
            >
              {installmentOptions.map(n => {
                const singleVal =
                  safePaymentResult.finalPrice > 0
                    ? (safePaymentResult.finalPrice / n).toFixed(2)
                    : '0.00';
                return (
                  <option key={n} value={n}>
                    {n}x de R$ {singleVal} {n === 1 ? '(À vista)' : ''}
                  </option>
                );
              })}
            </select>
          </div>
        )}

        {selectedMethod === 'pix' && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-slate-300">
              <QrCode className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Chave Pix da Farm:{' '}
                <strong className="text-white font-mono">
                  {paymentSettings.pixKey || 'Não configurada'}
                </strong>
                {paymentSettings.pixBeneficiary && (
                  <span className="text-slate-400"> ({paymentSettings.pixBeneficiary})</span>
                )}
              </span>
            </div>

            {safePaymentResult.adjustmentAmount < 0 && (
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[11px] self-start sm:self-auto">
                <Sparkles className="w-3 h-3 mr-1" />
                Desconto de R$ {Math.abs(safePaymentResult.adjustmentAmount).toFixed(2)} aplicado
              </Badge>
            )}
          </div>
        )}

        {/* Resumo da Política de Sinal / Entrada */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
            <span>
              Sinal de Entrada ({safePaymentResult.downPaymentPercent}%):{' '}
              <strong className="text-white">
                R$ {safePaymentResult.downPaymentAmount.toFixed(2)}
              </strong>
            </span>
          </div>

          <span className="text-[11px] text-slate-400">
            Restante na entrega:{' '}
            <strong className="text-slate-200">
              R$ {safePaymentResult.balanceAmount.toFixed(2)}
            </strong>
          </span>
        </div>
      </div>

      {/* Modal de Gerenciamento */}
      <ManagePaymentMethodsModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSettingsSaved={newSettings => {
          if (onUpdateSettings) onUpdateSettings(newSettings);
          if (onRefreshSettings) onRefreshSettings();
        }}
      />
    </Card>
  );
};
