// Sinh src/pieces.generated.ts từ bộ quân SVG của board-web (một nguồn duy nhất cho cả 2 nền tảng).
// React Native không nạp file .svg như web, nên nhúng nội dung dạng chuỗi cho SvgXml.
//   node packages/board-native/scripts/gen-pieces.mjs
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const here = import.meta.dirname;
const dir = resolve(here, '../../board-web/src/pieces/celtic');
const out = resolve(here, '../src/pieces.generated.ts');

const entries = readdirSync(dir)
  .filter((f) => f.endsWith('.svg'))
  .sort()
  .map((f) => {
    const svg = readFileSync(join(dir, f), 'utf8').replace(/\s+/g, ' ').trim();
    return `  ${f.replace('.svg', '')}: ${JSON.stringify(svg)},`;
  });

writeFileSync(
  out,
  `// Tự sinh bởi scripts/gen-pieces.mjs — không sửa tay.
// Bộ quân "celtic" của Maurizio Monge, giấy phép MIT (xem board-web/src/pieces/celtic/LICENSE).
import type { PieceCode } from '@erpchess/board-web/geometry';

export const CELTIC_XML: Record<PieceCode, string> = {
${entries.join('\n')}
};
`,
);
console.log(`Đã sinh ${entries.length} quân → ${out}`);
