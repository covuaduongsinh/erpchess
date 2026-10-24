// Chép mã dùng chung từ packages/chess-core sang supabase/functions/_shared/chess-core để Edge
// Function (Deno) chấm bài bằng đúng logic của client. Đổi import cho Deno: thêm đuôi .ts,
// 'chess.js' → 'npm:chess.js@<phiên bản>'.
//   node supabase/functions/sync-shared.mjs          → ghi file
//   node supabase/functions/sync-shared.mjs --check  → báo lỗi nếu bản chép đã cũ (dùng trong CI)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const here = import.meta.dirname;
const srcDir = resolve(here, '../../packages/chess-core/src');
// Mỗi function giữ bản chép riêng trong thư mục của nó (deploy chỉ gửi file trong thư mục function)
const TARGETS = [
  { fn: 'submit-attempt', files: ['rules.ts', 'puzzle.ts'] },
  { fn: 'submit-activity', files: ['rules.ts', 'puzzle.ts', 'capture.ts'] },
  { fn: 'quiz-answer', files: ['rules.ts', 'puzzle.ts', 'capture.ts'] },
  { fn: 'game-move', files: ['rules.ts', 'game.ts', 'clock.ts', 'glicko2.ts'] },
];
const pkg = JSON.parse(
  readFileSync(resolve(here, '../../packages/chess-core/package.json'), 'utf8'),
);
const chessJs = pkg.dependencies['chess.js'];

const check = process.argv.includes('--check');
let stale = 0;
for (const { fn, files } of TARGETS) {
  const outDir = join(here, fn, '_shared/chess-core');
  mkdirSync(outDir, { recursive: true });
  for (const file of files) {
    const content =
      `// Tự sinh bởi supabase/functions/sync-shared.mjs từ packages/chess-core/src/${file} — không sửa tay.\n` +
      readFileSync(join(srcDir, file), 'utf8')
        .replace(/from '\.\/([\w-]+)'/g, "from './$1.ts'")
        .replace(/from 'chess\.js'/g, `from 'npm:chess.js@${chessJs}'`);
    const target = join(outDir, file);
    const current = existsSync(target) ? readFileSync(target, 'utf8') : '';
    if (current === content) continue;
    if (check) {
      console.error(`Bản chép đã cũ: ${target} — chạy node supabase/functions/sync-shared.mjs`);
      stale++;
    } else {
      writeFileSync(target, content);
      console.log(`Đã cập nhật ${target}`);
    }
  }
}
process.exit(stale ? 1 : 0);
