import { z } from 'zod';

/** Tạo / sửa khoá học. Phạm vi khớp CHECK trong migration `…0019_courses_xp.sql`. */
export const courseInputSchema = z.object({
  academyId: z.uuid(),
  title: z.string().trim().min(1, 'title').max(160),
  description: z.string().trim().max(4000).default(''),
  levelId: z.uuid().nullable().default(null),
  openToAll: z.boolean().default(false),
  autoCertificate: z.boolean().default(true),
});
export type CourseInput = z.input<typeof courseInputSchema>;

export type Streak = { current: number; longest: number };

function dayKey(d: string | Date): number {
  const s = typeof d === 'string' ? d : d.toISOString().slice(0, 10);
  return Math.round(Date.parse(`${s}T00:00:00Z`) / 86_400_000);
}

/**
 * Chuỗi ngày học từ danh sách ngày có XP (YYYY-MM-DD, giờ Việt Nam). Chuỗi hiện tại tính tới hôm
 * nay; nếu hôm nay chưa học thì vẫn giữ chuỗi kết thúc hôm qua (chưa "đứt" cho tới hết ngày).
 */
export function streakFrom(days: readonly string[], today: string): Streak {
  const set = new Set(days.map(dayKey));
  const sorted = [...set].sort((a, b) => a - b);
  let longest = 0;
  let run = 0;
  let prev: number | null = null;
  for (const d of sorted) {
    run = prev !== null && d === prev + 1 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  const t = dayKey(today);
  let start = set.has(t) ? t : set.has(t - 1) ? t - 1 : null;
  let current = 0;
  while (start !== null && set.has(start)) {
    current++;
    start--;
  }
  return { current, longest };
}

/** Ngày hôm nay theo giờ Việt Nam (YYYY-MM-DD), khớp cột `xp_events.day`. */
export function vnToday(now = new Date()): string {
  return new Date(now.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
}
