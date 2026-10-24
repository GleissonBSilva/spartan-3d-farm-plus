import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Radio } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

type EventRow = { id: string; provider: string; provider_event_id: string; payload: unknown; processed_at: string | null; created_at: string };

export const AdminWebhooksMonitor: React.FC = () => {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let active = true;
    const load = async () => {
      const { data, error } = await supabase.from('spartan_payment_events').select('*').order('created_at', { ascending: false }).limit(50);
      if (error) throw error;
      if (active) setEvents((data || []) as EventRow[]);
    };
    void load().catch(error => toast.error(`Falha ao carregar eventos: ${error.message}`)).finally(() => { if (active) setLoading(false); });
    const channel = supabase.channel('admin-payment-events').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'payment_events' }, () => {
      void load().catch(error => toast.error(`Falha ao atualizar eventos: ${error.message}`));
    }).subscribe();
    return () => { active = false; void supabase!.removeChannel(channel); };
  }, []);

  return (
    <Card className="bg-slate-900 border-slate-800 rounded-2xl">
      <CardHeader>
        <div className="flex items-center gap-3"><Radio className="h-5 w-5 text-indigo-400" /><div>
          <CardTitle className="text-base text-white">Eventos reais de pagamento</CardTitle>
          <CardDescription className="text-xs text-slate-400">Eventos verificados e processados pelos webhooks do Supabase.</CardDescription>
        </div></div>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading && <p className="text-sm text-slate-400" role="status">Carregando eventos…</p>}
        {!loading && events.length === 0 && <p className="text-sm text-slate-400">Nenhum evento recebido ainda.</p>}
        {events.map(event => <div key={event.id} className="rounded-xl border border-slate-800 bg-slate-950 p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><Badge variant="outline">{event.provider}</Badge><span className="text-xs text-white font-mono break-all">{event.provider_event_id}</span></div><span className="text-xs text-slate-500">{new Date(event.created_at).toLocaleString('pt-BR')}</span></div>
          <p className="text-xs text-slate-400">{event.processed_at ? 'Processado' : 'Aguardando processamento'}</p>
          <pre className="overflow-x-auto text-[11px] text-slate-400">{JSON.stringify(event.payload, null, 2)}</pre>
        </div>)}
      </CardContent>
    </Card>
  );
};
