/** Giải đấu (Giai đoạn 10): tạo, đăng ký, điều hành qua `tournament-admin`, bảng xếp hạng. */
import { categoryOf, START_FEN, type Standing, standings, type TGame } from '@erpchess/chess-core';
import { OPENING_PRESETS, type TournamentInput, tournamentInputSchema } from '@erpchess/domain';
import type { ErpClient } from './client';
import type { Tables } from './database.types';
import { invokeEdge } from './edge';
import type { GameRow } from './games';
import { unwrap } from './queries';

export type Tournament = Tables<'tournaments'>;
export type TournamentPlayer = Tables<'tournament_players'>;
export type TournamentRound = Tables<'tournament_rounds'>;
export type TournamentTeam = Tables<'tournament_teams'>;
export type TournamentBye = Tables<'tournament_byes'>;
export type TournamentSummary = Tournament & { playerIds: string[] };
export type TournamentDetail = Tournament & {
  players: TournamentPlayer[];
  roundList: TournamentRound[];
  teams: TournamentTeam[];
  byes: TournamentBye[];
  games: GameRow[];
};

export async function fetchTournaments(
  client: ErpClient,
  academyId: string,
): Promise<TournamentSummary[]> {
  const rows = unwrap(
    await client
      .from('tournaments')
      .select('*, tournament_players(player_id)')
      .eq('academy_id', academyId)
      .order('starts_at', { ascending: false, nullsFirst: false })
      .limit(500),
  );
  return rows.map(({ tournament_players, ...t }) => ({
    ...t,
    playerIds: tournament_players.map((p) => p.player_id),
  }));
}

export async function fetchTournament(client: ErpClient, id: string): Promise<TournamentDetail> {
  const { tournament_players, tournament_rounds, tournament_teams, tournament_byes, games, ...t } =
    unwrap(
      await client
        .from('tournaments')
        .select(
          '*, tournament_players(*), tournament_rounds(*), tournament_teams(*), tournament_byes(*), games(*)',
        )
        .eq('id', id)
        .single(),
    );
  return {
    ...t,
    players: tournament_players,
    roundList: [...tournament_rounds].sort((a, b) => a.round - b.round),
    teams: tournament_teams,
    byes: tournament_byes,
    games: [...games].sort(
      (a, b) => (a.round ?? 0) - (b.round ?? 0) || (a.board_no ?? 0) - (b.board_no ?? 0),
    ),
  };
}

/**
 * Tạo giải và danh sách người chơi; rating hạt giống lấy từ bảng `ratings` theo loại thời gian
 * (chưa có thì 1500). Lỗi giữa chừng thì xoá giải vừa tạo.
 */
export async function createTournament(
  client: ErpClient,
  userId: string,
  input: TournamentInput,
): Promise<Tournament> {
  const v = tournamentInputSchema.parse(input);
  const initialFen =
    v.startKind === 'standard'
      ? START_FEN
      : v.startKind === 'opening'
        ? (OPENING_PRESETS.find((o) => o.fen === v.initialFen)?.fen ?? OPENING_PRESETS[0].fen)
        : (v.initialFen ?? START_FEN);
  const t = unwrap(
    await client
      .from('tournaments')
      .insert({
        academy_id: v.academyId,
        title: v.title,
        description: v.description,
        location: v.location,
        format: v.format,
        rounds: v.rounds,
        base_ms: v.baseMs,
        inc_ms: v.incMs,
        rated: v.rated,
        allow_draw: v.allowDraw,
        allow_resign: v.allowResign,
        is_public: v.isPublic,
        control: v.control,
        start_kind: v.startKind,
        initial_fen: initialFen,
        team_boards: v.teamBoards,
        starts_at: v.startsAt,
        timezone: v.timezone,
        round_interval_min: v.roundIntervalMin,
        repeat: v.repeat,
        repeat_until: v.repeatUntil,
        created_by: userId,
      })
      .select()
      .single(),
  );
  try {
    const ids = v.format === 'team_swiss' ? v.teams.flatMap((team) => team.playerIds) : v.playerIds;
    const category = v.baseMs === null ? 'rapid' : categoryOf({ baseMs: v.baseMs, incMs: v.incMs });
    const ratings = ids.length
      ? unwrap(
          await client
            .from('ratings')
            .select('student_id, rating')
            .eq('academy_id', v.academyId)
            .eq('category', category)
            .in('student_id', ids),
        )
      : [];
    const seed = (id: string) => Number(ratings.find((r) => r.student_id === id)?.rating ?? 1500);
    if (v.format === 'team_swiss') {
      for (const team of v.teams) {
        const row = unwrap(
          await client
            .from('tournament_teams')
            .insert({ tournament_id: t.id, name: team.name })
            .select()
            .single(),
        );
        unwrap(
          await client.from('tournament_players').insert(
            team.playerIds.map((pid, i) => ({
              tournament_id: t.id,
              player_id: pid,
              team_id: row.id,
              board_no: i + 1,
              seed_rating: seed(pid),
            })),
          ),
        );
      }
    } else if (ids.length) {
      unwrap(
        await client
          .from('tournament_players')
          .insert(
            ids.map((pid) => ({ tournament_id: t.id, player_id: pid, seed_rating: seed(pid) })),
          ),
      );
    }
  } catch (err) {
    await client.from('tournaments').delete().eq('id', t.id);
    throw err;
  }
  return t;
}

