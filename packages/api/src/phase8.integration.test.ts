/**
 * Kiểm tích hợp Giai đoạn 8a trên Supabase thật: chuỗi lớp lặp, người tham gia, điểm danh tự ghi,
 * sự kiện Calendar. Dùng chung biến môi trường với phase4; bỏ qua khi thiếu (trên CI).
 */
import { describe, expect, it } from 'vitest';
import {
  createClassrooms,
  deleteClassroom,
  fetchCalendarEvents,
  fetchClassroom,
  fetchClassroomRoster,
  fetchClassrooms,
  joinClassroom,
  setAttendance,
} from './classrooms';
import { createErpClient } from './client';
import { fetchGroups, fetchMyAcademies, signInStudent, signInWithEmail } from './queries';
import { ClassroomRoom, emptySnapshot, type RoomChat, type RoomSnapshot } from './room';

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

describe.skipIf(!ready)('Giai đoạn 8 trên Supabase thật', () => {
  it('chuỗi lớp lặp, điểm danh, Calendar', { timeout: 120_000 }, async () => {
    const owner = newClient();
    const { user } = await signInWithEmail(owner, env.OWNER_EMAIL ?? '', env.OWNER_PASSWORD ?? '');
    const academy = (await fetchMyAcademies(owner, user.id)).find(
      (a) => a.slug === env.ACADEMY_SLUG,
    );
    if (!academy) throw new Error('không thấy học viện');
    const group = (await fetchGroups(owner, academy.id)).find((g) => g.name === env.GROUP_NAME);
    if (!group) throw new Error('không thấy lớp');

    // Bắt đầu từ ngày mai, lặp Thứ hai + Thứ năm trong 2 tuần → 4 buổi
    const start = new Date();
    start.setDate(start.getDate() + 1);
    start.setHours(0, 0, 0, 0);
    const series = await createClassrooms(owner, user.id, {
      academyId: academy.id,
      title: 'Tích hợp GĐ8',
      kind: 'offline',
      startsAt: start.toISOString(),
      groupIds: [group.id],
      repeat: {
        schedule: [
          { day: 1, start: '18:00', minutes: 90 },
          { day: 4, start: '18:00', minutes: 90 },
        ],
        weeks: 2,
      },
    });
    const hidden = await createClassrooms(owner, user.id, {
      academyId: academy.id,
      title: 'Tích hợp GĐ8 — không giao',
      startsAt: start.toISOString(),
    });
    const ids = [...series, ...hidden].map((c) => c.id);
    try {
      expect(series).toHaveLength(4);
      expect(new Set(series.map((c) => c.series_id)).size).toBe(1);
      expect(series.every((c) => c.minutes === 90 && c.coach_id === user.id)).toBe(true);

      const to = new Date(start.getTime() + 15 * 86_400_000);
      const events = await fetchCalendarEvents(owner, academy.id, start, to);
      expect(events.filter((e) => ids.includes(e.classroom_id ?? '')).map((e) => e.kind)).toEqual(
        Array(5).fill('class'),
      );

      const student = newClient();
      const { user: su } = await signInStudent(
        student,
        env.STUDENT_USERNAME ?? '',
        env.STUDENT_PIN ?? '',
      );
      const seen = await fetchClassrooms(student, academy.id, { from: start, to });
      expect(
        seen
          .filter((c) => ids.includes(c.id))
          .map((c) => c.id)
          .sort(),
      ).toEqual(series.map((c) => c.id).sort());

      const first = series[0];
      if (!first || !hidden[0]) throw new Error('thiếu buổi');
      expect(await joinClassroom(student, first.id)).toBe('present');
      expect(await joinClassroom(student, hidden[0].id)).toBeNull();
      expect(await joinClassroom(owner, first.id)).toBeNull();

      const detail = await fetchClassroom(owner, first.id);
      expect(await fetchClassroomRoster(owner, detail)).toContain(su.id);
      expect(detail.attendance).toEqual([{ student_id: su.id, status: 'present' }]);

      await setAttendance(owner, first.id, su.id, 'excused', 'ốm');
      expect((await fetchClassroom(student, first.id)).attendance).toEqual([
        { student_id: su.id, status: 'excused' },
      ]);
    } finally {
      for (const id of ids) await deleteClassroom(owner, id);
    }
  });

  it('phòng học Realtime: HLV đi quân, học viên nhận; chat; người ngoài bị chặn', {
    timeout: 120_000,
  }, async () => {
    const owner = newClient();
    const { user } = await signInWithEmail(owner, env.OWNER_EMAIL ?? '', env.OWNER_PASSWORD ?? '');
    const academy = (await fetchMyAcademies(owner, user.id)).find(
      (a) => a.slug === env.ACADEMY_SLUG,
    );
    if (!academy) throw new Error('không thấy học viện');
    const group = (await fetchGroups(owner, academy.id)).find((g) => g.name === env.GROUP_NAME);
    if (!group) throw new Error('không thấy lớp');
    const startsAt = new Date(Date.now() + 3600_000).toISOString();
    const [open] = await createClassrooms(owner, user.id, {
      academyId: academy.id,
      title: 'Tích hợp GĐ8 — phòng',
      startsAt,
      groupIds: [group.id],
    });
    const [closed] = await createClassrooms(owner, user.id, {
      academyId: academy.id,
      title: 'Tích hợp GĐ8 — phòng kín',
      startsAt,
    });
    if (!open || !closed) throw new Error('thiếu lớp');
    const student = newClient();
    const { user: su } = await signInStudent(
      student,
      env.STUDENT_USERNAME ?? '',
      env.STUDENT_PIN ?? '',
    );
    const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
    const until = async (cond: () => boolean, ms = 8000) => {
      for (let t = 0; t < ms && !cond(); t += 100) await wait(100);
      return cond();
    };

    const ownerChats: RoomChat[] = [];
    let studentSnap: RoomSnapshot | null = null;
    const coachRoom = new ClassroomRoom(
      owner,
      open.id,
      { userId: user.id, name: 'HLV' },
      true,
      emptySnapshot(),
      {
        onChat: (m) => ownerChats.push(m),
      },
    );
    const studentRoom = new ClassroomRoom(
      student,
      open.id,
      { userId: su.id, name: 'HV' },
      false,
      emptySnapshot(),
      {
        onSnapshot: (s) => {
          studentSnap = s;
        },
      },
    );
    const outsider = new ClassroomRoom(
      student,
      closed.id,
      { userId: su.id, name: 'HV' },
      false,
      emptySnapshot(),
    );
    try {
      await coachRoom.connect();
      await studentRoom.connect();
      // Học viên xin đồng bộ khi vào phòng → nhận ảnh chụp ban đầu
      expect(await until(() => studentSnap !== null)).toBe(true);

      expect(coachRoom.move('e2e4')).toBe(true);
      expect(coachRoom.move('e2e5')).toBe(false);
      expect(await until(() => (studentSnap as RoomSnapshot | null)?.ply === 1)).toBe(true);
      expect((studentSnap as RoomSnapshot | null)?.lastMove).toEqual(['e2', 'e4']);

      // Học viên chưa được trao quyền: xin đi quân bị bỏ qua; trao quyền rồi thì được
      await studentRoom.requestMove('e7e5');
      await wait(1500);
      expect(coachRoom.snapshot.ply).toBe(1);
      coachRoom.setController(su.id);
      expect(await until(() => (studentSnap as RoomSnapshot | null)?.controller === su.id)).toBe(
        true,
      );
      await studentRoom.requestMove('e7e5');
      expect(await until(() => coachRoom.snapshot.ply === 2)).toBe(true);

      await studentRoom.chat('Chào thầy');
      expect(await until(() => ownerChats.some((m) => m.text === 'Chào thầy'))).toBe(true);

      await expect(outsider.connect()).rejects.toBeTruthy();
    } finally {
      await outsider.disconnect().catch(() => undefined);
      await studentRoom.disconnect();
      await coachRoom.disconnect();
      await deleteClassroom(owner, open.id);
      await deleteClassroom(owner, closed.id);
    }
  });
});
