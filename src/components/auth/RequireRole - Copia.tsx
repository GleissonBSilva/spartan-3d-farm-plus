import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { isSupabaseConfigured } from '@/lib/supabase';
import { Card, CardContent } from '@/components/ui/card';
import { canAccessAdmin } from '@/lib/permissions';

export const RequireRole: React.FC<{ roles: Array<'admin' | 'client' | 'manager'>; children: React.ReactNode }> = ({ roles, children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (!isSupabaseConfigured) {
    return <main className="min-h-screen bg-slate-950 p-6 text-white grid place-items-center"><Card className="max-w-lg bg-slate-900 border-slate-700"><CardContent className="p-6 space-y-2"><h1 className="text-lg font-bold">Configure o Supabase</h1><p className="text-sm text-slate-300">Defina SUPABASE_URL e SUPABASE_ANON_KEY no arquivo .env e aplique a migração em supabase/migrations.</p></CardContent></Card></main>;
  }
  if (loading) return <div className="min-h-screen bg-slate-950 grid place-items-center text-slate-300" role="status">Carregando sessão…</div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  const allowed = (roles.includes('admin') && canAccessAdmin(user)) || roles.includes(user.role);
  if (!allowed) return <Navigate to={canAccessAdmin(user) && user.role === 'admin' ? '/admin' : '/cliente'} replace />;
  return <>{children}</>;
};
