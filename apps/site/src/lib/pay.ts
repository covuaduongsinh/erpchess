/** Gọi RPC công khai public_invoice qua REST bằng khoá publishable (không giữ phiên). */
export type PublicInvoice = {
  number: string;
  academy_name: string;
  tax_id: string | null;
  student_name: string;
  currency: string;
  subtotal: number;
  discount_amount: number;
  total: number;
  paid_amount: number;
  status: 'open' | 'paid' | 'void';
  due_on: string | null;
  issued_at: string;
  paid_at: string | null;
  note: string;
  lines: { description: string; quantity: number; unit_amount: number }[];
  bank_bin: string | null;
  bank_account: string | null;
  bank_holder: string | null;
};

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_KEY;

export const payConfigured = !!(URL_ && KEY);

export async function fetchPublicInvoice(token: string): Promise<PublicInvoice | null> {
  if (!URL_ || !KEY) throw new Error('not configured');
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  const res = await fetch(`${URL_}/rest/v1/rpc/public_invoice`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_token: token }),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`invoice failed: ${res.status}`);
  return ((await res.json()) as PublicInvoice | null) ?? null;
}
