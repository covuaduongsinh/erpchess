/** Học viên không có email thật; Auth dùng email nội bộ suy ra từ username. Phải khớp Edge Function create-student. */
export const STUDENT_EMAIL_DOMAIN = 'students.erpchess.local';

export function studentEmail(username: string): string {
  return `${username.trim().toLowerCase()}@${STUDENT_EMAIL_DOMAIN}`;
}

export function isStudentEmail(email: string | null | undefined): boolean {
  return !!email?.toLowerCase().endsWith(`@${STUDENT_EMAIL_DOMAIN}`);
}
