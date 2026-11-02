// Phần logic SQL của công cụ chuyển Supabase: áp migration, chép dữ liệu theo thứ tự khoá ngoại,
// đồng bộ sequence, đếm dòng. Chỉ phụ thuộc giao diện db của db.mjs nên test được bằng PGlite.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const quoteIdent = (s) => `"${String(s).replaceAll('"', '""')}"`;
export const qname = (t) => `${quoteIdent(t.schema)}.${quoteIdent(t.name)}`;
export const tkey = (t) => `${t.schema}.${t.name}`;
const lit = (s) => `'${String(s).replaceAll("'", "''")}'`;

/** Bảng auth luôn chép trước (public.* tham chiếu auth.users). Mật khẩu đã băm nên người dùng vẫn đăng nhập được. */
export const AUTH_TABLES = [
  { schema: 'auth', name: 'users' },
  { schema: 'auth', name: 'identities' },
];

// ───────────────────────── Migration ─────────────────────────

/** `supabase/migrations/<phiên bản>_<tên>.sql` theo thứ tự tên tệp. */
export function readMigrations(dir) {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((file) => {
      const m = /^(\d+)_(.*)\.sql$/.exec(file);
      if (!m) throw new Error(`Tên migration không đúng dạng <số>_<tên>.sql: ${file}`);
      return { file, version: m[1], name: m[2], sql: readFileSync(join(dir, file), 'utf8') };
    });
}

/** Tên extension mà các migration yêu cầu (`create extension [if not exists] "x"`). */
export function requiredExtensions(migrations) {
  const set = new Set();
  const re = /create\s+extension\s+(?:if\s+not\s+exists\s+)?"?([a-z0-9_-]+)"?/gi;
  for (const m of migrations) for (const x of m.sql.matchAll(re)) set.add(x[1].toLowerCase());
  return [...set].sort();
}

export async function extensionStatus(db, wanted) {
  const inst = new Set((await db.query('select extname from pg_extension')).map((r) => r.extname));
  const avail = new Map(
    (
      await db.query(
        'select name, bool_or(trusted) as trusted, bool_or(superuser) as superuser from pg_available_extension_versions group by name',
      )
    ).map((r) => [r.name, r]),
  );
  return wanted.map((name) => {
    const a = avail.get(name);
    return {
      name,
      installed: inst.has(name),
      available: !!a,
      // Extension "không trusted" mà đòi superuser (vd. pg_cron) thì role thường không tự `create extension` được.
      needsSuperuser: !!a && a.superuser === true && a.trusted !== true,
    };
  });
}

export async function isSuperuser(db) {
  const r = await db.query('select rolsuper from pg_roles where rolname = current_user');
  return r[0]?.rolsuper === true;
}

/**
 * Extension mà migration cần nhưng KHÔNG thể tự bật bằng role hiện tại:
 * thiếu hẳn trong instance, hoặc chưa bật + không trusted + role không phải superuser.
 */
export function extensionBlockers(statuses, superuser) {
  const out = [];
  for (const e of statuses) {
    if (e.installed) continue;
    if (!e.available) {
      out.push({
        name: e.name,
        reason: 'instance không có gói extension này (cần cài vào image Postgres)',
        fix: null,
      });
    } else if (e.needsSuperuser && !superuser) {
      out.push({
        name: e.name,
        reason:
          'chưa bật, là extension không-trusted đòi superuser mà role hiện tại không phải superuser',
        fix: `docker exec <container-db> psql -U supabase_admin -d postgres -c "create extension if not exists ${e.name};" (cần superuser; tên container xem trong Dokploy)`,
      });
    }
  }
  return out;
}

/** Kiểm trước khi áp schema: trạng thái extension cần + lỗi chặn. Chỉ đọc. */
export async function preflightExtensions(db, migrations) {
  const statuses = await extensionStatus(db, requiredExtensions(migrations));
  const superuser = await isSuperuser(db);
  return { statuses, superuser, blockers: extensionBlockers(statuses, superuser) };
}

