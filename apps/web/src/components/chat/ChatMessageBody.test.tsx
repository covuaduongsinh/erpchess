import { cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatMessageBody, useChatPreview } from './ChatMessageBody';

afterEach(cleanup);

vi.mock('../../lib/use-t', () => ({
  useT: () => ({
    t: (key: string, vars?: { count?: number }) =>
      vars?.count !== undefined ? `${key}:${vars.count}` : key,
    i18n: { language: 'vi' },
  }),
}));

vi.mock('../board/PreferredBoard', () => ({
  PreferredBoard: ({ fen, orientation }: { fen: string; orientation?: string }) => (
    <div data-testid="mini-board" data-fen={fen} data-orientation={orientation} />
  ),
}));

const ITALIAN = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3';
const PGN = `[White "An"]
[Black "Bình"]
[Result "1-0"]
[Event "Giải CLB"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 1-0`;

describe('ChatMessageBody', () => {
  it('renders plain text without a board', () => {
    render(<ChatMessageBody body="Chào thầy" mine={false} onOpen={vi.fn()} />);
    expect(screen.getByText('Chào thầy')).toBeTruthy();
    expect(screen.queryByTestId('mini-board')).toBeNull();
  });

  it('renders a mini-board for a FEN and opens it on click', () => {
    const onOpen = vi.fn();
    render(<ChatMessageBody body={`Giải thế này: ${ITALIAN}`} mine onOpen={onOpen} />);
    expect(screen.getByText('Giải thế này:')).toBeTruthy();
    const board = screen.getByTestId('mini-board');
    expect(board.getAttribute('data-fen')).toBe(ITALIAN);
    // Đen đến lượt nên bàn quay về phía Đen
    expect(board.getAttribute('data-orientation')).toBe('b');

    fireEvent.click(screen.getByRole('button', { name: 'chat.openPosition' }));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ kind: 'fen', fen: ITALIAN }));
  });

  it('renders a game card for a PGN and opens it on click', () => {
    const onOpen = vi.fn();
    render(<ChatMessageBody body={PGN} mine={false} onOpen={onOpen} />);
    expect(screen.getByText('An – Bình')).toBeTruthy();
    expect(screen.getByText('1-0 · chat.gameMoves:3')).toBeTruthy();
    expect(screen.getByText('Giải CLB')).toBeTruthy();

    fireEvent.click(screen.getByTitle('chat.openGame'));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ kind: 'pgn', pgn: PGN }));
  });
});

describe('useChatPreview', () => {
  it('replaces FEN/PGN with a label and keeps normal text', () => {
    const { result } = renderHook(() => useChatPreview());
    expect(result.current(ITALIAN)).toBe('chat.sharedPosition');
    expect(result.current(PGN)).toBe('chat.sharedGame');
    expect(result.current('Chào thầy')).toBe('Chào thầy');
    expect(result.current(null)).toBeNull();
  });
});