export async function deleteTournament(client: ErpClient, id: string) {
  unwrap(await client.from('tournaments').delete().eq('id', id));
}

/** Tự đăng ký giải công khai chưa bắt đầu. */
export async function joinTournament(client: ErpClient, tournamentId: string, userId: string) {
  unwrap(
    await client
      .from('tournament_players')
      .insert({ tournament_id: tournamentId, player_id: userId }),
  );
}

export async function leaveTournament(client: ErpClient, tournamentId: string, userId: string) {
  unwrap(
    await client
      .from('tournament_players')
      .delete()
      .eq('tournament_id', tournamentId)
      .eq('player_id', userId),
  );
}

/** Người tổ chức rút một người khỏi các vòng sau (ván đã chơi vẫn tính). */
export async function setWithdrawn(
  client: ErpClient,
  tournamentId: string,
  playerId: string,
  withdrawn: boolean,
) {
  unwrap(
    await client
      .from('tournament_players')
      .update({ withdrawn })
      .eq('tournament_id', tournamentId)
      .eq('player_id', playerId),
  );
}

export type TournamentAction = 'start' | 'next_round' | 'finish';
export function tournamentAction(client: ErpClient, id: string, action: TournamentAction) {
  return invokeEdge<Tournament>(client, 'tournament-admin', { tournamentId: id, action });
}

/** Nghe tín hiệu "có ván giải vừa đổi trạng thái" trên kênh riêng tư `tournament:<id>`. */
export function subscribeTournament(client: ErpClient, id: string, onChange: () => void) {
  const channel = client
    .channel(`tournament:${id}`, { config: { private: true } })
    .on('broadcast', { event: 'game' }, () => onChange())
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}

/** Ván đã xong + bye của giải ở dạng hàm bảng xếp hạng dùng. */
export function tournamentGames(t: TournamentDetail): TGame[] {
  const done = t.games
    .filter((g) => g.status === 'finished' && g.white_id && g.black_id && g.round)
    .map((g) => ({
      round: g.round as number,
      white: g.white_id as string,
      black: g.black_id as string,
      result: (g.result as TGame['result']) ?? null,
    }));
  const byes = t.byes
    .filter((b) => b.player_id)
    .map((b) => ({
      round: b.round,
      white: b.player_id as string,
      black: null,
      result: '1-0' as const,
    }));
  return [...done, ...byes];
}

export function tournamentStandings(t: TournamentDetail): Standing[] {
  return standings(
    t.players.map((p) => ({ id: p.player_id, rating: Number(p.seed_rating) })),
    tournamentGames(t),
    t.format === 'round_robin' || t.format === 'quad',
  );
}

export type TeamStanding = {
  teamId: string;
  name: string;
  matchPoints: number;
  gamePoints: number;
};

/** Bảng xếp hạng đội: điểm trận (thắng 2, hoà 1; bye 2) rồi tổng điểm ván. */
export function teamStandings(t: TournamentDetail): TeamStanding[] {
  const teamOf = new Map(t.players.map((p) => [p.player_id, p.team_id]));
  const rows = new Map(
    t.teams.map((x) => [x.id, { teamId: x.id, name: x.name, matchPoints: 0, gamePoints: 0 }]),
  );
  const matches = new Map<string, Map<string, number>>();
  for (const g of t.games.filter((x) => x.status === 'finished' && x.white_id && x.black_id)) {
    const tw = teamOf.get(g.white_id as string);
    const tb = teamOf.get(g.black_id as string);
    if (!tw || !tb) continue;
    const key = `${g.round}:${[tw, tb].sort().join(':')}`;
    const m =
      matches.get(key) ??
      new Map([
        [tw, 0],
        [tb, 0],
      ]);
    const wp = g.result === '1-0' ? 1 : g.result === '1/2-1/2' ? 0.5 : 0;
    m.set(tw, (m.get(tw) ?? 0) + wp);
    m.set(tb, (m.get(tb) ?? 0) + 1 - wp);
    matches.set(key, m);
  }
  for (const m of matches.values()) {
    const [[a, pa], [b, pb]] = [...m.entries()] as [[string, number], [string, number]];
    const ra = rows.get(a);
    const rb = rows.get(b);
    if (ra) {
      ra.gamePoints += pa;
      ra.matchPoints += pa > pb ? 2 : pa === pb ? 1 : 0;
    }
    if (rb) {
      rb.gamePoints += pb;
      rb.matchPoints += pb > pa ? 2 : pa === pb ? 1 : 0;
    }
  }
  for (const b of t.byes.filter((x) => x.team_id)) {
    const r = rows.get(b.team_id as string);
    if (r) r.matchPoints += 2;
  }
  return [...rows.values()].sort(
    (x, y) => y.matchPoints - x.matchPoints || y.gamePoints - x.gamePoints,
  );
}
