import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { canAccessAdmin } from '@/lib/permissions';
import { SubscriptionBlockedScreen } from '@/components/auth/SubscriptionBlockedScreen';

export const RequireRole: React.FC<{ roles: Array<'admin' | 'client' | 'manager'>; children: React.ReactNode }> = ({ roles, children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (!isSupabaseConfigured) {
    return <main className="min-h-screen bg-slate-950 p-6 text-white grid place-items-center"><Card className="max-w-lg bg-slate-900 border-slate-700"><CardContent className="p-6 space-y-2"><h1 className="text-lg font-bold">Configure o Supabase</h1><p className="text-sm text-slate-300">Defina SUPABASE_URL e SUPABASE_ANON_KEY no arquivo .env e aplique a migração em supabase/migrations.</p></CardContent></Card></main>;
  }
  
  if (loading) return <div className="min-h-screen bg-slate-950 grid place-items-center text-slate-300" role="status">Carregando sessão…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  // Extração segura da role do usuário para evitar erro de conversão de objeto
  let userRole = '';
  const rawRole = user.role;
  if (typeof rawRole === 'string') {
    userRole = rawRole;
  } else if (rawRole && typeof rawRole === 'object') {
    const roleObj = rawRole as Record<string, unknown>;
    userRole = String(roleObj.name || roleObj.slug || '');
  }

  const isAdmin = canAccessAdmin(user);

  const joinedMs = user.joinedAt ? new Date(user.joinedAt).getTime() : NaN;
  const trialEndMs = user.trialEndsAt
    ? new Date(user.trialEndsAt).getTime()
    : (Number.isFinite(joinedMs) ? joinedMs + 14 * 24 * 60 * 60 * 1000 : NaN);
  const isTrialExpired =
    user.status === 'trialing' &&
    Number.isFinite(trialEndMs) &&
    Date.now() >= trialEndMs;

  // Bloqueio imediato de acesso para clientes (não-admin) com status 'overdue', 'canceled' ou teste de 14 dias expirado
  if (!isAdmin && (user.status === 'overdue' || user.status === 'canceled' || isTrialExpired)) {
    return <SubscriptionBlockedScreen />;
  }

  // Admins e desenvolvedores têm acesso irrestrito tanto ao admin quanto à farm (/cliente).
  // Usuários comuns acessam as rotas autorizadas para seu perfil.
  const allowed = isAdmin || roles.includes(userRole as 'admin' | 'client' | 'manager');
  
  if (!allowed) {
    return <Navigate to={isAdmin ? '/admin' : '/cliente'} replace />;
  }

  return <>{children}</>;
};