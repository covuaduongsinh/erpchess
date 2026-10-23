/** Exercise (bài tập dùng lại), Quiz tự động theo cấp độ và Practice (Giai đoạn 7c). */
import { z } from 'zod';

export const exerciseInputSchema = z.object({
  academyId: z.uuid(),
  title: z.string().trim().min(1, 'title').max(160, 'title'),
  description: z.string().trim().max(2000).default(''),
  levelId: z.uuid().nullable().default(null),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  puzzleIds: z.array(z.uuid()).min(1, 'puzzles').max(100),
});
export type ExerciseInput = z.input<typeof exerciseInputSchema>;

export const practicePositionSchema = z.object({
  title: z.string().trim().max(160).default(''),
  fen: z.string().trim().min(15, 'fen').max(100, 'fen'),
  side: z.enum(['w', 'b']),
  goal: z.enum(['win', 'draw']).default('win'),
  elo: z.int().min(1000).max(3500).nullable().default(null),
});
export type PracticePositionInput = z.input<typeof practicePositionSchema>;

/** Bộ sinh số ngẫu nhiên có hạt giống (mulberry32) để chọn đề tái lập được trong test. */
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Quiz tự động: chọn ngẫu nhiên tối đa `n` puzzle có rating trong khoảng của cấp độ
 * ([minRating, maxRating), maxRating null = không giới hạn trên). Không đủ thì lấy hết.
 */
export function pickAutoQuizPuzzles<P extends { id: string; rating: number }>(
  puzzles: readonly P[],
  level: { minRating: number; maxRating: number | null },
  n: number,
  seed = Date.now(),
): P[] {
  const pool = puzzles.filter(
    (p) => p.rating >= level.minRating && (level.maxRating === null || p.rating < level.maxRating),
  );
  const rand = random(seed);
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j] as P, shuffled[i] as P];
  }
  return shuffled.slice(0, Math.max(0, n));
}
