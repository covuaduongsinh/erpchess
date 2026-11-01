import { describe, expect, it } from 'vitest';
import {
  daysOf,
  isValidRange,
  MAX_RANGE_DAYS,
  previousRange,
  rangeLength,
  shiftRange,
  trendPercent,
  weekRange,
} from './week-range';

describe('weekRange', () => {
  it('trả thứ Hai đến Chủ nhật chứa ngày đã cho', () => {
    // 13/5/2026 là thứ Tư
    expect(weekRange(new Date(2026, 4, 13))).toEqual({ from: '2026-05-11', to: '2026-05-17' });
  });

  it('thứ Hai và Chủ nhật cùng thuộc một tuần', () => {
    expect(weekRange(new Date(2026, 4, 11))).toEqual({ from: '2026-05-11', to: '2026-05-17' });
    expect(weekRange(new Date(2026, 4, 17))).toEqual({ from: '2026-05-11', to: '2026-05-17' });
  });

  it('qua tháng và qua năm', () => {
    expect(weekRange(new Date(2026, 0, 1))).toEqual({ from: '2025-12-29', to: '2026-01-04' });
  });
});

describe('shiftRange / previousRange', () => {
  const week = { from: '2026-05-11', to: '2026-05-17' };

  it('tuần trước và tuần sau', () => {
    expect(shiftRange(week, -1)).toEqual({ from: '2026-05-04', to: '2026-05-10' });
    expect(shiftRange(week, 1)).toEqual({ from: '2026-05-18', to: '2026-05-24' });
    expect(previousRange(week)).toEqual({ from: '2026-05-04', to: '2026-05-10' });
  });

  it('khoảng tuỳ chọn dời đúng bằng độ dài của nó', () => {
    expect(shiftRange({ from: '2026-05-01', to: '2026-05-10' }, 1)).toEqual({
      from: '2026-05-11',
      to: '2026-05-20',
    });
  });

  it('đi tới rồi lui về đúng chỗ cũ, kể cả qua giờ mùa hè', () => {
    const r = { from: '2026-03-02', to: '2026-03-08' };
    expect(shiftRange(shiftRange(r, 1), -1)).toEqual(r);
  });
});

describe('rangeLength / daysOf / isValidRange', () => {
  it('đếm cả hai đầu', () => {
    expect(rangeLength({ from: '2026-05-11', to: '2026-05-11' })).toBe(1);
    expect(rangeLength({ from: '2026-05-11', to: '2026-05-17' })).toBe(7);
    expect(daysOf({ from: '2026-05-30', to: '2026-06-02' })).toEqual([
      '2026-05-30',
      '2026-05-31',
      '2026-06-01',
      '2026-06-02',
    ]);
  });

  it('hợp lệ khi đúng thứ tự và không quá giới hạn', () => {
    expect(isValidRange({ from: '2026-05-11', to: '2026-05-17' })).toBe(true);
    expect(isValidRange({ from: '2026-05-17', to: '2026-05-11' })).toBe(false);
    expect(isValidRange({ from: '', to: '2026-05-11' })).toBe(false);
    expect(isValidRange({ from: '2026-05-01', to: '2026-05-31' })).toBe(MAX_RANGE_DAYS >= 31);
    expect(isValidRange({ from: '2026-05-01', to: '2026-06-01' })).toBe(false);
  });
});

describe('trendPercent', () => {
  it('so với kỳ trước, làm tròn', () => {
    expect(trendPercent(15, 10)).toBe(50);
    expect(trendPercent(5, 10)).toBe(-50);
    expect(trendPercent(10, 10)).toBe(0);
  });

  it('kỳ trước bằng 0 thì không có xu hướng (null), không chia cho 0', () => {
    expect(trendPercent(10, 0)).toBeNull();
    expect(trendPercent(0, 0)).toBeNull();
  });
});
