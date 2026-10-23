/**
 * Hoạt động "bắt quân": bàn chỉ có quân của học viên (phe đến lượt trong FEN) và quân đối phương
 * đứng yên làm mục tiêu, thường không có vua. Không xét chiếu; đối phương không bao giờ đi.
 * Học viên được đi cả nước thường để dàn quân, mục tiêu là bắt hết quân đối phương.
 * Thuần TS, không dùng chess.js vì chess.js từ chối thế cờ không có vua.
 */

type Side = 'w' | 'b';
type Board = (string | null)[]; // 64 ô, chỉ số 0 = a8, 63 = h1

const FILES = 'abcdefgh';
const KNIGHT: readonly [number, number][] = [
  [1, 2],
  [2, 1],
  [2, -1],
  [1, -2],
  [-1, -2],
  [-2, -1],
  [-2, 1],
  [-1, 2],
];
const ROOK_DIRS: readonly [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];
const BISHOP_DIRS: readonly [number, number][] = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

type Parsed = { board: Board; side: Side };

function parse(fen: string): Parsed | null {
  const [placement, side] = fen.trim().split(/\s+/);
  if (!placement || (side !== 'w' && side !== 'b')) return null;
  const rows = placement.split('/');
  if (rows.length !== 8) return null;
  const board: Board = [];
  for (const row of rows) {
    let count = 0;
    for (const ch of row) {
      if (/[1-8]/.test(ch)) {
        for (let i = 0; i < Number(ch); i++) board.push(null);
        count += Number(ch);
      } else if (/[pnbrqkPNBRQK]/.test(ch)) {
        board.push(ch);
        count++;
      } else {
        return null;
      }
    }
    if (count !== 8) return null;
  }
  return { board, side };
}

function serialize({ board, side }: Parsed): string {
  const rows: string[] = [];
  for (let r = 0; r < 8; r++) {
    let row = '';
    let empty = 0;
    for (let f = 0; f < 8; f++) {
      const piece = board[r * 8 + f];
      if (piece) {
        if (empty) row += empty;
        row += piece;
        empty = 0;
      } else {
        empty++;
      }
    }
    rows.push(empty ? row + empty : row);
  }
  return `${rows.join('/')} ${side} - - 0 1`;
}

const own = (piece: string | null, side: Side) =>
  !!piece && (side === 'w' ? piece === piece.toUpperCase() : piece === piece.toLowerCase());
const square = (i: number) => `${FILES[i % 8]}${8 - Math.floor(i / 8)}`;
function index(sq: string): number | null {
  const f = FILES.indexOf(sq[0] ?? '');
  const r = Number(sq[1]);
  return f >= 0 && r >= 1 && r <= 8 && sq.length === 2 ? (8 - r) * 8 + f : null;
}

/** Các ô đích của quân ở ô `from` (không kiểm tra quân đó thuộc phe nào). */
function targetsFrom(board: Board, from: number, side: Side): number[] {
  const piece = (board[from] ?? '').toLowerCase();
  const f = from % 8;
  const r = Math.floor(from / 8);
  const out: number[] = [];
  const at = (df: number, dr: number) => {
    const nf = f + df;
    const nr = r + dr;
    return nf >= 0 && nf < 8 && nr >= 0 && nr < 8 ? nr * 8 + nf : null;
  };
  const step = (df: number, dr: number) => {
    const to = at(df, dr);
    if (to !== null && !own(board[to] ?? null, side)) out.push(to);
  };
  const slide = (dirs: readonly [number, number][]) => {
    for (const [df, dr] of dirs) {
      for (let k = 1; k < 8; k++) {
        const to = at(df * k, dr * k);
        if (to === null) break;
        const occupant = board[to] ?? null;
        if (own(occupant, side)) break;
        out.push(to);
        if (occupant) break;
      }
    }
  };
  switch (piece) {
    case 'n':
      for (const [df, dr] of KNIGHT) step(df, dr);
      break;
    case 'b':
      slide(BISHOP_DIRS);
      break;
    case 'r':
      slide(ROOK_DIRS);
      break;
    case 'q':
      slide([...ROOK_DIRS, ...BISHOP_DIRS]);
      break;
    case 'k':
      for (const [df, dr] of [...ROOK_DIRS, ...BISHOP_DIRS]) step(df, dr);
      break;
    case 'p': {
      // Hàng (row) 0 là hàng 8: trắng đi lên (dr = -1), đen đi xuống
      const dir = side === 'w' ? -1 : 1;
      const startRow = side === 'w' ? 6 : 1;
      const one = at(0, dir);
      if (one !== null && !board[one]) {
        out.push(one);
        const two = at(0, 2 * dir);
        if (r === startRow && two !== null && !board[two]) out.push(two);
      }
      for (const df of [-1, 1]) {
        const to = at(df, dir);
        const occupant = to === null ? null : (board[to] ?? null);
        if (to !== null && occupant && !own(occupant, side)) out.push(to);
      }
      break;
    }
  }
  return out;
}

