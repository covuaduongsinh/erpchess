import { describe, expect, it } from 'vitest';
import {
  gameStatus,
  isValidFen,
  legalDests,
  needsPromotion,
  playMove,
  START_FEN,
  sideToMove,
} from '../src/rules';

describe('luật cờ', () => {
  it('legalDests ở thế khởi đầu: 20 nước, mã g1 đi f3/h3', () => {
    const dests = legalDests(START_FEN);
    const total = [...dests.values()].reduce((n, d) => n + d.length, 0);
    expect(total).toBe(20);
    expect(dests.get('g1')?.sort()).toEqual(['f3', 'h3']);
    expect(dests.has('e1')).toBe(false);
  });

  it('playMove nhận UCI hoặc SAN, trả về SAN/UCI/FEN sau nước đi', () => {
    expect(playMove(START_FEN, 'e2e4')).toEqual({
      san: 'e4',
      uci: 'e2e4',
      fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    });
    expect(playMove(START_FEN, 'Nf3')?.uci).toBe('g1f3');
    expect(playMove(START_FEN, 'e2e5')).toBeNull();
    expect(playMove(START_FEN, 'xyz')).toBeNull();
  });

  it('phong cấp: cần chọn quân, UCI có hậu tố', () => {
    const fen = '8/4P3/8/8/8/8/k7/4K3 w - - 0 1';
    expect(needsPromotion(fen, 'e7', 'e8')).toBe(true);
    expect(needsPromotion(fen, 'e1', 'e2')).toBe(false);
    expect(playMove(fen, 'e7e8n')).toMatchObject({ san: 'e8=N', uci: 'e7e8n' });
  });

  it('nhập thành giữ UCI kiểu vua đi hai ô', () => {
    const fen = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
    expect(playMove(fen, 'O-O')?.uci).toBe('e1g1');
    expect(playMove(fen, 'e1c1')?.san).toBe('O-O-O');
  });

  it('FEN và trạng thái ván', () => {
    expect(isValidFen(START_FEN)).toBe(true);
    expect(isValidFen('not a fen')).toBe(false);
    expect(sideToMove('8/8/8/8/8/8/8/k6K b - - 0 1')).toBe('b');
    expect(gameStatus('R5k1/5ppp/8/8/8/8/5PPP/6K1 b - - 1 1')).toBe('checkmate');
    expect(gameStatus('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1')).toBe('stalemate');
    expect(gameStatus('4k3/4Q3/4K3/8/8/8/8/8 b - - 0 1')).toBe('checkmate');
    expect(gameStatus('4k3/8/8/8/8/8/8/4K2R b K - 0 1')).toBe('ongoing');
    expect(gameStatus('4k3/8/8/8/8/8/8/4KR2 b - - 0 1')).toBe('ongoing');
    expect(gameStatus('4k3/8/8/8/8/8/8/4K3 w - - 0 1')).toBe('draw');
  });
});
