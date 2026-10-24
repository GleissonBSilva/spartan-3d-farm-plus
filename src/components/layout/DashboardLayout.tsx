"use client";

import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Zap,
  TrendingUp,
  Settings,
  LogOut,
  Sparkles,
  Calculator,
  Layers,
  Cpu,
  FolderKanban,
  Bot,
  Menu,
  X,
  Box,
  Bell,
  ArrowLeftRight,
  CircleDollarSign,
  MessageCircle,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import type { LucideIcon } from 'lucide-react';
import { registerPushDevice } from '@/services/notificationService';
import { canAccessAdmin } from '@/lib/permissions';
import { SPARTAN_OFFICIAL_WHATSAPP_NUMBER, SPARTAN_OFFICIAL_WHATSAPP_DISPLAY } from '@/services/whatsappService';
import { ThemeMode, initTheme, saveTheme } from '@/services/themeService';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  badgeText?: string;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  title,
  subtitle,
  badgeText,
}) => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Estados do Papel de Parede isolado por usuário/farm
  const [bgImage, setBgImage] = useState<string>('');
  const [bgOpacity, setBgOpacity] = useState<number>(0.15);
  const [bgBlur, setBgBlur] = useState<number>(4);

  useEffect(() => {
    const loadWallpaper = () => {
      if (!user?.id) {
        setBgImage('');
        setBgOpacity(0.15);
        setBgBlur(4);
        return;
      }
      try {
        const bg = localStorage.getItem(`spartan_farm_wallpaper_${user.id}`);
        const op = localStorage.getItem(`spartan_farm_opacity_${user.id}`);
        const bl = localStorage.getItem(`spartan_farm_blur_${user.id}`);

        setBgImage(bg || '');
        setBgOpacity(op ? Number(op) : 0.15);
        setBgBlur(bl ? Number(bl) : 4);
      } catch (e) {
        console.error('Erro ao ler papel de parede no DashboardLayout:', e);
      }
    };

    loadWallpaper();
    window.addEventListener('spartan_wallpaper_updated', loadWallpaper);
    return () => window.removeEventListener('spartan_wallpaper_updated', loadWallpaper);
  }, [user?.id]);

  // Tema Visual (Atual Spartan vs Rosa Sakura)
  const [currentTheme, setCurrentTheme] = useState<ThemeMode>(() => initTheme(user?.id));

  useEffect(() => {
    initTheme(user?.id);
    const handleThemeChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ theme: ThemeMode }>;
      if (customEvent.detail?.theme) {
        setCurrentTheme(customEvent.detail.theme);
      }
    };
    window.addEventListener('spartan_theme_changed', handleThemeChange);
    return () => window.removeEventListener('spartan_theme_changed', handleThemeChange);
  }, [user?.id]);

  const handleToggleTheme = () => {
    const nextTheme: ThemeMode = currentTheme === 'sakura' ? 'default' : 'sakura';
    saveTheme(nextTheme, user?.id);
    setCurrentTheme(nextTheme);
    toast.success(nextTheme === 'sakura' ? '🌸 Tema Rosa Flor de Sakura ativado!' : '⚡ Tema Spartan Dark ativado!');
  };

  const hasAdminAccess = canAccessAdmin(user);
  const isAdmin = location.pathname.startsWith('/admin');

  const adminNavItems: Array<{ label: string; href: string; icon: LucideIcon; badge?: string; highlight?: boolean }> = [
    { label: 'Visão Geral (MRR SaaS)', href: '/admin', icon: LayoutDashboard },
    { label: 'Makers & Assinantes', href: '/admin/clientes', icon: Users },
    { label: 'Financeiro & Pix', href: '/admin/financeiro', icon: CreditCard },
    { label: 'Planos Spartan 3D', href: '/admin/planos', icon: TrendingUp },
    { label: 'Copilot Administrativo', href: '/admin/ia-copilot', icon: Bot },
    { label: 'Webhooks', href: '/admin/webhooks', icon: Bell },
  ];

  const clientNavItems: Array<{ label: string; href: string; icon: LucideIcon; badge?: string; highlight?: boolean }> = [
    { label: 'Meu Painel 3D', href: '/cliente', icon: LayoutDashboard },
    { label: 'Financeiro & Lucro', href: '/cliente/financeiro', icon: CircleDollarSign },
    { label: 'Calculadora de Custos', href: '/cliente/calculadora', icon: Calculator, badge: 'CALC' },
    { label: 'Estoque de Filamentos', href: '/cliente/estoque', icon: Layers },
    { label: 'Parque de Impressoras', href: '/cliente/impressoras', icon: Cpu },
    { label: 'Projetos & Orçamentos', href: '/cliente/projetos', icon: FolderKanban },
    { label: 'Spartan AI (Diagnóstico)', href: '/cliente/ia-copilot', icon: Bot, badge: 'IA' },
    { label: 'Upgrade de Plano', href: '/cliente/planos', icon: Zap, highlight: true },
    { label: 'Minhas Faturas', href: '/cliente/faturas', icon: CreditCard },
    { label: 'Configurações da Farm', href: '/cliente/configuracoes', icon: Settings },
  ];

  const navItems = isAdmin ? adminNavItems : clientNavItems;

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
      toast.info('Sessão encerrada.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível encerrar a sessão.');
    }
  };

  const handleEnableNotifications = async () => {
    if (!user) return;
    try { await registerPushDevice(user); toast.success('Notificações ativadas neste dispositivo.'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível ativar notificações.'); }
  };

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased overflow-x-hidden">
      {/* Camada fixa do Papel de Parede em todas as abas */}
      {bgImage && (
        <div 
          className="fixed inset-0 pointer-events-none z-0 bg-cover bg-center transition-all duration-500"
          style={{ 
            backgroundImage: `url(${bgImage})`,
            opacity: bgOpacity,
            filter: `blur(${bgBlur}px)`
          }}
        />
      )}

      {/* Conteúdo geral acima da camada de fundo */}
      <div className="relative z-10 flex flex-col min-h-screen">
        {/* Top Mobile Bar */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/90 sticky top-0 z-40 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold">
              <Box className="w-4 h-4" />
            </div>
            <span className="font-bold text-white tracking-tight">SPARTAN 3D PRINT</span>
          </div>
          {!isAdmin && (
            <a
              href={`https://wa.me/${SPARTAN_OFFICIAL_WHATSAPP_NUMBER}?text=${encodeURIComponent(`Olá, Spartan 3D! Preciso de ajuda com a minha farm${user?.companyName ? ` (${user.companyName})` : ''}.`)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Suporte via WhatsApp"
              className="mr-1 h-10 w-10 flex items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 transition-colors"
              title={`Suporte WhatsApp Spartan 3D (${SPARTAN_OFFICIAL_WHATSAPP_DISPLAY})`}
            >
              <MessageCircle className="h-5 w-5" />
            </a>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={handleToggleTheme}
            aria-label="Alternar tema de cor"
            title={currentTheme === 'sakura' ? 'Mudar para Tema Atual (Spartan Dark)' : 'Mudar para Tema Rosa Flor de Sakura'}
            className="mr-1 h-10 w-10 p-0 flex items-center justify-center rounded-xl border border-pink-500/30 bg-pink-500/10 text-pink-300 hover:bg-pink-500/20 text-base"
          >
            {currentTheme === 'sakura' ? '🌸' : '⚡'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleEnableNotifications}
            aria-label="Ativar notificações push"
            className="mr-1 h-10 gap-2 rounded-xl border border-indigo-400/40 bg-indigo-500/15 px-3 text-indigo-100 hover:bg-indigo-500/25 hover:text-white"
          >
            <Bell className="h-4 w-4" />
            <span className="text-xs font-semibold">Avisos</span>
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 text-slate-300"
          >
            {sidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </Button>
        </div>

        <div className="flex-1 flex">
          {/* Sidebar */}
          <aside
            className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900/95 border-r border-slate-800 flex flex-col transition-transform duration-200 lg:static lg:translate-x-0 ${
              sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            }`}
          >
            {/* Brand header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <Link to="/" className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-md shadow-indigo-600/30">
                  <Box className="w-5 h-5 text-white" />
                </div>
                <div>
                  <span className="font-black text-lg tracking-tight text-white block">SPARTAN 3D</span>
                  <span className="text-[10px] text-slate-400 font-medium tracking-wide uppercase">
                    {isAdmin ? 'Administração da plataforma' : 'Gestão de impressão 3D'}
                  </span>
                </div>
              </Link>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* User profile snippet */}
            <div className="p-4 mx-3 my-3 rounded-xl bg-slate-800/60 border border-slate-750 flex items-center gap-3">
              {user?.avatar ? (
                <img src={user.avatar} alt={`Foto ou logo de ${user.name || user.companyName || 'sua conta'}`} className="w-10 h-10 rounded-full object-cover border-2 border-indigo-500/50" />
              ) : (
                <div aria-hidden="true" className="w-10 h-10 rounded-full border-2 border-indigo-500/50 bg-indigo-500/20 flex items-center justify-center text-sm font-bold text-indigo-100">
                  {(user?.name || user?.companyName || 'M').trim().charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{user?.name || 'Maker'}</p>
                <p className="text-xs text-slate-400 truncate">{user?.companyName || 'Estúdio 3D'}</p>
                {user && <p className="mt-0.5 truncate text-[9px] font-semibold uppercase tracking-wide text-indigo-300">{[user.role === 'client' ? 'Cliente' : user.role, ...(user.platformRoles || []), user.planId === 'plan_enterprise' ? 'SPARTAN BUSINESS' : ''].filter(Boolean).join(' · ')}</p>}
              </div>
            </div>

            {hasAdminAccess && <Link to={isAdmin ? '/cliente' : '/admin'} onClick={() => setSidebarOpen(false)} className="mx-3 mb-2 flex items-center gap-2 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-3 py-2 text-xs font-semibold text-indigo-200 hover:bg-indigo-500/20"><ArrowLeftRight className="h-3.5 w-3.5" />{isAdmin ? 'Abrir Minha Farm' : 'Abrir Admin / Dev'}</Link>}

            {/* Navigation Links */}
            <div className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
              <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                {isAdmin ? 'Painel Administrativo' : 'Módulos de Impressão 3D'}
              </p>
              {navItems.map(item => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href || (item.href === '/admin/financeiro' && location.pathname === '/admin/cobranca');
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setSidebarOpen(false)}
                    className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 font-semibold'
                        : item.highlight
                        ? 'bg-gradient-to-r from-amber-500/10 to-indigo-500/10 text-amber-300 border border-amber-500/20 hover:bg-amber-500/20'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-slate-800 text-indigo-400 border border-indigo-500/30'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Suporte WhatsApp no menu lateral do cliente */}
            {!isAdmin && (
              <div className="mx-3 mb-2 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/20">
                <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs mb-1">
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Suporte Spartan 3D</span>
                </div>
                <p className="text-[11px] text-slate-400 mb-2">Canal direto via WhatsApp com a nossa equipe.</p>
                <a
                  href={`https://wa.me/${SPARTAN_OFFICIAL_WHATSAPP_NUMBER}?text=${encodeURIComponent(`Olá, Spartan 3D! Preciso de ajuda com a minha farm${user?.companyName ? ` (${user.companyName})` : ''}.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors shadow-sm"
                  title="Abrir WhatsApp oficial"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>{SPARTAN_OFFICIAL_WHATSAPP_DISPLAY}</span>
                </a>
              </div>
            )}

            {/* Footer of sidebar */}
            <div className="p-4 border-t border-slate-800 flex items-center justify-between">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-xs text-slate-400 hover:text-rose-400 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>Sair da conta</span>
              </button>
              <span className="text-[10px] text-slate-400">v3.2 Spartan</span>
            </div>
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 flex flex-col min-w-0 bg-slate-950/40 backdrop-blur-[2px] overflow-y-auto pb-24 lg:pb-16">
            {/* Header */}
            <header className="px-6 py-4 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md flex flex-wrap items-center justify-between gap-4 sticky top-0 z-30">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl md:text-2xl font-black text-white tracking-tight">{title}</h1>
                  {badgeText && (
                    <Badge className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30 text-xs">
                      {badgeText}
                    </Badge>
                  )}
                </div>
                {subtitle && <p className="text-xs md:text-sm text-slate-400 mt-0.5">{subtitle}</p>}
              </div>
              <div className="flex items-center gap-2">
                {!isAdmin && (
                  <Button
                    asChild
                    size="sm"
                    className="h-10 border border-emerald-500/40 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white px-3.5 font-semibold transition-all rounded-xl shadow-sm"
                  >
                    <a
                      href={`https://wa.me/${SPARTAN_OFFICIAL_WHATSAPP_NUMBER}?text=${encodeURIComponent(`Olá, Spartan 3D! Preciso de ajuda com a minha farm${user?.companyName ? ` (${user.companyName})` : ''}.`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`Canal oficial Spartan 3D: ${SPARTAN_OFFICIAL_WHATSAPP_DISPLAY}`}
                    >
                      <MessageCircle className="mr-2 h-4 w-4 text-emerald-400" />
                      <span className="hidden sm:inline">Suporte WhatsApp</span>
                      <span className="sm:hidden">WhatsApp</span>
                    </a>
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleToggleTheme}
                  title={currentTheme === 'sakura' ? 'Mudar para Tema Spartan Dark (Atual)' : 'Mudar para Tema Rosa Flor de Sakura (Feminino)'}
                  className={`h-10 px-3.5 rounded-xl border transition-all font-semibold text-xs flex items-center gap-1.5 shadow-sm ${
                    currentTheme === 'sakura'
                      ? 'border-pink-500/50 bg-pink-500/20 text-pink-200 hover:bg-pink-500/30'
                      : 'border-slate-700 bg-slate-900 text-slate-300 hover:text-white hover:border-slate-600'
                  }`}
                >
                  <span className="text-sm">{currentTheme === 'sakura' ? '🌸' : '⚡'}</span>
                  <span className="hidden sm:inline font-bold">
                    {currentTheme === 'sakura' ? 'Rosa Sakura' : 'Tema Atual'}
                  </span>
                </Button>
                <Button size="sm" variant="outline" onClick={handleEnableNotifications} aria-label="Ativar notificações push" className="h-10 border-indigo-400/40 bg-indigo-500/15 px-4 text-sm font-semibold text-indigo-100 hover:bg-indigo-500/25 hover:text-white"><Bell className="mr-2 h-4 w-4" />Ativar avisos</Button>
              </div>
            </header>

            {/* Children View */}
            <div className="p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
              {/* Alerta de Período de Teste Gratuito para o Cliente */}
              {!isAdmin && user?.status === 'trialing' && (() => {
                const trialEndMs = user.trialEndsAt
                  ? new Date(user.trialEndsAt).getTime()
                  : (user.joinedAt ? new Date(user.joinedAt).getTime() + 14 * 24 * 60 * 60 * 1000 : Date.now());
                const remainingDays = Math.max(0, Math.ceil((trialEndMs - Date.now()) / (24 * 60 * 60 * 1000)));
                const isUrgent = remainingDays <= 3;
                const endDate = new Date(trialEndMs).toLocaleDateString('pt-BR');

                return (
                  <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-lg ${
                    isUrgent
                      ? 'bg-gradient-to-r from-amber-950/70 via-slate-900 to-slate-900 border-amber-500/50 text-amber-200'
                      : 'bg-gradient-to-r from-indigo-950/50 via-slate-900 to-slate-900 border-indigo-500/30 text-indigo-200'
                  }`}>
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl shrink-0 ${isUrgent ? 'bg-amber-500/20 text-amber-400' : 'bg-indigo-500/20 text-indigo-400'}`}>
                        {isUrgent ? <AlertTriangle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-white">
                            {isUrgent
                              ? `Atenção: Seu teste grátis encerra em ${remainingDays} dia${remainingDays === 1 ? '' : 's'}!`
                              : `Período de Teste Grátis: ${remainingDays} dias restantes`}
                          </p>
                          <Badge variant="outline" className={isUrgent ? 'border-amber-400/50 text-amber-300 bg-amber-400/10 text-[10px]' : 'border-indigo-400/40 text-indigo-300 bg-indigo-500/10 text-[10px]'}>
                            Até {endDate}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-300 mt-0.5">
                          Para manter suas impressoras, filamentos e histórico de peças ativos após o término, ative sua assinatura.
                        </p>
                      </div>
                    </div>
                    <Link
                      to="/cliente/planos"
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md shrink-0 flex items-center gap-1.5 ${
                        isUrgent
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                          : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                      }`}
                    >
                      <Zap className="w-3.5 h-3.5" />
                      Ativar Plano Definitivo
                    </Link>
                  </div>
                );
              })()}

              {children}
            </div>
          </main>
        </div>
      </div>

      {/* Botão Flutuante de WhatsApp exclusivo para o Portal do Cliente */}
      {!isAdmin && (
        <a
          href={`https://wa.me/${SPARTAN_OFFICIAL_WHATSAPP_NUMBER}?text=${encodeURIComponent(`Olá, Spartan 3D! Preciso de suporte para a minha farm${user?.companyName ? ` (${user.companyName})` : ''}.`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs md:text-sm shadow-xl shadow-emerald-950/60 hover:scale-105 active:scale-95 transition-all group border border-emerald-400/40"
          title={`Falar no WhatsApp Spartan 3D: ${SPARTAN_OFFICIAL_WHATSAPP_DISPLAY}`}
        >
          <MessageCircle className="w-5 h-5 text-white" />
          <span className="hidden sm:inline">Suporte (92) 99374-6740</span>
        </a>
      )}
    </div>
  );
};