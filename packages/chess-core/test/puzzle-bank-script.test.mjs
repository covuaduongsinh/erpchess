import { describe, expect, it } from 'vitest';
import { parseArgs } from '../../../scripts/puzzle-bank-import.mjs';
import {
  allocateQuotas,
  hash01,
  parsePuzzleLine,
  pgArray,
  puzzleRow,
  rejectPuzzle,
  selected,
  stratumOf,
} from '../scripts/puzzle-bank-lib.mjs';

const LINE =
  '00sHx,q3k1nr/1pp1nQpp/3p4/1P2p3/4P3/B1PP1b2/B5PP/5K2 b k - 0 17,e8d7 a2e6 d7d8 f7f8,1760,80,83,72,mate mateIn2 middlegame short,https://lichess.org/yyznGmXs/black#34,Italian_Game Italian_Game_Classical_Variation';
const FILTER = { minPopularity: 80, minPlays: 200, maxRd: 90 };

describe('parsePuzzleLine', () => {
  it('đọc đủ trường, chủ đề và khai cuộc tách theo dấu cách', () => {
    const p = parsePuzzleLine(LINE);
    expect(p).toMatchObject({ id: '00sHx', rating: 1760, rd: 80, popularity: 83, nbPlays: 72 });
    expect(p?.themes).toEqual(['mate', 'mateIn2', 'middlegame', 'short']);
    expect(p?.opening).toEqual(['Italian_Game', 'Italian_Game_Classical_Variation']);
  });

  it('bỏ dòng tiêu đề và dòng thiếu trường', () => {
    expect(
      parsePuzzleLine(
        'PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags',
      ),
    ).toBeNull();
    expect(parsePuzzleLine('a,b,c')).toBeNull();
    expect(parsePuzzleLine('')).toBeNull();
  });

  it('không có khai cuộc thì mảng rỗng', () => {
    const p = parsePuzzleLine('x1,8/8/8/8/8/8/8/K6k w - - 0 1,a1a2 h1h2,1500,70,90,500,mate,url,');
    expect(p?.opening).toEqual([]);
  });
});

describe('rejectPuzzle: lọc chất lượng và hình thức', () => {
  const base = { ...(parsePuzzleLine(LINE) ?? {}), popularity: 90, nbPlays: 500, rd: 70 };
  it('đạt khi đủ phổ biến, đủ lượt chơi, RD thấp, lời giải hợp lệ', () => {
    expect(rejectPuzzle(base, FILTER)).toBeNull();
  });
  it('loại từng lý do', () => {
    expect(rejectPuzzle({ ...base, popularity: 60 }, FILTER)).toBe('popularity');
    expect(rejectPuzzle({ ...base, nbPlays: 100 }, FILTER)).toBe('plays');
    expect(rejectPuzzle({ ...base, rd: 150 }, FILTER)).toBe('rd');
    expect(rejectPuzzle({ ...base, moves: 'e8d7' }, FILTER)).toBe('moves');
    expect(rejectPuzzle({ ...base, moves: 'e8d7 zz' }, FILTER)).toBe('moves');
    expect(rejectPuzzle({ ...base, moves: 'e8d7 a2e6 d7d8' }, FILTER)).toBe('length'); // lời giải 2 nước (chẵn)
    expect(rejectPuzzle({ ...base, fen: 'ngan' }, FILTER)).toBe('fen');
    expect(rejectPuzzle({ ...base, rating: 50 }, FILTER)).toBe('rating');
  });
  it('lời giải quá dài (> 39 nước) bị loại', () => {
    const long = ['e8d7', ...Array.from({ length: 40 }, () => 'a2e6')].join(' ');
    expect(rejectPuzzle({ ...base, moves: long }, FILTER)).toBe('length');
  });
});

