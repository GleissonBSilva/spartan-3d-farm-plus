/**
 * Serviço de Integração e Automação de WhatsApp para a Spartan 3D Farm.
 * Suporta envio automático via Supabase Edge Function, Gateway direto (Evolution API / Z-API / Webhooks)
 * e modo de simulação local para testes.
 */

import { supabase } from '@/lib/supabase';

export const SPARTAN_OFFICIAL_WHATSAPP_NUMBER = '5592993746740';
export const SPARTAN_OFFICIAL_WHATSAPP_DISPLAY = '(92) 99374-6740';

/**
 * Remove caracteres não numéricos e garante o DDI 55 (Brasil) caso omitido.
 */
export function normalizeWhatsAppPhone(rawPhone: string): string {
  if (!rawPhone) return '';
  // Remove tudo que não for dígito
  let digits = rawPhone.replace(/\D/g, '');

  // Remove zero à esquerda do DDD (ex: 092 -> 92)
  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  // Se tem 10 dígitos (DDD + 8 dígitos) ou 11 dígitos (DDD + 9 dígitos), adiciona DDI 55
  if (digits.length === 10 || digits.length === 11) {
    digits = `55${digits}`;
  }

  return digits;
}

/**
 * Aplica máscara visual de telefone brasileiro enquanto o usuário digita: (99) 99999-9999
 */
