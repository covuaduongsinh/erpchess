// Công cụ chuyển Supabase từ cloud (erpchess-dev) sang self-host. Xem README.md cùng thư mục
// và docs/plans/21-chuyen-supabase-sang-self-host.md.
//
//   node scripts/supabase-move/index.mjs <check|schema|data|storage|verify> [tuỳ chọn]
//
// Tuỳ chọn: --dry-run  --env <tệp>  --skip a,b  --only a,b  --allow-triggers  --no-storage
// Đọc cấu hình từ .env.supabase-move (gitignore). Không bao giờ in khoá/mật khẩu/chuỗi kết nối.
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.mjs';
import { loadEnv, redact, requireKeys, secretsOf } from './env.mjs';
import { checkHttps } from './https.mjs';
import {
  AUTH_TABLES,
  applyMigrations,
  canUseReplica,
  compareCounts,
  copyData,
  countRows,
  extensionStatus,
  listTables,
  planData,
  readMigrations,
  requiredExtensions,
  syncSequences,
  tkey,
} from './sql.mjs';
import { compareStorage, moveStorage, storageClient } from './storage.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const MIGRATIONS_DIR = resolve(HERE, '../../supabase/migrations');
export const COMMANDS = ['check', 'schema', 'data', 'storage', 'verify'];

export function parseArgs(argv) {
  const [cmd, ...rest] = argv;
  if (!COMMANDS.includes(cmd)) throw new Error(`Cần lệnh con: ${COMMANDS.join(' | ')}`);
  const o = {
    cmd,
    dryRun: false,
    env: '.env.supabase-move',
    skip: [],
    only: null,
    allowTriggers: false,
    noStorage: false,
  };
  const list = (v) => {
    if (!v) throw new Error('Thiếu giá trị cho tham số danh sách');
    return v
      .split(',')
      .map((x) => x.trim())
      .filter(Boolean);
  };
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--dry-run') o.dryRun = true;
    else if (a === '--allow-triggers') o.allowTriggers = true;
    else if (a === '--no-storage') o.noStorage = true;
    else if (a === '--env') o.env = rest[++i];
    else if (a === '--skip') o.skip = list(rest[++i]);
    else if (a === '--only') o.only = list(rest[++i]);
    else throw new Error(`Tham số lạ: ${a}`);
  }
  if (!o.env) throw new Error('Thiếu giá trị cho --env');
  return o;
}

const say = (m) => console.log(m);
const shortVersion = (v) => String(v).split(' on ')[0];

async function snapshot(db) {
  const tables = [...AUTH_TABLES, ...(await listTables(db, 'public'))];
  const out = [];
  for (const t of tables) {
    try {
      out.push({ table: tkey(t), rows: await countRows(db, t) });
    } catch {
      out.push({ table: tkey(t), rows: null });
    }
  }
  return out;
}

async function cmdCheck(env) {
  requireKeys(env, ['OLD_DATABASE_URL', 'NEW_DATABASE_URL', 'NEW_SUPABASE_URL', 'NEW_ANON_KEY']);
  const wanted = requiredExtensions(readMigrations(MIGRATIONS_DIR));
  let bad = false;
  for (const [label, key] of [
    ['CŨ', 'OLD_DATABASE_URL'],
    ['MỚI', 'NEW_DATABASE_URL'],
  ]) {
    say(`── DB ${label} ──`);
    const db = await openDb(env[key]);
    try {
      say(`Phiên bản: ${shortVersion((await db.query('select version() as v'))[0].v)}`);
      for (const e of await extensionStatus(db, wanted)) {
        const st = e.installed ? 'đã cài' : e.available ? 'có sẵn (chưa bật)' : 'THIẾU';
        if (!e.installed && !e.available) bad = true;
        say(`  extension ${e.name}: ${st}`);
      }
      if (label === 'MỚI') {
        const r = await canUseReplica(db);
        say(
          `  session_replication_role = replica: ${r ? 'được' : 'KHÔNG được (trigger sẽ chạy khi nạp; cần --allow-triggers hoặc cấp quyền)'}`,
        );
      }
      const snap = await snapshot(db);
      for (const s of snap) say(`  ${s.table}: ${s.rows ?? '(chưa có bảng)'}`);
    } finally {
      await db.close();
    }
  }
  say('── HTTPS instance mới ──');
  const h = await checkHttps(env.NEW_SUPABASE_URL, env.NEW_ANON_KEY);
  say(h.message);
  if (!h.ok) bad = true;
  if (bad) process.exitCode = 1;
}

