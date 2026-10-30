import type { GameRow } from '@erpchess/api';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TournamentLiveBoardGrid } from './TournamentLiveBoardGrid';

afterEach(cleanup);

vi.mock('../../lib/use-t', () => ({
  validationKey: () => null,
  useT: () => ({
    t: (key: string, opt?: Record<string, unknown>) => {
      if (key === 'tournament.board') return `Bàn ${opt?.n ?? 1}`;
      if (key === 'tournament.livePulse') return 'Trực tiếp';
      if (key === 'tournament.myGame') return 'Vào ván của tôi';
      if (key === 'tournament.view_table') return 'Xem chi tiết';
      if (key === 'tournament.roundStatus_pending') return 'Chưa ghép';
      return key;
    },
    i18n: { language: 'vi' },
  }),
}));

vi.mock('@erpchess/board-web', () => ({
  Board: ({ fen }: { fen: string }) => <div data-testid="board">{fen}</div>,
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

const MOCK_GAMES: GameRow[] = [
  {
    id: 'game-1',
    academy_id: 'acad-1',
    white_id: 'player-1',
    black_id: 'player-2',
    initial_fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    moves: ['e2e4', 'e7e5'],
    fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
    status: 'active',
    result: null,
    reason: null,
    base_ms: 300000,
    inc_ms: 2000,
    white_ms: 290000,
    black_ms: 295000,
    turn_started_at: new Date().toISOString(),
    draw_offer_by: null,
    rating_change: null,
    bot_elo: null,
    simul_id: null,
    pgn: '1. e4 e5',
    created_by: 'coach-1',
    started_at: new Date().toISOString(),
    finished_at: null,
    board_no: 1,
    round: 1,
    tournament_id: 'tour-1',
    rated: true,
    version: 1,
    category: 'blitz',
    created_at: new Date().toISOString(),
  },
  {
    id: 'game-2',
    academy_id: 'acad-1',
    white_id: 'player-3',
    black_id: 'player-4',
    initial_fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    moves: ['d2d4', 'd7d5'],
    fen: 'rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2',
    status: 'finished',
    result: '1-0',
    reason: 'checkmate',
    base_ms: 300000,
    inc_ms: 2000,
    white_ms: 250000,
    black_ms: 200000,
    turn_started_at: null,
    draw_offer_by: null,
    rating_change: null,
    bot_elo: null,
    simul_id: null,
    pgn: '1. d4 d5',
    created_by: 'coach-1',
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
    board_no: 2,
    round: 1,
    tournament_id: 'tour-1',
    rated: true,
    version: 1,
    category: 'blitz',
    created_at: new Date().toISOString(),
  },
];

const mockGetName = (uid: string | null) => {
  if (uid === 'player-1') return 'Nguyễn Văn A';
  if (uid === 'player-2') return 'Trần Thị B';
  if (uid === 'player-3') return 'Lê Hoàng C';
  if (uid === 'player-4') return 'Phạm Quốc D';
  return 'Ẩn danh';
};

describe('TournamentLiveBoardGrid', () => {
  it('renders all tournament boards with player names and statuses', () => {
    render(
      <TournamentLiveBoardGrid
        slug="clb-hoang-gia"
        games={MOCK_GAMES}
        getName={mockGetName}
        filter="all"
      />,
    );

    expect(screen.getByText('Bàn 1')).toBeTruthy();
    expect(screen.getByText('Bàn 2')).toBeTruthy();
    expect(screen.getByText('Nguyễn Văn A')).toBeTruthy();
    expect(screen.getByText('Trần Thị B')).toBeTruthy();
    expect(screen.getByText('Lê Hoàng C')).toBeTruthy();
    expect(screen.getByText('Phạm Quốc D')).toBeTruthy();
    expect(screen.getByText('Trực tiếp')).toBeTruthy();
  });

  it('filters boards by active status correctly', () => {
    render(
      <TournamentLiveBoardGrid
        slug="clb-hoang-gia"
        games={MOCK_GAMES}
        getName={mockGetName}
        filter="active"
      />,
    );

    expect(screen.getByText('Bàn 1')).toBeTruthy();
    expect(screen.queryByText('Bàn 2')).toBeNull();
  });

  it('filters boards by finished status correctly', () => {
    render(
      <TournamentLiveBoardGrid
        slug="clb-hoang-gia"
        games={MOCK_GAMES}
        getName={mockGetName}
        filter="finished"
      />,
    );

    expect(screen.queryByText('Bàn 1')).toBeNull();
    expect(screen.getByText('Bàn 2')).toBeTruthy();
  });

  it('renders empty pending message when no games match', () => {
    render(
      <TournamentLiveBoardGrid
        slug="clb-hoang-gia"
        games={[]}
        getName={mockGetName}
        filter="all"
      />,
    );

    expect(screen.getByText('Chưa ghép')).toBeTruthy();
  });
});
