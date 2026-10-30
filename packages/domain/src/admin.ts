/** Quản trị học viện: cấp độ, batch, rating nội bộ, thông tin học viện. Khớp migration Giai đoạn 5. */
import { z } from 'zod';

export const ratingCategories = ['classical', 'rapid', 'blitz'] as const;
export type RatingCategory = (typeof ratingCategories)[number];

export const groupKinds = ['group', 'batch'] as const;
export type GroupKind = (typeof groupKinds)[number];

export const levelSchema = z
  .object({
    name: z.string().trim().min(1, 'name').max(60, 'name'),
    minRating: z.int().min(0, 'rating'),
    maxRating: z.int().nullable(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'color'),
    criteria: z
      .object({
        xp: z.int().min(0).optional(),
        puzzles: z.int().min(0).optional(),
        tournaments: z.int().min(0).optional(),
      })
      .default({}),
  })
  .refine((v) => v.maxRating === null || v.maxRating > v.minRating, {
    message: 'range',
    path: ['maxRating'],
  });
export type LevelInput = z.input<typeof levelSchema>;

/** Lộ trình mẫu 6 cấp; khoảng rating nối tiếp nhau, cấp cuối không giới hạn trên. */
export const levelTemplate: readonly LevelInput[] = [
  { name: 'Làm quen', minRating: 0, maxRating: 400, color: '#3DBB95' },
  { name: 'Cơ bản', minRating: 400, maxRating: 800, color: '#2DA44A' },
  { name: 'Sơ cấp', minRating: 800, maxRating: 1200, color: '#2275B4' },
  { name: 'Trung cấp', minRating: 1200, maxRating: 1600, color: '#2B3990' },
  { name: 'Nâng cao', minRating: 1600, maxRating: 2000, color: '#FBB040' },
  { name: 'Thi đấu', minRating: 2000, maxRating: null, color: '#F7941D' },
];

/** Cấp phù hợp với rating (khoảng [min, max)); `undefined` nếu không cấp nào khớp. */
export function levelForRating<L extends { minRating: number; maxRating: number | null }>(
  levels: readonly L[],
  rating: number,
): L | undefined {
  return levels.find(
    (l) => rating >= l.minRating && (l.maxRating === null || rating < l.maxRating),
  );
}

/** Một buổi trong lịch tuần của batch. `day`: 0 = Chủ nhật … 6 = Thứ bảy. */
export const scheduleSlotSchema = z.object({
  day: z.int().min(0).max(6),
  start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'time'),
  minutes: z.int().min(15).max(480),
});
export type ScheduleSlot = z.infer<typeof scheduleSlotSchema>;
export const scheduleSchema = z.array(scheduleSlotSchema).max(14);

/** Sắp lịch theo thứ trong tuần (Thứ hai trước, Chủ nhật cuối), rồi theo giờ bắt đầu. */
export function sortSchedule(slots: readonly ScheduleSlot[]): ScheduleSlot[] {
  const order = (d: number) => (d + 6) % 7;
  return [...slots].sort((a, b) => order(a.day) - order(b.day) || a.start.localeCompare(b.start));
}

export const socialKeys = ['facebook', 'youtube', 'tiktok', 'zalo', 'website'] as const;
export type SocialKey = (typeof socialKeys)[number];

/** Link https hoặc chuỗi rỗng (bỏ trống). Lỗi mang mã `url` để giao diện dịch. */
const optionalHttpsUrl = z
  .string()
  .trim()
  .max(500, 'url')
  .refine((v) => v === '' || /^https:\/\/[^\s/$.?#][^\s]*$/i.test(v), 'url');

export const contactKeys = ['address', 'phone', 'zalo'] as const;
export type ContactKey = (typeof contactKeys)[number];

/** Màu thương hiệu dạng #RRGGBB; chuỗi rỗng = dùng màu mặc định. */
const optionalHexColor = z
  .string()
  .trim()
  .refine((v) => v === '' || /^#[0-9a-f]{6}$/i.test(v), 'color');

export const academyProfileSchema = z.object({
  name: z.string().trim().min(2, 'name').max(120, 'name'),
  description: z.string().trim().max(2000, 'description').default(''),
  logoUrl: optionalHttpsUrl.default('').transform((v) => v || null),
  faviconUrl: optionalHttpsUrl.default('').transform((v) => v || null),
  brandColor: optionalHexColor.default('').transform((v) => (v ? v.toLowerCase() : null)),
  socials: z.partialRecord(z.enum(socialKeys), optionalHttpsUrl).default({}),
  contact: z
    .object({
      address: z.string().trim().max(300, 'contact').default(''),
      phone: z
        .string()
        .trim()
        .max(30, 'phone')
        .refine((v) => v === '' || /^[+\d][\d .()-]{5,}$/.test(v), 'phone')
        .default(''),
      zalo: z
        .string()
        .trim()
        .max(30, 'phone')
        .refine((v) => v === '' || /^[+\d][\d .()-]{5,}$/.test(v), 'phone')
        .default(''),
    })
    .default({ address: '', phone: '', zalo: '' }),
});

/**
 * Đọc màu thương hiệu thành biến CSS: màu chủ đạo và màu chữ trên nền đó (trắng/đen theo độ sáng)
 * để chữ luôn đọc được. Màu sai định dạng thì trả null (dùng màu mặc định).
 */
export function brandColorVars(
  color: string | null | undefined,
): { primary: string; onPrimary: string } | null {
  if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return null;
  const n = Number.parseInt(color.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  // Độ sáng cảm nhận (ITU-R BT.601)
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return { primary: color.toLowerCase(), onPrimary: luma > 0.6 ? '#1c1917' : '#ffffff' };
}
export type AcademyProfileInput = z.input<typeof academyProfileSchema>;

export const initialRatingSchema = z.int().min(0, 'rating').max(3500, 'rating');
