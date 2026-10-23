import { describe, expect, it } from 'vitest';
import { periodRange } from './periods';

const ymd = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

describe('periodRange', () => {
  // Thứ năm 23/10/2026, 15:00 giờ địa phương
  const now = new Date(2026, 9, 23, 15, 0);

  it('tuần bắt đầu Thứ hai, kết thúc đầu ngày mai', () => {
    const { from, to } = periodRange('week', now);
    expect(ymd(from)).toBe('2026-10-19');
    expect(ymd(to)).toBe('2026-10-24');
    expect(from.getHours()).toBe(0);
  });

  it('Chủ nhật vẫn thuộc tuần bắt đầu từ Thứ hai trước đó', () => {
    expect(ymd(periodRange('week', new Date(2026, 9, 25, 9)).from)).toBe('2026-10-19');
  });

  it('tháng và 6 tháng', () => {
    expect(ymd(periodRange('month', now).from)).toBe('2026-10-1');
    expect(ymd(periodRange('sixMonths', now).from)).toBe('2026-5-1');
  });
});