export function formatBlockers(blockers) {
  return blockers
    .map((b) => `  - ${b.name}: ${b.reason}${b.fix ? `\n      chạy: ${b.fix}` : ''}`)
    .join('\n');
}

export class MigrationError extends Error {
  constructor(file, cause, sql) {
    const pos = Number(cause?.position);
    let near = '';
    if (pos > 0) {
      near = ` — gần: ${sql
        .slice(Math.max(0, pos - 41), pos + 79)
        .replace(/\s+/g, ' ')
        .trim()}`;
    }
    super(`Migration lỗi ở ${file}: ${cause?.message ?? cause}${near}`);
    this.file = file;
  }
}

const HISTORY_DDL = `create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text not null primary key,
  statements text[],
  name text
)`;

/**
 * Áp các migration chưa có trong supabase_migrations.schema_migrations, theo thứ tự; dừng ở tệp lỗi.
 * Mỗi tệp chạy như một chuỗi nhiều câu lệnh (một giao dịch ngầm), thành công mới ghi lịch sử.
 */
export async function applyMigrations(db, migrations, { dryRun = false, log = () => {} } = {}) {
  // --dry-run phải HOÀN TOÀN chỉ đọc: chưa có bảng lịch sử nghĩa là chưa áp gì, không tạo gì cả.
  const hasHistory =
    (
      await db.query(
        "select to_regclass('supabase_migrations.schema_migrations') is not null as ok",
      )
    )[0].ok === true;
  if (!hasHistory && !dryRun) await db.exec(HISTORY_DDL);
  const done = new Set(
    hasHistory
      ? (await db.query('select version from supabase_migrations.schema_migrations')).map(
          (r) => r.version,
        )
      : [],
  );
  const pending = migrations.filter((m) => !done.has(m.version));
  log(
    `${migrations.length} migration, đã có ${migrations.length - pending.length}, chờ áp ${pending.length}`,
  );
  if (dryRun) {
    for (const m of pending) log(`  sẽ áp: ${m.file}`);
    return { applied: [], pending: pending.map((m) => m.file) };
  }
  const applied = [];
  for (const m of pending) {
    try {
      await db.exec(m.sql);
    } catch (e) {
      throw new MigrationError(m.file, e, m.sql);
    }
    await db.exec(
      `insert into supabase_migrations.schema_migrations (version, name, statements) values (${lit(m.version)}, ${lit(m.name)}, '{}') on conflict (version) do nothing`,
    );
    applied.push(m.file);
    log(`  đã áp ${m.file}`);
  }
  return { applied, pending: [] };
}

// ───────────────────────── Dữ liệu ─────────────────────────

export async function listTables(db, schema) {
  const rows = await db.query(
    `select c.relname as name from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = ${lit(schema)} and c.relkind in ('r', 'p') order by c.relname`,
  );
  return rows.map((r) => ({ schema, name: r.name }));
}

export async function fkEdges(db) {
  const rows = await db.query(
    `select cn.nspname || '.' || cc.relname as child, pn.nspname || '.' || pc.relname as parent
     from pg_constraint k
     join pg_class cc on cc.oid = k.conrelid join pg_namespace cn on cn.oid = cc.relnamespace
     join pg_class pc on pc.oid = k.confrelid join pg_namespace pn on pn.oid = pc.relnamespace
     where k.contype = 'f'`,
  );
  return rows.map((r) => ({ child: r.child, parent: r.parent }));
}

