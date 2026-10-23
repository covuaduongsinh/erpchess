/** Chế độ cờ mù / ẩn quân cho luyện tập và lớp học: trả về các ô có quân cần ẩn. */
import { Chess } from 'chess.js';

export type BlindMode = 'none' | 'all' | 'white' | 'black' | 'pieces';

export function hiddenSquares(fen: string, mode: BlindMode): string[] {
  if (mode === 'none') return [];
  const out: string[] = [];
  for (const row of new Chess(fen).board()) {
    for (const cell of row) {
      if (!cell) continue;
      const hide =
        mode === 'all' ||
        (mode === 'white' && cell.color === 'w') ||
        (mode === 'black' && cell.color === 'b') ||
        (mode === 'pieces' && cell.type !== 'p');
      if (hide) out.push(cell.square);
    }
  }
  return out;
}
