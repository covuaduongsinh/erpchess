import { useCallback, useState } from 'react';

export const SIDEBAR_COLLAPSED_KEY = 'erpchess.sidebar.collapsed';
export const SIDEBAR_GROUPS_KEY = 'erpchess.sidebar.groups';
export const LAST_ACADEMY_KEY = 'erpchess.lastAcademySlug';

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // localStorage có thể bị chặn (chế độ riêng tư): bỏ qua, trạng thái chỉ sống trong phiên.
  }
}

function readClosedGroups(): string[] {
  try {
    const parsed: unknown = JSON.parse(read(SIDEBAR_GROUPS_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function readLastAcademySlug(): string | null {
  return read(LAST_ACADEMY_KEY);
}

export function saveLastAcademySlug(slug: string) {
  write(LAST_ACADEMY_KEY, slug);
}

/**
 * Trạng thái sidebar: thu gọn (lưu localStorage), nhóm đang đóng (lưu localStorage) và drawer
 * trên màn hình hẹp. `autoCollapse` là trang cần nhiều chỗ (bàn cờ, phòng học...) nên sidebar
 * tự thu gọn; người dùng bấm mở lại thì giữ mở cho tới khi sang trang khác.
 */
export function useSidebarState(pathname: string, autoCollapse: boolean) {
  const [userCollapsed, setUserCollapsed] = useState(() => read(SIDEBAR_COLLAPSED_KEY) === '1');
  const [closedGroups, setClosedGroups] = useState<string[]>(readClosedGroups);
  const [drawerOpen, setDrawerOpen] = useState(false);
  // Ghi nhớ "đã mở lại thủ công" theo trang để sang trang khác thì tự thu gọn lại.
  const [forcedOpenPath, setForcedOpenPath] = useState<string | null>(null);

  const autoCollapsed = autoCollapse && forcedOpenPath !== pathname;
  const collapsed = autoCollapse ? autoCollapsed : userCollapsed;

  const toggleCollapsed = useCallback(() => {
    if (autoCollapse) {
      setForcedOpenPath((p) => (p === pathname ? null : pathname));
      return;
    }
    setUserCollapsed((c) => {
      write(SIDEBAR_COLLAPSED_KEY, c ? '0' : '1');
      return !c;
    });
  }, [autoCollapse, pathname]);

  const toggleGroup = useCallback((id: string) => {
    setClosedGroups((prev) => {
      const next = prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id];
      write(SIDEBAR_GROUPS_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return {
    collapsed,
    toggleCollapsed,
    closedGroups,
    toggleGroup,
    drawerOpen,
    setDrawerOpen,
  };
}
