// Chạy bản WASM của Arasan trong Node để kiểm tra (không cần trình duyệt).
//   node packages/engine/wasm/run-node.mjs <scalar|simd> bench
//   node packages/engine/wasm/run-node.mjs <scalar|simd> uci "isready" "position startpos" "go depth 10"
// Chế độ uci: gửi từng lệnh, chờ uciok/readyok/bestmove giống uci-probe.mjs, in output.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const [variant = 'scalar', mode = 'bench', ...commands] = process.argv.slice(2);
const here = import.meta.dirname;
const networkDir = join(here, '../../../vendor/arasan/network');
const network = readdirSync(networkDir).find((f) => f.endsWith('.nnue'));

const { default: createArasan } = await import(`./dist/arasan-${variant}.mjs`);

const listeners = [];
const t0 = Date.now();
const module = await createArasan({
  print: (line) => {
    if (mode === 'bench' || !line.startsWith('info')) console.log(line);
    for (const l of [...listeners]) l(line);
  },
  printErr: (line) => console.error(line),
});
// Arasan tìm file NNUE theo tên mặc định ở thư mục gốc FS
module.FS.writeFile(`/${network}`, readFileSync(join(networkDir, network)));
console.error(`# nạp module + NNUE: ${Date.now() - t0} ms`);

if (mode === 'bench') {
  module.callMain(['bench']);
} else {
  module.callMain([]);
  const waitFor = (re) =>
    new Promise((resolve) => {
      const l = (line) => {
        if (re.test(line)) {
          listeners.splice(listeners.indexOf(l), 1);
          resolve(line);
        }
      };
      listeners.push(l);
    });
  for (const cmd of ['uci', ...commands]) {
    const re = /^uci$/.test(cmd)
      ? /^uciok/
      : /^isready/.test(cmd)
        ? /^readyok/
        : /^go\b/.test(cmd)
          ? /^bestmove/
          : null;
    const done = re ? waitFor(re) : null;
    const started = Date.now();
    send(cmd);
    if (done) {
      await done;
      if (cmd.startsWith('go')) console.error(`# ${cmd}: ${Date.now() - started} ms`);
    }
  }
  send('quit');
}

function send(cmd) {
  module.ccall('erp_send', null, ['string'], [cmd]);
}
