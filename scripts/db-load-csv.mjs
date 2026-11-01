// Nạp CSV đã sinh bởi puzzle-bank-import.mjs / masterbase-broadcast.mjs vào Postgres (Supabase) — Giai đoạn 27d.
// Thay cho `psql \copy` (máy không có psql). Dùng thư viện `postgres` (COPY … FROM STDIN).
//
// ── Cách dùng (PowerShell) ─────────────────────────────────
//   $env:DATABASE_URL = 'postgresql://postgres.<ref>:<mật-khẩu>@<host>:5432/postgres'
//   node scripts/db-load-csv.mjs puzzle-bank
//   node scripts/db-load-csv.mjs masterbase
// Chuỗi kết nối: Dashboard → Project Settings → Database → Connection string (dùng "Session pooler"
// nếu mạng chỉ có IPv4). Mật khẩu CHỈ đi qua biến môi trường DATABASE_URL — script không nhận mật khẩu
// qua tham số và không in chuỗi kết nối ra.
//
// Lệnh con:
//   puzzle-bank   nạp out/puzzle-bank/puzzles.csv        → public.puzzle_bank
//   masterbase    nạp games.csv TRƯỚC, rồi positions.csv → public.masterbase_games, masterbase_positions
// Tuỳ chọn:
//   --dir <thư mục>   thư mục chứa CSV (mặc định out/puzzle-bank hoặc out/masterbase)
//   --batch-mb 8      kích cỡ mỗi lô (mỗi lô một giao dịch)
//   --dry-run         chỉ kiểm tra tệp (tiêu đề, số dòng), KHÔNG kết nối CSDL, không cần DATABASE_URL
//
// Chạy lại an toàn: mỗi lô nạp vào bảng tạm rồi `insert … on conflict do nothing`, dòng trùng bị bỏ qua.
// Cuối cùng in số dòng và pg_total_relation_size của các bảng.
import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  inspectCsv,
  LOAD_TARGETS,
  loadStep,
  tableReport,
} from '../packages/chess-core/scripts/db-load-lib.mjs';

export function parseArgs(argv) {
  const [cmd, ...rest] = argv;
  if (!cmd || !(cmd in LOAD_TARGETS)) {
    throw new Error(`Cần lệnh con: ${Object.keys(LOAD_TARGETS).join(' | ')}`);
  }
  const opts = { cmd, dir: LOAD_TARGETS[cmd].dir, batchMb: 8, dryRun: false };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (/^postgres(ql)?:/i.test(a)) {
      throw new Error('Không nhận chuỗi kết nối qua tham số; đặt biến môi trường DATABASE_URL.');
    }
    if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--dir') opts.dir = rest[++i];
    else if (a === '--batch-mb') opts.batchMb = Number(rest[++i]);
    else throw new Error(`Tham số lạ: ${a}`);
  }
  if (!opts.dir) throw new Error('Thiếu giá trị cho --dir');
  if (!Number.isFinite(opts.batchMb) || opts.batchMb <= 0 || opts.batchMb > 64) {
    throw new Error('--batch-mb phải trong khoảng (0, 64]');
  }
  return opts;
}

/** Bọc thư viện `postgres` thành giao diện {transaction, query, copyIn} mà db-load-lib cần. */
async function connect(url) {
  const { default: postgres } = await import('postgres');
  const { pipeline } = await import('node:stream/promises');
  const { Readable } = await import('node:stream');
  const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {}, idle_timeout: 20 });
  return {
    transaction: (fn) =>
      sql.begin((tx) =>
        fn({
          query: (text) => tx.unsafe(text),
          copyIn: async (text, data) => {
            const w = await tx.unsafe(text).writable();
            await pipeline(Readable.from([data]), w);
          },
        }),
      ),
    close: () => sql.end({ timeout: 5 }),
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const target = LOAD_TARGETS[opts.cmd];
  const dir = resolve(opts.dir);
  const maxBytes = Math.round(opts.batchMb * 1024 * 1024);

  // Kiểm tệp trước (cả khi nạp thật) để lỗi tiêu đề/thiếu tệp báo sớm, trước khi chạm CSDL.
  const counts = [];
  for (const step of target.steps) {
    const path = resolve(dir, step.file);
    let size;
    try {
      size = statSync(path).size;
    } catch {
      throw new Error(
        `Không thấy ${path}. Chạy script tạo CSV trước (xem đầu tệp scripts/*-import|broadcast.mjs).`,
      );
    }
    const rows = await inspectCsv(path, step.columns);
    counts.push({ step, path, rows });
    console.log(
      `${step.file}: ${rows.toLocaleString('vi-VN')} dòng, ${(size / 1048576).toFixed(1)} MB`,
    );
  }
  if (opts.dryRun) {
    console.log('--dry-run: không kết nối CSDL, không nạp.');
    return;
  }

  // biome-ignore lint/suspicious/noUndeclaredEnvVars: script chạy tay ngoài turbo
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Thiếu biến môi trường DATABASE_URL (xem hướng dẫn ở đầu tệp).');
  const db = await connect(url);
  try {
    for (const { step, path } of counts) {
      console.log(`Nạp ${step.table}…`);
      const r = await loadStep(db, step, path, { maxBytes, log: (m) => console.log(m) });
      console.log(
        `  xong: đọc ${r.read.toLocaleString('vi-VN')}, thêm mới ${r.inserted.toLocaleString('vi-VN')}, bỏ qua do trùng ${(r.read - r.inserted).toLocaleString('vi-VN')}`,
      );
    }
    console.log('Sau khi nạp:');
    for (const t of await tableReport(
      db,
      target.steps.map((s) => s.table),
    )) {
      console.log(`  ${t.table}: ${t.rows.toLocaleString('vi-VN')} dòng, ${t.size}`);
    }
  } finally {
    await db.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(`Lỗi: ${e.message}`);
    process.exit(1);
  });
}
