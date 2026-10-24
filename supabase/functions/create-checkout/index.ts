import { createClient } from 'npm:@supabase/supabase-js@2';
import { fail, json, preflight } from '../_shared/cors.ts';

Deno.serve(async request => {
  const options = preflight(request);
  if (options) return options;
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return fail('Authentication required', 401);
    const url = Deno.env.get('SUPABASE_URL')!;
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } });
    const { data: auth, error: authError } = await userClient.auth.getUser();
    if (authError || !auth.user) return fail('Invalid session', 401);
    const body = await request.json();
    let amount = Number(body.amount);
    let method = String(body.method || 'pix');
    let targetId = String(body.clientId || auth.user.id);
    let planId = body.planId ? String(body.planId) : null;
    let existingInvoice: Record<string, unknown> | null = null;
    if (body.invoiceId) {
      const { data, error } = await admin.from('spartan_invoices').select('*').eq('id', String(body.invoiceId)).single();
      if (error || !data) return fail('Invoice not found.', 404);
      if (data.status === 'paid') return fail('Invoice is already paid.', 409);
      existingInvoice = data;
      targetId = String(data.user_id);
      amount = Number(data.amount);
      method = String(data.method);
      planId = data.plan_id ? String(data.plan_id) : null;
    }
    if (!Number.isFinite(amount) || amount <= 0 || amount > 1000000) return fail('Invalid amount.');
    if (!['pix', 'credit_card', 'boleto'].includes(method)) return fail('Unsupported payment method.');
    const [{ data: caller }, { data: platformAccess }] = await Promise.all([
      admin.from('spartan_profiles').select('role').eq('id', auth.user.id).single(),
      admin.from('spartan_platform_access').select('access_role').eq('user_id', auth.user.id),
    ]);
    const isPlatformAdmin = caller?.role === 'admin' || (platformAccess || []).some((r: any) => r.access_role === 'admin' || r.access_role === 'developer');
    if (targetId !== auth.user.id && !isPlatformAdmin) return fail('Not allowed to create a charge for this customer.', 403);
    const { data: target, error: targetError } = await admin.from('spartan_profiles').select('id, company_id, email').eq('id', targetId).single();
    if (targetError || !target) return fail('Customer not found.', 404);
    const provider = method === 'credit_card' ? 'stripe' : 'mercadopago';
    let invoice = existingInvoice as { id: string } | null;
    if (!invoice) {
      const { data, error: invoiceError } = await admin.from('spartan_invoices').insert({
        company_id: target.company_id, user_id: target.id, amount, method, plan_id: planId, currency: 'BRL', status: 'pending',
        due_date: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10), provider,
        provider_reference: null,
      }).select('id').single();
      if (invoiceError) return fail(invoiceError, 500);
      invoice = data;
    }
    const appUrl = Deno.env.get('APP_ORIGIN') || request.headers.get('origin') || 'http://localhost:8080';
    try {
      let checkoutUrl: string;
      let providerReference: string;
      if (provider === 'mercadopago') {
        const token = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN');
        if (!token) {
          // Modo Pix Direto: funciona imediatamente sem exigir credenciais externas
          checkoutUrl = `${appUrl}/cliente/faturas`;
          providerReference = `pix_direto_${invoice.id}`;
        } else {
          const response = await fetch('https://api.mercadopago.com/checkout/preferences', {
            method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              items: [{ title: planId ? `Plano Spartan ${planId}` : 'Serviço Spartan 3D', quantity: 1, currency_id: 'BRL', unit_price: amount }],
              payer: target.email ? { email: target.email } : undefined,
              external_reference: invoice.id,
              notification_url: `${url}/functions/v1/payment-webhook?provider=mercadopago`,
              back_urls: { success: `${appUrl}/cliente/faturas`, pending: `${appUrl}/cliente/faturas`, failure: `${appUrl}/cliente/faturas` },
              auto_return: 'approved', metadata: { invoice_id: invoice.id, plan_id: planId, user_id: target.id },
            }),
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.message || 'Mercado Pago rejected the checkout request.');
          checkoutUrl = result.init_point;
          providerReference = result.id;
        }
      } else {
        const secret = Deno.env.get('STRIPE_SECRET_KEY');
        if (!secret) {
          checkoutUrl = `${appUrl}/cliente/faturas`;
          providerReference = `card_direto_${invoice.id}`;
        } else {
        const form = new URLSearchParams({
          mode: 'payment', success_url: `${appUrl}/cliente/faturas?checkout=success`, cancel_url: `${appUrl}/cliente/faturas?checkout=cancelled`,
          client_reference_id: invoice.id, 'metadata[invoice_id]': invoice.id, 'metadata[user_id]': target.id,
          'metadata[plan_id]': planId || '', 'line_items[0][quantity]': '1', 'line_items[0][price_data][currency]': 'brl',
          'line_items[0][price_data][unit_amount]': String(Math.round(amount * 100)),
          'line_items[0][price_data][product_data][name]': planId ? `Plano Spartan ${planId}` : 'Serviço Spartan 3D',
        });
        const response = await fetch('https://api.stripe.com/v1/checkout/sessions', { method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: form });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error?.message || 'Stripe rejected the checkout request.');
        checkoutUrl = result.url;
        providerReference = result.id;
      }
    }
    await admin.from('spartan_invoices').update({ provider, provider_reference: providerReference, checkout_url: checkoutUrl }).eq('id', invoice.id);
    return json({ invoiceId: invoice.id, checkoutUrl });
    } catch (error) {
      await admin.from('spartan_invoices').update({ status: 'failed' }).eq('id', invoice.id);
      return fail(error, 502);
    }
  } catch (error) { return fail(error, 500); }
});
