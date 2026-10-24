// Tự sinh bởi supabase/functions/sync-shared.mjs từ packages/chess-core/src/tournament.ts — không sửa tay.
/**
 * Ghép cặp và bảng xếp hạng giải đấu (hàm thuần, chạy được ở client lẫn Edge Function).
 *
 * Swiss theo "Dutch rút gọn": nhóm điểm, nửa trên gặp nửa dưới, không gặp lại, cân màu (lệch tối
 * đa 2, không 3 ván liền cùng màu), người lẻ được đẩy xuống nhóm dưới, bye cho người thấp nhất
 * chưa từng nhận bye. Không cài đủ mọi luật chuyển vị của FIDE C.04.3; đủ cho giải nội bộ CLB.
 */
import type { Color } from './rules.ts';

export type TPlayer = { id: string; rating: number };
/** Một ván đã ghép; bye ghi là `black = null` (được 1 điểm, không tính màu). */
export type TGame = {
  round: number;
  white: string;
  black: string | null;
  result: '1-0' | '0-1' | '1/2-1/2' | null;
};
export type Pairing = { white: string; black: string };
export type RoundPairing = { pairs: Pairing[]; bye: string | null };

type Info = {
  id: string;
  rating: number;
  score: number;
  colors: Color[];
  opponents: Set<string>;
  hadBye: boolean;
};

function pointsFor(id: string, g: TGame): number {
  if (g.black === null) return g.white === id ? 1 : 0;
  if (g.result === '1/2-1/2') return 0.5;
  if (g.result === '1-0') return g.white === id ? 1 : 0;
  if (g.result === '0-1') return g.black === id ? 1 : 0;
  return 0;
}

function infos(players: readonly TPlayer[], games: readonly TGame[]): Map<string, Info> {
  const map = new Map<string, Info>();
  for (const p of players) {
    map.set(p.id, { ...p, score: 0, colors: [], opponents: new Set(), hadBye: false });
  }
  for (const g of [...games].sort((a, b) => a.round - b.round)) {
    const w = map.get(g.white);
    if (g.black === null) {
      if (w) {
        w.hadBye = true;
        w.score += 1;
      }
      continue;
    }
    const b = map.get(g.black);
    if (w) {
      w.colors.push('w');
      w.opponents.add(g.black);
      w.score += pointsFor(g.white, g);
    }
    if (b) {
      b.colors.push('b');
      b.opponents.add(g.white);
      b.score += pointsFor(g.black, g);
    }
  }
  return map;
}

/** Màu nên nhận và có bắt buộc không (lệch ≥ 2 hoặc hai ván gần nhất cùng màu). */
function colorPref(p: Info): { pref: Color | null; absolute: boolean } {
  const diff = p.colors.filter((c) => c === 'w').length - p.colors.filter((c) => c === 'b').length;
  const last = p.colors.at(-1);
  const twoSame = p.colors.length >= 2 && p.colors.at(-2) === last;
  if (diff >= 2 || (twoSame && last === 'w')) return { pref: 'b', absolute: true };
  if (diff <= -2 || (twoSame && last === 'b')) return { pref: 'w', absolute: true };
  if (diff > 0) return { pref: 'b', absolute: false };
  if (diff < 0) return { pref: 'w', absolute: false };
  if (last) return { pref: last === 'w' ? 'b' : 'w', absolute: false };
  return { pref: null, absolute: false };
}

/** Chia màu cho cặp (a xếp trên b); `null` nếu cả hai bắt buộc cùng một màu. */
function assignColors(a: Info, b: Info, board: number): Pairing | null {
  const pa = colorPref(a);
  const pb = colorPref(b);
  if (pa.absolute && pb.absolute && pa.pref === pb.pref) return null;
  let aWhite: boolean;
  if (pa.absolute) aWhite = pa.pref === 'w';
  else if (pb.absolute) aWhite = pb.pref === 'b';
  else if (pa.pref && pb.pref && pa.pref !== pb.pref) aWhite = pa.pref === 'w';
  else if (pa.pref) aWhite = pa.pref === 'w';
  else if (pb.pref) aWhite = pb.pref === 'b';
  else aWhite = board % 2 === 0; // vòng đầu: bàn lẻ người xếp trên cầm Trắng
  return aWhite ? { white: a.id, black: b.id } : { white: b.id, black: a.id };
}

const byRank = (a: Info, b: Info) =>
  b.score - a.score || b.rating - a.rating || a.id.localeCompare(b.id);

/**
 * Tìm cách ghép toàn bộ danh sách (đã xếp hạng) bằng tìm kiếm quay lui: người xếp trên cùng chọn
 * đối thủ theo thứ tự Dutch (cùng nhóm điểm, ưu tiên vị trí "nửa dưới" tương ứng; hết thì xuống
 * nhóm dưới). `strictColors` = không cho hai người cùng bắt buộc một màu gặp nhau.
 */
