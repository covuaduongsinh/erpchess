import { z } from 'zod';

export const tournamentFormats = ['swiss', 'round_robin', 'quad', 'team_swiss'] as const;
export type TournamentFormat = (typeof tournamentFormats)[number];
export const tournamentControls = ['manual', 'auto_finish', 'auto_schedule'] as const;
export const tournamentRepeats = ['none', 'daily', 'weekly', 'monthly'] as const;
export type TournamentRepeat = (typeof tournamentRepeats)[number];

/** Khai cuộc định sẵn cho giải "kiểu ván: khai cuộc" (thế cờ sau vài nước, tự soạn). */
export const OPENING_PRESETS = [
  { id: 'italian', fen: 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4' },
  { id: 'ruy_lopez', fen: 'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3' },
  { id: 'sicilian', fen: 'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2' },
  { id: 'french', fen: 'rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2' },
  { id: 'caro_kann', fen: 'rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2' },
  { id: 'queens_gambit', fen: 'rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2' },
  { id: 'kings_indian', fen: 'rnbqkb1r/pppppp1p/5np1/8/2PP4/8/PP2PPPP/RNBQKBNR w KQkq - 0 3' },
  { id: 'london', fen: 'rnbqkbnr/ppp1pppp/8/3p4/3P1B2/8/PPP1PPPP/RN1QKBNR b KQkq - 1 2' },
] as const;

/**
 * Tạo giải. Phạm vi khớp CHECK trong migration `…0017_tournaments.sql`. Swiss đồng đội cần `teams`
 * (thành viên theo thứ tự bàn); thể thức khác dùng `playerIds`.
 */
export const tournamentInputSchema = z
  .object({
    academyId: z.uuid(),
    title: z.string().trim().min(1, 'title').max(160),
    description: z.string().trim().max(4000).default(''),
    location: z.string().trim().max(160).default(''),
    format: z.enum(tournamentFormats).default('swiss'),
    rounds: z.int().min(1).max(30).default(5),
    baseMs: z.int().min(60_000).max(10_800_000).nullable().default(600_000),
    incMs: z.int().min(0).max(180_000).default(0),
    rated: z.boolean().default(false),
    allowDraw: z.boolean().default(true),
    allowResign: z.boolean().default(true),
    isPublic: z.boolean().default(false),
    control: z.enum(tournamentControls).default('manual'),
    startKind: z.enum(['standard', 'opening', 'fen']).default('standard'),
    initialFen: z.string().trim().min(15).max(100).optional(),
    teamBoards: z.int().min(1).max(10).default(4),
    startsAt: z.iso.datetime({ offset: true }).nullable().default(null),
    timezone: z.string().max(64).default('Asia/Ho_Chi_Minh'),
    roundIntervalMin: z.int().min(0).max(10_080).default(0),
    repeat: z.enum(tournamentRepeats).default('none'),
    repeatUntil: z.iso.datetime({ offset: true }).nullable().default(null),
    playerIds: z.array(z.uuid()).default([]),
    teams: z
      .array(
        z.object({ name: z.string().trim().min(1).max(80), playerIds: z.array(z.uuid()).min(1) }),
      )
      .default([]),
  })
  .refine((v) => v.control !== 'auto_schedule' || v.startsAt !== null, {
    message: 'schedule',
    path: ['startsAt'],
  })
  .refine((v) => v.repeat === 'none' || v.startsAt !== null, {
    message: 'schedule',
    path: ['repeat'],
  });
export type TournamentInput = z.input<typeof tournamentInputSchema>;

/**
 * Lần tổ chức kế tiếp của giải lặp lại (giữ giờ trong ngày theo giờ địa phương của máy chạy);
 * `null` khi không lặp hoặc đã qua `until`.
 */
export function nextOccurrence(
  startsAt: Date,
  repeat: TournamentRepeat,
  until: Date | null,
): Date | null {
  if (repeat === 'none') return null;
  const next = new Date(startsAt);
  if (repeat === 'daily') next.setDate(next.getDate() + 1);
  else if (repeat === 'weekly') next.setDate(next.getDate() + 7);
  else {
    const day = next.getDate();
    next.setDate(1);
    next.setMonth(next.getMonth() + 1);
    // Tháng ngắn hơn (31 → 30/28) thì lấy ngày cuối tháng
    const last = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(day, last));
  }
  return until && next > until ? null : next;
}
