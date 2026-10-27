import type { BoardTheme } from '@erpchess/board-web';
import { useCallback, useEffect, useState } from 'react';

export interface BoardPreferences {
  theme: BoardTheme;
  coordinates: boolean;
  soundEnabled: boolean;
  autoFlip: boolean;
}

export const DEFAULT_BOARD_PREFERENCES: BoardPreferences = {
  theme: 'navy',
  coordinates: true,
  soundEnabled: true,
  autoFlip: false,
};

const STORAGE_KEY = 'erpchess_board_pref';
const EVENT_KEY = 'erpchess-board-pref-change';

export function getStoredBoardPreferences(): BoardPreferences {
  if (typeof window === 'undefined') return DEFAULT_BOARD_PREFERENCES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_BOARD_PREFERENCES;
    const parsed = JSON.parse(raw) as Partial<BoardPreferences>;
    return {
      theme: parsed.theme ?? DEFAULT_BOARD_PREFERENCES.theme,
      coordinates: parsed.coordinates ?? DEFAULT_BOARD_PREFERENCES.coordinates,
      soundEnabled: parsed.soundEnabled ?? DEFAULT_BOARD_PREFERENCES.soundEnabled,
      autoFlip: parsed.autoFlip ?? DEFAULT_BOARD_PREFERENCES.autoFlip,
    };
  } catch {
    return DEFAULT_BOARD_PREFERENCES;
  }
}

export function saveStoredBoardPreferences(prefs: BoardPreferences): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    window.dispatchEvent(new CustomEvent(EVENT_KEY, { detail: prefs }));
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

    window.addEventListener(EVENT_KEY as never, handleStorageChange);
    return () => {
      window.removeEventListener(EVENT_KEY as never, handleStorageChange);
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
    (theme: BoardTheme) => {
      updatePreferences({ theme });
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
    setCoordinates,
    setSoundEnabled,
    setAutoFlip,
    resetPreferences,
  };
}
