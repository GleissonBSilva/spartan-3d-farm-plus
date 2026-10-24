import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, Mail, Phone, UserRound, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/context/AuthContext';
import { formatPhoneMask, sendWelcomeWhatsApp } from '@/services/whatsappService';
import { toast } from 'sonner';

const Register: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhoneMask(e.target.value));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const hasSession = await register({ name, companyName, email, password, phone });

      // Dispara a automação de boas-vindas para o WhatsApp informado
      if (phone.replace(/\D/g, '').length >= 10) {
        try {
          const waResult = await sendWelcomeWhatsApp({ phone, companyName, name });
          if (waResult.success) {
            toast.success('Conta criada! Mensagem de boas-vindas da Spartan 3D preparada para o seu WhatsApp.', {
              description: `Enviada para ${phone} a partir do número oficial (92) 99374-6740`,
            });
          }
        } catch (waError) {
          console.warn('Falha no envio da mensagem de WhatsApp:', waError);
        }
      }

      toast.success(hasSession ? 'Conta criada com sucesso.' : 'Conta criada. Confira seu e-mail para confirmar o cadastro.');
      navigate(hasSession ? '/cliente' : '/login');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível criar a conta.');
    } finally { setLoading(false); }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <Link to="/" className="inline-flex items-center gap-2 text-white font-black text-2xl"><Zap className="text-amber-400" />SPARTAN 3D</Link>
          <h1 className="mt-5 text-2xl font-bold">Crie sua conta</h1>
          <p className="mt-1 text-sm text-slate-400">Sua conta cria uma empresa isolada no Supabase.</p>
        </div>
        <Card className="bg-slate-900 border-slate-800 rounded-2xl">
          <CardHeader><CardTitle className="text-white">Dados da farm</CardTitle><CardDescription>Você poderá convidar sua equipe depois.</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <label className="block text-sm text-slate-300">Nome completo<div className="relative mt-1"><UserRound className="absolute left-3 top-3 h-4 w-4 text-slate-500" /><Input autoComplete="name" required value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Gleison Silva" className="pl-9 bg-slate-950 border-slate-700" /></div></label>
              <label className="block text-sm text-slate-300">Nome da sua Farm / Empresa<div className="relative mt-1"><Building2 className="absolute left-3 top-3 h-4 w-4 text-slate-500" /><Input autoComplete="organization" required value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Ex.: Oficina 3D Pro" className="pl-9 bg-slate-950 border-slate-700" /></div></label>
              <label className="block text-sm text-slate-300">
                WhatsApp / Celular com DDD
                <div className="relative mt-1">
                  <Phone className="absolute left-3 top-3 h-4 w-4 text-emerald-400" />
                  <Input
                    autoComplete="tel"
                    type="tel"
                    required
                    value={phone}
                    onChange={handlePhoneChange}
                    placeholder="(92) 99999-9999"
                    maxLength={15}
                    className="pl-9 bg-slate-950 border-slate-700"
                  />
                </div>
                <span className="text-xs text-slate-400 mt-1 block">Receba orientações de ativação da Spartan 3D via WhatsApp.</span>
              </label>
              <label className="block text-sm text-slate-300">E-mail<div className="relative mt-1"><Mail className="absolute left-3 top-3 h-4 w-4 text-slate-500" /><Input autoComplete="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" className="pl-9 bg-slate-950 border-slate-700" /></div></label>
              <label className="block text-sm text-slate-300">Senha (mínimo 8 caracteres)<Input autoComplete="new-password" type="password" required minLength={8} value={password} onChange={e => setPassword(e.target.value)} className="mt-1 bg-slate-950 border-slate-700" /></label>
              <Button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium">{loading ? 'Criando conta...' : 'Criar conta com suporte WhatsApp'}<ArrowRight className="ml-2 h-4 w-4" /></Button>
            </form>
            <p className="mt-5 text-center text-sm text-slate-400">Já tem uma conta? <Link to="/login" className="text-indigo-300 hover:underline">Entrar</Link></p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
};

export default Register;
