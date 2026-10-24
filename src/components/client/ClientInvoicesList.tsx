"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle, QrCode, CircleAlert, Copy, Check } from 'lucide-react';
import { Invoice, Plan } from '@/types/saas';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import {
  PixConfig,
  getSavedPixConfig,
  getPlatformPixConfig,
  generatePixPayload,
  getPixQrCodeUrl,
} from '@/services/pixService';

interface ClientInvoicesListProps {
  invoices: Invoice[];
  currentPlan: Plan;
  onOpenPixModal?: (invoiceId: string) => void;
}

export const ClientInvoicesList: React.FC<ClientInvoicesListProps> = ({
  invoices,
  currentPlan,
  onOpenPixModal,
}) => {
  const { user } = useAuth();
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [activePixModal, setActivePixModal] = useState<{
    invoice: Invoice;
    pixPayload: string;
  } | null>(null);

  // Recupera a configuração Pix salva da plataforma / administrador
  const [pixConfig, setPixConfig] = useState<PixConfig>(() => getSavedPixConfig(user?.id));

  useEffect(() => {
    // 1. Carrega a chave oficial da plataforma registrada pelo Administrador
    void getPlatformPixConfig().then(cfg => {
      if (cfg && cfg.chave) {
        setPixConfig(cfg);
      }
    });

    const handleUpdate = () => {
      void getPlatformPixConfig().then(cfg => {
        if (cfg && cfg.chave) setPixConfig(cfg);
      });
    };

    window.addEventListener('spartan_pix_config_updated', handleUpdate);
    return () => window.removeEventListener('spartan_pix_config_updated', handleUpdate);
  }, []);

  const handleViewPix = (inv: Invoice) => {
    const payload = generatePixPayload({
      chave: pixConfig.chave,
      nomeTitular: pixConfig.nomeTitular || 'SPARTAN 3D',
      cidade: pixConfig.cidade || 'MANAUS',
      valor: inv.amount,
      txId: inv.id.replace(/-/g, '').slice(0, 20),
      descricao: `Fatura ${inv.id.slice(0, 8)}`,
    });

    setActivePixModal({
      invoice: inv,
      pixPayload: payload,
    });
  };

  const handleCopyPayload = (payload: string) => {
    navigator.clipboard.writeText(payload);
    setCopiedPayload(true);
    toast.success('Código Pix Copia e Cola copiado!');
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  return (
    <>
      <Card className="bg-slate-900 border border-slate-800 rounded-2xl shadow-lg">
        <CardHeader>
          <CardTitle className="text-base text-white font-bold">Minhas Faturas Recentes</CardTitle>
          <CardDescription className="text-xs text-slate-400">
            Visualize comprovantes, boletos e faça pagamentos via Pix
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-y border-slate-800">
                <tr>
                  <th className="py-3 px-4">Fatura</th>
                  <th className="py-3 px-4">Descrição</th>
                  <th className="py-3 px-4">Valor</th>
                  <th className="py-3 px-4">Vencimento</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Ver Pix</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-400">
                      Você ainda não tem faturas.
                    </td>
                  </tr>
                )}
                {invoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-800/30">
                    <td className="py-3.5 px-4 font-mono font-bold text-indigo-400">{inv.id}</td>
                    <td className="py-3.5 px-4 text-white">Assinatura Spartan 3D {currentPlan.name}</td>
                    <td className="py-3.5 px-4 font-bold text-white">R$ {inv.amount},00</td>
                    <td className="py-3.5 px-4 text-slate-400">{inv.dueDate}</td>
                    <td className="py-3.5 px-4">
                      {inv.status === 'paid' ? (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1 text-[11px]">
                          <CheckCircle className="w-3 h-3" /> Liquidada
                        </span>
                      ) : inv.status === 'failed' ? (
                        <span className="text-rose-400 font-semibold flex items-center gap-1 text-[11px]">
                          <CircleAlert className="w-3 h-3" /> Falhou
                        </span>
                      ) : (
                        <span className="text-amber-400 font-semibold flex items-center gap-1 text-[11px]">
                          <QrCode className="w-3 h-3" /> Aguardando Pix
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      {/* Botão Ver Pix idêntico ao Admin */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleViewPix(inv)}
                        className="h-7 px-2.5 text-[11px] bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white rounded-lg font-medium inline-flex items-center gap-1"
                        title="Visualizar QR Code Pix e Copia e Cola"
                      >
                        <QrCode className="w-3 h-3 mr-1 text-emerald-400" />
                        Ver Pix
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal Visualização Pix (QR Code / Copia e Cola) idêntico ao Admin */}
      {activePixModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={e => {
            if (e.target === e.currentTarget) setActivePixModal(null);
          }}
        >
          <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4">
            {/* Cabeçalho do Modal */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Cobrança Pix Instantânea</h3>
                  <p className="text-[11px] text-slate-400">Fatura: {activePixModal.invoice.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActivePixModal(null)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {/* Informações da Cobrança */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex items-center justify-between text-xs">
              <div>
                <span className="text-slate-400 block text-[11px]">Assinante:</span>
                <span className="font-bold text-white">
                  {user?.name || user?.companyName || 'Assinante Spartan 3D'}
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block text-[11px]">Valor:</span>
                <span className="font-extrabold text-emerald-400 text-sm">
                  R$ {activePixModal.invoice.amount.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Chave Pix do Beneficiário */}
            <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-2.5 px-3 flex items-center justify-between text-[11px]">
              <div className="min-w-0">
                <span className="text-slate-400 block text-[10px]">Chave Pix do Beneficiário:</span>
                <span className="font-mono text-cyan-300 font-semibold truncate block">
                  {pixConfig.chave || 'Chave não cadastrada'}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-medium shrink-0 ml-2">
                {pixConfig.nomeTitular || 'SPARTAN 3D'}
              </span>
            </div>

            {/* QR Code */}
            <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl shadow-inner">
              <img
                src={getPixQrCodeUrl(activePixModal.pixPayload, 220)}
                alt="QR Code Pix"
                className="w-48 h-48 object-contain"
              />
              <span className="text-[11px] font-bold text-slate-800 mt-2">
                Escaneie com o app de qualquer banco
              </span>
            </div>

            {/* Pix Copia e Cola */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-300 block">
                Pix Copia e Cola:
              </label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={activePixModal.pixPayload}
                  className="bg-slate-950 border-slate-700 text-white font-mono text-[10px] h-9 rounded-xl truncate"
                />
                <Button
                  size="sm"
                  onClick={() => handleCopyPayload(activePixModal.pixPayload)}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-9 px-3 rounded-xl shrink-0"
                >
                  {copiedPayload ? (
                    <Check className="w-3.5 h-3.5 mr-1 text-emerald-300" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 mr-1" />
                  )}
                  {copiedPayload ? 'Copiado!' : 'Copiar'}
                </Button>
              </div>
            </div>

            {/* Ação rápida */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <Button
                size="sm"
                onClick={() => handleCopyPayload(activePixModal.pixPayload)}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl h-9 text-xs"
              >
                <Copy className="w-3.5 h-3.5 mr-1.5" />
                Copiar Código Pix
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
