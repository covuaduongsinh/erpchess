// Điều hành giải đấu phía server (dùng chung cho tournament-admin, game-move, tournament-tick).
// Chép vào <function>/_shared/ bằng supabase/functions/sync-shared.mjs; import tương đối trỏ tới
// <function>/_shared/chess-core/ nên chỉ chạy được từ bản chép.
// Mọi bước đều idempotent: ghép vòng chỉ chạy khi chuyển được vòng từ pending → active.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';
import { categoryOf } from './chess-core/clock.ts';
import { nextOccurrence } from './chess-core/schedule.ts';
import {
  pairSwiss,
  pairTeamSwiss,
  quadGroups,
  type RoundPairing,
  roundRobinRound,
  roundRobinRounds,
  type TeamMatch,
  type TGame,
} from './chess-core/tournament.ts';

type Admin = SupabaseClient;
type GameLite = {
  round: number;
  white_id: string | null;
  black_id: string | null;
  result: string | null;
  status: string;
};
type ByeLite = { round: number; player_id: string | null; team_id: string | null };
type History = { games: GameLite[]; byes: ByeLite[] };
export type Tournament = {
  id: string;
  academy_id: string;
  format: 'swiss' | 'round_robin' | 'quad' | 'team_swiss';
  rounds: number;
  base_ms: number | null;
  inc_ms: number;
  rated: boolean;
  control: 'manual' | 'auto_finish' | 'auto_schedule';
  initial_fen: string;
  team_boards: number;
  starts_at: string | null;
  round_interval_min: number;
  status: string;
  current_round: number;
  created_by: string | null;
};
type PlayerRow = {
  player_id: string;
  team_id: string | null;
  board_no: number | null;
  group_no: number | null;
  seed_rating: number;
  withdrawn: boolean;
};

async function loadPlayers(admin: Admin, t: Tournament): Promise<PlayerRow[]> {
  const { data } = await admin
    .from('tournament_players')
    .select('player_id, team_id, board_no, group_no, seed_rating, withdrawn')
    .eq('tournament_id', t.id);
  return (data ?? []).map((p: PlayerRow) => ({ ...p, seed_rating: Number(p.seed_rating) }));
}

/** Lịch sử ván (đã xong) + bye của giải, dạng dùng cho hàm ghép cặp. */
async function loadHistory(admin: Admin, t: Tournament) {
  const { data: games } = await admin
    .from('games')
    .select('round, white_id, black_id, result, status')
    .eq('tournament_id', t.id);
  const { data: byes } = await admin
    .from('tournament_byes')
    .select('round, player_id, team_id')
    .eq('tournament_id', t.id);
  return { games: (games ?? []) as GameLite[], byes: (byes ?? []) as ByeLite[] };
}

/** Số vòng thực tế theo thể thức (vòng tròn và Quad tự tính theo số người). */
export function totalRounds(t: Tournament, players: PlayerRow[]): number {
  const active = players.filter((p) => !p.withdrawn);
  if (t.format === 'round_robin') return roundRobinRounds(active.length);
  if (t.format === 'quad') {
    const sizes = new Map<number, number>();
    for (const p of active) sizes.set(p.group_no ?? 0, (sizes.get(p.group_no ?? 0) ?? 0) + 1);
    return Math.max(1, ...[...sizes.values()].map(roundRobinRounds));
  }
  return t.rounds;
}

async function insertRoundGames(
  admin: Admin,
  t: Tournament,
  round: number,
  pairs: { white: string; black: string; board?: number }[],
  byes: { player_id?: string; team_id?: string }[],
) {
  if (pairs.length) {
    const category = t.base_ms === null ? null : categoryOf({ baseMs: t.base_ms, incMs: t.inc_ms });
    const { error } = await admin.from('games').insert(
      pairs.map((p, i) => ({
        academy_id: t.academy_id,
        tournament_id: t.id,
        round,
        board_no: p.board ?? i + 1,
        white_id: p.white,
        black_id: p.black,
        initial_fen: t.initial_fen,
        fen: t.initial_fen,
        base_ms: t.base_ms,
        inc_ms: t.inc_ms,
        white_ms: t.base_ms,
        black_ms: t.base_ms,
        rated: t.rated && t.base_ms !== null,
        category,
        status: 'active',
        created_by: t.created_by,
      })),
    );
    if (error) throw new Error(`insert_games: ${error.message}`);
  }
  if (byes.length) {
    await admin
      .from('tournament_byes')
      .insert(byes.map((b) => ({ tournament_id: t.id, round, ...b })));
  }
}

