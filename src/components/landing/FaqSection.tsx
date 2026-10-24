"use client";

import React from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

export const FaqSection: React.FC = () => {
  return (
    <section id="faq" className="py-20 bg-slate-900/30 border-t border-slate-800/80 px-4">
      <div className="container max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h2 className="text-2xl sm:text-3xl font-black text-white">Perguntas Frequentes (FAQ)</h2>
          <p className="text-xs sm:text-sm text-slate-400">Tudo sobre o funcionamento do Spartan 3D Print</p>
        </div>

        <Accordion type="single" collapsible className="w-full space-y-3">
          <AccordionItem value="item-1" className="border border-slate-800 bg-slate-900/70 rounded-2xl px-4">
            <AccordionTrigger className="text-sm font-semibold text-white hover:no-underline">
              Como a calculadora calcula o custo exato de eletricidade?
            </AccordionTrigger>
            <AccordionContent className="text-xs text-slate-300 leading-relaxed">
              O sistema utiliza a potência nominal da fonte da sua impressora (ex: 350W da Bambu P1S ou 400W da Creality K1), calcula o consumo em kWh pelo tempo total de impressão fatiado e multiplica pela tarifa de energia (R$/kWh) configurada para a sua região.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-2" className="border border-slate-800 bg-slate-900/70 rounded-2xl px-4">
            <AccordionTrigger className="text-sm font-semibold text-white hover:no-underline">
              O sistema funciona com Resina UV SLA e Filamentos FDM?
            </AccordionTrigger>
            <AccordionContent className="text-xs text-slate-300 leading-relaxed">
              Sim! Você pode cadastrar carretéis de PLA, PETG, ABS, TPU, ASA, Nylon e também garrafas de Resina Standard, ABS-Like ou Alta Resolução 8K/12K com controle de volume restante em ml ou gramas.
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="item-3" className="border border-slate-800 bg-slate-900/70 rounded-2xl px-4">
            <AccordionTrigger className="text-sm font-semibold text-white hover:no-underline">
              Posso enviar o orçamento direto para o cliente pelo WhatsApp?
            </AccordionTrigger>
            <AccordionContent className="text-xs text-slate-300 leading-relaxed">
              Sim! Com 1 clique no botão "Gerar Orçamento WhatsApp", o sistema gera uma mensagem profissional já formatada com nome da peça, material, peso, tempo estimado de impressão e valor final sugerido.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </section>
  );
};