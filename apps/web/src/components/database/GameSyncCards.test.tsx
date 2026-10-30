import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameSyncCard, GameSyncIdsCard } from './GameSyncCards';

const syncMutate = vi.fn();
const updateMutate = vi.fn();
let profileData: Record<string, unknown> | undefined;
let syncData: unknown;

vi.mock('@erpchess/api/react', () => ({
  useProfile: () => ({ data: profileData }),
  useUpdateProfile: () => ({ mutate: updateMutate, isPending: false, error: null }),
  useSyncGames: () => ({ mutate: syncMutate, isPending: false, error: null, data: syncData }),
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/profile">{children}</a>,
}));
vi.mock('../../lib/use-t', () => ({
  validationKey: () => null,
  useT: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}:${JSON.stringify(vars)}` : key,
    i18n: { language: 'vi' },
  }),
}));

afterEach(cleanup);
beforeEach(() => {
  syncMutate.mockReset();
  updateMutate.mockReset();
  profileData = { id: 'u1', chesscom_username: null, lichess_username: null };
  syncData = undefined;
});

describe('GameSyncIdsCard', () => {
  it('saves usernames, empty fields unlink', () => {
    render(<GameSyncIdsCard userId="u1" />);
    fireEvent.change(screen.getByLabelText('gameSync.chesscom'), { target: { value: ' Hikaru ' } });
    fireEvent.click(screen.getByRole('button', { name: 'gameSync.saveIds' }));
    expect(updateMutate).toHaveBeenCalledWith(
      { chesscomUsername: 'Hikaru', lichessUsername: null },
      expect.anything(),
    );
  });
});

describe('GameSyncCard', () => {
  it('points to the profile page when no account is linked', () => {
    render(<GameSyncCard academyId="a1" userId="u1" onSynced={vi.fn()} />);
    expect(screen.getByText(/gameSync.noIds/)).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('syncs a linked account and opens the sync database', () => {
    profileData = { id: 'u1', chesscom_username: 'Hikaru', lichess_username: 'thibault' };
    const onSynced = vi.fn();
    syncMutate.mockImplementation((_v, opts) => opts.onSuccess({ databaseId: 'db1' }));
    render(<GameSyncCard academyId="a1" userId="u1" onSynced={onSynced} />);

    fireEvent.click(screen.getByRole('button', { name: /Lichess · thibault/ }));
    expect(syncMutate).toHaveBeenCalledWith(
      { source: 'lichess', username: 'thibault' },
      expect.anything(),
    );
    expect(onSynced).toHaveBeenCalledWith('db1');
  });

  it('reports no new games', () => {
    profileData = { id: 'u1', chesscom_username: 'Hikaru', lichess_username: null };
    syncData = { fetched: 0, imported: 0, failed: 0, databaseId: 'db1' };
    render(<GameSyncCard academyId="a1" userId="u1" onSynced={vi.fn()} />);
    expect(screen.getByRole('status').textContent).toBe('gameSync.upToDate');
    expect(screen.queryByRole('button', { name: /Lichess/ })).toBeNull();
  });
});
