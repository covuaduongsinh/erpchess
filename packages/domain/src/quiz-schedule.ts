/** Lịch quiz tự động (Giai đoạn 24b, đặc tả REA: Quiz → Automated Quiz). */
import { z } from 'zod';

export const quizScheduleSchema = z
  .object({
    name: z.string().trim().min(1, 'name').max(120, 'name'),
    // 0 = Chủ nhật … 6 = Thứ bảy
    days: z
      .array(z.int().min(0).max(6))
      .min(1, 'scheduleDays')
      .transform((d) => [...new Set(d)].sort((a, b) => a - b)),
    atTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'time'),
    timezone: z.string().trim().min(1).max(64).default('Asia/Ho_Chi_Minh'),
    expiresOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'date')
      .nullable()
      .default(null),
    studyIds: z.array(z.uuid()).min(1, 'studies').max(50, 'studies'),
    openHours: z.int().min(1).max(336).default(24),
    groupIds: z.array(z.uuid()).default([]),
    studentIds: z.array(z.uuid()).default([]),
  })
  .refine((v) => v.groupIds.length + v.studentIds.length > 0, {
    message: 'targets',
    path: ['groupIds'],
  });

export type QuizScheduleInput = z.input<typeof quizScheduleSchema>;

/** Study sẽ được giao ở lần chạy tới (con trỏ quay vòng trong chuỗi). */
export function nextScheduledStudy(studyIds: readonly string[], nextIndex: number): string | null {
  if (studyIds.length === 0) return null;
  return studyIds[((nextIndex % studyIds.length) + studyIds.length) % studyIds.length] ?? null;
}
