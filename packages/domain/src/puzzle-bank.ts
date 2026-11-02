/**
 * Kho puzzle (Giai đoạn 27c): nhãn chủ đề tiếng Việt/Anh cho các chủ đề phổ biến của Lichess, bộ lọc tìm kiếm
 * và gợi ý chọn "trải đều rating" bằng quy tắc (thay cho AI).
 */
export type PuzzleThemeLabel = { key: string; vi: string; en: string };

/** ~35 chủ đề phổ biến của kho puzzle Lichess, xếp theo nhóm để hiện bộ lọc. */
export const PUZZLE_THEMES: readonly PuzzleThemeLabel[] = [
  // Chiếu hết
  { key: 'mate', vi: 'Chiếu hết', en: 'Checkmate' },
  { key: 'mateIn1', vi: 'Chiếu hết 1 nước', en: 'Mate in 1' },
  { key: 'mateIn2', vi: 'Chiếu hết 2 nước', en: 'Mate in 2' },
  { key: 'mateIn3', vi: 'Chiếu hết 3 nước', en: 'Mate in 3' },
  { key: 'backRankMate', vi: 'Chiếu hết hàng cuối', en: 'Back rank mate' },
  { key: 'smotheredMate', vi: 'Chiếu hết ngạt thở', en: 'Smothered mate' },
  // Đòn chiến thuật
  { key: 'fork', vi: 'Đòn đôi (fork)', en: 'Fork' },
  { key: 'pin', vi: 'Ghim', en: 'Pin' },
  { key: 'skewer', vi: 'Xiên (skewer)', en: 'Skewer' },
  { key: 'discoveredAttack', vi: 'Chiếu lộ', en: 'Discovered attack' },
  { key: 'doubleCheck', vi: 'Chiếu kép', en: 'Double check' },
  { key: 'sacrifice', vi: 'Hy sinh quân', en: 'Sacrifice' },
  { key: 'hangingPiece', vi: 'Quân bị bỏ không', en: 'Hanging piece' },
  { key: 'trappedPiece', vi: 'Quân bị nhốt', en: 'Trapped piece' },
  { key: 'attraction', vi: 'Dụ quân', en: 'Attraction' },
  { key: 'deflection', vi: 'Dẫn dụ rời vị trí', en: 'Deflection' },
  { key: 'interference', vi: 'Chặn đường', en: 'Interference' },
  { key: 'clearance', vi: 'Giải toả', en: 'Clearance' },
  { key: 'quietMove', vi: 'Nước đi tĩnh', en: 'Quiet move' },
  { key: 'zugzwang', vi: 'Zugzwang', en: 'Zugzwang' },
  { key: 'xRayAttack', vi: 'Tấn công xuyên (x-ray)', en: 'X-ray attack' },
  { key: 'intermezzo', vi: 'Nước chen (zwischenzug)', en: 'Intermezzo' },
  { key: 'capturingDefender', vi: 'Ăn quân phòng thủ', en: 'Capturing defender' },
  { key: 'defensiveMove', vi: 'Nước phòng thủ', en: 'Defensive move' },
  { key: 'exposedKing', vi: 'Vua lộ', en: 'Exposed king' },
  { key: 'advancedPawn', vi: 'Tốt tiến xa', en: 'Advanced pawn' },
  { key: 'promotion', vi: 'Phong cấp', en: 'Promotion' },
  // Giai đoạn
  { key: 'opening', vi: 'Khai cuộc', en: 'Opening' },
  { key: 'middlegame', vi: 'Trung cuộc', en: 'Middlegame' },
  { key: 'endgame', vi: 'Tàn cuộc', en: 'Endgame' },
  // Tàn cuộc theo quân
  { key: 'pawnEndgame', vi: 'Tàn cuộc tốt', en: 'Pawn endgame' },
  { key: 'rookEndgame', vi: 'Tàn cuộc xe', en: 'Rook endgame' },
  { key: 'bishopEndgame', vi: 'Tàn cuộc tượng', en: 'Bishop endgame' },
  { key: 'knightEndgame', vi: 'Tàn cuộc mã', en: 'Knight endgame' },
  { key: 'queenEndgame', vi: 'Tàn cuộc hậu', en: 'Queen endgame' },
  // Độ dài và kết quả
  { key: 'oneMove', vi: '1 nước', en: 'One-move' },
  { key: 'short', vi: 'Ngắn', en: 'Short' },
  { key: 'long', vi: 'Dài', en: 'Long' },
  { key: 'crushing', vi: 'Thắng áp đảo', en: 'Crushing' },
  { key: 'advantage', vi: 'Giành lợi thế', en: 'Advantage' },
  { key: 'equality', vi: 'Gỡ hoà', en: 'Equality' },
];

/**
 * Chủ đề còn lại của kho Lichess (gặp trong dữ liệu đã nạp) chỉ cần nhãn để hiện trên thẻ puzzle; KHÔNG đưa vào
 * `PUZZLE_THEMES` vì đó là danh sách chip lọc (thêm hết sẽ làm bộ lọc rối).
 */
