"use client";

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Bot, Thermometer, Copy, Check, RotateCcw, Loader2, Settings2, Key, X } from 'lucide-react';
import { toast } from 'sonner';
import { AiDiagnosticService } from '@/services/aiDiagnosticService';
import { useAuth } from '@/context/AuthContext';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export const SpartanAiAssistant: React.FC = () => {
  const { user } = useAuth();
  const [pergunta, setPergunta] = useState('');
  const [resposta, setResposta] = useState<string | null>(null);
  const [modeloUsado, setModeloUsado] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [configModal, setConfigModal] = useState(false);
  const [customKey, setCustomKey] = useState(() => AiDiagnosticService.getCustomApiKey(user?.id));
  const [customProvider, setCustomProvider] = useState<'groq' | 'openai'>(() => AiDiagnosticService.getCustomProvider(user?.id));

  useEffect(() => {
    setCustomKey(AiDiagnosticService.getCustomApiKey(user?.id));
    setCustomProvider(AiDiagnosticService.getCustomProvider(user?.id));
    setResposta(null);
    setModeloUsado(null);
  }, [user?.id]);

  const [categoriaAtiva, setCategoriaAtiva] = useState<'iniciante' | 'avancado'>('iniciante');

  const sugestoesIniciante = [
    { text: 'Estou começando agora: qual o passo a passo para a primeira impressão?' },
    { text: 'A peça não está grudando na mesa ou soltou durante a impressão.' },
    { text: 'A impressora está fazendo barulho de estalo (tec tec) e não sai filamento.' },
    { text: 'A peça ficou cheia de fios parecendo teia de aranha.' },
    { text: 'Qual o melhor filamento para quem está aprendendo a imprimir?' },
    { text: 'Minha peça ficou muito fraca e está quebrando fácil entre as camadas.' },
  ];

  const sugestoesAvancado = [
    { text: 'Minha peça em PETG está apresentando stringing (fiapos) excessivo no OrcaSlicer.' },
    { text: 'Peça descolando da mesa (Warping) em ABS. Qual temperatura de mesa e fechamento usar?' },
    { text: 'Pode misturar filamento PLA com PETG para suporte com Zero Gap?' },
    { text: 'Quais as melhores configurações de retração e velocidade para imprimir TPU 95A?' },
    { text: 'Como calibrar Input Shaping e Pressure Advance no Klipper?' },
    { text: 'Como precificar uma peça de 250g em PLA que demora 12h para empresa B2B?' },
  ];

  const handleSalvarChave = (e: React.FormEvent) => {
    e.preventDefault();
    AiDiagnosticService.saveCustomAiConfig(customKey, customProvider, user?.id);
    setConfigModal(false);
    toast.success(customKey.trim() ? 'Chave de IA configurada com sucesso!' : 'Configuração de IA restaurada para o motor nativo.');
  };

  const handleEnviar = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = pergunta.trim();
    if (!query) return;
    
    setCarregando(true);
    try {
      const result = await AiDiagnosticService.askAssistant(query);
      setResposta(result.answer);
      setModeloUsado(result.model);
      toast.success('Diagnóstico gerado com sucesso!');
    } catch (error) {
      console.warn('Falha na consulta, ativando motor de diagnóstico técnico Spartan 3D:', error);
      const fallback = AiDiagnosticService.getExpertAnswer(query);
      setResposta(fallback);
      setModeloUsado('spartan-3d-expert-engine');
      toast.success('Diagnóstico gerado com sucesso!');
    } finally { 
      setCarregando(false); 
    }
  };

  const handleCopy = () => {
    if (!resposta) return;
    navigator.clipboard.writeText(resposta);
    setCopiado(true);
    toast.success('Solução copiada para a área de transferência!');
    setTimeout(() => setCopiado(false), 2000);
  };

  const handleLimpar = () => {
    setResposta(null);
    setModeloUsado(null);
  };

  const hasCustomKey = Boolean(customKey.trim());

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2 bg-slate-900 border-slate-800 rounded-2xl">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 text-white shadow-md">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base text-white font-bold">
                  Spartan 3D Copilot & Diagnóstico de Falhas
                </CardTitle>
                <CardDescription className="text-xs text-slate-400">
                  Inteligência Artificial especializada em parâmetros de fatiamento, bicos, resinas e resolução de problemas
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfigModal(true)}
                className="bg-slate-950 border-slate-700 hover:border-indigo-500 text-indigo-300 hover:text-white text-xs h-8 rounded-xl px-2.5"
              >
                <Key className="w-3.5 h-3.5 mr-1 text-indigo-400" />
                {hasCustomKey ? 'IA Conectada' : 'Configurar Chave IA'}
              </Button>
              <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 text-xs">
                {hasCustomKey ? `${customProvider.toUpperCase()} Ativo` : 'Motor Especialista 3D'}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
              <span className="text-xs font-semibold text-slate-300">Dúvidas Rápidas para Clicar:</span>
              <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setCategoriaAtiva('iniciante')}
                  className={`text-[11px] font-bold px-3 py-1 rounded-lg transition-all ${
                    categoriaAtiva === 'iniciante'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  🔰 Sou Iniciante (Aprendendo)
                </button>
                <button
                  type="button"
                  onClick={() => setCategoriaAtiva('avancado')}
                  className={`text-[11px] font-bold px-3 py-1 rounded-lg transition-all ${
                    categoriaAtiva === 'avancado'
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  ⚙️ Farm & Avançado
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {(categoriaAtiva === 'iniciante' ? sugestoesIniciante : sugestoesAvancado).map((sug, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPergunta(sug.text)}
                  className="text-left p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/50 text-xs text-slate-300 transition-all hover:bg-slate-900 leading-snug"
                >
                  {sug.text}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-amber-500/5 border border-amber-500/20 p-2.5 text-slate-300 text-[11px] flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong className="text-amber-300">Você está aprendendo?</strong> Não precisa saber termos técnicos! Pode descrever com suas próprias palavras: <em>&quot;a peça soltou da mesa&quot;</em>, <em>&quot;está fazendo barulho tec-tec&quot;</em> ou <em>&quot;parecendo teia de aranha&quot;</em>.
            </span>
          </div>

          <form onSubmit={handleEnviar} className="space-y-3 pt-1">
            <Input
              value={pergunta}
              onChange={e => setPergunta(e.target.value)}
              placeholder="Digite com suas palavras (ex: estou aprendendo, por onde começo? ou a peça soltou da mesa)..."
              className="bg-slate-950 border-slate-750 text-white rounded-xl h-11 text-xs"
            />
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={carregando || !pergunta.trim()}
                className="bg-gradient-to-r from-amber-500 to-indigo-600 hover:opacity-90 text-white text-xs font-bold rounded-xl h-10 px-5"
              >
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                {carregando ? 'Consultando Diagnóstico...' : 'Pedir Diagnóstico IA'}
              </Button>
            </div>
          </form>

          {carregando && (
            <div className="p-4 rounded-xl bg-slate-950 border border-indigo-500/30 space-y-3 animate-pulse">
              <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold">
                <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                <span>Consultando base de conhecimento técnico e gerando diagnóstico 3D...</span>
              </div>
              <div className="space-y-2 pt-1">
                <div className="h-3 bg-slate-850 rounded w-3/4"></div>
                <div className="h-3 bg-slate-850 rounded w-full"></div>
                <div className="h-3 bg-slate-850 rounded w-5/6"></div>
              </div>
            </div>
          )}

          {resposta && !carregando && (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 animate-in fade-in duration-300">
              <div className="flex justify-between items-center border-b border-slate-800/80 pb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Resposta da IA Spartan:
                  </span>
                  {modeloUsado && (
                    <Badge variant="outline" className="text-[10px] text-indigo-300 border-indigo-500/30 bg-indigo-500/10 py-0 px-2 h-5">
                      {modeloUsado}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCopy}
                    className="h-7 text-xs text-slate-300 hover:text-white hover:bg-slate-850 rounded-lg px-2"
                  >
                    {copiado ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                    {copiado ? 'Copiado!' : 'Copiar'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleLimpar}
                    className="h-7 text-xs text-slate-400 hover:text-rose-400 hover:bg-slate-850 rounded-lg px-2"
                    title="Limpar resposta"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                    Limpar
                  </Button>
                </div>
              </div>

              {/* Renderização rica em Markdown com suporte customizado a cabeçalhos, listas, blocos de código e tabelas */}
              <div className="text-xs text-slate-200 font-sans leading-relaxed prose prose-invert max-w-none">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ ...props }) => <h1 className="text-base font-bold text-white mt-3 mb-1.5 pb-1 border-b border-slate-800" {...props} />,
                    h2: ({ ...props }) => <h2 className="text-sm font-bold text-white mt-2.5 mb-1" {...props} />,
                    h3: ({ ...props }) => <h3 className="text-xs font-semibold text-amber-300 mt-2 mb-1" {...props} />,
                    p: ({ ...props }) => <p className="mb-2 leading-relaxed text-slate-200 text-xs" {...props} />,
                    ul: ({ ...props }) => <ul className="list-disc list-outside pl-4 mb-2.5 space-y-1 text-xs text-slate-200" {...props} />,
                    ol: ({ ...props }) => <ol className="list-decimal list-outside pl-4 mb-2.5 space-y-1 text-xs text-slate-200" {...props} />,
                    li: ({ ...props }) => <li className="text-xs text-slate-200" {...props} />,
                    strong: ({ ...props }) => <strong className="font-semibold text-white" {...props} />,
                    blockquote: ({ ...props }) => <blockquote className="border-l-2 border-amber-500/80 pl-2.5 italic text-slate-300 my-2 text-xs" {...props} />,
                    code: ({ children, ...props }) => {
                      const isInline = !String(children).includes('\n');
                      return isInline ? (
                        <code className="rounded bg-slate-900 border border-slate-800 px-1 py-0.5 font-mono text-[11px] text-amber-300 font-semibold" {...props}>
                          {children}
                        </code>
                      ) : (
                        <pre className="overflow-x-auto rounded-xl bg-slate-900 p-2.5 my-2 border border-slate-800 font-mono text-[11px] text-slate-200">
                          <code {...props}>{children}</code>
                        </pre>
                      );
                    },
                    img: ({ ...props }) => (
                      <img 
                        {...props} 
                        className="rounded-lg max-h-64 object-cover my-3 border border-slate-700 shadow-md" 
                        alt={props.alt || 'Imagem de diagnóstico 3D'} 
                      />
                    ),
                    table: ({ ...props }) => (
                      <div className="overflow-x-auto my-3 rounded-lg border border-slate-800">
                        <table className="min-w-full divide-y divide-slate-700 text-xs" {...props} />
                      </div>
                    ),
                    th: ({ ...props }) => (
                      <th className="px-3 py-2 bg-slate-900 text-left font-semibold text-slate-300 border-b border-slate-800" {...props} />
                    ),
                    td: ({ ...props }) => (
                      <td className="px-3 py-2 border-b border-slate-800 text-slate-300" {...props} />
                    )
                  }}
                >
                  {resposta}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-800 rounded-2xl p-5 space-y-4">
        <h3 className="font-bold text-white text-sm flex items-center gap-2">
          <Thermometer className="w-4 h-4 text-amber-400" />
          Temperaturas Médias Recomendadas
        </h3>
        <div className="space-y-2.5 text-xs text-slate-300">
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center">
            <div>
              <span className="font-bold text-white block">PLA Standard / Silk</span>
              <span className="text-[11px] text-slate-400">Bico: 200°C - 215°C</span>
            </div>
            <span className="text-emerald-400 font-semibold">Mesa: 55°C - 60°C</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center">
            <div>
              <span className="font-bold text-white block">PETG</span>
              <span className="text-[11px] text-slate-400">Bico: 230°C - 245°C</span>
            </div>
            <span className="text-cyan-400 font-semibold">Mesa: 70°C - 80°C</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center">
            <div>
              <span className="font-bold text-white block">ABS / ASA</span>
              <span className="text-[11px] text-slate-400">Bico: 240°C - 260°C</span>
            </div>
            <span className="text-amber-400 font-semibold">Mesa: 95°C - 110°C</span>
          </div>
          <div className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center">
            <div>
              <span className="font-bold text-white block">TPU Flexível</span>
              <span className="text-[11px] text-slate-400">Bico: 215°C - 230°C</span>
            </div>
            <span className="text-indigo-400 font-semibold">Mesa: 45°C - 50°C</span>
          </div>
        </div>
      </Card>

      {/* MODAL: CONFIGURAÇÃO DE CHAVE IA (GROQ / OPENAI) */}
      {configModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={e => {
            if (e.target === e.currentTarget) setConfigModal(false);
          }}
        >
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Key className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-white text-sm">Conectar Provedor de IA</h3>
              </div>
              <button
                type="button"
                onClick={() => setConfigModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              O Spartan 3D já possui um motor técnico especialista nativo para dúvidas de impressão 3D. 
              Para conversar com modelos de linguagem completos e ilimitados (*como Llama-3.3-70B grátis via Groq*), informe sua chave abaixo:
            </p>

            <form onSubmit={handleSalvarChave} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Provedor de Inteligência Artificial
                </label>
                <select
                  value={customProvider}
                  onChange={e => setCustomProvider(e.target.value as 'groq' | 'openai')}
                  className="w-full bg-slate-950 border border-slate-750 text-white rounded-xl h-10 px-3 text-xs focus:outline-none focus:border-indigo-500"
                >
                  <option value="groq">Groq Cloud (Recomendado — Grátis & Ultra Rápido)</option>
                  <option value="openai">OpenAI (ChatGPT / GPT-4o-mini)</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  {customProvider === 'groq' 
                    ? 'Obtenha uma chave gratuita em console.groq.com (sem cartão de crédito).'
                    : 'Requer chave da plataforma platform.openai.com.'}
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Chave de API (API Key)
                </label>
                <input
                  type="password"
                  value={customKey}
                  onChange={e => setCustomKey(e.target.value)}
                  placeholder={customProvider === 'groq' ? 'gsk_...' : 'sk-...'}
                  className="w-full bg-slate-950 border border-slate-750 text-white rounded-xl h-10 px-3 text-xs font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-between items-center pt-2">
                {hasCustomKey && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCustomKey('');
                      AiDiagnosticService.saveCustomAiConfig('', 'groq');
                      setConfigModal(false);
                      toast.success('Chave removida. Usando motor especialista Spartan.');
                    }}
                    className="text-rose-400 hover:text-rose-300 text-xs hover:bg-rose-950/30"
                  >
                    Remover Chave
                  </Button>
                )}
                <div className="flex items-center gap-2 ml-auto">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setConfigModal(false)}
                    className="border-slate-700 bg-slate-950 text-slate-300 text-xs rounded-xl"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl px-4"
                  >
                    Salvar Conexão
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};