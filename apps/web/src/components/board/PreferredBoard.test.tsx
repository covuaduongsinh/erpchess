import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { saveStoredBoardPreferences } from '../../lib/use-board-preferences';
import { autoFlipOrientation, PreferredBoard } from './PreferredBoard';

const playBoardSound = vi.fn();

vi.mock('../../lib/board-sound', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../lib/board-sound')>()),
  playBoardSound: (kind: string) => playBoardSound(kind),
}));

vi.mock('@erpchess/board-web', () => ({
  Board: ({ theme, coordinates }: { theme?: string; coordinates?: boolean }) => (
    <div data-testid="board" data-theme={theme} data-coords={String(coordinates)} />
  ),
}));

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
const AFTER_D5 = 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
const AFTER_EXD5 = 'rnbqkbnr/ppp1pppp/8/3P4/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 2';

afterEach(cleanup);

beforeEach(() => {
  localStorage.clear();
  playBoardSound.mockClear();
});

describe('PreferredBoard', () => {
  it('applies stored theme and coordinates', () => {
    saveStoredBoardPreferences({
      theme: 'wood',
      coordinates: false,
      soundEnabled: true,
      autoFlip: false,
    });
    render(<PreferredBoard fen={START} />);
    const board = screen.getByTestId('board');
    expect(board.getAttribute('data-theme')).toBe('wood');
    expect(board.getAttribute('data-coords')).toBe('false');
  });

  it('lets explicit props override preferences', () => {
    saveStoredBoardPreferences({
      theme: 'wood',
      coordinates: true,
      soundEnabled: true,
      autoFlip: false,
    });
    render(<PreferredBoard fen={START} theme="blue" coordinates={false} />);
    const board = screen.getByTestId('board');
    expect(board.getAttribute('data-theme')).toBe('blue');
    expect(board.getAttribute('data-coords')).toBe('false');
  });

  it('plays a sound when a new move arrives, not on first render', () => {
    const { rerender } = render(<PreferredBoard fen={START} />);
    expect(playBoardSound).not.toHaveBeenCalled();

    rerender(<PreferredBoard fen={AFTER_E4} lastMove={['e2', 'e4']} />);
    expect(playBoardSound).toHaveBeenLastCalledWith('move');

    rerender(<PreferredBoard fen={AFTER_D5} lastMove={['d7', 'd5']} />);
    rerender(<PreferredBoard fen={AFTER_EXD5} lastMove={['e4', 'd5']} />);
    expect(playBoardSound).toHaveBeenLastCalledWith('capture');
    expect(playBoardSound).toHaveBeenCalledTimes(3);
  });

  it('stays silent when sound is disabled in preferences or by prop', () => {
    saveStoredBoardPreferences({
      theme: 'navy',
      coordinates: true,
      soundEnabled: false,
      autoFlip: false,
    });
    const { rerender } = render(<PreferredBoard fen={START} />);
    rerender(<PreferredBoard fen={AFTER_E4} lastMove={['e2', 'e4']} />);
    cleanup();

    localStorage.clear();
    const second = render(<PreferredBoard fen={START} sound={false} />);
    second.rerender(<PreferredBoard fen={AFTER_E4} lastMove={['e2', 'e4']} sound={false} />);
    expect(playBoardSound).not.toHaveBeenCalled();
  });
});

describe('autoFlipOrientation', () => {
  it('keeps orientation when auto flip is off', () => {
    expect(autoFlipOrientation('w', 'b', false)).toBe('w');
    expect(autoFlipOrientation('b', 'w', false)).toBe('b');
  });

  it('puts the side to move at the bottom, inverted after a manual flip', () => {
    expect(autoFlipOrientation('w', 'b', true)).toBe('b');
    expect(autoFlipOrientation('w', 'w', true)).toBe('w');
    expect(autoFlipOrientation('b', 'w', true)).toBe('b');
    expect(autoFlipOrientation('b', 'b', true)).toBe('w');
  });
});
