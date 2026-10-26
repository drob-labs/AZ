// Edge Function: krijon punëtorë të rinj dhe rivendos PIN-in.
// Kërkon service_role, prandaj ekzekutohet vetëm në server (çelësi nuk del kurrë në aplikacion).
// Thirret vetëm nga pronari (role = 'admin'). Deploy: Supabase Dashboard → Edge Functions.

import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

const isWeakPin = (pin: string): boolean => {
  if (!/^\d{6}$/.test(pin)) return true;
  if (/^(\d)\1{5}$/.test(pin)) return true;
  const d = [...pin].map(Number);
  const up = d.every((x, i) => i === 0 || x === d[i - 1] + 1);
  const down = d.every((x, i) => i === 0 || x === d[i - 1] - 1);
  return up || down || ['123123', '121212', '112233', '654321', '000000', '123321'].includes(pin);
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'method' });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1) Kush po thërret? Duhet të jetë pronar aktiv.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: auth } = await admin.auth.getUser(token);
  if (!auth?.user) return json(401, { error: 'unauthorized' });
  const { data: me } = await admin
    .from('employees')
    .select('role, active')
    .eq('user_id', auth.user.id)
    .maybeSingle();
  if (!me || !me.active || me.role !== 'admin') return json(403, { error: 'forbidden' });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'bad_json' });
  }

  // 2) Rivendosja e PIN-it
  if (body.action === 'reset_pin') {
    const employeeId = String(body.employeeId ?? '');
    const pin = String(body.pin ?? '');
    if (isWeakPin(pin)) return json(400, { error: 'weak_pin' });
    const { data: emp } = await admin.from('employees').select('user_id').eq('id', employeeId).maybeSingle();
    if (!emp?.user_id) return json(404, { error: 'not_found' });
    const { error } = await admin.auth.admin.updateUserById(emp.user_id, { password: pin });
    if (error) return json(500, { error: 'update_failed' });
    return json(200, { ok: true });
  }

  // 3) Krijimi i punëtorit të ri
  if (body.action === 'create') {
    const personnelNo = String(body.personnelNo ?? '').trim();
    const firstName = String(body.firstName ?? '').trim();
    const lastName = String(body.lastName ?? '').trim();
    const email = String(body.email ?? '').trim().toLowerCase();
    const pin = String(body.pin ?? '');
    const rateCents = Number(body.hourlyRateCents);
    const weeklyHours = Number(body.weeklyHours ?? 40);
    const locale = body.locale === 'de' ? 'de' : 'sq';
    const validFrom = String(body.validFrom ?? '');

    if (!/^[A-Za-z0-9]{1,12}$/.test(personnelNo)) return json(400, { error: 'personnel_no' });
    if (!firstName || !lastName) return json(400, { error: 'name' });
    if (email !== `${personnelNo.toLowerCase()}@${email.split('@')[1]}` || !email.includes('@')) {
      return json(400, { error: 'email' });
    }
    if (isWeakPin(pin)) return json(400, { error: 'weak_pin' });
    if (!Number.isInteger(rateCents) || rateCents < 100 || rateCents > 20000) return json(400, { error: 'rate' });
    if (!(weeklyHours > 0 && weeklyHours <= 60)) return json(400, { error: 'weekly_hours' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(validFrom)) return json(400, { error: 'valid_from' });

    const { data: dup } = await admin.from('employees').select('id').eq('personnel_no', personnelNo).maybeSingle();
    if (dup) return json(409, { error: 'duplicate' });

    const created = await admin.auth.admin.createUser({ email, password: pin, email_confirm: true });
    if (created.error || !created.data.user) return json(500, { error: 'user_failed' });
    const userId = created.data.user.id;

    const { data: emp, error: empErr } = await admin
      .from('employees')
      .insert({
        user_id: userId,
        personnel_no: personnelNo,
        first_name: firstName,
        last_name: lastName,
        role: 'worker',
        weekly_hours: weeklyHours,
        locale,
        entry_date: validFrom,
      })
      .select('id')
      .single();
    if (empErr || !emp) {
      await admin.auth.admin.deleteUser(userId);
      return json(500, { error: 'employee_failed' });
    }

    const { error: rateErr } = await admin
      .from('employee_rates')
      .insert({ employee_id: emp.id, valid_from: validFrom, hourly_rate_cents: rateCents });
    if (rateErr) {
      await admin.from('employees').delete().eq('id', emp.id);
      await admin.auth.admin.deleteUser(userId);
      return json(500, { error: 'rate_failed' });
    }

    return json(200, { ok: true, id: emp.id });
  }

  return json(400, { error: 'unknown_action' });
});
