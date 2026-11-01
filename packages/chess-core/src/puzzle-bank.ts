/**
 * Kho puzzle Lichess (Giai đoạn 27c). Lichess lưu `FEN` là thế TRƯỚC nước đầu của đối thủ và `Moves` là các
 * nước UCI (nước đầu của đối thủ, rồi xen kẽ người giải/đối thủ). Hoạt động puzzle của study dùng thế mà người
 * giải phải đi (sau nước đầu của đối thủ) và lời giải xen kẽ bắt đầu từ người giải, kết thúc ở người giải.
 */
import { Chess } from 'chess.js';

export type StudyPuzzle = { fen: string; moves: string[] };

const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;
/** Hoạt động puzzle tối đa 39 nước (lẻ, kết thúc ở người giải). */
export const MAX_PUZZLE_MOVES = 39;

/**
 * Đổi một puzzle Lichess thành puzzle của study: đi nước đầu của đối thủ để ra thế mới, phần còn lại là lời
 * giải. Trả `null` nếu dữ liệu sai (FEN/nước không hợp lệ hoặc đi sai luật, số nước còn lại không lẻ hay quá dài).
 */
export function lichessToStudyPuzzle(fen: string, moves: string): StudyPuzzle | null {
  const list = moves.trim().split(/\s+/).filter(Boolean);
  if (list.length < 2 || !list.every((m) => UCI.test(m))) return null;
  const [first, ...rest] = list as [string, ...string[]];
  if (rest.length % 2 === 0 || rest.length > MAX_PUZZLE_MOVES) return null;

  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return null;
  }
  const play = (uci: string) => {
    try {
      return chess.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        ...(uci.length === 5 ? { promotion: uci[4] } : {}),
      });
    } catch {
      return null;
    }
  };
  if (!play(first)) return null;
  const start = chess.fen();
  // Mọi nước còn lại phải đi được theo luật (loại dữ liệu hỏng)
  for (const m of rest) if (!play(m)) return null;
  return { fen: start, moves: rest };
}
