import { fail, json, preflight } from '../_shared/cors.ts';

/**
 * Supabase Edge Function: send-whatsapp
 * Dispara mensagens de WhatsApp através do gateway configurado (Evolution API, Z-API ou Webhook)
 * ou responde em modo simulação caso nenhum gateway esteja conectado no ambiente local.
 */
Deno.serve(async request => {
  const options = preflight(request);
  if (options) return options;

  try {
    const body = await request.json();
    const phone = String(body.phone || '').replace(/\D/g, '');
    const message = String(body.message || '').trim();
    const senderNumber = String(body.senderNumber || '5592993746740');

    if (!phone || phone.length < 10) {
      return fail('Número de telefone inválido.', 400);
    }

    if (!message) {
      return fail('Conteúdo da mensagem não pode estar vazio.', 400);
    }

    const gatewayUrl = Deno.env.get('WHATSAPP_GATEWAY_URL');
    const gatewayToken = Deno.env.get('WHATSAPP_GATEWAY_TOKEN');
    const gatewayInstance = Deno.env.get('WHATSAPP_GATEWAY_INSTANCE');

    // Se houver um gateway de WhatsApp configurado (Evolution API, Z-API, N8N, etc.)
    if (gatewayUrl) {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (gatewayToken) {
        headers['apikey'] = gatewayToken;
        headers['Authorization'] = `Bearer ${gatewayToken}`;
        headers['Client-Token'] = gatewayToken;
      }

      // Payload adaptável para Evolution API e Z-API
      const payload = {
        number: phone,
        phone,
        message,
        text: message,
        sender: senderNumber,
        instance: gatewayInstance,
      };

      const response = await fetch(gatewayUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[send-whatsapp] Falha na resposta do Gateway:', errorText);
        return fail(`Falha ao enviar pelo Gateway de WhatsApp: ${response.status}`, 502);
      }

      const responseData = await response.json().catch(() => ({}));
      return json({
        success: true,
        simulated: false,
        message: 'Mensagem enviada com sucesso pelo WhatsApp.',
        gatewayResponse: responseData,
      });
    }

    // Modo local / simulação caso ainda não haja gateway cadastrado nas variáveis de ambiente
    console.log('[send-whatsapp] Modo Simulação Ativo (sem WHATSAPP_GATEWAY_URL configurada):', {
      remetente: senderNumber,
      destinatario: phone,
      mensagem: message,
    });

    return json({
      success: true,
      simulated: true,
      message: 'Simulação local: mensagem processada com sucesso.',
      phone,
    });
  } catch (error) {
    console.error('[send-whatsapp] Erro inesperado:', error);
    return fail(error instanceof Error ? error.message : 'Erro interno ao processar WhatsApp.', 500);
  }
});
