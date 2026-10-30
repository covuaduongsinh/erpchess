/**
 * Đồng bộ ván Chess.com / Lichess vào CSDL ván riêng của người dùng (Giai đoạn 23c).
 * Gọi thẳng API công khai từ client (cả hai cho phép CORS). Mỗi CSDL đồng bộ nhớ mốc thời gian ván
 * mới nhất đã lấy (`sync_cursor`, ms) để lần sau chỉ lấy ván mới hơn.
 */
import type { ErpClient } from './client';
import { type GameDatabase, type ImportPgnResult, importPgn } from './databases';
import { ApiError, unwrap } from './queries';

export type SyncSource = 'chesscom' | 'lichess';

export const SYNC_MAX_GAMES = 200;

/** Tên tài khoản Chess.com: 3–25 ký tự chữ, số, gạch dưới, gạch ngang (nhận cả link hồ sơ). */
export function chesscomUsername(input: string): string | null {
  const s = input
    .trim()
    .replace(/^https?:\/\/(www\.)?chess\.com\/member\//i, '')
    .replace(/\/$/, '');
  return /^[A-Za-z0-9_-]{3,25}$/.test(s) ? s : null;
}

async function getJson<T>(url: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch {
    throw new ApiError('sync_unreachable', 'sync_unreachable');
  }
  if (res.status === 404) throw new ApiError('sync_not_found', 'sync_not_found');
  if (!res.ok) throw new ApiError(`sync_${res.status}`, 'sync_error');
  return (await res.json()) as T;
}

type FetchedGames = { pgn: string; count: number; cursor: number };

/**
 * Ván Chess.com kết thúc sau `sinceMs`, tối đa `max` ván mới nhất. Duyệt kho lưu theo tháng từ
 * tháng gần nhất trở về, dừng khi đủ ván hoặc khi tháng đã cũ hơn mốc.
 */
export async function fetchChesscomGamesSince(
  username: string,
  sinceMs: number,
  max = SYNC_MAX_GAMES,
): Promise<FetchedGames> {
  const base = `https://api.chess.com/pub/player/${encodeURIComponent(username.toLowerCase())}`;
  const { archives } = await getJson<{ archives: string[] }>(`${base}/games/archives`);
  const picked: { pgn: string; end: number }[] = [];
  for (const url of [...archives].reverse()) {
    const m = /\/(\d{4})\/(\d{2})$/.exec(url);
    // Tháng kết thúc trước mốc thì không còn ván mới
    if (m && Date.UTC(Number(m[1]), Number(m[2]), 1) <= sinceMs) break;
    const { games } = await getJson<{ games: { pgn?: string; end_time?: number }[] }>(url);
    for (const g of [...games].reverse()) {
      const end = (g.end_time ?? 0) * 1000;
      if (g.pgn && end > sinceMs) picked.push({ pgn: g.pgn, end });
      if (picked.length >= max) break;
    }
    if (picked.length >= max) break;
  }
  return {
    pgn: picked.map((g) => g.pgn.trim()).join('\n\n'),
    count: picked.length,
    cursor: picked.reduce((c, g) => Math.max(c, g.end), sinceMs),
  };
}

/** Thời điểm bắt đầu ván (ms) từ tag UTCDate/UTCTime của Lichess; không có thì 0. */
function lichessStart(pgn: string): number {
  const d = /\[UTCDate "(\d{4})\.(\d{2})\.(\d{2})"\]/.exec(pgn);
  const t = /\[UTCTime "(\d{2}):(\d{2}):(\d{2})"\]/.exec(pgn);
  if (!d) return 0;
  return Date.UTC(
    Number(d[1]),
    Number(d[2]) - 1,
    Number(d[3]),
    Number(t?.[1] ?? 0),
    Number(t?.[2] ?? 0),
    Number(t?.[3] ?? 0),
  );
}

/** Ván Lichess bắt đầu sau `sinceMs` (tham số `since` của API), tối đa `max` ván mới nhất. */
export async function fetchLichessGamesSince(
  username: string,
  sinceMs: number,
  max = SYNC_MAX_GAMES,
): Promise<FetchedGames> {
  const n = Math.min(Math.max(1, Math.round(max)), 300);
  const since = sinceMs > 0 ? `&since=${sinceMs + 1}` : '';
  let res: Response;
  try {
    res = await fetch(
      `https://lichess.org/api/games/user/${encodeURIComponent(username)}?max=${n}&clocks=false&evals=false&opening=true${since}`,
      { headers: { Accept: 'application/x-chess-pgn' } },
    );
  } catch {
    throw new ApiError('sync_unreachable', 'sync_unreachable');
  }
  if (res.status === 404) throw new ApiError('sync_not_found', 'sync_not_found');
  if (!res.ok) throw new ApiError(`sync_${res.status}`, 'sync_error');
  const text = (await res.text()).trim();
  // Mỗi ván bắt đầu bằng tag [Event …]
  const games = text ? text.split(/\n\s*\n(?=\[Event )/) : [];
  return {
    pgn: text,
    count: games.length,
    cursor: games.reduce((c, g) => Math.max(c, lichessStart(g)), sinceMs),
  };
}

const LABEL: Record<SyncSource, string> = { chesscom: 'Chess.com', lichess: 'Lichess' };

/** CSDL đồng bộ của người dùng cho một nguồn trong học viện; chưa có thì tạo (riêng tư). */
export async function getOrCreateSyncDatabase(
  client: ErpClient,
  academyId: string,
  userId: string,
  source: SyncSource,
  username: string,
): Promise<GameDatabase> {
  const existing = unwrap(
    await client
      .from('game_databases')
      .select('*')
      .eq('academy_id', academyId)
      .eq('created_by', userId)
      .eq('sync_source', source)
      .maybeSingle(),
  );
  if (existing) return existing;
  return unwrap(
    await client
      .from('game_databases')
      .insert({
        academy_id: academyId,
        created_by: userId,
        name: `${LABEL[source]} · ${username}`.slice(0, 120),
        visibility: 'private',
        sync_source: source,
      })
      .select()
      .single(),
  );
}

/** Lấy ván mới từ nguồn, nhập vào CSDL đồng bộ, rồi dời mốc thời gian. */
export async function syncGames(
  client: ErpClient,
  v: { academyId: string; userId: string; source: SyncSource; username: string; max?: number },
): Promise<ImportPgnResult & { databaseId: string; fetched: number }> {
  const db = await getOrCreateSyncDatabase(client, v.academyId, v.userId, v.source, v.username);
  const since = Number(db.sync_cursor ?? 0);
  const fetched =
    v.source === 'chesscom'
      ? await fetchChesscomGamesSince(v.username, since, v.max)
      : await fetchLichessGamesSince(v.username, since, v.max);
  if (fetched.count === 0) return { imported: 0, failed: 0, databaseId: db.id, fetched: 0 };
  const result = await importPgn(client, db.id, fetched.pgn);
  unwrap(
    await client.from('game_databases').update({ sync_cursor: fetched.cursor }).eq('id', db.id),
  );
  return { ...result, databaseId: db.id, fetched: fetched.count };
}