function search(
  list: Info[],
  strictColors: boolean,
  budget: { n: number },
  board = 0,
): Pairing[] | null {
  if (list.length === 0) return [];
  if (--budget.n < 0) return null;
  const [p, ...rest] = list as [Info, ...Info[]];
  const same = rest.filter((x) => x.score === p.score);
  const lower = rest.filter((x) => x.score !== p.score);
  const groupSize = same.length + 1;
  const ideal = Math.floor(groupSize / 2) - 1; // chỉ số trong `same`
  const sameOrdered = same
    .map((x, i) => ({ x, i }))
    .sort((a, b) => {
      const da = a.i - ideal;
      const db = b.i - ideal;
      // ưu tiên đúng vị trí, rồi đi xuống trong nửa dưới, sau cùng mới lên nửa trên
      const ka = da >= 0 ? da * 2 : -da * 2 + 1;
      const kb = db >= 0 ? db * 2 : -db * 2 + 1;
      return ka - kb;
    })
    .map((o) => o.x);
  for (const q of [...sameOrdered, ...lower]) {
    if (p.opponents.has(q.id)) continue;
    const pair = assignColors(p, q, board);
    if (!pair && strictColors) continue;
    const tail = search(
      rest.filter((x) => x !== q),
      strictColors,
      budget,
      board + 1,
    );
    if (tail) return [pair ?? { white: p.id, black: q.id }, ...tail];
  }
  return null;
}

/** Ghép một vòng Swiss (Dutch rút gọn). `players` là người còn thi đấu (đã bỏ người rút lui). */
export function pairSwiss(players: readonly TPlayer[], games: readonly TGame[]): RoundPairing {
  const all = [...infos(players, games).values()].sort(byRank);
  // Ứng viên bye: điểm thấp nhất, rating thấp nhất, chưa từng nhận bye
  const byeCandidates =
    all.length % 2 === 1
      ? [...all].reverse().sort((a, b) => Number(a.hadBye) - Number(b.hadBye))
      : [null];
  for (const strict of [true, false]) {
    for (const bye of byeCandidates) {
      const list = bye ? all.filter((x) => x !== bye) : all;
      const pairs = search(list, strict, { n: 200_000 });
      if (pairs) return { pairs, bye: bye?.id ?? null };
    }
  }
  // Không còn cách nào tránh gặp lại (giải quá nhiều vòng so với số người): ghép theo thứ hạng
  const bye = all.length % 2 === 1 ? (all.at(-1)?.id ?? null) : null;
  const list = all.filter((x) => x.id !== bye);
  const pairs: Pairing[] = [];
  for (let i = 0; i + 1 < list.length; i += 2) {
    pairs.push({ white: (list[i] as Info).id, black: (list[i + 1] as Info).id });
  }
  return { pairs, bye };
}

/**
 * Vòng tròn theo bảng Berger: `round` tính từ 1, tổng `n − 1` vòng (n chẵn; lẻ thì thêm "nghỉ").
 * `players` theo thứ tự hạt giống.
 */
export function roundRobinRound(players: readonly TPlayer[], round: number): RoundPairing {
  const ids: (string | null)[] = players.map((p) => p.id);
  if (ids.length % 2 === 1) ids.push(null);
  const n = ids.length;
  const fixed = ids[n - 1] ?? null;
  const rotating = ids.slice(0, n - 1);
  const shift = ((round - 1) * (n / 2 - 1)) % (n - 1);
  const rot = [...rotating.slice(shift), ...rotating.slice(0, shift)];
  const pairs: Pairing[] = [];
  let bye: string | null = null;
  // Bàn 1: người cố định gặp đầu dãy, đổi màu theo vòng
  const first = rot[0] ?? null;
  const add = (a: string | null, b: string | null, aWhite: boolean) => {
    if (a === null || b === null) {
      bye = a ?? b;
      return;
    }
    pairs.push(aWhite ? { white: a, black: b } : { white: b, black: a });
  };
  add(first, fixed, round % 2 === 1);
  // Các bàn còn lại đổi màu theo bàn và theo vòng để cân màu
  for (let i = 1; i < n / 2; i++)
    add(rot[i] ?? null, rot[n - 1 - i] ?? null, (i + round) % 2 === 0);
  return { pairs, bye };
}

export function roundRobinRounds(count: number): number {
  return count % 2 === 0 ? count - 1 : count;
}

/** Chia nhóm Quad theo rating giảm dần: nhóm 4; dư 1 → nhóm cuối 5, dư 2 → hai nhóm 3, dư 3 → nhóm 3. */
export function quadGroups(players: readonly TPlayer[]): TPlayer[][] {
  const sorted = [...players].sort((a, b) => b.rating - a.rating || a.id.localeCompare(b.id));
  if (sorted.length <= 5) return sorted.length ? [sorted] : [];
  const groups: TPlayer[][] = [];
  for (let i = 0; i < sorted.length; i += 4) groups.push(sorted.slice(i, i + 4));
  const last = groups.at(-1) as TPlayer[];
  if (last.length === 1) {
    groups.pop();
    (groups.at(-1) as TPlayer[]).push(...last);
  } else if (last.length === 2) {
    const prev = groups.at(-2) as TPlayer[];
    last.unshift(prev.pop() as TPlayer);
  }
  return groups;
}

