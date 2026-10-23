import type { TranslationKey } from '@erpchess/i18n';
import { useTranslation } from 'react-i18next';
import { ZodError } from 'zod';

/** Hàm dịch có kiểm tra khoá lúc biên dịch. */
export function useT() {
  const { t, i18n } = useTranslation();
  const tk = (key: TranslationKey, opts?: Record<string, string | number>) => t(key, opts);
  return { t: tk, i18n };
}

const VALIDATION_FIELDS = ['username', 'pin', 'displayName', 'slug', 'name', 'email', 'password'];

/** Đổi lỗi (Zod, Supabase, Edge Function) thành câu thông báo đã dịch. */
export function errorMessage(t: ReturnType<typeof useT>['t'], error: unknown): string {
  if (error instanceof ZodError) {
    const field = error.issues[0]?.message ?? '';
    if (VALIDATION_FIELDS.includes(field)) return t(`validation.${field}` as TranslationKey);
    return error.message;
  }
  if (error instanceof Error) {
    const code = (error as { code?: string }).code;
    if (code === 'username_taken') return t('students.usernameTaken');
    if (code === '23505') return t('academy.slugTaken');
    if (/invalid login credentials/i.test(error.message)) return t('auth.invalidCredentials');
    return t('common.error', { message: error.message });
  }
  return String(error);
}
