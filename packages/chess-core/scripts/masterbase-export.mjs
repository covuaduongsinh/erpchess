// Chuyển một tệp PGN (bộ ván có giấy phép mở) thành hai tệp CSV để nạp Masterbase (Giai đoạn 23b):
//   games.csv     → bảng masterbase_games
//   positions.csv → bảng masterbase_positions (thế cờ ở MASTERBASE_INDEX_PLIES nửa nước đầu)
//
//   node packages/chess-core/scripts/masterbase-export.mjs <in.pgn> <thư-mục-ra> \
//     --source "Tên bộ ván, giấy phép (vd. CC0)" [--start-id 1]
//
// Nạp bằng psql (chuỗi kết nối service role, KHÔNG dùng khoá publishable):
//   \copy public.masterbase_games (id,white,black,white_elo,black_elo,result,event,site,date,eco,ply_count,pgn,source) from 'games.csv' csv header
//   \copy public.masterbase_positions (position_key,game_id) from 'positions.csv' csv header
//
// Ván lỗi (không đọc được) bị bỏ qua và đếm lại ở cuối; id bắt đầu từ --start-id để nạp nhiều đợt.
import { createReadStream, createWriteStream, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import { Chess } from 'chess.js';

// Phải khớp với MASTERBASE_INDEX_PLIES và positionKey trong src/masterbase.ts
const INDEX_PLIES = 40;
const positionKey = (fen) => fen.trim().split(/\s+/).slice(0, 3).join(' ');

const args = process.argv.slice(2);
const [input, outDir] = args;
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const source = flag('--source');
let nextId = Number(flag('--start-id') ?? 1);
if (!input || !outDir || !source || source.length < 3 || !Number.isInteger(nextId)) {
  console.error(
    'Cách dùng: masterbase-export.mjs <in.pgn> <out-dir> --source "<nguồn + giấy phép>" [--start-id N]',
  );
  process.exit(2);
}

mkdirSync(outDir, { recursive: true });
const games = createWriteStream(join(outDir, 'games.csv'));
const positions = createWriteStream(join(outDir, 'positions.csv'));
games.write('id,white,black,white_elo,black_elo,result,event,site,date,eco,ply_count,pgn,source\n');
positions.write('position_key,game_id\n');

const csv = (v) => {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const tag = (v, max) => {
  const s = (v ?? '').trim();
  return s === '?' ? '' : s.slice(0, max);
};
const elo = (v) => {
  const n = Number(v);
  return v && Number.isInteger(n) && n > 0 && n < 4000 ? n : null;
};
const RESULTS = new Set(['1-0', '0-1', '1/2-1/2', '*']);

let ok = 0;
let bad = 0;

function flush(text) {
  const pgn = text.trim();
  if (!pgn) return;
  const chess = new Chess();
  try {
    chess.loadPgn(pgn);
  } catch {
    bad++;
    return;
  }
  const h = chess.getHeaders();
  const history = chess.history({ verbose: true });
  if (history.length === 0 || pgn.length > 100000) {
    bad++;
    return;
  }
  const id = nextId++;
  const keys = new Set([positionKey(history[0].before)]);
  for (const m of history.slice(0, INDEX_PLIES)) keys.add(positionKey(m.after));
  games.write(
    `${[
      id,
      tag(h.White, 120),
      tag(h.Black, 120),
      elo(h.WhiteElo),
      elo(h.BlackElo),
      RESULTS.has(h.Result) ? h.Result : '*',
      tag(h.Event, 120),
      tag(h.Site, 120),
      tag(h.Date, 10),
      tag(h.ECO, 3),
      history.length,
      pgn,
      source,
    ]
      .map(csv)
      .join(',')}\n`,
  );
  for (const k of keys) positions.write(`${csv(k)},${id}\n`);
  ok++;
  if (ok % 10000 === 0) console.log(`… ${ok} ván`);
}

// Ván mới bắt đầu ở dòng tag "[" đầu tiên sau phần nước đi của ván trước
const rl = createInterface({ input: createReadStream(input, 'utf8'), crlfDelay: Infinity });
let current = [];
let inMoves = false;
for await (const raw of rl) {
  const line = raw.replace(/^﻿/, '');
  const t = line.trim();
  if (t.startsWith('[') && inMoves) {
    flush(current.join('\n'));
    current = [];
    inMoves = false;
  }
  if (t && !t.startsWith('[') && !t.startsWith('%')) inMoves = true;
  current.push(line);
}
flush(current.join('\n'));
await Promise.all([new Promise((r) => games.end(r)), new Promise((r) => positions.end(r))]);
console.log(`Xong: ${ok} ván, bỏ qua ${bad} ván lỗi. id tiếp theo: ${nextId}`);
