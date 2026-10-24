"use client";

import React, { useRef, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { User } from '@/types/saas';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { Camera, ImagePlus, UserRound } from 'lucide-react';

interface ClientSettingsFormProps {
  user: User | null;
  onUpdateUserProfile: (data: Partial<User>) => Promise<void>;
}

export const ClientSettingsForm: React.FC<ClientSettingsFormProps> = ({ user, onUpdateUserProfile }) => {
  const [clientName, setClientName] = useState(user?.name || '');
  const [companyName, setCompanyName] = useState(user?.companyName || '');
  const [companyPhone, setCompanyPhone] = useState(user?.companyPhone || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!user?.id || !supabase) { toast.error('Entre na conta para alterar a imagem.'); return; }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 3 * 1024 * 1024) {
      toast.error('Use uma imagem JPG, PNG ou WebP de até 3 MB.'); return;
    }
    setSaving(true);
    try {
      const path = `${user.id}/identity-${Date.now()}.${file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'}`;
      const { error: uploadError } = await supabase.storage.from('profile-images').upload(path, file, { upsert: true, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('profile-images').getPublicUrl(path);
      await onUpdateUserProfile({ avatar: data.publicUrl });
      setAvatar(data.publicUrl);
      toast.success('Imagem de perfil atualizada.');
    } catch (error) {
      toast.error(`Não foi possível enviar a imagem: ${error instanceof Error ? error.message : 'erro inesperado'}`);
    } finally { setSaving(false); }
  };

  const handleSaveSettings = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await onUpdateUserProfile({ name: clientName.trim(), companyName: companyName.trim(), companyPhone: companyPhone.trim() });
      toast.success('Dados da conta atualizados.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Não foi possível salvar as alterações.');
    } finally { setSaving(false); }
  };

  return (
    <Card className="bg-slate-900 border-slate-800 rounded-2xl p-5 sm:p-6 max-w-3xl">
      <CardHeader className="p-0 pb-5">
        <CardTitle className="text-lg sm:text-xl text-white font-bold">Perfil e dados da empresa</CardTitle>
        <CardDescription className="text-sm text-slate-300 leading-relaxed">Personalize sua identificação e mantenha os dados do estúdio atualizados.</CardDescription>
      </CardHeader>
      <CardContent className="p-0 pt-1 space-y-6">
        <section className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl border border-slate-700 bg-slate-950/50 p-4">
          <div className="h-16 w-16 overflow-hidden rounded-full border-2 border-indigo-400 bg-slate-800 flex items-center justify-center shrink-0">
            {avatar ? <img src={avatar} alt="Imagem de perfil ou logo do estúdio" className="h-full w-full object-cover" /> : <UserRound className="h-8 w-8 text-slate-400" />}
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white">Foto de perfil ou logo do estúdio</h3>
            <p className="mt-1 text-sm text-slate-400">JPG, PNG ou WebP · até 3 MB. Essa imagem aparece junto ao seu perfil.</p>
          </div>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImage} className="sr-only" aria-label="Escolher foto ou logo" />
          <Button type="button" variant="outline" disabled={saving} onClick={() => fileRef.current?.click()} className="h-10 border-slate-600 bg-slate-800 text-sm text-white hover:bg-slate-700">
            {avatar ? <Camera className="mr-2 h-4 w-4" /> : <ImagePlus className="mr-2 h-4 w-4" />}{avatar ? 'Trocar imagem' : 'Adicionar imagem'}
          </Button>
        </section>
        <form onSubmit={handleSaveSettings} className="space-y-4">
          <div>
            <label htmlFor="profile-name" className="text-sm text-slate-200 block mb-1.5 font-medium">Nome do responsável</label>
            <Input id="profile-name" required maxLength={120} value={clientName} onChange={e => setClientName(e.target.value)} className="bg-slate-950 border-slate-700 text-white text-sm rounded-xl h-11" />
          </div>
          <div>
            <label htmlFor="company-name" className="text-sm text-slate-200 block mb-1.5 font-medium">Nome da empresa ou estúdio</label>
            <Input id="company-name" required maxLength={120} value={companyName} onChange={e => setCompanyName(e.target.value)} className="bg-slate-950 border-slate-700 text-white text-sm rounded-xl h-11" />
          </div>
          <div>
            <label htmlFor="company-phone" className="text-sm text-slate-200 block mb-1.5 font-medium">Telefone / WhatsApp comercial</label>
            <Input id="company-phone" type="tel" autoComplete="tel" maxLength={30} placeholder="Ex.: +55 11 99999-9999" value={companyPhone} onChange={e => setCompanyPhone(e.target.value)} className="bg-slate-950 border-slate-700 text-white text-sm rounded-xl h-11" />
            <p className="mt-1.5 text-xs text-slate-400">Esse contato será exibido nas propostas comerciais.</p>
          </div>
          <div>
            <label htmlFor="account-email" className="text-sm text-slate-200 block mb-1.5 font-medium">E-mail da conta</label>
            <Input id="account-email" disabled value={user?.email || ''} className="bg-slate-950/50 border-slate-800 text-slate-400 text-sm rounded-xl h-11 disabled:opacity-100" />
            <p className="mt-1.5 text-xs text-slate-400">Para alterar o e-mail, use as opções de segurança da conta.</p>
          </div>
          <Button type="submit" disabled={saving} className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl h-11 px-6">{saving ? 'Salvando…' : 'Salvar alterações'}</Button>
        </form>
      </CardContent>
    </Card>
  );
};
