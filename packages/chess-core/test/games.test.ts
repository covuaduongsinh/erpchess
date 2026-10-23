import { describe, expect, it } from 'vitest';
import { gameSummary, splitPgn } from '../src/games';
import { parsePgn } from '../src/pgn';

const TWO = `[Event "Giải CLB"]
[White "An"]
[Black "Bình"]
[Result "1-0"]
[WhiteElo "1450"]
[BlackElo "?"]
[Date "2026.10.01"]
[ECO "C50"]

1. e4 e5 2. Nf3 Nc6 3. Bc4 { Ý } Bc5 1-0

[Event "Giải CLB"]
[White "Cường"]
[Black "Dũng"]
[Result "*"]

1. d4 d5 *
`;

describe('splitPgn', () => {
  it('tách từng ván, giữ nguyên tag', () => {
    const games = splitPgn(TWO);
    expect(games).toHaveLength(2);
    expect(games[1]?.startsWith('[Event "Giải CLB"]\n[White "Cường"]')).toBe(true);
  });

  it('một ván hỏng không kéo theo ván khác', () => {
    const games = splitPgn(`${TWO}\n[White "X"]\n\n1. e4 e4 *\n`);
    expect(games).toHaveLength(3);
    expect(() => parsePgn(games[2] ?? '')).toThrow();
    expect(parsePgn(games[0] ?? '')).toHaveLength(1);
  });

  it('văn bản trống', () => {
    expect(splitPgn('\n\n')).toEqual([]);
  });
});

describe('gameSummary', () => {
  it('rút thông tin tiêu đề và số nửa nước', () => {
    const [tree] = parsePgn(TWO);
    expect(tree && gameSummary(tree)).toEqual({
      white: 'An',
      black: 'Bình',
      result: '1-0',
      event: 'Giải CLB',
      site: '',
      date: '2026.10.01',
      eco: 'C50',
      whiteElo: 1450,
      blackElo: null,
      plyCount: 6,
      startFen: null,
    });
  });

  it('ván bắt đầu từ FEN', () => {
    const [tree] = parsePgn(
      '[FEN "6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1"]\n[SetUp "1"]\n\n1. Rd8# 1-0',
    );
    expect(tree && gameSummary(tree)).toMatchObject({
      startFen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1',
      plyCount: 1,
      white: '',
    });
  });
});
