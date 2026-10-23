/**
 * Kiểm tích hợp Giai đoạn 5 trên Supabase thật (cấp độ, batch, rating, bảng xếp hạng, số liệu).
 * Dùng chung biến môi trường với phase4.integration.test.ts; bỏ qua khi thiếu (trên CI).
 * Mọi thứ tạo ra trong test đều được dọn trong `finally`.
 */
import { describe, expect, it } from 'vitest';
import { createErpClient } from './client';
import {
  createLevel,
  deleteLevel,
  fetchAcademyStats,
  fetchGroups,
  fetchLeaderboard,
  fetchLevels,
  fetchMembers,
  fetchMyAcademies,
  fetchRatings,
  setInitialRating,
  setStudentLevel,
  signInStudent,
  signInWithEmail,
  updateGroup,
} from './queries';

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

describe.skipIf(!ready)('Giai đoạn 5 trên Supabase thật', () => {
  it('owner tạo cấp, gán cấp + rating, đổi lớp thành batch; học viên xem bảng xếp hạng', {
    timeout: 60_000,
  }, async () => {
    const owner = newClient();
    const { user } = await signInWithEmail(owner, env.OWNER_EMAIL ?? '', env.OWNER_PASSWORD ?? '');
    const academy = (await fetchMyAcademies(owner, user.id)).find(
      (a) => a.slug === env.ACADEMY_SLUG,
    );
    if (!academy) throw new Error('không thấy học viện');
    const group = (await fetchGroups(owner, academy.id)).find((g) => g.name === env.GROUP_NAME);
    if (!group) throw new Error('không thấy lớp');
    const student = newClient();
    const { user: su } = await signInStudent(
      student,
      env.STUDENT_USERNAME ?? '',
      env.STUDENT_PIN ?? '',
    );

    const before = await fetchLevels(owner, academy.id);
    const position = (before.at(-1)?.position ?? -1) + 1;
    const level = await createLevel(
      owner,
      academy.id,
      { name: 'Tích hợp GĐ5', minRating: 0, maxRating: 600, color: '#3DBB95' },
      position,
    );
    const previousLevel =
      (await fetchMembers(owner, academy.id)).find((m) => m.profile.id === su.id)?.levelId ?? null;
    try {
      await setStudentLevel(owner, academy.id, su.id, level.id);
      const seen = (await fetchMembers(student, academy.id)).find((m) => m.profile.id === su.id);
      expect(seen?.levelId).toBe(level.id);
      expect((await fetchLevels(student, academy.id)).some((l) => l.id === level.id)).toBe(true);

      await setInitialRating(owner, academy.id, su.id, 'blitz', 777);
      const ratings = await fetchRatings(student, academy.id);
      expect(ratings.find((r) => r.student_id === su.id && r.category === 'blitz')).toMatchObject({
        rating: 777,
        rd: 350,
      });

      await updateGroup(owner, group.id, {
        kind: 'batch',
        levelId: level.id,
        schedule: [{ day: 6, start: '08:00', minutes: 90 }],
      });
      const batch = (await fetchGroups(owner, academy.id)).find((g) => g.id === group.id);
      expect(batch).toMatchObject({ kind: 'batch', level_id: level.id });

      const now = new Date();
      const board = await fetchLeaderboard(
        student,
        academy.id,
        new Date(now.getTime() - 180 * 864e5),
        new Date(now.getTime() + 60_000),
      );
      expect(board.some((r) => r.studentId === su.id)).toBe(true);

      const stats = await fetchAcademyStats(owner, academy.id);
      expect(stats?.students).toBeGreaterThanOrEqual(1);
      expect(stats?.batches).toBeGreaterThanOrEqual(1);
      expect(await fetchAcademyStats(student, academy.id)).toBeNull();
    } finally {
      await updateGroup(owner, group.id, {
        kind: group.kind === 'batch' ? 'batch' : 'group',
        levelId: group.level_id,
        schedule: [],
      });
      await setStudentLevel(owner, academy.id, su.id, previousLevel);
      await owner
        .from('ratings')
        .delete()
        .eq('academy_id', academy.id)
        .eq('student_id', su.id)
        .eq('category', 'blitz');
      await deleteLevel(owner, level.id);
    }
  });
});
