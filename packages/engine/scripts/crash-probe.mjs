// Chạy engine trên từng thế cờ (mỗi thế một tiến trình riêng) để tìm thế làm engine crash.
//   node scripts/crash-probe.mjs <engine> <depth> <fen> [<fen>...]
import { spawnSync } from 'node:child_process';

const [bin, depth, ...fens] = process.argv.slice(2);
for (const fen of fens) {
  const input = `uci\nsetoption name OwnBook value false\nisready\nposition fen ${fen}\ngo depth ${depth}\n`;
  const r = spawnSync(bin, [], { input, encoding: 'utf8', timeout: 60_000 });
  const lines = (r.stdout ?? '').split(/\r?\n/);
  const best = lines.find((l) => l.startsWith('bestmove'));
  const lastInfo = lines.filter((l) => /^info multipv 1 depth \d+ /.test(l)).at(-1) ?? '';
  const d = /depth (\d+)/.exec(lastInfo)?.[1];
  const score = /score (cp|mate) (-?\d+)/.exec(lastInfo)?.slice(1).join(' ');
  const status = best ? `OK  ${best}` : `CRASH (status=${r.status} signal=${r.signal ?? '-'})`;
  console.log(`${status.padEnd(40)} depth=${d ?? '?'} score=${score ?? '?'}  ${fen}`);
}
