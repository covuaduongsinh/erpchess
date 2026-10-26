/**
 * Kiểm tích hợp Giai đoạn 12a trên Supabase thật: owner tạo gói + giảm giá → hoá đơn tính tiền
 * phía server, học viên chỉ đọc hoá đơn của mình, client chưa đăng nhập đọc qua pay_token,
 * ghi nhận thanh toán một phần rồi huỷ (hoá đơn thử không xoá được, chỉ huỷ).
 */
import { describe, expect, it } from 'vitest';
import {
  createInvoice,
  deleteDiscount,
  deletePlan,
  fetchInvoice,
  fetchInvoices,
  fetchPublicInvoice,
  recordPayment,
  saveBilling,
  saveDiscount,
  savePlan,
  voidInvoice,
} from './billing';
import { createErpClient } from './client';
import { fetchMyAcademies, signInStudent, signInWithEmail } from './queries';

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

describe.skipIf(!ready)('Giai đoạn 12 trên Supabase thật', () => {
  it('học phí: gói, giảm giá, hoá đơn, link công khai, thanh toán', {
    timeout: 120_000,
  }, async () => {
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

    await saveBilling(owner, {
      academyId: academy.id,
      currency: 'VND',
      invoicePrefix: 'TEST',
      bankBin: '970436',
      bankAccount: '0000000000',
      bankHolder: 'HOC VIEN THU',
    });
    const planId = await savePlan(owner, {
      academyId: academy.id,
      name: 'Gói thử GĐ12',
      prices: [
        { currency: 'VND', amount: 1_000_000 },
        { currency: 'USD', amount: 4000 },
      ],
    });
    const discountId = await saveDiscount(owner, {
      academyId: academy.id,
      name: 'Giảm thử GĐ12',
      kind: 'percent',
      value: 20,
      maxUses: 5,
      planIds: [planId],
    });
    try {
      const id = await createInvoice(owner, {
        academyId: academy.id,
        studentId: su.id,
        planId,
        discountId,
        dueOn: '2099-01-01',
        lines: [{ description: 'Sách thử', quantity: 1, unitAmount: 100_000 }],
      });
      const inv = await fetchInvoice(owner, id);
      expect([inv.subtotal, inv.discount_amount, inv.total, inv.status]).toEqual([
        1_100_000,
        220_000,
        880_000,
        'open',
      ]);
      expect(inv.number).toMatch(/^TEST-\d{4}-\d{4}$/);
      expect(inv.invoice_lines.map((l) => l.description)).toEqual(['Gói thử GĐ12', 'Sách thử']);

      // Học viên thấy hoá đơn của mình, không ghi được thanh toán
      const mine = await fetchInvoices(student, { academyId: academy.id });
      expect(mine.every((i) => i.student_id === su.id)).toBe(true);
      expect(mine.some((i) => i.id === id)).toBe(true);
      await expect(
        recordPayment(student, { invoiceId: id, amount: 1, method: 'cash' }),
      ).rejects.toThrow();

      // Người lạ xem qua link
      const pub = await fetchPublicInvoice(newClient(), inv.pay_token);
      expect(pub?.total).toBe(880_000);
      expect(pub?.bank_account).toBe('0000000000');
      expect(pub?.lines).toHaveLength(2);
      expect(await fetchPublicInvoice(newClient(), '0'.repeat(32))).toBeNull();

      expect(
        await recordPayment(owner, { invoiceId: id, amount: 300_000, method: 'transfer' }),
      ).toBe('open');
      expect((await fetchPublicInvoice(newClient(), inv.pay_token))?.paid_amount).toBe(300_000);
      await voidInvoice(owner, id);
      expect((await fetchInvoice(owner, id)).status).toBe('void');
    } finally {
      await deleteDiscount(owner, discountId);
      await deletePlan(owner, planId);
    }
  });
});
