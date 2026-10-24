"use client";

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  CreditCard,
  QrCode,
  Banknote,
  Percent,
  Settings2,
  X,
  CheckCircle2,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import {
  PaymentMethodsService,
  FarmPaymentSettings,
  DEFAULT_PAYMENT_SETTINGS,
} from '@/services/paymentMethodsService';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

interface ManagePaymentMethodsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsSaved?: (newSettings: FarmPaymentSettings) => void;
}

export const ManagePaymentMethodsModal: React.FC<ManagePaymentMethodsModalProps> = ({
  isOpen,
  onClose,
  onSettingsSaved,
}) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<FarmPaymentSettings>(() =>
    PaymentMethodsService.getSettings(user?.id ?? null)
  );
  const [activeTab, setActiveTab] = useState<'pix' | 'credito' | 'debito' | 'dinheiro' | 'sinal'>('pix');

  useEffect(() => {
    let cancelled = false;
    if (isOpen) {
      setSettings(PaymentMethodsService.getSettings(user?.id ?? null));
      if (user?.id) {
        void PaymentMethodsService.syncFromSupabase(user.id).then(synced => {
          if (!cancelled) {
            setSettings(synced);
          }
        });
      }
    }
    return () => {
      cancelled = true;
    };
  }, [isOpen, user?.id]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!user?.id) {
      toast.error('Usuário não autenticado.');
      return;
    }
    const ok = PaymentMethodsService.saveSettings(settings, user.id);
    if (ok) {
      toast.success('Regras e formas de pagamento salvas com sucesso!');
      if (onSettingsSaved) onSettingsSaved(settings);
      onClose();
    } else {
      toast.error('Erro ao salvar configurações de pagamento.');
    }
  };

  const handleReset = () => {
    if (!user?.id) return;
    const cleanDefaults = {
      ...DEFAULT_PAYMENT_SETTINGS,
      pixKey: '',
      pixBeneficiary: '',
      methods: {
        pix: { ...DEFAULT_PAYMENT_SETTINGS.methods.pix },
        credito: { ...DEFAULT_PAYMENT_SETTINGS.methods.credito },
        debito: { ...DEFAULT_PAYMENT_SETTINGS.methods.debito },
        dinheiro: { ...DEFAULT_PAYMENT_SETTINGS.methods.dinheiro },
      },
    };
    setSettings(cleanDefaults);
    PaymentMethodsService.saveSettings(cleanDefaults, user.id);
    if (onSettingsSaved) onSettingsSaved(cleanDefaults);
    toast.info('Configurações de pagamento restauradas para o padrão.');
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <Card className="bg-slate-900 border-slate-800 text-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Top Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-800 bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Settings2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base sm:text-lg text-white">
                Gerenciar Formas de Pagamento & Taxas
              </h3>
              <p className="text-xs text-slate-400">
                Configure descontos, taxas, parcelamento no cartão e chave Pix para os orçamentos
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 p-2 gap-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('pix')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'pix'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <QrCode className="w-3.5 h-3.5" /> Pix
            {settings.methods.pix.discountPercent ? (
              <Badge className="bg-emerald-500/20 text-emerald-300 text-[10px] ml-1 px-1.5 py-0">
                -{settings.methods.pix.discountPercent}%
              </Badge>
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('credito')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'credito'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" /> Cartão de Crédito
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('debito')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'debito'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <CreditCard className="w-3.5 h-3.5" /> Débito
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('dinheiro')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'dinheiro'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Banknote className="w-3.5 h-3.5" /> Dinheiro
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sinal')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
              activeTab === 'sinal'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" /> Sinal & Entrada
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* TAB: PIX */}
          {activeTab === 'pix' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <h4 className="font-bold text-sm text-white flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-emerald-400" /> Habilitar Pix nos orçamentos
                  </h4>
                  <p className="text-xs text-slate-400">Permite ao cliente pagar instantaneamente via Pix</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.methods.pix.enabled}
                  onChange={e =>
                    setSettings(prev => ({
                      ...prev,
                      methods: {
                        ...prev.methods,
                        pix: { ...prev.methods.pix, enabled: e.target.checked },
                      },
                    }))
                  }
                  className="w-5 h-5 accent-emerald-500 rounded cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Desconto para Pagamento em Pix (%)
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={settings.methods.pix.discountPercent ?? 0}
                      onChange={e => {
                        const val = Math.max(0, Number(e.target.value) || 0);
                        setSettings(prev => ({
                          ...prev,
                          methods: {
                            ...prev.methods,
                            pix: { ...prev.methods.pix, discountPercent: val },
                          },
                        }));
                      }}
                      className="bg-slate-950 border-slate-750 text-white text-xs rounded-xl h-10 pr-8"
                    />
                    <Percent className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3.5" />
                  </div>
                  <span className="text-[11px] text-slate-500">Ex: 5% de incentivo para Pix à vista</span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Tipo de Chave Pix
                  </label>
                  <select
                    value={settings.pixKeyType}
                    onChange={e =>
                      setSettings(prev => ({
                        ...prev,
                        pixKeyType: e.target.value as any,
                      }))
                    }
                    className="w-full bg-slate-950 border border-slate-750 text-white text-xs rounded-xl h-10 px-3 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="telefone">Telefone / Celular</option>
                    <option value="cnpj">CNPJ</option>
                    <option value="cpf">CPF</option>
                    <option value="email">E-mail</option>
                    <option value="aleatoria">Chave Aleatória (EVP)</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Chave Pix da Farm (Exibida no PDF e WhatsApp da Proposta)
                  </label>
                  <Input
                    type="text"
                    value={settings.pixKey}
                    onChange={e =>
                      setSettings(prev => ({ ...prev, pixKey: e.target.value }))
                    }
                    placeholder="Ex: 92991463640 ou pix@minhafarm.com.br"
                    className="bg-slate-950 border-slate-750 text-white text-xs rounded-xl h-10 font-mono"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Nome do Titular / Beneficiário da Chave
                  </label>
                  <Input
                    type="text"
                    value={settings.pixBeneficiary}
                    onChange={e =>
                      setSettings(prev => ({ ...prev, pixBeneficiary: e.target.value }))
                    }
                    placeholder="Ex: Spartan 3D Print LTDA"
                    className="bg-slate-950 border-slate-750 text-white text-xs rounded-xl h-10"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB: CRÉDITO */}
          {activeTab === 'credito' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <h4 className="font-bold text-sm text-white flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-indigo-400" /> Habilitar Cartão de Crédito
                  </h4>
                  <p className="text-xs text-slate-400">Permite orçar em 1x à vista ou parcelado</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.methods.credito.enabled}
                  onChange={e =>
                    setSettings(prev => ({
                      ...prev,
                      methods: {
                        ...prev.methods,
                        credito: { ...prev.methods.credito, enabled: e.target.checked },
                      },
                    }))
                  }
                  className="w-5 h-5 accent-indigo-500 rounded cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Taxa Adicional da Maquininha / Operadora (%)
                  </label>
                  <div className="relative">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      value={settings.methods.credito.feePercent ?? 0}
                      onChange={e => {
                        const val = Math.max(0, Number(e.target.value) || 0);
                        setSettings(prev => ({
                          ...prev,
                          methods: {
                            ...prev.methods,
                            credito: { ...prev.methods.credito, feePercent: val },
                          },
                        }));
                      }}
                      className="bg-slate-950 border-slate-750 text-white text-xs rounded-xl h-10 pr-8"
                    />
                    <Percent className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3.5" />
                  </div>
                  <span className="text-[11px] text-slate-500">Deixe 0 se você absorver o custo da maquininha</span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Máximo de Parcelas Permitidas
                  </label>
                  <select
                    value={settings.methods.credito.maxInstallments ?? 12}
                    onChange={e => {
                      const val = Number(e.target.value);
                      setSettings(prev => ({
                        ...prev,
                        methods: {
                          ...prev.methods,
                          credito: { ...prev.methods.credito, maxInstallments: val },
                        },
                      }));
                    }}
                    className="w-full bg-slate-950 border border-slate-750 text-white text-xs rounded-xl h-10 px-3 focus:outline-none focus:border-indigo-500"
                  >
                    {[1, 2, 3, 4, 5, 6, 8, 10, 12].map(n => (
                      <option key={n} value={n}>
                        Até {n}x ({n === 1 ? 'Apenas à vista' : `${n} parcelas`})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB: DÉBITO */}
          {activeTab === 'debito' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <h4 className="font-bold text-sm text-white flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-cyan-400" /> Habilitar Cartão de Débito
                  </h4>
                  <p className="text-xs text-slate-400">Pagamento à vista com cartão no balcão ou entrega</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.methods.debito.enabled}
                  onChange={e =>
                    setSettings(prev => ({
                      ...prev,
                      methods: {
                        ...prev.methods,
                        debito: { ...prev.methods.debito, enabled: e.target.checked },
                      },
                    }))
                  }
                  className="w-5 h-5 accent-cyan-500 rounded cursor-pointer"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Taxa da Maquininha no Débito (%)
                </label>
                <div className="relative max-w-xs">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.1}
                    value={settings.methods.debito.feePercent ?? 0}
                    onChange={e => {
                      const val = Math.max(0, Number(e.target.value) || 0);
                      setSettings(prev => ({
                        ...prev,
                        methods: {
                          ...prev.methods,
                          debito: { ...prev.methods.debito, feePercent: val },
                        },
                      }));
                    }}
                    className="bg-slate-950 border-slate-750 text-white text-xs rounded-xl h-10 pr-8"
                  />
                  <Percent className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3.5" />
                </div>
                <span className="text-[11px] text-slate-500">Normalmente entre 1.5% e 2.0%</span>
              </div>
            </div>
          )}

          {/* TAB: DINHEIRO */}
          {activeTab === 'dinheiro' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <h4 className="font-bold text-sm text-white flex items-center gap-2">
                    <Banknote className="w-4 h-4 text-amber-400" /> Habilitar Dinheiro em Espécie
                  </h4>
                  <p className="text-xs text-slate-400">Recebimento presencial na entrega ou balcão</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.methods.dinheiro.enabled}
                  onChange={e =>
                    setSettings(prev => ({
                      ...prev,
                      methods: {
                        ...prev.methods,
                        dinheiro: { ...prev.methods.dinheiro, enabled: e.target.checked },
                      },
                    }))
                  }
                  className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Desconto para Pagamento em Dinheiro (%)
                </label>
                <div className="relative max-w-xs">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={settings.methods.dinheiro.discountPercent ?? 0}
                    onChange={e => {
                      const val = Math.max(0, Number(e.target.value) || 0);
                      setSettings(prev => ({
                        ...prev,
                        methods: {
                          ...prev.methods,
                          dinheiro: { ...prev.methods.dinheiro, discountPercent: val },
                        },
                      }));
                    }}
                    className="bg-slate-950 border-slate-750 text-white text-xs rounded-xl h-10 pr-8"
                  />
                  <Percent className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3.5" />
                </div>
                <span className="text-[11px] text-slate-500">Ex: 5% para incentivar pagamento à vista</span>
              </div>
            </div>
          )}

          {/* TAB: SINAL & ENTRADA */}
          {activeTab === 'sinal' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-200 space-y-1">
                <h4 className="font-bold text-purple-300 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" /> Política de Adiantamento da Farm
                </h4>
                <p className="text-[11px] text-purple-200/80 leading-relaxed">
                  Garante a segurança da farm para cobrir custos de filamento, energia e preparação antes de ligar as impressoras.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Percentual de Sinal Exigido para Início da Impressão (%)
                </label>
                <div className="relative max-w-xs">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={settings.downPaymentPercent ?? 50}
                    onChange={e => {
                      const val = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                      setSettings(prev => ({ ...prev, downPaymentPercent: val }));
                    }}
                    className="bg-slate-950 border-slate-750 text-white text-xs rounded-xl h-10 pr-8 font-bold text-indigo-400"
                  />
                  <Percent className="w-3.5 h-3.5 text-slate-400 absolute right-3 top-3.5" />
                </div>
                <span className="text-[11px] text-slate-500">Padrão do mercado: 50% de sinal e 50% na entrega.</span>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex flex-col sm:flex-row justify-between items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="text-xs text-slate-400 hover:text-white"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Restaurar Padrões
          </Button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="w-full sm:w-auto bg-slate-900 border-slate-750 text-slate-300 text-xs rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-indigo-600/30"
            >
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Salvar Configurações
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
