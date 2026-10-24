"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Plus, CheckCircle2, Clock, QrCode, ArrowUpRight } from 'lucide-react';
import { useSaaSData } from '@/context/SaaSDataContext';

interface AdminBillingTableProps {
  showCreateButton?: boolean;
}

export const AdminBillingTable: React.FC<AdminBillingTableProps> = ({ showCreateButton = true }) => {
  const { invoices, createInvoice, clients, plans } = useSaaSData();
  const firstClient = clients[0];
  const firstClientPlan = plans.find(plan => plan.id === firstClient?.planId);

  return (
    <Card className="bg-slate-900 border-slate-800 rounded-2xl">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="text-base text-white font-bold">Faturas e Liquidações</CardTitle>
          <CardDescription className="text-xs text-slate-400">
            Conciliação automática via Pix dinâmico e Cartão de Crédito
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/admin/financeiro">
            <Button
              size="sm"
              variant="outline"
              className="border-indigo-500/40 text-indigo-300 hover:text-white hover:bg-indigo-600/20 text-xs rounded-xl"
            >
              <QrCode className="w-3.5 h-3.5 mr-1" /> Área Pix & Financeiro
              <ArrowUpRight className="w-3 h-3 ml-1" />
            </Button>
          </Link>
          {showCreateButton && (
            <Button
              size="sm"
              onClick={() => firstClient && createInvoice(firstClient.id, firstClientPlan?.priceMonthly || 0, 'pix')}
              disabled={!firstClient}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-xl"
            >
              <Plus className="w-3.5 h-3.5 mr-1" /> Gerar Nova Fatura
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase tracking-wider font-semibold border-y border-slate-800">
              <tr>
                <th className="py-3 px-4">Código</th>
                <th className="py-3 px-4">Assinante</th>
                <th className="py-3 px-4">Valor</th>
                <th className="py-3 px-4">Método</th>
                <th className="py-3 px-4">Vencimento</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {invoices.map(inv => (
                <tr key={inv.id} className="hover:bg-slate-800/30">
                  <td className="py-3 px-4 font-mono text-indigo-400 font-bold">{inv.id}</td>
                  <td className="py-3 px-4 text-white font-medium">{inv.clientName}</td>
                  <td className="py-3 px-4 font-bold text-white">R$ {inv.amount}</td>
                  <td className="py-3 px-4 uppercase text-[11px] text-slate-400 font-semibold">{inv.method}</td>
                  <td className="py-3 px-4 text-slate-400">{inv.dueDate}</td>
                  <td className="py-3 px-4">
                    {inv.status === 'paid' ? (
                      <span className="text-emerald-400 font-semibold flex items-center gap-1 text-[11px]">
                        <CheckCircle2 className="w-3 h-3" /> Pago ({inv.paidAt})
                      </span>
                    ) : (
                      <span className="text-amber-400 font-semibold flex items-center gap-1 text-[11px]">
                        <Clock className="w-3 h-3" /> Pendente
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="text-[11px] text-slate-500">Confirmado pelo provedor</span>
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
