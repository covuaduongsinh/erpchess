import { describe, expect, it } from 'vitest';
import { gradeMove, type Puzzle, puzzleSideToMove } from '../src/puzzle';

// Trắng đi: Qxf7+ Rxf7 Rxf7 — ăn hai lần ở f7 (nước cuối không chiếu hết, phải đúng nước lời giải)
const BACK_RANK: Puzzle = {
  fen: '5rk1/5ppp/8/8/8/8/5QPP/5RK1 w - - 0 1',
  moves: ['f2f7', 'f8f7', 'f1f7'],
};

describe('gradeMove', () => {
  it('đúng từng bước: trả nước đáp của đối phương và bước kế tiếp', () => {
    expect(gradeMove(BACK_RANK, 0, 'f2f7')).toEqual({
      result: 'correct',
      reply: 'f8f7',
      nextStep: 2,
    });
    expect(gradeMove(BACK_RANK, 2, 'f1f7')).toEqual({ result: 'solved' });
  });

  it('nước sai hoặc không hợp lệ', () => {
    expect(gradeMove(BACK_RANK, 0, 'f2a7')).toEqual({ result: 'wrong' });
    expect(gradeMove(BACK_RANK, 0, 'a1a8')).toEqual({ result: 'wrong' });
  });

  it('nước cuối là chiếu hết: mọi nước chiếu hết khác cũng đúng', () => {
    // Lời giải Ra8#, nhưng Qb8# cũng chiếu hết hàng cuối
    const p: Puzzle = { fen: '6k1/5ppp/8/8/8/8/1Q3PPP/R5K1 w - - 0 1', moves: ['a1a8'] };
    expect(gradeMove(p, 0, 'a1a8')).toEqual({ result: 'solved' });
    expect(gradeMove(p, 0, 'b2b8')).toEqual({ result: 'solved' });
    expect(gradeMove(p, 0, 'b2b1')).toEqual({ result: 'wrong' });
  });

  it('nước giữa chừng không phải chiếu hết thì phải đúng nước lời giải', () => {
    const p: Puzzle = { fen: BACK_RANK.fen, moves: BACK_RANK.moves };
    expect(gradeMove(p, 0, 'f2f6')).toEqual({ result: 'wrong' });
  });

  it('UCI phong cấp phải khớp quân', () => {
    const p: Puzzle = { fen: '8/4P1k1/8/8/8/8/8/4K3 w - - 0 1', moves: ['e7e8q'] };
    expect(gradeMove(p, 0, 'e7e8q')).toEqual({ result: 'solved' });
    expect(gradeMove(p, 0, 'e7e8n')).toEqual({ result: 'wrong' });
  });

  it('bên giải là bên đi trong FEN', () => {
    expect(puzzleSideToMove(BACK_RANK)).toBe('w');
  });

  it('bước ngoài phạm vi lời giải là sai', () => {
    expect(gradeMove(BACK_RANK, 5, 'f2f7')).toEqual({ result: 'wrong' });
  });
});
