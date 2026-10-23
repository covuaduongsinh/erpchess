import { describe, expect, it } from 'vitest';
import { createI18n, en, resolveLanguage, translate, vi } from './index';

function keysOf(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'string' ? [`${prefix}${k}`] : keysOf(v as object, `${prefix}${k}.`),
  );
}

describe('i18n', () => {
  it('mặc định là tiếng Việt', () => {
    const i18n = createI18n();
    expect(translate(i18n, 'home.welcome')).toBe('Chào mừng đến với ERPChess');
  });

  it('dịch tiếng Anh và nội suy biến', () => {
    const i18n = createI18n('en');
    expect(translate(i18n, 'home.platform', { platform: 'desktop' })).toBe(
      'You are using the desktop app',
    );
  });

  it('đổi ngôn ngữ lúc chạy', async () => {
    const i18n = createI18n('vi');
    await i18n.changeLanguage('en');
    expect(translate(i18n, 'app.tagline')).toBe(en.app.tagline);
  });

  it('từ điển en đủ khoá như vi', () => {
    expect(keysOf(en).sort()).toEqual(keysOf(vi).sort());
  });

  it('resolveLanguage chọn ngôn ngữ hỗ trợ', () => {
    expect(resolveLanguage('en-US')).toBe('en');
    expect(resolveLanguage('vi_VN')).toBe('vi');
    expect(resolveLanguage('fr-FR')).toBe('vi');
    expect(resolveLanguage(undefined)).toBe('vi');
  });
});
