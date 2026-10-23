import { createI18n, isLanguage, type Language, resolveLanguage } from '@erpchess/i18n';

const STORAGE_KEY = 'erpchess.lang';

function initialLanguage(): Language {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (isLanguage(saved)) return saved;
  } catch {
    // localStorage có thể bị chặn (chế độ riêng tư); dùng ngôn ngữ trình duyệt
  }
  return resolveLanguage(navigator.language);
}

export const i18n = createI18n(initialLanguage());
document.documentElement.lang = i18n.language;

i18n.on('languageChanged', (lng) => {
  document.documentElement.lang = lng;
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    // bỏ qua: chỉ là ghi nhớ tiện lợi
  }
});
