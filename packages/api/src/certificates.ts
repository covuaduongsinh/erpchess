/** Chứng chỉ (Giai đoạn 11b): cấp tự động/tay, thu hồi, xác minh công khai bằng mã. */
import type { ErpClient } from './client';
import type { Tables } from './database.types';
import { unwrap } from './queries';

export type Certificate = Tables<'certificates'>;
export type VerifiedCertificate = {
  code: string;
  title: string;
  student_name: string;
  academy_name: string;
  issued_at: string;
  revoked_at: string | null;
};

export async function fetchCertificates(
  client: ErpClient,
  filter: { academyId: string; studentId?: string; courseId?: string },
): Promise<Certificate[]> {
  let q = client.from('certificates').select('*').eq('academy_id', filter.academyId);
  if (filter.studentId) q = q.eq('student_id', filter.studentId);
  if (filter.courseId) q = q.eq('course_id', filter.courseId);
  return unwrap(await q.order('issued_at', { ascending: false }));
}

export async function fetchCertificate(client: ErpClient, id: string): Promise<Certificate> {
  return unwrap(await client.from('certificates').select('*').eq('id', id).single());
}

/** Staff cấp tay; tiêu đề mặc định là tên khoá nếu gắn khoá. Trả id chứng chỉ. */
export async function issueCertificate(
  client: ErpClient,
  input: { academyId: string; studentId: string; title?: string; courseId?: string | null },
): Promise<string> {
  return unwrap(
    await client.rpc('issue_certificate', {
      p_academy: input.academyId,
      p_student: input.studentId,
      p_title: input.title || undefined,
      p_course: input.courseId ?? undefined,
    }),
  );
}

export async function revokeCertificate(client: ErpClient, id: string): Promise<void> {
  unwrap(await client.rpc('revoke_certificate', { p_id: id }));
}

/** Gọi được bằng client chưa đăng nhập (khoá publishable). */
export async function verifyCertificate(
  client: ErpClient,
  code: string,
): Promise<VerifiedCertificate | null> {
  const rows = unwrap(await client.rpc('verify_certificate', { p_code: code }));
  return rows[0] ?? null;
}

/** Mã hiển thị dạng XXXXX-XXXXX cho dễ đọc. */
export function formatCertificateCode(code: string): string {
  return code.length === 10 ? `${code.slice(0, 5)}-${code.slice(5)}` : code;
}

/** Đường dẫn trang xác minh công khai (apps/site). */
export function certificateVerifyUrl(siteUrl: string, code: string): string {
  return `${siteUrl.replace(/\/+$/, '')}/verify/${code}`;
}
