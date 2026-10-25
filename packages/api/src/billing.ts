/** Học phí (Giai đoạn 12a): cài đặt Billing, gói, giảm giá, hoá đơn, thanh toán, link VietQR. */
import type { DiscountInput, PaymentMethod, PlanInput } from '@erpchess/domain';
import { discountInputSchema, planInputSchema } from '@erpchess/domain';
import type { ErpClient } from './client';
import type { Json, Tables } from './database.types';
import { unwrap } from './queries';

export type AcademyBilling = Tables<'academy_billing'>;
export type Plan = Tables<'plans'> & { plan_prices: Tables<'plan_prices'>[] };
export type Discount = Tables<'discounts'> & {
  discount_plans: { plan_id: string }[];
  uses: number;
};
export type InvoiceStudent = { display_name: string; username: string | null };
export type Invoice = Tables<'invoices'> & { student: InvoiceStudent | null };
export type InvoiceDetail = Invoice & {
  invoice_lines: Tables<'invoice_lines'>[];
  payments: Tables<'payments'>[];
};
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

// ───────────── Cài đặt ─────────────

export async function fetchBilling(
  client: ErpClient,
  academyId: string,
): Promise<AcademyBilling | null> {
  return unwrap(
    await client.from('academy_billing').select('*').eq('academy_id', academyId).maybeSingle(),
  );
}

export type BillingSettingsInput = {
  academyId: string;
  currency: string;
  taxId?: string | null;
  invoicePrefix: string;
  bankBin?: string | null;
  bankAccount?: string | null;
  bankHolder?: string | null;
};

export async function saveBilling(client: ErpClient, input: BillingSettingsInput): Promise<void> {
  unwrap(
    await client.from('academy_billing').upsert({
      academy_id: input.academyId,
      currency: input.currency,
      tax_id: input.taxId || null,
      invoice_prefix: input.invoicePrefix.trim().toUpperCase(),
      bank_bin: input.bankBin || null,
      bank_account: input.bankAccount?.trim() || null,
      bank_holder: input.bankHolder?.trim() || null,
    }),
  );
}

// ───────────── Gói ─────────────

export async function fetchPlans(client: ErpClient, academyId: string): Promise<Plan[]> {
  return unwrap(
    await client
      .from('plans')
      .select('*, plan_prices(*)')
      .eq('academy_id', academyId)
      .order('active', { ascending: false })
      .order('created_at'),
  );
}

/** Tạo hoặc sửa gói; danh sách giá thay toàn bộ. Trả id gói. */
export async function savePlan(
  client: ErpClient,
  raw: PlanInput & { id?: string },
): Promise<string> {
  const input = planInputSchema.parse(raw);
  const row = {
    academy_id: input.academyId,
    name: input.name,
    description: input.description,
    sessions: input.sessions,
    period: input.period,
  };
  const { id } = raw.id
    ? unwrap(await client.from('plans').update(row).eq('id', raw.id).select('id').single())
    : unwrap(await client.from('plans').insert(row).select('id').single());
  unwrap(await client.from('plan_prices').delete().eq('plan_id', id));
  unwrap(
    await client
      .from('plan_prices')
      .insert(input.prices.map((p) => ({ plan_id: id, currency: p.currency, amount: p.amount }))),
  );
  return id;
}

export async function setPlanActive(client: ErpClient, id: string, active: boolean): Promise<void> {
  unwrap(await client.from('plans').update({ active }).eq('id', id));
}

export async function deletePlan(client: ErpClient, id: string): Promise<void> {
  unwrap(await client.from('plans').delete().eq('id', id));
}

// ───────────── Giảm giá ─────────────

export async function fetchDiscounts(client: ErpClient, academyId: string): Promise<Discount[]> {
  const [rows, stats] = await Promise.all([
    client
      .from('discounts')
      .select('*, discount_plans(plan_id)')
      .eq('academy_id', academyId)
      .order('created_at', { ascending: false }),
    client.from('discount_stats').select('discount_id, uses').eq('academy_id', academyId),
  ]);
  const uses = new Map(unwrap(stats).map((s) => [s.discount_id, s.uses ?? 0]));
  return unwrap(rows).map((d) => ({ ...d, uses: uses.get(d.id) ?? 0 }));
}

