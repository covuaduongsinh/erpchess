// Logic thuần của script nạp kho puzzle (Giai đoạn 27c): đọc dòng CSV của Lichess, lọc chất lượng, chia tầng
// (dải rating × chủ đề chính), chia hạn ngạch và chọn ngẫu nhiên có định hướng. Tách riêng để kiểm thử.
import { csv } from './masterbase-lib.mjs';

/** Độ rộng dải rating của tầng. */
export const BUCKET = 200;

/**
 * Thứ tự ưu tiên chủ đề chính của một puzzle (chủ đề đầu tiên trong danh sách này mà puzzle có). Chủ đề nào có
 * trong tập này thì mới được đại diện riêng; còn lại vào tầng 'other'. Khớp các chủ đề có nhãn ở web
 * (packages/domain/src/puzzle-bank.ts), bỏ các nhãn độ dài/giai đoạn vì chúng không phân biệt được dạng đòn.
 */
export const THEME_PRIORITY = [
  'mateIn1',
  'mateIn2',
  'mateIn3',
  'backRankMate',
  'smotheredMate',
  'fork',
  'pin',
  'skewer',
  'discoveredAttack',
  'doubleCheck',
  'sacrifice',
  'hangingPiece',
  'trappedPiece',
  'attraction',
  'deflection',
  'interference',
  'clearance',
  'quietMove',
  'zugzwang',
  'xRayAttack',
  'intermezzo',
  'capturingDefender',
  'defensiveMove',
  'exposedKing',
  'advancedPawn',
  'promotion',
  'pawnEndgame',
  'rookEndgame',
  'bishopEndgame',
  'knightEndgame',
  'queenEndgame',
  'opening',
  'middlegame',
  'endgame',
];

const UCI = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

/** Đọc một dòng CSV của Lichess (không có dấu nháy); trả `null` nếu dòng sai định dạng/là dòng tiêu đề. */
export function parsePuzzleLine(line) {
  const f = line.split(',');
  if (f.length < 8 || f[0] === 'PuzzleId') return null;
  const [id, fen, moves, rating, rd, popularity, nbPlays, themes, , opening] = f;
  const r = Number(rating);
  if (!id || !fen || !moves || !Number.isFinite(r)) return null;
  return {
    id,
    fen,
    moves,
    rating: r,
    rd: Number(rd),
    popularity: Number(popularity),
    nbPlays: Number(nbPlays),
    themes: (themes ?? '').split(' ').filter(Boolean),
    opening: (opening ?? '').split(' ').filter(Boolean),
  };
}

/**
 * Lọc chất lượng + cấu trúc: đủ phổ biến/được chơi, rating ổn định (RD thấp), lời giải hợp lệ về hình thức
 * (nước UCI, ≥ 2 nước, phần sau nước đầu của đối thủ có số nước lẻ và ≤ maxSolution). Trả lý do loại hoặc null.
 */
export function rejectPuzzle(p, { minPopularity, minPlays, maxRd, maxSolution = 39 }) {
  if (p.fen.length < 15 || p.fen.length > 100) return 'fen';
  const moves = p.moves.split(' ');
  if (moves.length < 2 || !moves.every((m) => UCI.test(m))) return 'moves';
  const solution = moves.length - 1;
  if (solution % 2 === 0 || solution > maxSolution) return 'length';
  if (p.rating < 100 || p.rating > 4000) return 'rating';
  if (p.popularity < minPopularity) return 'popularity';
  if (p.nbPlays < minPlays) return 'plays';
  if (p.rd > maxRd) return 'rd';
  return null;
}

/** Khoá tầng: dải rating + chủ đề chính. */
export function stratumOf(p) {
  const bucket = Math.floor(p.rating / BUCKET) * BUCKET;
  const theme = THEME_PRIORITY.find((t) => p.themes.includes(t)) ?? 'other';
  return `${bucket}|${theme}`;
}

/**
 * Chia hạn ngạch `target` cho các tầng theo căn bậc hai số puzzle của tầng (làm phẳng: tầng hiếm vẫn có đại
 * diện, tầng khổng lồ không lấn át), tầng nào đủ (quota ≥ số có) thì lấy hết rồi chia lại phần còn dư cho tầng khác.
 * `counts`: Map tầng → số puzzle. Trả Map tầng → hạn ngạch (số nguyên, ≤ số có).
 */
export function allocateQuotas(counts, target) {
  const quota = new Map();
  let remaining = target;
  let open = [...counts.entries()].filter(([, c]) => c > 0);
  if (target >= open.reduce((n, [, c]) => n + c, 0)) {
    for (const [k, c] of open) quota.set(k, c);
    return quota;
  }
  while (open.length > 0 && remaining > 0) {
    const sum = open.reduce((n, [, c]) => n + Math.sqrt(c), 0);
    const capped = open.filter(([, c]) => (remaining * Math.sqrt(c)) / sum >= c);
    if (capped.length === 0) {
      for (const [k, c] of open)
        quota.set(k, Math.min(c, Math.max(1, Math.round((remaining * Math.sqrt(c)) / sum))));
      return quota;
    }
    for (const [k, c] of capped) {
      quota.set(k, c);
      remaining -= c;
    }
    open = open.filter(([k]) => !quota.has(k));
  }
  for (const [k] of open) if (!quota.has(k)) quota.set(k, 0);
  return quota;
}

/** FNV-1a 32 bit → số trong [0, 1): chọn ngẫu nhiên xác định (cùng seed cho cùng kết quả). */
export function hash01(text, seed = 1) {
  let h = 0x811c9dc5 ^ seed;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h / 4294967296;
}

/** Có chọn puzzle này không: băm id < quota/count của tầng (kỳ vọng đúng bằng quota). */
export function selected(p, counts, quotas, seed) {
  const key = stratumOf(p);
  const c = counts.get(key) ?? 0;
  const q = quotas.get(key) ?? 0;
  if (c === 0 || q === 0) return false;
  return q >= c || hash01(p.id, seed) < q / c;
}

/** Mảng Postgres dạng literal `{a,b}` (phần tử đã an toàn: chữ, số, gạch dưới). */
export const pgArray = (list) => `{${list.filter((x) => /^[\w-]+$/.test(x)).join(',')}}`;

export const PUZZLE_CSV_HEADER =
  'lichess_id,fen,moves,rating,rating_deviation,popularity,nb_plays,themes,opening_tags,source\n';

export function puzzleRow(p, source) {
  return `${[
    p.id,
    p.fen,
    p.moves,
    Math.round(p.rating),
    Math.max(0, Math.min(1000, Math.round(p.rd) || 0)),
    Math.max(-100, Math.min(100, Math.round(p.popularity) || 0)),
    Math.max(0, Math.round(p.nbPlays) || 0),
    pgArray(p.themes.slice(0, 30)),
    pgArray(p.opening.slice(0, 30)),
    source,
  ]
    .map(csv)
    .join(',')}\n`;
}

/** Ước tính dung lượng một dòng trong DB: dữ liệu + chỉ mục (unique lichess_id, GIN themes, btree rating) + chi phí dòng. */
export const estimateRowBytes = (p) =>
  p.fen.length + p.moves.length + p.themes.join(' ').length + p.opening.join(' ').length + 260;
