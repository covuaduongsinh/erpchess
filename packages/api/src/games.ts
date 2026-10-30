/** Ván đấu (Giai đoạn 9): ghép cặp, danh sách, thao tác qua trọng tài `game-move`, ván đánh máy. */
import { categoryOf, START_FEN } from '@erpchess/chess-core';
import type { ErpClient } from './client';
import type { Tables } from './database.types';
import { invokeEdge } from './edge';
import { unwrap } from './queries';

export type GameRow = Tables<'games'>;
export type GameAction =
  | 'move'
  | 'resign'
  | 'offer_draw'
  | 'accept_draw'
  | 'decline_draw'
  | 'abort'
  | 'claim_timeout';

/** Các mức thời gian hay dùng (phút + giây cộng thêm). */
export const TIME_PRESETS = [
  { id: '3+2', baseMs: 180_000, incMs: 2_000 },
  { id: '5+0', baseMs: 300_000, incMs: 0 },
  { id: '10+0', baseMs: 600_000, incMs: 0 },
  { id: '15+10', baseMs: 900_000, incMs: 10_000 },
  { id: '30+0', baseMs: 1_800_000, incMs: 0 },
] as const;

/** HLV ghép cặp hai thành viên; ván bắt đầu ngay (đồng hồ chạy từ sau nước đầu của Đen). */
export async function createPairing(
  client: ErpClient,
  userId: string,
  v: {
    academyId: string;
    whiteId: string;
    blackId: string;
    baseMs: number | null;
    incMs: number;
    rated: boolean;
  },
): Promise<GameRow> {
  if (v.whiteId === v.blackId) throw new Error('same_player');
  return unwrap(
    await client
      .from('games')
      .insert({
        academy_id: v.academyId,
        white_id: v.whiteId,
        black_id: v.blackId,
        fen: START_FEN,
        base_ms: v.baseMs,
        inc_ms: v.incMs,
        white_ms: v.baseMs,
        black_ms: v.baseMs,
        rated: v.rated,
        category: v.baseMs === null ? null : categoryOf({ baseMs: v.baseMs, incMs: v.incMs }),
        created_by: userId,
      })
      .select()
      .single(),
  );
}

/**
 * Thách đấu một thành viên khác (học viên tự thách đấu được): đi qua RPC `create_challenge` vì RLS
 * chỉ cho staff chèn ván trực tiếp. Trả id ván mới.
 */
export async function createChallenge(
  client: ErpClient,
  v: {
    academyId: string;
    opponentId: string;
    color: 'w' | 'b' | 'random';
    baseMs: number | null;
    incMs: number;
    rated: boolean;
  },
): Promise<string> {
  return unwrap(
    await client.rpc('create_challenge', {
      p_academy: v.academyId,
      p_opponent: v.opponentId,
      p_color: v.color,
      p_base_ms: v.baseMs,
      p_inc_ms: v.incMs,
      p_rated: v.rated,
    }),
  );
}

export async function fetchGames(
  client: ErpClient,
  academyId: string,
  filter: { status?: GameRow['status'][]; playerId?: string; since?: Date; limit?: number } = {},
): Promise<GameRow[]> {
  let q = client.from('games').select('*').eq('academy_id', academyId);
  if (filter.status) q = q.in('status', filter.status);
  if (filter.playerId) q = q.or(`white_id.eq.${filter.playerId},black_id.eq.${filter.playerId}`);
  if (filter.since) q = q.gte('created_at', filter.since.toISOString());
  return unwrap(await q.order('created_at', { ascending: false }).limit(filter.limit ?? 100));
}

export async function fetchGame(client: ErpClient, id: string): Promise<GameRow> {
  return unwrap(await client.from('games').select('*').eq('id', id).single());
}

/** Gửi thao tác tới trọng tài; trả ván sau khi server ghi (hoặc `{ok:true}` khi không đổi gì). */
export function gameAction(
  client: ErpClient,
  gameId: string,
  action: GameAction,
  extra: { move?: string; ply?: number } = {},
) {
  return invokeEdge<GameRow | { ok: true }>(client, 'game-move', { gameId, action, ...extra });
}

/** Lưu ván đánh máy đã xong (không tính rating). */
export async function saveBotGame(
  client: ErpClient,
  userId: string,
  v: {
    academyId: string;
    color: 'w' | 'b';
    botElo: number | null;
    initialFen: string;
    moves: string[];
    fen: string;
    result: '1-0' | '0-1' | '1/2-1/2';
    reason: GameRow['reason'];
    pgn: string;
  },
): Promise<GameRow> {
  const now = new Date().toISOString();
  return unwrap(
    await client
      .from('games')
      .insert({
        academy_id: v.academyId,
        white_id: v.color === 'w' ? userId : null,
        black_id: v.color === 'b' ? userId : null,
        bot_elo: v.botElo ?? 0,
        initial_fen: v.initialFen,
        moves: v.moves,
        fen: v.fen,
        status: 'finished',
        result: v.result,
        reason: v.reason,
        pgn: v.pgn,
        created_by: userId,
        started_at: now,
        finished_at: now,
      })
      .select()
      .single(),
  );
}

/** Nghe trạng thái ván qua kênh Realtime riêng tư `game:<id>` (do trigger CSDL phát). */
export function subscribeGame(
  client: ErpClient,
  gameId: string,
  onState: (patch: Partial<GameRow>) => void,
): () => void {
  const channel = client
    .channel(`game:${gameId}`, { config: { private: true } })
    .on('broadcast', { event: 'state' }, ({ payload }) => onState(payload as Partial<GameRow>))
    .subscribe();
  return () => {
    void client.removeChannel(channel);
  };
}

/** Trạng thái hàng đợi tìm trận nhanh (Giai đoạn 22c), đọc từ RPC `quick_pair`. */
export type QuickPairState =
  | { status: 'waiting'; rating: number; window: number; waitedMs: number }
  | { status: 'matched'; gameId: string }
  | { status: 'cancelled' };

export function parseQuickPair(raw: unknown): QuickPairState {
  const r = (raw ?? {}) as Record<string, unknown>;
  if (r.status === 'matched' && typeof r.game_id === 'string') {
    return { status: 'matched', gameId: r.game_id };
  }
  if (r.status === 'waiting') {
    return {
      status: 'waiting',
      rating: Math.round(Number(r.rating) || 0),
      window: Number(r.window) || 0,
      waitedMs: Number(r.waited_ms) || 0,
    };
  }
  return { status: 'cancelled' };
}

/** Xếp hàng (hoặc báo còn chờ) và thử ghép với người gần Elo nhất cùng mức thời gian. */
export async function quickPair(
  client: ErpClient,
  academyId: string,
  tc: { baseMs: number; incMs: number },
): Promise<QuickPairState> {
  return parseQuickPair(
    unwrap(
      await client.rpc('quick_pair', {
        p_academy: academyId,
        p_base_ms: tc.baseMs,
        p_inc_ms: tc.incMs,
      }),
    ),
  );
}

/** Rời hàng đợi; trả `matched` nếu đã kịp được ghép trước khi huỷ. */
export async function cancelQuickPair(
  client: ErpClient,
  academyId: string,
): Promise<QuickPairState> {
  return parseQuickPair(unwrap(await client.rpc('cancel_quick_pair', { p_academy: academyId })));
}
