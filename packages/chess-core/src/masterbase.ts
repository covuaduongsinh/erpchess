/**
 * Khoá thế cờ cho Masterbase (Giai đoạn 23b): 3 trường đầu của FEN — xếp quân, bên đi, quyền nhập
 * thành. Bỏ ô bắt tốt qua đường vì mỗi thư viện ghi khác nhau (có nơi chỉ ghi khi bắt được), và
 * bỏ bộ đếm nước. Script nạp dữ liệu (`scripts/masterbase-export.mjs`) phải dùng cùng công thức.
 */
import { START_FEN } from './rules';

export const MASTERBASE_INDEX_PLIES = 40;

export function positionKey(fen: string): string {
  return fen.trim().split(/\s+/).slice(0, 3).join(' ');
}

const START_KEY = positionKey(START_FEN);

/**
 * Tham số lọc gửi lên `search_masterbase`. Thế khởi đầu không lọc (mọi ván đều đi qua), và thế
 * quá sâu (sau số nửa nước đã lập chỉ mục) chỉ tìm được nếu nằm trong phần đầu ván đã lưu.
 */
export function masterbaseFilter(opts: {
  fen: string;
  byPosition: boolean;
  under20Moves: boolean;
  elo2500: boolean;
}): { position: string | null; maxPlies: number | null; minElo: number | null } {
  const key = positionKey(opts.fen);
  return {
    position: opts.byPosition && key !== START_KEY ? key : null,
    maxPlies: opts.under20Moves ? 39 : null,
    minElo: opts.elo2500 ? 2500 : null,
  };
}