/** Số quân đối phương còn trên bàn; 0 khi FEN không hợp lệ. */
export function captureTargets(fen: string): number {
  const p = parse(fen);
  if (!p) return 0;
  return p.board.filter((piece) => piece && !own(piece, p.side)).length;
}

/** Ô đi được của mọi quân phe đến lượt, dạng dùng cho prop `movable.dests` của bàn cờ. */
export function captureDests(fen: string): Map<string, string[]> {
  const dests = new Map<string, string[]>();
  const p = parse(fen);
  if (!p) return dests;
  p.board.forEach((piece, i) => {
    if (!own(piece, p.side)) return;
    const to = targetsFrom(p.board, i, p.side);
    if (to.length) dests.set(square(i), to.map(square));
  });
  return dests;
}

export type CaptureMove = { fen: string; captured: boolean };

/** Đi một nước dạng UCI; `null` nếu sai luật. Tốt lên hàng cuối mặc định phong hậu. */
export function playCaptureMove(fen: string, uci: string): CaptureMove | null {
  const p = parse(fen);
  const m = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(uci);
  if (!p || !m) return null;
  const from = index(m[1] ?? '');
  const to = index(m[2] ?? '');
  if (from === null || to === null || !own(p.board[from] ?? null, p.side)) return null;
  if (!targetsFrom(p.board, from, p.side).includes(to)) return null;

  const board = [...p.board];
  const captured = !!board[to];
  let piece = board[from] ?? '';
  const lastRow = p.side === 'w' ? 0 : 7;
  if (piece.toLowerCase() === 'p' && Math.floor(to / 8) === lastRow) {
    const promo = m[3] ?? 'q';
    piece = p.side === 'w' ? promo.toUpperCase() : promo;
  }
  board[to] = piece;
  board[from] = null;
  return { fen: serialize({ board, side: p.side }), captured };
}

export type CaptureGrade = {
  solved: boolean;
  captured: number;
  remaining: number;
  /** Số nước hợp lệ đã đi trước nước sai đầu tiên (hoặc tất cả). */
  legalMoves: number;
};

/** Chấm một chuỗi nước: dừng ở nước sai luật đầu tiên hoặc khi đã bắt hết. */
export function gradeCapture(fen: string, moves: readonly string[]): CaptureGrade {
  let current = fen;
  let captured = 0;
  let legalMoves = 0;
  for (const uci of moves) {
    if (captureTargets(current) === 0) break;
    const next = playCaptureMove(current, uci);
    if (!next) break;
    legalMoves++;
    if (next.captured) captured++;
    current = next.fen;
  }
  const remaining = captureTargets(current);
  return { solved: remaining === 0, captured, remaining, legalMoves };
}

/**
 * Số nước ít nhất để bắt hết (tìm theo chiều rộng), `null` nếu không thể hoặc vượt giới hạn.
 * Dùng ở trình soạn để chặn lưu bài không giải được.
 */
export function solveCapture(fen: string, maxMoves = 40, maxNodes = 200_000): number | null {
  if (!parse(fen)) return null;
  if (captureTargets(fen) === 0) return 0;
  const key = (f: string) => f.split(' ')[0] ?? f;
  const seen = new Set([key(fen)]);
  let frontier = [fen];
  for (let depth = 1; depth <= maxMoves && frontier.length; depth++) {
    const next: string[] = [];
    for (const position of frontier) {
      for (const [from, tos] of captureDests(position)) {
        for (const to of tos) {
          const moved = playCaptureMove(position, from + to);
          if (!moved) continue;
          if (captureTargets(moved.fen) === 0) return depth;
          const k = key(moved.fen);
          if (seen.has(k)) continue;
          seen.add(k);
          if (seen.size > maxNodes) return null;
          next.push(moved.fen);
        }
      }
    }
    frontier = next;
  }
  return null;
}
