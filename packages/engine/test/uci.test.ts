import { describe, expect, it } from 'vitest';
import {
  formatScore,
  parseBestMove,
  parseInfo,
  parseOption,
  sideToMoveFromFen,
  toWhitePov,
} from '../src/uci';
import { outputLines } from './fixtures';

describe('parseInfo (log thật Arasan 26.1)', () => {
  it('đọc đủ 3 phương án MultiPV ở độ sâu cuối', () => {
    const infos = outputLines('arasan-26.1-analyse-multipv.log')
      .map(parseInfo)
      .filter((i) => i !== null);
    const last = infos.filter((i) => i.depth === 12);
    expect(last.map((i) => i.multipv)).toEqual([1, 2, 3]);
    expect(last[0]).toMatchObject({
      multipv: 1,
      depth: 12,
      score: { kind: 'cp', value: 38 },
      timeMs: 748,
      nodes: 82816,
      nps: 110716,
      hashfull: 9,
    });
    expect(last[0]?.pv.slice(0, 3)).toEqual(['g1f3', 'b8c6', 'f1b5']);
  });

  it('đọc điểm chiếu hết', () => {
    const infos = outputLines('arasan-26.1-mate.log')
      .map(parseInfo)
      .filter((i) => i !== null);
    expect(infos.at(-1)).toMatchObject({ score: { kind: 'mate', value: 1 }, pv: ['d1d8'] });
  });

  it('bỏ qua dòng không có PV và info string', () => {
    expect(parseInfo('info depth 12 currmove f1a6 currmovenumber 28')).toBeNull();
    expect(parseInfo('info string warning: opening book not found or invalid')).toBeNull();
    expect(parseInfo('readyok')).toBeNull();
  });

  it('đọc cận trên/dưới của điểm', () => {
    expect(parseInfo('info depth 5 score cp 20 lowerbound pv e2e4')).toMatchObject({
      score: { kind: 'cp', value: 20 },
      bound: 'lower',
    });
  });
});

describe('parseBestMove', () => {
  it('đọc nước tốt nhất và ponder', () => {
    expect(parseBestMove('bestmove d1d8')).toEqual({ move: 'd1d8' });
    expect(parseBestMove('bestmove e2e4 ponder e7e5')).toEqual({ move: 'e2e4', ponder: 'e7e5' });
    expect(parseBestMove('bestmove (none)')).toEqual({ move: null });
    expect(parseBestMove('info depth 1')).toBeNull();
  });
});

describe('parseOption', () => {
  const options = outputLines('arasan-26.1-uci.log')
    .map(parseOption)
    .filter((o) => o !== null);

  it('đọc đủ option của Arasan, kể cả tên có dấu cách', () => {
    const names = options.map((o) => o.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'Hash',
        'MultiPV',
        'Threads',
        'UCI_Elo',
        'NNUE file',
        'Book variety',
      ]),
    );
    expect(options.find((o) => o.name === 'UCI_Elo')).toEqual({
      name: 'UCI_Elo',
      type: 'spin',
      default: '3450',
      min: 1000,
      max: 3450,
    });
    expect(options.find((o) => o.name === 'Use tablebases')).toMatchObject({
      type: 'check',
      default: 'false',
    });
  });

  it('đọc option combo nhiều var', () => {
    expect(parseOption('option name Style type combo default Normal var Solid var Normal')).toEqual(
      { name: 'Style', type: 'combo', default: 'Normal', vars: ['Solid', 'Normal'] },
    );
  });
});

describe('điểm số', () => {
  it('Arasan in điểm theo bên đi: thế đen đi, đổi sang góc nhìn Trắng', () => {
    const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5Q2/PPPP1PPP/RNB1KBNR b KQkq - 1 2';
    const infos = outputLines('arasan-26.1-black-to-move.log')
      .map(parseInfo)
      .filter((i) => i !== null);
    const score = infos.at(-1)?.score;
    expect(score).toEqual({ kind: 'cp', value: 50 });
    expect(sideToMoveFromFen(fen)).toBe('b');
    expect(toWhitePov(score ?? { kind: 'cp', value: 0 }, 'b')).toEqual({ kind: 'cp', value: -50 });
  });

  it('formatScore', () => {
    expect(formatScore({ kind: 'cp', value: 38 })).toBe('+0.38');
    expect(formatScore({ kind: 'cp', value: -120 })).toBe('-1.20');
    expect(formatScore({ kind: 'cp', value: 0 })).toBe('0.00');
    expect(formatScore({ kind: 'mate', value: 3 })).toBe('#3');
    expect(formatScore({ kind: 'mate', value: -2 })).toBe('#-2');
  });
});

describe('whiteWinPercent (thanh đánh giá)', () => {
  it('cân bằng 50%, lợi thế lớn tiến gần 100%, chiếu hết là tuyệt đối', async () => {
    const { whiteWinPercent } = await import('../src/uci');
    expect(whiteWinPercent({ kind: 'cp', value: 0 })).toBe(50);
    expect(whiteWinPercent({ kind: 'cp', value: 300 })).toBeGreaterThan(70);
    expect(whiteWinPercent({ kind: 'cp', value: -300 })).toBeLessThan(30);
    expect(whiteWinPercent({ kind: 'cp', value: 5000 })).toBeLessThanOrEqual(100);
    expect(whiteWinPercent({ kind: 'mate', value: 3 })).toBe(100);
    expect(whiteWinPercent({ kind: 'mate', value: -2 })).toBe(0);
  });
});
