"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Bot, Sparkles, Copy, QrCode } from 'lucide-react';
import { toast } from 'sonner';

interface ClientAiAutomationCardProps {
  onConsumeCredits: (amount: number) => boolean;
  priceMonthly: number;
  onOpenPixModal: () => void;
}

export const ClientAiAutomationCard: React.FC<ClientAiAutomationCardProps> = ({
  onConsumeCredits,
  priceMonthly,
  onOpenPixModal,
}) => {
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateCopy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;

    if (!onConsumeCredits(500)) return;

    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      setAiResponse(
        `🚀 Copy de Vendas / Recuperação com Alta Conversão:\n\n"Olá! Vimos que você iniciou sua jornada para multiplicar o faturamento este mês. Liberamos uma condição VIP com 15% de bônus imediato nos créditos de IA caso conclua a adesão nas próximas 2 horas. Quer que eu reserve sua vaga agora?"\n\n💡 Taxa média de conversão projetada: 38.4%`
      );
      toast.success('Conteúdo gerado! 500 créditos de IA consumidos.');
    }, 800);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2 bg-slate-900 border border-indigo-500/30 rounded-2xl shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base text-white font-bold">
                  Gerador de Campanhas & Recuperação de Vendas (IA)
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Crie copies, mensagens de WhatsApp e e-mails de alta conversão em segundos
                </CardDescription>
              </div>
            </div>
            <Badge className="bg-indigo-500/10 border-indigo-500/30 text-indigo-300 text-xs font-bold">
              500 créditos / geração
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <form onSubmit={handleGenerateCopy} className="space-y-3">
            <Input
              value={aiPrompt}
              onChange={e => setAiPrompt(e.target.value)}
              placeholder="Ex: Criar mensagem de WhatsApp para recuperar carrinho de quem abandonou o checkout..."
              className="bg-slate-950 border-slate-750 text-white rounded-xl h-11 text-sm"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">
                💡 Modelos treinados em persuasão e métricas de SaaS B2B/B2C.
              </span>
              <Button
                type="submit"
                disabled={isGenerating || !aiPrompt.trim()}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-semibold rounded-xl text-xs px-4"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1 text-amber-300" />
                {isGenerating ? 'Gerando inteligência...' : 'Gerar com IA'}
              </Button>
            </div>
          </form>

          {aiResponse && (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 animate-in fade-in duration-300">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Resultado Gerado com IA:
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    navigator.clipboard.writeText(aiResponse);
                    toast.success('Copy copiada para a área de transferência!');
                  }}
                  className="h-7 text-xs text-slate-300 hover:text-white"
                >
                  <Copy className="w-3.5 h-3.5 mr-1" /> Copiar
                </Button>
              </div>
              <pre className="text-xs text-slate-200 whitespace-pre-wrap font-sans leading-relaxed">
                {aiResponse}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border border-emerald-500/30 rounded-2xl shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base text-white font-bold">Fatura & Cobrança</CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Pagamento instantâneo via Pix ou Cartão
              </CardDescription>
            </div>
            <Badge className="bg-emerald-500/10 border-emerald-500/30 text-emerald-300 text-[10px] px-2 py-0.5 font-bold">
              Automático
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Próxima Fatura:</p>
              <p className="text-xl font-black text-white">R$ {priceMonthly},00</p>
              <span className="text-[11px] text-emerald-400 font-medium">Vencimento: Próximo ciclo</span>
            </div>
            <Button
              onClick={onOpenPixModal}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs h-10"
            >
              <QrCode className="w-4 h-4 mr-1.5" /> Pagar com Pix Instantâneo
            </Button>
          </div>

          <div className="text-xs space-y-1.5 text-slate-400">
            <div className="flex justify-between">
              <span>Nota Fiscal Eletrônica:</span>
              <span className="text-white font-medium">Emitida automaticamente</span>
            </div>
            <div className="flex justify-between">
              <span>Garantia:</span>
              <span className="text-white font-medium">Cancelamento a qualquer momento</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};