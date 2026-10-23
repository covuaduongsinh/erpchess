// Chạy một phiên UCI với engine native và ghi log (dùng làm fixture cho test parser).
// node scripts/uci-probe.mjs <đường-dẫn-engine> <file-log> [lệnh...]
// Mỗi lệnh "go …" được chờ tới khi có "bestmove"; "isready" chờ "readyok"; "uci" chờ "uciok".
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

const [enginePath, logPath, ...commands] = process.argv.slice(2);
if (!enginePath || !logPath || commands.length === 0) {
  console.error('Cách dùng: node scripts/uci-probe.mjs <engine> <log> <lệnh>...');
  process.exit(2);
}

const engine = spawn(enginePath, [], { stdio: ['pipe', 'pipe', 'inherit'] });
const lines = [];
const waiters = [];
const rl = createInterface({ input: engine.stdout });
rl.on('line', (line) => {
  lines.push(`< ${line}`);
  for (const w of [...waiters]) {
    if (w.match(line)) {
      waiters.splice(waiters.indexOf(w), 1);
      w.resolve(line);
    }
  }
});

function waitFor(pattern, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Hết giờ chờ ${pattern}`)), ms);
    waiters.push({
      match: (l) => pattern.test(l),
      resolve: (l) => {
        clearTimeout(timer);
        resolve(l);
      },
    });
  });
}

const expect = [
  [/^uci$/, /^uciok/],
  [/^isready$/, /^readyok/],
  [/^go\b/, /^bestmove/],
];

for (const cmd of commands) {
  lines.push(`> ${cmd}`);
  const rule = expect.find(([c]) => c.test(cmd));
  const done = rule ? waitFor(rule[1], 120_000) : null;
  engine.stdin.write(`${cmd}\n`);
  const started = Date.now();
  if (done) {
    const last = await done;
    if (cmd.startsWith('go')) lines.push(`# ${Date.now() - started} ms`);
    console.log(`${cmd} → ${last}`);
  }
}

engine.stdin.write('quit\n');
await new Promise((r) => engine.on('exit', r));
writeFileSync(logPath, `${lines.join('\n')}\n`);
console.log(`Đã ghi ${lines.length} dòng vào ${logPath}`);