async function cmdSchema(env, o) {
  requireKeys(env, ['NEW_DATABASE_URL']);
  const migrations = readMigrations(MIGRATIONS_DIR);
  const db = await openDb(env.NEW_DATABASE_URL);
  try {
    const missing = (await extensionStatus(db, requiredExtensions(migrations))).filter(
      (e) => !e.installed && !e.available,
    );
    if (missing.length) {
      throw new Error(
        `Instance mới thiếu extension: ${missing.map((e) => e.name).join(', ')} — chưa áp migration nào.`,
      );
    }
    await applyMigrations(db, migrations, { dryRun: o.dryRun, log: say });
  } finally {
    await db.close();
  }
}

async function cmdData(env, o) {
  requireKeys(env, ['OLD_DATABASE_URL', 'NEW_DATABASE_URL']);
  const oldDb = await openDb(env.OLD_DATABASE_URL);
  const newDb = await openDb(env.NEW_DATABASE_URL);
  try {
    const { plan, notes } = await planData(oldDb, newDb, { skip: o.skip, only: o.only });
    for (const n of notes) say(`Lưu ý: ${n}`);
    say(`Thứ tự chép (${plan.length} bảng): ${plan.map(tkey).join(', ')}`);
    const replica = await canUseReplica(newDb);
    if (!replica && !o.dryRun && !o.allowTriggers) {
      throw new Error(
        'Không tắt được trigger người dùng (session_replication_role) trên DB mới; chạy lại với --allow-triggers nếu chấp nhận (có thể sinh thông báo/XP lặp).',
      );
    }
    const results = await copyData(oldDb, newDb, plan, { dryRun: o.dryRun, replica, log: say });
    if (!o.dryRun) await syncSequences(newDb, plan, { log: say });
    const total = results.reduce((a, r) => a + r.inserted, 0);
    say(
      o.dryRun
        ? '--dry-run: không ghi gì.'
        : `Xong: thêm mới ${total} dòng. Chạy "verify" để so số dòng.`,
    );
  } finally {
    await oldDb.close();
    await newDb.close();
  }
}

function storageClients(env) {
  requireKeys(env, [
    'OLD_SUPABASE_URL',
    'OLD_SERVICE_ROLE_KEY',
    'NEW_SUPABASE_URL',
    'NEW_SERVICE_ROLE_KEY',
  ]);
  return {
    oldC: storageClient({ baseUrl: env.OLD_SUPABASE_URL, serviceKey: env.OLD_SERVICE_ROLE_KEY }),
    newC: storageClient({ baseUrl: env.NEW_SUPABASE_URL, serviceKey: env.NEW_SERVICE_ROLE_KEY }),
  };
}

async function requireValidHttps(env) {
  requireKeys(env, ['NEW_SUPABASE_URL', 'NEW_ANON_KEY']);
  const h = await checkHttps(env.NEW_SUPABASE_URL, env.NEW_ANON_KEY);
  if (!h.ok)
    throw new Error(
      `${h.message}\nDừng: không gửi service role key tới instance chưa có HTTPS hợp lệ.`,
    );
}

async function cmdStorage(env, o) {
  const { oldC, newC } = storageClients(env);
  if (!o.dryRun) await requireValidHttps(env);
  const s = await moveStorage(oldC, newC, { dryRun: o.dryRun, log: say });
  say(`Xong ${s.length} bucket. Chính sách storage.objects đến từ migration (lệnh "schema").`);
}

async function cmdVerify(env, o) {
  requireKeys(env, ['OLD_DATABASE_URL', 'NEW_DATABASE_URL']);
  const oldDb = await openDb(env.OLD_DATABASE_URL);
  const newDb = await openDb(env.NEW_DATABASE_URL);
  let bad = false;
  try {
    say('── Số dòng ──');
    for (const r of await compareCounts(oldDb, newDb)) {
      say(`  ${r.ok ? '✓' : '✗'} ${r.table}: cũ ${r.old}, mới ${r.new}`);
      if (!r.ok) bad = true;
    }
  } finally {
    await oldDb.close();
    await newDb.close();
  }
  if (!o.noStorage) {
    say('── Storage ──');
    const { oldC, newC } = storageClients(env);
    for (const r of await compareStorage(oldC, newC)) {
      say(
        `  ${r.ok ? '✓' : '✗'} bucket ${r.bucket}: cũ ${r.old}, mới ${r.new ?? '(chưa có bucket)'}`,
      );
      if (!r.ok) bad = true;
    }
  }
  say(bad ? 'KHÔNG khớp.' : 'Khớp hoàn toàn.');
  if (bad) process.exitCode = 1;
}

const HANDLERS = {
  check: cmdCheck,
  schema: cmdSchema,
  data: cmdData,
  storage: cmdStorage,
  verify: cmdVerify,
};

async function main() {
  const o = parseArgs(process.argv.slice(2));
  const env = loadEnv(resolve(o.env));
  try {
    await HANDLERS[o.cmd](env, o);
  } catch (e) {
    throw new Error(redact(e.message, secretsOf(env)));
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(`Lỗi: ${e.message}`);
    process.exit(1);
  });
}
