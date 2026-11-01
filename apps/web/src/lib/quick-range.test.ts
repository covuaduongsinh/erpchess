import { describe, expect, it } from 'vitest';
import { quickRange, toDateInput } from './quick-range';

describe('quickRange', () => {
  const now = new Date(2026, 10, 15); // 15/11/2026

  it('tháng: từ ngày đầu đến ngày cuối của tháng', () => {
    expect(quickRange('month', now)).toEqual({ from: '2026-11-01', to: '2026-11-30' });
    expect(quickRange('month', new Date(2028, 1, 10))).toEqual({
      from: '2028-02-01',
      to: '2028-02-29', // năm nhuận
    });
  });

  it('quý: gồm đủ 3 tháng chứa ngày hiện tại', () => {
    expect(quickRange('quarter', now)).toEqual({ from: '2026-10-01', to: '2026-12-31' });
    expect(quickRange('quarter', new Date(2026, 0, 1))).toEqual({
      from: '2026-01-01',
      to: '2026-03-31',
    });
    expect(quickRange('quarter', new Date(2026, 5, 30))).toEqual({
      from: '2026-04-01',
      to: '2026-06-30',
    });
  });

  it('năm: 1/1 đến 31/12', () => {
    expect(quickRange('year', now)).toEqual({ from: '2026-01-01', to: '2026-12-31' });
  });

  it('toDateInput đệm số 0 theo giờ máy', () => {
    expect(toDateInput(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
