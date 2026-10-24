"use client";

import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DollarSign,
  QrCode,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  Copy,
  Check,
  Send,
  Search,
  Settings2,
  RefreshCw,
  X,
  CreditCard,
  Ban,
  TrendingUp,
  Receipt,
  Sparkles,
  Download,
  Printer,
  RotateCcw,
  MessageCircle,
} from 'lucide-react';
import { useSaaSData } from '@/context/SaaSDataContext';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { Invoice, User } from '@/types/saas';
import {
  PixConfig,
  getSavedPixConfig,
  savePixConfig,
  syncPixConfigFromSupabase,
  generatePixPayload,
  getPixQrCodeUrl,
} from '@/services/pixService';

export const AdminFinancialArea: React.FC = () => {
  const { user } = useAuth();
  const {
    invoices,
    clients,
    plans,
    createDirectInvoice,
    confirmInvoicePayment,
    cancelInvoice,
    refreshBilling,
  } = useSaaSData();

  // Configuração Pix isolada por user.id e sincronizada na nuvem (Supabase)
  const [pixConfig, setPixConfig] = useState<PixConfig>(() => getSavedPixConfig(user?.id));
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [editingConfig, setEditingConfig] = useState<PixConfig>(() => getSavedPixConfig(user?.id));
  const [savingConfig, setSavingConfig] = useState(false);

  React.useEffect(() => {
    if (!user?.id) return;
    const local = getSavedPixConfig(user.id);
    if (local.chave) {
      setPixConfig(local);
      setEditingConfig(local);
    }

    void syncPixConfigFromSupabase(user.id).then(cloudConfig => {
      if (cloudConfig && cloudConfig.chave) {
        setPixConfig(cloudConfig);
        setEditingConfig(cloudConfig);
      }
    });

    const handleUpdate = () => {
      const updated = getSavedPixConfig(user.id);
      setPixConfig(updated);
      setEditingConfig(updated);
    };

    window.addEventListener('spartan_pix_config_updated', handleUpdate);
    return () => window.removeEventListener('spartan_pix_config_updated', handleUpdate);
  }, [user?.id]);

  // Modal Nova Cobrança Pix
  const [showNewChargeModal, setShowNewChargeModal] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [chargeAmount, setChargeAmount] = useState('');
  const [chargeDueDate, setChargeDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 5);
    return d.toISOString().slice(0, 10);
  });
  const [chargeDescription, setChargeDescription] = useState('Mensalidade Assinatura Spartan 3D');
  const [creatingCharge, setCreatingCharge] = useState(false);

  // Modal Visualização Pix (QR Code / Copia e Cola)
  const [activePixModal, setActivePixModal] = useState<{
    invoice: Invoice;
    pixPayload: string;
    client?: User;
  } | null>(null);
  const [copiedPayload, setCopiedPayload] = useState(false);

  // Filtros e busca
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid' | 'failed'>('all');
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);

  // Modal de Recibo / Comprovante
  const [receiptModalInvoice, setReceiptModalInvoice] = useState<Invoice | null>(null);
  const [copiedReceipt, setCopiedReceipt] = useState(false);

  // Anos disponíveis para filtro de faturas
  const availableInvoiceYears = useMemo(() => {
    const years = new Set<string>();
    const currentYear = new Date().getFullYear();
    years.add((currentYear - 1).toString());
    years.add(currentYear.toString());
    years.add((currentYear + 1).toString());

    invoices.forEach(inv => {
      if (inv.dueDate) {
        const y = new Date(inv.dueDate).getFullYear();
        if (!isNaN(y)) years.add(y.toString());
      }
      if (inv.paidAt) {
        const y = new Date(inv.paidAt).getFullYear();
        if (!isNaN(y)) years.add(y.toString());
      }
    });

    return Array.from(years).sort();
  }, [invoices]);

  // Cálculos de KPIs Financeiros
  const kpis = useMemo(() => {
    const paidInvoices = invoices.filter(inv => inv.status === 'paid');
    const totalPaid = paidInvoices.reduce((sum, inv) => sum + inv.amount, 0);

    const pendingInvoices = invoices.filter(inv => inv.status === 'pending');
    const totalPending = pendingInvoices.reduce((sum, inv) => sum + inv.amount, 0);

    const overdueClients = clients.filter(c => c.status === 'overdue');
    const totalOverdueMRR = overdueClients.reduce((sum, c) => sum + (c.mrr || 0), 0);

    const pixInvoices = invoices.filter(inv => inv.method === 'pix');
    const pixPaid = pixInvoices.filter(inv => inv.status === 'paid').length;
    const pixConversion = pixInvoices.length > 0 ? Math.round((pixPaid / pixInvoices.length) * 100) : 100;
    const liquidationRate = invoices.length > 0 ? Math.round((paidInvoices.length / invoices.length) * 100) : 100;

    return {
      totalPaid,
      paidCount: paidInvoices.length,
      liquidationRate,
      totalPending,
      pendingCount: pendingInvoices.length,
      overdueClientsCount: overdueClients.length,
      totalOverdueMRR,
      pixConversion,
      totalInvoicesCount: invoices.length,
    };
  }, [invoices, clients]);

  // Lista de faturas filtrada
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv => {
      const matchStatus = statusFilter === 'all' || inv.status === statusFilter;
      const matchSearch =
        inv.id.toLowerCase().includes(search.toLowerCase()) ||
        inv.clientName.toLowerCase().includes(search.toLowerCase());

      if (!matchStatus || !matchSearch) return false;

      const dateToFilter = inv.paidAt ? new Date(inv.paidAt) : (inv.dueDate ? new Date(inv.dueDate) : null);

      if (filterYear !== 'all') {
        if (!dateToFilter || dateToFilter.getFullYear().toString() !== filterYear) return false;
      }

      if (filterMonth !== 'all') {
        if (!dateToFilter) return false;
        const m = String(dateToFilter.getMonth() + 1).padStart(2, '0');
        if (m !== filterMonth) return false;
      }

      return true;
    });
  }, [invoices, statusFilter, search, filterYear, filterMonth]);

  const hasActiveInvoiceFilters = statusFilter !== 'all' || filterYear !== 'all' || filterMonth !== 'all' || search.trim() !== '';

  const handleClearInvoiceFilters = () => {
    setStatusFilter('all');
    setFilterYear('all');
    setFilterMonth('all');
    setSearch('');
  };

  const handleExportInvoicesCsv = () => {
    if (filteredInvoices.length === 0) {
      toast.error('Nenhuma fatura disponível para exportação.');
      return;
    }

    const headers = ['ID Fatura', 'Cliente', 'Valor (R$)', 'Forma', 'Vencimento', 'Status', 'Data Liquidacao'];
    const rows = filteredInvoices.map(inv => {
      const dueFormatted = inv.dueDate ? new Date(`${inv.dueDate}T00:00:00`).toLocaleDateString('pt-BR') : '';
      const paidFormatted = inv.paidAt ? new Date(inv.paidAt).toLocaleDateString('pt-BR') : '';
      const statusText = inv.status === 'paid' ? 'Liquidada' : inv.status === 'pending' ? 'Pendente' : 'Cancelada';

      return [
        `"${inv.id}"`,
        `"${(inv.clientName || '').replace(/"/g, '""')}"`,
        `"${inv.amount.toFixed(2)}"`,
        `"${inv.method.toUpperCase()}"`,
        `"${dueFormatted}"`,
        `"${statusText}"`,
        `"${paidFormatted}"`,
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const now = new Date();
    const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    link.setAttribute('download', `faturas_spartan3d_${dateStamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`${filteredInvoices.length} fatura(s) exportada(s) para CSV com sucesso!`);
  };

  const handleCopyReceipt = (inv: Invoice) => {
    const text = `*COMPROVANTE DE PAGAMENTO - SPARTAN 3D FARM*\n----------------------------------------\n*Fatura:* ${inv.id}\n*Cliente:* ${inv.clientName}\n*Valor:* R$ ${inv.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n*Status:* PAGO E LIQUIDADO ✅\n*Data:* ${inv.paidAt ? new Date(inv.paidAt).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')}\n*Forma:* Pix\n*Recebedor:* ${pixConfig.nomeTitular || 'Spartan 3D Farm'}\n*Chave Pix:* ${pixConfig.chave || 'Não informada'}\n----------------------------------------\nObrigado pela confiança na Spartan 3D!`;
    navigator.clipboard.writeText(text);
    setCopiedReceipt(true);
    toast.success('Comprovante copiado para a área de transferência!');
    setTimeout(() => setCopiedReceipt(false), 2000);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshBilling();
      toast.success('Dados financeiros e faturas atualizados.');
    } catch (error) {
      toast.error('Falha ao atualizar dados financeiros.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingConfig(true);
    setPixConfig(editingConfig);
    setShowConfigModal(false);
    try {
      await savePixConfig(editingConfig, user?.id);
      toast.success('Configuração da Chave Pix salva na nuvem com sucesso!');
    } catch {
      toast.error('Não foi possível salvar na nuvem, mas o valor foi mantido no navegador.');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleOpenNewCharge = (preselectClientId?: string) => {
    const targetId = preselectClientId || clients[0]?.id || '';
    setSelectedClientId(targetId);
    const client = clients.find(c => c.id === targetId);
    const plan = plans.find(p => p.id === client?.planId);
    setChargeAmount(plan ? String(plan.priceMonthly) : '150');
    setChargeDescription(plan ? `Assinatura Spartan 3D - Plano ${plan.name}` : 'Mensalidade Assinatura Spartan 3D');
    setShowNewChargeModal(true);
  };

  const handleClientChange = (clientId: string) => {
    setSelectedClientId(clientId);
    const client = clients.find(c => c.id === clientId);
    const plan = plans.find(p => p.id === client?.planId);
    if (plan) {
      setChargeAmount(String(plan.priceMonthly));
      setChargeDescription(`Assinatura Spartan 3D - Plano ${plan.name}`);
    }
  };

  const handleCreateCharge = async (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = Number(chargeAmount);
    if (!selectedClientId) {
      toast.error('Selecione um cliente.');
      return;
    }
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      toast.error('Informe um valor válido.');
      return;
    }

    setCreatingCharge(true);
    try {
      const targetClient = clients.find(c => c.id === selectedClientId);
      const created = await createDirectInvoice({
        clientId: selectedClientId,
        amount: amountNum,
        dueDate: chargeDueDate,
        planId: targetClient?.planId,
        method: 'pix',
      });

      if (created) {
        setShowNewChargeModal(false);
        // Gera o payload Pix para abrir na hora o modal de cobrança
        const invoiceObj: Invoice = {
          id: String(created.id),
          clientId: selectedClientId,
          clientName: targetClient?.name || 'Cliente',
          amount: amountNum,
          status: 'pending',
          dueDate: chargeDueDate,
          method: 'pix',
        };

        const payload = generatePixPayload({
          chave: pixConfig.chave,
          nomeTitular: pixConfig.nomeTitular,
          cidade: pixConfig.cidade,
          valor: amountNum,
          txId: String(created.id).replace(/-/g, '').slice(0, 20),
          descricao: chargeDescription,
        });

        setActivePixModal({
          invoice: invoiceObj,
          pixPayload: payload,
          client: targetClient,
        });
      }
    } finally {
      setCreatingCharge(false);
    }
  };

  const handleViewPix = (inv: Invoice) => {
    const client = clients.find(c => c.id === inv.clientId);
    const payload = generatePixPayload({
      chave: pixConfig.chave,
      nomeTitular: pixConfig.nomeTitular,
      cidade: pixConfig.cidade,
      valor: inv.amount,
      txId: inv.id.replace(/-/g, '').slice(0, 20),
      descricao: `Fatura ${inv.id.slice(0, 8)}`,
    });

    setActivePixModal({
      invoice: inv,
      pixPayload: payload,
      client,
    });
  };

  const handleCopyPayload = (payload: string) => {
    navigator.clipboard.writeText(payload);
    setCopiedPayload(true);
    toast.success('Código Pix Copia e Cola copiado!');
    setTimeout(() => setCopiedPayload(false), 2000);
  };

  const handleShareWhatsApp = (inv: Invoice, payload: string, clientName?: string) => {
    const text = encodeURIComponent(
      `Olá ${clientName || 'Assinante'},\n\nSegue o código Pix para pagamento da sua fatura na *Spartan 3D Print*:\n\n*Valor:* R$ ${inv.amount.toFixed(
        2
      )}\n*Vencimento:* ${inv.dueDate}\n*Código:* ${inv.id}\n\n*Pix Copia e Cola:*\n\`\`\`${payload}\`\`\`\n\nApós o pagamento, o acesso é liberado instantaneamente pelo sistema. Obrigado!`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank', 'noopener,noreferrer');
    toast.success('Cobrança preparada para compartilhamento no WhatsApp.');
  };

  const handleConfirmPayment = async (invoiceId: string) => {
    await confirmInvoicePayment(invoiceId);
    if (activePixModal && activePixModal.invoice.id === invoiceId) {
      setActivePixModal(prev => (prev ? { ...prev, invoice: { ...prev.invoice, status: 'paid' } } : null));
    }
  };

  const handleCancelInvoice = async (invoiceId: string, invoiceCode: string) => {
    if (window.confirm(`Tem certeza que deseja cancelar a fatura #${invoiceCode}? A cobrança será cancelada e não receberá mais pagamentos.`)) {
      await cancelInvoice(invoiceId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header com Ações Globais */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <DollarSign className="w-6 h-6 text-emerald-400" />
            Gestão Financeira & Pix
          </h2>
          <p className="text-xs text-slate-400">
            Controle de liquidações, geração de cobranças Pix e conciliação em tempo real
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
            className="border-slate-700 bg-slate-900 text-slate-300 hover:text-white rounded-xl text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin text-indigo-400' : ''}`} />
            Atualizar
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditingConfig(pixConfig);
              setShowConfigModal(true);
            }}
            className="border-slate-700 bg-slate-900 text-slate-300 hover:text-white rounded-xl text-xs"
          >
            <Settings2 className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
            Configurar Chave Pix
          </Button>

          <Button
            size="sm"
            onClick={() => handleOpenNewCharge()}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-xl text-xs shadow-lg shadow-emerald-950/40"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Nova Cobrança Pix
          </Button>
        </div>
      </div>

      {/* Cards de KPIs Financeiros com Design Executivo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Liquidado */}
        <Card className="bg-slate-900 border border-emerald-500/30 rounded-2xl shadow-lg hover:border-emerald-500/50 transition-all">
          <CardContent className="p-5 space-y-3">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4" />
                <span>Total Liquidado</span>
              </div>
              <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px] font-bold">
                {kpis.liquidationRate}% Quitado
              </Badge>
            </div>
            <div>
              <p className="text-2xl lg:text-3xl font-black text-white">
                R$ {kpis.totalPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Receita confirmada e baixada na plataforma
              </p>
            </div>
            <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Faturas Baixadas:</span>
              <span className="font-semibold text-emerald-400">
                {kpis.paidCount} recebimentos
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Faturas Pendentes */}
        <Card className="bg-slate-900 border border-amber-500/30 rounded-2xl shadow-lg hover:border-amber-500/50 transition-all">
          <CardContent className="p-5 space-y-3">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-1.5 text-amber-400 font-semibold text-xs uppercase tracking-wider">
                <Clock className="w-4 h-4" />
                <span>Faturas Pendentes</span>
              </div>
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px] font-bold">
                {kpis.pendingCount} Aguardando Pix
              </Badge>
            </div>
            <div>
              <p className="text-2xl lg:text-3xl font-black text-amber-400">
                R$ {kpis.totalPending.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Valores emitidos com vencimento ativo
              </p>
            </div>
            <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Previsão de Entrada:</span>
              <span className="font-semibold text-amber-300">
                Fluxo em aberto
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Inadimplência Atual */}
        <Card className="bg-slate-900 border border-rose-500/30 rounded-2xl shadow-lg hover:border-rose-500/50 transition-all">
          <CardContent className="p-5 space-y-3">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-1.5 text-rose-400 font-semibold text-xs uppercase tracking-wider">
                <AlertCircle className="w-4 h-4" />
                <span>Inadimplência</span>
              </div>
              <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/30 text-[10px] font-bold">
                {kpis.overdueClientsCount} Bloqueado(s)
              </Badge>
            </div>
            <div>
              <p className="text-2xl lg:text-3xl font-black text-rose-400">
                R$ {kpis.totalOverdueMRR.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                MRR de clientes suspensos por atraso
              </p>
            </div>
            <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Status de Acesso:</span>
              <span className="font-semibold text-rose-400">
                Bloqueio preventivo ativo
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Chave Pix da Farm */}
        <Card className="bg-slate-900 border border-indigo-500/30 rounded-2xl shadow-lg hover:border-indigo-500/50 transition-all">
          <CardContent className="p-5 space-y-3">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-1.5 text-indigo-400 font-semibold text-xs uppercase tracking-wider">
                <QrCode className="w-4 h-4" />
                <span>Chave Pix da Farm</span>
              </div>
              <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 text-[10px] font-bold">
                Nuvem Ativa
              </Badge>
            </div>
            <div>
              <p className="text-sm font-bold text-white truncate font-mono bg-slate-950/70 p-2 rounded-lg border border-slate-800">
                {pixConfig.chave}
              </p>
              <p className="text-[11px] text-slate-400 mt-1 truncate">
                Titular: <strong className="text-slate-200">{pixConfig.nomeTitular}</strong> • {pixConfig.cidade}
              </p>
            </div>
            <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Conversão Pix:</span>
              <span className="font-semibold text-emerald-400">
                {kpis.pixConversion}% de sucesso
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabela de Faturas & Conciliação */}
      <Card className="bg-slate-900 border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <CardHeader className="border-b border-slate-800/80 p-5 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base text-white font-bold flex items-center gap-2">
                <Receipt className="w-4 h-4 text-indigo-400" />
                Faturas & Cobranças Pix
              </CardTitle>
              <CardDescription className="text-xs text-slate-400">
                Histórico completo com QR Code, recibo digital, compartilhamento no WhatsApp e baixa manual
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                    statusFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Todas ({invoices.length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('pending')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                    statusFilter === 'pending' ? 'bg-amber-600/80 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Pendentes ({invoices.filter(i => i.status === 'pending').length})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('paid')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors ${
                    statusFilter === 'paid' ? 'bg-emerald-600/80 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Pagas ({invoices.filter(i => i.status === 'paid').length})
                </button>
              </div>
            </div>
          </div>

          {/* Filtros de Busca e Temporais (Ano / Mês) */}
          <div className="flex flex-wrap items-center gap-2.5 pt-1">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por cliente ou código da fatura..."
                className="bg-slate-950 border-slate-800 text-white pl-9 rounded-xl text-xs h-9 placeholder:text-slate-500 w-full"
              />
            </div>

            {/* Ano */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[11px] text-slate-400 font-medium">Ano:</span>
              <select
                value={filterYear}
                onChange={e => setFilterYear(e.target.value)}
                className="h-9 bg-slate-950 border border-slate-800 rounded-lg px-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="all">Todos os Anos</option>
                {availableInvoiceYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            {/* Mês */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[11px] text-slate-400 font-medium">Mês:</span>
              <select
                value={filterMonth}
                onChange={e => setFilterMonth(e.target.value)}
                className="h-9 bg-slate-950 border border-slate-800 rounded-lg px-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="all">Todos os Meses</option>
                <option value="01">01 - Janeiro</option>
                <option value="02">02 - Fevereiro</option>
                <option value="03">03 - Março</option>
                <option value="04">04 - Abril</option>
                <option value="05">05 - Maio</option>
                <option value="06">06 - Junho</option>
                <option value="07">07 - Julho</option>
                <option value="08">08 - Agosto</option>
                <option value="09">09 - Setembro</option>
                <option value="10">10 - Outubro</option>
                <option value="11">11 - Novembro</option>
                <option value="12">12 - Dezembro</option>
              </select>
            </div>

            {hasActiveInvoiceFilters && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleClearInvoiceFilters}
                className="h-9 px-2 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg"
                title="Limpar filtros de busca"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                Limpar
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Código</th>
                  <th className="py-3 px-4">Assinante / Empresa</th>
                  <th className="py-3 px-4">Valor</th>
                  <th className="py-3 px-4">Método</th>
                  <th className="py-3 px-4">Vencimento</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Ver Pix</th>
                  <th className="py-3 px-4 text-right">Ações Rápidas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filteredInvoices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      Nenhuma fatura encontrada para os filtros selecionados.
                    </td>
                  </tr>
                ) : (
                  filteredInvoices.map(inv => {
                    const client = clients.find(c => c.id === inv.clientId);
                    return (
                      <tr key={inv.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3.5 px-4 font-mono text-indigo-400 font-bold">
                          {inv.id.slice(0, 10)}…
                        </td>
                        <td className="py-3.5 px-4">
                          <p className="text-white font-bold text-xs">{inv.clientName}</p>
                          <p className="text-[11px] text-slate-400">{client?.companyName || client?.email}</p>
                        </td>
                        <td className="py-3.5 px-4 font-bold text-white text-sm">
                          R$ {inv.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 uppercase text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                            {inv.method === 'pix' ? <QrCode className="w-3 h-3" /> : <CreditCard className="w-3 h-3" />}
                            {inv.method}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-400">{inv.dueDate}</td>
                        <td className="py-3.5 px-4">
                          {inv.status === 'paid' ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold text-[11px] bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                              <CheckCircle2 className="w-3 h-3" /> Liquidada ({inv.paidAt || 'OK'})
                            </span>
                          ) : inv.status === 'failed' ? (
                            <span className="inline-flex items-center gap-1 text-rose-400 font-semibold text-[11px] bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded-full">
                              <Ban className="w-3 h-3" /> Cancelada / Falhou
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-400 font-semibold text-[11px] bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
                              <Clock className="w-3 h-3" /> Aguardando Pix
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {/* Coluna Ver Pix dedicada */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleViewPix(inv)}
                            className="h-7 px-2.5 text-[11px] bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white rounded-lg font-medium inline-flex items-center gap-1 border border-slate-700/60"
                            title="Visualizar QR Code Pix e Copia e Cola"
                          >
                            <QrCode className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                            Ver Pix
                          </Button>
                        </td>
                        <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                          {/* Recibo de Fatura Paga */}
                          {inv.status === 'paid' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setReceiptModalInvoice(inv)}
                              className="h-7 px-2.5 text-[11px] bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-500/30 rounded-lg font-medium inline-flex items-center"
                              title="Emitir Recibo / Comprovante Digital desta fatura"
                            >
                              <Receipt className="w-3 h-3 mr-1 text-emerald-400" />
                              Recibo
                            </Button>
                          )}

                          {/* Se pendente, ações de baixa e cancelamento */}
                          {inv.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleConfirmPayment(inv.id)}
                                className="h-7 px-2.5 text-[11px] bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 rounded-lg font-semibold transition-all inline-flex items-center"
                                title="Confirmar recebimento manual e liquidar fatura"
                              >
                                <CheckCircle2 className="w-3 h-3 mr-1" />
                                Dar Baixa
                              </Button>

                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleCancelInvoice(inv.id, inv.id.slice(0, 8))}
                                className="h-7 px-2.5 text-[11px] text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 rounded-lg font-medium inline-flex items-center gap-1"
                                title="Cancelar fatura definitivamente"
                              >
                                <Ban className="w-3 h-3 mr-1" />
                                Cancelar Fatura
                              </Button>
                            </>
                          )}

                          {/* Se cancelada / falhou */}
                          {inv.status === 'failed' && (
                            <span className="text-[11px] text-rose-400/80 font-medium inline-flex items-center gap-1">
                              <Ban className="w-3 h-3" /> Fatura cancelada
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal: Configurar Chave Pix */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-white font-bold">
                <Settings2 className="w-5 h-5 text-indigo-400" />
                <h3>Configuração da Chave Pix</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConfigModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="space-y-4">
              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">
                  Tipo de Chave Pix
                </label>
                <select
                  value={editingConfig.tipoChave}
                  onChange={e =>
                    setEditingConfig(prev => ({
                      ...prev,
                      tipoChave: e.target.value as PixConfig['tipoChave'],
                    }))
                  }
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
                >
                  <option value="email">E-mail</option>
                  <option value="cnpj">CNPJ</option>
                  <option value="cpf">CPF</option>
                  <option value="telefone">Telefone</option>
                  <option value="aleatoria">Chave Aleatória (EVP)</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">
                  Chave Pix Receptora
                </label>
                <Input
                  required
                  value={editingConfig.chave}
                  onChange={e => setEditingConfig(prev => ({ ...prev, chave: e.target.value }))}
                  placeholder="Ex: financeiro@spartan3d.com.br ou CNPJ"
                  className="bg-slate-950 border-slate-700 text-white rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">
                  Nome do Titular / Beneficiário
                </label>
                <Input
                  required
                  maxLength={25}
                  value={editingConfig.nomeTitular}
                  onChange={e => setEditingConfig(prev => ({ ...prev, nomeTitular: e.target.value }))}
                  placeholder="SPARTAN 3D PRINT"
                  className="bg-slate-950 border-slate-700 text-white rounded-xl text-xs uppercase"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">
                  Cidade do Titular (Padrão Bacen)
                </label>
                <Input
                  required
                  maxLength={15}
                  value={editingConfig.cidade}
                  onChange={e => setEditingConfig(prev => ({ ...prev, cidade: e.target.value }))}
                  placeholder="SAO PAULO"
                  className="bg-slate-950 border-slate-700 text-white rounded-xl text-xs uppercase"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowConfigModal(false)}
                  className="border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={savingConfig}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold"
                >
                  {savingConfig ? 'Salvando na Nuvem...' : 'Salvar Chave Pix'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Nova Cobrança Pix */}
      {showNewChargeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-white font-bold">
                <QrCode className="w-5 h-5 text-emerald-400" />
                <h3>Gerar Nova Cobrança Pix</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNewChargeModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateCharge} className="space-y-4">
              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">
                  Cliente / Assinante
                </label>
                <select
                  required
                  value={selectedClientId}
                  onChange={e => handleClientChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
                >
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.companyName ? `(${c.companyName})` : ''} - {c.email}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">
                  Valor da Cobrança (R$)
                </label>
                <Input
                  required
                  type="number"
                  min="1"
                  step="0.01"
                  value={chargeAmount}
                  onChange={e => setChargeAmount(e.target.value)}
                  placeholder="Ex: 150.00"
                  className="bg-slate-950 border-slate-700 text-white rounded-xl text-xs font-semibold"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">
                  Data de Vencimento
                </label>
                <Input
                  required
                  type="date"
                  value={chargeDueDate}
                  onChange={e => setChargeDueDate(e.target.value)}
                  className="bg-slate-950 border-slate-700 text-white rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 font-medium block mb-1">
                  Descrição da Cobrança
                </label>
                <Input
                  required
                  maxLength={40}
                  value={chargeDescription}
                  onChange={e => setChargeDescription(e.target.value)}
                  placeholder="Mensalidade Assinatura Spartan 3D"
                  className="bg-slate-950 border-slate-700 text-white rounded-xl text-xs"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowNewChargeModal(false)}
                  className="border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={creatingCharge}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold"
                >
                  <QrCode className="w-3.5 h-3.5 mr-1.5" />
                  {creatingCharge ? 'Gerando Pix...' : 'Gerar Cobrança Pix'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Visualização Pix (QR Code + Copia e Cola) */}
      {activePixModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
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
                <span className="font-bold text-white">{activePixModal.invoice.clientName}</span>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block text-[11px]">Valor:</span>
                <span className="font-extrabold text-emerald-400 text-sm">
                  R$ {activePixModal.invoice.amount.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Chave Pix de Destino */}
            <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-2.5 px-3 flex items-center justify-between text-[11px]">
              <div className="min-w-0">
                <span className="text-slate-400 block text-[10px]">Chave Pix Receptora:</span>
                <span className="font-mono text-cyan-300 font-semibold truncate block">
                  {pixConfig.chave || 'Chave não cadastrada'}
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditingConfig(pixConfig);
                  setShowConfigModal(true);
                }}
                className="h-6 px-2 text-[10px] text-slate-400 hover:text-white shrink-0 ml-2"
                title="Alterar Chave Pix nas configurações"
              >
                <Settings2 className="w-3 h-3 mr-1 text-indigo-400" />
                Alterar Chave
              </Button>
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

            {/* Ações: WhatsApp e Baixa */}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <Button
                size="sm"
                onClick={() =>
                  handleShareWhatsApp(
                    activePixModal.invoice,
                    activePixModal.pixPayload,
                    activePixModal.invoice.clientName
                  )
                }
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl h-9 text-xs"
              >
                <Send className="w-3.5 h-3.5 mr-1.5" />
                Enviar Cobrança no WhatsApp do Cliente
              </Button>

              {activePixModal.invoice.status === 'pending' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleConfirmPayment(activePixModal.invoice.id)}
                  className="w-full border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-xl h-9 text-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                  Confirmar Recebimento / Dar Baixa Agora
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Comprovante / Recibo Digital */}
      {receiptModalInvoice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 print:p-0 print:bg-white"
          onClick={e => {
            if (e.target === e.currentTarget) setReceiptModalInvoice(null);
          }}
        >
          <div className="w-full max-w-lg bg-slate-900 border border-emerald-500/40 rounded-2xl shadow-2xl p-6 space-y-4 print:border-none print:shadow-none print:bg-white print:text-black">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3 print:border-black">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0 print:border-black print:text-black">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white print:text-black">
                    Recibo de Quitação
                  </h3>
                  <p className="text-xs text-slate-400 print:text-black">
                    Spartan 3D Farm • Comprovante Oficial
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReceiptModalInvoice(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg print:hidden"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs print:bg-white print:border-black print:text-black">
              <div className="flex justify-between items-center border-b border-slate-800/80 pb-2 print:border-black">
                <span className="text-slate-400 print:text-black">Fatura:</span>
                <span className="font-mono font-bold text-white print:text-black">{receiptModalInvoice.id}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-800/80 pb-2 print:border-black">
                <span className="text-slate-400 print:text-black">Cliente:</span>
                <span className="font-bold text-white print:text-black">{receiptModalInvoice.clientName}</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-800/80 pb-2 print:border-black">
                <span className="text-slate-400 print:text-black">Valor Pago:</span>
                <span className="text-sm font-bold text-emerald-400 print:text-black">
                  R$ {receiptModalInvoice.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-800/80 pb-2 print:border-black">
                <span className="text-slate-400 print:text-black">Forma de Pagamento:</span>
                <span className="font-medium text-slate-200 print:text-black">Pix Instantâneo</span>
              </div>
              <div className="flex justify-between items-center border-b border-slate-800/80 pb-2 print:border-black">
                <span className="text-slate-400 print:text-black">Data da Liquidação:</span>
                <span className="font-medium text-slate-200 print:text-black">
                  {receiptModalInvoice.paidAt ? new Date(receiptModalInvoice.paidAt).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR')}
                </span>
              </div>
              <div className="flex justify-between items-center pt-1">
                <span className="text-slate-400 print:text-black">Status:</span>
                <span className="inline-flex items-center gap-1 text-emerald-400 font-bold bg-emerald-500/15 px-2 py-0.5 rounded-full text-[11px] print:border print:border-black">
                  <CheckCircle2 className="w-3.5 h-3.5" /> LIQUIDADO
                </span>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 space-y-1 bg-slate-950/50 p-3 rounded-lg border border-slate-800/60 print:bg-white print:border-black print:text-black">
              <p>• <strong>Beneficiário:</strong> {pixConfig.nomeTitular || 'Spartan 3D Farm'}</p>
              <p>• <strong>Chave Pix:</strong> {pixConfig.chave || 'Não informada'}</p>
              <p className="text-[10px] text-slate-500 print:text-black">Este recibo comprova a quitação integral do valor indicado para os serviços da plataforma Spartan 3D.</p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-3 border-t border-slate-800 print:hidden">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setReceiptModalInvoice(null)}
                className="border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs"
              >
                Fechar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handleCopyReceipt(receiptModalInvoice)}
                className="border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold"
              >
                {copiedReceipt ? (
                  <>
                    <Check className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
                    Copiado!
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 mr-1.5" />
                    Copiar WhatsApp
                  </>
                )}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => window.print()}
                className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold"
              >
                <Printer className="w-3.5 h-3.5 mr-1.5" />
                Imprimir / Salvar PDF
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
