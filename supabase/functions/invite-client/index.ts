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
    const { data: auth, error } = await userClient.auth.getUser();
    if (error || !auth.user) return fail('Invalid session', 401);
    const { data: profile } = await admin.from('spartan_profiles').select('role').eq('id', auth.user.id).single();
    if (profile?.role !== 'admin') return fail('Platform administrator access required.', 403);
    const body = await request.json();
    const email = String(body.email || '').trim().toLowerCase();
    const name = String(body.name || '').trim();
    const companyName = String(body.companyName || '').trim();
    if (!email || !name || !companyName) return fail('Name, email, and company are required.');
    const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: name, company_name: companyName, plan_id: String(body.planId || 'plan_pro') },
    });
    if (inviteError) return fail(inviteError, 400);
    return json({ message: `Invitation sent to ${email}.` }, 201);
  } catch (error) { return fail(error, 500); }
});
