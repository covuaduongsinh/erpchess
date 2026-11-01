// Gửi email qua Resend (Giai đoạn 27a). Logic ở handler.ts (kiểm thử được); tệp này chỉ nối với Deno và Supabase.
//   Secret cần đặt: RESEND_API_KEY (bắt buộc để gửi), RESEND_FROM (tuỳ chọn, mặc định onboarding@resend.dev),
//   APP_URL (tuỳ chọn, gốc URL web để email có link tuyệt đối). Khoá không bao giờ trả về client.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { type Db, handleSendEmail } from './handler.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const url = Deno.env.get('SUPABASE_URL') ?? '';
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

const db: Db = {
  async userFromJwt(jwt) {
    const { data, error } = await admin.auth.getUser(jwt);
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email ?? null };
  },
  async staffRole(userId, academyId) {
    const { data } = await admin
      .from('memberships')
      .select('role')
      .eq('academy_id', academyId)
      .eq('user_id', userId)
      .in('role', ['owner', 'coach'])
      .maybeSingle();
    return (data?.role as 'owner' | 'coach' | undefined) ?? null;
  },
  async academy(academyId) {
    const { data } = await admin
      .from('academies')
      .select('id, name, slug, contact')
      .eq('id', academyId)
      .maybeSingle();
    return data
      ? { ...data, slug: String(data.slug), contact: (data.contact ?? {}) as never }
      : null;
  },
  async categoryEnabled(academyId, category) {
    const { data } = await admin
      .from('notification_settings')
      .select('enabled')
      .eq('academy_id', academyId)
      .eq('category', category)
      .maybeSingle();
    return data ? !!data.enabled : true;
  },
  async sentInLastHour(academyId) {
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count } = await admin
      .from('email_log')
      .select('id', { count: 'exact', head: true })
      .eq('academy_id', academyId)
      .eq('status', 'sent')
      .gte('created_at', since);
    return count ?? 0;
  },
  async invitationByToken(token) {
    const { data } = await admin
      .from('invitations')
      .select('id, academy_id, role, email, student_id, accepted_at, expires_at')
      .eq('token', token)
      .maybeSingle();
    return (data as never) ?? null;
  },
  async setInvitationEmail(id, email) {
    await admin.from('invitations').update({ email }).eq('id', id).is('email', null);
  },
  async displayName(userId) {
    const { data } = await admin
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .maybeSingle();
    return data?.display_name ?? null;
  },
  async insertLog(row) {
    await admin.from('email_log').insert(row);
  },
  async pendingNotifications(limit) {
    const since = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { data } = await admin
      .from('notifications')
      .select('id, academy_id, user_id, category, title, body, link')
      .is('emailed_at', null)
      .in('category', ['quiz', 'invoice_reminder'])
      .gte('created_at', since)
      .order('created_at')
      .limit(limit);
    return (data ?? []) as never;
  },
  async userEmail(userId) {
    const { data } = await admin.auth.admin.getUserById(userId);
    return data.user?.email ?? null;
  },
  async markEmailed(ids) {
    await admin
      .from('notifications')
      .update({ emailed_at: new Date().toISOString() })
      .in('id', ids);
  },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  let body: unknown = {};
  try {
    body = await req.json();
  } catch {
    // thân rỗng hoặc không phải JSON: handler tự báo thiếu trường
  }
  const out = await handleSendEmail(
    {
      env: {
        resendKey: Deno.env.get('RESEND_API_KEY') || undefined,
        from: Deno.env.get('RESEND_FROM') || undefined,
        appUrl: Deno.env.get('APP_URL') || undefined,
        serviceKey,
      },
      fetch,
      now: () => new Date(),
      db,
    },
    { method: req.method, authorization: req.headers.get('Authorization'), body },
  );
  return new Response(JSON.stringify(out.body), {
    status: out.status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
