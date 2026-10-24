// Trọng tài ván đấu 1–1 (Giai đoạn 9a). Client không ghi bảng `games`; mọi thao tác qua đây:
//   { gameId, action: 'move', move, ply }   ply = số nước client đang thấy (lệch → 409 out_of_sync)
//   { gameId, action: 'resign' | 'offer_draw' | 'accept_draw' | 'decline_draw' | 'abort' | 'claim_timeout' }
// Server đi lại toàn bộ ván (bắt cả lặp 3 lần), trừ đồng hồ theo giờ server, kết thúc ván và cập
// nhật rating Glicko-2 nếu ván tính rating. Ghi có điều kiện theo `version` để hai yêu cầu cùng lúc
// không đè nhau. Trigger CSDL phát trạng thái mới qua Realtime `game:<id>`.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { type ClockState, clockAfterMove, flagged } from './_shared/chess-core/clock.ts';
import {
  formatPgn,
  type GameResultCode,
  lossFor,
  replayGame,
  resultOf,
} from './_shared/chess-core/game.ts';
import { glicko2Update, newRating } from './_shared/chess-core/glicko2.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UCI_RE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
const ACTIONS = [
  'move',
  'resign',
  'offer_draw',
  'accept_draw',
  'decline_draw',
  'abort',
  'claim_timeout',
];

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

