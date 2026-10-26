import { describe, expect, it } from 'vitest';
import { COMMON_TIMEZONES, moveNotationSchema, updateProfileSchema } from './profile';

describe('profile schema', () => {
  it('hợp lệ với dữ liệu chuẩn', () => {
    const res = updateProfileSchema.safeParse({
      displayName: 'Nguyễn Văn A',
      username: 'nguyenvana',
      locale: 'vi',
      timezone: 'Asia/Ho_Chi_Minh',
      moveNotation: 'figurine',
      country: 'Vietnam',
      bio: 'Yêu thích cờ vua từ nhỏ',
    });
    expect(res.success).toBe(true);
  });

  it('chấp nhận thiếu trường tuỳ chọn', () => {
    const res = updateProfileSchema.safeParse({
      displayName: 'Nguyễn Văn B',
    });
    expect(res.success).toBe(true);
  });

  it('từ chối notation không hợp lệ', () => {
    const res = moveNotationSchema.safeParse('invalid');
    expect(res.success).toBe(false);
  });

  it('danh sách timezone có Việt Nam mặc định', () => {
    expect(COMMON_TIMEZONES.some((tz) => tz.value === 'Asia/Ho_Chi_Minh')).toBe(true);
  });
});
