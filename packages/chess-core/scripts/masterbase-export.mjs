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
// Logic đọc ván và ghi CSV nằm ở masterbase-lib.mjs (dùng chung với scripts/masterbase-broadcast.mjs).
import { createReadStream } from 'node:fs';
import { createWriter, linesOf, parseGame, splitGames } from './masterbase-lib.mjs';

const args = process.argv.slice(2);
const [input, outDir] = args;
const flag = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const source = flag('--source');
const startId = Number(flag('--start-id') ?? 1);
if (!input || !outDir || !source || source.length < 3 || !Number.isInteger(startId)) {
  console.error(
    'Cách dùng: masterbase-export.mjs <in.pgn> <out-dir> --source "<nguồn + giấy phép>" [--start-id N]',
  );
  process.exit(2);
}

const writer = createWriter(outDir, startId);
let ok = 0;
let bad = 0;
for await (const text of splitGames(linesOf(createReadStream(input, 'utf8')))) {
  if (!text.trim()) continue;
  const parsed = parseGame(text);
  if (!parsed) {
    bad++;
    continue;
  }
  writer.add(parsed, source);
  ok++;
  if (ok % 10000 === 0) console.log(`… ${ok} ván`);
}
await writer.end();
console.log(`Xong: ${ok} ván, bỏ qua ${bad} ván lỗi. id tiếp theo: ${writer.nextId}`);
