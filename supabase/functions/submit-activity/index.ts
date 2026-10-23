// Nộp kết quả một hoạt động trong Study. Server lấy đáp án qua `activity_for_student` (chỉ trả khi
// người nộp được xem study), tự chấm lại bằng chess-core rồi ghi activity_attempts bằng service role —
// client không có quyền ghi bảng này.
//
// Vào: { activityId, answer, ms? } với answer theo loại hoạt động:
//   puzzle / capture: { moves: string[] }   mcq: { choice: number }
//   engine: { result: 'win' | 'draw' | 'loss' }   explanation / video / game: { viewed: true }
// Ra:  { solved, solvedThisTry, tries, score, correct?, results? }
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { gradeCapture } from './_shared/chess-core/capture.ts';
import { gradeMove } from './_shared/chess-core/puzzle.ts';

const MAX_MOVES = 60;
const MAX_MS = 2 * 60 * 60_000;
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

type Activity = {
  kind: string;
  payload: Record<string, unknown>;
  points: number;
  max_attempts: number | null;
  wrong_penalty: number;
  hint_penalty: number;
};

type Graded = { ok: boolean; answer: unknown; extra?: Record<string, unknown> } | { error: string };

function parseMoves(raw: unknown): string[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_MOVES) return null;
  const moves = raw.map((m) => (typeof m === 'string' ? m.toLowerCase() : ''));
  return moves.every((m) => UCI_RE.test(m)) ? moves : null;
}

function grade(activity: Activity, answer: Record<string, unknown>): Graded {
  const p = activity.payload;
  switch (activity.kind) {
    case 'puzzle': {
      const moves = parseMoves(answer.moves);
      const fen = typeof p.fen === 'string' ? p.fen : '';
      const solution = Array.isArray(p.moves) ? (p.moves as string[]) : [];
      if (!moves) return { error: 'invalid_input' };
      // Học viên gửi nước của mình; nước đáp của đối phương do lời giải quy định
      const results: { uci: string; ok: boolean }[] = [];
      let step = 0;
      let solved = false;
      for (const uci of moves) {
        const r = gradeMove({ fen, moves: solution }, step, uci);
        results.push({ uci, ok: r.result !== 'wrong' });
        if (r.result === 'wrong') break;
        if (r.result === 'solved') {
          solved = true;
          break;
        }
        step = r.nextStep;
      }
      return { ok: solved, answer: { moves: moves.slice(0, results.length) }, extra: { results } };
    }
    case 'capture': {
      const moves = parseMoves(answer.moves);
      if (!moves) return { error: 'invalid_input' };
      const r = gradeCapture(typeof p.fen === 'string' ? p.fen : '', moves);
      return {
        ok: r.solved,
        answer: { moves: moves.slice(0, r.legalMoves) },
        extra: { captured: r.captured, remaining: r.remaining },
      };
    }
    case 'mcq': {
      const choice = answer.choice;
      if (typeof choice !== 'number' || !Number.isInteger(choice) || choice < 0 || choice > 5) {
        return { error: 'invalid_input' };
      }
      return { ok: choice === p.correct, answer: { choice }, extra: { correct: p.correct } };
    }
    case 'engine': {
      const result = answer.result;
      if (result !== 'win' && result !== 'draw' && result !== 'loss') {
        return { error: 'invalid_input' };
      }
      // Kết quả do client tự báo (chưa chạy engine phía server)
      const ok = result === 'win' || (p.goal === 'draw' && result === 'draw');
      return { ok, answer: { result, selfReported: true } };
    }
    case 'explanation':
    case 'video':
    case 'game':
      if (answer.viewed !== true) return { error: 'invalid_input' };
      return { ok: true, answer: { viewed: true } };
    default:
      return { error: 'unsupported_kind' };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json(401, { error: 'unauthorized' });

  let body: { activityId?: unknown; answer?: unknown; ms?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'invalid_json' });
  }
  const activityId =
    typeof body.activityId === 'string' && UUID_RE.test(body.activityId) ? body.activityId : null;
  const answer =
    body.answer && typeof body.answer === 'object' && !Array.isArray(body.answer)
      ? (body.answer as Record<string, unknown>)
      : null;
  if (!activityId || !answer) return json(400, { error: 'invalid_input' });
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
  const { data: rows, error: lookupError } = await admin.rpc('activity_for_student', {
    p_activity: activityId,
    p_student: studentId,
  });
  if (lookupError) return json(500, { error: 'lookup_failed' });
  const activity = rows?.[0] as Activity | undefined;
  if (!activity) return json(403, { error: 'forbidden' });

  const { data: existing } = await admin
    .from('activity_attempts')
    .select('answers, tries, solved, score, time_ms, finished_at')
    .eq('activity_id', activityId)
    .eq('student_id', studentId)
    .maybeSingle();

  // Đã giải thì không chấm lại (giữ điểm cũ); hết lượt thì từ chối
  if (existing?.solved) {
    return json(200, {
      solved: true,
      solvedThisTry: false,
      tries: existing.tries,
      score: existing.score,
    });
  }
  if (activity.max_attempts !== null && (existing?.tries ?? 0) >= activity.max_attempts) {
    return json(409, { error: 'no_attempts_left' });
  }

  const graded = grade(activity, answer);
  if ('error' in graded) return json(400, { error: graded.error });

  const tries = (existing?.tries ?? 0) + 1;
  const score = graded.ok ? Math.max(0, activity.points - (tries - 1) * activity.wrong_penalty) : 0;
  const now = new Date().toISOString();
  const record = {
    activity_id: activityId,
    student_id: studentId,
    answers: [
      ...((existing?.answers as unknown[]) ?? []),
      { try: tries, answer: graded.answer, ok: graded.ok, ms },
    ],
    tries,
    solved: graded.ok,
    score,
    time_ms: Number(existing?.time_ms ?? 0) + ms,
    finished_at: graded.ok ? now : null,
    updated_at: now,
  };
  const { error: saveError } = await admin
    .from('activity_attempts')
    .upsert(record, { onConflict: 'activity_id,student_id' });
  if (saveError) return json(500, { error: 'save_failed' });

  return json(200, {
    solved: graded.ok,
    solvedThisTry: graded.ok,
    tries,
    score,
    ...(graded.extra ?? {}),
  });
});
