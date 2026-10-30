import {
  type BoardPreferences,
  DEFAULT_BOARD_PREFERENCES,
  normalizeBoardPreferences,
} from '@erpchess/domain';
import { useCallback, useEffect, useState } from 'react';

export type { BoardPreferences };
export { DEFAULT_BOARD_PREFERENCES };

const STORAGE_KEY = 'erpchess_board_pref';
export const BOARD_PREF_EVENT = 'erpchess-board-pref-change';

/** Có cài đặt đã lưu trên máy này chưa (để biết có nên đẩy lên server khi server còn trống). */
export function hasStoredBoardPreferences(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

export function getStoredBoardPreferences(): BoardPreferences {
  if (typeof window === 'undefined') return DEFAULT_BOARD_PREFERENCES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_BOARD_PREFERENCES;
    return normalizeBoardPreferences(JSON.parse(raw));
  } catch {
    return DEFAULT_BOARD_PREFERENCES;
  }
}

export function saveStoredBoardPreferences(prefs: BoardPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    window.dispatchEvent(new CustomEvent(BOARD_PREF_EVENT, { detail: prefs }));
  } catch {
    // Ignore localStorage write failures
  }
}

export function useBoardPreferences() {
  const [preferences, setPreferences] = useState<BoardPreferences>(getStoredBoardPreferences);

  useEffect(() => {
    const handleStorageChange = (e: CustomEvent<BoardPreferences>) => {
      if (e.detail) {
        setPreferences(e.detail);
      } else {
        setPreferences(getStoredBoardPreferences());
      }
    };

    window.addEventListener(BOARD_PREF_EVENT as never, handleStorageChange);
    return () => {
      window.removeEventListener(BOARD_PREF_EVENT as never, handleStorageChange);
    };
  }, []);

  const updatePreferences = useCallback((patch: Partial<BoardPreferences>) => {
    setPreferences((prev) => {
      const next = { ...prev, ...patch };
      saveStoredBoardPreferences(next);
      return next;
    });
  }, []);

  const setTheme = useCallback(
    (theme: BoardPreferences['theme']) => {
      updatePreferences({ theme });
    },
    [updatePreferences],
  );

  const setPieceSet = useCallback(
    (pieceSet: BoardPreferences['pieceSet']) => {
      updatePreferences({ pieceSet });
    },
    [updatePreferences],
  );

  const setCoordinates = useCallback(
    (coordinates: boolean) => {
      updatePreferences({ coordinates });
    },
    [updatePreferences],
  );

  const setSoundEnabled = useCallback(
    (soundEnabled: boolean) => {
      updatePreferences({ soundEnabled });
    },
    [updatePreferences],
  );

  const setAutoFlip = useCallback(
    (autoFlip: boolean) => {
      updatePreferences({ autoFlip });
    },
    [updatePreferences],
  );

  const resetPreferences = useCallback(() => {
    setPreferences(DEFAULT_BOARD_PREFERENCES);
    saveStoredBoardPreferences(DEFAULT_BOARD_PREFERENCES);
  }, []);

  return {
    preferences,
    setTheme,
    setPieceSet,
    setCoordinates,
    setSoundEnabled,
    setAutoFlip,
    resetPreferences,
  };
}
