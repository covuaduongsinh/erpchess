import { DEFAULT_BOARD_PREFERENCES } from '@erpchess/domain';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getStoredBoardPreferences,
  saveStoredBoardPreferences,
} from '../../lib/use-board-preferences';
import { BOARD_PREF_SYNC_DELAY_MS, BoardPreferencesSync } from './BoardPreferencesSync';

const mutate = vi.fn();
let profileData: { board_preferences: unknown } | undefined;

vi.mock('@erpchess/api/react', () => ({
  useProfile: () => ({ data: profileData }),
  useUpdateProfile: () => ({ mutate }),
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

beforeEach(() => {
  localStorage.clear();
  mutate.mockClear();
  profileData = undefined;
});

describe('BoardPreferencesSync', () => {
  it('loads preferences from the server into localStorage on login', () => {
    profileData = { board_preferences: { theme: 'wood', pieceSet: 'spatial' } };
    render(<BoardPreferencesSync userId="u1" />);
    expect(getStoredBoardPreferences()).toEqual({
      ...DEFAULT_BOARD_PREFERENCES,
      theme: 'wood',
      pieceSet: 'spatial',
    });
    expect(mutate).not.toHaveBeenCalled();
  });

  it('pushes local preferences up when the server has none', () => {
    const local = { ...DEFAULT_BOARD_PREFERENCES, theme: 'blue' as const };
    saveStoredBoardPreferences(local);
    profileData = { board_preferences: {} };
    render(<BoardPreferencesSync userId="u1" />);
    expect(mutate).toHaveBeenCalledWith({ boardPreferences: local });
  });

  it('does nothing when neither side has preferences', () => {
    profileData = { board_preferences: {} };
    render(<BoardPreferencesSync userId="u1" />);
    expect(mutate).not.toHaveBeenCalled();
  });

  it('debounces later changes and saves only the last one', () => {
    vi.useFakeTimers();
    profileData = { board_preferences: { theme: 'navy' } };
    render(<BoardPreferencesSync userId="u1" />);

    act(() => {
      saveStoredBoardPreferences({ ...DEFAULT_BOARD_PREFERENCES, theme: 'green' });
      saveStoredBoardPreferences({ ...DEFAULT_BOARD_PREFERENCES, theme: 'charcoal' });
    });
    expect(mutate).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(BOARD_PREF_SYNC_DELAY_MS);
    });
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate).toHaveBeenCalledWith({
      boardPreferences: { ...DEFAULT_BOARD_PREFERENCES, theme: 'charcoal' },
    });
  });

  it('waits for the profile before syncing changes', () => {
    vi.useFakeTimers();
    render(<BoardPreferencesSync userId="u1" />);
    act(() => {
      saveStoredBoardPreferences({ ...DEFAULT_BOARD_PREFERENCES, theme: 'green' });
      vi.advanceTimersByTime(BOARD_PREF_SYNC_DELAY_MS);
    });
    expect(mutate).not.toHaveBeenCalled();
  });
});
