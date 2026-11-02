// Nạp Masterbase từ kho broadcast của Lichess (Giai đoạn 27b).
//
// Nguồn: https://database.lichess.org/#broadcasts — tệp `lichess_db_broadcast_YYYY-MM.pgn.zst`, giấy phép CC0
// (public domain). Script tải các tháng được chọn, giải nén stream, lọc ván cao thủ, bỏ trùng và ghi
// games.csv + positions.csv bằng cùng logic với `packages/chess-core/scripts/masterbase-export.mjs`.
//
// ── Cách dùng ────────────────────────────────────────────────────────────────────────────────────────────
//   # 1) Xem trước (không ghi CSV): số ván sau lọc, dung lượng ước tính, thời gian chạy
//   node scripts/masterbase-broadcast.mjs --months 2026-10 --dry-run
//
//   # 2) Tạo CSV cho 12 tháng gần nhất (tải về .cache/masterbase, ghi CSV vào out/masterbase)
//   node scripts/masterbase-broadcast.mjs --months 2025-11..2026-10 --out out/masterbase
//
// Tuỳ chọn:
//   --months A..B | A,B,C   tháng cần lấy (YYYY-MM); xử lý từ mới tới cũ, nên chạm trần thì giữ ván mới nhất
//   --out <thư mục>         nơi ghi games.csv, positions.csv (mặc định out/masterbase)
//   --cache <thư mục>       nơi lưu tệp .zst đã tải (mặc định .cache/masterbase, bị gitignore; không commit dữ liệu)
//   --file <tệp>            dùng tệp .pgn hoặc .pgn.zst có sẵn thay vì tải (để thử), coi như một tháng
//   --min-elo 2300          Elo tối thiểu của CẢ HAI bên
//   --min-moves 10          số nước đầy đủ tối thiểu (ceil(nửa nước / 2))
//   --max-mb 300            trần dung lượng ước tính trong DB; chạm trần thì dừng (vừa gói Free của Supabase)
//   --start-id 1            id đầu tiên của masterbase_games (đặt lớn hơn id lớn nhất hiện có nếu nạp thêm đợt)
//   --include-engines       giữ cả ván engine (mặc định BỎ: "tcec" ở Event/Site hoặc Elo một bên > 3000)
//   --dry-run               chỉ in thống kê, không ghi CSV
//
// Lọc: có kết quả (1-0, 0-1, 1/2-1/2), không phải ván engine, Elo hai bên ≥ min-elo, ≥ min-moves nước, đọc được; bỏ ván trùng
// (khoá: tên hai bên + ngày + giải + vòng). Cột `source` = "Lichess broadcast database (CC0) YYYY-MM".
//
// ── Nạp vào Supabase (chủ dự án hoặc agent Supabase chạy; cần chuỗi kết nối Postgres, KHÔNG dùng khoá publishable)
//   export DATABASE_URL='postgresql://postgres:<mật-khẩu-DB>@db.<project-ref>.supabase.co:5432/postgres'
//   psql "$DATABASE_URL" -c "\copy public.masterbase_games (id,white,black,white_elo,black_elo,result,event,site,date,eco,ply_count,pgn,source) from 'out/masterbase/games.csv' csv header"
//   psql "$DATABASE_URL" -c "\copy public.masterbase_positions (position_key,game_id) from 'out/masterbase/positions.csv' csv header"
//   Nạp games TRƯỚC positions (positions tham chiếu games). Muốn chia lô: chạy script từng tháng với
//   --start-id nối tiếp (id tiếp theo được in ở cuối), nạp lần lượt.
//
// ── Kiểm sau khi nạp (SQL Editor, đăng nhập bằng người dùng thật hoặc dùng service role)
//   select count(*) from public.masterbase_games;                      -- = số ván script báo
//   select count(*) from public.masterbase_positions;
//   select pg_size_pretty(pg_total_relation_size('public.masterbase_games')),
//          pg_size_pretty(pg_total_relation_size('public.masterbase_positions'));
//   -- thế khởi đầu (mọi ván đi qua):
//   select * from public.search_masterbase('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq', null, null, 5, 0);
//   -- sau 1.e4 c5:
//   select * from public.search_masterbase('rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq', null, null, 5, 0);
//   Rồi mở trang Bàn cờ → tab Masterbase: ván hiện ra khi đặt thế tương ứng.
import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  consumeGames,
  createWriter,
  downloadToCache,
  newStats,
  splitGames,
  textLines,
} from '../packages/chess-core/scripts/masterbase-lib.mjs';

const BASE_URL = 'https://database.lichess.org/broadcast';
const MB = 1024 * 1024;

/** `2025-11..2026-10` hoặc `2026-09,2026-10` → ['2026-10', '2026-09', ...] (mới tới cũ). */
export function parseMonths(spec) {
  const ok = (m) => /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
  let list;
  if (spec.includes('..')) {
    const [from, to] = spec.split('..');
    if (!ok(from) || !ok(to) || from > to) throw new Error(`Khoảng tháng không hợp lệ: ${spec}`);
    list = [];
    let [y, m] = from.split('-').map(Number);
    while (`${y}-${String(m).padStart(2, '0')}` <= to) {
      list.push(`${y}-${String(m).padStart(2, '0')}`);
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }
  } else {
    list = spec.split(',').map((s) => s.trim());
    for (const m of list) if (!ok(m)) throw new Error(`Tháng không hợp lệ: ${m} (dạng YYYY-MM)`);
  }
  return [...new Set(list)].sort().reverse();
}

