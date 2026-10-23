// Nộp một lượt làm puzzle. Server tự chấm lại bằng chess-core (cùng logic với client) và ghi
// vào attempts bằng service role — client không có quyền ghi bảng này nên không gian lận được.
//
// Vào: { itemId, moves: [{ uci, ms }] } — chuỗi nước của người giải trong một lượt thử
// Ra:  { solved, tries, results: [{ uci, ok }] }
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { gradeMove } from './_shared/chess-core/puzzle.ts';

const MAX_MOVES = 40;
const MAX_MS_PER_MOVE = 10 * 60_000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UCI_RE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

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

type MoveIn = { uci: string; ms: number };

function parseMoves(raw: unknown): MoveIn[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_MOVES) return null;
  const out: MoveIn[] = [];
  for (const m of raw) {
    const uci = typeof m?.uci === 'string' ? m.uci.toLowerCase() : '';
    if (!UCI_RE.test(uci)) return null;
    const ms = Number(m?.ms);
    out.push({
      uci,
      ms: Number.isFinite(ms) ? Math.min(Math.max(0, Math.round(ms)), MAX_MS_PER_MOVE) : 0,
    });
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json(401, { error: 'unauthorized' });

  let body: { itemId?: unknown; moves?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'invalid_json' });
  }
  const itemId = typeof body.itemId === 'string' && UUID_RE.test(body.itemId) ? body.itemId : null;
  const moves = parseMoves(body.moves);
  if (!itemId || !moves) return json(400, { error: 'invalid_input' });

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const caller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await caller.auth.getUser();
  if (userError || !userData.user) return json(401, { error: 'unauthorized' });
  const studentId = userData.user.id;

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
    auth: { persistSession: false },
  });
  // Chỉ trả puzzle khi item thuộc bài được giao cho học viên này
  const { data: rows, error: puzzleError } = await admin.rpc('puzzle_for_student_item', {
    p_item: itemId,
    p_student: studentId,
  });
  if (puzzleError) return json(500, { error: 'lookup_failed' });
  const puzzle = rows?.[0];
  if (!puzzle) return json(403, { error: 'forbidden' });

  // Chấm lại từng nước của người giải; dừng ở nước sai đầu tiên hoặc khi đã giải xong
  const results: { uci: string; ok: boolean }[] = [];
  let step = 0;
  let solved = false;
  for (const m of moves) {
    const r = gradeMove({ fen: puzzle.fen, moves: puzzle.moves }, step, m.uci);
    results.push({ uci: m.uci, ok: r.result !== 'wrong' });
    if (r.result === 'wrong') break;
    if (r.result === 'solved') {
      solved = true;
      break;
    }
    step = r.nextStep;
  }
  const graded = moves.slice(0, results.length);
  const elapsed = graded.reduce((sum, m) => sum + m.ms, 0);

  const { data: existing } = await admin
    .from('attempts')
    .select('id, moves, tries, solved, time_ms, finished_at')
    .eq('item_id', itemId)
    .eq('student_id', studentId)
    .maybeSingle();

  const tries = (existing?.tries ?? 0) + 1;
  const now = new Date().toISOString();
  const record = {
    item_id: itemId,
    student_id: studentId,
    moves: [
      ...((existing?.moves as unknown[]) ?? []),
      ...graded.map((m, i) => ({ uci: m.uci, ms: m.ms, ok: results[i]?.ok ?? false, try: tries })),
    ],
    tries,
    solved: Boolean(existing?.solved) || solved,
    time_ms: Number(existing?.time_ms ?? 0) + elapsed,
    finished_at: existing?.finished_at ?? (solved ? now : null),
    updated_at: now,
  };
  const { error: saveError } = await admin
    .from('attempts')
    .upsert(record, { onConflict: 'item_id,student_id' });
  if (saveError) return json(500, { error: 'save_failed' });

  return json(200, { solved: record.solved, solvedThisTry: solved, tries, results });
});
