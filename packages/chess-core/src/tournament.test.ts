import { describe, expect, it } from 'vitest';
import {
  pairSwiss,
  pairTeamSwiss,
  quadGroups,
  roundRobinRound,
  roundRobinRounds,
  standings,
  type TGame,
  type TPlayer,
} from './tournament';

const players = (n: number): TPlayer[] =>
  Array.from({ length: n }, (_, i) => ({ id: `p${i + 1}`, rating: 2000 - i * 50 }));

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Chơi hết giải Swiss với kết quả ngẫu nhiên (người rating cao thắng nhiều hơn). */
function simulate(n: number, rounds: number, seed: number): TGame[] {
  const ps = players(n);
  const rating = new Map(ps.map((p) => [p.id, p.rating]));
  const rand = rng(seed);
  const games: TGame[] = [];
  for (let r = 1; r <= rounds; r++) {
    const { pairs, bye } = pairSwiss(ps, games);
    expect(pairs.length).toBe(Math.floor(n / 2));
    expect(bye !== null).toBe(n % 2 === 1);
    const seen = new Set([...pairs.flatMap((p) => [p.white, p.black]), ...(bye ? [bye] : [])]);
    expect(seen.size).toBe(n);
    for (const p of pairs) {
      const x = rand() + ((rating.get(p.white) ?? 0) - (rating.get(p.black) ?? 0)) / 2000;
      games.push({
        round: r,
        white: p.white,
        black: p.black,
        result: x > 0.6 ? '1-0' : x < 0.3 ? '0-1' : '1/2-1/2',
      });
    }
    if (bye) games.push({ round: r, white: bye, black: null, result: '1-0' });
  }
  return games;
}

describe('pairSwiss', () => {
  it('vòng 1: nửa trên gặp nửa dưới, màu xen kẽ theo bàn', () => {
    const { pairs, bye } = pairSwiss(players(8), []);
    expect(bye).toBeNull();
    expect(pairs).toEqual([
      { white: 'p1', black: 'p5' },
      { white: 'p6', black: 'p2' },
      { white: 'p3', black: 'p7' },
      { white: 'p8', black: 'p4' },
    ]);
  });

  it.each([
    [8, 5, 1],
    [9, 5, 2],
    [12, 6, 3],
    [15, 7, 4],
    [20, 7, 5],
  ])('%i người, %i vòng: không gặp lại, bye không trùng, màu cân', (n, rounds, seed) => {
    const games = simulate(n, rounds, seed);
    const met = new Set<string>();
    for (const g of games) {
      if (!g.black) continue;
      const key = [g.white, g.black].sort().join('-');
      expect(met.has(key)).toBe(false);
      met.add(key);
    }
    const byes = games.filter((g) => g.black === null).map((g) => g.white);
    expect(new Set(byes).size).toBe(byes.length);
    for (const p of players(n)) {
      const colors = games
        .filter((g) => g.black && (g.white === p.id || g.black === p.id))
        .sort((a, b) => a.round - b.round)
        .map((g) => (g.white === p.id ? 'w' : 'b'));
      const diff = colors.filter((c) => c === 'w').length - colors.filter((c) => c === 'b').length;
      expect(Math.abs(diff)).toBeLessThanOrEqual(2);
      expect(colors.join('')).not.toMatch(/www|bbb/);
    }
  });

  it('người cùng điểm gặp nhau trước', () => {
    const ps = players(4);
    const r1: TGame[] = [
      { round: 1, white: 'p1', black: 'p3', result: '1-0' },
      { round: 1, white: 'p4', black: 'p2', result: '0-1' },
    ];
    const { pairs } = pairSwiss(ps, r1);
    const key = (p: { white: string; black: string }) => [p.white, p.black].sort().join('-');
    expect(pairs.map(key).sort()).toEqual(['p1-p2', 'p3-p4']);
  });
});

