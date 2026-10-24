import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, Home, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary capturou erro na aplicação:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleClearCacheAndReload = () => {
    try {
      if ('caches' in window) {
        caches.keys().then(keys => {
          for (const key of keys) {
            caches.delete(key);
          }
        });
      }
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => {
          for (const r of regs) r.unregister();
        });
      }
      localStorage.clear();
      sessionStorage.clear();
    } catch (e) {
      console.warn('Erro ao limpar cache local:', e);
    }
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <main className="min-h-screen bg-slate-950 p-4 sm:p-6 text-white grid place-items-center">
          <Card className="max-w-xl w-full bg-slate-900 border-slate-800 shadow-2xl rounded-2xl overflow-hidden">
            <div className="bg-rose-500/10 border-b border-rose-500/20 p-5 flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-400">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Ops, algo deu errado</h1>
                <p className="text-xs text-rose-300">
                  Um erro inesperado interrompeu o carregamento da tela.
                </p>
              </div>
            </div>

            <CardContent className="p-6 space-y-4">
              <div className="rounded-xl bg-slate-950 p-4 border border-slate-800 text-xs font-mono text-rose-300/90 overflow-x-auto max-h-48">
                <p className="font-bold text-white mb-1">Detalhes do erro:</p>
                {this.state.error?.message || 'Erro de execução desconhecido.'}
              </div>

              {this.state.errorInfo?.componentStack && (
                <details className="text-xs text-slate-400 cursor-pointer">
                  <summary className="hover:text-slate-200">Ver rastreamento do componente</summary>
                  <pre className="mt-2 p-3 bg-slate-950 border border-slate-800 rounded-lg overflow-x-auto text-[11px] text-slate-400 font-mono">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}

              <div className="flex flex-col sm:flex-row gap-2.5 pt-2 border-t border-slate-800">
                <Button
                  onClick={this.handleReload}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex-1"
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-2" /> Recarregar Página
                </Button>

                <Button
                  variant="outline"
                  onClick={this.handleClearCacheAndReload}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700 rounded-xl text-xs font-semibold flex-1"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-2 text-rose-400" /> Limpar Cache e Reiniciar
                </Button>

                <Button
                  variant="ghost"
                  onClick={() => { window.location.href = '/'; }}
                  className="text-slate-400 hover:text-white text-xs"
                >
                  <Home className="w-3.5 h-3.5 mr-1.5" /> Início
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      );
    }

    return this.props.children;
  }
}
