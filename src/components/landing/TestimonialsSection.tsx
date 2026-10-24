"use client";

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star } from 'lucide-react';

export const TestimonialsSection: React.FC = () => {
  const testimonials = [
    {
      text: "Eu tinha 8 impressoras e perdia dinheiro porque não calculava a energia do ar condicionado e a perda de carretel. O Spartan 3D organizou meu estoque e aumentou minha margem em 40%.",
      name: "Felipe Santos",
      role: "Dono da 3D Hero Studio (12 Bambu P1S)",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80",
    },
    {
      text: "Os clientes adoram receber o orçamento formalizado direto no WhatsApp com detalhamento de tempo e material. Fecho mais de 80% das cotações que envio.",
      name: "Camila Prado",
      role: "Fundadora da Prototipar 3D",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
    },
    {
      text: "Trabalhamos com Resina SLA e FDM. O controle de horas de bico e filme FEP me poupou milhares de reais em falhas catastróficas.",
      name: "Rodrigo Meirelles",
      role: "Engenheiro na Spartan Industrial Lab",
      avatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&auto=format&fit=crop&q=80",
    },
  ];

  return (
    <section id="depoimentos" className="py-20 px-4">
      <div className="container max-w-6xl mx-auto space-y-12">
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs">
            CASOS REAIS DE MAKERS
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-black text-white">
            Quem usa o Spartan 3D não volta para planilhas
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((item, idx) => (
            <Card key={idx} className="bg-slate-900 border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex gap-1 text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-amber-400" />
                ))}
              </div>
              <p className="text-xs text-slate-300 italic leading-relaxed">
                "{item.text}"
              </p>
              <div className="flex items-center gap-3 pt-2 border-t border-slate-800">
                <img
                  src={item.avatar}
                  alt={item.name}
                  className="w-9 h-9 rounded-full object-cover"
                />
                <div>
                  <p className="text-xs font-bold text-white">{item.name}</p>
                  <p className="text-[10px] text-slate-400">{item.role}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};