/**
 * Ván đấu do server làm trọng tài: đi lại toàn bộ danh sách nước trên một đối tượng chess.js để
 * phát hiện cả lặp lại 3 lần (gameStatus(fen) chỉ thấy một thế nên không biết lịch sử).
 */
import { Chess } from 'chess.js';
import type { Color } from './rules';

export type GameEnd = 'checkmate' | 'stalemate' | 'repetition' | 'insufficient' | 'fifty';
export type GameResultCode = '1-0' | '0-1' | '1/2-1/2';
export type Replay = {
  fen: string;
  sans: string[];
  turn: Color;
  status: 'ongoing' | GameEnd;
};

const UCI_RE = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/;

/** Đi lại ván từ thế đầu; `null` nếu có nước không hợp lệ. */
export function replayGame(initialFen: string, moves: readonly string[]): Replay | null {
  const chess = new Chess(initialFen);
  const sans: string[] = [];
  for (const uci of moves) {
    const m = UCI_RE.exec(uci);
    if (!m) return null;
    try {
      sans.push(chess.move({ from: m[1] as string, to: m[2] as string, promotion: m[3] }).san);
    } catch {
      return null;
    }
  }
  let status: Replay['status'] = 'ongoing';
  if (chess.isCheckmate()) status = 'checkmate';
  else if (chess.isStalemate()) status = 'stalemate';
  else if (chess.isInsufficientMaterial()) status = 'insufficient';
  else if (chess.isThreefoldRepetition()) status = 'repetition';
  else if (chess.isDrawByFiftyMoves()) status = 'fifty';
  return { fen: chess.fen(), sans, turn: chess.turn(), status };
}

/** Kết quả khi ván tự kết thúc: bị chiếu hết thì bên đang đi thua, còn lại là hoà. */
export function resultOf(end: GameEnd, turn: Color): GameResultCode {
  if (end === 'checkmate') return turn === 'w' ? '0-1' : '1-0';
  return '1/2-1/2';
}

/** Bên `loser` thua (đầu hàng, hết giờ). */
export function lossFor(loser: Color): GameResultCode {
  return loser === 'w' ? '0-1' : '1-0';
}

/** PGN gọn cho ván đã chơi (thêm SetUp/FEN khi không bắt đầu từ thế chuẩn). */
export function formatPgn(opts: {
  headers: Record<string, string>;
  initialFen: string;
  sans: readonly string[];
  result: GameResultCode | '*';
}): string {
  const start = new Chess(opts.initialFen);
  const custom = start.fen() !== new Chess().fen();
  const headers: Record<string, string> = { ...opts.headers, Result: opts.result };
  if (custom) {
    headers.SetUp = '1';
    headers.FEN = opts.initialFen;
  }
  const tags = Object.entries(headers)
    .map(([k, v]) => `[${k} "${v.replace(/["\\]/g, '')}"]`)
    .join('\n');
  let moveNo = start.moveNumber();
  let white = start.turn() === 'w';
  const parts: string[] = [];
  opts.sans.forEach((san, i) => {
    if (white) parts.push(`${moveNo}. ${san}`);
    else parts.push(i === 0 ? `${moveNo}... ${san}` : san);
    if (!white) moveNo++;
    white = !white;
  });
  parts.push(opts.result);
  return `${tags}\n\n${parts.join(' ')}\n`;
}
