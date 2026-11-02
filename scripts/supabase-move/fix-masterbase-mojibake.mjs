// Sửa chữ mã hoá kép đã nạp trong public.masterbase_games (white, black, event, site) — Giai đoạn 27e.
//
// Nguồn PGN của Lichess có chữ UTF-8 bị đọc thành Latin-1 rồi mã hoá lại (vd. "2026å¹´…" thay vì "2026年…"): 296 ván
// trong 23.815 ván đã nạp. Script dùng đúng `fixMojibake` của masterbase-broadcast (một nguồn quy tắc duy nhất).
//
//   node scripts/supabase-move/fix-masterbase-mojibake.mjs                # MẶC ĐỊNH chỉ đọc: in số dòng + mẫu trước/sau
//   node scripts/supabase-move/fix-masterbase-mojibake.mjs --apply        # UPDATE trong MỘT giao dịch (sau khi xem dry-run)
//   node scripts/supabase-move/fix-masterbase-mojibake.mjs --restore <tệp>  # trả về giá trị cũ từ tệp sao lưu
//
// Kết nối: NEW_DATABASE_URL trong .env.supabase-move (hoặc biến môi trường DATABASE_URL); không in chuỗi kết nối.
// Chỉ UPDATE white/black/event/site của các ván có dòng thay đổi (cột sinh is_engine tự tính lại), không DELETE.
// Trước khi ghi, lưu giá trị cũ vào out/masterbase-mojibake-backup-<thời điểm>.json (gitignore) để --restore.
// Ván có ký tự thay thế U+FFFD (byte Latin-1 đã mất khi nạp) KHÔNG sửa được từ DB: chỉ đếm, cần nạp lại từ nguồn
// bằng masterbase-broadcast.mjs (đã đọc Latin-1 đúng).
//
// Lưu ý: máy chủ self-host đặt standard_conforming_strings = off nên chuỗi được viết dạng E'…' với \ và ' được thoát.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixMojibake } from '../../packages/chess-core/scripts/masterbase-lib.mjs';
import { openDb } from './db.mjs';
import { loadEnv, redact, secretsOf } from './env.mjs';

export const FIELDS = ['white', 'black', 'event', 'site'];

/** Chuỗi SQL an toàn với cả standard_conforming_strings on/off. */
export const eLit = (s) => `E'${String(s).replaceAll('\\', '\\\\').replaceAll("'", "''")}'`;

export function parseArgs(argv) {
  const o = { apply: false, restore: null, env: '.env.supabase-move', out: 'out' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') o.apply = true;
    else if (a === '--dry-run') o.apply = false;
    else if (a === '--restore') o.restore = argv[++i];
    else if (a === '--env') o.env = argv[++i];
    else if (a === '--out') o.out = argv[++i];
    else throw new Error(`Tham số lạ: ${a}`);
  }
  if (o.apply && o.restore) throw new Error('--apply và --restore không dùng cùng nhau');
  if (o.restore === undefined || o.env === undefined || o.out === undefined) {
    throw new Error('Thiếu giá trị cho tham số');
  }
  return o;
}

/**
 * Tìm các ván cần sửa. Trả `{ scanned, fixes, unfixable }`: fixes = [{ id, before:{field}, after:{field} }] chỉ gồm
 * các trường thay đổi; unfixable = số ván còn ký tự thay thế U+FFFD ở white/black/event/site.
 */
export async function planFixes(db) {
  const anyField = (re) => FIELDS.map((f) => `${f} ~ '${re}'`).join(' or ');
  // Không dùng dấu \ trong regex: ký tự đứng đầu chuỗi UTF-8 (Â–ô) và ký tự thay thế U+FFFD viết thẳng
  const rows = await db.query(
    `select id, white, black, event, site from public.masterbase_games where ${anyField('[Â-ô]')} order by id`,
  );
  const fixes = [];
  for (const r of rows) {
    const before = {};
    const after = {};
    for (const f of FIELDS) {
      const fixed = fixMojibake(r[f]);
      if (fixed !== r[f]) {
        before[f] = r[f];
        after[f] = fixed;
      }
    }
    if (Object.keys(after).length) fixes.push({ id: Number(r.id), before, after });
  }
  const bad = await db.query(
    `select count(*)::int as n from public.masterbase_games where ${anyField('�')}`,
  );
  return { scanned: rows.length, fixes, unfixable: Number(bad[0].n) };
}