function roundPairing(
  t: Tournament,
  players: PlayerRow[],
  history: History,
  round: number,
): {
  pairs: { white: string; black: string; board?: number }[];
  byes: { player_id?: string; team_id?: string }[];
} {
  const active = players.filter((p) => !p.withdrawn);
  const toPlayer = (p: PlayerRow) => ({ id: p.player_id, rating: p.seed_rating });
  const asResult = (r: string | null) => (r === '1-0' || r === '0-1' || r === '1/2-1/2' ? r : null);
  const tgames: TGame[] = [
    ...history.games
      .filter((g) => g.status === 'finished' && g.white_id && g.black_id)
      .map((g) => ({
        round: g.round,
        white: g.white_id,
        black: g.black_id,
        result: asResult(g.result),
      })),
    ...history.byes
      .filter((b) => b.player_id)
      .map((b) => ({ round: b.round, white: b.player_id, black: null, result: '1-0' as const })),
  ];
  const seeded = [...active].sort(
    (a, b) => b.seed_rating - a.seed_rating || a.player_id.localeCompare(b.player_id),
  );
  const fromRound = (r: RoundPairing) => ({
    pairs: r.pairs,
    byes: r.bye ? [{ player_id: r.bye }] : [],
  });

  if (t.format === 'swiss') return fromRound(pairSwiss(seeded.map(toPlayer), tgames));
  if (t.format === 'round_robin') return fromRound(roundRobinRound(seeded.map(toPlayer), round));
  if (t.format === 'quad') {
    const groups = new Map<number, PlayerRow[]>();
    for (const p of seeded)
      groups.set(p.group_no ?? 0, [...(groups.get(p.group_no ?? 0) ?? []), p]);
    const pairs: { white: string; black: string }[] = [];
    const byes: { player_id: string }[] = [];
    for (const members of groups.values()) {
      if (round > roundRobinRounds(members.length)) continue;
      const r = roundRobinRound(members.map(toPlayer), round);
      pairs.push(...r.pairs);
      if (r.bye) byes.push({ player_id: r.bye });
    }
    return { pairs, byes };
  }
  // Swiss đồng đội: đội = thành viên theo thứ tự bàn; điểm trận tính từ các ván đã xong
  const teamOf = new Map(active.map((p) => [p.player_id, p.team_id]));
  const teams = new Map<string, PlayerRow[]>();
  for (const p of active) if (p.team_id) teams.set(p.team_id, [...(teams.get(p.team_id) ?? []), p]);
  const teamList = [...teams.entries()].map(([id, ms]) => ({
    id,
    members: [...ms]
      .sort((a, b) => (a.board_no ?? 99) - (b.board_no ?? 99))
      .map((m) => m.player_id),
    rating: ms.reduce((s, m) => s + m.seed_rating, 0) / ms.length,
  }));
  const matches = new Map<string, TeamMatch>();
  for (const g of history.games.filter(
    (x) => x.status === 'finished' && x.white_id && x.black_id,
  )) {
    const tw = teamOf.get(g.white_id);
    const tb = teamOf.get(g.black_id);
    if (!tw || !tb) continue;
    const [a, b] = [tw, tb].sort();
    const key = `${g.round}:${a}:${b}`;
    const m = matches.get(key) ?? { round: g.round, a, b, aPoints: 0, bPoints: 0 };
    const wp = g.result === '1-0' ? 1 : g.result === '1/2-1/2' ? 0.5 : 0;
    if (tw === a) {
      m.aPoints += wp;
      m.bPoints += 1 - wp;
    } else {
      m.bPoints += wp;
      m.aPoints += 1 - wp;
    }
    matches.set(key, m);
  }
  for (const b of history.byes.filter((x) => x.team_id)) {
    matches.set(`${b.round}:${b.team_id}:bye`, {
      round: b.round,
      a: b.team_id,
      b: null,
      aPoints: 0,
      bPoints: 0,
    });
  }
  const r = pairTeamSwiss(teamList, [...matches.values()], t.team_boards);
  return { pairs: r.games, byes: r.bye ? [{ team_id: r.bye }] : [] };
}

/** Ghép vòng `round` nếu vòng đó còn pending (idempotent). Trả true nếu đã ghép. */
export async function pairRound(admin: Admin, t: Tournament, round: number): Promise<boolean> {
  const { data: claimed } = await admin
    .from('tournament_rounds')
    .update({ status: 'active' })
    .eq('tournament_id', t.id)
    .eq('round', round)
    .eq('status', 'pending')
    .select('round');
  if (!claimed?.length) return false;
  const players = await loadPlayers(admin, t);
  const history = await loadHistory(admin, t);
  const { pairs, byes } = roundPairing(t, players, history, round);
  await insertRoundGames(admin, t, round, pairs, byes);
  await admin.from('tournaments').update({ current_round: round }).eq('id', t.id);
  // Vòng không có ván nào (toàn bye) thì xong ngay
  if (pairs.length === 0) await afterGame(admin, t.id, round);
  return true;
}

