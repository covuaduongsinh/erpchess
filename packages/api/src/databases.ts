/** Kho ván (Giai đoạn 6b): CSDL, nhập PGN theo lô, tìm ván, lấy dữ liệu công khai từ Lichess. */
import { gameSummary, parsePgn, splitPgn, toPgn } from '@erpchess/chess-core';
import type { ErpClient } from './client';
import type { Tables } from './database.types';
import { ApiError, unwrap } from './queries';

export type GameDatabase = Tables<'game_databases'>;
export type DatabaseGame = Tables<'database_games'>;
export type GameListItem = Omit<DatabaseGame, 'pgn'>;
export type ImportPgnResult = { imported: number; failed: number; firstError?: string };

const BATCH = 200;
const LIST_COLUMNS =
  'id, database_id, white, black, result, event, site, date, eco, white_elo, black_elo, ply_count, start_fen, created_at';

export async function fetchDatabases(
  client: ErpClient,
  academyId: string,
): Promise<GameDatabase[]> {
  return unwrap(
    await client.from('game_databases').select('*').eq('academy_id', academyId).order('name'),
  );
}

export async function createDatabase(
  client: ErpClient,
  academyId: string,
  userId: string,
  name: string,
  visibility: 'private' | 'academy' = 'private',
): Promise<GameDatabase> {
  const trimmed = name.trim();
  if (!trimmed) throw new ApiError('name', 'name');
  return unwrap(
    await client
      .from('game_databases')
      .insert({ academy_id: academyId, name: trimmed, visibility, created_by: userId })
      .select()
      .single(),
  );
}

export async function deleteDatabase(client: ErpClient, id: string) {
  unwrap(await client.from('game_databases').delete().eq('id', id));
}

/**
 * Đọc từng ván riêng (ván hỏng chỉ bị bỏ qua và đếm vào `failed`), chuẩn hoá lại bằng `toPgn`
 * rồi chèn theo lô. `onProgress` nhận số ván đã xử lý.
 */
export async function importPgn(
  client: ErpClient,
  databaseId: string,
  text: string,
  onProgress?: (done: number, total: number) => void,
): Promise<ImportPgnResult> {
  const chunks = splitPgn(text);
  const rows: Omit<DatabaseGame, 'id' | 'created_at'>[] = [];
  let failed = 0;
  let firstError: string | undefined;
  for (const chunk of chunks) {
    try {
      for (const tree of parsePgn(chunk)) {
        const s = gameSummary(tree);
        rows.push({
          database_id: databaseId,
          white: s.white,
          black: s.black,
          result: s.result,
          event: s.event,
          site: s.site,
          date: s.date,
          eco: s.eco,
          white_elo: s.whiteElo,
          black_elo: s.blackElo,
          ply_count: s.plyCount,
          start_fen: s.startFen,
          pgn: toPgn(tree),
        });
      }
    } catch (err) {
      failed++;
      firstError ??= err instanceof Error ? err.message : String(err);
    }
  }
  let imported = 0;
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);
    unwrap(await client.from('database_games').insert(batch));
    imported += batch.length;
    onProgress?.(imported, rows.length);
  }
  return { imported, failed, ...(firstError ? { firstError } : {}) };
}

export async function searchGames(
  client: ErpClient,
  databaseId: string,
  opts: { search?: string; page?: number; pageSize?: number } = {},
): Promise<{ rows: GameListItem[]; total: number }> {
  const pageSize = opts.pageSize ?? 50;
  const page = Math.max(0, opts.page ?? 0);
  let q = client
    .from('database_games')
    .select(LIST_COLUMNS, { count: 'exact' })
    .eq('database_id', databaseId)
    .order('created_at')
    .range(page * pageSize, page * pageSize + pageSize - 1);
  const term = opts.search?.trim().replace(/[%_,()]/g, '');
  if (term) q = q.or(`white.ilike.%${term}%,black.ilike.%${term}%,event.ilike.%${term}%`);
  const { data, error, count } = await q;
  if (error) throw new ApiError(error.message, error.code);
  return { rows: data ?? [], total: count ?? 0 };
}

export async function fetchGamePgn(client: ErpClient, id: string): Promise<string> {
  const row = unwrap(await client.from('database_games').select('pgn').eq('id', id).single());
  return row.pgn;
}

export async function deleteGame(client: ErpClient, id: string) {
  unwrap(await client.from('database_games').delete().eq('id', id));
}

// ── Lichess (API công khai, gọi thẳng từ client) ──

/**
 * Nhận link study Lichess (có thể kèm chương); trả mã study hoặc null. Chỉ nhận dạng link vì mã
 * study 8 ký tự trùng dạng với tên người chơi (vd. "thibault").
 */
export function lichessStudyId(input: string): string | null {
  return /lichess\.org\/study\/([A-Za-z0-9]{8})(?![A-Za-z0-9])/.exec(input.trim())?.[1] ?? null;
}

/** Tên tài khoản Lichess: 2–30 ký tự chữ, số, gạch dưới, gạch ngang. */
export function lichessUsername(input: string): string | null {
  const s = input.trim().replace(/^https?:\/\/lichess\.org\/@\//, '');
  return /^[A-Za-z0-9][A-Za-z0-9_-]{1,29}$/.test(s) ? s : null;
}

async function fetchText(url: string, accept: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: accept } });
  } catch {
    throw new ApiError('lichess_unreachable', 'lichess_unreachable');
  }
  if (res.status === 404) throw new ApiError('lichess_not_found', 'lichess_not_found');
  if (!res.ok) throw new ApiError(`lichess_${res.status}`, 'lichess_error');
  return res.text();
}

/** PGN mọi chương của một study công khai trên Lichess. */
export function fetchLichessStudyPgn(studyId: string): Promise<string> {
  return fetchText(`https://lichess.org/api/study/${studyId}.pgn`, 'application/x-chess-pgn');
}

/** Tối đa `max` ván gần nhất của một người chơi Lichess, kèm chú thích của người chơi. */
export function fetchLichessUserGames(username: string, max = 50): Promise<string> {
  const n = Math.min(Math.max(1, Math.round(max)), 300);
  return fetchText(
    `https://lichess.org/api/games/user/${encodeURIComponent(username)}?max=${n}&clocks=false&evals=false&opening=true`,
    'application/x-chess-pgn',
  );
}
