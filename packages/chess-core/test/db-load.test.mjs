import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { describe, expect, it } from 'vitest';
import { parseArgs } from '../../../scripts/db-load-csv.mjs';
import {
  csvBatches,
  csvRecords,
  inspectCsv,
  LOAD_TARGETS,
  loadStep,
  tableReport,
} from '../scripts/db-load-lib.mjs';

const MIGRATIONS = '../../../supabase/migrations/';

/** Bọc PGlite thành giao diện {transaction, query, copyIn} của db-load-lib. */
function pgliteDb(pg) {
  return {
    transaction: (fn) =>
      pg.transaction((tx) =>
        fn({
          query: async (text) => (await tx.query(text)).rows,
          copyIn: async (text, data) => {
            await tx.query(text.replace('from stdin', "from '/dev/blob'"), [], {
              blob: new Blob([data]),
            });
          },
        }),
      ),
  };
}

async function freshDb() {
  const pg = new PGlite();
  await pg.exec('create role authenticated; create role anon;');
  for (const f of ['20261031000032_masterbase.sql', '20261102000043_puzzle_bank.sql']) {
    await pg.exec(readFileSync(new URL(MIGRATIONS + f, import.meta.url), 'utf8'));
  }
  return pg;
}

function tmpCsv(name, text) {
  const dir = mkdtempSync(join(tmpdir(), 'dbload-'));
  const p = join(dir, name);
  writeFileSync(p, text);
  return p;
}

const PUZ_HEADER = LOAD_TARGETS['puzzle-bank'].steps[0].columns.join(',');
const GAME_HEADER = LOAD_TARGETS.masterbase.steps[0].columns.join(',');
const POS_HEADER = LOAD_TARGETS.masterbase.steps[1].columns.join(',');
const FEN = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';

const puz = (id, rating) =>
  `${id},"${FEN}","e2e4 e7e5 g1f3 b8c6",${rating},75,90,1000,"{fork,short}","{}",Lichess puzzle database (CC0)\n`;

describe('csvRecords / csvBatches', () => {
  it('giữ xuống dòng nằm trong ô có ngoặc kép; "" không đóng ô', async () => {
    const p = tmpCsv('a.csv', 'a,b\n1,"x\ny ""q"" z"\n2,plain\n');
    const recs = [];
    for await (const r of csvRecords(p)) recs.push(r);
    expect(recs).toEqual(['a,b\n', '1,"x\ny ""q"" z"\n', '2,plain\n']);
  });

  it('bản ghi cuối không có xuống dòng vẫn được trả, kèm "\\n"', async () => {
    const p = tmpCsv('b.csv', 'a\n1\n2');
    const recs = [];
    for await (const r of csvRecords(p)) recs.push(r);
    expect(recs).toEqual(['a\n', '1\n', '2\n']);
  });

  it('chia lô theo dung lượng, bỏ dòng tiêu đề, kiểm tiêu đề', async () => {
    const p = tmpCsv(
      'c.csv',
      `${PUZ_HEADER}\n${puz('aaa01', 800)}${puz('aaa02', 900)}${puz('aaa03', 1000)}`,
    );
    const batches = [];
    for await (const b of csvBatches(p, PUZ_HEADER.split(','), 100)) batches.push(b.rows);
    expect(batches.reduce((a, b) => a + b, 0)).toBe(3);
    expect(batches.length).toBeGreaterThan(1);
    expect(await inspectCsv(p, PUZ_HEADER.split(','))).toBe(3);
    await expect(inspectCsv(p, ['x', 'y'])).rejects.toThrow(/Tiêu đề CSV không khớp/);
    await expect(inspectCsv(tmpCsv('d.csv', ''), ['x'])).rejects.toThrow(/rỗng/);
  });
});

