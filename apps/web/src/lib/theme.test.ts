import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  applyTheme,
  readStoredTheme,
  resolveTheme,
  systemPrefersDark,
  THEME_KEY,
  useTheme,
} from './theme';

type Listener = (e: MediaQueryListEvent) => void;

/** Giả lập matchMedia để điều khiển prefers-color-scheme. */
function mockSystem(initialDark: boolean) {
  let dark = initialDark;
  const listeners = new Set<Listener>();
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      get matches() {
        return dark;
      },
      addEventListener: (_: string, l: Listener) => listeners.add(l),
      removeEventListener: (_: string, l: Listener) => listeners.delete(l),
    })),
  );
  return {
    set(next: boolean) {
      dark = next;
      for (const l of listeners) l({ matches: next } as MediaQueryListEvent);
    },
  };
}

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
  document.documentElement.style.colorScheme = '';
});

afterEach(() => vi.unstubAllGlobals());

describe('resolveTheme', () => {
  it('chưa chọn thì theo hệ thống, đã chọn thì theo lựa chọn', () => {
    expect(resolveTheme(null, true)).toBe('dark');
    expect(resolveTheme(null, false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });
});

describe('localStorage và hệ thống', () => {
  it('chỉ nhận giá trị hợp lệ, bỏ qua rác', () => {
    expect(readStoredTheme()).toBeNull();
    localStorage.setItem(THEME_KEY, 'neon');
    expect(readStoredTheme()).toBeNull();
    localStorage.setItem(THEME_KEY, 'dark');
    expect(readStoredTheme()).toBe('dark');
  });

  it('systemPrefersDark an toàn khi không có matchMedia', () => {
    vi.stubGlobal('matchMedia', undefined);
    expect(systemPrefersDark()).toBe(false);
  });

  it('applyTheme gắn/gỡ .dark và color-scheme trên <html>', () => {
    applyTheme('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');
    applyTheme('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe('light');
  });
});

describe('useTheme', () => {
  it('mặc định theo hệ thống sáng và không ghi localStorage', () => {
    mockSystem(false);
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem(THEME_KEY)).toBeNull();
  });

  it('mặc định theo hệ thống tối: gắn .dark ngay', () => {
    mockSystem(true);
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('bật/tắt đổi giao diện và lưu lựa chọn; lần mở sau đọc lại', () => {
    mockSystem(false);
    const first = renderHook(() => useTheme());
    act(() => first.result.current.toggle());
    expect(first.result.current.theme).toBe('dark');
    expect(localStorage.getItem(THEME_KEY)).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    first.unmount();

    document.documentElement.classList.remove('dark');
    const second = renderHook(() => useTheme());
    expect(second.result.current.theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    act(() => second.result.current.toggle());
    expect(second.result.current.theme).toBe('light');
    expect(localStorage.getItem(THEME_KEY)).toBe('light');
  });

  it('lựa chọn của người dùng thắng hệ thống, kể cả khi hệ thống đổi', () => {
    const sys = mockSystem(false);
    const { result } = renderHook(() => useTheme());
    act(() => result.current.setTheme('light'));
    act(() => sys.set(true));
    expect(result.current.theme).toBe('light');
  });

  it('chưa chọn thì tự đổi theo hệ thống khi hệ thống đổi', () => {
    const sys = mockSystem(false);
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
    act(() => sys.set(true));
    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('theo dõi thay đổi từ tab khác qua sự kiện storage', () => {
    mockSystem(false);
    const { result } = renderHook(() => useTheme());
    act(() => {
      localStorage.setItem(THEME_KEY, 'dark');
      window.dispatchEvent(new StorageEvent('storage', { key: THEME_KEY }));
    });
    expect(result.current.theme).toBe('dark');
  });
});

describe('script chống nháy trong index.html', () => {
  it('dùng cùng khoá localStorage và gắn class dark trước khi vẽ', () => {
    const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
    expect(html).toContain(`'${THEME_KEY}'`);
    expect(html).toContain("classList.add('dark')");
    expect(html).toContain('prefers-color-scheme: dark');
    // Phải nằm trong <head>, trước script nạp ứng dụng
    expect(html.indexOf(THEME_KEY)).toBeLessThan(html.indexOf('/src/main.tsx'));
  });
});
