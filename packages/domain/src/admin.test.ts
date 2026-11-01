import { describe, expect, it } from 'vitest';
import {
  academyProfileSchema,
  brandColorVars,
  fideInputSchema,
  hasFide,
  inviteSenderSchema,
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

describe('người gửi lời mời (26b)', () => {
  it('email trả lời: rỗng hoặc hợp lệ, sai thì lỗi mã `email`', () => {
    expect(inviteSenderSchema.parse({}).replyTo).toBe('');
    expect(inviteSenderSchema.parse({ replyTo: ' Hi@CLB.vn ' }).replyTo).toBe('Hi@CLB.vn');
    const bad = inviteSenderSchema.safeParse({ replyTo: 'khong-phai-email' });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0]?.message).toBe('email');
  });

  it('tên hiển thị tối đa 80 ký tự; hồ sơ học viện cũng nhận hai trường này trong liên hệ', () => {
    expect(inviteSenderSchema.safeParse({ senderName: 'a'.repeat(81) }).success).toBe(false);
    const profile = academyProfileSchema.parse({
      name: 'CLB',
      contact: { senderName: 'CLB Dương Sinh', replyTo: 'hi@clb.vn' },
    });
    expect(profile.contact.senderName).toBe('CLB Dương Sinh');
    expect(profile.contact.replyTo).toBe('hi@clb.vn');
    expect(
      academyProfileSchema.safeParse({ name: 'CLB', contact: { replyTo: 'sai' } }).success,
    ).toBe(false);
  });
});

describe('FIDE (26a)', () => {
  it('mã FIDE rỗng hoặc 3–12 chữ số; sai thì lỗi mã `fideId`', () => {
    expect(fideInputSchema.parse({}).fideId).toBe('');
    expect(fideInputSchema.parse({ fideId: ' 12345678 ' }).fideId).toBe('12345678');
    for (const bad of ['12', 'abc', '1234567890123', '12 34']) {
      const r = fideInputSchema.safeParse({ fideId: bad });
      expect(r.success, bad).toBe(false);
      expect(r.error?.issues[0]?.message).toBe('fideId');
    }
  });

  it('Elo FIDE: null hoặc số nguyên 1000–3300, sai thì lỗi mã `fideElo`', () => {
    expect(fideInputSchema.parse({}).standard).toBeNull();
    expect(fideInputSchema.parse({ standard: 1000, rapid: 3300, blitz: null })).toMatchObject({
      standard: 1000,
      rapid: 3300,
      blitz: null,
    });
    for (const bad of [999, 3301, 1500.5]) {
      const r = fideInputSchema.safeParse({ blitz: bad });
      expect(r.success, String(bad)).toBe(false);
      expect(r.error?.issues[0]?.message).toBe('fideElo');
    }
  });

  it('hasFide: có ít nhất một thông tin', () => {
    expect(hasFide(null)).toBe(false);
    expect(hasFide({ id: null, standard: null, rapid: null, blitz: null })).toBe(false);
    expect(hasFide({ id: '123', standard: null, rapid: null, blitz: null })).toBe(true);
    expect(hasFide({ id: null, standard: null, rapid: 1500, blitz: null })).toBe(true);
  });
});

describe('white-label học viện', () => {
  it('màu thương hiệu: rỗng thành null, chỉ nhận #RRGGBB', () => {
    expect(academyProfileSchema.parse({ name: 'CLB' }).brandColor).toBeNull();
    expect(academyProfileSchema.parse({ name: 'CLB', brandColor: '#AA00ff' }).brandColor).toBe(
      '#aa00ff',
    );
    expect(academyProfileSchema.safeParse({ name: 'CLB', brandColor: 'red' }).success).toBe(false);
    expect(academyProfileSchema.safeParse({ name: 'CLB', brandColor: '#fff' }).success).toBe(false);
  });

  it('liên hệ: số điện thoại phải hợp lệ, mặc định rỗng', () => {
    expect(academyProfileSchema.parse({ name: 'CLB' }).contact).toEqual({
      address: '',
      phone: '',
      zalo: '',
      senderName: '',
      replyTo: '',
    });
    expect(
      academyProfileSchema.safeParse({ name: 'CLB', contact: { phone: '+84 912 345 678' } })
        .success,
    ).toBe(true);
    expect(
      academyProfileSchema.safeParse({ name: 'CLB', contact: { zalo: 'gọi tôi' } }).success,
    ).toBe(false);
  });

  it('brandColorVars chọn màu chữ đọc được theo độ sáng nền', () => {
    expect(brandColorVars(null)).toBeNull();
    expect(brandColorVars('#xyz')).toBeNull();
    expect(brandColorVars('#2B3990')).toEqual({ primary: '#2b3990', onPrimary: '#ffffff' });
    expect(brandColorVars('#FBB040')?.onPrimary).toBe('#1c1917');
  });
});
