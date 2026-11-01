// Thư viện nạp CSV vào Postgres cho scripts/db-load-csv.mjs (Giai đoạn 27d).
//
// Không phụ thuộc thư viện Postgres cụ thể: nhận một "db" có hai hàm
//   transaction(async (tx) => …)   chạy khối trong một giao dịch
//   tx.query(sql)                  → mảng dòng kết quả
//   tx.copyIn(sql, text)           COPY … FROM STDIN với `text` là nội dung CSV (không có dòng tiêu đề)
// Script CLI dùng thư viện `postgres`; test dùng PGlite.
import { createReadStream } from 'node:fs';

/** Mỗi đích nạp = danh sách bước theo thứ tự (bảng cha trước bảng con). */
export const LOAD_TARGETS = {
  'puzzle-bank': {
    dir: 'out/puzzle-bank',
    steps: [
      {
        table: 'public.puzzle_bank',
        file: 'puzzles.csv',
        columns: [
          'lichess_id',
          'fen',
          'moves',
          'rating',
          'rating_deviation',
          'popularity',
          'nb_plays',
          'themes',
          'opening_tags',
          'source',
        ],
        conflict: '(lichess_id)',
      },
    ],
  },
  masterbase: {
    dir: 'out/masterbase',
    steps: [
      {
        table: 'public.masterbase_games',
        file: 'games.csv',
        columns: [
          'id',
          'white',
          'black',
          'white_elo',
          'black_elo',
          'result',
          'event',
          'site',
          'date',
          'eco',
          'ply_count',
          'pgn',
          'source',
        ],
        conflict: '(id)',
      },
      {
        table: 'public.masterbase_positions',
        file: 'positions.csv',
        columns: ['position_key', 'game_id'],
        conflict: '(position_key, game_id)',
      },
    ],
  },
};

/**
 * Tách tệp CSV thành các bản ghi thô (giữ nguyên chữ, kể cả xuống dòng nằm trong ô có ngoặc kép),
 * không phân tích từng ô — Postgres tự phân tích khi COPY. Mỗi bản ghi kết thúc bằng "\n".
 */
export async function* csvRecords(path) {
  let inQuote = false;
  let pending = '';
  for await (const chunk of createReadStream(path, { encoding: 'utf8', highWaterMark: 1 << 20 })) {
    let start = 0;
    for (let i = 0; i < chunk.length; i++) {
      const c = chunk.charCodeAt(i);
      if (c === 34) inQuote = !inQuote;
      else if (c === 10 && !inQuote) {
        yield `${pending}${chunk.slice(start, i + 1)}`;
        pending = '';
        start = i + 1;
      }
    }
    pending += chunk.slice(start);
  }
  if (pending.trim() !== '') yield pending.endsWith('\n') ? pending : `${pending}\n`;
}

/** Gom bản ghi thành lô ≤ ~maxBytes (mỗi lô là một chuỗi CSV không có tiêu đề). */
export async function* csvBatches(path, expectedHeader, maxBytes) {
  let first = true;
  let rows = 0;
  let size = 0;
  let parts = [];
  for await (const rec of csvRecords(path)) {
    if (first) {
      first = false;
      const header = rec.trim();
      if (header !== expectedHeader.join(',')) {
        throw new Error(
          `Tiêu đề CSV không khớp (${path}): có "${header}", cần "${expectedHeader.join(',')}"`,
        );
      }
      continue;
    }
    parts.push(rec);
    rows++;
    size += rec.length;
    if (size >= maxBytes) {
      yield { text: parts.join(''), rows };
      parts = [];
      rows = 0;
      size = 0;
    }
  }
  if (first) throw new Error(`Tệp CSV rỗng: ${path}`);
  if (rows > 0) yield { text: parts.join(''), rows };
}

/** Đếm dòng dữ liệu (không tính tiêu đề) và kiểm tra tiêu đề — dùng cho --dry-run. */
export async function inspectCsv(path, expectedHeader) {
  let rows = 0;
  for await (const b of csvBatches(path, expectedHeader, 8 << 20)) rows += b.rows;
  return rows;
}

/**
 * Nạp một bước: mỗi lô một giao dịch, qua bảng tạm rồi `insert … on conflict do nothing`
 * nên chạy lại không tạo dòng trùng. Trả về { read, inserted }.
 */
export async function loadStep(db, step, path, { maxBytes = 8 << 20, log = () => {} } = {}) {
  const cols = step.columns.join(', ');
  let read = 0;
  let inserted = 0;
  let batch = 0;
  for await (const b of csvBatches(path, step.columns, maxBytes)) {
    batch++;
    const n = await db.transaction(async (tx) => {
      await tx.query(
        `create temp table _stg on commit drop as select ${cols} from ${step.table} with no data`,
      );
      await tx.copyIn(`copy _stg (${cols}) from stdin with (format csv)`, b.text);
      const r = await tx.query(
        `with ins as (insert into ${step.table} (${cols}) select ${cols} from _stg on conflict ${step.conflict} do nothing returning 1) select count(*)::int as n from ins`,
      );
      return Number(r[0].n);
    });
    read += b.rows;
    inserted += n;
    log(
      `  ${step.table}: lô ${batch}, đọc ${read.toLocaleString('vi-VN')}, thêm mới ${inserted.toLocaleString('vi-VN')}`,
    );
  }
  return { read, inserted };
}

/** Đếm dòng và dung lượng (cả chỉ mục) của các bảng sau khi nạp. */
export async function tableReport(db, tables) {
  const out = [];
  for (const t of tables) {
    const r = await db.transaction((tx) =>
      tx.query(
        `select count(*)::bigint as n, pg_size_pretty(pg_total_relation_size('${t}')) as size from ${t}`,
      ),
    );
    out.push({ table: t, rows: Number(r[0].n), size: r[0].size });
  }
  return out;
}
