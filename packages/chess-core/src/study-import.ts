/**
 * Chuyển một chương study Lichess (PGN) thành hoạt động erpchess (Giai đoạn 24c, đặc tả REA: Study →
 * Import from Lichess). Chương bắt đầu từ thế cờ riêng với 1–39 nửa nước, số lẻ (người giải đi nước
 * cuối) thành **puzzle**; còn lại thành hoạt động **xem ván** giữ nguyên PGN.
 */
import { parsePgn, toPgn } from './pgn';
import { START_FEN } from './rules';

export type ImportedActivity =
  | { kind: 'puzzle'; title: string; payload: { fen: string; moves: string[] } }
  | { kind: 'game'; title: string; payload: { pgn: string } };

const MAX_PUZZLE_PLIES = 39;

function chapterTitle(headers: Record<string, string>): string {
  const name = headers.ChapterName?.trim();
  if (name) return name.slice(0, 160);
  // Lichess ghi Event là "Tên study: Tên chương"
  const event = headers.Event?.trim() ?? '';
  const i = event.indexOf(': ');
  return (i >= 0 ? event.slice(i + 2) : event).slice(0, 160);
}

/** Một chương PGN → hoạt động; null nếu không đọc được hoặc chương trống (không có nước nào). */
export function chapterToActivity(pgn: string): ImportedActivity | null {
  let tree: ReturnType<typeof parsePgn>[number] | undefined;
  try {
    [tree] = parsePgn(pgn);
  } catch {
    return null;
  }
  if (!tree) return null;
  const line = tree.mainline();
  if (line.length === 0) return null;
  const title = chapterTitle(tree.headers);
  const fen = tree.root.fen;
  if (fen !== START_FEN && line.length <= MAX_PUZZLE_PLIES && line.length % 2 === 1) {
    return { kind: 'puzzle', title, payload: { fen, moves: line.map((n) => n.uci) } };
  }
  return { kind: 'game', title, payload: { pgn: toPgn(tree) } };
}

/** Tên study từ tag StudyName (hoặc phần trước dấu ":" của Event) của chương đầu. */
export function lichessStudyName(pgn: string): string {
  const study = /\[StudyName "([^"]*)"\]/.exec(pgn)?.[1]?.trim();
  if (study) return study.slice(0, 160);
  const event = /\[Event "([^"]*)"\]/.exec(pgn)?.[1] ?? '';
  const i = event.indexOf(': ');
  return (i >= 0 ? event.slice(0, i) : event).trim().slice(0, 160);
}
