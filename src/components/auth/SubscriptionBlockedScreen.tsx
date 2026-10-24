import React, { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldAlert, RefreshCw, MessageSquare, LogOut, QrCode, CheckCircle2, Clock } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Invoice } from '@/types/saas';

export const SubscriptionBlockedScreen: React.FC = () => {
  const { user, logout, refreshUser } = useAuth();
  const [checking, setChecking] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(true);

  useEffect(() => {
    if (!user || !supabase) return;
    supabase
      .from('spartan_invoices')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) {
          setInvoices(
            data.map((row: Record<string, unknown>) => ({
              id: String(row.id || ''),
              clientId: String(row.user_id || ''),
              clientName: user.name,
              amount: Number(row.amount || 0),
              status: row.status === 'paid' ? 'paid' : row.status === 'failed' ? 'failed' : 'pending',
              dueDate: String(row.due_date || ''),
              paidAt: typeof row.paid_at === 'string' ? row.paid_at : undefined,
              method: (row.method === 'credit_card' || row.method === 'boleto' ? row.method : 'pix') as Invoice['method'],
            }))
          );
        }
        setLoadingInvoices(false);
      });
  }, [user]);

  const handleRefresh = async () => {
    setChecking(true);
    try {
      await refreshUser();
      toast.info('Verificando status da sua assinatura junto ao servidor...');
    } catch (error) {
      toast.error('Não foi possível atualizar o status no momento.');
    } finally {
      setTimeout(() => setChecking(false), 800);
    }
  };

  const handleOpenCheckout = async (invoiceId?: string) => {
    if (!supabase) return;
    try {
      toast.loading('Gerando checkout de pagamento...');
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: invoiceId ? { invoiceId } : { clientId: user?.id, planId: user?.planId },
      });
      if (error) throw error;
      if (data?.checkoutUrl) {
        window.location.assign(data.checkoutUrl);
      } else {
        toast.info('Cobrança registrada. Entre em contato com o suporte para concluir.');
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Falha ao abrir checkout.');
    }
  };

  const pendingInvoices = invoices.filter(inv => inv.status === 'pending' || inv.status === 'failed');

  return (
    <main className="min-h-screen bg-slate-950 p-4 sm:p-6 text-white grid place-items-center">
      <div className="w-full max-w-xl space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 shadow-xl shadow-rose-950/40">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Acesso Temporariamente Suspenso
          </h1>
          <p className="text-sm text-slate-400 max-w-md mx-auto">
            Identificamos pendência financeira ou o status da sua conta foi alterado para atrasado pela administração da plataforma.
          </p>
        </div>

        <Card className="bg-slate-900 border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-rose-900/40 to-slate-900 p-4 border-b border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-xs text-rose-300 font-semibold uppercase tracking-wider block">Status da Assinatura</span>
              <p className="text-sm font-bold text-white">{user?.name} {user?.companyName ? `(${user.companyName})` : ''}</p>
            </div>
            <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/30 text-xs py-1 px-2.5">
              Atrasado (Acesso Bloqueado)
            </Badge>
          </div>

          <CardContent className="p-5 sm:p-6 space-y-5">
            <div className="rounded-xl bg-slate-950/80 border border-slate-800 p-4 text-xs space-y-2 text-slate-300">
              <p className="font-semibold text-rose-300 flex items-center gap-1.5">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                Módulos operacionais bloqueados:
              </p>
              <ul className="list-disc list-inside space-y-1 text-slate-400 pl-1">
                <li>Calculadora e precificação de peças 3D</li>
                <li>Gestão de estoque de filamentos e resinas</li>
                <li>Monitoramento e controle do parque de impressoras</li>
                <li>Criação e edição de projetos e ordens de serviço</li>
                <li>Copiloto de IA e diagnósticos avançados</li>
              </ul>
            </div>

            {/* Faturas Pendentes */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                Faturas para Regularização Imediata:
              </h3>

              {loadingInvoices ? (
                <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-400 animate-pulse">
                  Carregando faturas da conta...
                </div>
              ) : pendingInvoices.length > 0 ? (
                <div className="space-y-2">
                  {pendingInvoices.map(invoice => (
                    <div
                      key={invoice.id}
                      className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-indigo-400">{invoice.id}</span>
                          <span className="text-xs font-bold text-white">R$ {invoice.amount.toFixed(2)}</span>
                        </div>
                        <span className="text-[11px] text-slate-400 block mt-0.5">
                          Vencimento: {invoice.dueDate || 'Pendente'}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleOpenCheckout(invoice.id)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl h-8 px-3 shrink-0"
                      >
                        <QrCode className="w-3.5 h-3.5 mr-1.5" /> Pagar com Pix
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-center text-xs text-slate-400">
                  Nenhuma fatura automática pendente encontrada. Entre em contato com a administração para restabelecimento do seu plano.
                </div>
              )}
            </div>

            {/* Ações */}
            <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row gap-2.5">
              <Button
                variant="outline"
                onClick={handleRefresh}
                disabled={checking}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-white border-slate-700 rounded-xl h-10 text-xs font-semibold"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-2 ${checking ? 'animate-spin text-indigo-400' : ''}`} />
                {checking ? 'Verificando...' : 'Já realizei o pagamento (Verificar)'}
              </Button>

              <Button
                asChild
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl h-10 text-xs font-semibold"
              >
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Olá, sou ${user?.name} (${user?.email}) e gostaria de regularizar o acesso da minha conta na Spartan 3D.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageSquare className="w-3.5 h-3.5 mr-2" /> Falar com Suporte
                </a>
              </Button>
            </div>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => logout()}
                className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" /> Sair da conta e voltar ao login
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};