type Game = {
  id: string;
  academy_id: string;
  white_id: string | null;
  black_id: string | null;
  bot_elo: number | null;
  initial_fen: string;
  moves: string[];
  base_ms: number | null;
  inc_ms: number;
  white_ms: number | null;
  black_ms: number | null;
  turn_started_at: string | null;
  status: string;
  rated: boolean;
  category: string | null;
  draw_offer_by: string | null;
  version: number;
  started_at: string | null;
  created_at: string;
  simul_id: string | null;
};
type Patch = Record<string, unknown>;

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
  const gameId = typeof body.gameId === 'string' && UUID_RE.test(body.gameId) ? body.gameId : null;
  const action =
    typeof body.action === 'string' && ACTIONS.includes(body.action) ? body.action : null;
  if (!gameId || !action) return json(400, { error: 'invalid_input' });

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

  const { data: game } = await admin.from('games').select('*').eq('id', gameId).maybeSingle<Game>();
  if (!game) return json(404, { error: 'not_found' });
  const me = game.white_id === uid ? 'w' : game.black_id === uid ? 'b' : null;
  let staff = false;
  if (!me) {
    const { data: m } = await admin
      .from('memberships')
      .select('role')
      .eq('academy_id', game.academy_id)
      .eq('user_id', uid)
      .maybeSingle();
    staff = m?.role === 'owner' || m?.role === 'coach';
    // Staff chỉ được huỷ ván (xử lý sự cố); người ngoài không được làm gì
    if (!(staff && action === 'abort')) return json(403, { error: 'forbidden' });
  }
  if (game.status !== 'active') return json(409, { error: 'game_over' });
  if (game.bot_elo !== null) return json(400, { error: 'bot_game' });

  const now = Date.now();
  const replay = replayGame(game.initial_fen, game.moves);
  if (!replay) return json(500, { error: 'corrupt_game' });
  const turn = replay.turn;
  const clock: ClockState | null =
    game.base_ms === null
      ? null
      : {
          whiteMs: game.white_ms ?? game.base_ms,
          blackMs: game.black_ms ?? game.base_ms,
          turnStartedAt: game.turn_started_at ? Date.parse(game.turn_started_at) : null,
        };
  const opponent = me === 'w' ? 'b' : 'w';
  // Ván simul: đồng hồ chỉ tính cho học viên, chủ simul không bị trừ giờ
  let hostColor: 'w' | 'b' | null = null;
  if (game.simul_id) {
    const { data: simul } = await admin
      .from('simuls')
      .select('host_id')
      .eq('id', game.simul_id)
      .maybeSingle();
    hostColor =
      simul?.host_id === game.white_id ? 'w' : simul?.host_id === game.black_id ? 'b' : null;
  }
  const canFlag = (side: 'w' | 'b') => side !== hostColor;

  // Ghi có điều kiện theo version; ván kết thúc thì tính PGN + rating
  async function save(
    patch: Patch,
    finish?: { result: GameResultCode; reason: string; sans?: string[] },
  ) {
    const update: Patch = { ...patch, version: game.version + 1 };
    if (finish) {
      const moves = (patch.moves as string[] | undefined) ?? game.moves;
      const sans = finish.sans ?? replayGame(game.initial_fen, moves)?.sans ?? [];
      const ids = [game.white_id, game.black_id].filter((x): x is string => !!x);
      const { data: people } = await admin
        .from('profiles')
        .select('id, display_name')
        .in('id', ids);
      const nameOf = (id: string | null) => people?.find((p) => p.id === id)?.display_name ?? '?';
      Object.assign(update, {
        status: 'finished',
        result: finish.result,
        reason: finish.reason,
        draw_offer_by: null,
        finished_at: new Date(now).toISOString(),
        pgn: formatPgn({
          headers: {
            Event: 'ERPChess',
            Date: new Date(game.started_at ?? game.created_at)
              .toISOString()
              .slice(0, 10)
              .replaceAll('-', '.'),
            White: nameOf(game.white_id),
            Black: nameOf(game.black_id),
            Termination: finish.reason,
          },
          initialFen: game.initial_fen,
          sans,
          result: finish.result,
        }),
      });
    }
    const { data: saved, error } = await admin
      .from('games')
      .update(update)
      .eq('id', game.id)
      .eq('version', game.version)
      .select()
      .maybeSingle();
    if (error) return json(500, { error: 'save_failed' });
    if (!saved) return json(409, { error: 'out_of_sync' });
    if (finish && game.rated && game.category && game.white_id && game.black_id) {
      const change = await updateRatings(finish.result);
      if (change) {
        await admin
          .from('games')
          .update({ rating_change: change, version: game.version + 2 })
          .eq('id', game.id);
        saved.rating_change = change;
      }
    }
    return json(200, saved);
  }

  async function updateRatings(result: GameResultCode) {
    const category = game.category as string;
    const { data: rows } = await admin
      .from('ratings')
      .select('student_id, rating, rd, vol, games')
      .eq('academy_id', game.academy_id)
      .eq('category', category)
      .in('student_id', [game.white_id, game.black_id]);
    const cur = (id: string | null) => {
      const r = rows?.find((x) => x.student_id === id);
      return r
        ? {
            rating: Number(r.rating),
            rd: Number(r.rd),
            vol: Number(r.vol),
            games: r.games as number,
          }
        : { ...newRating(), games: 0 };
    };
    const w = cur(game.white_id);
    const b = cur(game.black_id);
    const score = result === '1-0' ? 1 : result === '0-1' ? 0 : 0.5;
    const nw = glicko2Update(w, [{ rating: b.rating, rd: b.rd, score: score as 0 | 0.5 | 1 }]);
    const nb = glicko2Update(b, [
      { rating: w.rating, rd: w.rd, score: (1 - score) as 0 | 0.5 | 1 },
    ]);
    const stamp = new Date(now).toISOString();
    const { error } = await admin.from('ratings').upsert([
      {
        academy_id: game.academy_id,
        student_id: game.white_id,
        category,
        ...nw,
        games: w.games + 1,
        updated_at: stamp,
      },
      {
        academy_id: game.academy_id,
        student_id: game.black_id,
        category,
        ...nb,
        games: b.games + 1,
        updated_at: stamp,
      },
    ]);
    if (error) return null;
    const round = (x: number) => Math.round(x * 10) / 10;
    return { white: round(nw.rating - w.rating), black: round(nb.rating - b.rating) };
  }

  const nextClock = (c: ClockState) => {
    const next = clockAfterMove(c, turn, game.moves.length, now, game.inc_ms);
    if (turn !== hostColor) return next;
    const key = turn === 'w' ? 'whiteMs' : 'blackMs';
    return { ...next, [key]: c[key] };
  };

  const clockPatch = (c: ClockState) => ({
    white_ms: c.whiteMs,
    black_ms: c.blackMs,
    turn_started_at: c.turnStartedAt === null ? null : new Date(c.turnStartedAt).toISOString(),
  });

  switch (action) {
    case 'move': {
      if (me !== turn) return json(409, { error: 'not_your_turn' });
      const move = typeof body.move === 'string' && UCI_RE.test(body.move) ? body.move : null;
      if (!move) return json(400, { error: 'invalid_input' });
      if (body.ply !== game.moves.length) return json(409, { error: 'out_of_sync' });
      if (clock && canFlag(turn) && flagged(clock, turn, now)) {
        return save(clockPatch({ ...clock, [turn === 'w' ? 'whiteMs' : 'blackMs']: 0 }), {
          result: lossFor(turn),
          reason: 'timeout',
        });
      }
      const moves = [...game.moves, move];
      const next = replayGame(game.initial_fen, moves);
      if (!next) return json(400, { error: 'illegal_move' });
      const patch: Patch = {
        moves,
        fen: next.fen,
        // Đi một nước = từ chối lời mời hoà của đối thủ (nếu có)
        draw_offer_by: game.draw_offer_by === uid ? uid : null,
        started_at: game.started_at ?? new Date(now).toISOString(),
        ...(clock ? clockPatch(nextClock(clock)) : {}),
      };
      if (next.status !== 'ongoing') {
        return save(patch, {
          result: resultOf(next.status, next.turn),
          reason: next.status,
          sans: next.sans,
        });
      }
      return save(patch);
    }
    case 'resign':
      return save({}, { result: lossFor(me as 'w' | 'b'), reason: 'resign' });
    case 'offer_draw':
      if (game.draw_offer_by === uid) return json(200, { ok: true });
      if (game.draw_offer_by) return save({}, { result: '1/2-1/2', reason: 'agreement' });
      return save({ draw_offer_by: uid });
    case 'accept_draw':
      if (!game.draw_offer_by || game.draw_offer_by === uid)
        return json(409, { error: 'no_draw_offer' });
      return save({}, { result: '1/2-1/2', reason: 'agreement' });
    case 'decline_draw':
      if (!game.draw_offer_by || game.draw_offer_by === uid)
        return json(409, { error: 'no_draw_offer' });
      return save({ draw_offer_by: null });
    case 'abort': {
      if (!staff && game.moves.length >= 2) return json(409, { error: 'too_late_to_abort' });
      const { data: saved } = await admin
        .from('games')
        .update({
          status: 'aborted',
          reason: 'abort',
          version: game.version + 1,
          finished_at: new Date(now).toISOString(),
        })
        .eq('id', game.id)
        .eq('version', game.version)
        .select()
        .maybeSingle();
      return saved ? json(200, saved) : json(409, { error: 'out_of_sync' });
    }
    case 'claim_timeout':
      if (!clock || turn !== opponent || !canFlag(turn) || !flagged(clock, turn, now)) {
        return json(409, { error: 'not_flagged' });
      }
      return save(clockPatch({ ...clock, [turn === 'w' ? 'whiteMs' : 'blackMs']: 0 }), {
        result: lossFor(turn),
        reason: 'timeout',
      });
  }
  return json(400, { error: 'invalid_input' });
});
