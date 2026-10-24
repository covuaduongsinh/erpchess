import { describe, expect, it } from 'vitest';
import { categoryOf, clockAfterMove, flagged, remaining, startClock } from './clock';
import { formatPgn, lossFor, replayGame, resultOf } from './game';
import { START_FEN } from './rules';

describe('replayGame', () => {
  it('chiếu hết (Scholar mate) → Trắng thắng', () => {
    const r = replayGame(START_FEN, ['e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5', 'g8f6', 'h5f7']);
    expect(r).toMatchObject({ status: 'checkmate', turn: 'b' });
    expect(r?.sans.at(-1)).toBe('Qxf7#');
    expect(resultOf('checkmate', 'b')).toBe('1-0');
  });
  it('lặp lại 3 lần', () => {
    const shuffle = ['g1f3', 'g8f6', 'f3g1', 'f6g8'];
    expect(replayGame(START_FEN, shuffle)?.status).toBe('ongoing');
    expect(replayGame(START_FEN, [...shuffle, ...shuffle])?.status).toBe('repetition');
  });
  it('thiếu quân chiếu hết và nước sai', () => {
    expect(replayGame('8/8/8/8/8/8/4k3/K6n w - - 0 1', [])?.status).toBe('insufficient');
    expect(replayGame(START_FEN, ['e2e5'])).toBeNull();
    expect(replayGame(START_FEN, ['xx'])).toBeNull();
  });
  it('kết quả thua', () => {
    expect(lossFor('w')).toBe('0-1');
    expect(lossFor('b')).toBe('1-0');
  });
});

describe('formatPgn', () => {
  it('thế chuẩn và thế tuỳ chỉnh Đen đi trước', () => {
    expect(
      formatPgn({
        headers: { White: 'A', Black: 'B' },
        initialFen: START_FEN,
        sans: ['e4', 'e5', 'Nf3'],
        result: '*',
      }),
    ).toBe('[White "A"]\n[Black "B"]\n[Result "*"]\n\n1. e4 e5 2. Nf3 *\n');
    const fen = '4k3/8/8/8/8/8/4P3/4K3 b - - 0 10';
    const pgn = formatPgn({ headers: {}, initialFen: fen, sans: ['Kd7', 'e4'], result: '1/2-1/2' });
    expect(pgn).toContain('[SetUp "1"]');
    expect(pgn).toContain('10... Kd7 11. e4 1/2-1/2');
  });
});

describe('clock', () => {
  const tc = { baseMs: 180_000, incMs: 2_000 };
  it('hai nước đầu không trừ giờ, sau đó trừ và cộng increment', () => {
    let c = startClock(tc);
    c = clockAfterMove(c, 'w', 0, 1_000, tc.incMs);
    expect(c).toEqual({ whiteMs: 180_000, blackMs: 180_000, turnStartedAt: null });
    c = clockAfterMove(c, 'b', 1, 5_000, tc.incMs);
    expect(c).toEqual({ whiteMs: 180_000, blackMs: 180_000, turnStartedAt: 5_000 });
    c = clockAfterMove(c, 'w', 2, 15_000, tc.incMs);
    expect(c.whiteMs).toBe(180_000 - 10_000 + 2_000);
    expect(remaining(c, 'b', 'b', 20_000)).toBe(175_000);
    expect(remaining(c, 'w', 'b', 20_000)).toBe(172_000);
  });
  it('hết giờ', () => {
    const c = { whiteMs: 1_000, blackMs: 5_000, turnStartedAt: 0 };
    expect(flagged(c, 'w', 999)).toBe(false);
    expect(flagged(c, 'w', 1_000)).toBe(true);
  });
  it('phân loại rating', () => {
    expect(categoryOf({ baseMs: 180_000, incMs: 2_000 })).toBe('blitz');
    expect(categoryOf({ baseMs: 600_000, incMs: 0 })).toBe('rapid');
    expect(categoryOf({ baseMs: 900_000, incMs: 10_000 })).toBe('rapid');
    expect(categoryOf({ baseMs: 3_600_000, incMs: 0 })).toBe('classical');
  });
});
