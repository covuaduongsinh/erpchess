// Chuẩn bị kho puzzle cho tính năng "Thêm từ kho puzzle" (Giai đoạn 27c).
//
// Nguồn: https://database.lichess.org/#puzzles — tệp `lichess_db_puzzle.csv.zst` (~300 MB nén, ~5 triệu puzzle),
// giấy phép CC0 (public domain). Không nạp hết (không vừa gói Free của Supabase): script LẤY MẪU PHÂN TẦNG một tập
// con (mặc định 150.000 puzzle), xuất `puzzles.csv` để `\copy` vào bảng `public.puzzle_bank`.
//
// ── Cách dùng ────────────────────────────────────────────────────────────────────────────────────────────
//   # 1) Xem trước (không ghi CSV): số puzzle qua lọc, số tầng, số chọn, dung lượng ước tính, thời gian
//   node scripts/puzzle-bank-import.mjs --dry-run
//
//   # 2) Tạo CSV (tải về .cache/puzzle-bank, ghi out/puzzle-bank/puzzles.csv)
//   node scripts/puzzle-bank-import.mjs --target 150000 --out out/puzzle-bank
//
// Tuỳ chọn:
//   --target 150000      số puzzle muốn lấy (xấp xỉ: chọn theo xác suất nên lệch vài phần trăm)
//   --out <thư mục>      nơi ghi puzzles.csv (mặc định out/puzzle-bank)
//   --cache <thư mục>    nơi lưu tệp .zst đã tải (mặc định .cache/puzzle-bank, bị gitignore; không commit dữ liệu)
//   --file <tệp>         dùng tệp .csv hoặc .csv.zst có sẵn thay vì tải (để thử)
//   --min-popularity 80  độ phổ biến tối thiểu (-100..100) — lọc bớt puzzle bị đánh giá thấp
//   --min-plays 200      số lượt chơi tối thiểu
//   --max-rd 90          RatingDeviation tối đa (rating đã ổn định)
//   --seed 1             hạt giống chọn ngẫu nhiên (cùng seed cho cùng kết quả)
//   --dry-run            chỉ in thống kê, không ghi CSV
//
// Lấy mẫu phân tầng: mỗi puzzle thuộc một tầng = dải rating 200 điểm × chủ đề chính (xem THEME_PRIORITY). Hạn ngạch
// mỗi tầng tỉ lệ với căn bậc hai số puzzle của tầng (tầng hiếm vẫn có đại diện, tầng khổng lồ không lấn át); chọn
// bằng băm id nên chạy lại cho kết quả giống nhau. Cần đọc tệp hai lượt (đếm tầng, rồi chọn): ~2–3 phút.
//
// ── Nạp vào Supabase (chủ dự án hoặc agent Supabase chạy; cần chuỗi kết nối Postgres, KHÔNG dùng khoá publishable)
//   Trước hết áp migration `supabase/migrations/20261102000043_puzzle_bank.sql`.
//   export DATABASE_URL='postgresql://postgres:<mật-khẩu-DB>@db.<project-ref>.supabase.co:5432/postgres'
//   psql "$DATABASE_URL" -c "\copy public.puzzle_bank (lichess_id,fen,moves,rating,rating_deviation,popularity,nb_plays,themes,opening_tags,source) from 'out/puzzle-bank/puzzles.csv' csv header"
//   (Nạp lại cùng tệp sẽ lỗi trùng lichess_id: bảng có ràng buộc unique, nên an toàn.)
//
// ── Kiểm sau khi nạp (SQL Editor)
//   select count(*) from public.puzzle_bank;                                   -- = số puzzle script báo
//   select pg_size_pretty(pg_total_relation_size('public.puzzle_bank'));       -- so với ước tính của script
//   select * from public.search_puzzle_bank('{fork}', 1200, 1600, 3, 5, 0);    -- đòn đôi, rating 1200–1600, ≤ 3 nước giải
//   Rồi mở một study → "Thêm từ kho puzzle": kết quả hiện ra, chọn và thêm được.
import { createWriteStream, mkdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { downloadToCache, textLines } from '../packages/chess-core/scripts/masterbase-lib.mjs';
import {
  allocateQuotas,
  estimateRowBytes,
  PUZZLE_CSV_HEADER,
  parsePuzzleLine,
  puzzleRow,
  rejectPuzzle,
  selected,
  stratumOf,
} from '../packages/chess-core/scripts/puzzle-bank-lib.mjs';

const URL_PUZZLES = 'https://database.lichess.org/lichess_db_puzzle.csv.zst';
const MB = 1024 * 1024;
const SOURCE = 'Lichess puzzle database (CC0)';

export function parseArgs(argv) {
  const get = (name, dflt) => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : dflt;
  };
  const num = (name, dflt, { min = Number.NEGATIVE_INFINITY } = {}) => {
    const v = Number(get(name, dflt));
    if (!Number.isFinite(v) || v < min) throw new Error(`${name} không hợp lệ`);
    return v;
  };
  return {
    file: get('--file'),
    out: get('--out', 'out/puzzle-bank'),
    cache: get('--cache', '.cache/puzzle-bank'),
    target: num('--target', 150000, { min: 1 }),
    minPopularity: num('--min-popularity', 80, { min: -100 }),
    minPlays: num('--min-plays', 200, { min: 0 }),
    maxRd: num('--max-rd', 90, { min: 1 }),
    seed: num('--seed', 1),
    dryRun: argv.includes('--dry-run'),
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const t0 = Date.now();
  const src = opts.file
    ? { path: opts.file, bytes: statSync(opts.file).size }
    : await downloadToCache(URL_PUZZLES, resolve(opts.cache));
  const filter = { minPopularity: opts.minPopularity, minPlays: opts.minPlays, maxRd: opts.maxRd };

  // Lượt 1: đếm số puzzle đạt lọc theo tầng
  console.log(
    `Lượt 1/2: đếm theo tầng (lọc: phổ biến ≥ ${opts.minPopularity}, ≥ ${opts.minPlays} lượt, RD ≤ ${opts.maxRd})…`,
  );
  const counts = new Map();
  const rejected = {};
  let seen = 0;
  let passed = 0;
  for await (const line of textLines(src.path)) {
    const p = parsePuzzleLine(line);
    if (!p) continue;
    seen++;
    const why = rejectPuzzle(p, filter);
    if (why) {
      rejected[why] = (rejected[why] ?? 0) + 1;
      continue;
    }
    passed++;
    const key = stratumOf(p);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const quotas = allocateQuotas(counts, opts.target);
  const planned = [...quotas.values()].reduce((a, b) => a + b, 0);
  console.log(
    `  ${seen} puzzle đọc, ${passed} đạt lọc, ${counts.size} tầng, kế hoạch lấy ~${planned}`,
  );

  // Lượt 2: chọn và (nếu không dry-run) ghi CSV
  console.log('Lượt 2/2: chọn mẫu…');
  let out = null;
  if (!opts.dryRun) {
    mkdirSync(resolve(opts.out), { recursive: true });
    out = createWriteStream(join(resolve(opts.out), 'puzzles.csv'));
    out.write(PUZZLE_CSV_HEADER);
  }
  let picked = 0;
  let estBytes = 0;
  let ratingMin = Number.POSITIVE_INFINITY;
  let ratingMax = 0;
  const byTheme = new Map();
  for await (const line of textLines(src.path)) {
    const p = parsePuzzleLine(line);
    if (!p || rejectPuzzle(p, filter)) continue;
    if (!selected(p, counts, quotas, opts.seed)) continue;
    picked++;
    estBytes += estimateRowBytes(p);
    ratingMin = Math.min(ratingMin, p.rating);
    ratingMax = Math.max(ratingMax, p.rating);
    const theme = stratumOf(p).split('|')[1];
    byTheme.set(theme, (byTheme.get(theme) ?? 0) + 1);
    out?.write(puzzleRow(p, SOURCE));
  }
  if (out) await new Promise((r) => out.end(r));

  const top = [...byTheme.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  console.log('\n──── Thống kê ────');
  console.log(
    `Puzzle đọc: ${seen}; đạt lọc: ${passed}; đã chọn: ${picked} (mục tiêu ${opts.target})`,
  );
  console.log(
    `Loại: ${Object.entries(rejected)
      .map(([k, v]) => `${k} ${v}`)
      .join(', ')}`,
  );
  console.log(
    `Số tầng: ${counts.size}; dải rating: ${Math.round(ratingMin)}–${Math.round(ratingMax)}`,
  );
  console.log(`Chủ đề chính nhiều nhất: ${top.map(([k, v]) => `${k} ${v}`).join(', ')}`);
  console.log(
    `Dung lượng ước tính trong DB: ${(estBytes / MB).toFixed(1)} MB (gồm chỉ mục); dữ liệu tải ${(src.bytes / MB).toFixed(0)} MB`,
  );
  console.log(`Thời gian chạy: ${((Date.now() - t0) / 1000).toFixed(0)} giây`);
  if (out) {
    const csvPath = join(resolve(opts.out), 'puzzles.csv');
    console.log(`Đã ghi ${csvPath} (${(statSync(csvPath).size / MB).toFixed(1)} MB).`);
  } else {
    console.log('Dry-run: chưa ghi tệp nào.');
  }
}

// Chỉ chạy khi gọi trực tiếp (để test import được parseArgs)
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
