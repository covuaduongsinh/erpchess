import { useProfile, useUpdateProfile } from '@erpchess/api/react';
import { normalizeBoardPreferences } from '@erpchess/domain';
import { useEffect, useRef } from 'react';
import {
  BOARD_PREF_EVENT,
  type BoardPreferences,
  getStoredBoardPreferences,
  hasStoredBoardPreferences,
  saveStoredBoardPreferences,
} from '../../lib/use-board-preferences';

export const BOARD_PREF_SYNC_DELAY_MS = 800;

function isNonEmptyObject(raw: unknown): boolean {
  return !!raw && typeof raw === 'object' && !Array.isArray(raw) && Object.keys(raw).length > 0;
}

/**
 * Đồng bộ tùy chọn bàn cờ giữa localStorage và `profiles.board_preferences` (Giai đoạn 20c).
 * localStorage vẫn là nguồn để giao diện phản hồi ngay; server giữ bản dùng chung giữa các máy.
 * - Khi đăng nhập: server đã có cài đặt thì nạp về; server còn trống thì đẩy cài đặt của máy này lên.
 * - Sau đó mỗi lần đổi cài đặt thì lưu lên server (gộp các thay đổi liên tiếp).
 */
export function BoardPreferencesSync({ userId }: { userId: string }) {
  const profile = useProfile(userId);
  const { mutate } = useUpdateProfile(userId);
  const hydratedRef = useRef(false);
  const lastSyncedRef = useRef<string | null>(null);

  useEffect(() => {
    if (hydratedRef.current || !profile.data) return;
    hydratedRef.current = true;
    const raw: unknown = profile.data.board_preferences;
    if (isNonEmptyObject(raw)) {
      const prefs = normalizeBoardPreferences(raw);
      lastSyncedRef.current = JSON.stringify(prefs);
      if (JSON.stringify(getStoredBoardPreferences()) !== lastSyncedRef.current) {
        saveStoredBoardPreferences(prefs);
      }
    } else if (hasStoredBoardPreferences()) {
      const local = getStoredBoardPreferences();
      lastSyncedRef.current = JSON.stringify(local);
      mutate({ boardPreferences: local });
    }
  }, [profile.data, mutate]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onChange = (e: CustomEvent<BoardPreferences>) => {
      if (!hydratedRef.current) return;
      const prefs = e.detail ?? getStoredBoardPreferences();
      const key = JSON.stringify(prefs);
      if (key === lastSyncedRef.current) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        lastSyncedRef.current = key;
        mutate({ boardPreferences: prefs });
      }, BOARD_PREF_SYNC_DELAY_MS);
    };
    window.addEventListener(BOARD_PREF_EVENT as never, onChange);
    return () => {
      window.removeEventListener(BOARD_PREF_EVENT as never, onChange);
      clearTimeout(timer);
    };
  }, [mutate]);

  return null;
}