/** Bắt đầu giải: chia nhóm (Quad), tạo các vòng, ghép vòng 1. */
export async function startTournament(admin: Admin, t: Tournament): Promise<void> {
  const players = (await loadPlayers(admin, t)).filter((p) => !p.withdrawn);
  if (players.length < 2) throw new Error('not_enough_players');
  if (t.format === 'team_swiss' && players.some((p) => !p.team_id))
    throw new Error('players_without_team');
  const { data: started } = await admin
    .from('tournaments')
    .update({ status: 'active', started_at: new Date().toISOString() })
    .eq('id', t.id)
    .eq('status', 'upcoming')
    .select('id');
  if (!started?.length) return;
  if (t.format === 'quad') {
    const groups = quadGroups(players.map((p) => ({ id: p.player_id, rating: p.seed_rating })));
    for (const [i, g] of groups.entries()) {
      await admin
        .from('tournament_players')
        .update({ group_no: i + 1 })
        .eq('tournament_id', t.id)
        .in(
          'player_id',
          g.map((p) => p.id),
        );
    }
  }
  const total = totalRounds(t, await loadPlayers(admin, t));
  await admin.from('tournaments').update({ rounds: total }).eq('id', t.id);
  const base = t.starts_at ? Date.parse(t.starts_at) : Date.now();
  await admin.from('tournament_rounds').insert(
    Array.from({ length: total }, (_, i) => ({
      tournament_id: t.id,
      round: i + 1,
      starts_at:
        t.round_interval_min > 0
          ? new Date(base + i * t.round_interval_min * 60_000).toISOString()
          : null,
    })),
  );
  await pairRound(admin, { ...t, rounds: total, status: 'active' }, 1);
}

/**
 * Sau khi một ván giải kết thúc (hoặc huỷ): vòng xong thì đánh dấu; vòng cuối xong thì kết thúc
 * giải; chế độ tự động thì ghép vòng kế (tự lên lịch mà chưa tới giờ thì để tick ghép).
 */
export async function afterGame(admin: Admin, tournamentId: string, round: number): Promise<void> {
  const { data: open } = await admin
    .from('games')
    .select('id')
    .eq('tournament_id', tournamentId)
    .eq('round', round)
    .in('status', ['pending', 'active'])
    .limit(1);
  if (open?.length) return;
  const { data: closed } = await admin
    .from('tournament_rounds')
    .update({ status: 'finished' })
    .eq('tournament_id', tournamentId)
    .eq('round', round)
    .eq('status', 'active')
    .select('round');
  if (!closed?.length) return;
  const { data: t } = await admin.from('tournaments').select('*').eq('id', tournamentId).single();
  if (!t) return;
  if (round >= t.rounds) {
    await admin
      .from('tournaments')
      .update({ status: 'finished', finished_at: new Date().toISOString() })
      .eq('id', tournamentId);
    return;
  }
  if (t.control === 'manual') return;
  if (t.control === 'auto_schedule') {
    const { data: next } = await admin
      .from('tournament_rounds')
      .select('starts_at')
      .eq('tournament_id', tournamentId)
      .eq('round', round + 1)
      .single();
    if (next?.starts_at && Date.parse(next.starts_at) > Date.now()) return;
  }
  await pairRound(admin, t, round + 1);
}

/** Kết thúc giải sớm: huỷ các ván còn dở, đóng mọi vòng. */
export async function finishTournament(admin: Admin, tournamentId: string): Promise<void> {
  await admin
    .from('games')
    .update({ status: 'aborted', reason: 'abort', finished_at: new Date().toISOString() })
    .eq('tournament_id', tournamentId)
    .in('status', ['pending', 'active']);
  await admin
    .from('tournament_rounds')
    .update({ status: 'finished' })
    .eq('tournament_id', tournamentId)
    .neq('status', 'finished');
  await admin
    .from('tournaments')
    .update({ status: 'finished', finished_at: new Date().toISOString() })
    .eq('id', tournamentId);
}

