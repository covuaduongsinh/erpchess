import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { gradeMove } from '../src/puzzle';
import { lichessToStudyPuzzle, MAX_PUZZLE_MOVES } from '../src/puzzle-bank';

// Ví dụ trong tài liệu của kho puzzle Lichess (00sHx): đen đi trước (e8d7), người giải là trắng
const FEN = 'q3k1nr/1pp1nQpp/3p4/1P2p3/4P3/B1PP1b2/B5PP/5K2 b k - 0 17';
const MOVES = 'e8d7 a2e6 d7d8 f7f8';

describe('lichessToStudyPuzzle: puzzle Lichess → puzzle của study', () => {
  it('đi nước đầu của đối thủ, lời giải là phần còn lại (người giải đi trước và đi cuối)', () => {
    const p = lichessToStudyPuzzle(FEN, MOVES);
    expect(p?.moves).toEqual(['a2e6', 'd7d8', 'f7f8']);
    // thế mới: vua đen đã ở d7 và đến lượt trắng
    const c = new Chess(p?.fen);
    expect(c.turn()).toBe('w');
    expect(c.get('d7')?.type).toBe('k');
    expect(c.get('e8')).toBeUndefined();
  });

  it('puzzle chuyển được chấm đúng bằng chess-core (nước đúng, nước sai, hoàn tất)', () => {
    const p = lichessToStudyPuzzle(FEN, MOVES);
    if (!p) throw new Error('phải chuyển được');
    expect(gradeMove(p, 0, 'a2e6')).toEqual({ result: 'correct', reply: 'd7d8', nextStep: 2 });
    expect(gradeMove(p, 0, 'a3b4')).toEqual({ result: 'wrong' });
    expect(gradeMove(p, 2, 'f7f8')).toEqual({ result: 'solved' });
  });

  it('từ chối dữ liệu hỏng: thiếu nước, nước sai định dạng, đi sai luật, số nước còn lại chẵn', () => {
    expect(lichessToStudyPuzzle(FEN, 'e8d7')).toBeNull(); // chỉ nước đối thủ
    expect(lichessToStudyPuzzle(FEN, '')).toBeNull();
    expect(lichessToStudyPuzzle(FEN, 'e8d7 xx')).toBeNull();
    expect(lichessToStudyPuzzle(FEN, 'e8e1 a2e6')).toBeNull(); // nước đầu không hợp lệ
    expect(lichessToStudyPuzzle(FEN, 'e8d7 a2e6 d7d8')).toBeNull(); // còn lại 2 nước (chẵn)
    expect(lichessToStudyPuzzle(FEN, 'e8d7 a2a8 d7d8 f7f8')).toBeNull(); // nước giải đi sai luật
    expect(lichessToStudyPuzzle('khong-phai-fen', MOVES)).toBeNull();
  });

  it('quá dài (> 39 nước lời giải) thì bị loại', () => {
    const many = ['e8d7', ...Array.from({ length: MAX_PUZZLE_MOVES + 2 }, () => 'a2e6')].join(' ');
    expect(lichessToStudyPuzzle(FEN, many)).toBeNull();
  });

  it('nước phong cấp (có hậu tố) được chấp nhận', () => {
    const fen = '8/P5k1/8/8/8/8/8/K7 b - - 0 1';
    const p = lichessToStudyPuzzle(fen, 'g7g6 a7a8q');
    expect(p?.moves).toEqual(['a7a8q']);
  });
});
