"use client";

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Plus, QrCode, CheckCircle2, Clock, User, Lock, Unlock, Ban, Trash2,
  AlertTriangle, Loader2, MessageCircle, Calendar, X, CheckSquare, Search,
  RotateCcw, SlidersHorizontal, Download
} from 'lucide-react';
import { toast } from 'sonner';
import { useSaaSData } from '@/context/SaaSDataContext';
import { User as SaaSUser } from '@/types/saas';
import { normalizeWhatsAppPhone, formatTrialEndingWhatsAppMessage, formatInvoiceDueWhatsAppMessage } from '@/services/whatsappService';

interface AdminClientsTableProps {
  onOpenNewClientModal: () => void;
}

export const AdminClientsTable: React.FC<AdminClientsTableProps> = ({ onOpenNewClientModal }) => {
  const {
    clients,
    updateClientStatus,
    updateClientValidity,
    updateMultipleClientsValidity,
    updateMultipleClientsStatus,
    deleteClient,
    createInvoice,
    plans,
    invoices
  } = useSaaSData();

  const [clientToDelete, setClientToDelete] = useState<SaaSUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Filtros rápidos por status
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'overdue' | 'trialing' | 'canceled'>('all');

  // Filtros temporais: Dia, Mês, Ano e Busca
  const [filterYear, setFilterYear] = useState<string>('all');
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterDayPreset, setFilterDayPreset] = useState<'all' | 'today' | 'next3' | 'next7' | 'this_month' | 'custom'>('all');
  const [customDay, setCustomDay] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Seleção múltipla / Selecionar Todos
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);

  // Modal individual de vigência (Dia, Mês e Ano)
  const [clientToEditValidity, setClientToEditValidity] = useState<SaaSUser | null>(null);
  const [targetDate, setTargetDate] = useState<string>('');
  const [targetStatus, setTargetStatus] = useState<SaaSUser['status']>('trialing');
  const [savingValidity, setSavingValidity] = useState(false);

  // Modal em lote de vigência
  const [bulkValidityOpen, setBulkValidityOpen] = useState(false);
  const [bulkTargetDate, setBulkTargetDate] = useState<string>('');
  const [bulkTargetStatus, setBulkTargetStatus] = useState<SaaSUser['status'] | 'keep'>('keep');
  const [savingBulk, setSavingBulk] = useState(false);

  // Helper para obter a data efetiva de validade/vencimento
  const getClientValidityDate = (client: SaaSUser): Date | null => {
    if (client.trialEndsAt) return new Date(client.trialEndsAt);
    if (client.joinedAt) {
      const d = new Date(client.joinedAt);
      d.setDate(d.getDate() + 14);
      return d;
    }
    return null;
  };

  // Contadores de status para as abas
  const statusCounts = useMemo(() => ({
    all: clients.length,
    active: clients.filter(c => c.status === 'active').length,
    overdue: clients.filter(c => c.status === 'overdue').length,
    trialing: clients.filter(c => c.status === 'trialing').length,
    canceled: clients.filter(c => c.status === 'canceled').length,
  }), [clients]);

  // Anos disponíveis para o filtro
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    const currentYear = new Date().getFullYear();
    years.add((currentYear - 1).toString());
    years.add(currentYear.toString());
    years.add((currentYear + 1).toString());

    clients.forEach(c => {
      const vDate = getClientValidityDate(c);
      if (vDate) years.add(vDate.getFullYear().toString());
    });

    return Array.from(years).sort();
  }, [clients]);

  // Lista filtrada de clientes
  const filteredClients = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfToday = startOfToday + 86400000;

    return clients.filter(client => {
      // 1. Filtro de Status
      if (statusFilter !== 'all' && client.status !== statusFilter) {
        return false;
      }

      // 2. Busca por texto
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const nameMatch = client.name?.toLowerCase().includes(q);
        const emailMatch = client.email?.toLowerCase().includes(q);
        const companyMatch = client.companyName?.toLowerCase().includes(q);
        if (!nameMatch && !emailMatch && !companyMatch) return false;
      }

      // 3. Filtros Temporais (Ano, Mês, Dia)
      const vDate = getClientValidityDate(client);

      if (filterYear !== 'all') {
        if (!vDate || vDate.getFullYear().toString() !== filterYear) return false;
      }

      if (filterMonth !== 'all') {
        if (!vDate) return false;
        const monthStr = String(vDate.getMonth() + 1).padStart(2, '0');
        if (monthStr !== filterMonth) return false;
      }

      if (filterDayPreset !== 'all') {
        if (!vDate) return false;
        const valMs = vDate.getTime();

        if (filterDayPreset === 'today') {
          if (valMs < startOfToday || valMs >= endOfToday) return false;
        } else if (filterDayPreset === 'next3') {
          const next3End = startOfToday + 3 * 86400000;
          if (valMs < startOfToday || valMs > next3End) return false;
        } else if (filterDayPreset === 'next7') {
          const next7End = startOfToday + 7 * 86400000;
          if (valMs < startOfToday || valMs > next7End) return false;
        } else if (filterDayPreset === 'this_month') {
          if (vDate.getFullYear() !== now.getFullYear() || vDate.getMonth() !== now.getMonth()) {
            return false;
          }
        } else if (filterDayPreset === 'custom' && customDay) {
          const valYmd = `${vDate.getFullYear()}-${String(vDate.getMonth() + 1).padStart(2, '0')}-${String(vDate.getDate()).padStart(2, '0')}`;
          if (valYmd !== customDay) return false;
        }
      }

      return true;
    });
  }, [clients, statusFilter, searchQuery, filterYear, filterMonth, filterDayPreset, customDay]);

  const hasActiveFilters = statusFilter !== 'all' || filterYear !== 'all' || filterMonth !== 'all' || filterDayPreset !== 'all' || customDay !== '' || searchQuery.trim() !== '';

  const handleClearFilters = () => {
    setStatusFilter('all');
    setFilterYear('all');
    setFilterMonth('all');
    setFilterDayPreset('all');
    setCustomDay('');
    setSearchQuery('');
  };

  // Selecionar Todos / Alternar Seleção
  const isAllFilteredSelected = filteredClients.length > 0 && filteredClients.every(c => selectedClientIds.includes(c.id));

  const handleToggleSelectAll = () => {
    if (isAllFilteredSelected) {
      const filteredIdSet = new Set(filteredClients.map(c => c.id));
      setSelectedClientIds(prev => prev.filter(id => !filteredIdSet.has(id)));
    } else {
      const newSelected = Array.from(new Set([...selectedClientIds, ...filteredClients.map(c => c.id)]));
      setSelectedClientIds(newSelected);
    }
  };

  const handleToggleSelectClient = (clientId: string) => {
    setSelectedClientIds(prev =>
      prev.includes(clientId) ? prev.filter(id => id !== clientId) : [...prev, clientId]
    );
  };

  // Ações em Lote
  const handleBulkStatusChange = async (newStatus: SaaSUser['status']) => {
    if (selectedClientIds.length === 0) return;
    await updateMultipleClientsStatus(selectedClientIds, newStatus);
    setSelectedClientIds([]);
  };

  const handleOpenBulkValidityModal = () => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    setBulkTargetDate(d.toISOString().slice(0, 10));
    setBulkTargetStatus('keep');
    setBulkValidityOpen(true);
  };

  const handleSaveBulkValidity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedClientIds.length === 0 || !bulkTargetDate) return;
    setSavingBulk(true);
    try {
      const isoString = new Date(`${bulkTargetDate}T23:59:59`).toISOString();
      const statusToApply = bulkTargetStatus === 'keep' ? undefined : bulkTargetStatus;
      await updateMultipleClientsValidity(selectedClientIds, isoString, statusToApply);
      setBulkValidityOpen(false);
      setSelectedClientIds([]);
    } finally {
      setSavingBulk(false);
    }
  };

  // Ações individuais
  const handleOpenValidityModal = (client: SaaSUser) => {
    setClientToEditValidity(client);
    setTargetStatus(client.status);
    if (client.trialEndsAt) {
      setTargetDate(new Date(client.trialEndsAt).toISOString().slice(0, 10));
    } else {
      const d = new Date(client.joinedAt || Date.now());
      d.setDate(d.getDate() + 14);
      setTargetDate(d.toISOString().slice(0, 10));
    }
  };

  const applyQuickDays = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    setTargetDate(d.toISOString().slice(0, 10));
  };

  const applyEndOfCurrentMonth = () => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setTargetDate(lastDay.toISOString().slice(0, 10));
  };

  const handleSaveValidity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientToEditValidity || !targetDate) return;
    setSavingValidity(true);
    try {
      const isoString = new Date(`${targetDate}T23:59:59`).toISOString();
      await updateClientValidity(clientToEditValidity.id, isoString, targetStatus);
      setClientToEditValidity(null);
    } finally {
      setSavingValidity(false);
    }
  };

  // Clientes com período de teste encerrando em até 3 dias (ou hoje)
  const expiringTrials = clients.filter(c => {
    if (c.status !== 'trialing') return false;
    const vDate = getClientValidityDate(c);
    const trialEndMs = vDate ? vDate.getTime() : Date.now();
    const remainingDays = Math.max(0, Math.ceil((trialEndMs - Date.now()) / (24 * 60 * 60 * 1000)));
    return remainingDays <= 3;
  });

  // Faturas pendentes no mês corrente
  const pendingInvoices = invoices.filter(inv => inv.status === 'pending');

  const handleConfirmDelete = async () => {
    if (!clientToDelete) return;
    setDeleting(true);
    try {
      const ok = await deleteClient(clientToDelete.id);
      if (ok) {
        setClientToDelete(null);
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleExportCsv = () => {
    if (filteredClients.length === 0) {
      toast.error('Nenhum cliente disponível para exportação com os filtros atuais.');
      return;
    }

    const headers = ['ID', 'Nome', 'Empresa / Farm', 'E-mail', 'WhatsApp', 'Plano', 'MRR (R$)', 'Status', 'Data Cadastro', 'Vigência / Validade'];
    const rows = filteredClients.map(c => {
      const vDate = getClientValidityDate(c);
      const vDateFormatted = vDate ? vDate.toLocaleDateString('pt-BR') : 'Padrão (14d)';
      const joinedFormatted = c.joinedAt ? new Date(c.joinedAt).toLocaleDateString('pt-BR') : '';
      const planName = c.planId === 'plan_enterprise' ? 'Enterprise VIP' : c.planId === 'plan_starter' ? 'Starter Booster' : 'Pro Scaler';

      return [
        `"${c.id}"`,
        `"${(c.name || '').replace(/"/g, '""')}"`,
        `"${(c.companyName || '').replace(/"/g, '""')}"`,
        `"${(c.email || '').replace(/"/g, '""')}"`,
        `"${(c.companyPhone || '').replace(/"/g, '""')}"`,
        `"${planName}"`,
        `"${c.mrr || 0}"`,
        `"${c.status}"`,
        `"${joinedFormatted}"`,
        `"${vDateFormatted}"`,
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const now = new Date();
    const dateStamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    link.setAttribute('download', `clientes_spartan3d_${dateStamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success(`${filteredClients.length} cliente(s) exportado(s) para CSV com sucesso!`);
  };

  return (
    <>
      {/* Central de Vencimentos & Notificações para o Administrador */}
      {(expiringTrials.length > 0 || pendingInvoices.length > 0) && (
        <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Alerta de Testes Grátis Encerrando */}
          {expiringTrials.length > 0 && (
            <Card className="bg-slate-900/90 border-amber-500/40 rounded-2xl shadow-xl overflow-hidden">
              <CardHeader className="bg-amber-500/10 border-b border-amber-500/20 py-3 px-4 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-400" />
                  <CardTitle className="text-xs font-bold text-amber-300 uppercase tracking-wide">
                    Testes Grátis Vencendo ({expiringTrials.length})
                  </CardTitle>
                </div>
                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px]">
                  ≤ 3 dias restantes
                </Badge>
              </CardHeader>
              <CardContent className="p-3 space-y-2">
                {expiringTrials.map(client => {
                  const joinedMs = client.joinedAt ? new Date(client.joinedAt).getTime() : Date.now();
                  const elapsedDays = Math.floor((Date.now() - joinedMs) / (24 * 60 * 60 * 1000));
                  const remainingDays = Math.max(0, 14 - elapsedDays);

                  return (
                    <div
                      key={`alert-trial-${client.id}`}
                      className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-white truncate">{client.name}</p>
                        <p className="text-[11px] text-slate-400 truncate">
                          {client.companyName || 'Farm 3D'} • <span className="text-amber-400 font-semibold">{remainingDays === 0 ? 'Encerra hoje' : `${remainingDays} dia(s) restante(s)`}</span>
                        </p>
                      </div>

                      {client.companyPhone && (
                        <Button
                          size="sm"
                          asChild
                          className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-semibold shrink-0 shadow-sm"
                        >
                          <a
                            href={`https://wa.me/${normalizeWhatsAppPhone(client.companyPhone)}?text=${encodeURIComponent(
                              formatTrialEndingWhatsAppMessage(client.name, client.companyName || '', remainingDays)
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Lembrar cliente via WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5 mr-1" />
                            Avisar WhatsApp
                          </a>
                        </Button>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}

          {/* Alerta de Faturas Pendentes no Mês Corrente */}
          {pendingInvoices.length > 0 && (
            <Card className="bg-slate-900/90 border-indigo-500/40 rounded-2xl shadow-xl overflow-hidden">
              <CardHeader className="bg-indigo-500/10 border-b border-indigo-500/20 py-3 px-4 flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-400" />
                  <CardTitle className="text-xs font-bold text-indigo-300 uppercase tracking-wide">
                    Faturas a Vencer no Mês ({pendingInvoices.length})
                  </CardTitle>
                </div>
                <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 text-[10px]">
                  Aguardando Pagamento
                </Badge>
              </CardHeader>
              <CardContent className="p-3 space-y-2">
                {pendingInvoices.slice(0, 4).map(inv => {
                  const client = clients.find(c => c.id === inv.clientId);
                  const dataFormatada = inv.dueDate ? new Date(`${inv.dueDate}T00:00:00`).toLocaleDateString('pt-BR') : 'Sem data';

                  return (
                    <div
                      key={`alert-inv-${inv.id}`}
                      className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-white truncate">{inv.clientName}</p>
                        <p className="text-[11px] text-slate-400 truncate">
                          Vence em <strong className="text-white">{dataFormatada}</strong> • <span className="text-emerald-400 font-bold">R$ {inv.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                        </p>
                      </div>

                      {client?.companyPhone && (
                        <Button
                          size="sm"
                          asChild
                          className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-semibold shrink-0 shadow-sm"
                        >
                          <a
                            href={`https://wa.me/${normalizeWhatsAppPhone(client.companyPhone)}?text=${encodeURIComponent(
                              formatInvoiceDueWhatsAppMessage(inv.clientName, client.companyName || '', inv.amount, inv.dueDate)
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Cobrar cliente via WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5 mr-1" />
                            Cobrar WhatsApp
                          </a>
                        </Button>
                      )}
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Card className="bg-slate-900 border-slate-800 rounded-2xl">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base text-white font-bold">Clientes & Assinantes</CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Gerencie acessos, faturas, bloqueios e exclusão completa de cada assinante em tempo real
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handleExportCsv}
              size="sm"
              variant="outline"
              className="border-slate-700 bg-slate-950 text-slate-300 hover:text-white hover:bg-slate-800 rounded-xl text-xs font-medium"
              title="Exportar lista filtrada para planilha CSV"
            >
              <Download className="w-4 h-4 mr-1 text-slate-400" />
              Exportar CSV
            </Button>
            <Button
              onClick={onOpenNewClientModal}
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold"
            >
              <Plus className="w-4 h-4 mr-1" />
              Novo Cliente
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-4 sm:p-5 space-y-4">
          {/* Abas de Filtro por Status: Todos, Ativos, Pendentes, Teste Grátis, Cancelados */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  statusFilter === 'all'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <span>Todos</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  statusFilter === 'all' ? 'bg-indigo-800/80 text-white' : 'bg-slate-800 text-slate-400'
                }`}>
                  {statusCounts.all}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  statusFilter === 'active'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" />
                <span>Ativos</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  statusFilter === 'active' ? 'bg-emerald-800/80 text-white' : 'bg-slate-800 text-slate-400'
                }`}>
                  {statusCounts.active}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('overdue')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  statusFilter === 'overdue'
                    ? 'bg-rose-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Lock className="w-3.5 h-3.5 text-rose-300" />
                <span>Pendentes</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  statusFilter === 'overdue' ? 'bg-rose-800/80 text-white' : 'bg-slate-800 text-slate-400'
                }`}>
                  {statusCounts.overdue}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('trialing')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  statusFilter === 'trialing'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Clock className="w-3.5 h-3.5 text-amber-300" />
                <span>Teste Grátis</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  statusFilter === 'trialing' ? 'bg-amber-800/80 text-white' : 'bg-slate-800 text-slate-400'
                }`}>
                  {statusCounts.trialing}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setStatusFilter('canceled')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  statusFilter === 'canceled'
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Ban className="w-3.5 h-3.5 text-slate-400" />
                <span>Cancelados</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  statusFilter === 'canceled' ? 'bg-slate-800 text-white' : 'bg-slate-800 text-slate-400'
                }`}>
                  {statusCounts.canceled}
                </span>
              </button>
            </div>

            <div className="text-[11px] text-slate-400">
              Exibindo <strong className="text-white">{filteredClients.length}</strong> de <strong className="text-white">{clients.length}</strong> clientes
            </div>
          </div>

          {/* Barra de Filtros Temporais (Dia, Mês, Ano) & Busca */}
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 flex flex-wrap items-center gap-2.5 text-xs">
            {/* Campo de Busca */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <Input
                type="text"
                placeholder="Buscar por cliente, estúdio ou e-mail..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-8 h-8 text-xs bg-slate-900 border-slate-700 text-white placeholder:text-slate-500 rounded-lg w-full"
              />
            </div>

            {/* Filtro por Ano */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400 font-medium">Ano:</span>
              <select
                value={filterYear}
                onChange={e => setFilterYear(e.target.value)}
                className="h-8 bg-slate-900 border border-slate-700 rounded-lg px-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="all">Todos os Anos</option>
                {availableYears.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>

            {/* Filtro por Mês */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400 font-medium">Mês:</span>
              <select
                value={filterMonth}
                onChange={e => setFilterMonth(e.target.value)}
                className="h-8 bg-slate-900 border border-slate-700 rounded-lg px-2 text-xs text-white focus:outline-none focus:border-cyan-500"
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

            {/* Filtro por Dia / Vencimento */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400 font-medium">Dia:</span>
              <select
                value={filterDayPreset}
                onChange={e => setFilterDayPreset(e.target.value as any)}
                className="h-8 bg-slate-900 border border-slate-700 rounded-lg px-2 text-xs text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="all">Qualquer dia</option>
                <option value="today">Vence Hoje</option>
                <option value="next3">Próximos 3 dias</option>
                <option value="next7">Próximos 7 dias</option>
                <option value="this_month">Este Mês</option>
                <option value="custom">Dia Específico...</option>
              </select>
            </div>

            {/* Seletor quando 'custom' */}
            {filterDayPreset === 'custom' && (
              <Input
                type="date"
                value={customDay}
                onChange={e => setCustomDay(e.target.value)}
                className="h-8 w-36 text-xs bg-slate-900 border-slate-700 text-white [color-scheme:dark] rounded-lg"
              />
            )}

            {/* Botão Limpar Filtros */}
            {hasActiveFilters && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={handleClearFilters}
                className="h-8 px-2 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-lg"
                title="Limpar todos os filtros ativos"
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                Limpar
              </Button>
            )}
          </div>

          {/* Barra de Ações em Lote para Selecionados */}
          {selectedClientIds.length > 0 && (
            <div className="p-3 bg-gradient-to-r from-indigo-950/90 via-slate-900 to-cyan-950/90 border border-cyan-500/40 rounded-xl flex flex-wrap items-center justify-between gap-3 shadow-lg">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-cyan-400" />
                <span className="text-xs font-bold text-white">
                  {selectedClientIds.length} cliente{selectedClientIds.length > 1 ? 's' : ''} selecionado{selectedClientIds.length > 1 ? 's' : ''}
                </span>
                <span className="text-[11px] text-slate-400">
                  (de {filteredClients.length} filtrados)
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleOpenBulkValidityModal}
                  className="h-7 px-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-semibold shadow-sm"
                  title="Alterar Dia, Mês e Ano de vigência para todos os selecionados"
                >
                  <Calendar className="w-3.5 h-3.5 mr-1.5" />
                  Definir Vigência (Dia/Mês/Ano)
                </Button>

                <Button
                  size="sm"
                  onClick={() => void handleBulkStatusChange('active')}
                  className="h-7 px-2.5 bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 rounded-lg text-xs font-semibold"
                  title="Mudar status de todos os selecionados para Ativo"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                  Ativar
                </Button>

                <Button
                  size="sm"
                  onClick={() => void handleBulkStatusChange('overdue')}
                  className="h-7 px-2.5 bg-amber-600/30 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/40 rounded-lg text-xs font-semibold"
                  title="Bloquear ou marcar selecionados como atrasados"
                >
                  <Lock className="w-3.5 h-3.5 mr-1" />
                  Bloquear / Pendente
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedClientIds([])}
                  className="h-7 px-2 text-xs text-slate-400 hover:text-white"
                >
                  Desmarcar Todos
                </Button>
              </div>
            </div>
          )}

          {/* Tabela de Clientes */}
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      aria-label="Selecionar todos os clientes filtrados"
                      checked={isAllFilteredSelected}
                      onChange={handleToggleSelectAll}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-cyan-600 focus:ring-cyan-500 cursor-pointer accent-cyan-500"
                    />
                  </th>
                  <th className="py-3 px-4">Cliente & Contato</th>
                  <th className="py-3 px-3">Plano & MRR</th>
                  <th className="py-3 px-3">Status & Vigência</th>
                  <th className="py-3 px-4 text-right">Ações Rápidas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {filteredClients.map(client => {
                  const isSelected = selectedClientIds.includes(client.id);
                  const vDate = getClientValidityDate(client);
                  const vDateFormatted = vDate ? vDate.toLocaleDateString('pt-BR') : null;

                  return (
                    <tr
                      key={client.id}
                      className={`hover:bg-slate-800/30 transition-colors ${
                        isSelected ? 'bg-indigo-950/25' : ''
                      }`}
                    >
                      <td className="py-3 px-3 text-center align-middle">
                        <input
                          type="checkbox"
                          aria-label={`Selecionar ${client.name}`}
                          checked={isSelected}
                          onChange={() => handleToggleSelectClient(client.id)}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-cyan-600 focus:ring-cyan-500 cursor-pointer accent-cyan-500"
                        />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          {client.avatar ? (
                            <img
                              src={client.avatar}
                              alt={client.name}
                              className="w-8 h-8 rounded-full object-cover shrink-0 ring-1 ring-slate-700"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 shrink-0 ring-1 ring-slate-700">
                              <User className="w-4 h-4" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-white text-sm truncate">{client.name}</p>
                              {client.joinedAt && (
                                <span className="text-[10px] text-slate-500 font-normal shrink-0">
                                  desde {new Date(client.joinedAt).toLocaleDateString('pt-BR')}
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 truncate">
                              {client.companyName ? `${client.companyName} • ${client.email}` : client.email}
                            </p>
                            {client.companyPhone && (
                              <div className="mt-1">
                                <a
                                  href={`https://wa.me/${normalizeWhatsAppPhone(client.companyPhone)}?text=${encodeURIComponent(`Olá, ${client.name}! Aqui é a equipe da Spartan 3D Farm.`)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:text-emerald-300 font-medium hover:underline"
                                  title="Conversar no WhatsApp com o cliente"
                                >
                                  <MessageCircle className="w-3 h-3 text-emerald-400" />
                                  <span>{client.companyPhone}</span>
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <Badge variant="outline" className="border-indigo-500/40 text-indigo-300 bg-indigo-500/10 font-semibold text-[11px]">
                          {client.planId === 'plan_enterprise'
                            ? 'Enterprise VIP'
                            : client.planId === 'plan_starter'
                            ? 'Starter Booster'
                            : 'Pro Scaler'}
                        </Badge>
                        <p className="text-white font-bold text-xs mt-1">
                          R$ {client.mrr || 0}
                          <span className="text-[10px] text-slate-400 font-normal ml-0.5">/mês</span>
                        </p>
                      </td>
                      <td className="py-3 px-3">
                        {client.status === 'trialing' && (() => {
                          const trialEndMs = vDate ? vDate.getTime() : Date.now();
                          const remainingDays = Math.max(0, Math.ceil((trialEndMs - Date.now()) / (24 * 60 * 60 * 1000)));
                          return (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full font-semibold text-[11px]">
                                <Clock className="w-3 h-3" /> Teste Grátis ({remainingDays}d restantes)
                              </span>
                              <p className="text-[11px] text-slate-400">
                                Término em <strong className="text-white">{vDateFormatted || '—'}</strong>
                              </p>
                            </div>
                          );
                        })()}
                        {client.status === 'active' && (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-semibold text-[11px]">
                              <CheckCircle2 className="w-3 h-3" /> Ativo
                            </span>
                            <p className="text-[11px] text-slate-400">
                              {vDateFormatted ? (
                                <>Válido até <strong className="text-white">{vDateFormatted}</strong></>
                              ) : (
                                'Renovação contínua'
                              )}
                            </p>
                          </div>
                        )}
                        {client.status === 'overdue' && (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 text-rose-400 bg-rose-500/15 border border-rose-500/30 px-2.5 py-0.5 rounded-full font-bold text-[11px]">
                              <Lock className="w-3 h-3 text-rose-400" /> Atrasado (Bloqueado)
                            </span>
                            <p className="text-[11px] text-rose-300/80">
                              Venceu em <strong className="text-rose-200">{vDateFormatted || '—'}</strong>
                            </p>
                          </div>
                        )}
                        {client.status === 'canceled' && (
                          <div className="space-y-1">
                            <span className="inline-flex items-center gap-1 text-slate-400 bg-slate-800 border border-slate-700 px-2.5 py-0.5 rounded-full font-semibold text-[11px]">
                              <Ban className="w-3 h-3" /> Cancelado
                            </span>
                            <p className="text-[11px] text-slate-500">Acesso encerrado</p>
                          </div>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleOpenValidityModal(client)}
                          className="h-7 px-2.5 text-[11px] bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 rounded-lg border border-cyan-500/30 font-medium"
                          title="Definir dia, mês e ano de vigência / renovação"
                        >
                          <Calendar className="w-3 h-3 mr-1 text-cyan-400" />
                          Vigência
                        </Button>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => createInvoice(client.id, plans.find(plan => plan.id === client.planId)?.priceMonthly || 0, 'pix')}
                          className="h-7 px-2 text-[11px] bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-lg border border-slate-700"
                          title="Gerar cobrança Pix para o cliente"
                        >
                          <QrCode className="w-3 h-3 mr-1" />
                          Pix
                        </Button>

                        {client.companyPhone && (
                          <Button
                            size="sm"
                            variant="ghost"
                            asChild
                            className="h-7 px-2 text-[11px] bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 rounded-lg border border-emerald-500/20"
                            title="Conversar com o cliente no WhatsApp"
                          >
                            <a
                              href={`https://wa.me/${normalizeWhatsAppPhone(client.companyPhone)}?text=${encodeURIComponent(`Olá, ${client.name}! Aqui é da equipe Spartan 3D.`)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <MessageCircle className="w-3 h-3 text-emerald-400" />
                              <span className="hidden xl:inline ml-1">WhatsApp</span>
                            </a>
                          </Button>
                        )}

                        {client.status === 'trialing' && (
                          <Button
                            size="sm"
                            onClick={() => updateClientStatus(client.id, 'active')}
                            className="h-7 px-2 text-[11px] bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 rounded-lg font-semibold transition-all"
                            title="Ativar assinatura definitiva após pagamento"
                          >
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            Ativar
                          </Button>
                        )}

                        {client.status === 'overdue' ? (
                          <Button
                            size="sm"
                            onClick={() => updateClientStatus(client.id, 'active')}
                            className="h-7 px-2 text-[11px] bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 rounded-lg font-semibold transition-all"
                            title="Liberar e ativar acesso do cliente imediatamente após pagamento"
                          >
                            <Unlock className="w-3 h-3 mr-1" />
                            Desbloquear
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => updateClientStatus(client.id, 'overdue')}
                            className="h-7 px-2 text-[11px] bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/40 rounded-lg font-semibold transition-all"
                            title="Alterar para atrasado e bloquear o acesso imediato do cliente"
                          >
                            <Lock className="w-3 h-3 mr-1" />
                            Bloquear
                          </Button>
                        )}

                        <Button
                          size="sm"
                          onClick={() => setClientToDelete(client)}
                          className="h-7 px-2 text-[11px] bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/40 rounded-lg font-semibold transition-all"
                          title="Excluir usuário e apagar todos os seus dados no Supabase"
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Excluir
                        </Button>
                      </td>
                    </tr>
                  );
                })}

                {filteredClients.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      <div className="max-w-xs mx-auto space-y-2">
                        <p className="font-semibold text-slate-300 text-sm">Nenhum cliente encontrado</p>
                        <p className="text-xs text-slate-500">
                          Nenhum registro corresponde aos filtros selecionados.
                        </p>
                        {hasActiveFilters && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleClearFilters}
                            className="mt-2 border-slate-700 text-slate-300 hover:text-white text-xs rounded-xl"
                          >
                            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                            Limpar Filtros
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Confirmação de Exclusão Total */}
      {clientToDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={e => {
            if (e.target === e.currentTarget && !deleting) setClientToDelete(null);
          }}
        >
          <div className="w-full max-w-md bg-slate-900 border border-rose-500/40 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  Excluir Usuário Permanentemente?
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Esta ação apagará 100% dos dados deste cliente no Supabase.
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1 text-xs">
              <p className="text-slate-300">
                <strong className="text-white">Cliente:</strong> {clientToDelete.name}
              </p>
              {clientToDelete.companyName && (
                <p className="text-slate-300">
                  <strong className="text-white">Estúdio / Farm:</strong> {clientToDelete.companyName}
                </p>
              )}
              <p className="text-slate-300">
                <strong className="text-white">E-mail:</strong> {clientToDelete.email}
              </p>
            </div>

            <div className="text-[11px] text-slate-400 space-y-1 leading-relaxed">
              <p>• Todos os projetos, filamentos, impressoras, faturas, chaves Pix e arquivos serão removidos.</p>
              <p className="text-emerald-400">
                • O e-mail <strong>{clientToDelete.email}</strong> ficará livre caso o cliente queira criar uma nova conta do zero no futuro.
              </p>
              <p className="text-amber-400">
                • Caso ele se cadastre novamente com este e-mail, <strong>não terá direito a novos 14 dias grátis</strong> (entrará bloqueado até ativação pelo Admin).
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <Button
                type="button"
                variant="outline"
                disabled={deleting}
                onClick={() => setClientToDelete(null)}
                className="border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs"
              >
                Cancelar
              </Button>
              <Button
                type="button"
                disabled={deleting}
                onClick={() => void handleConfirmDelete()}
                className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold"
              >
                {deleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Excluindo tudo...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                    Sim, Excluir Tudo
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Controle de Dia, Mês e Ano (Vigência / Vencimento) */}
      {clientToEditValidity && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={e => {
            if (e.target === e.currentTarget && !savingValidity) setClientToEditValidity(null);
          }}
        >
          <div className="w-full max-w-lg bg-slate-900 border border-cyan-500/40 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Controle de Vigência & Vencimento
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Defina o dia, mês e ano exatos para a expiração ou renovação do plano.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setClientToEditValidity(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1 text-xs">
              <p className="text-slate-300">
                <strong className="text-white">Cliente:</strong> {clientToEditValidity.name}
              </p>
              <p className="text-slate-400">
                <strong className="text-slate-300">E-mail:</strong> {clientToEditValidity.email}
              </p>
              <p className="text-slate-400">
                <strong className="text-slate-300">Status Atual:</strong>{' '}
                <span className="capitalize text-cyan-400 font-semibold">{clientToEditValidity.status}</span>
              </p>
            </div>

            <form onSubmit={handleSaveValidity} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Data Limite de Vigência (Dia / Mês / Ano)
                </label>
                <Input
                  type="date"
                  value={targetDate}
                  onChange={e => setTargetDate(e.target.value)}
                  required
                  className="bg-slate-950 border-slate-700 text-white font-mono text-sm [color-scheme:dark]"
                />
              </div>

              {/* Atalhos Rápidos */}
              <div>
                <span className="text-[11px] text-slate-400 font-medium block mb-1.5">
                  Atalhos rápidos para estender ou definir vigência:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => applyQuickDays(7)}
                    className="h-7 px-2.5 text-[11px] border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                  >
                    +7 dias
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => applyQuickDays(15)}
                    className="h-7 px-2.5 text-[11px] border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                  >
                    +15 dias
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => applyQuickDays(30)}
                    className="h-7 px-2.5 text-[11px] border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                  >
                    +30 dias
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={applyEndOfCurrentMonth}
                    className="h-7 px-2.5 text-[11px] border-slate-700 bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white"
                  >
                    Fim deste mês
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => applyQuickDays(365)}
                    className="h-7 px-2.5 text-[11px] border-cyan-500/40 bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-300"
                  >
                    +1 ano
                  </Button>
                </div>
              </div>

              {/* Status do Cliente */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Status da Conta
                </label>
                <select
                  value={targetStatus}
                  onChange={e => setTargetStatus(e.target.value as SaaSUser['status'])}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="trialing">Período de Testes (Trial)</option>
                  <option value="active">Assinatura Ativa (Regular)</option>
                  <option value="overdue">Atrasado / Pendente</option>
                  <option value="canceled">Cancelado / Bloqueado</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Se definir como <strong>Assinatura Ativa</strong>, o cliente não verá avisos de teste grátis e terá acesso até a data estipulada.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  disabled={savingValidity}
                  onClick={() => setClientToEditValidity(null)}
                  className="border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={savingValidity}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold"
                >
                  {savingValidity ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                      Salvar Vigência
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Vigência em Lote */}
      {bulkValidityOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={e => {
            if (e.target === e.currentTarget && !savingBulk) setBulkValidityOpen(false);
          }}
        >
          <div className="w-full max-w-lg bg-slate-900 border border-cyan-500/40 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shrink-0">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    Definir Vigência em Lote
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Aplicando nova vigência a <strong className="text-cyan-400">{selectedClientIds.length}</strong> cliente{selectedClientIds.length > 1 ? 's' : ''} selecionado{selectedClientIds.length > 1 ? 's' : ''}.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBulkValidityOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBulkValidity} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Nova Data de Vigência (Dia / Mês / Ano)
                </label>
                <Input
                  type="date"
                  value={bulkTargetDate}
                  onChange={e => setBulkTargetDate(e.target.value)}
                  required
                  className="bg-slate-950 border-slate-700 text-white font-mono text-sm [color-scheme:dark]"
                />
              </div>

              {/* Atalhos Rápidos */}
              <div>
                <span className="text-[11px] text-slate-400 font-medium block mb-1.5">
                  Atalhos rápidos para aplicar a todos os selecionados:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 7);
                      setBulkTargetDate(d.toISOString().slice(0, 10));
                    }}
                    className="h-7 px-2.5 text-[11px] border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                  >
                    +7 dias
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 15);
                      setBulkTargetDate(d.toISOString().slice(0, 10));
                    }}
                    className="h-7 px-2.5 text-[11px] border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                  >
                    +15 dias
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 30);
                      setBulkTargetDate(d.toISOString().slice(0, 10));
                    }}
                    className="h-7 px-2.5 text-[11px] border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white"
                  >
                    +30 dias
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const now = new Date();
                      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                      setBulkTargetDate(lastDay.toISOString().slice(0, 10));
                    }}
                    className="h-7 px-2.5 text-[11px] border-slate-700 bg-slate-800 hover:bg-slate-700 text-indigo-300 hover:text-white"
                  >
                    Fim deste mês
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const d = new Date();
                      d.setDate(d.getDate() + 365);
                      setBulkTargetDate(d.toISOString().slice(0, 10));
                    }}
                    className="h-7 px-2.5 text-[11px] border-cyan-500/40 bg-cyan-950/40 hover:bg-cyan-900/60 text-cyan-300"
                  >
                    +1 ano
                  </Button>
                </div>
              </div>

              {/* Status do Cliente em Lote */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1.5">
                  Atualização de Status (Opcional)
                </label>
                <select
                  value={bulkTargetStatus}
                  onChange={e => setBulkTargetStatus(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="keep">Manter status individual de cada cliente</option>
                  <option value="active">Definir todos como Assinatura Ativa (Regular)</option>
                  <option value="trialing">Definir todos como Período de Testes (Trial)</option>
                  <option value="overdue">Definir todos como Atrasado / Pendente (Bloqueado)</option>
                  <option value="canceled">Definir todos como Cancelado</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  disabled={savingBulk}
                  onClick={() => setBulkValidityOpen(false)}
                  className="border-slate-700 text-slate-300 hover:text-white rounded-xl text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={savingBulk}
                  className="bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold"
                >
                  {savingBulk ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      Salvando lote...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                      Aplicar aos {selectedClientIds.length} Clientes
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};