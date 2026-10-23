// Trả lời một câu trong Quiz. Học viên KHÔNG có đáp án: server giữ đáp án và chấm.
//   puzzle:  { itemId, move, step, ms? } — chấm từng nước. `step` là bước client đang ở; gửi 0 để
//            bắt đầu lại lượt thử. Đúng → { ok: true, reply?, solved }, sai → hết lượt thử.
//   mcq:     { itemId, choice, ms? }
//   capture: { itemId, moves, ms? }
// Từ chối quiz chưa mở (quiz_not_started), đã đóng (quiz_closed), hết lượt (no_attempts_left).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { gradeCapture } from './_shared/chess-core/capture.ts';
import { gradeMove } from './_shared/chess-core/puzzle.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UCI_RE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
const MAX_MS = 60 * 60_000;

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

type Item = {
  kind: string;
  payload: Record<string, unknown>;
  points: number;
  max_attempts: number | null;
  wrong_penalty: number;
  starts_at: string | null;
  due_at: string | null;
};
type PuzzleState = { step?: number; moves?: string[] };

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
  const itemId = typeof body.itemId === 'string' && UUID_RE.test(body.itemId) ? body.itemId : null;
  if (!itemId) return json(400, { error: 'invalid_input' });
  const rawMs = Number(body.ms);
  const ms = Number.isFinite(rawMs) ? Math.min(Math.max(0, Math.round(rawMs)), MAX_MS) : 0;

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
  const { data: rows, error: lookupError } = await admin.rpc('quiz_item_for_student', {
    p_item: itemId,
    p_student: studentId,
  });
  if (lookupError) return json(500, { error: 'lookup_failed' });
  const item = rows?.[0] as Item | undefined;
  if (!item) return json(403, { error: 'forbidden' });

  const now = new Date();
  if (item.starts_at && new Date(item.starts_at) > now)
    return json(403, { error: 'quiz_not_started' });
  if (item.due_at && new Date(item.due_at) < now) return json(403, { error: 'quiz_closed' });

  const { data: existing } = await admin
    .from('quiz_attempts')
    .select('answers, tries, solved, score, time_ms, state')
    .eq('item_id', itemId)
    .eq('student_id', studentId)
    .maybeSingle();
  if (existing?.solved) {
    return json(200, { ok: true, solved: true, tries: existing.tries, score: existing.score });
  }
  const tries = existing?.tries ?? 0;
  if (item.max_attempts !== null && tries >= item.max_attempts) {
    return json(409, { error: 'no_attempts_left' });
  }

  const answers = (existing?.answers as unknown[]) ?? [];
  const timeMs = Number(existing?.time_ms ?? 0) + ms;
  const nowIso = now.toISOString();
  const scoreFor = (t: number) => Math.max(0, item.points - (t - 1) * item.wrong_penalty);

  async function save(fields: Record<string, unknown>) {
    const { error } = await admin
      .from('quiz_attempts')
      .upsert(
        { item_id: itemId, student_id: studentId, updated_at: nowIso, time_ms: timeMs, ...fields },
        { onConflict: 'item_id,student_id' },
      );
    return error;
  }

  if (item.kind === 'puzzle') {
    const move = typeof body.move === 'string' ? body.move.toLowerCase() : '';
    if (!UCI_RE.test(move)) return json(400, { error: 'invalid_input' });
    const saved = (existing?.state ?? {}) as PuzzleState;
    // Client gửi step 0 nghĩa là bắt đầu lại lượt thử từ thế đầu
    const state: Required<PuzzleState> =
      body.step === 0
        ? { step: 0, moves: [] }
        : { step: saved.step ?? 0, moves: saved.moves ?? [] };
    if (typeof body.step === 'number' && body.step !== state.step) {
      return json(409, { error: 'out_of_sync', step: state.step });
    }
    const puzzle = {
      fen: String(item.payload.fen ?? ''),
      moves: Array.isArray(item.payload.moves) ? (item.payload.moves as string[]) : [],
    };
    const r = gradeMove(puzzle, state.step, move);
    const moves = [...state.moves, move];

    if (r.result === 'correct') {
      const error = await save({
        tries,
        answers,
        state: { step: r.nextStep, moves: [...moves, r.reply] },
      });
      if (error) return json(500, { error: 'save_failed' });
      return json(200, { ok: true, solved: false, reply: r.reply, step: r.nextStep, tries });
    }
    const t = tries + 1;
    const solved = r.result === 'solved';
    const score = solved ? scoreFor(t) : 0;
    const error = await save({
      tries: t,
      solved,
      score,
      answers: [...answers, { try: t, moves, ok: solved }],
      state: {},
      finished_at: solved ? nowIso : null,
    });
    if (error) return json(500, { error: 'save_failed' });
    return json(200, { ok: solved, solved, tries: t, score });
  }

  let ok: boolean;
  let answer: unknown;
  const extra: Record<string, unknown> = {};
  if (item.kind === 'mcq') {
    const choice = body.choice;
    if (typeof choice !== 'number' || !Number.isInteger(choice) || choice < 0 || choice > 5) {
      return json(400, { error: 'invalid_input' });
    }
    ok = choice === item.payload.correct;
    answer = { choice };
  } else if (item.kind === 'capture') {
    const raw = body.moves;
    if (!Array.isArray(raw) || raw.length === 0 || raw.length > 60)
      return json(400, { error: 'invalid_input' });
    const moves = raw.map((m) => (typeof m === 'string' ? m.toLowerCase() : ''));
    if (!moves.every((m) => UCI_RE.test(m))) return json(400, { error: 'invalid_input' });
    const g = gradeCapture(String(item.payload.fen ?? ''), moves);
    ok = g.solved;
    answer = { moves: moves.slice(0, g.legalMoves) };
    extra.remaining = g.remaining;
  } else {
    return json(400, { error: 'unsupported_kind' });
  }

  const t = tries + 1;
  const score = ok ? scoreFor(t) : 0;
  const error = await save({
    tries: t,
    solved: ok,
    score,
    answers: [...answers, { try: t, answer, ok }],
    finished_at: ok ? nowIso : null,
  });
  if (error) return json(500, { error: 'save_failed' });
  // Không trả đáp án đúng của trắc nghiệm (khác Study) để học viên không lan truyền đáp án
  return json(200, { ok, solved: ok, tries: t, score, ...extra });
});
