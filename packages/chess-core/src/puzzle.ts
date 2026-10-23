/**
 * Chấm bài puzzle. Lời giải là chuỗi UCI xen kẽ: nước của người giải ở bước chẵn (0, 2, 4…),
 * nước đáp của đối phương ở bước lẻ. Thế cờ ban đầu là thế người giải phải đi.
 */
import { Chess } from 'chess.js';
import { type Color, playMove, sideToMove } from './rules';

export type Puzzle = { fen: string; moves: string[] };

export type GradeResult =
  | { result: 'wrong' }
  | { result: 'correct'; reply: string; nextStep: number }
  | { result: 'solved' };

export function puzzleSideToMove(puzzle: Puzzle): Color {
  return sideToMove(puzzle.fen);
}

/** FEN tại bước `step` (sau khi đã đi `step` nước đầu của lời giải). */
export function puzzleFenAt(puzzle: Puzzle, step: number): string | null {
  let fen = puzzle.fen;
  for (const uci of puzzle.moves.slice(0, step)) {
    const played = playMove(fen, uci);
    if (!played) return null;
    fen = played.fen;
  }
  return fen;
}

export function gradeMove(puzzle: Puzzle, step: number, uci: string): GradeResult {
  const expected = puzzle.moves[step];
  if (expected === undefined || step % 2 !== 0) return { result: 'wrong' };
  const fen = puzzleFenAt(puzzle, step);
  if (!fen) return { result: 'wrong' };
  const played = playMove(fen, uci);
  if (!played) return { result: 'wrong' };

  const isLast = step === puzzle.moves.length - 1;
  const matches = played.uci === expected.toLowerCase();
  // Nước cuối là chiếu hết: chấp nhận mọi nước chiếu hết khác (thế có thể có nhiều cách hết)
  const acceptedMate = isLast && !matches && new Chess(played.fen).isCheckmate();
  if (!matches && !acceptedMate) return { result: 'wrong' };
  if (isLast) return { result: 'solved' };

  const reply = puzzle.moves[step + 1];
  if (reply === undefined) return { result: 'solved' };
  return { result: 'correct', reply, nextStep: step + 2 };
}
