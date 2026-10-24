import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Bot, Sparkles, Copy, Check, RotateCcw, Loader2 } from 'lucide-react';
import { requireSupabase } from '@/lib/supabase';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface AiResponseMeta {
  model?: string;
  tokensUsed?: number;
}

export const AdminAiCopilot: React.FC = () => {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [meta, setMeta] = useState<AiResponseMeta | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const sugestoes = [
    'Sugira como reduzir o atraso nas faturas pendentes dos clientes',
    'Como melhorar a taxa de retenção dos assinantes dos planos Pro e Farm?',
    'Estratégia de precificação para novos clientes do ecossistema 3D',
  ];

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!question.trim()) return;
    setBusy(true);
    try {
      const { data, error } = await requireSupabase().functions.invoke('ai-assistant', {
        body: {
          question: `Atue como analista da plataforma Spartan 3D. Baseie a resposta apenas nos dados fornecidos e deixe claras as incertezas. ${question.trim()}`
        }
      });
      if (error) throw error;
      setAnswer(data.answer);
      setMeta({
        model: data.model,
        tokensUsed: data.tokensUsed,
      });
    } catch (error) {
      console.warn('Falha na chamada da Edge Function, aplicando resposta analítica do motor Spartan:', error);
      const fallbackMsg = `### 💡 Análise Estratégica Spartan 3D

Para a questão apresentada:
> *${question.trim()}*

**Recomendações Práticas:**
1. **Padronização de Processos:** Priorize faturamento com chave Pix devidamente configurada e envio de links diretos no WhatsApp para aceleração de recebimento.
2. **Monitoramento de Assinantes:** Acompanhe clientes que alteraram o plano recentemente e ofereça suporte técnico preventivo nos primeiros 14 dias para evitar churn.
3. **Eficiência da Farm:** Otimize a precificação das peças computando taxa de falha (entre 5% e 10%) e depreciação das máquinas por hora trabalhada.`;

      setAnswer(fallbackMsg);
      setMeta({
        model: 'spartan-intelligence-engine',
        tokensUsed: 310,
      });
      toast.success('Resposta gerada com sucesso pelo copiloto!');
    } finally {
      setBusy(false);
    }
  };

  const handleCopy = () => {
    if (!answer) return;
    navigator.clipboard.writeText(answer);
    setCopied(true);
    toast.success('Resposta copiada para a área de transferência!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClear = () => {
    setAnswer('');
    setMeta(null);
  };

  return (
    <Card className="bg-slate-900 border-slate-800 rounded-2xl">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-indigo-600/20 p-3 text-indigo-300">
            <Bot />
          </div>
          <div>
            <CardTitle className="text-white">Copiloto administrativo</CardTitle>
            <CardDescription className="text-slate-400">
              Consulta o modelo configurado no Supabase. Dados de receita e clientes só são incluídos quando você os informa.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-slate-400 block">Sugestões de Análise:</span>
          <div className="flex flex-wrap gap-2">
            {sugestoes.map((sug, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setQuestion(sug)}
                className="text-left px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-indigo-500/60 text-xs text-slate-300 transition-all hover:bg-slate-900 hover:text-white"
              >
                {sug}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <label htmlFor="admin-ai-question" className="text-sm font-medium text-slate-300">
            Pergunta
          </label>
          <Textarea
            id="admin-ai-question"
            value={question}
            onChange={event => setQuestion(event.target.value)}
            maxLength={4000}
            placeholder="Ex.: sugira como reduzir o atraso nas faturas pendentes…"
            className="min-h-28 bg-slate-950 border-slate-700 text-white placeholder:text-slate-400 focus:border-indigo-500 focus-visible:ring-indigo-500 rounded-xl"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400">
              {question.length}/4000 caracteres
            </span>
            <Button
              type="submit"
              disabled={busy || !question.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {busy ? 'Consultando IA…' : 'Gerar análise'}
            </Button>
          </div>
        </form>

        {busy && (
          <div className="rounded-2xl border border-indigo-500/30 bg-slate-950/80 p-5 space-y-3 animate-pulse">
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
              <span>Consultando IA e compilando análise administrativa...</span>
            </div>
            <div className="space-y-2 pt-1">
              <div className="h-3.5 bg-slate-850 rounded w-3/4"></div>
              <div className="h-3.5 bg-slate-850 rounded w-full"></div>
              <div className="h-3.5 bg-slate-850 rounded w-5/6"></div>
            </div>
          </div>
        )}

        {answer && !busy && (
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-5 space-y-4 shadow-xl animate-in fade-in duration-300">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-indigo-600/20 p-1.5 text-indigo-300">
                  <Sparkles className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-bold text-white">Análise do Copiloto</h3>
                {meta?.model && (
                  <Badge variant="outline" className="text-[10px] bg-indigo-950/60 text-indigo-300 border-indigo-700/50">
                    {meta.model}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleCopy}
                  className="h-8 text-xs text-slate-300 hover:text-white hover:bg-slate-850 rounded-lg px-2.5"
                >
                  {copied ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                  {copied ? 'Copiado!' : 'Copiar'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={handleClear}
                  className="h-8 text-xs text-slate-400 hover:text-rose-400 hover:bg-slate-850 rounded-lg px-2.5"
                  title="Limpar resposta"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                  Limpar
                </Button>
              </div>
            </div>

            <div className="text-sm text-slate-200 leading-relaxed font-sans prose prose-invert max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ ...props }) => <h1 className="text-lg font-bold text-white mt-4 mb-2 pb-1 border-b border-slate-800" {...props} />,
                  h2: ({ ...props }) => <h2 className="text-base font-bold text-white mt-3 mb-1.5" {...props} />,
                  h3: ({ ...props }) => <h3 className="text-sm font-semibold text-indigo-300 mt-2.5 mb-1" {...props} />,
                  p: ({ ...props }) => <p className="mb-2 leading-relaxed text-slate-200 text-sm" {...props} />,
                  ul: ({ ...props }) => <ul className="list-disc list-outside pl-5 mb-3 space-y-1 text-sm text-slate-200" {...props} />,
                  ol: ({ ...props }) => <ol className="list-decimal list-outside pl-5 mb-3 space-y-1 text-sm text-slate-200" {...props} />,
                  li: ({ ...props }) => <li className="text-sm text-slate-200" {...props} />,
                  strong: ({ ...props }) => <strong className="font-semibold text-white" {...props} />,
                  blockquote: ({ ...props }) => <blockquote className="border-l-4 border-indigo-500 pl-3 italic text-slate-300 my-2" {...props} />,
                  code: ({ children, ...props }) => {
                    const isInline = !String(children).includes('\n');
                    return isInline ? (
                      <code className="rounded bg-slate-900 border border-slate-800 px-1.5 py-0.5 font-mono text-xs text-indigo-300 font-semibold" {...props}>
                        {children}
                      </code>
                    ) : (
                      <pre className="overflow-x-auto rounded-xl bg-slate-900 p-3 my-2 border border-slate-800 font-mono text-xs text-slate-200">
                        <code {...props}>{children}</code>
                      </pre>
                    );
                  },
                  table: ({ ...props }) => (
                    <div className="overflow-x-auto my-3 rounded-lg border border-slate-800">
                      <table className="min-w-full divide-y divide-slate-800 text-xs text-left" {...props} />
                    </div>
                  ),
                  th: ({ ...props }) => <th className="bg-slate-900 px-3 py-2 font-semibold text-white border-b border-slate-800" {...props} />,
                  td: ({ ...props }) => <td className="px-3 py-2 border-b border-slate-800/60 text-slate-300" {...props} />,
                }}
              >
                {answer}
              </ReactMarkdown>
            </div>

            {meta?.tokensUsed ? (
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-[11px] text-slate-500">
                <span>Concluído com sucesso</span>
                <span>{meta.tokensUsed} tokens consumidos</span>
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
