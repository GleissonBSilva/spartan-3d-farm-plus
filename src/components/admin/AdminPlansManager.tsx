import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Check, Save } from 'lucide-react';
import { useSaaSData } from '@/context/SaaSDataContext';
import { Plan } from '@/types/saas';

type Editable = Pick<Plan, 'priceMonthly' | 'priceYearly' | 'maxProjects' | 'maxPrinters' | 'maxFilaments' | 'maxUsers' | 'creditsAI'>;
const valuesFor = (plan: Plan): Editable => ({
  priceMonthly: plan.priceMonthly, priceYearly: plan.priceYearly, maxProjects: plan.maxProjects,
  maxPrinters: plan.maxPrinters, maxFilaments: plan.maxFilaments, maxUsers: plan.maxUsers, creditsAI: plan.creditsAI || 0,
});

export const AdminPlansManager: React.FC = () => {
  const { plans, updatePlan } = useSaaSData();
  const [values, setValues] = useState<Record<string, Editable>>({});
  useEffect(() => setValues(Object.fromEntries(plans.map(plan => [plan.id, valuesFor(plan)]))), [plans]);

  const field = (plan: Plan, key: keyof Editable, label: string) => <label className="space-y-1 text-xs text-slate-400" key={key}>
    <span>{label}</span><Input type="number" min="0" step={key.includes('price') ? '0.01' : '1'} value={values[plan.id]?.[key] ?? 0}
      onChange={event => setValues(prev => ({ ...prev, [plan.id]: { ...prev[plan.id], [key]: Number(event.target.value) } }))}
      className="h-9 bg-slate-950 border-slate-700 text-white" />
  </label>;

  return <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
    {plans.map(plan => <Card key={plan.id} className="bg-slate-900 border-slate-800 rounded-2xl p-6 space-y-4">
      <div className="flex items-start justify-between gap-3"><div><h3 className="text-lg font-bold text-white">{plan.name}</h3><p className="mt-1 text-xs text-slate-400">{plan.description}</p></div>{plan.badge && <Badge>{plan.badge}</Badge>}</div>
      <div className="grid grid-cols-2 gap-3">
        {field(plan, 'priceMonthly', 'Preço mensal (R$)')}{field(plan, 'priceYearly', 'Preço anual (R$)')}
        {field(plan, 'maxProjects', 'Projetos')}{field(plan, 'maxPrinters', 'Impressoras')}
        {field(plan, 'maxFilaments', 'Carretéis')}{field(plan, 'maxUsers', 'Membros da equipe')}
        {field(plan, 'creditsAI', 'Créditos de IA')}
      </div>
      <div className="space-y-1.5 text-xs text-slate-300">{plan.features.map((feature, index) => <div key={index} className="flex items-center gap-2"><Check className="h-3.5 w-3.5 text-emerald-400" /><span>{feature}</span></div>)}</div>
      <Button onClick={() => updatePlan(plan.id, values[plan.id] || valuesFor(plan))} className="w-full"><Save className="mr-2 h-4 w-4" />Salvar plano</Button>
    </Card>)}
  </div>;
};
