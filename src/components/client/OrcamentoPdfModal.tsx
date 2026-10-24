"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Printer, Send, Image as ImageIcon } from 'lucide-react';
import { ProjetoImpressao3D } from '@/types/saas';
import { useAuth } from '@/context/AuthContext';
import { PaymentMethodsService } from '@/services/paymentMethodsService';
import { toast } from 'sonner';

interface OrcamentoPdfModalProps {
  isOpen: boolean;
  onClose: () => void;
  projeto: Partial<ProjetoImpressao3D> & {
    fotoUrl?: string;
    imagemUrl?: string;
    imageUrl?: string;
    foto?: string;
    imagem_url?: string;
    arquivo_url?: string;
    image?: string;
    url?: string;
  };
}

const money = (value?: number) => `R$ ${(value || 0).toFixed(2)}`;

export const OrcamentoPdfModal: React.FC<OrcamentoPdfModalProps> = ({ isOpen, onClose, projeto }) => {
  const { user } = useAuth();
  if (!isOpen) return null;

  const companyName = user?.companyName?.trim() || 'Meu Estúdio 3D';
  const reference = projeto.id?.replace(/[^a-z0-9]/gi, '').slice(-6).toUpperCase() || '000001';
  const createdDate = projeto.dataCriacao ? new Date(projeto.dataCriacao) : new Date();
  const quoteDate = createdDate.toLocaleDateString('pt-BR');
  const materials = projeto.materials || [];
  const companyPhone = user?.companyPhone?.trim() || '';
  const productName = projeto.nomePeca?.trim() || 'Peça Impressa em 3D';

  // Busca a imagem em qualquer campo possível retornado pelo Supabase
  const productFoto =
    projeto.fotoUrl ||
    projeto.imagemUrl ||
    projeto.imageUrl ||
    projeto.foto ||
    projeto.imagem_url ||
    projeto.arquivo_url ||
    projeto.image ||
    projeto.url;

  // Configurações de pagamento isoladas da Farm do usuário ativo
  const settings = PaymentMethodsService.getSettings(user?.id);
  const downPaymentPercent = settings.downPaymentPercent || 50;
  const totalCobrado = Number(projeto.precoCobrado) || 0;
  const downPaymentAmount = Number(((totalCobrado * downPaymentPercent) / 100).toFixed(2));
  const remainingAmount = Math.max(0, Number((totalCobrado - downPaymentAmount).toFixed(2)));

  const pixDiscount = settings.methods?.pix?.discountPercent ?? settings.pixDiscountPercent ?? 5;
  const cashDiscount = settings.methods?.dinheiro?.discountPercent ?? settings.cashDiscountPercent ?? 5;

  // Determinar texto descritivo da forma de pagamento
  const paymentMethodLabel = (() => {
    if (projeto.detalhesPagamento) return projeto.detalhesPagamento;
    if (projeto.formaPagamento === 'pix') {
      return pixDiscount > 0
        ? `PIX à Vista (${pixDiscount}% de desconto)`
        : 'PIX à Vista';
    }
    if (projeto.formaPagamento === 'credito') {
      const n = projeto.parcelasCartao || 1;
      return n > 1 ? `Cartão de Crédito em ${n}x` : 'Cartão de Crédito à Vista';
    }
    if (projeto.formaPagamento === 'debito') {
      return 'Cartão de Débito';
    }
    if (projeto.formaPagamento === 'dinheiro') {
      return cashDiscount > 0
        ? `Dinheiro / Espécie (${cashDiscount}% de desconto)`
        : 'Dinheiro / Espécie';
    }
    return 'PIX / Cartão de Crédito / Débito / Dinheiro';
  })();

  const clientContact = projeto.clienteContato?.trim() || '';

  const handlePrint = () => window.print();

  const handleSendWhatsapp = () => {
    const materialsDesc = materials.length
      ? materials.map((m, i) => `${i + 1}. ${m.filamentType} ${m.color} — ${m.weightGrams}g`).join('\n')
      : `${projeto.filamentoUtilizado || 'Material a confirmar'} — ${projeto.pesoEstimadoG || '—'}g`;

    const paymentLine = `Forma de Pagamento: ${paymentMethodLabel}`;
    const pixKeyLine = (settings.pixKey && (projeto.formaPagamento === 'pix' || !projeto.formaPagamento))
      ? `Chave Pix (${settings.pixKeyType}): ${settings.pixKey}${settings.pixBeneficiary ? ` (${settings.pixBeneficiary})` : ''}\n`
      : '';
    
    const text = encodeURIComponent(
      `ORÇAMENTO COMERCIAL #${reference} — ${companyName}\n\n` +
      `Cliente: ${projeto.clienteNome || 'Cliente'}\n` +
      (clientContact ? `Contato do Cliente: ${clientContact}\n` : '') +
      `Produto/Projeto: ${productName}\n` +
      `Peso total: ${projeto.pesoEstimadoG ?? '—'} g\n` +
      `Tempo impresso: ${projeto.tempoEstimadoHoras ?? '—'} h\n` +
      `Impressora: ${projeto.impressoraNome || 'A definir'}\n\n` +
      `Materiais:\n${materialsDesc}\n\n` +
      `Total Geral: ${money(projeto.precoCobrado)}\n` +
      `${paymentLine}\n` +
      pixKeyLine +
      `Condições: Sinal de ${downPaymentPercent}% (${money(downPaymentAmount)}) para início da produção (restante ${money(remainingAmount)} na entrega).\n` +
      `Validade: 7 dias úteis`
    );

    const digits = clientContact.replace(/\D/g, '');
    const phoneParam = digits.length >= 10
      ? `&phone=${digits.length <= 11 && !digits.startsWith('55') ? `55${digits}` : digits}`
      : '';

    window.open(`https://api.whatsapp.com/send?text=${text}${phoneParam}`, '_blank', 'noopener,noreferrer');
    toast.success('Proposta preparada para compartilhar pelo WhatsApp.');
  };

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-start justify-center p-2 sm:p-4 overflow-y-auto print:p-0 print:bg-white print:static"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .print\\:hidden {
            display: none !important;
          }
          .print-card {
            border: 1px solid #d1d5db !important;
            box-shadow: none !important;
            padding: 24px !important;
            background: #ffffff !important;
            color: #000000 !important;
            width: 100% !important;
            max-width: 100% !important;
            border-radius: 0px !important;
          }
          .page-break-avoid {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl sm:rounded-3xl w-full max-w-4xl p-3 sm:p-6 space-y-4 shadow-2xl text-left my-2 sm:my-6 relative print:m-0 print:p-0 print:border-none print:bg-white print:max-w-none">
        
        {/* BARRA SUPERIOR FIXA (STICKY) DE AÇÕES - Sempre visível mesmo com rolagem */}
        <div className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur-md flex flex-wrap justify-between items-center gap-2 border-b border-slate-800 py-2.5 px-1 print:hidden">
          <div className="flex items-center gap-2">
            <span className="text-xs sm:text-sm font-bold text-white">Proposta Comercial</span>
            <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono">#{reference}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handlePrint} variant="outline" className="bg-slate-800 border-slate-700 text-white text-xs rounded-xl hover:bg-slate-700 h-8">
              <Printer className="w-3.5 h-3.5 mr-1" />Imprimir / PDF
            </Button>
            <Button size="sm" onClick={handleSendWhatsapp} className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded-xl font-bold h-8">
              <Send className="w-3.5 h-3.5 mr-1" />WhatsApp
            </Button>
            <button 
              onClick={onClose} 
              aria-label="Fechar proposta" 
              className="bg-slate-800 hover:bg-red-600 text-slate-300 hover:text-white transition-colors w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm ml-1"
            >
              ✕
            </button>
          </div>
        </div>

        {/* FOLHA DE ORÇAMENTO COMERCIAL */}
        <article className="print-card bg-white text-gray-900 border border-gray-300 rounded-xl p-5 sm:p-8 space-y-5 font-sans">
          
          {/* CABEÇALHO */}
          <header className="flex justify-between items-start border-b border-gray-300 pb-4">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-black rounded-lg flex items-center justify-center p-1.5 text-white shrink-0">
                {user?.avatar ? (
                  <img src={user.avatar} alt="Logo" className="w-full h-full object-cover rounded" />
                ) : (
                  <span className="text-amber-500 font-bold text-xl sm:text-2xl">S</span>
                )}
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-bold text-gray-900 tracking-tight leading-tight">{companyName}</h1>
                <p className="text-[11px] sm:text-xs text-gray-500">Impressão 3D e manufatura aditiva</p>
                <p className="text-[11px] sm:text-xs text-gray-500">
                  {[user?.email, companyPhone].filter(Boolean).join(' | ')}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-gray-400 block">ORÇAMENTO COMERCIAL</span>
              <p className="text-sm sm:text-base font-bold text-gray-800">Pedido: #{reference}</p>
            </div>
          </header>

          {/* METADADOS DO PEDIDO */}
          <div className="grid grid-cols-3 gap-2 border border-gray-200 rounded-lg p-2 bg-gray-50 text-center text-xs">
            <div>
              <span className="text-[10px] text-gray-500 block uppercase font-semibold">Status</span>
              <span className="font-bold text-gray-800">ORÇADO</span>
            </div>
            <div className="border-x border-gray-200">
              <span className="text-[10px] text-gray-500 block uppercase font-semibold">Emissão</span>
              <span className="font-bold text-gray-800">{quoteDate}</span>
            </div>
            <div>
              <span className="text-[10px] text-gray-500 block uppercase font-semibold">Modalidade</span>
              <span className="font-bold text-gray-800">Varejo</span>
            </div>
          </div>

          {/* 1. DADOS DO CLIENTE / PROJETO */}
          <section className="border border-gray-200 rounded-lg p-3.5 space-y-2">
            <h2 className="text-xs font-bold text-gray-800 uppercase tracking-wide border-b border-gray-100 pb-1">
              1. Dados do Cliente / Projeto
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div>
                <p><strong className="text-gray-600">Razão / Cliente:</strong> {projeto.clienteNome || 'Cliente não informado'}</p>
                <p><strong className="text-gray-600">Contato do Cliente:</strong> {clientContact || 'Não informado'}</p>
              </div>
              <div>
                <p><strong className="text-gray-600">Produto / Projeto:</strong> {productName}</p>
              </div>
            </div>
          </section>

          {/* 2. PRODUTOS / SERVIÇOS & MATERIAIS */}
          <section className="border border-gray-200 rounded-lg p-3.5 space-y-3 page-break-avoid">
            <h2 className="text-xs font-bold text-gray-800 uppercase tracking-wide border-b border-gray-100 pb-1">
              2. Produtos / Serviços & Materiais
            </h2>

            <div className="border border-gray-200 rounded-md overflow-hidden">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-100 text-gray-600 uppercase font-semibold border-b border-gray-200">
                  <tr>
                    <th className="py-2 px-2 w-16 text-center">Foto</th>
                    <th className="py-2 px-2 w-8 text-center">#</th>
                    <th className="py-2 px-2">Material</th>
                    <th className="py-2 px-2">Cor / Acabamento</th>
                    <th className="py-2 px-2 text-right">Peso</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-gray-800">
                  {materials.length ? (
                    materials.map((m, index) => (
                      <tr key={m.id || index}>
                        {index === 0 ? (
                          <td rowSpan={materials.length} className="p-2 border-r border-gray-200 text-center align-middle bg-gray-50/50">
                            {productFoto ? (
                              <img
                                src={productFoto}
                                alt={productName}
                                className="w-14 h-14 object-cover rounded-md border border-gray-300 mx-auto"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-md bg-gray-100 border border-gray-300 flex flex-col items-center justify-center text-gray-400 mx-auto p-1 text-[9px] text-center">
                                <ImageIcon className="w-5 h-5 mb-0.5 text-gray-400" />
                                <span>Sem Foto</span>
                              </div>
                            )}
                          </td>
                        ) : null}
                        <td className="py-2 px-2 text-center font-mono text-gray-500">{index + 1}</td>
                        <td className="py-2 px-2 font-bold">{m.filamentType}</td>
                        <td className="py-2 px-2">{m.color}</td>
                        <td className="py-2 px-2 text-right font-mono">{m.weightGrams} g</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="p-2 border-r border-gray-200 text-center align-middle bg-gray-50/50">
                        {productFoto ? (
                          <img
                            src={productFoto}
                            alt={productName}
                            className="w-14 h-14 object-cover rounded-md border border-gray-300 mx-auto"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-md bg-gray-100 border border-gray-300 flex flex-col items-center justify-center text-gray-400 mx-auto p-1 text-[9px] text-center">
                            <ImageIcon className="w-5 h-5 mb-0.5 text-gray-400" />
                            <span>Sem Foto</span>
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-2 text-center font-mono text-gray-500">1</td>
                      <td className="py-2 px-2 font-bold">{projeto.filamentoUtilizado || 'PLA'}</td>
                      <td className="py-2 px-2">Conforme solicitado</td>
                      <td className="py-2 px-2 text-right font-mono">{projeto.pesoEstimadoG ?? '—'} g</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* ESPECIFICAÇÕES TÉCNICAS */}
            <div className="grid grid-cols-3 gap-2 bg-gray-50 p-2.5 rounded-md border border-gray-200 text-center text-xs">
              <div>
                <span className="text-[10px] text-gray-500 block uppercase font-semibold">Peso Total Estimado</span>
                <strong className="text-gray-800 text-xs">{projeto.pesoEstimadoG ?? '136'} g</strong>
              </div>
              <div className="border-x border-gray-200">
                <span className="text-[10px] text-gray-500 block uppercase font-semibold">Tempo de Impressão</span>
                <strong className="text-gray-800 text-xs">{projeto.tempoEstimadoHoras ?? '5'} h</strong>
              </div>
              <div>
                <span className="text-[10px] text-gray-500 block uppercase font-semibold">Impressora</span>
                <strong className="text-gray-800 text-xs">{projeto.impressoraNome || 'A definir na aprovação'}</strong>
              </div>
            </div>

            {/* RESUMO FINANCEIRO */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-3 pt-2 border-t border-gray-100">
              <div className="text-[11px] text-gray-500">
                <p><strong className="text-gray-700">Custos Inclusos:</strong> Embalagem, Cartão e Acabamento</p>
              </div>
              <div className="text-right w-full sm:w-auto">
                <div className="text-xs text-gray-500 space-y-0.5">
                  <p>Subtotal Produtos: <span className="font-mono">{money(projeto.precoCobrado)}</span></p>
                  <p>Frete / Envio: <span className="font-mono">R$ 0,00</span></p>
                </div>
                <div className="mt-1 pt-1 border-t border-gray-200">
                  <span className="text-xs uppercase font-bold text-gray-600 mr-2">Total Geral:</span>
                  <span className="text-xl font-black text-amber-600">{money(projeto.precoCobrado)}</span>
                </div>
              </div>
            </div>
          </section>

          {/* 3. FORMA DE PAGAMENTO E CONDIÇÕES */}
          <section className="border border-gray-200 rounded-lg p-3.5 space-y-2 page-break-avoid">
            <h2 className="text-xs font-bold text-gray-800 uppercase tracking-wide border-b border-gray-100 pb-1">
              3. Forma de Pagamento & Condições Comerciais
            </h2>
            
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs bg-gray-50 p-2.5 rounded border border-gray-200 gap-2">
              <div>
                <span className="font-semibold text-gray-800 block">{paymentMethodLabel}</span>
                {settings.pixKey && (projeto.formaPagamento === 'pix' || !projeto.formaPagamento) && (
                  <p className="text-[11px] text-gray-600 font-mono mt-0.5">
                    Chave Pix ({settings.pixKeyType}): <strong>{settings.pixKey}</strong>
                    {settings.pixBeneficiary && ` · Titular: ${settings.pixBeneficiary}`}
                  </p>
                )}
              </div>
              <strong className="text-gray-900 font-mono text-sm whitespace-nowrap">{money(projeto.precoCobrado)}</strong>
            </div>

            <div className="text-[11px] text-gray-600 bg-amber-50/60 border border-amber-200/80 rounded-md p-2.5 space-y-1">
              <p className="font-semibold text-amber-900 flex items-center gap-1">
                • Condições de Início de Produção:
              </p>
              <p>
                Solicitamos um adiantamento (sinal) de <strong>{downPaymentPercent}% do valor total ({money(downPaymentAmount)})</strong> no ato da aprovação para garantia de reserva de maquinário e aquisição de insumos/materiais. O valor restante ({money(remainingAmount)}) será pago na entrega da peça.
              </p>
              <p className="text-amber-950 font-medium pt-0.5">
                ⚠️ <em>Nota: O valor do adiantamento não será reembolsável em caso de cancelamento após a aprovação, pois destina-se ao custeio direto de matéria-prima e setup de produção.</em>
              </p>
            </div>

            <div className="flex justify-between items-center text-[11px] text-gray-500 pt-1">
              <span className="text-emerald-700 font-semibold">✓ Proposta válida por 7 dias úteis.</span>
              <span>Prazo de produção contado após a confirmação do adiantamento.</span>
            </div>
          </section>

          {/* ASSINATURAS */}
          <footer className="grid grid-cols-2 gap-8 pt-6 text-center text-xs text-gray-600 page-break-avoid">
            <div>
              <div className="border-b border-gray-400 mb-1.5 w-4/5 mx-auto"></div>
              <p className="font-medium text-gray-800">{companyName} - Emissor Autorizado</p>
            </div>
            <div>
              <div className="border-b border-gray-400 mb-1.5 w-4/5 mx-auto"></div>
              <p className="font-medium text-gray-800">{projeto.clienteNome || 'Cliente / Contratante'}</p>
            </div>
          </footer>

        </article>
      </div>
    </div>
  );
};