export async function saveDiscount(
  client: ErpClient,
  raw: DiscountInput & { id?: string },
): Promise<string> {
  const input = discountInputSchema.parse(raw);
  const row = {
    academy_id: input.academyId,
    name: input.name,
    code: input.code,
    kind: input.kind,
    value: input.value,
    currency: input.kind === 'fixed' ? input.currency : null,
    starts_on: input.startsOn,
    ends_on: input.endsOn,
    max_uses: input.maxUses,
  };
  const { id } = raw.id
    ? unwrap(await client.from('discounts').update(row).eq('id', raw.id).select('id').single())
    : unwrap(await client.from('discounts').insert(row).select('id').single());
  unwrap(await client.from('discount_plans').delete().eq('discount_id', id));
  if (input.planIds.length > 0) {
    unwrap(
      await client
        .from('discount_plans')
        .insert(input.planIds.map((plan_id) => ({ discount_id: id, plan_id }))),
    );
  }
  return id;
}

export async function setDiscountActive(
  client: ErpClient,
  id: string,
  active: boolean,
): Promise<void> {
  unwrap(await client.from('discounts').update({ active }).eq('id', id));
}

export async function deleteDiscount(client: ErpClient, id: string): Promise<void> {
  unwrap(await client.from('discounts').delete().eq('id', id));
}

// ───────────── Hoá đơn ─────────────

const INVOICE_SELECT = '*, student:profiles!invoices_student_id_fkey(display_name, username)';

export async function fetchInvoices(
  client: ErpClient,
  filter: { academyId: string; status?: string; studentId?: string },
): Promise<Invoice[]> {
  let q = client.from('invoices').select(INVOICE_SELECT).eq('academy_id', filter.academyId);
  if (filter.status) q = q.eq('status', filter.status);
  if (filter.studentId) q = q.eq('student_id', filter.studentId);
  return unwrap(await q.order('issued_at', { ascending: false })) as Invoice[];
}

export async function fetchInvoice(client: ErpClient, id: string): Promise<InvoiceDetail> {
  const row = unwrap(
    await client
      .from('invoices')
      .select(`${INVOICE_SELECT}, invoice_lines(*), payments(*)`)
      .eq('id', id)
      .single(),
  ) as InvoiceDetail;
  row.invoice_lines.sort((a, b) => a.position - b.position);
  row.payments.sort((a, b) => a.paid_at.localeCompare(b.paid_at));
  return row;
}

export type InvoiceLineInput = { description: string; quantity: number; unitAmount: number };

export type CreateInvoiceInput = {
  academyId: string;
  studentId: string;
  planId?: string | null;
  currency?: string | null;
  discountId?: string | null;
  dueOn?: string | null;
  note?: string;
  lines?: InvoiceLineInput[];
};

/** Tiền tính phía server (`create_invoice`). Trả id hoá đơn. */
export async function createInvoice(client: ErpClient, input: CreateInvoiceInput): Promise<string> {
  return unwrap(
    await client.rpc('create_invoice', {
      p_academy: input.academyId,
      p_student: input.studentId,
      p_plan: input.planId || undefined,
      p_currency: input.currency || undefined,
      p_discount: input.discountId || undefined,
      p_due: input.dueOn || undefined,
      p_note: input.note || undefined,
      p_lines: input.lines?.length
        ? (input.lines.map((l) => ({
            description: l.description,
            quantity: l.quantity,
            unit_amount: l.unitAmount,
          })) as Json)
        : undefined,
    }),
  );
}

export async function recordPayment(
  client: ErpClient,
  input: { invoiceId: string; amount: number; method: PaymentMethod; reference?: string },
): Promise<string> {
  return unwrap(
    await client.rpc('record_payment', {
      p_invoice: input.invoiceId,
      p_amount: input.amount,
      p_method: input.method,
      p_reference: input.reference || undefined,
    }),
  );
}

export async function voidInvoice(client: ErpClient, id: string): Promise<void> {
  unwrap(await client.rpc('void_invoice', { p_invoice: id }));
}

/** Gọi được bằng client chưa đăng nhập (khoá publishable). */
export async function fetchPublicInvoice(
  client: ErpClient,
  token: string,
): Promise<PublicInvoice | null> {
  const data = unwrap(await client.rpc('public_invoice', { p_token: token }));
  return (data as PublicInvoice | null) ?? null;
}

/** Link thanh toán công khai (apps/site). */
export function invoicePayUrl(siteUrl: string, token: string): string {
  return `${siteUrl.replace(/\/+$/, '')}/pay/${token}`;
}
