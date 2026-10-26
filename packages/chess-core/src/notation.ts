export type MoveNotation = 'letters' | 'figurine';

export const FIGURINE_MAP: Record<string, string> = {
  K: '♔',
  Q: '♕',
  R: '♖',
  B: '♗',
  N: '♘',
};

/**
 * Chuyển một nước cờ SAN (ví dụ Nf3, e8=Q#, Bxc6) sang ký hiệu figurine nếu notation là 'figurine'.
 * Giữ nguyên các ký hiệu đặc biệt như O-O, O-O-O, +, #, x, v.v.
 */
export function formatSan(san: string, notation: MoveNotation = 'letters'): string {
  if (notation !== 'figurine' || !san) return san;
  if (san.startsWith('O-O')) return san;

  let result = san;
  const first = result[0];
  if (first && FIGURINE_MAP[first]) {
    result = FIGURINE_MAP[first] + result.slice(1);
  }

  result = result.replace(/=([KQRBN])/g, (_, piece) => `=${FIGURINE_MAP[piece] ?? piece}`);

  return result;
}

/** Chuyển một mảng nước cờ SAN sang ký hiệu đã chọn. */
export function formatSanList(
  sans: readonly string[],
  notation: MoveNotation = 'letters',
): string[] {
  if (notation !== 'figurine') return [...sans];
  return sans.map((s) => formatSan(s, notation));
}
