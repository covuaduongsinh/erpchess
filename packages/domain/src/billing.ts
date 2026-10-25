import { z } from 'zod';
import { currencies } from './money';

/** Phạm vi khớp CHECK trong migration `…0021_billing.sql`. */
export const planPeriods = ['once', 'month', 'term'] as const;
export type PlanPeriod = (typeof planPeriods)[number];

export const discountKinds = ['percent', 'fixed'] as const;
export type DiscountKind = (typeof discountKinds)[number];

export const invoiceStatuses = ['open', 'paid', 'void'] as const;
export type InvoiceStatus = (typeof invoiceStatuses)[number];

export const paymentMethods = ['transfer', 'cash', 'other'] as const;
export type PaymentMethod = (typeof paymentMethods)[number];

export const currencySchema = z.enum(currencies);

export const planInputSchema = z.object({
  academyId: z.uuid(),
  name: z.string().trim().min(1, 'name').max(120),
  description: z.string().trim().max(2000).default(''),
  sessions: z.number().int().min(0).max(1000).nullable().default(null),
  period: z.enum(planPeriods).default('month'),
  prices: z
    .array(z.object({ currency: currencySchema, amount: z.number().int().min(0) }))
    .min(1, 'prices')
    .refine((p) => new Set(p.map((x) => x.currency)).size === p.length, 'currency'),
});
export type PlanInput = z.input<typeof planInputSchema>;

export const discountInputSchema = z
  .object({
    academyId: z.uuid(),
    name: z.string().trim().min(1, 'name').max(120),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{2,32}$/, 'code')
      .nullable()
      .default(null),
    kind: z.enum(discountKinds),
    value: z.number().int().min(1),
    currency: currencySchema.nullable().default(null),
    startsOn: z.iso.date().nullable().default(null),
    endsOn: z.iso.date().nullable().default(null),
    maxUses: z.number().int().min(1).nullable().default(null),
    planIds: z.array(z.uuid()).default([]),
  })
  .refine((d) => d.kind !== 'percent' || d.value <= 100, { message: 'percent', path: ['value'] })
  .refine((d) => d.kind !== 'fixed' || d.currency !== null, {
    message: 'currency',
    path: ['currency'],
  });
export type DiscountInput = z.input<typeof discountInputSchema>;

/** `kind` để `string` vì dòng đọc từ CSDL chưa thu hẹp kiểu; khác 'percent' coi là cố định. */
export type DiscountRule = {
  kind: DiscountKind | (string & {});
  value: number;
  currency?: string | null;
};

/**
 * Số tiền được giảm (đơn vị nhỏ nhất), không vượt quá tạm tính. Giảm cố định chỉ áp khi cùng
 * tiền tệ. Phải khớp `private.discount_amount` trong migration.
 */
export function discountAmount(subtotal: number, currency: string, d: DiscountRule | null): number {
  if (!d || subtotal <= 0) return 0;
  if (d.kind === 'percent') return Math.min(subtotal, Math.floor((subtotal * d.value) / 100));
  if (d.currency && d.currency !== currency) return 0;
  return Math.min(subtotal, d.value);
}

export type DiscountWindow = {
  active: boolean;
  starts_on: string | null;
  ends_on: string | null;
  max_uses: number | null;
};

/** Giảm giá còn dùng được vào ngày `today` (YYYY-MM-DD) với `uses` lượt đã dùng. */
export function discountUsable(d: DiscountWindow, today: string, uses: number): boolean {
  if (!d.active) return false;
  if (d.starts_on && today < d.starts_on) return false;
  if (d.ends_on && today > d.ends_on) return false;
  return d.max_uses === null || uses < d.max_uses;
}

/** `HD-2026-0001`; khớp `private.next_invoice_number`. */
export function invoiceNumber(prefix: string, year: number, n: number): string {
  return `${prefix}-${year}-${String(n).padStart(4, '0')}`;
}

/** Nội dung chuyển khoản gắn với hoá đơn (chỉ chữ số, dễ đối soát): `HD20260001`. */
export function transferMemo(number: string): string {
  return number.replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

export type PlanTemplate = {
  key: string;
  name: string;
  description: string;
  sessions: number | null;
  period: PlanPeriod;
  /** Giá gợi ý theo VND (đồng). */
  vnd: number;
};

/** Thư viện gói mẫu cho câu lạc bộ cờ vua; giá chỉ là gợi ý, owner sửa trước khi lưu. */
export const PLAN_TEMPLATES: readonly PlanTemplate[] = [
  {
    key: 'group-8',
    name: 'Lớp nhóm 8 buổi/tháng',
    description: 'Hai buổi mỗi tuần, lớp 6–10 học viên.',
    sessions: 8,
    period: 'month',
    vnd: 1_200_000,
  },
  {
    key: 'group-12',
    name: 'Lớp nhóm 12 buổi/tháng',
    description: 'Ba buổi mỗi tuần, lớp 6–10 học viên.',
    sessions: 12,
    period: 'month',
    vnd: 1_600_000,
  },
  {
    key: 'group-4',
    name: 'Lớp cuối tuần 4 buổi/tháng',
    description: 'Một buổi sáng thứ Bảy hoặc Chủ nhật.',
    sessions: 4,
    period: 'month',
    vnd: 700_000,
  },
  {
    key: 'private-8',
    name: 'Học kèm 1-1, 8 buổi',
    description: 'HLV kèm riêng theo lịch thoả thuận.',
    sessions: 8,
    period: 'month',
    vnd: 3_200_000,
  },
  {
    key: 'private-4',
    name: 'Học kèm 1-1, 4 buổi',
    description: 'Gói ngắn để luyện chuyên đề.',
    sessions: 4,
    period: 'once',
    vnd: 1_700_000,
  },
  {
    key: 'duo-8',
    name: 'Học nhóm đôi, 8 buổi',
    description: 'Hai học viên cùng trình độ.',
    sessions: 8,
    period: 'month',
    vnd: 2_200_000,
  },
  {
    key: 'online-8',
    name: 'Lớp online 8 buổi/tháng',
    description: 'Học trực tuyến trên ERPChess.',
    sessions: 8,
    period: 'month',
    vnd: 900_000,
  },
  {
    key: 'term-24',
    name: 'Khoá 3 tháng (24 buổi)',
    description: 'Đóng theo khoá, tiết kiệm hơn đóng tháng.',
    sessions: 24,
    period: 'term',
    vnd: 3_300_000,
  },
  {
    key: 'summer',
    name: 'Khoá hè',
    description: 'Học dồn trong kỳ nghỉ hè.',
    sessions: 20,
    period: 'term',
    vnd: 2_500_000,
  },
  {
    key: 'beginner',
    name: 'Nhập môn cho bé',
    description: 'Làm quen quân cờ, luật đi, chiếu hết cơ bản.',
    sessions: 12,
    period: 'term',
    vnd: 1_500_000,
  },
  {
    key: 'tournament-prep',
    name: 'Luyện thi đấu',
    description: 'Chuẩn bị khai cuộc, phân tích ván trước giải.',
    sessions: 6,
    period: 'once',
    vnd: 2_000_000,
  },
  {
    key: 'trial',
    name: 'Buổi học thử',
    description: 'Một buổi trải nghiệm cho học viên mới.',
    sessions: 1,
    period: 'once',
    vnd: 0,
  },
];

/** Giá mẫu chỉ có cho VND; tiền tệ khác để trống cho owner tự nhập. */
export function templatePrice(t: PlanTemplate, currency: string): number | null {
  return currency === 'VND' ? t.vnd : null;
}
