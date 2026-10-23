// Chép bản Arasan WASM (packages/engine/wasm/dist) và file NNUE vào public/engine/
// để Vite phục vụ cùng origin (bắt buộc khi trang bật COEP require-corp).
//   node scripts/copy-engine-assets.mjs            → lỗi nếu chưa build WASM
//   node scripts/copy-engine-assets.mjs --optional → chỉ cảnh báo (dùng cho `pnpm dev`)
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const optional = process.argv.includes('--optional');
const root = resolve(import.meta.dirname, '../../..');
const dist = join(root, 'packages/engine/wasm/dist');
const networkDir = join(root, 'vendor/arasan/network');
const out = resolve(import.meta.dirname, '../public/engine');

const wasmFiles = existsSync(dist)
  ? readdirSync(dist).filter((f) => /^arasan-(sse41|sse2)\.(mjs|wasm)$/.test(f))
  : [];
const network = existsSync(networkDir)
  ? readdirSync(networkDir).find((f) => f.endsWith('.nnue'))
  : undefined;

if (wasmFiles.length === 0 || !network) {
  const msg =
    'Chưa có bản WASM của Arasan. Build bằng: bash packages/engine/wasm/build.sh sse41 (WSL/Linux có emsdk)';
  if (optional) {
    console.warn(`[engine] ${msg} — trang /engine sẽ báo engine chưa sẵn sàng.`);
    process.exit(0);
  }
  console.error(msg);
  process.exit(1);
}

mkdirSync(out, { recursive: true });
for (const f of wasmFiles) copyFileSync(join(dist, f), join(out, f));
copyFileSync(join(networkDir, network), join(out, network));
console.log(`[engine] đã chép ${wasmFiles.join(', ')}, ${network} → public/engine/`);