describe('phân tầng và hạn ngạch', () => {
  it('tầng = dải rating 200 × chủ đề chính theo thứ tự ưu tiên', () => {
    expect(stratumOf({ rating: 1760, themes: ['mate', 'mateIn2', 'middlegame'] })).toBe(
      '1600|mateIn2',
    );
    expect(stratumOf({ rating: 1999, themes: ['pin', 'fork'] })).toBe('1800|fork'); // fork ưu tiên hơn pin
    expect(stratumOf({ rating: 400, themes: ['crushing'] })).toBe('400|other');
  });

  it('allocateQuotas: tổng đúng mục tiêu, làm phẳng theo căn bậc hai, không vượt số có', () => {
    const counts = new Map([
      ['a', 1_000_000],
      ['b', 10_000],
      ['c', 100],
      ['d', 5],
    ]);
    const q = allocateQuotas(counts, 10_000);
    for (const [k, c] of counts) expect(q.get(k)).toBeLessThanOrEqual(c);
    expect(q.get('d')).toBe(5); // tầng hiếm lấy hết
    expect(q.get('c')).toBeGreaterThan(80); // gần như lấy hết
    const total = [...q.values()].reduce((a, b) => a + b, 0);
    expect(Math.abs(total - 10_000)).toBeLessThanOrEqual(5);
    // làm phẳng: tầng lớn gấp 100 lần không được nhiều gấp 100 lần
    expect((q.get('a') ?? 0) / (q.get('b') ?? 1)).toBeLessThan(20);
  });

  it('mục tiêu ≥ tổng số puzzle thì lấy hết', () => {
    const counts = new Map([
      ['a', 3],
      ['b', 4],
    ]);
    expect([...allocateQuotas(counts, 100).entries()]).toEqual([
      ['a', 3],
      ['b', 4],
    ]);
  });

  it('chọn bằng băm: xác định, số lượng xấp xỉ hạn ngạch, tầng đủ thì chọn hết', () => {
    const items = Array.from({ length: 20_000 }, (_, i) => ({
      id: `id${i}`,
      rating: 1500,
      themes: ['fork'],
    }));
    const counts = new Map([['1400|fork', 20_000]]);
    const quotas = new Map([['1400|fork', 2_000]]);
    // rating 1500 → dải 1400
    const n1 = items.filter((p) => selected(p, counts, quotas, 1)).length;
    const n2 = items.filter((p) => selected(p, counts, quotas, 1)).length;
    expect(n1).toBe(n2);
    expect(Math.abs(n1 - 2_000)).toBeLessThan(200);
    expect(
      items.filter((p) => selected(p, counts, new Map([['1400|fork', 20_000]]), 1)),
    ).toHaveLength(20_000);
    expect(selected(items[0], new Map(), quotas, 1)).toBe(false);
  });

  it('hash01 trong [0,1) và phụ thuộc seed', () => {
    for (const id of ['a', 'bb', 'ccc']) {
      const h = hash01(id, 1);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
    }
    expect(hash01('abc', 1)).not.toBe(hash01('abc', 2));
  });
});

describe('xuất CSV', () => {
  it('mảng Postgres và dòng CSV đúng định dạng \\copy (mảng có dấu phẩy được bao nháy)', () => {
    expect(pgArray(['fork', 'mateIn2'])).toBe('{fork,mateIn2}');
    expect(pgArray(['ok', 'bad one', 'x"y'])).toBe('{ok}');
    expect(pgArray([])).toBe('{}');
    const p = parsePuzzleLine(LINE);
    if (!p) throw new Error('dòng mẫu phải đọc được');
    const row = puzzleRow(p, 'Nguồn (CC0)');
    expect(row).toBe(
      '00sHx,q3k1nr/1pp1nQpp/3p4/1P2p3/4P3/B1PP1b2/B5PP/5K2 b k - 0 17,e8d7 a2e6 d7d8 f7f8,1760,80,83,72,"{mate,mateIn2,middlegame,short}","{Italian_Game,Italian_Game_Classical_Variation}",Nguồn (CC0)\n',
    );
  });

  it('giá trị ngoài miền bị kẹp về khoảng hợp lệ của bảng', () => {
    const p = {
      id: 'zzz1',
      fen: '8/8/8/8/8/8/8/K6k w - - 0 1',
      moves: 'a1a2 h1h2',
      rating: 1500.4,
      rd: 5000,
      popularity: -300,
      nbPlays: -5,
      themes: [],
      opening: [],
    };
    expect(puzzleRow(p, 'S (CC0)')).toBe(
      'zzz1,8/8/8/8/8/8/8/K6k w - - 0 1,a1a2 h1h2,1500,1000,-100,0,{},{},S (CC0)\n',
    );
  });
});

describe('tham số dòng lệnh', () => {
  it('mặc định theo kế hoạch và ghi đè được; giá trị sai thì lỗi', () => {
    expect(parseArgs([])).toMatchObject({
      target: 150000,
      minPopularity: 80,
      minPlays: 200,
      maxRd: 90,
      seed: 1,
      dryRun: false,
      out: 'out/puzzle-bank',
    });
    expect(parseArgs(['--target', '1000', '--dry-run', '--min-plays', '0'])).toMatchObject({
      target: 1000,
      dryRun: true,
      minPlays: 0,
    });
    expect(() => parseArgs(['--target', '0'])).toThrow();
    expect(() => parseArgs(['--target', 'abc'])).toThrow();
  });
});
