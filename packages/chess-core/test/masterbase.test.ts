import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { masterbaseFilter, positionKey } from '../src/masterbase';
import { parsePgn } from '../src/pgn';
import { START_FEN } from '../src/rules';

describe('positionKey', () => {
  it('giữ xếp quân, bên đi, quyền nhập thành; bỏ ô bắt tốt qua đường và bộ đếm', () => {
    expect(positionKey('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1')).toBe(
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq',
    );
  });

  it('khớp giữa cây ván của chess-core và chess.js (script nạp dữ liệu)', () => {
    const pgn = '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 *';
    const [tree] = parsePgn(pgn);
    const ours = (tree?.mainline() ?? []).map((n) => positionKey(n.fen));
    const chess = new Chess();
    chess.loadPgn(pgn);
    const theirs = chess.history({ verbose: true }).map((m) => positionKey(m.after));
    expect(ours).toEqual(theirs);
  });
});

describe('masterbaseFilter', () => {
  it('thế khởi đầu không lọc theo thế cờ', () => {
    expect(
      masterbaseFilter({ fen: START_FEN, byPosition: true, under20Moves: false, elo2500: false }),
    ).toEqual({ position: null, maxPlies: null, minElo: null });
  });

  it('bật các bộ lọc', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1';
    expect(masterbaseFilter({ fen, byPosition: true, under20Moves: true, elo2500: true })).toEqual({
      position: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq',
      maxPlies: 39,
      minElo: 2500,
    });
    expect(
      masterbaseFilter({ fen, byPosition: false, under20Moves: false, elo2500: false }).position,
    ).toBeNull();
  });
});
