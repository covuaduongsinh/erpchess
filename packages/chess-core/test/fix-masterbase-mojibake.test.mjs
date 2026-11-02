import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import {
  applyFixes,
  eLit,
  parseArgs,
  planFixes,
} from '../../../scripts/supabase-move/fix-masterbase-mojibake.mjs';

const doubleEncode = (s) => Buffer.from(s, 'utf8').toString('latin1');

function pgliteDb(pg) {
  const wrap = (q) => ({
    query: async (t) => (await q.query(t)).rows,
    exec: async (t) => void (await q.exec(t)),
  });
  return { ...wrap(pg), transaction: (fn) => pg.transaction((tx) => fn(wrap(tx))) };
}

async function seeded() {
  const pg = new PGlite();
  await pg.exec('create role authenticated; create role anon;');
  for (const f of ['20261031000032_masterbase.sql', '20261102000044_masterbase_is_engine.sql']) {
    await pg.exec(
      readFileSync(new URL(`../../../supabase/migrations/${f}`, import.meta.url), 'utf8'),
    );
  }
  const ins = (id, white, black, event, site, we = 2500) =>
    pg.query(
      'insert into public.masterbase_games (id, white, black, white_elo, black_elo, result, event, site, date, ply_count, pgn, source) values ($1,$2,$3,$4,$4,$5,$6,$7,$8,6,$9,$10)',
      [id, white, black, we, '1-0', event, site, '2026.10.01', '1. e4 e5 1-0', 'thử'],
    );
  await ins(1, 'An', 'Bình', 'Open 2026', 'Hà Nội');
  await ins(2, 'Lý', 'Trần', doubleEncode('2026年全国国际象棋'), 'https://x');
  await ins(3, doubleEncode('Nguyễn Hoàng'), 'Phạm', 'Giải', doubleEncode('Hà Nội'));
  await ins(4, 'Ana', 'Bia', '1� Divis�o', 'Porto'); // đã mất byte: không sửa được
  await ins(5, 'Ví dụ', "O'Brien", 'Tên  có dấu gạch', 'TCEC site', 3244);
  return pg;
}

describe('fix-masterbase-mojibake', { timeout: 120_000 }, () => {
  it('planFixes: chỉ ván hỏng mã hoá kép; U+FFFD chỉ đếm; không ghi gì', async () => {
    const pg = await seeded();
    const before = (
      await pg.query(
        'select id, white, black, event, site from public.masterbase_games order by id',
      )
    ).rows;
    const plan = await planFixes(pgliteDb(pg));
    expect(plan.fixes.map((f) => f.id)).toEqual([2, 3]);
    expect(plan.fixes[0]).toMatchObject({
      before: { event: doubleEncode('2026年全国国际象棋') },
      after: { event: '2026年全国国际象棋' },
    });
    expect(Object.keys(plan.fixes[1].after).sort()).toEqual(['site', 'white']);
    expect(plan.fixes[1].after).toEqual({ white: 'Nguyễn Hoàng', site: 'Hà Nội' });
    expect(plan.unfixable).toBe(1);
    expect(
      (
        await pg.query(
          'select id, white, black, event, site from public.masterbase_games order by id',
        )
      ).rows,
    ).toEqual(before);
  });

  it('applyFixes: một giao dịch, sửa đúng, is_engine tính lại, chạy lại không còn gì; khôi phục từ sao lưu', async () => {
    const pg = await seeded();
    const db = pgliteDb(pg);
    const { fixes } = await planFixes(db);
    expect(
      await applyFixes(
        db,
        fixes.map((f) => ({ id: f.id, set: f.after })),
      ),
    ).toBe(2);
    const row = (
      await pg.query(
        'select event, white, site from public.masterbase_games where id in (2,3) order by id',
      )
    ).rows;
    expect(row[0].event).toBe('2026年全国国际象棋');
    expect(row[1]).toMatchObject({ white: 'Nguyễn Hoàng', site: 'Hà Nội' });
    // Ván khác giữ nguyên, kể cả chuỗi có ' và \
    const other = (await pg.query('select black, event from public.masterbase_games where id = 5'))
      .rows[0];
    expect(other).toEqual({ black: "O'Brien", event: 'Tên  có dấu gạch' });
    expect((await planFixes(db)).fixes).toEqual([]);
    // Giá trị có \ và ' đi qua E'…' nguyên vẹn
    const tricky = "tên \\ và ' đặc biệt";
    await applyFixes(db, [{ id: 5, set: { event: tricky } }]);
    expect(
      (await pg.query('select event from public.masterbase_games where id = 5')).rows[0].event,
    ).toBe(tricky);
    // Hoàn tác
    await applyFixes(
      db,
      fixes.map((f) => ({ id: f.id, set: f.before })),
    );
    expect(
      (await pg.query('select event from public.masterbase_games where id = 2')).rows[0].event,
    ).toBe(doubleEncode('2026年全国国际象棋'));
  });

  it('một UPDATE không khớp đúng 1 dòng thì lùi toàn bộ', async () => {
    const pg = await seeded();
    const db = pgliteDb(pg);
    await expect(
      applyFixes(db, [
        { id: 2, set: { event: 'ĐÃ ĐỔI' } },
        { id: 999999, set: { event: 'x' } },
      ]),
    ).rejects.toThrow(/không đúng 1 dòng/);
    expect(
      (await pg.query('select event from public.masterbase_games where id = 2')).rows[0].event,
    ).toBe(doubleEncode('2026年全国国际象棋'));
  });

  it("eLit thoát  và ' ; parseArgs mặc định chỉ đọc", () => {
    expect(eLit("a'b\\c")).toBe("E'a''b\\\\c'");
    expect(parseArgs([])).toMatchObject({ apply: false, restore: null });
    expect(parseArgs(['--apply']).apply).toBe(true);
    expect(parseArgs(['--dry-run']).apply).toBe(false);
    expect(parseArgs(['--restore', 'x.json']).restore).toBe('x.json');
    expect(() => parseArgs(['--apply', '--restore', 'x'])).toThrow(/không dùng cùng nhau/);
    expect(() => parseArgs(['--lạ'])).toThrow(/Tham số lạ/);
  });
});
