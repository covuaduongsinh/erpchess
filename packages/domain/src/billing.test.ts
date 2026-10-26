import { describe, expect, it } from 'vitest';
import {
  discountAmount,
  discountInputSchema,
  discountUsable,
  invoiceNumber,
  PLAN_TEMPLATES,
  planInputSchema,
  transferMemo,
} from './billing';
import { currencyDecimals, formatMoney, moneyInputValue, parseMoney } from './money';
import { crc16, sanitizeMemo, vietQrPayload } from './vietqr';

const ID = '00000000-0000-4000-8000-000000000001';

describe('money', () => {
  it('số lẻ theo tiền tệ', () => {
    expect(currencyDecimals('VND')).toBe(0);
    expect(currencyDecimals('usd')).toBe(2);
  });
  it('định dạng', () => {
    expect(formatMoney(1_500_000, 'VND').replace(/\s/g, ' ')).toBe('1.500.000 ₫');
    expect(formatMoney(1250, 'USD', 'en')).toBe('$12.50');
  });
  it('đọc số tiền gõ tay', () => {
    expect(parseMoney('1.500.000', 'VND')).toBe(1_500_000);
    expect(parseMoney('1,500,000 ₫', 'VND')).toBe(1_500_000);
    expect(parseMoney('12.5', 'USD')).toBe(1250);
    expect(parseMoney('1,234.56', 'USD')).toBe(123_456);
    expect(parseMoney('12,50', 'EUR')).toBe(1250);
    expect(parseMoney('-5', 'VND')).toBeNull();
    expect(parseMoney('abc', 'VND')).toBeNull();
  });
  it('giá trị ô nhập', () => {
    expect(moneyInputValue(1_500_000, 'VND')).toBe('1500000');
    expect(moneyInputValue(1250, 'USD')).toBe('12.50');
  });
});

describe('vietqr', () => {
  it('CRC-16/CCITT-FALSE', () => {
    expect(crc16('123456789')).toBe('29B1');
  });
  it('nội dung chuyển khoản bỏ dấu, ký tự lạ, cắt 25 ký tự', () => {
    expect(sanitizeMemo('Học phí #HD-2026-0001 Đức')).toBe('Hoc phi HD20260001 Duc');
    expect(sanitizeMemo('x'.repeat(40))).toHaveLength(25);
  });
  it('payload có số tiền và nội dung', () => {
    const p = vietQrPayload({
      bin: '970436',
      account: '0123456789',
      amount: 1_500_000,
      memo: 'HD20260001',
    });
    expect(p.startsWith('000201010212')).toBe(true);
    expect(p).toContain('0010A000000727');
    expect(p).toContain('0006970436');
    expect(p).toContain('01100123456789');
    expect(p).toContain('0208QRIBFTTA');
    expect(p).toContain('5303704');
    expect(p).toContain('54071500000');
    expect(p).toContain('5802VN');
    expect(p).toContain('62140810HD20260001');
    expect(p.slice(-8, -4)).toBe('6304');
    expect(p.slice(-4)).toBe(crc16(p.slice(0, -4)));
  });
  it('không số tiền thì là QR tĩnh', () => {
    const p = vietQrPayload({ bin: '970436', account: '0123456789' });
    expect(p.startsWith('000201010211')).toBe(true);
    expect(p).not.toContain('5407');
  });
  it('từ chối BIN/số tài khoản sai', () => {
    expect(() => vietQrPayload({ bin: '97', account: '1' })).toThrow('bin');
    expect(() => vietQrPayload({ bin: '970436', account: '12 34' })).toThrow('account');
  });
});

describe('billing', () => {
  it('giảm theo phần trăm làm tròn xuống', () => {
    expect(discountAmount(1_000_000, 'VND', { kind: 'percent', value: 15 })).toBe(150_000);
    expect(discountAmount(999, 'USD', { kind: 'percent', value: 10 })).toBe(99);
  });
  it('giảm cố định không vượt tạm tính, chỉ cùng tiền tệ', () => {
    expect(discountAmount(100_000, 'VND', { kind: 'fixed', value: 200_000, currency: 'VND' })).toBe(
      100_000,
    );
    expect(discountAmount(100_000, 'VND', { kind: 'fixed', value: 500, currency: 'USD' })).toBe(0);
    expect(discountAmount(100_000, 'VND', null)).toBe(0);
  });
  it('giảm giá còn hiệu lực', () => {
    const d = { active: true, starts_on: '2026-10-01', ends_on: '2026-10-31', max_uses: 2 };
    expect(discountUsable(d, '2026-10-15', 1)).toBe(true);
    expect(discountUsable(d, '2026-11-01', 0)).toBe(false);
    expect(discountUsable(d, '2026-09-30', 0)).toBe(false);
    expect(discountUsable(d, '2026-10-15', 2)).toBe(false);
    expect(discountUsable({ ...d, active: false }, '2026-10-15', 0)).toBe(false);
  });
  it('số hoá đơn và nội dung chuyển khoản', () => {
    expect(invoiceNumber('HD', 2026, 7)).toBe('HD-2026-0007');
    expect(transferMemo('HD-2026-0007')).toBe('HD20260007');
  });
  it('schema gói và giảm giá', () => {
    expect(
      planInputSchema.safeParse({
        academyId: ID,
        name: 'A',
        prices: [{ currency: 'VND', amount: 1 }],
      }).success,
    ).toBe(true);
    expect(
      planInputSchema.safeParse({
        academyId: ID,
        name: 'A',
        prices: [
          { currency: 'VND', amount: 1 },
          { currency: 'VND', amount: 2 },
        ],
      }).success,
    ).toBe(false);
    expect(
      discountInputSchema.safeParse({ academyId: ID, name: 'X', kind: 'percent', value: 120 })
        .success,
    ).toBe(false);
    expect(
      discountInputSchema.safeParse({ academyId: ID, name: 'X', kind: 'fixed', value: 5 }).success,
    ).toBe(false);
    expect(
      discountInputSchema.safeParse({
        academyId: ID,
        name: 'X',
        code: 'he2026',
        kind: 'percent',
        value: 10,
      }).data?.code,
    ).toBe('HE2026');
  });
  it('mẫu gói có khoá duy nhất', () => {
    expect(new Set(PLAN_TEMPLATES.map((t) => t.key)).size).toBe(PLAN_TEMPLATES.length);
  });
});
