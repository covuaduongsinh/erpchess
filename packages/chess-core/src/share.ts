/**
 * Nhận diện thế cờ (FEN) hoặc ván cờ (PGN) trong một tin nhắn chat (Giai đoạn 21a).
 * Tin nhắn vẫn lưu dạng văn bản; giao diện dùng kết quả ở đây để vẽ bàn cờ nhỏ hoặc thẻ ván.
 */
import { type GameSummary, gameSummary } from './games';
import { parsePgn } from './pgn';
import { isValidFen } from './rules';

export type ChessShare =
  | { kind: 'fen'; fen: string; before: string; after: string }
  | { kind: 'pgn'; pgn: string; summary: GameSummary; finalFen: string };

const RANK = '[pnbrqkPNBRQK1-8]{1,8}';
const FEN_RE = new RegExp(
  `(${RANK}(?:/${RANK}){7}) ([wb]) (-|[KQkq]{1,4}) (-|[a-h][36])(?: (\\d{1,3}) (\\d{1,4}))?`,
);
const PGN_TAG_RE = /^\s*\[[A-Za-z]+\s+"[^"]*"\]/m;
const PGN_MOVES_RE = /(^|\s)1\.\s*[KQRBNa-hO]/;

function detectPgn(body: string): ChessShare | null {
  if (!PGN_TAG_RE.test(body) && !PGN_MOVES_RE.test(body)) return null;
  try {
    const [tree] = parsePgn(body);
    if (!tree) return null;
    const line = tree.mainline();
    const last = line.at(-1);
    if (!last) return null;
    return { kind: 'pgn', pgn: body.trim(), summary: gameSummary(tree), finalFen: last.fen };
  } catch {
    return null;
  }
}

function detectFen(body: string): ChessShare | null {
  const m = FEN_RE.exec(body);
  if (!m) return null;
  const [raw, board, side, castling, ep, half, full] = m;
  const fen = `${board} ${side} ${castling} ${ep} ${half ?? '0'} ${full ?? '1'}`;
  if (!isValidFen(fen)) return null;
  return {
    kind: 'fen',
    fen,
    before: body.slice(0, m.index).trim(),
    after: body.slice(m.index + raw.length).trim(),
  };
}

/** PGN được ưu tiên (một PGN có thể chứa tag FEN); không nhận ra gì thì trả null. */
export function detectChessShare(body: string): ChessShare | null {
  return detectPgn(body) ?? detectFen(body);
}
