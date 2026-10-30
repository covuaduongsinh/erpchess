import { z } from 'zod';

export const moveNotationSchema = z.enum(['letters', 'figurine']);
export type MoveNotation = z.infer<typeof moveNotationSchema>;

export const COMMON_TIMEZONES = [
  { value: 'Asia/Ho_Chi_Minh', label: 'Việt Nam (GMT+7)' },
  { value: 'Asia/Bangkok', label: 'Bangkok (GMT+7)' },
  { value: 'Asia/Singapore', label: 'Singapore (GMT+8)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (GMT+9)' },
  { value: 'Asia/Seoul', label: 'Seoul (GMT+9)' },
  { value: 'Europe/London', label: 'London (GMT+0/+1)' },
  { value: 'Europe/Paris', label: 'Paris (GMT+1/+2)' },
  { value: 'America/New_York', label: 'New York (EST/EDT)' },
  { value: 'America/Chicago', label: 'Chicago (CST/CDT)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)' },
  { value: 'UTC', label: 'UTC' },
] as const;

export const BOARD_THEME_KEYS = ['navy', 'green', 'wood', 'blue', 'charcoal'] as const;
export const PIECE_SET_KEYS = ['celtic', 'spatial'] as const;

/** Tùy chọn bàn cờ lưu trong `profiles.board_preferences` (Giai đoạn 20c). */
export const boardPreferencesSchema = z.object({
  theme: z.enum(BOARD_THEME_KEYS),
  pieceSet: z.enum(PIECE_SET_KEYS),
  coordinates: z.boolean(),
  soundEnabled: z.boolean(),
  autoFlip: z.boolean(),
});

export type BoardPreferences = z.infer<typeof boardPreferencesSchema>;

export const DEFAULT_BOARD_PREFERENCES: BoardPreferences = {
  theme: 'navy',
  pieceSet: 'celtic',
  coordinates: true,
  soundEnabled: true,
  autoFlip: false,
};

/**
 * Đọc tùy chọn từ dữ liệu không tin cậy (JSON trên server, localStorage): trường nào sai hoặc
 * thiếu thì lấy giá trị mặc định, không làm hỏng cả bộ.
 */
export function normalizeBoardPreferences(raw: unknown): BoardPreferences {
  const obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const shape = boardPreferencesSchema.shape;
  const result = { ...DEFAULT_BOARD_PREFERENCES };
  for (const key of Object.keys(shape) as (keyof BoardPreferences)[]) {
    const parsed = shape[key].safeParse((obj as Record<string, unknown>)[key]);
    if (parsed.success) (result as Record<string, unknown>)[key] = parsed.data;
  }
  return result;
}

export const updateProfileSchema = z.object({
  displayName: z.string().trim().min(1, 'displayName').max(80, 'displayName').optional(),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_.]{3,32}$/, 'username')
    .optional(),
  locale: z.enum(['vi', 'en']).optional(),
  timezone: z.string().min(1).max(64).optional(),
  moveNotation: moveNotationSchema.optional(),
  country: z.string().max(64).nullable().optional(),
  bio: z.string().max(500).nullable().optional(),
  boardPreferences: boardPreferencesSchema.optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
