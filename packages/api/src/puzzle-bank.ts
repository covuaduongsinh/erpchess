/** Kho puzzle Lichess (Giai đoạn 27c): tìm theo chủ đề / rating / số nước qua RPC `search_puzzle_bank`. */
import { PUZZLE_BANK_MAX_LIMIT, type PuzzleBankFilter, type PuzzleBankRow } from '@erpchess/domain';
import type { ErpClient } from './client';
import { unwrap } from './queries';

export type PuzzleBankPage = { rows: PuzzleBankRow[]; total: number };

// Hàm SQL nhận null cho tham số bỏ trống; kiểu sinh tự động không thể hiện tham số nullable
const nul = <T>(v: T | null | undefined) => (v ?? undefined) as T;

export async function searchPuzzleBank(
  client: ErpClient,
  filter: PuzzleBankFilter,
): Promise<PuzzleBankPage> {
  const limit = Math.min(Math.max(Math.floor(filter.limit), 1), PUZZLE_BANK_MAX_LIMIT);
  const data = unwrap(
    await client.rpc('search_puzzle_bank', {
      p_themes: filter.themes.length > 0 ? filter.themes : nul<string[]>(null),
      p_rating_min: nul<number>(filter.ratingMin),
      p_rating_max: nul<number>(filter.ratingMax),
      p_moves_max: nul<number>(filter.movesMax),
      p_limit: limit,
      p_offset: Math.max(Math.floor(filter.offset), 0),
    }),
  );
  const rows: PuzzleBankRow[] = data.map((r) => ({
    id: Number(r.id),
    lichessId: r.lichess_id,
    fen: r.fen,
    moves: r.moves,
    rating: r.rating,
    popularity: r.popularity,
    themes: r.themes ?? [],
  }));
  return { rows, total: Number(data[0]?.total ?? 0) };
}
