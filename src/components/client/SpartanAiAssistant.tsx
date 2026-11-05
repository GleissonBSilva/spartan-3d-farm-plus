"use client";

import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Sparkles, 
  Bot, 
  Thermometer, 
  Copy, 
  Check, 
  RotateCcw, 
  Loader2, 
  Key, 
  X, 
  TrendingUp, 
  Send, 
  User as UserIcon, 
  Cpu, 
  Printer, 
  Flame,
  ArrowRight
} from 'lucide-react';
import { toast } from 'sonner';
import { AiDiagnosticService, ChatHistoryMessage } from '@/services/aiDiagnosticService';
import { useAuth } from '@/context/AuthContext';
import { useSaaSData } from '@/context/SaaSDataContext';
import { FeatureGatingService } from '@/services/featureGatingService';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SpartanAiFarmStrategy } from './SpartanAiFarmStrategy';

interface UiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  model?: string;
}

export const SpartanAiAssistant: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentPlan, impressoras, filamentos, projetos } = useSaaSData();
  const [mainTab, setMainTab] = useState<'estrategia' | 'diagnostico'>('diagnostico');

  // Controle de Acesso por Plano: Conselheiro Inteligente exclusivo PRO em diante
  const isProOrHigher = FeatureGatingService.canAccessAiFarmAdvisor(currentPlan, user?.role);

  // Estados do Chat Conversacional
  const [inputMensagem, setInputMensagem] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [configModal, setConfigModal] = useState(false);
  const [customKey, setCustomKey] = useState(() => AiDiagnosticService.getCustomApiKey(user?.id));
  const [customProvider, setCustomProvider] = useState<'groq' | 'openai'>(() => AiDiagnosticService.getCustomProvider(user?.id));
  const [categoriaAtiva, setCategoriaAtiva] = useState<'iniciante' | 'avancado' | 'farm'>('iniciante');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Mensagem inicial de boas-vindas contextualizada
  const [messages, setMessages] = useState<UiChatMessage[]>(() => [
    {
      id: 'welcome-1',
      role: 'assistant',
      content: `👋 **Olá! Sou o Spartan AI Copilot**, engenheiro-chefe e assistente técnico de impressão 3D da sua farm.

Estou pronto para analisar falhas (*stringing, warping, entupimento*), sugerir temperaturas ideais, calibrar retração/Z-offset para **Bambu Studio, OrcaSlicer, PrusaSlicer e Cura**, ou orientar como lucrar mais com sua capacidade produtiva.

💡 *Você pode digitar livremente ou escolher uma das dúvidas rápidas abaixo!*`,
      timestamp: new Date(),
      model: 'Spartan AI (Groq Fast LLM)'
    }
  ]);

  useEffect(() => {
    setCustomKey(AiDiagnosticService.getCustomApiKey(user?.id));
    setCustomProvider(AiDiagnosticService.getCustomProvider(user?.id));
  }, [user?.id]);

  // Auto-scroll ao receber nova mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, carregando]);

  // Contexto dinâmico da farm para enriquecer os prompts
  const buildFarmContext = (): string => {
    const totalImp = impressoras?.length || 0;
    const nomesImp = impressoras?.map(i => `${i.nome} (${i.status || 'pronta'})`).join(', ') || 'Nenhuma impressora cadastrada';
    
    const totalFil = filamentos?.length || 0;
    const resumoFil = filamentos?.slice(0, 8).map(f => `${f.tipo} ${f.cor} (${f.pesoAtualGramas || 0}g)`).join(', ') || 'Nenhum carretel no momento';
    
    const totalProj = projetos?.length || 0;
    const projetosAtivos = projetos?.filter(p => p.status === 'imprimindo' || p.status === 'pendente').length || 0;

    return `
Contexto Real da Farm do Usuário no Spartan 3D:
- Impressoras cadastradas (${totalImp}): ${nomesImp}.
- Estoque de Filamentos (${totalFil} carretéis cadastrados): ${resumoFil}.
- Projetos: ${totalProj} cadastrados (${projetosAtivos} em produção/fila).
- Usuário: ${user?.nome || 'Operador Spartan'}.
Use esses dados para personalizar as respostas quando fizer sentido (por exemplo, mencionando os modelos de impressora ou materiais que ele possui).
`.trim();
  };

  const sugestoesIniciante = [
    { text: 'Estou começando agora: qual o passo a passo seguro para a primeira impressão?' },
    { text: 'A primeira camada não está grudando na mesa de jeito nenhum.' },
    { text: 'A extrusora está estalando (tec-tec) e o filamento parou de sair.' },
    { text: 'A peça saiu cheia de teias de aranha (cabelinhos finos).' },
    { text: 'Qual a diferença prática de imprimir em PLA vs PETG?' },
  ];

  const sugestoesAvancado = [
    { text: 'Como eliminar stringing persistente em PETG no OrcaSlicer?' },
    { text: 'Peça descolando nos cantos (Warping) em ABS. Parâmetros de mesa e câmara?' },
    { text: 'Posso usar PLA como suporte para PETG com Zero Gap?' },
    { text: 'Como calibrar Input Shaping e Pressure Advance no Klipper?' },
    { text: 'Quais velocidades e retração usar para TPU 95A em Direct Drive?' },
  ];

  const sugestoesFarm = [
    { text: 'Como calcular o custo da hora-máquina considerando depreciação e energia?' },
    { text: 'Qual a rotina de manutenção preventiva semanal para manter a farm sem paradas?' },
    { text: 'Como organizar o estoque de filamentos para evitar desperdício de pontas de carretel?' },
    { text: 'Estratégia para acelerar o tempo de impressão em lotes sem perder acabamento superficial.' },
  ];

  const handleSalvarChave = (e: React.FormEvent) => {
    e.preventDefault();
    AiDiagnosticService.saveCustomAiConfig(customKey, customProvider, user?.id);
    setConfigModal(false);
    toast.success(customKey.trim() ? 'Chave de IA configurada com sucesso!' : 'Configuração de IA restaurada para o motor nativo ultra-rápido.');
  };

  const enviarMensagem = async (texto: string) => {
    const promptLimpo = texto.trim();
    if (!promptLimpo || carregando) return;

    const userMsg: UiChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: promptLimpo,
      timestamp: new Date()
    };

    const novaLista = [...messages, userMsg];
    setMessages(novaLista);
    setInputMensagem('');
    setCarregando(true);

    try {
      // Monta histórico no formato exigido pela LLM
      const historyPayload: ChatHistoryMessage[] = novaLista
        .filter(m => m.id !== 'welcome-1')
        .map(m => ({
          role: m.role,
          content: m.content
        }));

      const farmContext = buildFarmContext();
      const result = await AiDiagnosticService.askChat(historyPayload, farmContext);

      const aiMsg: UiChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: result.answer,
        timestamp: new Date(),
        model: result.model
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      console.warn('Falha na consulta remota, acionando motor técnico de contingência Spartan:', error);
      const fallback = AiDiagnosticService.getExpertAnswer(promptLimpo);
      
      const fallbackMsg: UiChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: fallback,
        timestamp: new Date(),
        model: 'Spartan Expert Engine (Contingência)'
      };

      setMessages(prev => [...prev, fallbackMsg]);
      toast.info('Resposta gerada pelo motor técnico especialista Spartan.');
    } finally {
      setCarregando(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    enviarMensagem(inputMensagem);
  };

  const handleCopyMessage = (id: string, content: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    toast.success('Resposta copiada para a área de transferência!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleLimparChat = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content: `🔄 **Chat reiniciado!** Estou com a memória limpa e pronto para uma nova análise ou dúvida técnica sobre sua farm. Como posso te ajudar?`,
        timestamp: new Date(),
        model: 'Spartan AI'
      }
    ]);
    toast.success('Conversa reiniciada.');
  };

  const hasCustomKey = Boolean(customKey.trim());

  return (
    <div className="space-y-6">
      {/* NAVEGAÇÃO DE SUB-ABAS DO SPARTAN AI */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-1.5 rounded-2xl bg-slate-900 border border-slate-800 shadow-md">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setMainTab('diagnostico')}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
              mainTab === 'diagnostico'
                ? 'bg-gradient-to-r from-amber-500 to-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
          >
            <Bot className="w-4 h-4" />
            <span>⚡ Spartan AI Copilot 3D</span>
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[9px] py-0 px-1.5 font-bold ml-0.5">
              LIVE
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => setMainTab('estrategia')}
            className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs transition-all ${
              mainTab === 'estrategia'
                ? 'bg-gradient-to-r from-amber-500 to-indigo-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-slate-850'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>🎯 O que Imprimir & Estratégia de Lucro</span>
            {!isProOrHigher && (
              <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[9px] py-0 px-1.5 font-black ml-0.5">
                👑 PRO
              </Badge>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center pr-2">
          {mainTab === 'diagnostico' ? (
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
              <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 text-xs flex items-center gap-1">
                <Cpu className="w-3 h-3 text-amber-400" />
                {hasCustomKey ? `${customProvider.toUpperCase()} Custom` : 'Groq High-Speed LLM'}
              </Badge>
            </div>
          ) : (
            <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-xs flex items-center gap-1.5 py-1 px-3">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              {isProOrHigher ? 'Spartan PRO · Inteligência Ativa' : 'Recurso Avançado PRO'}
            </Badge>
          )}
        </div>
      </div>

      {/* RENDERIZAÇÃO DA SUB-ABA ATIVA */}
      {mainTab === 'estrategia' ? (
        isProOrHigher ? (
          <SpartanAiFarmStrategy />
        ) : (
          <Card className="bg-slate-900 border-slate-800 rounded-2xl p-6 sm:p-10 text-center max-w-2xl mx-auto shadow-2xl space-y-6">
            <div className="p-3.5 rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-600 text-white shadow-xl mx-auto w-fit">
              <Sparkles className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 px-3 py-1 text-xs font-bold text-amber-400">
                👑 Exclusivo para Planos PRO & Business
              </div>
              <h3 className="text-xl sm:text-2xl font-black text-white">
                Conselheiro Inteligente · O que Imprimir & Estratégia de Lucro
              </h3>
              <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
                Otimize sua farm de impressão 3D com inteligência artificial: cruze seu estoque real com seus projetos, elimine sobras e maximize o faturamento e o lucro líquido.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left pt-2">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <span className="text-emerald-400">💰</span> Maximização de Lucro
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Cálculo automático de lotes lucrativos por carretel e métricas de lucro por hora de máquina.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <span className="text-teal-400">♻️</span> Zero Desperdício
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Aproveitamento de sobras de carretel (&lt;220g) em brindes e peças de giro rápido.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <span className="text-cyan-400">⚡</span> Validação de Orçamentos
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Verificação em tempo real de matéria-prima para aprovar e rodar orçamentos na hora.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="flex items-center gap-2 text-xs font-bold text-white">
                  <span className="text-indigo-400">🚀</span> 1 Clique para Produção
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">
                  Dispare lotes diretamente para impressoras livres da farm ou pré-carregue na Calculadora 3D.
                </p>
              </div>
            </div>

            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Button
                size="lg"
                onClick={() => navigate('/cliente/planos')}
                className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-indigo-600 hover:opacity-95 text-white font-black text-xs sm:text-sm rounded-xl h-11 px-6 shadow-xl"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Fazer Upgrade para Spartan PRO (R$ 99/mês)
              </Button>
              <Button
                size="lg"
                variant="outline"
                onClick={() => setMainTab('diagnostico')}
                className="w-full sm:w-auto border-slate-700 bg-slate-950 text-slate-300 hover:text-white text-xs rounded-xl h-11 px-5"
              >
                Ir para Spartan AI Copilot 3D
              </Button>
            </div>
          </Card>
        )
      ) : (
        /* SUB-ABA: CHAT CONVERSACIONAL SPARTAN AI */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* PAINEL PRINCIPAL DO CHAT CONVERSACIONAL */}
          <Card className="lg:col-span-2 bg-slate-900 border-slate-800 rounded-2xl flex flex-col h-[750px] shadow-xl overflow-hidden">
            {/* CABEÇALHO DO CHAT */}
            <CardHeader className="py-3 px-4 border-b border-slate-800/80 bg-slate-950/40 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="p-2 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 text-white shadow-md">
                      <Bot className="w-5 h-5" />
                    </div>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-slate-900" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                      Spartan AI Copilot
                      <Badge variant="outline" className="text-[10px] text-amber-300 border-amber-500/40 bg-amber-500/10 py-0 px-1.5 h-4 font-mono">
                        v2.0 Conversacional
                      </Badge>
                    </CardTitle>
                    <CardDescription className="text-[11px] text-slate-400">
                      Conectado ao seu estoque ({filamentos?.length || 0} carretéis) e máquinas ({impressoras?.length || 0} impressoras)
                    </CardDescription>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleLimparChat}
                    className="h-8 text-xs text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl px-2.5"
                    title="Reiniciar conversa"
                  >
                    <RotateCcw className="w-3.5 h-3.5 mr-1" />
                    <span className="hidden sm:inline">Novo Chat</span>
                  </Button>
                </div>
              </div>
            </CardHeader>

            {/* ÁREA DE MENSAGENS COM SCROLL */}
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex gap-3 text-xs ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isUser && (
                      <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                        <Bot className="w-4 h-4" />
                      </div>
                    )}

                    <div
                      className={`max-w-[85%] sm:max-w-[80%] rounded-2xl p-3.5 space-y-2 shadow-md transition-all ${
                        isUser
                          ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-tr-none'
                          : 'bg-slate-950 border border-slate-800 text-slate-200 rounded-tl-none'
                      }`}
                    >
                      {/* Metadados da mensagem */}
                      <div className="flex items-center justify-between gap-3 text-[10px] pb-1 border-b border-slate-800/60">
                        <span className={`font-semibold flex items-center gap-1 ${isUser ? 'text-indigo-200' : 'text-amber-400'}`}>
                          {isUser ? <UserIcon className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
                          {isUser ? 'Você' : 'Spartan AI'}
                        </span>
                        
                        <div className="flex items-center gap-2 text-slate-400">
                          {!isUser && msg.model && (
                            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-indigo-300">
                              {msg.model}
                            </span>
                          )}
                          <span>
                            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {!isUser && (
                            <button
                              type="button"
                              onClick={() => handleCopyMessage(msg.id, msg.content)}
                              className="text-slate-400 hover:text-white transition-colors"
                              title="Copiar resposta"
                            >
                              {copiedId === msg.id ? (
                                <Check className="w-3 h-3 text-emerald-400" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Conteúdo Markdown da mensagem */}
                      <div className="leading-relaxed prose prose-invert max-w-none text-xs">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            h1: ({ ...props }) => <h1 className="text-sm font-bold text-white mt-2.5 mb-1 pb-1 border-b border-slate-800" {...props} />,
                            h2: ({ ...props }) => <h2 className="text-xs font-bold text-amber-300 mt-2 mb-1" {...props} />,
                            h3: ({ ...props }) => <h3 className="text-xs font-semibold text-indigo-300 mt-1.5 mb-0.5" {...props} />,
                            p: ({ ...props }) => <p className="mb-1.5 leading-relaxed" {...props} />,
                            ul: ({ ...props }) => <ul className="list-disc list-outside pl-4 mb-2 space-y-0.5" {...props} />,
                            ol: ({ ...props }) => <ol className="list-decimal list-outside pl-4 mb-2 space-y-0.5" {...props} />,
                            li: ({ ...props }) => <li className="text-xs" {...props} />,
                            strong: ({ ...props }) => <strong className="font-semibold text-white" {...props} />,
                            blockquote: ({ ...props }) => <blockquote className="border-l-2 border-amber-500 pl-2 italic text-slate-300 my-1.5" {...props} />,
                            code: ({ children, ...props }) => {
                              const isInline = !String(children).includes('\n');
                              return isInline ? (
                                <code className="rounded bg-slate-900/90 border border-slate-700/60 px-1 py-0.5 font-mono text-[11px] text-amber-300 font-semibold" {...props}>
                                  {children}
                                </code>
                              ) : (
                                <pre className="overflow-x-auto rounded-xl bg-slate-900 p-2.5 my-2 border border-slate-800 font-mono text-[11px] text-slate-200">
                                  <code {...props}>{children}</code>
                                </pre>
                              );
                            },
                            table: ({ ...props }) => (
                              <div className="overflow-x-auto my-2 rounded-lg border border-slate-800">
                                <table className="min-w-full divide-y divide-slate-800 text-[11px]" {...props} />
                              </div>
                            ),
                            th: ({ ...props }) => (
                              <th className="px-2.5 py-1.5 bg-slate-900 text-left font-semibold text-slate-300 border-b border-slate-800" {...props} />
                            ),
                            td: ({ ...props }) => (
                              <td className="px-2.5 py-1.5 border-b border-slate-800 text-slate-300" {...props} />
                            )
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      </div>
                    </div>

                    {isUser && (
                      <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                        <UserIcon className="w-4 h-4" />
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Indicador de carregamento / digitando */}
              {carregando && (
                <div className="flex gap-3 text-xs justify-start animate-in fade-in duration-200">
                  <div className="w-7 h-7 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="bg-slate-950 border border-indigo-500/30 rounded-2xl rounded-tl-none p-3.5 space-y-2 shadow-md max-w-sm">
                    <div className="flex items-center gap-2 text-indigo-300 text-xs font-semibold">
                      <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                      <span>Spartan AI processando parâmetros 3D...</span>
                    </div>
                    <div className="flex items-center gap-1.5 pt-1">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full bg-teal-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </CardContent>

            {/* SELEÇÃO DE SUGESTÕES RÁPIDAS EM ABAS */}
            <div className="px-4 py-2 border-t border-slate-800/60 bg-slate-950/60 shrink-0 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" /> Perguntas Rápidas:
                </span>
                <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setCategoriaAtiva('iniciante')}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition-all ${
                      categoriaAtiva === 'iniciante'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Iniciante
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategoriaAtiva('avancado')}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition-all ${
                      categoriaAtiva === 'avancado'
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Avançado & Slicers
                  </button>
                  <button
                    type="button"
                    onClick={() => setCategoriaAtiva('farm')}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md transition-all ${
                      categoriaAtiva === 'farm'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Gestão da Farm
                  </button>
                </div>
              </div>

              {/* Pills horizontais roláveis */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {(categoriaAtiva === 'iniciante' 
                  ? sugestoesIniciante 
                  : categoriaAtiva === 'avancado' 
                    ? sugestoesAvancado 
                    : sugestoesFarm
                ).map((sug, i) => (
                  <button
                    key={i}
                    type="button"
                    disabled={carregando}
                    onClick={() => enviarMensagem(sug.text)}
                    className="whitespace-nowrap px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/50 text-[11px] text-slate-300 hover:text-white transition-all hover:bg-slate-850 shrink-0 flex items-center gap-1"
                  >
                    <span>{sug.text}</span>
                    <ArrowRight className="w-2.5 h-2.5 text-slate-500" />
                  </button>
                ))}
              </div>
            </div>

            {/* BARRA DE INPUT E ENVIO */}
            <div className="p-3 border-t border-slate-800 bg-slate-950 shrink-0">
              <form onSubmit={handleSubmit} className="flex items-center gap-2">
                <Input
                  ref={inputRef}
                  value={inputMensagem}
                  onChange={e => setInputMensagem(e.target.value)}
                  placeholder="Pergunte ao Spartan AI (ex: como regular a retração no OrcaSlicer? ou peça soltou)..."
                  disabled={carregando}
                  className="bg-slate-900 border-slate-750 text-white rounded-xl h-11 text-xs focus-visible:ring-indigo-500"
                />
                <Button
                  type="submit"
                  disabled={carregando || !inputMensagem.trim()}
                  className="bg-gradient-to-r from-amber-500 to-indigo-600 hover:opacity-90 text-white text-xs font-bold rounded-xl h-11 px-4 shrink-0 shadow-lg"
                >
                  {carregando ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5 mr-1" />
                      <span className="hidden sm:inline">Enviar</span>
                    </>
                  )}
                </Button>
              </form>
            </div>
          </Card>

          {/* COLUNA LATERAL DE CONTEXTO & APOIO TÉCNICO */}
          <div className="space-y-4">
            {/* CARD: CONTEXTO DA SUA FARM */}
            <Card className="bg-slate-900 border-slate-800 rounded-2xl p-4 space-y-3 shadow-md">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Printer className="w-3.5 h-3.5 text-amber-400" />
                  Sua Farm Conectada à IA
                </h4>
                <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30 bg-emerald-500/10">
                  Sincronizado
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Impressoras</span>
                  <span className="text-base font-black text-white">{impressoras?.length || 0}</span>
                </div>
                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">Carretéis</span>
                  <span className="text-base font-black text-amber-400">{filamentos?.length || 0}</span>
                </div>
              </div>

              <div className="text-[11px] text-slate-400 leading-relaxed bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                A IA analisa suas máquinas e carretéis reais cadastrados no Spartan para adaptar conselhos de temperatura, bico e fatiamento à sua realidade.
              </div>
            </Card>

            {/* CARD: TEMPERATURAS MÉDIAS RECOMENDADAS */}
            <Card className="bg-slate-900 border-slate-800 rounded-2xl p-4 space-y-3 shadow-md">
              <h4 className="font-bold text-white text-xs flex items-center gap-1.5 border-b border-slate-800 pb-2">
                <Thermometer className="w-4 h-4 text-amber-400" />
                Guia Rápido de Temperaturas
              </h4>

              <div className="space-y-2 text-xs text-slate-300">
                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-white block text-xs">PLA Standard / Silk</span>
                    <span className="text-[10px] text-slate-400">Bico: 200°C - 215°C</span>
                  </div>
                  <span className="text-emerald-400 font-semibold text-[11px]">Mesa: 55°C - 60°C</span>
                </div>

                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-white block text-xs">PETG</span>
                    <span className="text-[10px] text-slate-400">Bico: 230°C - 245°C</span>
                  </div>
                  <span className="text-cyan-400 font-semibold text-[11px]">Mesa: 70°C - 80°C</span>
                </div>

                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-white block text-xs">ABS / ASA</span>
                    <span className="text-[10px] text-slate-400">Bico: 240°C - 260°C</span>
                  </div>
                  <span className="text-amber-400 font-semibold text-[11px]">Mesa: 95°C - 110°C</span>
                </div>

                <div className="p-2 rounded-xl bg-slate-950 border border-slate-800 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-white block text-xs">TPU Flexível 95A</span>
                    <span className="text-[10px] text-slate-400">Bico: 215°C - 230°C</span>
                  </div>
                  <span className="text-indigo-400 font-semibold text-[11px]">Mesa: 45°C - 50°C</span>
                </div>
              </div>
            </Card>

            {/* CARD: DICA DE OURO DO ESPECIALISTA */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-amber-500/10 to-indigo-600/10 border border-amber-500/20 text-slate-300 text-[11px] space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-amber-300">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                Dica Rápida de Operação
              </div>
              <p className="leading-snug text-slate-400">
                Problemas de primeira camada? Em 90% dos casos a mesa só precisa de água morna e detergente neutro para remover gordura das mãos antes de alterar Z-offset.
              </p>
            </div>
          </div>
        </div>
      )}

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
              O Spartan AI já inclui o motor Groq ultra-rápido integrado por padrão. 
              Se você quiser usar sua própria chave pessoal ilimitada da Groq ou OpenAI, informe-a abaixo:
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
                      toast.success('Chave customizada removida. Usando motor Groq nativo da plataforma.');
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
