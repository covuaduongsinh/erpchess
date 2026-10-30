import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MasterbasePanel } from './MasterbasePanel';

const useMasterbase = vi.fn();
const fetchMasterbasePgn = vi.fn();

vi.mock('@erpchess/api', () => ({
  MASTERBASE_PAGE_SIZE: 20,
  fetchMasterbasePgn: (...a: unknown[]) => fetchMasterbasePgn(...a),
}));
vi.mock('@erpchess/api/react', () => ({
  useErpClient: () => ({}),
  useMasterbase: (...a: unknown[]) => useMasterbase(...a),
}));
vi.mock('../../lib/use-t', () => ({
  validationKey: () => null,
  useT: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}:${JSON.stringify(vars)}` : key,
    i18n: { language: 'vi' },
  }),
}));

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';

const rows = [
  {
    id: 7,
    white: 'An',
    black: 'Bình',
    whiteElo: 2610,
    blackElo: 2550,
    result: '1-0',
    event: 'Giải thử',
    date: '2026.10.01',
    eco: 'C50',
    plyCount: 6,
  },
];

afterEach(cleanup);
beforeEach(() => {
  useMasterbase.mockReset();
  fetchMasterbasePgn.mockReset();
  useMasterbase.mockReturnValue({
    isPending: false,
    isFetching: false,
    error: null,
    data: { rows, total: 45 },
  });
});

describe('MasterbasePanel', () => {
  it('queries without a position filter at the start position, then by position after a move', () => {
    const { rerender } = render(<MasterbasePanel fen={START} onLoadPgn={vi.fn()} />);
    expect(useMasterbase).toHaveBeenLastCalledWith({
      position: null,
      maxPlies: null,
      minElo: null,
      page: 0,
    });

    rerender(<MasterbasePanel fen={AFTER_E4} onLoadPgn={vi.fn()} />);
    expect(useMasterbase).toHaveBeenLastCalledWith(
      expect.objectContaining({ position: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq' }),
    );
  });

  it('toggles filters and pages, resetting to the first page when a filter changes', () => {
    render(<MasterbasePanel fen={AFTER_E4} onLoadPgn={vi.fn()} />);
    expect(screen.getByText('masterbase.page:{"page":1,"pages":3}')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '▶' }));
    expect(useMasterbase).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 }));

    fireEvent.click(screen.getByRole('button', { name: 'masterbase.elo2500' }));
    expect(useMasterbase).toHaveBeenLastCalledWith(
      expect.objectContaining({ minElo: 2500, page: 0 }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'masterbase.under20' }));
    expect(useMasterbase).toHaveBeenLastCalledWith(expect.objectContaining({ maxPlies: 39 }));
  });

  it('loads the chosen game into the analysis board', async () => {
    const onLoadPgn = vi.fn();
    fetchMasterbasePgn.mockResolvedValue('1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 1-0');
    render(<MasterbasePanel fen={START} onLoadPgn={onLoadPgn} />);
    fireEvent.click(screen.getByRole('button', { name: 'An (2610)' }));
    await waitFor(() =>
      expect(onLoadPgn).toHaveBeenCalledWith('1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 1-0'),
    );
    expect(fetchMasterbasePgn).toHaveBeenCalledWith({}, 7);
  });

  it('shows an empty state when nothing matches', () => {
    useMasterbase.mockReturnValue({
      isPending: false,
      isFetching: false,
      error: null,
      data: { rows: [], total: 0 },
    });
    render(<MasterbasePanel fen={START} onLoadPgn={vi.fn()} />);
    expect(screen.getByText('masterbase.none')).toBeTruthy();
  });
});
