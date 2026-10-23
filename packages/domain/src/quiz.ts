/** Quiz (Giai đoạn 7): ghép câu từ Study/thư viện puzzle, giao cho học viên, có lịch mở/đóng. */
import { z } from 'zod';
import { activityInputSchema } from './study';

export const quizKinds = ['puzzle', 'mcq', 'capture'] as const;
export type QuizKind = (typeof quizKinds)[number];

/** Câu quiz = hoạt động Study thuộc 3 loại chấm được, kèm nguồn (nếu lấy từ Study). */
export const quizItemSchema = activityInputSchema
  .refine((a) => (quizKinds as readonly string[]).includes(a.kind), { message: 'kind' })
  .and(z.object({ sourceActivityId: z.uuid().nullable().default(null) }));
export type QuizItemInput = z.input<typeof quizItemSchema>;

export const quizInputSchema = z
  .object({
    academyId: z.uuid(),
    title: z.string().trim().min(1, 'title').max(160, 'title'),
    levelId: z.uuid().nullable().default(null),
    topics: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
    openToAll: z.boolean().default(false),
    /** Sinh tự động theo cấp độ */
    auto: z.boolean().default(false),
    startsAt: z.iso.datetime({ offset: true }).nullable().default(null),
    dueAt: z.iso.datetime({ offset: true }).nullable().default(null),
    groupIds: z.array(z.uuid()).default([]),
    studentIds: z.array(z.uuid()).default([]),
    items: z.array(quizItemSchema).min(1, 'items').max(50, 'items'),
  })
  .refine((v) => v.openToAll || v.groupIds.length + v.studentIds.length > 0, {
    message: 'targets',
    path: ['groupIds'],
  })
  .refine((v) => !v.startsAt || !v.dueAt || Date.parse(v.dueAt) > Date.parse(v.startsAt), {
    message: 'schedule',
    path: ['dueAt'],
  });
export type QuizInput = z.input<typeof quizInputSchema>;

export type QuizStatus = 'upcoming' | 'open' | 'closed';

export function quizStatus(
  startsAt: string | null,
  dueAt: string | null,
  now: Date = new Date(),
): QuizStatus {
  if (startsAt && Date.parse(startsAt) > now.getTime()) return 'upcoming';
  if (dueAt && Date.parse(dueAt) < now.getTime()) return 'closed';
  return 'open';
}

/**
 * Đề cho học viên: bỏ đáp án. Phải khớp hàm SQL `quiz_items_for_student` (puzzle chỉ còn thế cờ,
 * trắc nghiệm bỏ `correct`, bắt quân giữ nguyên vì không có đáp án).
 */
export function stripQuizAnswer(kind: QuizKind, payload: Record<string, unknown>) {
  if (kind === 'puzzle') return { fen: payload.fen };
  if (kind === 'mcq') {
    const { correct: _correct, ...rest } = payload;
    return rest;
  }
  return payload;
}
