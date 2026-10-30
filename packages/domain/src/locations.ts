/** Địa điểm học viện và hình thức học của batch (Giai đoạn 23a, đặc tả rea/spec/quan-tri.md). */
import { z } from 'zod';

export const locationKinds = [
  'centre',
  'school',
  'club_house',
  'community_centre',
  'library',
  'other',
] as const;
export type LocationKind = (typeof locationKinds)[number];

export const batchModes = ['online', 'offline', 'hybrid'] as const;
export type BatchMode = (typeof batchModes)[number];

/** Học offline hoặc kết hợp thì phải gắn một địa điểm. */
export function modeNeedsLocation(mode: BatchMode): boolean {
  return mode !== 'online';
}

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'time');
const phone = z
  .string()
  .trim()
  .regex(/^[+0-9][0-9 .()-]{5,29}$/, 'phone');

export const locationSchema = z
  .object({
    kind: z.enum(locationKinds).default('centre'),
    name: z.string().trim().min(2, 'name').max(120, 'name'),
    isMain: z.boolean().default(false),
    addressLine: z.string().trim().max(300, 'address').default(''),
    country: z.string().trim().min(2, 'country').max(64, 'country'),
    state: z.string().trim().max(64, 'state').default(''),
    city: z.string().trim().max(64, 'city').default(''),
    // 0 = Chủ nhật … 6 = Thứ bảy, cùng quy ước với lịch batch
    workingDays: z
      .array(z.int().min(0).max(6))
      .min(1, 'workingDays')
      .max(7, 'workingDays')
      .transform((days) => [...new Set(days)].sort((a, b) => a - b)),
    opensAt: time,
    closesAt: time,
    timezone: z.string().trim().min(1, 'timezone').max(64, 'timezone').default('Asia/Ho_Chi_Minh'),
    contactName: z.string().trim().min(1, 'contactName').max(120, 'contactName'),
    contactPhone: phone,
    email: z
      .string()
      .trim()
      .max(254, 'email')
      .refine((v) => v === '' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), 'email')
      .default('')
      .transform((v) => v || null),
    notes: z.string().trim().max(1000, 'notes').default(''),
  })
  .refine((v) => v.closesAt > v.opensAt, { message: 'hours', path: ['closesAt'] });

export type LocationInput = z.input<typeof locationSchema>;
export type LocationValues = z.output<typeof locationSchema>;

export type LocationFilter = 'all' | 'centre' | 'school' | 'other';

/**
 * Lọc danh sách địa điểm theo tab (Tất cả / Trung tâm / Trường học / Khác) và ô tìm kiếm
 * (tên, thành phố, địa chỉ, người liên hệ; không phân biệt hoa thường và dấu).
 */
export function filterLocations<
  T extends {
    kind: string;
    name: string;
    city: string;
    address_line: string;
    contact_name: string;
  },
>(rows: readonly T[], filter: LocationFilter, query: string): T[] {
  const fold = (s: string) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  const q = fold(query.trim());
  return rows.filter((r) => {
    if (filter === 'centre' && r.kind !== 'centre') return false;
    if (filter === 'school' && r.kind !== 'school') return false;
    if (filter === 'other' && (r.kind === 'centre' || r.kind === 'school')) return false;
    if (!q) return true;
    return [r.name, r.city, r.address_line, r.contact_name].some((v) => fold(v).includes(q));
  });
}
