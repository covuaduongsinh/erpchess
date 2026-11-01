import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { zstdCompressSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { parseArgs, parseMonths } from '../../../scripts/masterbase-broadcast.mjs';
import {
  consumeGames,
  createWriter,
  decompressZstd,
  dedupeKey,
  movesOf,
  newStats,
  parseGame,
  positionKey,
  quickHeaders,
  rejectByHeaders,
  splitGames,
  stripComments,
  zstdFrames,
} from '../scripts/masterbase-lib.mjs';

// Ván tự soạn (không lấy từ nguồn nào): 12 nước đầy đủ, chú thích eval/clk kiểu broadcast
const MOVES_12 =
  '1. e4 { [%eval 0.2] [%clk 1:30:00] } e5 { [%eval 0.1] [%clk 1:30:00] } 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O Be7 6. Re1 b5 7. Bb3 d6 8. c3 O-O 9. h3 Nb8 10. d4 Nbd7 11. Nbd2 Bb7 12. Bc2 Re8 1-0';

function game(over = {}, moves = MOVES_12) {
  const h = {
    Event: 'Giải thử',
    Site: 'https://example.test/1',
    Date: '2026.09.01',
    Round: '3',
    White: 'Nguyen, An',
    Black: 'Tran, Binh',
    Result: '1-0',
    WhiteElo: '2400',
    BlackElo: '2350',
    ...over,
  };
  const tags = Object.entries(h)
    .filter(([, v]) => v !== null)
    .map(([k, v]) => `[${k} "${v}"]`)
    .join('\n');
  return `${tags}\n\n${moves}\n`;
}

async function* lines(text) {
  for (const l of text.split('\n')) yield l;
}
async function collect(iter) {
  const out = [];
  for await (const x of iter) out.push(x);
  return out;
}

describe('splitGames / quickHeaders', () => {
  it('tách nhiều ván liền nhau, kể cả khi có dòng trống và BOM', async () => {
    const text = `﻿${game()}\n\n${game({ White: 'Le, Cuong' })}\n${game({ White: 'Pham, Dung' })}`;
    const games = await collect(splitGames(lines(text)));
    expect(games).toHaveLength(3);
    expect(quickHeaders(games[1] ?? '').White).toBe('Le, Cuong');
    expect(quickHeaders(games[2] ?? '').White).toBe('Pham, Dung');
  });

  it('quickHeaders đọc tag, kể cả dấu ngoặc kép thoát', () => {
    const h = quickHeaders('[Event "A \\"B\\""]\n[WhiteElo "2400"]\n\n1. e4 *');
    expect(h).toEqual({ Event: 'A "B"', WhiteElo: '2400' });
  });
});

describe('bộ lọc ván', () => {
  const opts = { minElo: 2300 };
  it('cần kết quả và Elo CẢ HAI bên ≥ ngưỡng', () => {
    expect(rejectByHeaders(quickHeaders(game()), opts)).toBeNull();
    expect(rejectByHeaders(quickHeaders(game({ Result: '*' })), opts)).toBe('result');
    expect(rejectByHeaders(quickHeaders(game({ Result: null })), opts)).toBe('result');
    expect(rejectByHeaders(quickHeaders(game({ BlackElo: '2299' })), opts)).toBe('elo');
    expect(rejectByHeaders(quickHeaders(game({ WhiteElo: '2100' })), opts)).toBe('elo');
    expect(rejectByHeaders(quickHeaders(game({ WhiteElo: null })), opts)).toBe('elo');
    expect(rejectByHeaders(quickHeaders(game({ BlackElo: '?' })), opts)).toBe('elo');
    expect(
      rejectByHeaders(quickHeaders(game({ WhiteElo: '2300', BlackElo: '2300' })), opts),
    ).toBeNull();
  });

  it('khoá bỏ trùng: tên hai bên + ngày + giải + vòng, không phân biệt hoa thường/khoảng trắng', () => {
    const a = dedupeKey(quickHeaders(game()));
    expect(dedupeKey(quickHeaders(game({ White: '  nguyen,   AN ' })))).toBe(a);
    expect(dedupeKey(quickHeaders(game({ Round: '4' })))).not.toBe(a);
    expect(dedupeKey(quickHeaders(game({ Event: 'Giải khác' })))).not.toBe(a);
    expect(dedupeKey(quickHeaders(game({ Date: '2026.09.02' })))).not.toBe(a);
    expect(dedupeKey(quickHeaders(game({ Black: 'Hoang, Em' })))).not.toBe(a);
  });

  it('số nước đầy đủ = ceil(nửa nước / 2)', () => {
    expect([movesOf(1), movesOf(2), movesOf(19), movesOf(20), movesOf(21)]).toEqual([
      1, 1, 10, 10, 11,
    ]);
  });
});

describe('stripComments / parseGame', () => {
  it('bỏ chú thích {…} và ghi chú dòng, giữ tag; PGN đã làm sạch đọc được', () => {
    const clean = stripComments(game());
    expect(clean).not.toContain('%eval');
    expect(clean).not.toContain('{');
    expect(clean).toContain('[White "Nguyen, An"]');
    const p = parseGame(game());
    expect(p).not.toBeNull();
    expect(p?.plies).toBe(24);
    expect(movesOf(p?.plies ?? 0)).toBe(12);
    expect(p?.pgn).not.toContain('%clk');
  });

  it('khoá thế cờ: gồm thế khởi đầu và tối đa 40 nửa nước đầu, khớp công thức positionKey', () => {
    const p = parseGame(game());
    expect(
      p?.keys.has(positionKey('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')),
    ).toBe(true);
    // sau 1.e4 (ô bắt tốt qua đường bị bỏ khỏi khoá)
    expect(p?.keys.has('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq')).toBe(true);
    expect((p?.keys.size ?? 0) <= 41).toBe(true);
  });

  it('ván lỗi, không có nước đi hoặc quá dài thì null', () => {
    expect(parseGame(game({}, '1. e4 e5 2. Qh9 *'))).toBeNull();
    expect(parseGame(game({}, '*'))).toBeNull();
    expect(parseGame('')).toBeNull();
    expect(parseGame(game({}, `1. e4 ${'{x}'.repeat(40000)} e5 *`))).not.toBeNull(); // chú thích bị bỏ nên không quá dài
  });
});

describe('consumeGames', () => {
  const short = game({ Round: '9', White: 'Ngan, Gon' }, '1. e4 e5 2. Nf3 Nc6 1-0');
  const texts = () => [
    game(), // đạt
    game(), // trùng ván đầu
    game({ Round: '4' }), // đạt (vòng khác)
    game({ Result: '*', Round: '5' }), // không kết quả
    game({ BlackElo: '2000', Round: '6' }), // Elo thấp
    short, // ngắn
    game({ Round: '7' }, '1. e4 e5 2. Qh9 *').replace('[Result "1-0"]', '[Result "1-0"]'), // lỗi
  ];
  async function* stream(arr) {
    for (const t of arr) yield t;
  }

  it('đếm đúng từng lý do loại và gọi onAccept cho ván đạt', async () => {
    const stats = newStats();
    const accepted = [];
    await consumeGames(stream(texts()), {
      minElo: 2300,
      minMoves: 10,
      seen: new Set(),
      stats,
      onAccept: (p) => accepted.push(p),
    });
    expect(stats.seen).toBe(7);
    expect(stats.accepted).toBe(2);
    expect(stats.rejected).toEqual({ result: 1, elo: 1, short: 1, invalid: 1, duplicate: 1 });
    expect(accepted).toHaveLength(2);
    expect(stats.minYear).toBe(2026);
    expect(stats.estimatedBytes).toBeGreaterThan(0);
  });

  it('bỏ trùng xuyên nhiều lượt (nhiều tháng) nhờ tập `seen` dùng chung', async () => {
    const seen = new Set();
    const a = newStats();
    await consumeGames(stream([game()]), { minElo: 2300, minMoves: 10, seen, stats: a });
    const b = newStats();
    await consumeGames(stream([game(), game({ Round: '8' })]), {
      minElo: 2300,
      minMoves: 10,
      seen,
      stats: b,
    });
    expect([a.accepted, b.accepted, b.rejected.duplicate]).toEqual([1, 1, 1]);
  });

  it('dừng sớm khi chạm trần (stop trả true)', async () => {
    const stats = newStats();
    await consumeGames(stream([game({ Round: '1' }), game({ Round: '2' }), game({ Round: '3' })]), {
      minElo: 2300,
      minMoves: 10,
      seen: new Set(),
      stats,
      stop: () => stats.accepted >= 1,
    });
    expect(stats.accepted).toBe(1);
  });
});

describe('createWriter: CSV', () => {
  it('ghi games.csv và positions.csv đúng cột, id nối tiếp, chuỗi có dấu phẩy/ngoặc kép được bao đúng chuẩn CSV', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mb-'));
    try {
      const p = parseGame(game({ Event: 'Giải Vô địch, vòng 1' }));
      if (!p) throw new Error('ván mẫu phải đọc được');
      const w = createWriter(dir, 100);
      const id = w.add(p, 'Nguồn thử (CC0)');
      w.add(p, 'Nguồn thử (CC0)');
      await w.end();
      expect(id).toBe(100);
      expect(w.nextId).toBe(102);
      const gamesCsv = readFileSync(join(dir, 'games.csv'), 'utf8');
      expect(
        gamesCsv.startsWith(
          'id,white,black,white_elo,black_elo,result,event,site,date,eco,ply_count,pgn,source\n',
        ),
      ).toBe(true);
      expect(gamesCsv).toContain('"Giải Vô địch, vòng 1"');
      // tag trong PGN có dấu ngoặc kép nên cả cột pgn được bao và nhân đôi dấu "
      expect(gamesCsv).toContain('[Event ""Giải Vô địch, vòng 1""]');
      expect(gamesCsv).toContain(',24,');
      expect(gamesCsv).toContain('Nguồn thử (CC0)');
      const positions = readFileSync(join(dir, 'positions.csv'), 'utf8').trim().split('\n');
      expect(positions[0]).toBe('position_key,game_id');
      expect(positions.slice(1).every((l) => /,(100|101)$/.test(l))).toBe(true);
      expect(positions.length - 1).toBe((p.keys.size ?? 0) * 2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('giải nén zstd nhiều frame có skippable frame (định dạng tệp Lichess)', () => {
  const skippable = (data) => {
    const head = Buffer.alloc(8);
    head.writeUInt32LE(0x184d2a50, 0);
    head.writeUInt32LE(data.length, 4);
    return Buffer.concat([head, Buffer.from(data)]);
  };
  const parts = [
    'Mảnh một của PGN\n'.repeat(500),
    'Mảnh hai\n'.repeat(700),
    'x'.repeat(100000),
    'cuối\n',
  ];
  const file = Buffer.concat(
    parts.flatMap((p) => [skippable('UTI\0'), zstdCompressSync(Buffer.from(p))]),
  );

  async function* chunked(buf, size) {
    for (let i = 0; i < buf.length; i += size) yield buf.subarray(i, i + size);
  }

  it('tách đúng từng frame và bỏ skippable frame, dù dữ liệu tới theo mảnh nhỏ', async () => {
    for (const size of [1000, 7, 65536]) {
      const frames = await collect(zstdFrames(chunked(file, size)));
      expect(frames, `size=${size}`).toHaveLength(4);
    }
  });

  it('giải nén ra đúng nội dung gốc', async () => {
    const out = Buffer.concat(await collect(decompressZstd(chunked(file, 4096))));
    expect(out.toString('utf8')).toBe(parts.join(''));
  });

  it('tệp cụt hoặc không phải zstd thì báo lỗi rõ ràng', async () => {
    await expect(
      collect(zstdFrames(chunked(file.subarray(0, file.length - 10), 4096))),
    ).rejects.toThrow(/cắt cụt/);
    await expect(collect(zstdFrames(chunked(Buffer.from('khong phai zstd'), 4)))).rejects.toThrow(
      /Không phải tệp zstd/,
    );
  });
});

describe('tham số dòng lệnh', () => {
  it('parseMonths: khoảng và danh sách, mới tới cũ, bỏ trùng', () => {
    expect(parseMonths('2026-09')).toEqual(['2026-09']);
    expect(parseMonths('2025-11..2026-02')).toEqual(['2026-02', '2026-01', '2025-12', '2025-11']);
    expect(parseMonths('2026-03,2026-01,2026-03')).toEqual(['2026-03', '2026-01']);
    expect(parseMonths('2025-11..2026-10')).toHaveLength(12);
  });

  it('parseMonths báo lỗi với tháng/khoảng sai', () => {
    for (const bad of ['2026-13', '2026-9', 'abc', '2026-05..2026-01', '2026-01..x']) {
      expect(() => parseMonths(bad), bad).toThrow();
    }
  });

  it('parseArgs: mặc định đúng theo kế hoạch, ghi đè được, thiếu --months thì lỗi', () => {
    const a = parseArgs(['--months', '2026-09', '--dry-run']);
    expect(a).toMatchObject({
      minElo: 2300,
      minMoves: 10,
      maxMb: 300,
      startId: 1,
      dryRun: true,
      out: 'out/masterbase',
    });
    const b = parseArgs([
      '--months',
      '2026-09',
      '--min-elo',
      '2500',
      '--max-mb',
      '50',
      '--start-id',
      '99',
    ]);
    expect(b).toMatchObject({ minElo: 2500, maxMb: 50, startId: 99, dryRun: false });
    expect(() => parseArgs([])).toThrow(/--months/);
    expect(() => parseArgs(['--months', '2026-09', '--max-mb', '0'])).toThrow();
    expect(parseArgs(['--file', 'x.pgn']).months).toEqual(['file']);
  });
});