// ── Swiss đồng đội ──

export type TTeam = { id: string; members: string[] };
export type TeamMatch = {
  round: number;
  a: string;
  b: string | null;
  aPoints: number;
  bPoints: number;
};

/** Điểm trận: thắng 2, hoà 1, thua 0; bye được 2. */
function matchResult(m: TeamMatch, team: string): '1-0' | '0-1' | '1/2-1/2' {
  const mine = m.a === team ? m.aPoints : m.bPoints;
  const theirs = m.a === team ? m.bPoints : m.aPoints;
  return mine > theirs ? '1-0' : mine < theirs ? '0-1' : '1/2-1/2';
}

/**
 * Ghép một vòng Swiss đồng đội: ghép đội như Swiss cá nhân theo kết quả trận (rating đội = trung
 * bình), rồi xếp bàn: bàn 1, 3… đội "Trắng" cầm Trắng; bàn 2, 4… đổi màu.
 */
export function pairTeamSwiss(
  teams: readonly (TTeam & { rating: number })[],
  matches: readonly TeamMatch[],
  boards: number,
): {
  matches: { a: string; b: string }[];
  bye: string | null;
  games: (Pairing & { board: number })[];
} {
  const asGames: TGame[] = matches.map((m) =>
    m.b === null
      ? { round: m.round, white: m.a, black: null, result: '1-0' }
      : { round: m.round, white: m.a, black: m.b, result: matchResult(m, m.a) },
  );
  const r = pairSwiss(
    teams.map((t) => ({ id: t.id, rating: t.rating })),
    asGames,
  );
  const byId = new Map(teams.map((t) => [t.id, t]));
  const games: (Pairing & { board: number })[] = [];
  for (const p of r.pairs) {
    const a = byId.get(p.white)?.members ?? [];
    const b = byId.get(p.black)?.members ?? [];
    for (let i = 0; i < boards; i++) {
      const x = a[i];
      const y = b[i];
      if (!x || !y) continue;
      games.push(
        i % 2 === 0 ? { white: x, black: y, board: i + 1 } : { white: y, black: x, board: i + 1 },
      );
    }
  }
  return { matches: r.pairs.map((p) => ({ a: p.white, b: p.black })), bye: r.bye, games };
}

// ── Bảng xếp hạng ──

export type Standing = {
  id: string;
  rank: number;
  points: number;
  buchholz: number;
  buchholzCut1: number;
  sonneborn: number;
  wins: number;
  played: number;
};

/**
 * Bảng xếp hạng: điểm, Buchholz cắt 1, Buchholz, Sonneborn-Berger, số ván thắng, rating. Vòng tròn
 * (`roundRobin`) xếp theo điểm, Sonneborn-Berger, số ván thắng. Bye không tính vào Buchholz/SB.
 */
export function standings(
  players: readonly TPlayer[],
  games: readonly TGame[],
  roundRobin = false,
): Standing[] {
  const info = infos(players, games);
  const rows = [...info.values()].map((p) => {
    const mine = games.filter(
      (g) => g.black !== null && g.result && (g.white === p.id || g.black === p.id),
    );
    const oppScores = mine.map(
      (g) => info.get(g.white === p.id ? (g.black as string) : g.white)?.score ?? 0,
    );
    const buchholz = oppScores.reduce((s, x) => s + x, 0);
    const buchholzCut1 = oppScores.length ? buchholz - Math.min(...oppScores) : 0;
    let sonneborn = 0;
    let wins = 0;
    for (const g of mine) {
      const opp = info.get(g.white === p.id ? (g.black as string) : g.white)?.score ?? 0;
      const pts = pointsFor(p.id, g);
      sonneborn += pts * opp;
      if (pts === 1) wins++;
    }
    return {
      id: p.id,
      rating: p.rating,
      points: p.score,
      buchholz,
      buchholzCut1,
      sonneborn,
      wins,
      played: mine.length,
    };
  });
  rows.sort((a, b) =>
    roundRobin
      ? b.points - a.points || b.sonneborn - a.sonneborn || b.wins - a.wins || b.rating - a.rating
      : b.points - a.points ||
        b.buchholzCut1 - a.buchholzCut1 ||
        b.buchholz - a.buchholz ||
        b.sonneborn - a.sonneborn ||
        b.wins - a.wins ||
        b.rating - a.rating,
  );
  return rows.map(({ rating: _r, ...row }, i) => ({ ...row, rank: i + 1 }));
}