/** Sắp xếp topo: bảng cha trước bảng con. Bảng nằm trong chu trình được đặt cuối và trả riêng trong `cyclic`. */
export function orderTables(tables, edges) {
  const keys = new Set(tables.map(tkey));
  const deps = new Map(tables.map((t) => [tkey(t), new Set()]));
  for (const e of edges) {
    if (e.child !== e.parent && keys.has(e.child) && keys.has(e.parent))
      deps.get(e.child).add(e.parent);
  }
  const order = [];
  const placed = new Set();
  let progress = true;
  while (progress) {
    progress = false;
    for (const t of tables) {
      const k = tkey(t);
      if (placed.has(k)) continue;
      if ([...deps.get(k)].every((p) => placed.has(p))) {
        order.push(t);
        placed.add(k);
        progress = true;
      }
    }
  }
  const cyclic = tables.filter((t) => !placed.has(tkey(t)));
  return { order: [...order, ...cyclic], cyclic };
}

/** Cột chép được: không bị xoá, không phải cột sinh (generated), theo thứ tự attnum. */
export async function copyableColumns(db, t) {
  const rows = await db.query(
    `select a.attname as name from pg_attribute a
     where a.attrelid = ${lit(qname(t))}::regclass and a.attnum > 0 and not a.attisdropped and a.attgenerated = ''
     order by a.attnum`,
  );
  return rows.map((r) => r.name);
}

export async function hasUniqueKey(db, t) {
  const r = await db.query(
    `select count(*)::int as n from pg_index where indrelid = ${lit(qname(t))}::regclass and indisunique`,
  );
  return Number(r[0].n) > 0;
}

export async function countRows(db, t) {
  const r = await db.query(`select count(*)::text as n from ${qname(t)}`);
  return Number(r[0].n);
}

/**
 * Kế hoạch chép: bảng có ở CẢ HAI phía, cột = giao của hai phía (phiên bản GoTrue có thể khác cột).
 * `skip`/`only` là tên bảng (`users`, `public.users`, `auth.users`).
 */
export async function planData(oldDb, newDb, { skip = [], only = null } = {}) {
  const match = (t, list) => list.some((x) => x === t.name || x === tkey(t));
  const oldPublic = await listTables(oldDb, 'public');
  const newPublic = await listTables(newDb, 'public');
  const newKeys = new Set(newPublic.map(tkey));
  const oldKeys = new Set(oldPublic.map(tkey));
  const { order } = orderTables(newPublic, await fkEdges(newDb));
  const candidates = [...AUTH_TABLES, ...order];
  const plan = [];
  const notes = [];
  for (const t of candidates) {
    if (only && !match(t, only)) continue;
    if (skip.length && match(t, skip)) continue;
    const inNew = t.schema === 'auth' ? await tableExists(newDb, t) : newKeys.has(tkey(t));
    const inOld = t.schema === 'auth' ? await tableExists(oldDb, t) : oldKeys.has(tkey(t));
    if (!inNew || !inOld) {
      notes.push(`${tkey(t)}: ${inOld ? 'chỉ có ở DB cũ' : 'không có ở DB cũ'} — bỏ qua`);
      continue;
    }
    const oldCols = new Set(await copyableColumns(oldDb, t));
    const newCols = await copyableColumns(newDb, t);
    const cols = newCols.filter((c) => oldCols.has(c));
    const dropped = [...oldCols].filter((c) => !newCols.includes(c));
    plan.push({ ...t, cols, dropped, keyed: await hasUniqueKey(newDb, t) });
  }
  const { cyclic } = orderTables(newPublic, await fkEdges(newDb));
  for (const t of cyclic)
    notes.push(`${tkey(t)}: nằm trong chu trình khoá ngoại (cần tắt trigger để nạp đúng)`);
  return { plan, notes };
}

async function tableExists(db, t) {
  const r = await db.query(`select to_regclass(${lit(qname(t))}) is not null as ok`);
  return r[0].ok === true || r[0].ok === 't';
}

/** Thử bật session_replication_role = replica (cần quyền); cần để không sinh thông báo/XP lặp khi nạp. */
export async function canUseReplica(db) {
  try {
    await db.transaction((tx) => tx.exec('set local session_replication_role = replica'));
    return true;
  } catch {
    return false;
  }
}

