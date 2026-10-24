"use client";

import React, { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { UserPlus } from 'lucide-react';
import { Plan, User } from '@/types/saas';
import { toast } from 'sonner';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface ClientTeamManagerProps {
  user: User | null;
  currentPlan: Plan;
}

export const ClientTeamManager: React.FC<ClientTeamManagerProps> = ({ user, currentPlan }) => {
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberName, setNewMemberName] = useState('');

  useEffect(() => {
    if (!user) {
      setTeamMembers([]);
      return;
    }
    setTeamMembers([
      {
        id: user.id,
        name: user.name || user.companyName || 'Proprietário',
        email: user.email,
        role: 'Proprietário',
      },
    ]);
  }, [user?.id, user?.name, user?.companyName, user?.email]);

  const handleAddTeamMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName || !newMemberEmail) return;
    setTeamMembers(prev => [
      ...prev,
      { id: String(Date.now()), name: newMemberName, email: newMemberEmail, role: 'Membro da Equipe' },
    ]);
    setNewMemberName('');
    setNewMemberEmail('');
    toast.success('Convite enviado por e-mail para o novo membro!');
  };

  return (
    <div className="space-y-6">
      <Card className="bg-slate-900 border-slate-800 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <div>
            <h3 className="text-base font-bold text-white">Membros da sua Equipe</h3>
            <p className="text-xs text-slate-400">
              Seu plano {currentPlan.name} suporta até {currentPlan.maxUsers} assentos de usuários.
            </p>
          </div>

          <form onSubmit={handleAddTeamMember} className="flex gap-2 w-full sm:w-auto">
            <Input
              required
              placeholder="Nome"
              value={newMemberName}
              onChange={e => setNewMemberName(e.target.value)}
              className="bg-slate-950 border-slate-750 text-white text-xs h-9"
            />
            <Input
              required
              type="email"
              placeholder="E-mail"
              value={newMemberEmail}
              onChange={e => setNewMemberEmail(e.target.value)}
              className="bg-slate-950 border-slate-750 text-white text-xs h-9"
            />
            <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-xl h-9 shrink-0">
              <UserPlus className="w-3.5 h-3.5 mr-1" /> Convidar
            </Button>
          </form>
        </div>

        <div className="divide-y divide-slate-800">
          {teamMembers.map(member => (
            <div key={member.id} className="py-3.5 flex justify-between items-center text-xs">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-slate-800 text-indigo-400 font-bold flex items-center justify-center border border-slate-700">
                  {member.name.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-white">{member.name}</p>
                  <p className="text-slate-400 text-[11px]">{member.email}</p>
                </div>
              </div>
              <Badge variant="outline" className="border-indigo-500/30 text-indigo-300">
                {member.role}
              </Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};