// Logic dùng chung của các script nạp Masterbase (Giai đoạn 23b, 27b): tách PGN thành từng ván, đọc nhanh
// tag, lọc/bỏ trùng, và ghi hai tệp CSV (games.csv, positions.csv). `masterbase-export.mjs` (một tệp PGN)
// và `scripts/masterbase-broadcast.mjs` (kho broadcast của Lichess) cùng dùng, để khoá thế cờ và định dạng
// CSV luôn khớp với `src/masterbase.ts` và bảng `masterbase_*`.
import { createWriteStream, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { Chess } from 'chess.js';

// Phải khớp với MASTERBASE_INDEX_PLIES và positionKey trong src/masterbase.ts
export const INDEX_PLIES = 40;
export const positionKey = (fen) => fen.trim().split(/\s+/).slice(0, 3).join(' ');

export const GAMES_HEADER =
  'id,white,black,white_elo,black_elo,result,event,site,date,eco,ply_count,pgn,source\n';
export const POSITIONS_HEADER = 'position_key,game_id\n';

const RESULTS = new Set(['1-0', '0-1', '1/2-1/2', '*']);
const DECIDED = new Set(['1-0', '0-1', '1/2-1/2']);

export const csv = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const tag = (v, max) => {
  const s = (v ?? '').trim();
  return s === '?' ? '' : s.slice(0, max);
};
const elo = (v) => {
  const n = Number(v);
  return v && Number.isInteger(n) && n > 0 && n < 4000 ? n : null;
};

/**
 * Tách luồng dòng PGN thành từng ván (văn bản). Ván mới bắt đầu ở dòng tag "[" đầu tiên sau phần nước
 * đi của ván trước. `lines` là async iterable các dòng (vd. readline).
 */
export async function* splitGames(lines) {
  let current = [];
  let inMoves = false;
  for await (const raw of lines) {
    const line = raw.replace(/^﻿/, '');
    const t = line.trim();
    if (t.startsWith('[') && inMoves) {
      yield current.join('\n');
      current = [];
      inMoves = false;
    }
    if (t && !t.startsWith('[') && !t.startsWith('%')) inMoves = true;
    current.push(line);
  }
  if (current.length > 0) yield current.join('\n');
}

/** Dòng của một luồng (Readable) dạng utf8. */
export const linesOf = (readable) => createInterface({ input: readable, crlfDelay: Infinity });

/** Đọc nhanh các tag `[Name "Value"]` của một ván (không cần dựng bàn cờ). */
export function quickHeaders(pgn) {
  const h = {};
  for (const m of pgn.matchAll(/^\[(\w+)\s+"((?:[^"\\]|\\.)*)"\]\s*$/gm)) {
    h[m[1]] = (m[2] ?? '').replace(/\\(["\\])/g, '$1');
  }
  return h;
}

/**
 * Khoá bỏ trùng ván: tên hai bên + ngày + giải + vòng (chữ thường, bỏ khoảng trắng thừa). Cùng một ván
 * thường xuất hiện lại khi giải được phát nhiều lần hoặc nhiều tháng.
 */
export function dedupeKey(h) {
  const n = (v) => (v ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  return [h.White, h.Black, h.Date ?? h.UTCDate, h.Event, h.Round].map(n).join('|');
}

/**
 * Bộ lọc bước đầu theo tag (rẻ, chạy trước khi dựng bàn cờ): có kết quả, Elo của CẢ HAI bên đều
 * ≥ minElo. Trả `null` nếu đạt, hoặc lý do loại ('result' | 'elo').
 */
export function rejectByHeaders(h, { minElo }) {
  if (!DECIDED.has(h.Result)) return 'result';
  const w = elo(h.WhiteElo);
  const b = elo(h.BlackElo);
  if (w === null || b === null || w < minElo || b < minElo) return 'elo';
  return null;
}

/** Số nước đầy đủ từ số nửa nước: ceil(ply / 2). */
export const movesOf = (plies) => Math.ceil(plies / 2);

/**
 * Đọc một ván bằng chess.js. Trả `{ headers, plies, pgn, keys }` (keys = tập khoá thế ở INDEX_PLIES nửa
 * nước đầu) hoặc `null` nếu ván lỗi/quá dài/không có nước đi.
 */
export function stripComments(pgn) {
  // Tag giữ nguyên; trong phần nước đi bỏ chú thích {…} (đánh giá máy, đồng hồ…) và ghi chú một dòng, gộp khoảng trắng
  const lines = pgn.split('\n');
  let i = 0;
  while (i < lines.length && (lines[i].trim() === '' || lines[i].trim().startsWith('['))) i++;
  const head = lines.slice(0, i).join('\n');
  const moves = lines
    .slice(i)
    .join(' ')
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/;[^\n]*$/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return `${head.trimEnd()}\n\n${moves}`;
}

export function parseGame(text) {
  // Chú thích (eval/clk) của broadcast làm PGN phình to và chess.js không đọc được hết; Masterbase không cần chúng
  const pgn = stripComments(text.trim());
  if (!pgn || pgn.length > 100000) return null;
  const chess = new Chess();
  try {
    chess.loadPgn(pgn);
  } catch {
    return null;
  }
  const history = chess.history({ verbose: true });
  if (history.length === 0) return null;
  const keys = new Set([positionKey(history[0].before)]);
  for (const m of history.slice(0, INDEX_PLIES)) keys.add(positionKey(m.after));
  return { headers: chess.getHeaders(), plies: history.length, pgn, keys };
}

/** Một dòng CSV của games.csv. */
export function gameRow(id, parsed, source) {
  const h = parsed.headers;
  return `${[
    id,
    tag(h.White, 120),
    tag(h.Black, 120),
    elo(h.WhiteElo),
    elo(h.BlackElo),
    RESULTS.has(h.Result) ? h.Result : '*',
    tag(h.Event, 120),
    tag(h.Site, 120),
    tag(h.Date, 10),
    tag(h.ECO, 3),
    parsed.plies,
    parsed.pgn,
    source,
  ]
    .map(csv)
    .join(',')}\n`;
}

/** Ghi games.csv và positions.csv vào `outDir`; `add` trả id đã cấp. */
export function createWriter(outDir, startId = 1) {
  mkdirSync(outDir, { recursive: true });
  const games = createWriteStream(join(outDir, 'games.csv'));
  const positions = createWriteStream(join(outDir, 'positions.csv'));
  games.write(GAMES_HEADER);
  positions.write(POSITIONS_HEADER);
  let nextId = startId;
  return {
    get nextId() {
      return nextId;
    },
    add(parsed, source) {
      const id = nextId++;
      games.write(gameRow(id, parsed, source));
      for (const k of parsed.keys) positions.write(`${csv(k)},${id}\n`);
      return id;
    },
    async end() {
      await Promise.all([new Promise((r) => games.end(r)), new Promise((r) => positions.end(r))]);
    },
  };
}

export const newStats = () => ({
  seen: 0,
  accepted: 0,
  rejected: { result: 0, elo: 0, short: 0, invalid: 0, duplicate: 0 },
  minYear: null,
  maxYear: null,
  estimatedBytes: 0,
});

/** Ước tính dung lượng trong DB của một ván: PGN + chi phí dòng/chỉ mục + các dòng thế cờ. */
export const estimateBytes = (parsed) => parsed.pgn.length + 350 + parsed.keys.size * 150;

/**
 * Lọc luồng ván: có kết quả, Elo cả hai bên ≥ minElo, ≥ minMoves nước, bỏ trùng (qua tập `seen` dùng
 * chung giữa các tháng), đọc được. Mỗi ván đạt gọi `onAccept(parsed)`; dừng sớm khi `stop()` trả true
 * (vd. chạm trần dung lượng). Trả về thống kê cộng dồn vào `stats`.
 */
export async function consumeGames(games, { minElo, minMoves, seen, stats, onAccept, stop }) {
  for await (const text of games) {
    if (!text.trim()) continue;
    if (stop?.()) break;
    stats.seen++;
    const h = quickHeaders(text);
    const reason = rejectByHeaders(h, { minElo });
    if (reason) {
      stats.rejected[reason]++;
      continue;
    }
    const key = dedupeKey(h);
    if (seen.has(key)) {
      stats.rejected.duplicate++;
      continue;
    }
    const parsed = parseGame(text);
    if (!parsed) {
      stats.rejected.invalid++;
      continue;
    }
    if (movesOf(parsed.plies) < minMoves) {
      stats.rejected.short++;
      continue;
    }
    seen.add(key);
    stats.accepted++;
    stats.estimatedBytes += estimateBytes(parsed);
    const year = Number.parseInt((parsed.headers.Date ?? '').slice(0, 4), 10);
    if (Number.isInteger(year)) {
      stats.minYear = stats.minYear === null ? year : Math.min(stats.minYear, year);
      stats.maxYear = stats.maxYear === null ? year : Math.max(stats.maxYear, year);
    }
    onAccept?.(parsed);
  }
  return stats;
}

// ── Giải nén .zst theo từng frame ────────────────────────────────────────────────────────────────────────
// Tệp của Lichess là chuỗi [skippable frame (siêu dữ liệu)][frame zstd][skippable][frame]…; bộ giải nén stream
// của Node từ chối skippable frame ("Unknown frame descriptor"). Ta tự dò ranh giới từng frame bằng cách đi qua
// header frame và các block (không đoán bằng tìm magic trong dữ liệu nén), bỏ skippable frame, rồi giải nén
// từng frame bằng zlib.zstdDecompress (cần Node ≥ 22.15; không thêm thư viện nào).

const ZSTD_MAGIC = 0xfd2fb528;

/**
 * Tách luồng Buffer thành các frame zstd hoàn chỉnh (Buffer), bỏ skippable frame.
 * Ném lỗi nếu dữ liệu không phải zstd hoặc bị cắt cụt.
 */
export async function* zstdFrames(chunks) {
  const it = chunks[Symbol.asyncIterator]();
  let buf = Buffer.alloc(0);
  let ended = false;
  const fill = async (n) => {
    while (buf.length < n && !ended) {
      const r = await it.next();
      if (r.done) ended = true;
      else buf = Buffer.concat([buf, r.value]);
    }
    return buf.length >= n;
  };

  while (true) {
    if (!(await fill(4))) {
      if (buf.length > 0) throw new Error('Tệp zstd bị cắt cụt (thừa byte lẻ)');
      return;
    }
    const magic = buf.readUInt32LE(0);
    if ((magic & 0xfffffff0) >>> 0 === 0x184d2a50) {
      // skippable frame: magic(4) + size(4) + dữ liệu
      if (!(await fill(8))) throw new Error('Skippable frame bị cắt cụt');
      const size = buf.readUInt32LE(4);
      if (!(await fill(8 + size))) throw new Error('Skippable frame bị cắt cụt');
      buf = buf.subarray(8 + size);
      continue;
    }
    if (magic !== ZSTD_MAGIC) throw new Error('Không phải tệp zstd (magic lạ)');

    // Header frame: FHD + (window) + (dict id) + (frame content size)
    if (!(await fill(5))) throw new Error('Frame zstd bị cắt cụt');
    const fhd = buf[4];
    const fcsFlag = fhd >> 6;
    const single = (fhd >> 5) & 1;
    const checksum = (fhd >> 2) & 1;
    const dictBytes = [0, 1, 2, 4][fhd & 3];
    const fcsBytes = fcsFlag === 0 ? (single ? 1 : 0) : [0, 2, 4, 8][fcsFlag];
    let off = 5 + (single ? 0 : 1) + dictBytes + fcsBytes;
    // Các block: header 3 byte (bit0 = block cuối, bit1-2 = loại, bit3.. = kích thước)
    while (true) {
      if (!(await fill(off + 3))) throw new Error('Frame zstd bị cắt cụt (block)');
      const h = buf[off] | (buf[off + 1] << 8) | (buf[off + 2] << 16);
      const last = h & 1;
      const type = (h >> 1) & 3;
      const size = h >>> 3;
      if (type === 3) throw new Error('Block zstd không hợp lệ');
      off += 3 + (type === 1 ? 1 : size); // RLE block chỉ có 1 byte nội dung
      if (last) break;
    }
    if (checksum) off += 4;
    if (!(await fill(off))) throw new Error('Frame zstd bị cắt cụt (cuối frame)');
    yield buf.subarray(0, off);
    buf = buf.subarray(off);
  }
}

/** Luồng Buffer đã giải nén của một luồng zstd (nhiều frame, có skippable frame). */
export async function* decompressZstd(chunks) {
  const { zstdDecompress } = await import('node:zlib');
  const { promisify } = await import('node:util');
  if (typeof zstdDecompress !== 'function') {
    throw new Error(
      'Node này chưa có zlib.zstdDecompress (cần Node ≥ 22.15) — hoặc giải nén bằng `zstd -d` rồi dùng --file',
    );
  }
  const run = promisify(zstdDecompress);
  for await (const frame of zstdFrames(chunks)) yield await run(frame);
}