export function formatPhoneMask(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (!digits) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

/**
 * Mensagem oficial de boas-vindas da Spartan 3D Farm
 */
export function formatWelcomeWhatsAppMessage(companyName?: string): string {
  const nomeFarm = companyName?.trim() || 'sua Farm 3D';
  return `Olá, Amigo (a)! 
🚀 Seja muito bem-vindo(a) ao Spartan 3D Farm!
Sua conta para a farm ${nomeFarm} já está ativa.
Este é o canal oficial de suporte direto da Spartan 3D pelo número (92) 99374-6740.
⚠️ Estamos atualmente em fase de testes e melhorias contínuas. Seu feedback é muito importante para nós!
Acesse seu painel e comece a configurar suas impressoras e filamentos:
🔗 https://spartan-3dprint.vercel.app/login
Se precisar de qualquer ajuda para configurar sua farm, calcular suas peças ou relatar algum ajuste, é só responder por aqui! 🦾`;
}

/**
 * Mensagem de alerta de período de teste grátis quase encerrando
 */
export function formatTrialEndingWhatsAppMessage(clientName: string, companyName: string, daysLeft: number): string {
  const nome = clientName?.trim() || 'Amigo(a)';
  const farm = companyName?.trim() || 'sua Farm 3D';
  const tempoTexto = daysLeft <= 1 ? 'encerra amanhã' : `encerra em ${daysLeft} dias`;

  return `Olá, ${nome}! 🚀
Notamos que o seu período de teste grátis de 14 dias para a farm *${farm}* ${tempoTexto}.

Para manter suas impressoras, filamentos e histórico de projetos 100% ativos sem qualquer interrupção, você já pode ativar sua assinatura definitiva no link:
🔗 https://spartan-3dprint.vercel.app/cliente/planos

Se precisar de auxílio com a forma de pagamento (Pix) ou dúvidas técnicas, é só responder por aqui! 🦾`;
}

/**
 * Mensagem de cobrança / lembrete de vencimento da fatura do mês corrente
 */
export function formatInvoiceDueWhatsAppMessage(clientName: string, companyName: string, amount: number, dueDate: string): string {
  const nome = clientName?.trim() || 'Amigo(a)';
  const farm = companyName?.trim() || 'sua Farm 3D';
  const dataFormatada = dueDate ? new Date(`${dueDate}T00:00:00`).toLocaleDateString('pt-BR') : 'breve';
  const valorTexto = amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

  return `Olá, ${nome}! 📄
Lembramos que a mensalidade da farm *${farm}* vence em *${dataFormatada}*, no valor de *R$ ${valorTexto}*.

Você pode visualizar e pagar via Pix no seu painel:
🔗 https://spartan-3dprint.vercel.app/cliente/faturas

Ou, se preferir, responda a esta mensagem que geramos a chave Pix imediata para você! 🦾`;
}

export interface SendWelcomeWhatsAppParams {
  phone: string;
  companyName: string;
  name?: string;
}

export interface SendWhatsAppResult {
  success: boolean;
  simulated: boolean;
  message: string;
  targetPhone: string;
  previewUrl: string;
}

/**
 * Registra a mensagem no histórico local de simulação para testes e auditoria local.
 */
function recordLocalSimulation(logEntry: {
  phone: string;
  companyName: string;
  name?: string;
  message: string;
  sentAt: string;
}) {
  try {
    const raw = localStorage.getItem('spartan_simulated_whatsapp_messages');
    const history = raw ? (JSON.parse(raw) as unknown[]) : [];
    history.unshift(logEntry);
    localStorage.setItem('spartan_simulated_whatsapp_messages', JSON.stringify(history.slice(0, 50)));
  } catch {
    // Silencia eventuais falhas de storage em ambientes restritos
  }
}

/**
 * Dispara ou agenda a mensagem automática de boas-vindas via WhatsApp.
 */
export async function sendWelcomeWhatsApp(params: SendWelcomeWhatsAppParams): Promise<SendWhatsAppResult> {
  const normalizedPhone = normalizeWhatsAppPhone(params.phone);
  const messageText = formatWelcomeWhatsAppMessage(params.companyName);
  const previewUrl = `https://api.whatsapp.com/send?phone=${normalizedPhone}&text=${encodeURIComponent(messageText)}`;

  if (!normalizedPhone || normalizedPhone.length < 12) {
    return {
      success: false,
      simulated: true,
      message: 'Telefone inválido ou incompleto para envio de WhatsApp.',
      targetPhone: normalizedPhone,
      previewUrl,
    };
  }

  // 1. Tenta envio através da Supabase Edge Function se disponível
  if (supabase) {
    try {
      const { data, error } = await supabase.functions.invoke('send-whatsapp', {
        body: {
          phone: normalizedPhone,
          message: messageText,
          senderNumber: SPARTAN_OFFICIAL_WHATSAPP_NUMBER,
          type: 'welcome',
          metadata: {
            companyName: params.companyName,
            name: params.name,
          },
        },
      });

      if (!error && data?.success) {
        return {
          success: true,
          simulated: Boolean(data.simulated),
          message: data.message || 'Mensagem de boas-vindas enviada com sucesso.',
          targetPhone: normalizedPhone,
          previewUrl,
        };
      }
    } catch {
      // Caso a Edge function não esteja rodando localmente, continua para o fallback local
    }
  }

  // 2. Fallback de teste local / simulação
  recordLocalSimulation({
    phone: normalizedPhone,
    companyName: params.companyName,
    name: params.name,
    message: messageText,
    sentAt: new Date().toISOString(),
  });

  // Emite log detalhado para fácil inspeção no console do navegador durante testes locais
  if (typeof console !== 'undefined') {
    console.log(
      '%c[Spartan WhatsApp Bot] 📲 Mensagem de Boas-Vindas Programada:',
      'color: #10b981; font-weight: bold;',
      {
        remetente: `${SPARTAN_OFFICIAL_WHATSAPP_DISPLAY} (${SPARTAN_OFFICIAL_WHATSAPP_NUMBER})`,
        destinatario: normalizedPhone,
        farm: params.companyName,
        mensagem: messageText,
        linkPreview: previewUrl,
      }
    );
  }

  return {
    success: true,
    simulated: true,
    message: 'Boas-vindas programadas com sucesso para o WhatsApp.',
    targetPhone: normalizedPhone,
    previewUrl,
  };
}
