/**
 * Kiểm tích hợp Giai đoạn 6 trên Supabase thật: study 3 hoạt động, học viên nộp qua Edge Function
 * `submit-activity` (server chấm lại), tiến độ và điểm. Dùng chung biến môi trường với phase4;
 * bỏ qua khi thiếu (trên CI). Study tạo ra được xoá trong `finally`.
 */
import { describe, expect, it } from 'vitest';
import { createErpClient } from './client';
import {
  createDatabase,
  deleteDatabase,
  fetchDatabases,
  fetchGamePgn,
  importPgn,
  searchGames,
} from './databases';
import { fetchMyAcademies, fetchPuzzles, signInStudent, signInWithEmail } from './queries';
import {
  addActivity,
  createStudy,
  deleteStudy,
  fetchActivityAttempts,
  fetchStudies,
  fetchStudy,
  fetchStudyProgress,
  submitActivity,
} from './studies';

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

describe.skipIf(!ready)('Giai đoạn 6 trên Supabase thật', () => {
  it('HLV soạn study → học viên làm sai rồi đúng → điểm và tiến độ đúng', {
    timeout: 90_000,
  }, async () => {
    const owner = newClient();
    const { user } = await signInWithEmail(owner, env.OWNER_EMAIL ?? '', env.OWNER_PASSWORD ?? '');
    const academy = (await fetchMyAcademies(owner, user.id)).find(
      (a) => a.slug === env.ACADEMY_SLUG,
    );
    if (!academy) throw new Error('không thấy học viện');
    const puzzle = (await fetchPuzzles(owner, academy.id)).find(
      (p) => p.title === 'Chiếu hết hàng cuối',
    );
    if (!puzzle) throw new Error('thiếu puzzle mẫu');

    const study = await createStudy(owner, user.id, {
      academyId: academy.id,
      title: 'Tích hợp GĐ6',
      visibility: 'academy',
    });
    try {
      const p = await addActivity(
        owner,
        study.id,
        {
          kind: 'puzzle',
          payload: { fen: puzzle.fen, moves: puzzle.moves },
          wrongPenalty: 4,
        },
        0,
      );
      const q = await addActivity(
        owner,
        study.id,
        {
          kind: 'mcq',
          payload: { question: 'Quân nào đi chéo?', options: ['Xe', 'Tượng', 'Mã'], correct: 1 },
          maxAttempts: 2,
        },
        1,
      );
      const c = await addActivity(
        owner,
        study.id,
        { kind: 'capture', payload: { fen: '8/8/8/p3p3/8/8/8/R7 w - - 0 1' }, points: 20 },
        2,
      );

      const student = newClient();
      const { user: su } = await signInStudent(
        student,
        env.STUDENT_USERNAME ?? '',
        env.STUDENT_PIN ?? '',
      );
      const listed = await fetchStudies(student, {
        scope: 'academy',
        academyId: academy.id,
        userId: su.id,
      });
      expect(listed.find((s) => s.id === study.id)?.activityCount).toBe(3);
      const detail = await fetchStudy(student, study.id);
      expect(detail.activities.map((a) => a.kind)).toEqual(['puzzle', 'mcq', 'capture']);

      // Puzzle: sai một lần (trừ 4 điểm) rồi đúng
      expect(await submitActivity(student, p.id, { moves: ['d1d7'] })).toMatchObject({
        solved: false,
        tries: 1,
        score: 0,
      });
      expect(
        await submitActivity(student, p.id, { moves: [puzzle.moves[0] ?? ''] }, 3000),
      ).toMatchObject({ solved: true, tries: 2, score: 6 });
      // Đã giải: nộp nữa không đổi điểm
      expect(await submitActivity(student, p.id, { moves: ['d1d7'] })).toMatchObject({
        solved: true,
        score: 6,
      });

      // MCQ tối đa 2 lần: sai, sai, rồi bị từ chối
      expect(await submitActivity(student, q.id, { choice: 0 })).toMatchObject({
        solved: false,
        correct: 1,
      });
      await submitActivity(student, q.id, { choice: 2 });
      await expect(submitActivity(student, q.id, { choice: 1 })).rejects.toMatchObject({
        code: 'no_attempts_left',
      });

      // Bắt quân: nước sai luật bị cắt, chuỗi đúng thì giải được
      expect(await submitActivity(student, c.id, { moves: ['a1b2'] })).toMatchObject({
        solved: false,
        remaining: 2,
      });
      expect(await submitActivity(student, c.id, { moves: ['a1a5', 'a5e5'] })).toMatchObject({
        solved: true,
        score: 20,
      });

      const attempts = await fetchActivityAttempts(
        owner,
        detail.activities.map((a) => a.id),
        su.id,
      );
      expect(attempts).toHaveLength(3);
      const [progress] = (await fetchStudyProgress(owner, [study.id])).filter(
        (r) => r.studentId === su.id,
      );
      expect(progress).toMatchObject({ totalActivities: 3, completed: 2, score: 26 });
    } finally {
      await deleteStudy(owner, study.id);
    }
  });

  it('CSDL ván: nhập PGN (bỏ ván hỏng), tìm, đọc PGN; học viên không thấy CSDL riêng', {
    timeout: 60_000,
  }, async () => {
    const owner = newClient();
    const { user } = await signInWithEmail(owner, env.OWNER_EMAIL ?? '', env.OWNER_PASSWORD ?? '');
    const academy = (await fetchMyAcademies(owner, user.id)).find(
      (a) => a.slug === env.ACADEMY_SLUG,
    );
    if (!academy) throw new Error('không thấy học viện');
    const db = await createDatabase(owner, academy.id, user.id, 'Tích hợp GĐ6b');
    try {
      const result = await importPgn(
        owner,
        db.id,
        `[White "Nguyễn An"]
[Black "Trần Bình"]
[Result "1-0"]

1. e4 e5 2. Qh5 Nc6 3. Bc4 Nf6 4. Qxf7# 1-0

[White "Hỏng"]

1. e4 e4 *

[White "Lê Cường"]
[Black "Nguyễn An"]
[Event "Giải tháng 10"]
[Result "1/2-1/2"]

1. d4 d5 1/2-1/2`,
      );
      expect(result).toMatchObject({ imported: 2, failed: 1 });

      const all = await searchGames(owner, db.id);
      expect(all.total).toBe(2);
      const found = await searchGames(owner, db.id, { search: 'tháng 10' });
      expect(found.rows.map((g) => g.white)).toEqual(['Lê Cường']);
      const pgn = await fetchGamePgn(owner, all.rows[0]?.id ?? '');
      expect(pgn).toContain('Qxf7#');

      const student = newClient();
      await signInStudent(student, env.STUDENT_USERNAME ?? '', env.STUDENT_PIN ?? '');
      expect((await fetchDatabases(student, academy.id)).some((d) => d.id === db.id)).toBe(false);
      expect((await searchGames(student, db.id)).total).toBe(0);
    } finally {
      await deleteDatabase(owner, db.id);
    }
  });
});