describe('roundRobinRound', () => {
  it.each([4, 5, 6, 7])('%i người: mỗi cặp gặp đúng một lần', (n) => {
    const ps = players(n);
    const met = new Map<string, number>();
    const byes: string[] = [];
    for (let r = 1; r <= roundRobinRounds(n); r++) {
      const { pairs, bye } = roundRobinRound(ps, r);
      if (bye) byes.push(bye);
      for (const p of pairs) {
        const key = [p.white, p.black].sort().join('-');
        met.set(key, (met.get(key) ?? 0) + 1);
      }
    }
    expect(met.size).toBe((n * (n - 1)) / 2);
    expect([...met.values()].every((c) => c === 1)).toBe(true);
    // Số lẻ: mỗi vòng một người nghỉ, mỗi người nghỉ đúng một lần
    expect(byes.length).toBe(n % 2 === 1 ? n : 0);
    expect(new Set(byes).size).toBe(byes.length);
  });
});

describe('quadGroups', () => {
  it.each([
    [4, [4]],
    [5, [5]],
    [9, [4, 5]],
    [10, [4, 3, 3]],
    [11, [4, 4, 3]],
    [12, [4, 4, 4]],
  ])('%i người → nhóm %j', (n, sizes) => {
    const groups = quadGroups(players(n));
    expect(groups.map((g) => g.length)).toEqual(sizes);
    expect(groups[0]?.[0]?.id).toBe('p1');
  });
});

describe('pairTeamSwiss', () => {
  it('ghép đội và đổi màu theo bàn', () => {
    const teams = [
      { id: 'A', rating: 2000, members: ['a1', 'a2'] },
      { id: 'B', rating: 1900, members: ['b1', 'b2'] },
      { id: 'C', rating: 1800, members: ['c1', 'c2'] },
      { id: 'D', rating: 1700, members: ['d1', 'd2'] },
    ];
    const r = pairTeamSwiss(teams, [], 2);
    expect(r.matches).toEqual([
      { a: 'A', b: 'C' },
      { a: 'D', b: 'B' },
    ]);
    expect(r.games).toEqual([
      { white: 'a1', black: 'c1', board: 1 },
      { white: 'c2', black: 'a2', board: 2 },
      { white: 'd1', black: 'b1', board: 1 },
      { white: 'b2', black: 'd2', board: 2 },
    ]);
    // Vòng 2: A thắng C, B thắng D → A gặp B
    const r2 = pairTeamSwiss(
      teams,
      [
        { round: 1, a: 'A', b: 'C', aPoints: 1.5, bPoints: 0.5 },
        { round: 1, a: 'D', b: 'B', aPoints: 0, bPoints: 2 },
      ],
      2,
    );
    expect(r2.matches.map((m) => [m.a, m.b].sort().join('-')).sort()).toEqual(['A-B', 'C-D']);
  });
});

describe('standings', () => {
  it('điểm, Buchholz, Sonneborn-Berger, bye không tính Buchholz', () => {
    const ps = players(3);
    const games: TGame[] = [
      { round: 1, white: 'p1', black: 'p2', result: '1-0' },
      { round: 1, white: 'p3', black: null, result: '1-0' },
      { round: 2, white: 'p3', black: 'p1', result: '1/2-1/2' },
      { round: 2, white: 'p2', black: null, result: '1-0' },
    ];
    const s = standings(ps, games);
    // Bằng điểm: p1 hơn p3 nhờ Buchholz cắt 1 (p3 chỉ có một ván thật)
    expect(s.map((r) => [r.id, r.points])).toEqual([
      ['p1', 1.5],
      ['p3', 1.5],
      ['p2', 1],
    ]);
    const p1 = s.find((r) => r.id === 'p1');
    expect(p1).toMatchObject({ buchholz: 2.5, sonneborn: 1 + 0.75, wins: 1, played: 2 });
    expect(s.find((r) => r.id === 'p3')).toMatchObject({ buchholz: 1.5, played: 1 });
  });
});
