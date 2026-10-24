// Nhịp cron của giải đấu (Giai đoạn 10c), do pg_cron + pg_net gọi mỗi phút. Không dùng JWT
// (verify_jwt = false): xác thực bằng chuỗi bí mật sinh ngẫu nhiên nằm trong CSDL
// (`private.cron_secrets`), kiểm qua RPC chỉ service role gọi được. Việc làm đều idempotent.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { runTick } from './_shared/tournament-run.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method_not_allowed', { status: 405 });
  const secret = req.headers.get('x-tick-secret') ?? '';
  if (secret.length < 32) return new Response('unauthorized', { status: 401 });
  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );
  const { data: ok } = await admin.rpc('cron_secret_ok', {
    p_name: 'tournament_tick',
    p_secret: secret,
  });
  if (ok !== true) return new Response('unauthorized', { status: 401 });
  const result = await runTick(admin);
  return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } });
});
