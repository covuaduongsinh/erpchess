import { describe, expect, it } from 'vitest';
import {
  consumeGames,
  decodeLines,
  fixMojibake,
  isEngineGame,
  newStats,
  rejectByHeaders,
} from '../scripts/masterbase-lib.mjs';

/** Chữ UTF-8 bị đọc thành Latin-1 rồi mã hoá lại, như PGN broadcast của Lichess. */
const doubleEncode = (s) => Buffer.from(s, 'utf8').toString('latin1');

async function collect(it) {
  const out = [];
  for await (const x of it) out.push(x);
  return out;
}

const pgn = (h, moves = '1. e4 e5 2. Nf3 Nc6 1-0') =>
  `${Object.entries({ Result: '1-0', ...h })
    .map(([k, v]) => `[${k} "${v}"]`)
    .join('\n')}\n\n${moves}\n`;

describe('isEngineGame / rejectByHeaders', () => {
  it('nhận ra TCEC ở Event hoặc Site (không phân biệt hoa thường) và Elo > 3000', () => {
    expect(isEngineGame({ Event: 'TCEC Season 30 - HCE', Site: 'tcec-chess.com' })).toBe(true);
    expect(
      isEngineGame({ Event: 'Giải', Site: 'https://lichess.org/broadcast/tcec-s29/x/y' }),
    ).toBe(true);
    expect(isEngineGame({ Event: 'Open', Site: 'HN', WhiteElo: '2900', BlackElo: '3001' })).toBe(
      true,
    );
    expect(isEngineGame({ Event: 'Open', Site: 'HN', WhiteElo: '3244', BlackElo: '2900' })).toBe(
      true,
    );
  });

  it('không bắt nhầm người thật: Elo cao nhất 2840, "ccc/bot" chỉ là chuỗi con trong URL', () => {
    expect(
      isEngineGame({ Event: 'Sigeman', Site: 'Malmö', WhiteElo: '2840', BlackElo: '2780' }),
    ).toBe(false);
    expect(
      isEngineGame({ Event: 'Round 5: A - B', Site: 'https://lichess.org/broadcast/x/VCCCSSaq' }),
    ).toBe(false);
    expect(isEngineGame({ Event: 'Open' })).toBe(false);
    expect(isEngineGame({ Event: 'Open', WhiteElo: '3000', BlackElo: '3000' })).toBe(false);
  });

  it('rejectByHeaders trả "engine" (sau "result", trước "elo"); includeEngines giữ lại', () => {
    const h = { Result: '1-0', Event: 'TCEC S30', WhiteElo: '3300', BlackElo: '3200' };
    expect(rejectByHeaders(h, { minElo: 2300 })).toBe('engine');
    expect(rejectByHeaders(h, { minElo: 2300, includeEngines: true })).toBeNull();
    expect(rejectByHeaders({ ...h, Result: '*' }, { minElo: 2300 })).toBe('result');
    expect(
      rejectByHeaders(
        { ...h, Event: 'Open', WhiteElo: '2400', BlackElo: '2200' },
        { minElo: 2300 },
      ),
    ).toBe('elo');
  });

  it('consumeGames bỏ ván engine, thống kê riêng, và giữ khi includeEngines', async () => {
    const games = () => [
      pgn({
        White: 'An',
        Black: 'Bình',
        WhiteElo: '2600',
        BlackElo: '2500',
        Event: 'Open',
        Date: '2026.10.01',
      }),
      pgn({
        White: 'Stash 37.24',
        Black: 'c4ke 3.0',
        WhiteElo: '3244',
        BlackElo: '3250',
        Event: 'TCEC Season 30',
        Site: 'tcec-chess.com',
        Date: '2026.10.02',
      }),
      pgn({
        White: 'E1',
        Black: 'E2',
        WhiteElo: '2900',
        BlackElo: '2950',
        Event: 'x',
        Site: 'https://lichess.org/broadcast/tcec-s29/a',
        Date: '2026.10.03',
      }),
    ];
    const run = async (includeEngines) => {
      const stats = newStats();
      const got = [];
      await consumeGames(games(), {
        minElo: 2300,
        minMoves: 1,
        seen: new Set(),
        stats,
        includeEngines,
        onAccept: (p) => got.push(p),
      });
      return { stats, got };
    };
    const a = await run(false);
    expect(a.got.map((p) => p.headers.White)).toEqual(['An']);
    expect(a.stats.rejected.engine).toBe(2);
    const b = await run(true);
    expect(b.got).toHaveLength(3);
    expect(b.stats.rejected.engine).toBe(0);
  });
});

