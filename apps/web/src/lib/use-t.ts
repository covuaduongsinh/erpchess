import type { TranslationKey } from '@erpchess/i18n';
import { useTranslation } from 'react-i18next';

/** Hàm dịch có kiểm tra khoá lúc biên dịch. */
export function useT() {
  const { t, i18n } = useTranslation();
  const tk = (key: TranslationKey, opts?: Record<string, string | number>) => t(key, opts);
  return { t: tk, i18n };
}

/** Đổi mã lỗi Zod (message là tên trường) sang câu thông báo đã dịch. */
export function validationKey(message: string): TranslationKey | null {
  const known = ['username', 'pin', 'displayName', 'slug', 'name', 'email', 'password'] as const;
  return (known as readonly string[]).includes(message)
    ? (`validation.${message}` as TranslationKey)
    : null;
}