const EXTRA_THEME_LABELS: readonly PuzzleThemeLabel[] = [
  { key: 'master', vi: 'Ván cao thủ', en: 'Master game' },
  { key: 'masterVsMaster', vi: 'Cao thủ đấu cao thủ', en: 'Master vs master' },
  { key: 'superGM', vi: 'Siêu đại kiện tướng', en: 'Super GM game' },
  { key: 'veryLong', vi: 'Rất dài', en: 'Very long' },
  { key: 'kingsideAttack', vi: 'Tấn công cánh vua', en: 'Kingside attack' },
  { key: 'queensideAttack', vi: 'Tấn công cánh hậu', en: 'Queenside attack' },
  { key: 'discoveredCheck', vi: 'Chiếu lộ (có chiếu)', en: 'Discovered check' },
  { key: 'attackingF2F7', vi: 'Tấn công f2/f7', en: 'Attacking f2/f7' },
  { key: 'enPassant', vi: 'Bắt tốt qua đường (en passant)', en: 'En passant' },
  { key: 'collinearMove', vi: 'Nước đi thẳng hàng', en: 'Collinear move' },
  { key: 'castling', vi: 'Nhập thành', en: 'Castling' },
  { key: 'underPromotion', vi: 'Phong cấp thấp (underpromotion)', en: 'Underpromotion' },
  { key: 'queenRookEndgame', vi: 'Tàn cuộc hậu và xe', en: 'Queen and rook endgame' },
  { key: 'mateIn4', vi: 'Chiếu hết 4 nước', en: 'Mate in 4' },
  { key: 'mateIn5', vi: 'Chiếu hết 5 nước', en: 'Mate in 5' },
  { key: 'pillsburysMate', vi: 'Chiếu hết Pillsbury', en: "Pillsbury's mate" },
  { key: 'operaMate', vi: 'Chiếu hết Opera', en: 'Opera mate' },
  { key: 'epauletteMate', vi: 'Chiếu hết quân hàm (epaulette)', en: 'Epaulette mate' },
  { key: 'hookMate', vi: 'Chiếu hết móc câu (hook)', en: 'Hook mate' },
  { key: 'cornerMate', vi: 'Chiếu hết ở góc', en: 'Corner mate' },
  { key: 'morphysMate', vi: 'Chiếu hết Morphy', en: "Morphy's mate" },
  { key: 'anastasiaMate', vi: 'Chiếu hết Anastasia', en: "Anastasia's mate" },
  {
    key: 'swallowstailMate',
    vi: 'Chiếu hết đuôi nhạn (swallow’s tail)',
    en: "Swallow's tail mate",
  },
  { key: 'arabianMate', vi: 'Chiếu hết kiểu Ả Rập', en: 'Arabian mate' },
  { key: 'triangleMate', vi: 'Chiếu hết hình tam giác', en: 'Triangle mate' },
  { key: 'killBoxMate', vi: 'Chiếu hết hộp kín (kill box)', en: 'Kill box mate' },
  { key: 'blindSwineMate', vi: 'Chiếu hết hai xe (blind swine)', en: 'Blind swine mate' },
  { key: 'vukovicMate', vi: 'Chiếu hết Vukovic', en: 'Vukovic mate' },
  { key: 'dovetailMate', vi: 'Chiếu hết đuôi én (dovetail)', en: 'Dovetail mate' },
  { key: 'bodenMate', vi: 'Chiếu hết Boden', en: "Boden's mate" },
  { key: 'doubleBishopMate', vi: 'Chiếu hết hai tượng', en: 'Double bishop mate' },
  { key: 'balestraMate', vi: 'Chiếu hết Balestra', en: 'Balestra mate' },
];

const BY_KEY = new Map([...PUZZLE_THEMES, ...EXTRA_THEME_LABELS].map((t) => [t.key, t]));

/** Nhãn theo ngôn ngữ; chủ đề chưa có nhãn thì hiện nguyên khoá. */
export function puzzleThemeLabel(key: string, locale: 'vi' | 'en'): string {
  return BY_KEY.get(key)?.[locale] ?? key;
}

export type PuzzleBankFilter = {
  themes: string[];
  ratingMin: number | null;
  ratingMax: number | null;
  /** Số nước người giải tối đa. */
  movesMax: number | null;
  limit: number;
  offset: number;
};

export const PUZZLE_BANK_MAX_LIMIT = 100;

/** Dòng kết quả của `search_puzzle_bank` (đã đổi sang camelCase). */
export type PuzzleBankRow = {
  id: number;
  lichessId: string;
  fen: string;
  moves: string;
  rating: number;
  popularity: number;
  themes: string[];
};

/**
 * Chọn tối đa `n` puzzle "trải đều rating": chia khoảng rating của tập ứng viên thành `n` dải bằng nhau, lấy một
 * puzzle ngẫu nhiên ở mỗi dải có hàng; còn thiếu thì bổ sung vòng tròn từ các dải còn dư. Kết quả xếp theo rating
 * tăng dần. `rng` trả số trong [0,1) (truyền vào để kiểm thử cố định được).
 */
export function pickSpread<T extends { rating: number }>(
  items: readonly T[],
  n: number,
  rng: () => number = Math.random,
): T[] {
  const count = Math.min(Math.max(Math.floor(n), 0), items.length);
  if (count === 0) return [];
  if (count === items.length) return [...items].sort((a, b) => a.rating - b.rating);
  const lo = Math.min(...items.map((i) => i.rating));
  const hi = Math.max(...items.map((i) => i.rating));
  const width = (hi - lo) / count || 1;
  const bands: T[][] = Array.from({ length: count }, () => []);
  for (const item of items) {
    const idx = Math.min(count - 1, Math.floor((item.rating - lo) / width));
    bands[idx]?.push(item);
  }
  const take = (band: T[]): T => {
    const i = Math.floor(rng() * band.length);
    return band.splice(i, 1)[0] as T;
  };
  const chosen: T[] = [];
  for (const band of bands) if (band.length > 0) chosen.push(take(band));
  // Thiếu (dải rỗng): bổ sung vòng tròn từ các dải còn dư
  while (chosen.length < count) {
    let progressed = false;
    for (const band of bands) {
      if (chosen.length >= count) break;
      if (band.length > 0) {
        chosen.push(take(band));
        progressed = true;
      }
    }
    if (!progressed) break;
  }
  return chosen.sort((a, b) => a.rating - b.rating);
}
