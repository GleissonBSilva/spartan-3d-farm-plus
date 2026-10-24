import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, Mail, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

const Login: React.FC = () => {
  const { login, resetPassword } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      navigate('/cliente');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível entrar.');
    } finally { setLoading(false); }
  };

  const recover = async () => {
    if (!email.trim()) { toast.error('Informe seu e-mail para recuperar a senha.'); return; }
    try {
      await resetPassword(email);
      toast.success('Se o e-mail estiver cadastrado, você receberá um link de recuperação.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível solicitar a recuperação.'); }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2 text-white font-black text-2xl"><Zap className="text-amber-400" />SPARTAN 3D</Link>
          <h1 className="mt-5 text-xl font-bold">Entrar na sua farm</h1>
          <p className="mt-1 text-sm text-slate-400">Use o e-mail e a senha da sua conta.</p>
        </div>
        <Card className="bg-slate-900 border-slate-800 rounded-2xl">
          <CardHeader><CardTitle className="text-white">Acessar conta</CardTitle><CardDescription>Autenticação protegida pelo Supabase.</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <label className="block text-sm text-slate-300">E-mail<Input autoComplete="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} className="mt-1 bg-slate-950 border-slate-700" /></label>
              <label className="block text-sm text-slate-300">Senha<Input autoComplete="current-password" type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} className="mt-1 bg-slate-950 border-slate-700" /></label>
              <button type="button" onClick={recover} className="text-xs text-indigo-300 hover:underline">Esqueci minha senha</button>
              <Button type="submit" disabled={loading} className="w-full">{loading ? 'Entrando...' : 'Entrar'}<ArrowRight className="ml-2 h-4 w-4" /></Button>
            </form>
            <p className="mt-5 text-center text-sm text-slate-400">Ainda não tem conta? <Link to="/register" className="text-indigo-300 hover:underline">Criar conta</Link></p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default Login;
