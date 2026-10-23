// Bộ quân "celtic" của Maurizio Monge (MIT, xem pieces/celtic/LICENSE), lấy từ repo Arasan.

import type { PieceCode } from './geometry';
import bB from './pieces/celtic/bB.svg';
import bK from './pieces/celtic/bK.svg';
import bN from './pieces/celtic/bN.svg';
import bP from './pieces/celtic/bP.svg';
import bQ from './pieces/celtic/bQ.svg';
import bR from './pieces/celtic/bR.svg';
import wB from './pieces/celtic/wB.svg';
import wK from './pieces/celtic/wK.svg';
import wN from './pieces/celtic/wN.svg';
import wP from './pieces/celtic/wP.svg';
import wQ from './pieces/celtic/wQ.svg';
import wR from './pieces/celtic/wR.svg';

export const CELTIC: Record<PieceCode, string> = { bB, bK, bN, bP, bQ, bR, wB, wK, wN, wP, wQ, wR };

const NAMES_VI: Record<string, string> = {
  K: 'Vua',
  Q: 'Hậu',
  R: 'Xe',
  B: 'Tượng',
  N: 'Mã',
  P: 'Tốt',
};

/** Tên quân cho trình đọc màn hình, vd. "Mã trắng". */
export function pieceLabel(code: PieceCode): string {
  return `${NAMES_VI[code[1] as string]} ${code[0] === 'w' ? 'trắng' : 'đen'}`;
}
