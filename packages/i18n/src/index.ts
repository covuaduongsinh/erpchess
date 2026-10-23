import i18next, { type i18n as I18n } from 'i18next';
import { en } from './locales/en';
import { vi } from './locales/vi';
import type { TranslationKey } from './types';

export type { Resource, TranslationKey } from './types';
export { en, vi };

export const languages = ['vi', 'en'] as const;
export type Language = (typeof languages)[number];
export const defaultLanguage: Language = 'vi';

export function isLanguage(value: unknown): value is Language {
  return typeof value === 'string' && (languages as readonly string[]).includes(value);
}

/** Chọn ngôn ngữ hỗ trợ gần nhất từ chuỗi locale (vd. "en-US" → "en"), mặc định tiếng Việt. */
export function resolveLanguage(locale: string | null | undefined): Language {
  const base = locale?.toLowerCase().split(/[-_]/)[0];
  return isLanguage(base) ? base : defaultLanguage;
}

/** Tạo một instance i18next độc lập (mỗi app một instance), đã nạp sẵn mọi từ điển. */
export function createI18n(lng: Language = defaultLanguage): I18n {
  const instance = i18next.createInstance();
  void instance.init({
    lng,
    fallbackLng: defaultLanguage,
    initAsync: false,
    resources: { vi: { translation: vi }, en: { translation: en } },
    interpolation: { escapeValue: false },
  });
  return instance;
}

/** Hàm dịch có kiểm tra khoá ở compile time. */
export function translate(
  instance: I18n,
  key: TranslationKey,
  options?: Record<string, string | number>,
): string {
  return instance.t(key, options);
}
