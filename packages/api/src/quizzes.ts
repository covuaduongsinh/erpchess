/** Quiz (Giai đoạn 7): tạo, giao, làm bài (chấm phía server, giấu đáp án), bảng xếp hạng. */
import {
  type QuizInput,
  type QuizItemInput,
  type QuizKind,
  quizInputSchema,
  quizKinds,
} from '@erpchess/domain';
import type { ErpClient } from './client';
import type { Json, Tables } from './database.types';
import { ApiError, unwrap } from './queries';
import type { StudyActivity } from './studies';

export type QuizRow = Tables<'quizzes'>;
export type QuizSummary = QuizRow & {
  itemCount: number;
  targets: { group_id: string | null; student_id: string | null }[];
};
/** Câu hỏi học viên nhận được: đã lược đáp án. */
export type QuizQuestion = {
  id: string;
  position: number;
  kind: QuizKind;
  title: string;
  points: number;
  maxAttempts: number | null;
  payload: Record<string, unknown>;
};
export type QuizAttempt = Pick<
  Tables<'quiz_attempts'>,
  'item_id' | 'student_id' | 'tries' | 'solved' | 'score' | 'time_ms' | 'updated_at'
>;
export type QuizLeaderRow = {
  studentId: string;
  displayName: string;
  score: number;
  solved: number;
  timeMs: number;
};
export type QuizAnswerResult = {
  ok: boolean;
  solved: boolean;
  tries: number;
  score?: number;
  /** Puzzle: nước đáp của đối phương sau nước đúng */
  reply?: string;
  step?: number;
  remaining?: number;
};
export type QuizAnswer = { move: string; step: number } | { choice: number } | { moves: string[] };

/** Hoạt động Study chuyển thành câu quiz (chỉ 3 loại chấm được). */
export function quizItemsFromStudy(activities: readonly StudyActivity[]): QuizItemInput[] {
  return activities.flatMap((a) =>
    !a.invalid && (quizKinds as readonly string[]).includes(a.kind)
      ? [
          {
            kind: a.kind as QuizKind,
            payload: a.payload,
            title: a.title,
            points: a.points,
            maxAttempts: a.maxAttempts,
            wrongPenalty: a.wrongPenalty,
            sourceActivityId: a.id,
          } as QuizItemInput,
        ]
      : [],
  );
}

export async function fetchQuizzes(client: ErpClient, academyId: string): Promise<QuizSummary[]> {
  const rows = unwrap(
    await client
      .from('quizzes')
      .select('*, quiz_items(count), quiz_targets(group_id, student_id)')
      .eq('academy_id', academyId)
      .order('created_at', { ascending: false }),
  );
  // Học viên không đọc được quiz_items nên itemCount = 0 với họ; đếm câu qua quiz_items_for_student
  return rows.map(({ quiz_items, quiz_targets, ...q }) => ({
    ...q,
    itemCount: quiz_items[0]?.count ?? 0,
    targets: quiz_targets,
  }));
}

export async function fetchQuiz(client: ErpClient, id: string): Promise<QuizRow> {
  return unwrap(await client.from('quizzes').select('*').eq('id', id).single());
}

/**
 * Tạo quiz kèm đối tượng giao và câu hỏi. Không có transaction nhiều bảng qua PostgREST nên lỗi ở
 * bước sau thì xoá quiz vừa tạo (cascade).
 */
export async function createQuiz(
  client: ErpClient,
  userId: string,
  input: QuizInput,
): Promise<QuizRow> {
  const v = quizInputSchema.parse(input);
  const quiz = unwrap(
    await client
      .from('quizzes')
      .insert({
        academy_id: v.academyId,
        title: v.title,
        level_id: v.levelId,
        topics: v.topics,
        open_to_all: v.openToAll,
        starts_at: v.startsAt,
        due_at: v.dueAt,
        created_by: userId,
      })
      .select()
      .single(),
  );
  try {
    const targets = [
      ...v.groupIds.map((group_id) => ({ quiz_id: quiz.id, group_id })),
      ...v.studentIds.map((student_id) => ({ quiz_id: quiz.id, student_id })),
    ];
    if (targets.length) unwrap(await client.from('quiz_targets').insert(targets));
    unwrap(
      await client.from('quiz_items').insert(
        v.items.map((item, position) => ({
          quiz_id: quiz.id,
          position,
          kind: item.kind,
          title: item.title,
          payload: item.payload as unknown as Json,
          points: item.points,
          max_attempts: item.maxAttempts,
          wrong_penalty: item.wrongPenalty,
          source_activity_id: item.sourceActivityId,
        })),
      ),
    );
  } catch (err) {
    await client.from('quizzes').delete().eq('id', quiz.id);
    throw err;
  }
  return quiz;
}

export async function deleteQuiz(client: ErpClient, id: string) {
  unwrap(await client.from('quizzes').delete().eq('id', id));
}

/** Đề đã lược đáp án (học viên); trả rỗng khi quiz chưa mở hoặc không được giao. */
export async function fetchQuizQuestions(
  client: ErpClient,
  quizId: string,
): Promise<QuizQuestion[]> {
  const rows = unwrap(await client.rpc('quiz_items_for_student', { p_quiz: quizId }));
  return rows.map((r) => ({
    id: r.id,
    position: r.item_position,
    kind: r.kind as QuizKind,
    title: r.title,
    points: r.points,
    maxAttempts: r.max_attempts,
    payload: (r.payload ?? {}) as Record<string, unknown>,
  }));
}

/** Câu hỏi kèm đáp án (chỉ staff đọc được). */
export async function fetchQuizItems(client: ErpClient, quizId: string) {
  return unwrap(
    await client.from('quiz_items').select('*').eq('quiz_id', quizId).order('position'),
  );
}

export async function answerQuizItem(
  client: ErpClient,
  itemId: string,
  answer: QuizAnswer,
  ms = 0,
): Promise<QuizAnswerResult> {
  const { data, error } = await client.functions.invoke<QuizAnswerResult>('quiz-answer', {
    body: { itemId, ms: Math.round(ms), ...answer },
  });
  if (error) {
    const ctx = (error as { context?: unknown }).context;
    let code: string | undefined;
    if (ctx instanceof Response) {
      try {
        code = ((await ctx.json()) as { error?: string }).error;
      } catch {
        code = undefined;
      }
    }
    throw new ApiError(code ?? error.message, code);
  }
  if (!data) throw new ApiError('Không nhận được phản hồi');
  return data;
}

export async function fetchQuizAttempts(
  client: ErpClient,
  itemIds: readonly string[],
  studentId?: string,
): Promise<QuizAttempt[]> {
  if (itemIds.length === 0) return [];
  let q = client
    .from('quiz_attempts')
    .select('item_id, student_id, tries, solved, score, time_ms, updated_at')
    .in('item_id', [...itemIds]);
  if (studentId) q = q.eq('student_id', studentId);
  return unwrap(await q);
}

export async function fetchQuizLeaderboard(
  client: ErpClient,
  quizId: string,
): Promise<QuizLeaderRow[]> {
  const rows = unwrap(await client.rpc('quiz_leaderboard', { p_quiz: quizId }));
  return rows.map((r) => ({
    studentId: r.student_id,
    displayName: r.display_name,
    score: r.score,
    solved: r.solved,
    timeMs: Number(r.time_ms),
  }));
}