describe('fixMojibake', () => {
  it('sửa chữ mã hoá kép (Trung Quốc, tiếng Việt, Pháp)', () => {
    for (const s of ['2026年全国国际象棋', 'Nguyễn Hoàng', 'Café Müller']) {
      const bad = doubleEncode(s);
      expect(bad).not.toBe(s);
      expect(fixMojibake(bad)).toBe(s);
    }
  });

  it('giữ nguyên chữ đúng: ASCII, UTF-8 đúng, Latin-1 hợp lệ không có dấu hiệu kép, và dòng có ký tự ngoài Latin-1', () => {
    for (const s of [
      'Open 2026',
      '2026年全国',
      'Mendonça',
      'Ñandú',
      `${doubleEncode('é')} và 年`,
    ]) {
      expect(fixMojibake(s)).toBe(s);
    }
  });

  it('không sửa khi kết quả sẽ có ký tự thay thế', () => {
    const broken = 'Ãÿ'; // Ã + ÿ không phải chuỗi UTF-8 hợp lệ
    expect(fixMojibake(broken)).toBe(broken);
  });

  it('chỉ sửa dòng hỏng của ván, giữ nguyên các dòng khác', () => {
    const text = `[Event "${doubleEncode('2026年')}"]\n[White "Carlsen, Magnus"]\n\n1. e4 e5 1-0`;
    expect(fixMojibake(text)).toBe('[Event "2026年"]\n[White "Carlsen, Magnus"]\n\n1. e4 e5 1-0');
  });

  it('consumeGames sửa mã hoá kép trong tag và PGN lưu', async () => {
    const stats = newStats();
    const got = [];
    await consumeGames(
      [
        pgn({
          White: 'An',
          Black: 'Bình',
          WhiteElo: '2600',
          BlackElo: '2500',
          Event: doubleEncode('2026年全国'),
          Date: '2026.10.01',
        }),
      ],
      { minElo: 2300, minMoves: 1, seen: new Set(), stats, onAccept: (p) => got.push(p) },
    );
    expect(got[0].headers.Event).toBe('2026年全国');
    expect(got[0].pgn).toContain('[Event "2026年全国"]');
  });
});

describe('decodeLines', () => {
  it('UTF-8 hợp lệ giữ nguyên; dòng Latin-1 thô được giải mã đúng thay vì ra U+FFFD; bỏ CR', async () => {
    const bytes = Buffer.concat([
      Buffer.from('[Event "2026年"]\r\n', 'utf8'),
      Buffer.from('[Event "1', 'utf8'),
      Buffer.from([0xaa]), // ª trong Latin-1
      Buffer.from(' Divis', 'utf8'),
      Buffer.from([0xe3]), // ã trong Latin-1
      Buffer.from('o"]\n', 'utf8'),
      Buffer.from('dòng cuối không xuống dòng', 'utf8'),
    ]);
    const lines = await collect(decodeLines([bytes]));
    expect(lines).toEqual([
      '[Event "2026年"]',
      '[Event "1ª Divisão"]',
      'dòng cuối không xuống dòng',
    ]);
  });

  it('chuỗi nhiều byte bị cắt giữa hai chunk vẫn đúng', async () => {
    const all = Buffer.from('Nguyễn Hoàng\nkế tiếp\n', 'utf8');
    for (const cut of [1, 5, 9, 10, 14]) {
      const lines = await collect(decodeLines([all.subarray(0, cut), all.subarray(cut)]));
      expect(lines).toEqual(['Nguyễn Hoàng', 'kế tiếp']);
    }
  });
});
