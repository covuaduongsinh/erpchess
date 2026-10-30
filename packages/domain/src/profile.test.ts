import { describe, expect, it } from 'vitest';
import {
  COMMON_TIMEZONES,
  DEFAULT_BOARD_PREFERENCES,
  moveNotationSchema,
  normalizeBoardPreferences,
  updateProfileSchema,
} from './profile';

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

  it('chuẩn hoá tùy chọn bàn cờ: giữ trường hợp lệ, trường sai lấy mặc định', () => {
    expect(normalizeBoardPreferences(null)).toEqual(DEFAULT_BOARD_PREFERENCES);
    expect(normalizeBoardPreferences(['wood'])).toEqual(DEFAULT_BOARD_PREFERENCES);
    expect(
      normalizeBoardPreferences({ theme: 'wood', pieceSet: 'comic', coordinates: false, x: 1 }),
    ).toEqual({ ...DEFAULT_BOARD_PREFERENCES, theme: 'wood', coordinates: false });
  });

  it('updateProfileSchema nhận boardPreferences đầy đủ, từ chối theme lạ', () => {
    expect(
      updateProfileSchema.safeParse({
        boardPreferences: { ...DEFAULT_BOARD_PREFERENCES, pieceSet: 'spatial' },
      }).success,
    ).toBe(true);
    expect(
      updateProfileSchema.safeParse({
        boardPreferences: { ...DEFAULT_BOARD_PREFERENCES, theme: 'pink' },
      }).success,
    ).toBe(false);
  });
});
