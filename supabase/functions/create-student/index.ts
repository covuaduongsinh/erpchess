// Tạo tài khoản học viên đăng nhập bằng username + PIN (không cần email thật).
// Người gọi phải là owner hoặc coach của học viện.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const USERNAME_RE = /^[a-z0-9_.]{3,32}$/;
const PIN_RE = /^\d{6,12}$/;
const STUDENT_EMAIL_DOMAIN = 'students.erpchess.local';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Body = {
  academyId?: unknown;
  displayName?: unknown;
  username?: unknown;
  pin?: unknown;
  groupId?: unknown;
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json(401, { error: 'unauthorized' });

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'invalid_json' });
  }

  const academyId = typeof body.academyId === 'string' ? body.academyId : '';
  const displayName = typeof body.displayName === 'string' ? body.displayName.trim() : '';
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  const pin = typeof body.pin === 'string' ? body.pin : '';
  const groupId = typeof body.groupId === 'string' && body.groupId ? body.groupId : null;

  if (!academyId || !displayName || displayName.length > 80) {
    return json(400, { error: 'invalid_input', field: 'displayName' });
  }
  if (!USERNAME_RE.test(username)) return json(400, { error: 'invalid_input', field: 'username' });
  if (!PIN_RE.test(pin)) return json(400, { error: 'invalid_input', field: 'pin' });

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  // Client mang JWT người gọi: kiểm quyền bằng chính RLS
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) return json(401, { error: 'unauthorized' });

  const { data: membership } = await caller
    .from('memberships')
    .select('role')
    .eq('academy_id', academyId)
    .eq('user_id', userData.user.id)
    .maybeSingle();
  if (!membership || !['owner', 'coach'].includes(membership.role)) {
    return json(403, { error: 'forbidden' });
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  const { data: taken } = await admin
    .from('profiles')
    .select('id')
    .eq('username', username)
    .maybeSingle();
  if (taken) return json(409, { error: 'username_taken' });

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: `${username}@${STUDENT_EMAIL_DOMAIN}`,
    password: pin,
    email_confirm: true,
    user_metadata: { display_name: displayName, username },
  });
  if (createError || !created.user) {
    return json(400, { error: 'create_failed', message: createError?.message });
  }
  const studentId = created.user.id;

  // Thêm thành viên bằng client người gọi để RLS xác nhận quyền thêm học viên
  const { error: memberError } = await caller
    .from('memberships')
    .insert({ academy_id: academyId, user_id: studentId, role: 'student' });
  if (memberError) {
    await admin.auth.admin.deleteUser(studentId);
    return json(403, { error: 'forbidden', message: memberError.message });
  }

  if (groupId) {
    const { error: groupError } = await caller
      .from('group_members')
      .insert({ group_id: groupId, student_id: studentId });
    if (groupError) {
      return json(207, { studentId, username, warning: 'group_assign_failed' });
    }
  }

  return json(201, { studentId, username });
});
