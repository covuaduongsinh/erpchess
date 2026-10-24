// Tự sinh bởi supabase/functions/sync-shared.mjs từ packages/chess-core/src/rules.ts — không sửa tay.
/** Luật cờ: bọc chess.js (BSD-2) thành các hàm thuần, nhận/trả FEN và UCI. */
import { Chess, DEFAULT_POSITION, type Move, validateFen } from 'npm:chess.js@1.4.0';

export const START_FEN = DEFAULT_POSITION;

export type Color = 'w' | 'b';
export type PlayedMove = { san: string; uci: string; fen: string };
export type GameStatus = 'checkmate' | 'stalemate' | 'draw' | 'ongoing';

const UCI_RE = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/;

/**
 * FEN đúng cú pháp VÀ là thế có thể xảy ra. validateFen của chess.js không kiểm việc bên
 * không đi đang bị chiếu; thế như vậy làm engine (Arasan) thử "ăn vua" và crash.
 */
export function isValidFen(fen: string): boolean {
  if (!validateFen(fen).ok) return false;
  const chess = new Chess(fen);
  const mover = chess.turn();
  const opponent = mover === 'w' ? 'b' : 'w';
  const [opponentKing] = chess.findPiece({ type: 'k', color: opponent });
  return opponentKing !== undefined && !chess.isAttacked(opponentKing, mover);
}

export function sideToMove(fen: string): Color {
  return fen.trim().split(/\s+/)[1] === 'b' ? 'b' : 'w';
}

/** Các ô đích hợp lệ theo ô xuất phát, dùng cho bàn cờ (tô ô có thể đi, kiểm kéo-thả). */
export function legalDests(fen: string): Map<string, string[]> {
  const dests = new Map<string, string[]>();
  for (const m of new Chess(fen).moves({ verbose: true })) {
    const list = dests.get(m.from) ?? [];
    if (!list.includes(m.to)) list.push(m.to);
    dests.set(m.from, list);
  }
  return dests;
}

/** Nước từ ô `from` tới ô `to` có phải phong cấp không (để bàn cờ hỏi chọn quân). */
export function needsPromotion(fen: string, from: string, to: string): boolean {
  return new Chess(fen)
    .moves({ verbose: true })
    .some((m) => m.from === from && m.to === to && m.isPromotion());
}

/** Đi một nước (UCI như "e7e8q" hoặc SAN như "Nf3"); null nếu không hợp lệ. */
export function playMove(fen: string, move: string): PlayedMove | null {
  const chess = new Chess(fen);
  let played: Move;
  try {
    const uci = UCI_RE.exec(move);
    played = uci
      ? chess.move({ from: uci[1] as string, to: uci[2] as string, promotion: uci[3] })
      : chess.move(move);
  } catch {
    return null;
  }
  return { san: played.san, uci: toUci(played), fen: played.after };
}

export function toUci(m: Pick<Move, 'from' | 'to' | 'promotion'>): string {
  return `${m.from}${m.to}${m.promotion ?? ''}`;
}

export function gameStatus(fen: string): GameStatus {
  const chess = new Chess(fen);
  if (chess.isCheckmate()) return 'checkmate';
  if (chess.isStalemate()) return 'stalemate';
  if (chess.isDraw()) return 'draw';
  return 'ongoing';
}

export function inCheck(fen: string): boolean {
  return new Chess(fen).inCheck();
}

/** Đổi chuỗi nước UCI (vd. PV của engine) sang SAN; dừng ở nước đầu tiên không hợp lệ. */
export function sanLine(fen: string, ucis: readonly string[]): string[] {
  const out: string[] = [];
  let current = fen;
  for (const uci of ucis) {
    const played = playMove(current, uci);
    if (!played) break;
    out.push(played.san);
    current = played.fen;
  }
  return out;
}

/** Ô vua của bên đang đi (để tô khi bị chiếu). */
export function kingSquare(fen: string): string | undefined {
  const color = sideToMove(fen);
  for (const row of new Chess(fen).board()) {
    for (const cell of row) {
      if (cell && cell.type === 'k' && cell.color === color) return cell.square;
    }
  }
  return undefined;
}
