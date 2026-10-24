// Điều hành giải đấu (Giai đoạn 10a). Chỉ người tổ chức (owner, hoặc HLV đã tạo giải):
//   { tournamentId, action: 'start' }        bắt đầu: chia nhóm (Quad), tạo các vòng, ghép vòng 1
//   { tournamentId, action: 'next_round' }   ghép vòng kế khi vòng hiện tại đã xong (điều khiển tay)
//   { tournamentId, action: 'finish' }       kết thúc giải sớm (huỷ các ván còn dở)
// Ghép cặp chạy bằng hàm thuần của chess-core (chép sang _shared bằng sync-shared.mjs).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  finishTournament,
  pairRound,
  startTournament,
  type Tournament,
} from './_shared/tournament-run.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIONS = ['start', 'next_round', 'finish'];

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'invalid_json' });
  }
  const id =
    typeof body.tournamentId === 'string' && UUID_RE.test(body.tournamentId)
      ? body.tournamentId
      : null;
  const action =
    typeof body.action === 'string' && ACTIONS.includes(body.action) ? body.action : null;
  if (!id || !action) return json(400, { error: 'invalid_input' });

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) return json(401, { error: 'unauthorized' });
  const uid = userData.user.id;
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
    auth: { persistSession: false },
  });

  const { data: t } = await admin
    .from('tournaments')
    .select('*')
    .eq('id', id)
    .maybeSingle<Tournament>();
  if (!t) return json(404, { error: 'not_found' });
  const { data: m } = await admin
    .from('memberships')
    .select('role')
    .eq('academy_id', t.academy_id)
    .eq('user_id', uid)
    .maybeSingle();
  const runner = m?.role === 'owner' || (m?.role === 'coach' && t.created_by === uid);
  if (!runner) return json(403, { error: 'forbidden' });

  try {
    if (action === 'start') {
      if (t.status !== 'upcoming') return json(409, { error: 'already_started' });
      await startTournament(admin, t);
    } else if (action === 'next_round') {
      if (t.status !== 'active') return json(409, { error: 'not_active' });
      const { data: current } = await admin
        .from('tournament_rounds')
        .select('status')
        .eq('tournament_id', t.id)
        .eq('round', t.current_round)
        .maybeSingle();
      if (current?.status !== 'finished') return json(409, { error: 'round_in_progress' });
      if (t.current_round >= t.rounds) return json(409, { error: 'no_more_rounds' });
      await pairRound(admin, t, t.current_round + 1);
    } else {
      await finishTournament(admin, t.id);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'failed';
    const known = ['not_enough_players', 'players_without_team'];
    return json(known.includes(message) ? 400 : 500, {
      error: known.includes(message) ? message : 'failed',
    });
  }
  const { data: fresh } = await admin.from('tournaments').select('*').eq('id', id).single();
  return json(200, fresh);
});
