// Sinh bộ puzzle khởi đầu: lấy các thế cờ ứng viên, cho Arasan native tìm lời giải và chỉ giữ
// những thế có lời giải gần như duy nhất (chiếu hết bắt buộc, hoặc nước tốt nhất hơn nước thứ hai
// ít nhất MIN_GAP centipawn). Kết quả ghi ra JSON để seed vào bảng puzzles.
//   node packages/chess-core/scripts/gen-puzzles.mjs <arasan-binary> <out.json>
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { Chess, validateFen } from 'chess.js';

const [bin, outPath] = process.argv.slice(2);
const candidates = JSON.parse(
  readFileSync(new URL('./puzzle-candidates.json', import.meta.url), 'utf8'),
);
const DEPTH = 16;
const MIN_GAP = 200;

const engine = spawn(bin, [], { stdio: ['pipe', 'pipe', 'ignore'] });
const rl = createInterface({ input: engine.stdout });
let waiter = null;
const buffer = [];
rl.on('line', (line) => {
  buffer.push(line);
  if (waiter?.re.test(line)) {
    const w = waiter;
    waiter = null;
    w.resolve([...buffer]);
    buffer.length = 0;
  }
});
const send = (c) => engine.stdin.write(`${c}\n`);
const until = (re) => new Promise((resolve) => (waiter = { re, resolve }));

send('uci');
await until(/^uciok/);
send('setoption name OwnBook value false');
send('setoption name MultiPV value 2');
send('isready');
await until(/^readyok/);

function parseLines(lines) {
  const best = new Map();
  for (const l of lines) {
    const m = /^info multipv (\d+) depth (\d+) .*score (cp|mate) (-?\d+).* pv (.+)$/.exec(l);
    if (m) best.set(Number(m[1]), { kind: m[3], value: Number(m[4]), pv: m[5].split(' ') });
  }
  return best;
}

const accepted = [];
const rejected = [];
for (const c of candidates) {
  const check = validateFen(c.fen);
  if (!check.ok) {
    rejected.push({ title: c.title, reason: `FEN sai: ${check.error}` });
    continue;
  }
  // Giống isValidFen của chess-core: bên không đi không được đang bị chiếu (engine sẽ crash)
  const probe = new Chess(c.fen);
  const them = probe.turn() === 'w' ? 'b' : 'w';
  const [theirKing] = probe.findPiece({ type: 'k', color: them });
  if (!theirKing || probe.isAttacked(theirKing, probe.turn())) {
    rejected.push({ title: c.title, reason: 'thế bất hợp lệ: bên không đi đang bị chiếu' });
    continue;
  }
  console.log(`… ${c.title}`);
  const chess = new Chess(c.fen);
  send(`position fen ${c.fen}`);
  send(`go depth ${DEPTH}`);
  const lines = parseLines(await until(/^bestmove/));
  const first = lines.get(1);
  const second = lines.get(2);
  if (!first) {
    rejected.push({ title: c.title, reason: 'không có phương án' });
    continue;
  }
  let moves;
  let reason = null;
  if (first.kind === 'mate' && first.value > 0) {
    // Lời giải: toàn bộ PV tới nước chiếu hết (2*N-1 nửa nước)
    moves = first.pv.slice(0, first.value * 2 - 1);
    if (second?.kind === 'mate' && second.value > 0 && second.value <= first.value) {
      // Có cách chiếu hết khác nhanh tương đương ngay nước đầu: chỉ nhận nếu là chiếu hết 1 nước
      // (gradeMove chấp nhận mọi nước chiếu hết ở nước cuối)
      if (first.value > 1) reason = `nhiều lời giải chiếu hết ${first.value} nước`;
    }
  } else {
    const gap = first.value - (second?.kind === 'cp' ? second.value : -100000);
    if (first.kind !== 'cp' || first.value < 150 || gap < MIN_GAP) {
      reason = `không đủ rõ: best ${first.kind} ${first.value}, second ${second?.kind} ${second?.value}`;
    }
    moves = first.pv.slice(0, c.plies ?? 3);
  }
  // Kiểm lại bằng chess.js: mọi nước phải hợp lệ; puzzle kết thúc bằng nước của người giải
  if (!reason) {
    for (const uci of moves) {
      try {
        chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
      } catch {
        reason = `nước không hợp lệ ${uci}`;
        break;
      }
    }
    if (moves.length % 2 === 0) reason = 'lời giải phải kết thúc bằng nước của người giải';
  }
  if (reason) {
    rejected.push({ title: c.title, reason, pv: first.pv.slice(0, 5).join(' ') });
    continue;
  }
  accepted.push({
    title: c.title,
    fen: c.fen,
    moves,
    // Chủ đề chiếu hết lấy theo kết quả engine, không tin nhãn soạn tay
    themes: [
      ...c.themes.filter((t) => !/^mateIn\d$/.test(t)),
      ...(first.kind === 'mate' ? [`mateIn${first.value}`] : []),
    ],
    rating: c.rating,
    eval: first.kind === 'mate' ? `#${first.value}` : `${first.value}cp`,
  });
}
send('quit');
writeFileSync(outPath, `${JSON.stringify(accepted, null, 2)}\n`);
console.log(`Nhận ${accepted.length}, loại ${rejected.length}`);
for (const r of rejected)
  console.log(`  LOẠI ${r.title}: ${r.reason}${r.pv ? ` (pv ${r.pv})` : ''}`);
