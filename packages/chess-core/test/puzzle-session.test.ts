import { describe, expect, it } from 'vitest';
import type { Puzzle } from '../src/puzzle';
import { playPuzzleMove, retryPuzzleSession, startPuzzleSession } from '../src/puzzle-session';

const BACK_RANK: Puzzle = {
  fen: '5rk1/5ppp/8/8/8/8/5QPP/5RK1 w - - 0 1',
  moves: ['f2f7', 'f8f7', 'f1f7'],
};

describe('phiên làm puzzle', () => {
  it('đi đúng: đối phương tự đáp, tính giờ từng nước, giải xong', () => {
    let s = startPuzzleSession(BACK_RANK, 1000);
    s = playPuzzleMove(BACK_RANK, s, 'f2f7', 4000);
    expect(s.status).toBe('playing');
    expect(s.step).toBe(2);
    expect(s.lastMove).toEqual(['f8', 'f7']); // nước đáp của đen
    expect(s.fen.split(' ')[1]).toBe('w');
    s = playPuzzleMove(BACK_RANK, s, 'f1f7', 5500);
    expect(s.status).toBe('solved');
    expect(s.moves).toEqual([
      { uci: 'f2f7', ms: 3000 },
      { uci: 'f1f7', ms: 1500 },
    ]);
  });

  it('đi sai: dừng lượt thử, thử lại từ đầu với danh sách nước trống', () => {
    let s = startPuzzleSession(BACK_RANK, 0);
    s = playPuzzleMove(BACK_RANK, s, 'f2f6', 2000);
    expect(s.status).toBe('wrong');
    expect(s.moves).toEqual([{ uci: 'f2f6', ms: 2000 }]);
    // Hết lượt thì không đi tiếp được
    expect(playPuzzleMove(BACK_RANK, s, 'f1f7', 3000)).toBe(s);
    const again = retryPuzzleSession(BACK_RANK, 3000);
    expect(again).toEqual({
      step: 0,
      fen: BACK_RANK.fen,
      status: 'playing',
      moves: [],
      since: 3000,
    });
  });

  it('nước không hợp lệ thì bỏ qua, không tính là sai', () => {
    const s = startPuzzleSession(BACK_RANK, 0);
    expect(playPuzzleMove(BACK_RANK, s, 'a1a8', 100)).toBe(s);
  });

  it('chấp nhận chiếu hết theo cách khác ở nước cuối', () => {
    const p: Puzzle = { fen: '6k1/5ppp/8/8/8/8/1Q3PPP/R5K1 w - - 0 1', moves: ['a1a8'] };
    const s = playPuzzleMove(p, startPuzzleSession(p, 0), 'b2b8', 10);
    expect(s.status).toBe('solved');
  });
});
