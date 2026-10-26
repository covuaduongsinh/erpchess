/**
 * Kiểm tích hợp Giai đoạn 13b trên Supabase thật: đọc báo cáo tóm tắt,
 * chi tiết học viên và báo cáo toàn học viện.
 */

import { describe, expect, it } from 'vitest';
import { createErpClient } from './client';
import { fetchMembers, fetchMyAcademies, signInWithEmail } from './queries';
import {
  getAcademyStudentsReport,
  getStudentReportDetails,
  getStudentReportSummary,
} from './reports';

const env: Record<string, string | undefined> =
  (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const ready = ['SUPABASE_URL', 'SUPABASE_KEY', 'OWNER_EMAIL', 'OWNER_PASSWORD'].every(
  (k) => env[k],
);

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

describe.runIf(ready)('Giai đoạn 13b — Báo cáo học viên và học viện', () => {
  it('đọc báo cáo toàn học viện và báo cáo chi tiết học viên thành công', async () => {
    const client = newClient();
    const session = await signInWithEmail(client, env.OWNER_EMAIL ?? '', env.OWNER_PASSWORD ?? '');
    expect(session.user.id).toBeDefined();

    // 1. Lấy học viện đầu tiên của user
    const academies = await fetchMyAcademies(client, session.user.id);
    expect(academies.length).toBeGreaterThan(0);
    const academy = academies[0];
    if (!academy) return;

    // 2. Lấy danh sách báo cáo toàn học viện
    const academyReport = await getAcademyStudentsReport(client, academy.id);
    expect(Array.isArray(academyReport)).toBe(true);

    // 3. Lấy thành viên để kiểm tra báo cáo cá nhân nếu có học viên
    const members = await fetchMembers(client, academy.id);
    const student = members.find((m) => m.role === 'student');

    if (student) {
      // 4. Lấy tóm tắt báo cáo học viên
      const summary = await getStudentReportSummary(client, academy.id, student.profile.id);
      expect(summary.studentId).toBe(student.profile.id);
      expect(summary.assignments).toBeDefined();
      expect(summary.quizzes).toBeDefined();
      expect(summary.classrooms).toBeDefined();
      expect(summary.games).toBeDefined();
      expect(summary.tournaments).toBeDefined();

      // 5. Lấy chi tiết báo cáo học viên
      const details = await getStudentReportDetails(client, academy.id, student.profile.id);
      expect(details.student.id).toBe(student.profile.id);
      expect(Array.isArray(details.assignments)).toBe(true);
      expect(Array.isArray(details.quizzes)).toBe(true);
      expect(Array.isArray(details.classrooms)).toBe(true);
      expect(Array.isArray(details.games)).toBe(true);
      expect(Array.isArray(details.tournaments)).toBe(true);
    }
  });
});
