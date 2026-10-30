// Bộ quân "celtic" và "spatial" của Maurizio Monge (MIT, xem pieces/<bộ>/LICENSE), lấy từ repo Arasan.

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
import sbB from './pieces/spatial/bB.svg';
import sbK from './pieces/spatial/bK.svg';
import sbN from './pieces/spatial/bN.svg';
import sbP from './pieces/spatial/bP.svg';
import sbQ from './pieces/spatial/bQ.svg';
import sbR from './pieces/spatial/bR.svg';
import swB from './pieces/spatial/wB.svg';
import swK from './pieces/spatial/wK.svg';
import swN from './pieces/spatial/wN.svg';
import swP from './pieces/spatial/wP.svg';
import swQ from './pieces/spatial/wQ.svg';
import swR from './pieces/spatial/wR.svg';

export const CELTIC: Record<PieceCode, string> = { bB, bK, bN, bP, bQ, bR, wB, wK, wN, wP, wQ, wR };

export const SPATIAL: Record<PieceCode, string> = {
  bB: sbB,
  bK: sbK,
  bN: sbN,
  bP: sbP,
  bQ: sbQ,
  bR: sbR,
  wB: swB,
  wK: swK,
  wN: swN,
  wP: swP,
  wQ: swQ,
  wR: swR,
};

export type PieceSet = 'celtic' | 'spatial';

export const PIECE_SETS: Record<PieceSet, Record<PieceCode, string>> = {
  celtic: CELTIC,
  spatial: SPATIAL,
};

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
