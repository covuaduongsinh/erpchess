import { useCallback, useEffect, useState } from 'react';

/** Khoá localStorage lưu lựa chọn sáng/tối. Đồng bộ với đoạn script chống nháy trong `index.html`. */
export const THEME_KEY = 'erpchess.theme';

export type Theme = 'light' | 'dark';

export function readStoredTheme(): Theme | null {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    // localStorage có thể bị chặn (chế độ riêng tư): coi như chưa chọn
    return null;
  }
}

export function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches
  );
}

/** Đã chọn thì theo lựa chọn; chưa chọn thì theo hệ điều hành. */
export function resolveTheme(stored: Theme | null, systemDark: boolean): Theme {
  return stored ?? (systemDark ? 'dark' : 'light');
}

/** Gắn/gỡ class `.dark` trên `<html>` (các biến token và biến thể `dark:` của Tailwind đều theo class này). */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
}

/**
 * Chế độ sáng/tối: mặc định theo `prefers-color-scheme`, bấm công tắc thì lưu lựa chọn vào
 * localStorage. Chưa lưu thì tự đổi theo hệ điều hành; đổi ở tab khác cũng được theo dõi.
 */
export function useTheme() {
  const [stored, setStored] = useState<Theme | null>(readStoredTheme);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);
  const theme = resolveTheme(stored, systemDark);

  useEffect(() => applyTheme(theme), [theme]);

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === THEME_KEY) setStored(readStoredTheme());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    setStored(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Không lưu được thì chỉ giữ trong phiên
    }
  }, []);
  const toggle = useCallback(
    () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    [setTheme, theme],
  );

  return { theme, setTheme, toggle };
}
