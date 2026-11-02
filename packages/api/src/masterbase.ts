/** Masterbase (Giai đoạn 23b): kho ván cao thủ dùng chung, tìm theo thế cờ, Elo, độ dài. */
import type { ErpClient } from './client';
import { unwrap } from './queries';

export const MASTERBASE_PAGE_SIZE = 20;

export type MasterbaseRow = {
  id: number;
  white: string;
  black: string;
  whiteElo: number | null;
  blackElo: number | null;
  result: string;
  event: string;
  date: string;
  eco: string;
  plyCount: number;
};

export type MasterbaseQuery = {
  position: string | null;
  maxPlies: number | null;
  minElo: number | null;
  /** Gồm ván engine (TCEC…); mặc định false = ẩn. */
  includeEngines?: boolean;
  page: number;
};

/** Khoá cache TanStack Query: mọi trường ảnh hưởng kết quả phải có mặt (thiếu thì đổi bộ lọc vẫn trả dữ liệu cũ). */
export function masterbaseQueryKey(q: MasterbaseQuery) {
  return [
    'masterbase',
    q.position,
    q.maxPlies,
    q.minElo,
    q.includeEngines ?? false,
    q.page,
  ] as const;
}

export async function searchMasterbase(
  client: ErpClient,
  q: MasterbaseQuery,
): Promise<{ rows: MasterbaseRow[]; total: number }> {
  const data = unwrap(
    await client.rpc('search_masterbase', {
      p_position: q.position,
      p_max_plies: q.maxPlies,
      p_min_elo: q.minElo,
      p_include_engines: q.includeEngines ?? false,
      p_limit: MASTERBASE_PAGE_SIZE,
      p_offset: Math.max(0, q.page) * MASTERBASE_PAGE_SIZE,
    }),
  );
  return {
    total: Number(data[0]?.total ?? 0),
    rows: data.map((r) => ({
      id: r.id,
      white: r.white,
      black: r.black,
      whiteElo: r.white_elo,
      blackElo: r.black_elo,
      result: r.result,
      event: r.event,
      date: r.date,
      eco: r.eco,
      plyCount: r.ply_count,
    })),
  };
}

/** PGN đầy đủ của một ván để nạp vào bàn phân tích. */
export async function fetchMasterbasePgn(client: ErpClient, id: number): Promise<string> {
  const row = unwrap(await client.from('masterbase_games').select('pgn').eq('id', id).single());
  return row.pgn;
}
