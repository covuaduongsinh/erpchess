import { describe, expect, it } from 'vitest';
import { glicko2Update, newRating } from '../src/glicko2';

describe('glicko2Update', () => {
  it('khớp ví dụ trong bài báo của Glickman', () => {
    const next = glicko2Update({ rating: 1500, rd: 200, vol: 0.06 }, [
      { rating: 1400, rd: 30, score: 1 },
      { rating: 1550, rd: 100, score: 0 },
      { rating: 1700, rd: 300, score: 0 },
    ]);
    expect(next.rating).toBeCloseTo(1464.06, 1);
    expect(next.rd).toBeCloseTo(151.52, 1);
    expect(next.vol).toBeCloseTo(0.05999, 4);
  });

  it('không đấu ván nào thì chỉ tăng RD', () => {
    const next = glicko2Update({ rating: 1500, rd: 200, vol: 0.06 }, []);
    expect(next.rating).toBe(1500);
    expect(next.rd).toBeGreaterThan(200);
    expect(next.vol).toBe(0.06);
  });

  it('thắng người mạnh hơn được cộng nhiều hơn thắng người yếu hơn', () => {
    const base = newRating();
    const vsStrong = glicko2Update(base, [{ rating: 1800, rd: 60, score: 1 }]);
    const vsWeak = glicko2Update(base, [{ rating: 1200, rd: 60, score: 1 }]);
    expect(vsStrong.rating - base.rating).toBeGreaterThan(vsWeak.rating - base.rating);
  });

  it('RD không vượt quá 350', () => {
    const next = glicko2Update({ rating: 1500, rd: 350, vol: 0.06 }, []);
    expect(next.rd).toBe(350);
  });
});
