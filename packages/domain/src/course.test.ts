import { describe, expect, it } from 'vitest';
import { courseInputSchema, streakFrom, vnToday } from './course';

describe('streakFrom', () => {
  it('chuỗi kết thúc hôm nay', () => {
    expect(streakFrom(['2026-10-23', '2026-10-24', '2026-10-25'], '2026-10-25')).toEqual({
      current: 3,
      longest: 3,
    });
  });
  it('hôm nay chưa học thì vẫn giữ chuỗi tới hôm qua', () => {
    expect(streakFrom(['2026-10-23', '2026-10-24'], '2026-10-25').current).toBe(2);
  });
  it('đứt chuỗi khi nghỉ quá một ngày; chuỗi dài nhất giữ lại', () => {
    const s = streakFrom(
      ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-20', '2026-10-21'],
      '2026-10-25',
    );
    expect(s).toEqual({ current: 0, longest: 4 });
  });
  it('qua tháng, trùng ngày, không có ngày nào', () => {
    expect(streakFrom(['2026-10-31', '2026-11-01', '2026-11-01'], '2026-11-01')).toEqual({
      current: 2,
      longest: 2,
    });
    expect(streakFrom([], '2026-11-01')).toEqual({ current: 0, longest: 0 });
  });
});

describe('vnToday', () => {
  it('17:30 UTC đã là ngày hôm sau ở Việt Nam', () => {
    expect(vnToday(new Date('2026-10-24T17:30:00Z'))).toBe('2026-10-25');
    expect(vnToday(new Date('2026-10-24T16:30:00Z'))).toBe('2026-10-24');
  });
});

describe('courseInputSchema', () => {
  it('mặc định tự cấp chứng chỉ, chưa mở cho tất cả', () => {
    expect(
      courseInputSchema.parse({ academyId: '10000000-0000-4000-8000-00000000000a', title: 'Khoá' }),
    ).toMatchObject({ openToAll: false, autoCertificate: true, levelId: null });
  });
});
