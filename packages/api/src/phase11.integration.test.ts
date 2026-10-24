/**
 * Kiểm tích hợp Giai đoạn 11a trên Supabase thật: học viên làm học liệu trong khoá qua
 * `submit-activity` → XP ghi đúng một lần (trigger), khoá hoàn thành + thưởng XP, tiến độ khoá.
 */
import { describe, expect, it } from 'vitest';
import {
  fetchCertificates,
  issueCertificate,
  revokeCertificate,
  verifyCertificate,
} from './certificates';
import { createErpClient } from './client';
import {
  createCourse,
  deleteCourse,
  fetchCourseCompletions,
  fetchCourseProgress,
  fetchStudentXp,
  setCourseItems,
  setCourseTargets,
  updateCourse,
} from './courses';
import { fetchMyAcademies, signInStudent, signInWithEmail } from './queries';
import { addActivity, createStudy, deleteStudy, submitActivity } from './studies';

/** Điểm mặc định của một hoạt động; giải ngay lần đầu nên không bị trừ. */
const POINTS = 10;

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

describe.skipIf(!ready)('Giai đoạn 11 trên Supabase thật', () => {
  it('khoá học: giải học liệu → XP một lần, hoàn thành khoá', { timeout: 120_000 }, async () => {
    const owner = newClient();
    const { user } = await signInWithEmail(owner, env.OWNER_EMAIL ?? '', env.OWNER_PASSWORD ?? '');
    const academy = (await fetchMyAcademies(owner, user.id)).find(
      (a) => a.slug === env.ACADEMY_SLUG,
    );
    if (!academy) throw new Error('không thấy học viện');
    const student = newClient();
    const { user: su } = await signInStudent(
      student,
      env.STUDENT_USERNAME ?? '',
      env.STUDENT_PIN ?? '',
    );

    const study = await createStudy(owner, user.id, {
      academyId: academy.id,
      title: 'Tích hợp GĐ11',
      visibility: 'academy',
    });
    const mcq = (q: string, correct: number) => ({
      kind: 'mcq' as const,
      title: q,
      payload: { question: q, options: ['A', 'B'], correct },
    });
    const a1 = await addActivity(owner, study.id, mcq('Câu 1', 0), 0);
    const a2 = await addActivity(owner, study.id, mcq('Câu 2', 1), 1);
    const course = await createCourse(owner, user.id, {
      academyId: academy.id,
      title: 'Khoá GĐ11',
    });
    const certIds: string[] = [];
    try {
      await setCourseItems(owner, course.id, [{ studyId: study.id, required: true }]);
      await setCourseTargets(owner, course.id, [], [su.id]);
      await updateCourse(owner, course.id, { status: 'published' });
      const before = await fetchStudentXp(student, su.id, academy.id);

      expect(await submitActivity(student, a1.id, { choice: 0 })).toMatchObject({ solved: true });
      const mid = await fetchStudentXp(student, su.id, academy.id);
      expect(mid.total - before.total).toBe(POINTS);
      // Nộp lại câu đã giải: không cộng thêm
      await submitActivity(student, a1.id, { choice: 0 }).catch(() => undefined);
      expect((await fetchStudentXp(student, su.id, academy.id)).total).toBe(mid.total);

      expect(await submitActivity(student, a2.id, { choice: 1 })).toMatchObject({ solved: true });
      const after = await fetchStudentXp(student, su.id, academy.id);
      expect(after.total - before.total).toBe(2 * POINTS + 100);
      expect(after.today).toBeGreaterThanOrEqual(2 * POINTS + 100);

      expect((await fetchCourseCompletions(student, [course.id])).map((c) => c.student_id)).toEqual(
        [su.id],
      );
      const progress = await fetchCourseProgress(owner, [course.id]);
      expect(progress.find((p) => p.student_id === su.id)).toMatchObject({
        required_total: 1,
        required_done: 1,
      });

      // Giai đoạn 11b: khoá bật auto_certificate → tự cấp chứng chỉ, ai cũng xác minh được bằng mã
      const [cert] = await fetchCertificates(student, {
        academyId: academy.id,
        studentId: su.id,
        courseId: course.id,
      });
      if (!cert) throw new Error('chưa tự cấp chứng chỉ');
      certIds.push(cert.id);
      expect(cert.title).toBe('Khoá GĐ11');
      const anon = newClient();
      expect(
        await verifyCertificate(
          anon,
          `${cert.code.slice(0, 5).toLowerCase()}-${cert.code.slice(5)}`,
        ),
      ).toMatchObject({ title: 'Khoá GĐ11', revoked_at: null });
      await expect(
        issueCertificate(student, { academyId: academy.id, studentId: su.id, title: 'Giả' }),
      ).rejects.toThrow();
      await expect(
        issueCertificate(owner, { academyId: academy.id, studentId: su.id, courseId: course.id }),
      ).rejects.toThrow();
      const manual = await issueCertificate(owner, {
        academyId: academy.id,
        studentId: su.id,
        title: 'Chứng chỉ tay GĐ11',
      });
      certIds.push(manual);
      await revokeCertificate(owner, cert.id);
      expect((await verifyCertificate(anon, cert.code))?.revoked_at).toBeTruthy();
      expect(await verifyCertificate(anon, 'ZZZZZZZZZZ')).toBeNull();
    } finally {
      // Chứng chỉ không xoá được (giữ toàn vẹn xác minh): thu hồi chứng chỉ thử
      for (const id of certIds) await revokeCertificate(owner, id).catch(() => undefined);
      await deleteCourse(owner, course.id);
      await deleteStudy(owner, study.id);
    }
  });
});
