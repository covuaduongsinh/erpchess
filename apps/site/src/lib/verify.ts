/** Gọi RPC công khai verify_certificate qua REST bằng khoá publishable (không giữ phiên). */
export type VerifiedCertificate = {
  code: string;
  title: string;
  student_name: string;
  academy_name: string;
  issued_at: string;
  revoked_at: string | null;
};

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY;

export const verifyConfigured = !!(URL_ && KEY);

/** Bỏ ký tự ngoài chữ/số và viết hoa — khớp cách chuẩn hoá phía CSDL. */
export function normalizeCode(code: string): string {
  return code.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

export function formatCode(code: string): string {
  return code.length === 10 ? `${code.slice(0, 5)}-${code.slice(5)}` : code;
}

export async function verifyCertificate(code: string): Promise<VerifiedCertificate | null> {
  if (!URL_ || !KEY) throw new Error('not configured');
  const res = await fetch(`${URL_}/rest/v1/rpc/verify_certificate`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_code: code }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`verify failed: ${res.status}`);
  const rows = (await res.json()) as VerifiedCertificate[];
  return rows[0] ?? null;
}

export function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? '');
}
