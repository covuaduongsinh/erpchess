// So bản WASM với bản native trên cùng bộ lệnh: perft (sinh nước đi) và điểm NNUE tĩnh
// của nhiều thế cờ (kiểm phần SIMD đã dịch sang WASM SIMD128). Hai bên phải giống hệt từng dòng.
//   node packages/engine/wasm/compare.mjs <đường-dẫn-native> [sse41|sse2]
import { spawn } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

const [nativeBin, variant = 'sse41'] = process.argv.slice(2);
if (!nativeBin) {
  console.error('Cách dùng: node compare.mjs <native-binary> [variant]');
  process.exit(2);
}

const FENS = [
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
  '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
  'r2q1rk1/pP1p2pp/Q4n2/bbp1p3/Np6/1B3NBn/pPPP1PPP/R3K2R b KQ - 0 1',
  'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',
  '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1',
  '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1',
  'r1bq1rk1/pp2nppp/2n1p3/3pP3/2pP4/2P2N2/P1B2PPP/R1BQ1RK1 b - - 3 11',
];
const COMMANDS = [
  'uci',
  'perft 5',
  ...FENS.flatMap((fen) => [`position fen ${fen}`, 'eval']),
  'isready',
];
const RELEVANT = /^(perft \d+ =|NNUE score:)/;

function runNative() {
  return new Promise((resolve) => {
    const child = spawn(nativeBin, [], { stdio: ['pipe', 'pipe', 'ignore'] });
    const out = [];
    createInterface({ input: child.stdout }).on('line', (line) => {
      if (RELEVANT.test(line)) out.push(line.trim());
      if (line.startsWith('readyok')) {
        child.stdin.write('quit\n');
        resolve(out);
      }
    });
    for (const c of COMMANDS) child.stdin.write(`${c}\n`);
  });
}

async function runWasm() {
  const here = import.meta.dirname;
  const networkDir = join(here, '../../../vendor/arasan/network');
  const network = readdirSync(networkDir).find((f) => f.endsWith('.nnue'));
  const { default: createArasan } = await import(`./dist/arasan-${variant}.mjs`);
  const out = [];
  let done;
  const finished = new Promise((r) => {
    done = r;
  });
  const module = await createArasan({
    print: (line) => {
      if (RELEVANT.test(line)) out.push(line.trim());
      if (line.startsWith('readyok')) done(out);
    },
    printErr: () => {},
  });
  module.FS.writeFile(`/${network}`, readFileSync(join(networkDir, network)));
  module.callMain([]);
  for (const c of COMMANDS) module.ccall('erp_send', null, ['string'], [c]);
  const result = await finished;
  module.ccall('erp_send', null, ['string'], ['quit']);
  return result;
}

const [native, wasm] = [await runNative(), await runWasm()];
let mismatches = 0;
const n = Math.max(native.length, wasm.length);
for (let i = 0; i < n; i++) {
  const same = native[i] === wasm[i];
  if (!same) mismatches++;
  console.log(`${same ? 'ok    ' : 'KHÁC  '} native: ${native[i]} | wasm: ${wasm[i]}`);
}
console.log(`${n} dòng, ${mismatches} khác biệt`);
process.exit(mismatches || n === 0 ? 1 : 0);
