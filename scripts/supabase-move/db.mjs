// Bọc thư viện `postgres` thành giao diện nhỏ mà sql.mjs cần (test dùng PGlite với cùng giao diện).
//
//   db.query(sql)                     → mảng dòng
//   db.exec(sql)                      → chạy chuỗi nhiều câu lệnh (giao thức đơn giản)
//   db.transaction(fn, mode?)         → fn(tx) trong một giao dịch; mode vd 'isolation level repeatable read read only'
//   tx.query / tx.exec                như trên
//   tx.copyOut(sql)                   → async iterable các Buffer (COPY … TO STDOUT)
//   tx.copyIn(sql, asyncIterable)     COPY … FROM STDIN
//   db.close()
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

export async function openDb(url) {
  const { default: postgres } = await import('postgres');
  const sql = postgres(url, {
    max: 1,
    prepare: false,
    onnotice: () => {},
    connect_timeout: 20,
    idle_timeout: 0,
  });
  const wrap = (q) => ({
    query: (text) => q.unsafe(text),
    exec: async (text) => {
      await q.unsafe(text);
    },
    async *copyOut(text) {
      const r = await q.unsafe(text).readable();
      yield* r;
    },
    copyIn: async (text, source) => {
      const w = await q.unsafe(text).writable();
      await pipeline(Readable.from(source), w);
    },
  });
  return {
    query: (text) => sql.unsafe(text),
    exec: async (text) => {
      await sql.unsafe(text);
    },
    transaction: (fn, mode) =>
      mode ? sql.begin(mode, (tx) => fn(wrap(tx))) : sql.begin((tx) => fn(wrap(tx))),
    close: () => sql.end({ timeout: 5 }),
  };
}
