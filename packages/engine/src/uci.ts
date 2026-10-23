/**
 * Phân tích các dòng UCI do engine in ra. Viết theo output thật của Arasan 26.1
 * (xem test/fixtures), nhưng chỉ dựa vào chuẩn UCI nên dùng được với engine khác.
 */

/** Điểm theo góc nhìn bên đang đi (như engine in ra). */
export type Score = { kind: 'cp'; value: number } | { kind: 'mate'; value: number };

export type EngineInfo = {
  multipv: number;
  depth: number;
  seldepth?: number;
  score?: Score;
  /** Điểm là cận trên/cận dưới (aspiration window), chưa chính xác. */
  bound?: 'lower' | 'upper';
  nodes?: number;
  nps?: number;
  timeMs?: number;
  hashfull?: number;
  /** Nước đi dạng UCI (e2e4, e7e8q). */
  pv: string[];
};

export type BestMove = { move: string | null; ponder?: string };

export type UciOption = {
  name: string;
  type: 'check' | 'spin' | 'combo' | 'button' | 'string';
  default?: string;
  min?: number;
  max?: number;
  vars?: string[];
};

const INT_FIELDS = {
  depth: 'depth',
  seldepth: 'seldepth',
  multipv: 'multipv',
  nodes: 'nodes',
  nps: 'nps',
  time: 'timeMs',
  hashfull: 'hashfull',
} as const;

/**
 * Phân tích một dòng `info …` có PV. Trả về null cho dòng không mang phương án
 * (vd. `info depth 12 currmove …`, `info string …`).
 */
export function parseInfo(line: string): EngineInfo | null {
  const tokens = line.trim().split(/\s+/);
  if (tokens[0] !== 'info') return null;
  const info: Partial<EngineInfo> & { pv?: string[] } = { multipv: 1 };

  for (let i = 1; i < tokens.length; i++) {
    const key = tokens[i] as string;
    if (key === 'string') return null;
    if (key === 'pv') {
      info.pv = tokens.slice(i + 1);
      break;
    }
    if (key === 'score') {
      const kind = tokens[i + 1];
      const value = Number(tokens[i + 2]);
      if ((kind === 'cp' || kind === 'mate') && Number.isFinite(value)) {
        info.score = { kind, value };
      }
      i += 2;
      const next = tokens[i + 1];
      if (next === 'lowerbound' || next === 'upperbound') {
        info.bound = next === 'lowerbound' ? 'lower' : 'upper';
        i++;
      }
      continue;
    }
    if (key in INT_FIELDS) {
      const field = INT_FIELDS[key as keyof typeof INT_FIELDS];
      const value = Number(tokens[i + 1]);
      if (Number.isFinite(value)) (info as Record<string, number>)[field] = value;
      i++;
    }
  }

  if (!info.pv || info.pv.length === 0 || info.depth === undefined) return null;
  return info as EngineInfo;
}

export function parseBestMove(line: string): BestMove | null {
  const tokens = line.trim().split(/\s+/);
  if (tokens[0] !== 'bestmove') return null;
  const move = tokens[1];
  const result: BestMove = { move: !move || move === '(none)' || move === '0000' ? null : move };
  if (tokens[2] === 'ponder' && tokens[3]) result.ponder = tokens[3];
  return result;
}

/** Phân tích `option name <tên có thể có dấu cách> type <t> [default …] [min …] [max …] [var …]`. */
export function parseOption(line: string): UciOption | null {
  const m = /^option name (.+?) type (check|spin|combo|button|string)(?: (.*))?$/.exec(line.trim());
  if (!m) return null;
  const option: UciOption = { name: m[1] as string, type: m[2] as UciOption['type'] };
  const rest = m[3] ?? '';
  const parts = rest.split(/\s+(?=(?:default|min|max|var)\s)/);
  for (const part of parts) {
    const [key, ...valueParts] = part.split(' ');
    const value = valueParts.join(' ');
    if (key === 'default') option.default = value;
    else if (key === 'min') option.min = Number(value);
    else if (key === 'max') option.max = Number(value);
    else if (key === 'var') option.vars = [...(option.vars ?? []), value];
  }
  return option;
}

/** Đổi điểm từ góc nhìn bên đang đi sang góc nhìn quân Trắng (để vẽ thanh đánh giá). */
export function toWhitePov(score: Score, sideToMove: 'w' | 'b'): Score {
  return sideToMove === 'w' ? score : { kind: score.kind, value: -score.value };
}

/** Lấy bên đi từ FEN (trường thứ hai), mặc định Trắng. */
export function sideToMoveFromFen(fen: string): 'w' | 'b' {
  return fen.trim().split(/\s+/)[1] === 'b' ? 'b' : 'w';
}

/** Hiển thị điểm cho người dùng: "+0.38", "-1.20", "#3", "#-2". */
export function formatScore(score: Score): string {
  if (score.kind === 'mate') return `#${score.value}`;
  const pawns = score.value / 100;
  return `${pawns > 0 ? '+' : ''}${pawns.toFixed(2)}`;
}
