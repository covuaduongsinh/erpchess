/**
 * Phiên làm một puzzle phía client: chấm ngay từng nước bằng `gradeMove` để phản hồi tức thì,
 * tự đi nước đáp của đối phương, ghi thời gian mỗi nước. Một "lượt thử" kết thúc khi đi sai
 * hoặc giải xong — lúc đó client nộp `moves` lên server để server chấm lại và lưu.
 * Thuần dữ liệu (không đọc đồng hồ) để test được; thời điểm `now` do nơi gọi truyền vào.
 */
import { gradeMove, type Puzzle } from './puzzle';
import { playMove } from './rules';

export type SessionMove = { uci: string; ms: number };

export type PuzzleSession = {
  /** Bước kế tiếp của lời giải mà người giải phải đi (luôn chẵn). */
  step: number;
  fen: string;
  status: 'playing' | 'wrong' | 'solved';
  /** Các nước của người giải trong lượt thử hiện tại. */
  moves: SessionMove[];
  lastMove?: readonly [string, string];
  /** Thời điểm bắt đầu tính giờ cho nước đang chờ. */
  since: number;
};

export function startPuzzleSession(puzzle: Puzzle, now: number): PuzzleSession {
  return { step: 0, fen: puzzle.fen, status: 'playing', moves: [], since: now };
}

function squares(uci: string): readonly [string, string] {
  return [uci.slice(0, 2), uci.slice(2, 4)];
}

/** Người giải đi một nước. Nước không hợp lệ (không đi được) thì giữ nguyên trạng thái. */
export function playPuzzleMove(
  puzzle: Puzzle,
  session: PuzzleSession,
  uci: string,
  now: number,
): PuzzleSession {
  if (session.status !== 'playing') return session;
  const played = playMove(session.fen, uci);
  if (!played) return session;

  const moves = [...session.moves, { uci: played.uci, ms: Math.max(0, now - session.since) }];
  const graded = gradeMove(puzzle, session.step, played.uci);
  if (graded.result === 'wrong') {
    return { ...session, fen: played.fen, status: 'wrong', moves, lastMove: squares(played.uci) };
  }
  if (graded.result === 'solved') {
    return { ...session, fen: played.fen, status: 'solved', moves, lastMove: squares(played.uci) };
  }
  const reply = playMove(played.fen, graded.reply);
  // Lời giải hỏng (nước đáp không hợp lệ) — coi như đã giải tới đây để không kẹt người học
  if (!reply) return { ...session, fen: played.fen, status: 'solved', moves };
  return {
    step: graded.nextStep,
    fen: reply.fen,
    status: 'playing',
    moves,
    lastMove: squares(reply.uci),
    since: now,
  };
}

/** Thử lại từ đầu sau khi đi sai. */
export function retryPuzzleSession(puzzle: Puzzle, now: number): PuzzleSession {
  return startPuzzleSession(puzzle, now);
}
