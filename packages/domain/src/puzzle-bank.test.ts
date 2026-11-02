import { describe, expect, it } from 'vitest';
import { PUZZLE_THEMES, pickSpread, puzzleThemeLabel } from './puzzle-bank';

describe('nhãn chủ đề', () => {
  it('có ~40 chủ đề phổ biến, khoá không trùng, mỗi chủ đề có nhãn vi và en', () => {
    expect(PUZZLE_THEMES.length).toBeGreaterThanOrEqual(30);
    const keys = PUZZLE_THEMES.map((t) => t.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const t of PUZZLE_THEMES) {
      expect(t.vi.length, t.key).toBeGreaterThan(0);
      expect(t.en.length, t.key).toBeGreaterThan(0);
    }
  });

  it('nhãn theo ngôn ngữ; chủ đề lạ hiện nguyên khoá', () => {
    expect(puzzleThemeLabel('fork', 'vi')).toBe('Đòn đôi (fork)');
    expect(puzzleThemeLabel('fork', 'en')).toBe('Fork');
    expect(puzzleThemeLabel('mateIn2', 'vi')).toBe('Chiếu hết 2 nước');
    expect(puzzleThemeLabel('chuDeLa', 'vi')).toBe('chuDeLa');
  });
});

describe('pickSpread: chọn trải đều rating', () => {
  const pool = Array.from({ length: 100 }, (_, i) => ({ id: i, rating: 600 + i * 20 }));
  const seeded = () => {
    let x = 12345;
    return () => {
      x = (x * 1103515245 + 12345) % 2147483648;
      return x / 2147483648;
    };
  };

  it('chọn đúng n puzzle, không trùng, xếp theo rating tăng dần', () => {
    const picked = pickSpread(pool, 10, seeded());
    expect(picked).toHaveLength(10);
    expect(new Set(picked.map((p) => p.id)).size).toBe(10);
    expect(picked.map((p) => p.rating)).toEqual(
      [...picked.map((p) => p.rating)].sort((a, b) => a - b),
    );
  });

  it('phân bố đều: mỗi dải rating (1/n khoảng) có đúng một puzzle', () => {
    const picked = pickSpread(pool, 10, seeded());
    const lo = 600;
    const hi = 600 + 99 * 20;
    const width = (hi - lo) / 10;
    const bands = picked.map((p) => Math.min(9, Math.floor((p.rating - lo) / width)));
    expect(bands).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('khác với lấy n puzzle đầu danh sách (không dồn về một đầu)', () => {
    const picked = pickSpread(pool, 5, seeded());
    expect(
      Math.max(...picked.map((p) => p.rating)) - Math.min(...picked.map((p) => p.rating)),
    ).toBeGreaterThan(1200);
  });

  it('ứng viên dồn cụm: dải rỗng thì bổ sung từ dải còn dư, vẫn đủ n và không trùng', () => {
    const clustered = [
      ...Array.from({ length: 20 }, (_, i) => ({ id: i, rating: 1000 + i })),
      { id: 99, rating: 2500 },
    ];
    const picked = pickSpread(clustered, 8, seeded());
    expect(picked).toHaveLength(8);
    expect(new Set(picked.map((p) => p.id)).size).toBe(8);
    expect(picked.some((p) => p.id === 99)).toBe(true);
  });

  it('n ≥ số ứng viên thì lấy hết; n ≤ 0 hoặc rỗng thì trả mảng rỗng; không sửa mảng gốc', () => {
    const small = [{ rating: 1500 }, { rating: 1000 }];
    expect(pickSpread(small, 10).map((p) => p.rating)).toEqual([1000, 1500]);
    expect(small.map((p) => p.rating)).toEqual([1500, 1000]);
    expect(pickSpread(small, 0)).toEqual([]);
    expect(pickSpread([], 5)).toEqual([]);
  });

  it('mọi ứng viên cùng rating vẫn chọn được n', () => {
    const same = Array.from({ length: 10 }, (_, i) => ({ id: i, rating: 1500 }));
    expect(pickSpread(same, 4, seeded())).toHaveLength(4);
  });
});

describe('nhãn chủ đề đủ cho dữ liệu đã nạp', () => {
  // Toàn bộ chủ đề gặp trong kho 149.680 puzzle đã nạp (73 khoá, 2026-11-02)
  const DATA_THEMES =
    `master veryLong kingsideAttack discoveredCheck masterVsMaster mateIn4 queensideAttack
    pillsburysMate operaMate queenRookEndgame attackingF2F7 mateIn5 epauletteMate enPassant collinearMove hookMate
    cornerMate morphysMate anastasiaMate swallowstailMate superGM arabianMate triangleMate killBoxMate blindSwineMate
    vukovicMate dovetailMate castling bodenMate doubleBishopMate balestraMate underPromotion`.split(
      /\s+/,
    );

  it('mọi chủ đề trong dữ liệu có nhãn tiếng Việt và tiếng Anh khác khoá', () => {
    for (const key of DATA_THEMES) {
      expect(puzzleThemeLabel(key, 'vi'), key).not.toBe(key);
      expect(puzzleThemeLabel(key, 'en'), key).not.toBe(key);
    }
    expect(puzzleThemeLabel('master', 'vi')).toBe('Ván cao thủ');
  });

  it('chip lọc không bị phình: các chủ đề phụ không nằm trong PUZZLE_THEMES', () => {
    const chips = new Set(PUZZLE_THEMES.map((t) => t.key));
    for (const key of DATA_THEMES) expect(chips.has(key), key).toBe(false);
  });

  it('chủ đề lạ vẫn hiện nguyên khoá', () => {
    expect(puzzleThemeLabel('chuaCoNhan', 'vi')).toBe('chuaCoNhan');
  });
});
