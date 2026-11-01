import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { SIDEBAR_COLLAPSED_KEY, SIDEBAR_GROUPS_KEY, useSidebarState } from './useSidebarState';

describe('useSidebarState', () => {
  beforeEach(() => localStorage.clear());

  it('thu gọn được lưu và khôi phục ở lần mở sau', () => {
    const first = renderHook(() => useSidebarState('/a/clb', false));
    expect(first.result.current.collapsed).toBe(false);
    act(() => first.result.current.toggleCollapsed());
    expect(first.result.current.collapsed).toBe(true);
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe('1');
    first.unmount();

    const second = renderHook(() => useSidebarState('/a/clb', false));
    expect(second.result.current.collapsed).toBe(true);
  });

  it('nhóm đóng được lưu', () => {
    const { result } = renderHook(() => useSidebarState('/a/clb', false));
    act(() => result.current.toggleGroup('learn'));
    expect(result.current.closedGroups).toEqual(['learn']);
    expect(JSON.parse(localStorage.getItem(SIDEBAR_GROUPS_KEY) ?? '[]')).toEqual(['learn']);
    act(() => result.current.toggleGroup('learn'));
    expect(result.current.closedGroups).toEqual([]);
  });

  it('trang bàn cờ tự thu gọn mà không đổi lựa chọn đã lưu; mở lại thủ công được', () => {
    const { result, rerender } = renderHook(({ p, auto }) => useSidebarState(p, auto), {
      initialProps: { p: '/analysis', auto: true },
    });
    expect(result.current.collapsed).toBe(true);
    expect(localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBeNull();
    act(() => result.current.toggleCollapsed());
    expect(result.current.collapsed).toBe(false);
    // sang trang thường: theo lựa chọn người dùng (chưa thu gọn)
    rerender({ p: '/a/clb', auto: false });
    expect(result.current.collapsed).toBe(false);
    // sang một trang tự thu gọn khác: thu gọn lại
    rerender({ p: '/a/clb/play/9', auto: true });
    expect(result.current.collapsed).toBe(true);
  });

  it('JSON hỏng trong localStorage thì dùng mặc định', () => {
    localStorage.setItem(SIDEBAR_GROUPS_KEY, '{oops');
    const { result } = renderHook(() => useSidebarState('/a/clb', false));
    expect(result.current.closedGroups).toEqual([]);
  });
});