/** Ghi các thay đổi trong một giao dịch; kiểm mỗi UPDATE đúng 1 dòng, sai thì lùi toàn bộ. */
export async function applyFixes(db, changes) {
  await db.transaction(async (tx) => {
    for (const c of changes) {
      const set = Object.entries(c.set)
        .map(([f, v]) => `${f} = ${eLit(v)}`)
        .join(', ');
      const r = await tx.query(
        `with u as (update public.masterbase_games set ${set} where id = ${Number(c.id)} returning 1) select count(*)::int as n from u`,
      );
      if (Number(r[0].n) !== 1)
        throw new Error(`UPDATE ván ${c.id} không đúng 1 dòng; đã lùi toàn bộ`);
    }
  });
  return changes.length;
}

const show = (s) => String(s).replace(/\s+/g, ' ').slice(0, 70);

async function main() {
  const o = parseArgs(process.argv.slice(2));
  let env = {};
  try {
    env = loadEnv(resolve(o.env));
  } catch {
    // không có tệp env thì dùng DATABASE_URL
  }
  // biome-ignore lint/suspicious/noUndeclaredEnvVars: script chạy tay ngoài turbo
  const url = env.NEW_DATABASE_URL || process.env.DATABASE_URL;
  if (!url)
    throw new Error(
      'Thiếu NEW_DATABASE_URL (.env.supabase-move) hoặc biến môi trường DATABASE_URL',
    );
  const secrets = secretsOf({ ...env, DATABASE_URL: url });
  const db = await openDb(url);
  try {
    if (o.restore) {
      const saved = JSON.parse(readFileSync(resolve(o.restore), 'utf8'));
      const n = await applyFixes(
        db,
        saved.map((c) => ({ id: c.id, set: c.before })),
      );
      console.log(`Đã trả về giá trị cũ cho ${n} ván.`);
      return;
    }
    const { scanned, fixes, unfixable } = await planFixes(db);
    const perField = Object.fromEntries(
      FIELDS.map((f) => [f, fixes.filter((x) => f in x.after).length]),
    );
    console.log(`Ván có ký tự đáng ngờ (Â–ô): ${scanned}; sửa được: ${fixes.length}`);
    console.log(`  theo trường: ${FIELDS.map((f) => `${f} ${perField[f]}`).join(', ')}`);
    console.log(
      `Ván còn ký tự thay thế U+FFFD (không sửa được từ DB, cần nạp lại từ nguồn): ${unfixable}`,
    );
    for (const x of fixes.slice(0, 10)) {
      for (const f of Object.keys(x.after))
        console.log(`  #${x.id} ${f}: "${show(x.before[f])}" → "${show(x.after[f])}"`);
    }
    if (!o.apply) {
      console.log(
        'Chế độ chỉ đọc: chưa ghi gì. Thêm --apply để UPDATE (một giao dịch, có sao lưu).',
      );
      return;
    }
    if (!fixes.length) {
      console.log('Không có gì để sửa.');
      return;
    }
    mkdirSync(resolve(o.out), { recursive: true });
    const backup = resolve(
      o.out,
      `masterbase-mojibake-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
    );
    writeFileSync(
      backup,
      JSON.stringify(
        fixes.map((x) => ({ id: x.id, before: x.before })),
        null,
        1,
      ),
    );
    const n = await applyFixes(
      db,
      fixes.map((x) => ({ id: x.id, set: x.after })),
    );
    console.log(`Đã sửa ${n} ván trong một giao dịch. Sao lưu giá trị cũ: ${backup}`);
    console.log(
      `Hoàn tác: node scripts/supabase-move/fix-masterbase-mojibake.mjs --restore "${backup}"`,
    );
  } catch (e) {
    throw new Error(redact(e.message, secrets));
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
