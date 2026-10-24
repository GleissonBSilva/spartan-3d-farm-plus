"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSaaSData } from '@/context/SaaSDataContext';

interface NewClientModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NewClientModal: React.FC<NewClientModalProps> = ({ isOpen, onClose }) => {
  const { addClient, plans } = useSaaSData();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [planId, setPlanId] = useState('plan_pro');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email) return;

    addClient({
      name,
      email,
      companyName: company,
      planId,
    });

    setName('');
    setEmail('');
    setCompany('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold text-white">Cadastrar Novo Cliente</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-sm">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-xs text-slate-300 font-medium block mb-1">Nome do Contato</label>
            <Input
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Ana Clara"
              className="bg-slate-950 border-slate-750 text-white rounded-xl"
            />
          </div>

          <div>
            <label className="text-xs text-slate-300 font-medium block mb-1">E-mail</label>
            <Input
              required
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="ana@empresa.com"
              className="bg-slate-950 border-slate-750 text-white rounded-xl"
            />
          </div>

          <div>
            <label className="text-xs text-slate-300 font-medium block mb-1">Empresa</label>
            <Input
              required value={company}
              onChange={e => setCompany(e.target.value)}
              placeholder="Empresa Tech LTDA"
              className="bg-slate-950 border-slate-750 text-white rounded-xl"
            />
          </div>

          <div>
            <label className="text-xs text-slate-300 font-medium block mb-1">Plano Escolhido</label>
            <select
              value={planId}
              onChange={e => setPlanId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-750 text-white rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            >
              {plans.map(plan => <option key={plan.id} value={plan.id}>{plan.name} (R$ {plan.priceMonthly.toLocaleString('pt-BR')}/mês)</option>)}
            </select>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose} className="text-slate-400 hover:text-white">
              Cancelar
            </Button>
            <Button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl">
              Salvar Cliente
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};