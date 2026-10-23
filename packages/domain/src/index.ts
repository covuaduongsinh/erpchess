/**
 * Quy tắc nghiệp vụ dùng chung cho mọi client và Edge Function.
 * Các ràng buộc ở đây phải khớp với CHECK trong supabase/migrations.
 */
import { z } from 'zod';

export const academyRoles = ['owner', 'coach', 'student', 'parent'] as const;
export type AcademyRole = (typeof academyRoles)[number];

/** Owner và coach được quản lý lớp, học viên. */
export function isStaff(role: AcademyRole | null | undefined): boolean {
  return role === 'owner' || role === 'coach';
}

/** Học viên đăng nhập bằng username: 3–32 ký tự a-z, 0-9, dấu chấm, gạch dưới. */
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_.]{3,32}$/, 'username');

/** PIN học viên: 6–12 chữ số (Supabase Auth yêu cầu mật khẩu tối thiểu 6 ký tự). */
export const pinSchema = z.string().regex(/^\d{6,12}$/, 'pin');

export const displayNameSchema = z.string().trim().min(1, 'displayName').max(80, 'displayName');

export const academySlugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$/, 'slug');

export const academyNameSchema = z.string().trim().min(2, 'name').max(120, 'name');

export const createAcademySchema = z.object({
  name: academyNameSchema,
  slug: academySlugSchema,
});
export type CreateAcademyInput = z.infer<typeof createAcademySchema>;

export const createStudentSchema = z.object({
  academyId: z.uuid(),
  displayName: displayNameSchema,
  username: usernameSchema,
  pin: pinSchema,
  groupId: z.uuid().optional(),
});
export type CreateStudentInput = z.infer<typeof createStudentSchema>;

export const groupNameSchema = z.string().trim().min(1, 'name').max(120, 'name');

export const emailSchema = z.email('email');
export const passwordSchema = z.string().min(8, 'password').max(72, 'password');

export const signUpSchema = z.object({
  displayName: displayNameSchema,
  email: emailSchema,
  password: passwordSchema,
});
export type SignUpInput = z.infer<typeof signUpSchema>;

const VI_DIACRITICS: Record<string, string> = { đ: 'd', Đ: 'd' };

/** Gợi ý slug từ tên học viện: bỏ dấu tiếng Việt, chữ thường, nối bằng gạch ngang. */
export function slugify(input: string): string {
  return input
    .replace(/[đĐ]/g, (c) => VI_DIACRITICS[c] ?? c)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/g, '');
}