async function copyTable(readTx, newDb, t, { replica }) {
  const cols = t.cols.map(quoteIdent).join(', ');
  const dest = qname(t);
  return newDb.transaction(async (tx) => {
    if (replica) await tx.exec('set local session_replication_role = replica');
    await tx.exec(
      `create temp table _mv_stg on commit drop as select ${cols} from ${dest} with no data`,
    );
    await tx.copyIn(
      `copy _mv_stg (${cols}) from stdin`,
      readTx.copyOut(`copy ${dest} (${cols}) to stdout`),
    );
    const r = await tx.query(
      `with ins as (insert into ${dest} (${cols}) overriding system value select ${cols} from _mv_stg on conflict do nothing returning 1) select count(*)::int as n from ins`,
    );
    return Number(r[0].n);
  });
}

/**
 * Chép dữ liệu theo `plan`. DB cũ đọc trong MỘT giao dịch repeatable read (ảnh chụp nhất quán giữa các bảng).
 * Bảng không có khoá duy nhất mà đích đã có dòng thì bỏ qua (nếu không chạy lại sẽ nhân đôi).
 */
export async function copyData(
  oldDb,
  newDb,
  plan,
  { dryRun = false, replica = true, log = () => {} } = {},
) {
  const results = [];
  const run = async (readTx) => {
    for (const t of plan) {
      const src = await countRows(readTx, t); // qua giao dịch đang mở (kết nối đơn)
      const dst = await countRows(newDb, t);
      if (dryRun) {
        log(
          `  ${tkey(t)}: cũ ${src}, mới ${dst}, ${t.cols.length} cột${t.dropped.length ? `, bỏ ${t.dropped.length} cột chỉ có ở cũ` : ''}`,
        );
        results.push({ table: tkey(t), src, dst, inserted: 0, skipped: false });
        continue;
      }
      if (!t.keyed && dst > 0) {
        log(
          `  ${tkey(t)}: không có khoá duy nhất và đích đã có ${dst} dòng — bỏ qua để khỏi nhân đôi`,
        );
        results.push({ table: tkey(t), src, dst, inserted: 0, skipped: true });
        continue;
      }
      const inserted = await copyTable(readTx, newDb, t, { replica });
      log(`  ${tkey(t)}: cũ ${src}, thêm mới ${inserted}, bỏ qua do trùng ${src - inserted}`);
      results.push({ table: tkey(t), src, dst, inserted, skipped: false });
    }
  };
  await oldDb.transaction(run, 'isolation level repeatable read read only');
  return results;
}

/** Đưa mọi sequence (serial/identity) của các bảng đã chép lên max(cột) hiện có. */
export async function syncSequences(db, tables, { log = () => {} } = {}) {
  const done = [];
  for (const t of tables) {
    const cols = await db.query(
      `select a.attname as col, pg_get_serial_sequence(${lit(qname(t))}, a.attname) as seq
       from pg_attribute a where a.attrelid = ${lit(qname(t))}::regclass and a.attnum > 0 and not a.attisdropped`,
    );
    for (const c of cols) {
      if (!c.seq) continue;
      const col = quoteIdent(c.col);
      await db.query(
        `select setval(${lit(c.seq)}, greatest(coalesce(max(${col}), 0), 1), max(${col}) is not null) from ${qname(t)}`,
      );
      done.push(`${tkey(t)}.${c.col}`);
    }
  }
  if (done.length) log(`Đã đồng bộ ${done.length} sequence: ${done.join(', ')}`);
  return done;
}

/** So số dòng hai phía cho các bảng chung (auth.users, auth.identities, public.*). */
export async function compareCounts(oldDb, newDb) {
  const { plan } = await planData(oldDb, newDb);
  const rows = [];
  for (const t of plan) {
    const o = await countRows(oldDb, t);
    const n = await countRows(newDb, t);
    rows.push({ table: tkey(t), old: o, new: n, ok: o === n });
  }
  return rows;
}