/** Tạo lần tổ chức kế tiếp của giải lặp lại (sao chép thiết lập, đội và người chơi còn thi đấu). */
async function cloneForRepeat(
  admin: Admin,
  t: Tournament & Record<string, unknown>,
  startsAt: Date,
) {
  const { data: child } = await admin
    .from('tournaments')
    .insert({
      academy_id: t.academy_id,
      title: t.title,
      description: t.description,
      location: t.location,
      format: t.format,
      rounds: t.format === 'swiss' || t.format === 'team_swiss' ? t.rounds : 1,
      base_ms: t.base_ms,
      inc_ms: t.inc_ms,
      rated: t.rated,
      allow_draw: t.allow_draw,
      allow_resign: t.allow_resign,
      is_public: t.is_public,
      control: t.control,
      start_kind: t.start_kind,
      initial_fen: t.initial_fen,
      team_boards: t.team_boards,
      starts_at: startsAt.toISOString(),
      timezone: t.timezone,
      round_interval_min: t.round_interval_min,
      repeat: t.repeat,
      repeat_until: t.repeat_until,
      parent_id: t.id,
      created_by: t.created_by,
    })
    .select('id')
    .single();
  if (!child) return;
  const players = (await loadPlayers(admin, t)).filter((p) => !p.withdrawn);
  const { data: teams } = await admin
    .from('tournament_teams')
    .select('id, name')
    .eq('tournament_id', t.id);
  const teamMap = new Map<string, string>();
  for (const team of teams ?? []) {
    const { data: copy } = await admin
      .from('tournament_teams')
      .insert({ tournament_id: child.id, name: team.name })
      .select('id')
      .single();
    if (copy) teamMap.set(team.id, copy.id);
  }
  if (players.length) {
    await admin.from('tournament_players').insert(
      players.map((p) => ({
        tournament_id: child.id,
        player_id: p.player_id,
        team_id: p.team_id ? (teamMap.get(p.team_id) ?? null) : null,
        board_no: p.board_no,
        seed_rating: p.seed_rating,
      })),
    );
  }
}

/**
 * Một nhịp của cron (mỗi phút): bắt đầu giải tự lên lịch đã tới giờ, ghép vòng đã tới giờ, tạo lần
 * tổ chức kế tiếp cho giải lặp lại đang diễn ra. Trả số việc đã làm để ghi log.
 */
export async function runTick(
  admin: Admin,
  now = new Date(),
): Promise<{ started: number; paired: number; repeated: number }> {
  const iso = now.toISOString();
  let started = 0;
  let paired = 0;
  let repeated = 0;

  const { data: due } = await admin
    .from('tournaments')
    .select('*')
    .eq('control', 'auto_schedule')
    .eq('status', 'upcoming')
    .lte('starts_at', iso)
    .limit(50);
  for (const t of (due ?? []) as Tournament[]) {
    try {
      await startTournament(admin, t);
      started++;
    } catch {
      // Thiếu người chơi: để người tổ chức xử lý, nhịp sau thử lại
    }
  }

  const { data: running } = await admin
    .from('tournaments')
    .select('*')
    .eq('control', 'auto_schedule')
    .eq('status', 'active')
    .limit(200);
  for (const t of (running ?? []) as Tournament[]) {
    if (t.current_round >= t.rounds) continue;
    const { data: rounds } = await admin
      .from('tournament_rounds')
      .select('round, status, starts_at')
      .eq('tournament_id', t.id)
      .in('round', [t.current_round, t.current_round + 1]);
    const cur = rounds?.find((r) => r.round === t.current_round);
    const next = rounds?.find((r) => r.round === t.current_round + 1);
    if (
      cur?.status === 'finished' &&
      next?.status === 'pending' &&
      (!next.starts_at || next.starts_at <= iso)
    ) {
      if (await pairRound(admin, t, next.round)) paired++;
    }
  }

  const { data: repeating } = await admin
    .from('tournaments')
    .select('*')
    .neq('repeat', 'none')
    // Chỉ sinh khi giải gốc đang diễn ra: xoá bản lặp sau khi giải gốc xong thì không bị tạo lại
    .eq('status', 'active')
    .not('starts_at', 'is', null)
    .limit(200);
  for (const t of (repeating ?? []) as (Tournament & Record<string, unknown>)[]) {
    const { data: children } = await admin
      .from('tournaments')
      .select('id')
      .eq('parent_id', t.id)
      .limit(1);
    if (children?.length) continue;
    const next = nextOccurrence(
      new Date(t.starts_at as string),
      t.repeat as 'daily' | 'weekly' | 'monthly',
      t.repeat_until ? new Date(t.repeat_until as string) : null,
    );
    if (!next) continue;
    await cloneForRepeat(admin, t, next);
    repeated++;
  }
  return { started, paired, repeated };
}