export function parseArgs(argv) {
  const get = (name, dflt) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : dflt;
  };
  const num = (name, dflt) => {
    const v = Number(get(name, dflt));
    if (!Number.isFinite(v) || v <= 0) throw new Error(`${name} phải là số dương`);
    return v;
  };
  const file = get('--file');
  const monthsSpec = get('--months');
  if (!file && !monthsSpec) throw new Error('Thiếu --months (vd. 2025-11..2026-10) hoặc --file');
  return {
    months: file ? ['file'] : parseMonths(monthsSpec),
    file,
    out: get('--out', 'out/masterbase'),
    cache: get('--cache', '.cache/masterbase'),
    minElo: num('--min-elo', 2300),
    minMoves: num('--min-moves', 10),
    maxMb: num('--max-mb', 300),
    startId: num('--start-id', 1),
    includeEngines: argv.includes('--include-engines'),
    dryRun: argv.includes('--dry-run'),
  };
}

async function download(month, cacheDir) {
  return downloadToCache(`${BASE_URL}/lichess_db_broadcast_${month}.pgn.zst`, cacheDir, {
    hint404: ' (tháng này có thể chưa được Lichess công bố; thử tháng trước)',
  });
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const t0 = Date.now();
  const writer = opts.dryRun ? null : createWriter(resolve(opts.out), opts.startId);
  const seen = new Set();
  const total = newStats();
  const perMonth = [];
  const cap = opts.maxMb * MB;
  let downloaded = 0;
  let capped = false;

  console.log(
    `${opts.dryRun ? '[dry-run] ' : ''}Lọc: Elo cả hai bên ≥ ${opts.minElo}, ≥ ${opts.minMoves} nước, có kết quả, ${opts.includeEngines ? 'gồm cả' : 'bỏ'} ván engine, bỏ trùng; trần ${opts.maxMb} MB`,
  );
  for (const month of opts.months) {
    if (total.estimatedBytes >= cap) {
      capped = true;
      console.log(`Chạm trần ${opts.maxMb} MB, bỏ qua các tháng còn lại (cũ hơn ${month}).`);
      break;
    }
    const label = opts.file ? opts.file : month;
    console.log(`Tháng ${label}:`);
    const src = opts.file
      ? { path: opts.file, bytes: statSync(opts.file).size }
      : await download(month, resolve(opts.cache));
    downloaded += src.bytes;
    const source = `Lichess broadcast database (CC0) ${opts.file ? 'tệp cục bộ' : month}`;
    const before = { ...total, rejected: { ...total.rejected } };
    const tm = Date.now();
    await consumeGames(splitGames(textLines(src.path)), {
      minElo: opts.minElo,
      minMoves: opts.minMoves,
      includeEngines: opts.includeEngines,
      seen,
      stats: total,
      stop: () => total.estimatedBytes >= cap,
      onAccept: (parsed) => writer?.add(parsed, source),
    });
    if (total.estimatedBytes >= cap) capped = true;
    const got = total.accepted - before.accepted;
    perMonth.push({
      month: label,
      seen: total.seen - before.seen,
      accepted: got,
      seconds: (Date.now() - tm) / 1000,
      zstMb: src.bytes / MB,
    });
    console.log(
      `  ${total.seen - before.seen} ván đọc, ${got} ván đạt (${((Date.now() - tm) / 1000).toFixed(0)} giây)`,
    );
  }
  await writer?.end();

  const seconds = (Date.now() - t0) / 1000;
  const estMb = total.estimatedBytes / MB;
  console.log('\n──── Thống kê ────');
  console.log(`Tháng xử lý: ${perMonth.map((m) => m.month).join(', ')}`);
  console.log(`Ván đọc: ${total.seen}; ván đạt: ${total.accepted}`);
  console.log(
    `Loại: không kết quả ${total.rejected.result}, ván engine ${total.rejected.engine}, Elo thấp/thiếu ${total.rejected.elo}, ngắn (< ${opts.minMoves} nước) ${total.rejected.short}, trùng ${total.rejected.duplicate}, lỗi PGN ${total.rejected.invalid}`,
  );
  if (total.minYear !== null) console.log(`Dải năm: ${total.minYear}–${total.maxYear}`);
  console.log(
    `Dung lượng ước tính trong DB: ${estMb.toFixed(1)} MB${capped ? ` (chạm trần ${opts.maxMb} MB)` : ''}; dữ liệu tải ${(downloaded / MB).toFixed(0)} MB`,
  );
  console.log(`Thời gian chạy: ${seconds.toFixed(0)} giây`);
  if (writer) {
    console.log(`Đã ghi ${opts.out}/games.csv và positions.csv. id tiếp theo: ${writer.nextId}`);
  } else {
    console.log('Dry-run: chưa ghi tệp nào.');
  }
}

// Chỉ chạy khi gọi trực tiếp (để test import được parseMonths/parseArgs)
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
