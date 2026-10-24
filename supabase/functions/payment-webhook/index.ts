import { createClient } from 'npm:@supabase/supabase-js@2';
import { fail, json, preflight } from '../_shared/cors.ts';

const hex = (bytes: ArrayBuffer) => [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, '0')).join('');
async function hmac(secret: string, value: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)));
}
const safeEqual = (a: string, b: string) => a.length === b.length && [...a].reduce((ok, char, index) => ok & (char.charCodeAt(0) ^ b.charCodeAt(index)), 0) === 0;

Deno.serve(async request => {
  const options = preflight(request);
  if (options) return options;
  try {
    const raw = await request.text();
    const body = JSON.parse(raw);
    const provider = new URL(request.url).searchParams.get('provider');
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    let invoiceId = '';
    let eventId = '';
    let paid = false;
    let planId: string | null = null;
    let userId: string | null = null;

    if (provider === 'mercadopago') {
      const paymentId = String(body.data?.id || new URL(request.url).searchParams.get('data.id') || '');
      const signature = request.headers.get('x-signature') || '';
      const requestId = request.headers.get('x-request-id') || '';
      const parsed = Object.fromEntries(signature.split(',').map(piece => piece.trim().split('=')));
      const secret = Deno.env.get('MERCADOPAGO_WEBHOOK_SECRET');
      if (!secret || !paymentId || !parsed.ts || !parsed.v1) return fail('Missing Mercado Pago signature configuration.', 400);
      const expected = await hmac(secret, `id:${paymentId};request-id:${requestId};ts:${parsed.ts};`);
      if (!safeEqual(expected, parsed.v1)) return fail('Invalid webhook signature.', 401);
      const token = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN')!;
      const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(paymentId)}`, { headers: { Authorization: `Bearer ${token}` } });
      const payment = await response.json();
      if (!response.ok) return fail('Could not verify Mercado Pago payment.', 502);
      invoiceId = String(payment.external_reference || payment.metadata?.invoice_id || '');
      eventId = String(body.id || `${body.type}:${paymentId}`);
      paid = payment.status === 'approved';
      planId = payment.metadata?.plan_id || null;
      userId = payment.metadata?.user_id || null;
    } else if (provider === 'stripe') {
      const signature = request.headers.get('stripe-signature') || '';
      const values = Object.fromEntries(signature.split(',').map(piece => piece.trim().split('=')));
      const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
      if (!secret || !values.t || !values.v1) return fail('Missing Stripe signature configuration.', 400);
      if (Math.abs(Date.now() / 1000 - Number(values.t)) > 300) return fail('Expired webhook signature.', 401);
      const expected = await hmac(secret, `${values.t}.${raw}`);
      if (!safeEqual(expected, values.v1)) return fail('Invalid webhook signature.', 401);
      const event = body;
      eventId = String(event.id || '');
      const object = event.data?.object || {};
      if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) return json({ received: true, ignored: true });
      invoiceId = String(object.metadata?.invoice_id || object.client_reference_id || '');
      paid = object.payment_status === 'paid';
      planId = object.metadata?.plan_id || null;
      userId = object.metadata?.user_id || null;
    } else return fail('Unknown payment provider.', 400);

    if (!invoiceId || !eventId) return fail('Payment event does not reference an invoice.', 400);
    const { error: eventError } = await admin.from('spartan_payment_events').insert({ provider, provider_event_id: eventId, payload: body });
    if (eventError?.code === '23505') {
      const { data: prior } = await admin.from('spartan_payment_events').select('processed_at').eq('provider', provider).eq('provider_event_id', eventId).single();
      if (prior?.processed_at) return json({ received: true, duplicate: true });
    } else if (eventError) return fail(eventError, 500);
    const { error: invoiceError } = await admin.from('spartan_invoices').update({ status: paid ? 'paid' : 'failed', ...(paid ? { paid_at: new Date().toISOString() } : {}) }).eq('id', invoiceId);
    if (invoiceError) return fail(invoiceError, 500);
    if (paid && planId && userId) {
      const { data: plan } = await admin.from('spartan_plans').select('ai_credits').eq('id', planId).single();
      const { error } = await admin.from('spartan_profiles').update({ plan_id: planId, ai_credits_remaining: plan?.ai_credits || 0 }).eq('id', userId);
      if (error) return fail(error, 500);
    }
    await admin.from('spartan_payment_events').update({ processed_at: new Date().toISOString() }).eq('provider', provider).eq('provider_event_id', eventId);
    return json({ received: true });
  } catch (error) { return fail(error, 500); }
});
