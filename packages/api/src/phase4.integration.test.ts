/**
 * Kiểm tích hợp Giai đoạn 4 trên Supabase thật, qua đúng các hàm mà web/mobile dùng.
 * Chỉ chạy khi có biến môi trường (bỏ qua trên CI):
 *   SUPABASE_URL SUPABASE_KEY OWNER_EMAIL OWNER_PASSWORD STUDENT_USERNAME STUDENT_PIN ACADEMY_SLUG GROUP_NAME
 */
import { describe, expect, it } from 'vitest';
import { createErpClient } from './client';
import {
  createAssignment,
  deleteAssignment,
  fetchAssignment,
  fetchAssignments,
  fetchAttempts,
  fetchGroups,
  fetchMyAcademies,
  fetchProgress,
  fetchPuzzles,
  signInStudent,
  signInWithEmail,
  submitAttempt,
} from './queries';

// Gói này không kéo @types/node; đọc biến môi trường qua globalThis
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

/** Mỗi client một kho phiên riêng trong bộ nhớ để HLV và học viên không đè phiên nhau. */
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

describe.skipIf(!ready)('Giai đoạn 4 trên Supabase thật', () => {
  it('HLV tạo bài → học viên làm (sai rồi đúng) → báo cáo đúng', { timeout: 60_000 }, async () => {
    const owner = newClient();
    const { user } = await signInWithEmail(owner, env.OWNER_EMAIL ?? '', env.OWNER_PASSWORD ?? '');
    const academy = (await fetchMyAcademies(owner, user.id)).find(
      (a) => a.slug === env.ACADEMY_SLUG,
    );
    if (!academy) throw new Error('không thấy học viện');
    const group = (await fetchGroups(owner, academy.id)).find((g) => g.name === env.GROUP_NAME);
    if (!group) throw new Error('không thấy lớp');
    const puzzles = await fetchPuzzles(owner, academy.id);
    const pick = (title: string) => {
      const p = puzzles.find((x) => x.title === title);
      if (!p) throw new Error(`thiếu puzzle ${title}`);
      return p;
    };
    const p1 = pick('Chiếu hết hàng cuối');
    const p2 = pick('Xe xiên vua để ăn hậu');

    const created = await createAssignment(owner, {
      academyId: academy.id,
      title: 'Tích hợp Giai đoạn 4',
      dueAt: new Date(Date.now() + 864e5).toISOString(),
      puzzleIds: [p1.id, p2.id],
      groupIds: [group.id],
    });
    try {
      const detail = await fetchAssignment(owner, created.id);
      expect(detail.items.map((i) => i.puzzle.id)).toEqual([p1.id, p2.id]);

      const student = newClient();
      const { user: su } = await signInStudent(
        student,
        env.STUDENT_USERNAME ?? '',
        env.STUDENT_PIN ?? '',
      );
      expect((await fetchAssignments(student, academy.id)).some((a) => a.id === created.id)).toBe(
        true,
      );
      const mine = await fetchAssignment(student, created.id);
      const [i1, i2] = mine.items;
      if (!i1 || !i2) throw new Error('thiếu câu');

      const wrong = await submitAttempt(student, i1.id, [{ uci: 'd1d7', ms: 3000 }]);
      expect(wrong).toMatchObject({ solved: false, tries: 1 });
      const right = await submitAttempt(student, i1.id, [{ uci: p1.moves[0] ?? '', ms: 2000 }]);
      expect(right).toMatchObject({ solved: true, tries: 2 });

      const own = await fetchAttempts(
        student,
        mine.items.map((i) => i.id),
        su.id,
      );
      expect(own).toHaveLength(1);
      expect(own[0]).toMatchObject({ item_id: i1.id, solved: true, tries: 2, time_ms: 5000 });

      const report = await fetchProgress(owner, { assignmentId: created.id });
      const row = report.find((r) => r.studentId === su.id);
      expect(row).toMatchObject({ solvedItems: 1, totalItems: 2, tries: 2, timeMs: 5000 });
    } finally {
      await deleteAssignment(owner, created.id);
    }
  });
});
