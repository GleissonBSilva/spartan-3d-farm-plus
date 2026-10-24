"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, QrCode, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { useSaaSData } from '@/context/SaaSDataContext';

interface AdminClientsTableProps {
  onOpenNewClientModal: () => void;
}

export const AdminClientsTable: React.FC<AdminClientsTableProps> = ({ onOpenNewClientModal }) => {
  const { clients, updateClientStatus, createInvoice, plans } = useSaaSData();

  return (
    <Card className="bg-slate-900 border-slate-800 rounded-2xl">
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <CardTitle className="text-base text-white font-bold">Clientes & Assinantes</CardTitle>
          <CardDescription className="text-xs text-slate-400">
            Gerencie acessos, faturas e status de cada assinante em tempo real
          </CardDescription>
        </div>

        <div className="flex items-center gap-2">
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

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-y border-slate-800">
              <tr>
                <th className="py-3 px-4">Cliente / Empresa</th>
                <th className="py-3 px-4">Plano</th>
                <th className="py-3 px-4">MRR</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Data de Início</th>
                <th className="py-3 px-4 text-right">Ações Rápidas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {clients.map(client => (
                <tr key={client.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={client.avatar}
                        alt={client.name}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                      <div>
                        <p className="font-bold text-white text-sm">{client.name}</p>
                        <p className="text-[11px] text-slate-400">{client.companyName || client.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4">
                    <Badge variant="outline" className="border-indigo-500/40 text-indigo-300 bg-indigo-500/10">
                      {client.planId === 'plan_enterprise'
                        ? 'Enterprise VIP'
                        : client.planId === 'plan_starter'
                        ? 'Starter Booster'
                        : 'Pro Scaler'}
                    </Badge>
                  </td>
                  <td className="py-3.5 px-4 font-bold text-white">
                    R$ {client.mrr}/mês
                  </td>
                  <td className="py-3.5 px-4">
                    {client.status === 'active' && (
                      <span className="inline-flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-semibold text-[11px]">
                        <CheckCircle2 className="w-3 h-3" /> Ativo
                      </span>
                    )}
                    {client.status === 'trialing' && (
                      <span className="inline-flex items-center gap-1 text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full font-semibold text-[11px]">
                        <Clock className="w-3 h-3" /> Teste Grátis
                      </span>
                    )}
                    {client.status === 'overdue' && (
                      <span className="inline-flex items-center gap-1 text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full font-semibold text-[11px]">
                        <AlertCircle className="w-3 h-3" /> Atrasado
                      </span>
                    )}
                  </td>
                  <td className="py-3.5 px-4 text-slate-400">{client.joinedAt}</td>
                  <td className="py-3.5 px-4 text-right space-x-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => createInvoice(client.id, plans.find(plan => plan.id === client.planId)?.priceMonthly || 0, 'pix')}
                      className="h-7 px-2 text-[11px] bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-lg"
                    >
                      <QrCode className="w-3 h-3 mr-1" />
                      Cobrar Pix
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        updateClientStatus(client.id, client.status === 'active' ? 'overdue' : 'active')
                      }
                      className="h-7 px-2 text-[11px] text-slate-400 hover:text-white rounded-lg"
                    >
                      Alternar Status
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};