describe('loadStep (PGlite)', { timeout: 60_000 }, () => {
  it('puzzle_bank: nạp theo lô, chạy lại không tạo dòng trùng, báo số dòng', async () => {
    const pg = await freshDb();
    const db = pgliteDb(pg);
    const step = LOAD_TARGETS['puzzle-bank'].steps[0];
    const p = tmpCsv(
      'p.csv',
      `${PUZ_HEADER}\n${puz('aaa01', 800)}${puz('aaa02', 900)}${puz('aaa03', 1000)}`,
    );
    const first = await loadStep(db, step, p, { maxBytes: 100 });
    expect(first).toEqual({ read: 3, inserted: 3 });
    const again = await loadStep(db, step, p, { maxBytes: 100 });
    expect(again).toEqual({ read: 3, inserted: 0 });
    const rows = (
      await pg.query('select lichess_id, themes, rating from public.puzzle_bank order by id')
    ).rows;
    expect(rows.map((r) => r.lichess_id)).toEqual(['aaa01', 'aaa02', 'aaa03']);
    expect(rows[0].themes).toEqual(['fork', 'short']);
    const rep = await tableReport(db, ['public.puzzle_bank']);
    expect(rep[0]).toMatchObject({ table: 'public.puzzle_bank', rows: 3 });
  });

  it('masterbase: games trước positions; PGN nhiều dòng trong ô được giữ nguyên', async () => {
    const pg = await freshDb();
    const db = pgliteDb(pg);
    const [games, pos] = LOAD_TARGETS.masterbase.steps;
    const pgn = '[Event "x"]\n\n1. e4 e5 1-0';
    const g = (id) =>
      `${id},Alice,Bob,2500,2400,1-0,Open,Site,2026.01.01,C20,2,"${pgn.replaceAll('"', '""')}",Lichess broadcast database (CC0) 2026-01\n`;
    // Ván 3: eco/event/site rỗng (không có dấu ngoặc kép) và Elo rỗng, như CSV do masterbase-broadcast ghi
    const gEmpty = `3,Alice,Bob,,,1-0,,,2026.01.01,,2,"${pgn.replaceAll('"', '""')}",Lichess broadcast database (CC0) 2026-01\n`;
    const pg1 = tmpCsv('g.csv', `${GAME_HEADER}\n${g(1)}${g(2)}${gEmpty}`);
    const ps1 = tmpCsv(
      's.csv',
      `${POS_HEADER}\n"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq",1\n"rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq",2\n`,
    );
    expect(await loadStep(db, games, pg1, { maxBytes: 60 })).toEqual({ read: 3, inserted: 3 });
    // eco/event rỗng thành chuỗi rỗng (không phải NULL); Elo rỗng vẫn là NULL
    const e = (
      await pg.query('select eco, event, white_elo from public.masterbase_games where id = 3')
    ).rows[0];
    expect(e).toEqual({ eco: '', event: '', white_elo: null });
    expect(await loadStep(db, pos, ps1)).toEqual({ read: 2, inserted: 2 });
    expect(await loadStep(db, pos, ps1)).toEqual({ read: 2, inserted: 0 });
    const r = (await pg.query('select pgn from public.masterbase_games where id = 1')).rows[0];
    expect(r.pgn).toBe(pgn);
    const rep = await tableReport(db, ['public.masterbase_games', 'public.masterbase_positions']);
    expect(rep.map((x) => x.rows)).toEqual([3, 2]);
  });

  it('dòng vi phạm ràng buộc làm lô đó lùi lại (không nạp một nửa)', async () => {
    const pg = await freshDb();
    const db = pgliteDb(pg);
    const step = LOAD_TARGETS['puzzle-bank'].steps[0];
    const p = tmpCsv('bad.csv', `${PUZ_HEADER}\n${puz('aaa01', 800)}${puz('aaa02', 99999)}`);
    await expect(loadStep(db, step, p, { maxBytes: 1 << 20 })).rejects.toThrow();
    expect((await pg.query('select count(*)::int as n from public.puzzle_bank')).rows[0].n).toBe(0);
  });
});

describe('parseArgs của db-load-csv', () => {
  it('lệnh con hợp lệ, mặc định theo đích', () => {
    expect(parseArgs(['puzzle-bank'])).toMatchObject({
      cmd: 'puzzle-bank',
      dir: 'out/puzzle-bank',
      dryRun: false,
    });
    expect(parseArgs(['masterbase', '--dry-run', '--batch-mb', '4'])).toMatchObject({
      dir: 'out/masterbase',
      dryRun: true,
      batchMb: 4,
    });
  });

  it('từ chối lệnh lạ, tham số lạ và chuỗi kết nối truyền qua tham số', () => {
    expect(() => parseArgs([])).toThrow(/lệnh con/);
    expect(() => parseArgs(['x'])).toThrow(/lệnh con/);
    expect(() => parseArgs(['masterbase', '--password', 'p'])).toThrow(/Tham số lạ/);
    expect(() => parseArgs(['masterbase', 'postgresql://u:p@h/db'])).toThrow(/DATABASE_URL/);
    expect(() => parseArgs(['masterbase', '--batch-mb', '0'])).toThrow(/batch-mb/);
  });
});
