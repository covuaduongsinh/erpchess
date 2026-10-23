/**
 * Study: chuỗi hoạt động học có thứ tự (Giai đoạn 6). Schema ở đây chỉ kiểm hình dạng; tính hợp lệ
 * về cờ (FEN, nước đi, PGN) do chess-core kiểm ở nơi soạn và ở Edge Function `submit-activity`.
 * Khớp CHECK trong supabase/migrations/20261024000006_studies.sql.
 */
import { z } from 'zod';

export const studyVisibilities = ['private', 'academy', 'public'] as const;
export type StudyVisibility = (typeof studyVisibilities)[number];

export const activityKinds = [
  'puzzle',
  'mcq',
  'capture',
  'explanation',
  'engine',
  'video',
  'game',
] as const;
export type ActivityKind = (typeof activityKinds)[number];

/** Loại được chấm đúng/sai phía server; các loại còn lại chỉ ghi nhận "đã xem/đã làm". */
export const gradedKinds: readonly ActivityKind[] = ['puzzle', 'mcq', 'capture', 'engine'];

const fen = z.string().trim().min(15, 'fen').max(100, 'fen');
const uci = z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/, 'uci');

export const puzzlePayloadSchema = z.object({
  fen,
  // Nước xen kẽ người giải/đối phương; số lẻ để người giải đi nước cuối
  moves: z
    .array(uci)
    .min(1, 'moves')
    .max(39, 'moves')
    .refine((m) => m.length % 2 === 1, 'moves'),
});

export const mcqPayloadSchema = z
  .object({
    question: z.string().trim().min(1, 'question').max(500, 'question'),
    fen: fen.optional(),
    imageUrl: z.string().trim().max(500).optional(),
    options: z.array(z.string().trim().min(1, 'option').max(200, 'option')).min(2).max(6),
    correct: z.int().min(0),
  })
  .refine((v) => v.correct < v.options.length, { message: 'correct', path: ['correct'] });

export const capturePayloadSchema = z.object({ fen });

export const arrowSchema = z.object({
  from: z.string().regex(/^[a-h][1-8]$/),
  to: z.string().regex(/^[a-h][1-8]$/),
  brush: z.enum(['green', 'red', 'blue', 'yellow']).default('green'),
});

export const explanationPayloadSchema = z.object({
  body: z.string().trim().min(1, 'body').max(10_000, 'body'),
  fen: fen.optional(),
  arrows: z.array(arrowSchema).max(20).optional(),
});

export const enginePayloadSchema = z.object({
  fen,
  side: z.enum(['w', 'b']),
  /** null = máy chơi hết sức */
  elo: z.int().min(1000).max(3500).nullable(),
  goal: z.enum(['win', 'draw']),
});

/** YouTube, Vimeo, link https tới tệp video, hoặc đường dẫn trong bucket `study-media`. */
export const videoPayloadSchema = z.object({
  url: z
    .string()
    .trim()
    .max(500, 'url')
    .refine((v) => /^https:\/\/\S+$/i.test(v) || /^storage:study-media\/\S+$/.test(v), 'url'),
});

export const gamePayloadSchema = z.object({
  pgn: z.string().trim().min(1, 'pgn').max(100_000, 'pgn'),
});

const common = {
  title: z.string().trim().max(160, 'title').default(''),
  points: z.int().min(0).max(1000).default(10),
  maxAttempts: z.int().min(1).max(100).nullable().default(null),
  timeLimitS: z.int().min(5).max(7200).nullable().default(null),
  wrongPenalty: z.int().min(0).max(1000).default(0),
  hintPenalty: z.int().min(0).max(1000).default(0),
  topics: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
};

export const activityInputSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('puzzle'), payload: puzzlePayloadSchema, ...common }),
  z.object({ kind: z.literal('mcq'), payload: mcqPayloadSchema, ...common }),
  z.object({ kind: z.literal('capture'), payload: capturePayloadSchema, ...common }),
  z.object({ kind: z.literal('explanation'), payload: explanationPayloadSchema, ...common }),
  z.object({ kind: z.literal('engine'), payload: enginePayloadSchema, ...common }),
  z.object({ kind: z.literal('video'), payload: videoPayloadSchema, ...common }),
  z.object({ kind: z.literal('game'), payload: gamePayloadSchema, ...common }),
]);
export type ActivityInput = z.input<typeof activityInputSchema>;
export type Activity = z.output<typeof activityInputSchema>;
export type ActivityPayload<K extends ActivityKind> = Extract<Activity, { kind: K }>['payload'];

export const studyInputSchema = z.object({
  academyId: z.uuid(),
  title: z.string().trim().min(1, 'title').max(160, 'title'),
  description: z.string().trim().max(2000, 'description').default(''),
  levelId: z.uuid().nullable().default(null),
  visibility: z.enum(studyVisibilities).default('private'),
});
export type StudyInput = z.input<typeof studyInputSchema>;

/**
 * Điểm khi giải xong ở lần thử thứ `tries` (bắt đầu từ 1): mỗi lần sai trước đó trừ `wrongPenalty`,
 * mỗi gợi ý trừ `hintPenalty`, không âm. Chưa giải thì 0.
 */
export function scoreActivity(o: {
  solved: boolean;
  points: number;
  tries: number;
  wrongPenalty: number;
  hintsUsed?: number;
  hintPenalty?: number;
}): number {
  if (!o.solved) return 0;
  const wrong = Math.max(0, o.tries - 1) * o.wrongPenalty;
  const hints = (o.hintsUsed ?? 0) * (o.hintPenalty ?? 0);
  return Math.max(0, o.points - wrong - hints);
}

/** Thời lượng dự kiến của study (phút) để hiện trên thẻ: hoạt động có giới hạn giờ dùng giới hạn đó. */
export function estimateMinutes(
  activities: readonly { kind: ActivityKind; timeLimitS?: number | null }[],
): number {
  const defaults: Record<ActivityKind, number> = {
    puzzle: 120,
    mcq: 45,
    capture: 90,
    explanation: 90,
    engine: 300,
    video: 300,
    game: 240,
  };
  const seconds = activities.reduce((s, a) => s + (a.timeLimitS ?? defaults[a.kind]), 0);
  return Math.max(1, Math.round(seconds / 60));
}
