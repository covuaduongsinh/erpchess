import { describe, expect, it } from 'vitest';
import {
  academyProfileSchema,
  levelForRating,
  levelSchema,
  levelTemplate,
  scheduleSchema,
  sortSchedule,
} from './admin';

describe('levels', () => {
  it('mẫu lộ trình hợp lệ và nối tiếp nhau', () => {
    for (const level of levelTemplate) expect(levelSchema.safeParse(level).success).toBe(true);
    for (let i = 1; i < levelTemplate.length; i++) {
      expect(levelTemplate[i]?.minRating).toBe(levelTemplate[i - 1]?.maxRating);
    }
  });

  it('khoảng rating phải tăng', () => {
    const r = levelSchema.safeParse({
      name: 'X',
      minRating: 500,
      maxRating: 400,
      color: '#000000',
    });
    expect(r.success).toBe(false);
  });

  it('levelForRating theo khoảng [min, max)', () => {
    expect(levelForRating(levelTemplate.map(normalize), 0)?.name).toBe('Làm quen');
    expect(levelForRating(levelTemplate.map(normalize), 400)?.name).toBe('Cơ bản');
    expect(levelForRating(levelTemplate.map(normalize), 2800)?.name).toBe('Thi đấu');
  });
});

function normalize(l: (typeof levelTemplate)[number]) {
  return { name: l.name, minRating: l.minRating, maxRating: l.maxRating };
}

describe('schedule', () => {
  it('kiểm tra giờ và thời lượng', () => {
    expect(scheduleSchema.safeParse([{ day: 1, start: '18:30', minutes: 90 }]).success).toBe(true);
    expect(scheduleSchema.safeParse([{ day: 7, start: '18:30', minutes: 90 }]).success).toBe(false);
    expect(scheduleSchema.safeParse([{ day: 1, start: '24:00', minutes: 90 }]).success).toBe(false);
  });

  it('sắp Thứ hai trước, Chủ nhật cuối', () => {
    const sorted = sortSchedule([
      { day: 0, start: '08:00', minutes: 60 },
      { day: 3, start: '18:00', minutes: 60 },
      { day: 1, start: '19:00', minutes: 60 },
      { day: 1, start: '07:00', minutes: 60 },
    ]);
    expect(sorted.map((s) => `${s.day}@${s.start}`)).toEqual([
      '1@07:00',
      '1@19:00',
      '3@18:00',
      '0@08:00',
    ]);
  });
});

describe('academyProfileSchema', () => {
  it('logo rỗng thành null, chỉ nhận https', () => {
    expect(academyProfileSchema.parse({ name: 'CLB', logoUrl: '' }).logoUrl).toBeNull();
    expect(
      academyProfileSchema.safeParse({ name: 'CLB', logoUrl: 'http://x.vn/a.png' }).success,
    ).toBe(false);
    expect(
      academyProfileSchema.parse({ name: 'CLB', socials: { facebook: 'https://fb.com/clb' } })
        .socials.facebook,
    ).toBe('https://fb.com/clb');
  });
});
