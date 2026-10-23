/** Hình học bàn cờ: ô ↔ toạ độ lưới/điểm, lật bàn, màu ô, đọc FEN. Hàm thuần, không phụ thuộc React. */

export type Orientation = 'w' | 'b';
export type PieceCode = `${'w' | 'b'}${'K' | 'Q' | 'R' | 'B' | 'N' | 'P'}`;

const FILES = 'abcdefgh';

export const SQUARES: string[] = [];
for (let rank = 8; rank >= 1; rank--) {
  for (const file of FILES) SQUARES.push(`${file}${rank}`);
}

function fileIndex(square: string): number {
  return FILES.indexOf(square[0] as string);
}

function rankIndex(square: string): number {
  return Number(square[1]) - 1;
}

/** Vị trí ô trên lưới 8×8 (cột, hàng từ trên xuống) theo hướng nhìn. */
export function squareToGrid(
  square: string,
  orientation: Orientation,
): { col: number; row: number } {
  const f = fileIndex(square);
  const r = rankIndex(square);
  return orientation === 'w' ? { col: f, row: 7 - r } : { col: 7 - f, row: r };
}

function gridToSquare(col: number, row: number, orientation: Orientation): string {
  const f = orientation === 'w' ? col : 7 - col;
  const r = orientation === 'w' ? 7 - row : row;
  return `${FILES[f]}${r + 1}`;
}

/** Ô tại điểm (x, y) trong bàn cờ kích thước `size`; null nếu nằm ngoài bàn. */
export function pointToSquare(
  x: number,
  y: number,
  size: number,
  orientation: Orientation,
): string | null {
  if (x < 0 || y < 0 || x >= size || y >= size) return null;
  const cell = size / 8;
  return gridToSquare(Math.floor(x / cell), Math.floor(y / cell), orientation);
}

export function squareColor(square: string): 'light' | 'dark' {
  return (fileIndex(square) + rankIndex(square)) % 2 === 0 ? 'dark' : 'light';
}

/** Đọc phần xếp quân của FEN thành map ô → mã quân (vd. "e4" → "wP"). */
export function parseBoard(fen: string): Map<string, PieceCode> {
  const pieces = new Map<string, PieceCode>();
  const rows = (fen.trim().split(/\s+/)[0] ?? '').split('/');
  rows.forEach((row, i) => {
    let file = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) {
        file += Number(ch);
        continue;
      }
      const color = ch === ch.toUpperCase() ? 'w' : 'b';
      pieces.set(`${FILES[file]}${8 - i}`, `${color}${ch.toUpperCase()}` as PieceCode);
      file++;
    }
  });
  return pieces;
}

const DIRECTIONS: Record<string, { col: number; row: number }> = {
  ArrowUp: { col: 0, row: -1 },
  ArrowDown: { col: 0, row: 1 },
  ArrowLeft: { col: -1, row: 0 },
  ArrowRight: { col: 1, row: 0 },
};

/** Ô kế tiếp khi điều hướng bằng phím mũi tên (theo hướng hiển thị, dừng ở mép bàn). */
export function moveFocus(square: string, key: string, orientation: Orientation): string {
  const d = DIRECTIONS[key];
  if (!d) return square;
  const { col, row } = squareToGrid(square, orientation);
  const c = Math.min(7, Math.max(0, col + d.col));
  const r = Math.min(7, Math.max(0, row + d.row));
  return gridToSquare(c, r, orientation);
}
