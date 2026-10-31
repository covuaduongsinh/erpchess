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
  if (message === 'url') return 'branding.invalidUrl';
  if (message === 'color') return 'branding.invalidColor';
  if (message === 'phone') return 'branding.invalidPhone';
  if (message === 'contact') return 'branding.invalidContact';
  if (message === 'hours') return 'location.invalidHours';
  if (message === 'workingDays') return 'location.invalidWorkingDays';
  if (message === 'location') return 'location.needLocation';
  if (message === 'chesscom') return 'gameSync.invalidChesscom';
  if (message === 'scheduleDays') return 'quizSchedule.invalidDays';
  if (message === 'studies') return 'quizSchedule.invalidStudies';
  if (message === 'targets') return 'quizSchedule.invalidTargets';
  if (message === 'loginSection' || message === 'loginSections') return 'loginPage.invalidSection';
  if (message === 'lichess') return 'gameSync.invalidLichess';
  const known = ['username', 'pin', 'displayName', 'slug', 'name', 'email', 'password'] as const;
  return (known as readonly string[]).includes(message)
    ? (`validation.${message}` as TranslationKey)
    : null;
}

/** Tên chủ đề puzzle đã dịch; chủ đề lạ thì hiện nguyên mã. */
export function useThemeLabel() {
  const { t, i18n } = useT();
  return (theme: string) =>
    i18n.exists(`theme.${theme}`) ? t(`theme.${theme}` as TranslationKey) : theme;
}
