import type { GameRow } from '@erpchess/api';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SimulQuickPlayModal } from './SimulQuickPlayModal';

afterEach(cleanup);

vi.mock('../../lib/use-t', () => ({
  useT: () => ({
    t: (key: string, _opt?: Record<string, unknown>) => {
      if (key === 'simul.nextActiveBoard') return 'Chuyển bàn tiếp theo';
      if (key === 'simul.openGamePage') return 'Mở trang ván đấu';
      return key;
    },
    i18n: { language: 'vi' },
  }),
}));

const mockMutate = vi.fn();

vi.mock('@erpchess/api/react', () => ({
  useGameAction: () => ({
    mutate: mockMutate,
    isPending: false,
    error: null,
  }),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

const MOCK_GAME: GameRow = {
  id: 'game-1',
  academy_id: 'acad-1',
  white_id: 'host-1',
  black_id: 'student-1',
  initial_fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  moves: ['e2e4', 'e7e5'],
  fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
  status: 'active',
  result: null,
  reason: null,
  base_ms: 600000,
  inc_ms: 0,
  white_ms: 600000,
  black_ms: 590000,
  turn_started_at: new Date().toISOString(),
  draw_offer_by: null,
  rating_change: null,
  bot_elo: null,
  simul_id: 'simul-1',
  pgn: '1. e4 e5',
  created_by: 'host-1',
  started_at: new Date().toISOString(),
  finished_at: null,
  board_no: 1,
  round: null,
  tournament_id: null,
  rated: false,
  version: 1,
  category: 'rapid',
  created_at: new Date().toISOString(),
};

describe('SimulQuickPlayModal', () => {
  it('renders student opponent name and turn status', () => {
    const handleClose = vi.fn();
    render(
      <SimulQuickPlayModal
        slug="clb-test"
        hostId="host-1"
        game={MOCK_GAME}
        studentName="Trần Hoàng Nam"
        activeBoardsCount={3}
        onNextBoard={vi.fn()}
        onClose={handleClose}
      />,
    );

    expect(screen.getByText('Trần Hoàng Nam')).toBeTruthy();
    expect(screen.getByText(/Bạn cầm Trắng ♔/i)).toBeTruthy();
    expect(screen.getByText(/Đến lượt bạn đi/i)).toBeTruthy();
  });

  it('renders Next Board button and triggers callback when clicked', () => {
    const handleNextBoard = vi.fn();
    const handleClose = vi.fn();

    render(
      <SimulQuickPlayModal
        slug="clb-test"
        hostId="host-1"
        game={MOCK_GAME}
        studentName="Trần Hoàng Nam"
        activeBoardsCount={3}
        onNextBoard={handleNextBoard}
        onClose={handleClose}
      />,
    );

    const nextBtn = screen.getByRole('button', { name: /Chuyển bàn tiếp theo/i });
    expect(nextBtn).toBeTruthy();
    fireEvent.click(nextBtn);
    expect(handleNextBoard).toHaveBeenCalledTimes(1);
  });

  it('triggers onClose when close button is clicked', () => {
    const handleClose = vi.fn();

    render(
      <SimulQuickPlayModal
        slug="clb-test"
        hostId="host-1"
        game={MOCK_GAME}
        studentName="Trần Hoàng Nam"
        activeBoardsCount={1}
        onClose={handleClose}
      />,
    );

    const closeBtns = screen.getAllByRole('button', { name: 'Đóng' });
    const firstCloseBtn = closeBtns[0];
    if (firstCloseBtn) {
      fireEvent.click(firstCloseBtn);
    }
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
