import { createI18n, resolveLanguage } from '@erpchess/i18n';
import { getLocales } from 'expo-localization';

export const i18n = createI18n(resolveLanguage(getLocales()[0]?.languageTag));
