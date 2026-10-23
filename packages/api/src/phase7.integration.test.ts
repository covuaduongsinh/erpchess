/**
 * Kiểm tích hợp Giai đoạn 7 trên Supabase thật: quiz giấu đáp án, chấm puzzle từng nước ở server,
 * giới hạn lượt, quiz đã đóng. Dùng chung biến môi trường với phase4; bỏ qua khi thiếu (trên CI).
 */
import { describe, expect, it } from 'vitest';
import { createErpClient } from './client';
import {
  fetchGroups,
  fetchMyAcademies,
  fetchPuzzles,
  signInStudent,
  signInWithEmail,
} from './queries';
import {
  answerQuizItem,
  createQuiz,
  deleteQuiz,
  fetchQuizLeaderboard,
  fetchQuizQuestions,
  fetchQuizzes,
} from './quizzes';

const env: Record<string, string | undefined> =
  (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const ready = [
  'SUPABASE_URL',
  'SUPABASE_KEY',
  'OWNER_EMAIL',
  'OWNER_PASSWORD',
  'STUDENT_USERNAME',
  'STUDENT_PIN',
  'ACADEMY_SLUG',
  'GROUP_NAME',
].every((k) => env[k]);

function newClient() {
  const store = new Map<string, string>();
  return createErpClient({
    url: env.SUPABASE_URL ?? '',
    key: env.SUPABASE_KEY ?? '',
    detectSessionInUrl: false,
    storage: {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => void store.set(k, v),
      removeItem: (k) => void store.delete(k),
    },
  });
}

describe.skipIf(!ready)('Giai đoạn 7 trên Supabase thật', () => {
  it('quiz giấu đáp án, chấm từng nước, hết lượt, quiz đã đóng', { timeout: 120_000 }, async () => {
    const owner = newClient();
    const { user } = await signInWithEmail(owner, env.OWNER_EMAIL ?? '', env.OWNER_PASSWORD ?? '');
    const academy = (await fetchMyAcademies(owner, user.id)).find(
      (a) => a.slug === env.ACADEMY_SLUG,
    );
    if (!academy) throw new Error('không thấy học viện');
    const group = (await fetchGroups(owner, academy.id)).find((g) => g.name === env.GROUP_NAME);
    if (!group) throw new Error('không thấy lớp');
    const skewer = (await fetchPuzzles(owner, academy.id)).find(
      (p) => p.title === 'Xe xiên vua để ăn hậu',
    );
    if (!skewer) throw new Error('thiếu puzzle mẫu');
    expect(skewer.moves).toHaveLength(3);

    const quiz = await createQuiz(owner, user.id, {
      academyId: academy.id,
      title: 'Tích hợp GĐ7',
      groupIds: [group.id],
      items: [
        { kind: 'puzzle', payload: { fen: skewer.fen, moves: skewer.moves }, wrongPenalty: 2 },
        {
          kind: 'mcq',
          payload: { question: 'Quân nào đi chéo?', options: ['Xe', 'Tượng'], correct: 1 },
          maxAttempts: 1,
        },
        { kind: 'capture', payload: { fen: '8/8/8/p3p3/8/8/8/R7 w - - 0 1' }, points: 20 },
      ],
    });
    const closed = await createQuiz(owner, user.id, {
      academyId: academy.id,
      title: 'Tích hợp GĐ7 — đã đóng',
      groupIds: [group.id],
      dueAt: new Date(Date.now() - 60_000).toISOString(),
      items: [{ kind: 'mcq', payload: { question: '?', options: ['a', 'b'], correct: 0 } }],
    });
    try {
      const student = newClient();
      const { user: su } = await signInStudent(
        student,
        env.STUDENT_USERNAME ?? '',
        env.STUDENT_PIN ?? '',
      );
      expect((await fetchQuizzes(student, academy.id)).some((q) => q.id === quiz.id)).toBe(true);

      // Đọc thẳng bảng quiz_items: RLS trả rỗng; đề qua RPC không có đáp án
      const direct = await student.from('quiz_items').select('payload').eq('quiz_id', quiz.id);
      expect(direct.data ?? []).toEqual([]);
      const questions = await fetchQuizQuestions(student, quiz.id);
      expect(questions.map((q) => q.kind)).toEqual(['puzzle', 'mcq', 'capture']);
      expect(JSON.stringify(questions)).not.toMatch(/"moves"|"correct"/);
      const [puzzle, mcq, capture] = questions;
      if (!puzzle || !mcq || !capture) throw new Error('thiếu câu');

      // Puzzle: sai một lần, rồi đúng từng nước; server trả nước đáp
      expect(await answerQuizItem(student, puzzle.id, { move: 'a1a8', step: 0 })).toMatchObject({
        ok: false,
        tries: 1,
      });
      const first = await answerQuizItem(
        student,
        puzzle.id,
        { move: skewer.moves[0] ?? '', step: 0 },
        2000,
      );
      expect(first).toMatchObject({ ok: true, solved: false, reply: skewer.moves[1], step: 2 });
      expect(
        await answerQuizItem(student, puzzle.id, { move: skewer.moves[2] ?? '', step: 2 }, 3000),
      ).toMatchObject({ ok: true, solved: true, tries: 2, score: 8 });

      // Trắc nghiệm 1 lượt: sai thì không lộ đáp án, nộp lại bị chặn
      const wrong = await answerQuizItem(student, mcq.id, { choice: 0 });
      expect(wrong).toMatchObject({ ok: false, tries: 1 });
      expect(wrong).not.toHaveProperty('correct');
      await expect(answerQuizItem(student, mcq.id, { choice: 1 })).rejects.toMatchObject({
        code: 'no_attempts_left',
      });

      expect(await answerQuizItem(student, capture.id, { moves: ['a1a5', 'a5e5'] })).toMatchObject({
        ok: true,
        score: 20,
      });

      const board = await fetchQuizLeaderboard(student, quiz.id);
      expect(board.find((r) => r.studentId === su.id)).toMatchObject({ score: 28, solved: 2 });

      // Quiz đã quá hạn
      const [closedQ] = await fetchQuizQuestions(student, closed.id);
      if (!closedQ) throw new Error('thiếu câu quiz đóng');
      await expect(answerQuizItem(student, closedQ.id, { choice: 0 })).rejects.toMatchObject({
        code: 'quiz_closed',
      });
    } finally {
      await deleteQuiz(owner, quiz.id);
      await deleteQuiz(owner, closed.id);
    }
  });
});
