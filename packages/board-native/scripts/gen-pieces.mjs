// Sinh src/pieces.generated.ts từ các bộ quân SVG của board-web (một nguồn duy nhất cho cả 2 nền tảng).
// React Native không nạp file .svg như web, nên nhúng nội dung dạng chuỗi cho SvgXml.
//   node packages/board-native/scripts/gen-pieces.mjs
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const here = import.meta.dirname;
const piecesDir = resolve(here, '../../board-web/src/pieces');
const out = resolve(here, '../src/pieces.generated.ts');
const SETS = ['celtic', 'spatial'];

// Khi export web, các SvgXml nằm chung một DOM: id gradient trùng nhau giữa quân trắng/đen sẽ
// lấy nhầm định nghĩa của quân khác. Gắn tiền tố riêng cho từng quân để id là duy nhất.
function scopeIds(svg, prefix) {
  const ids = [...svg.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  let result = svg;
  for (const id of ids) {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result
      .replace(new RegExp(`\\bid="${escaped}"`, 'g'), `id="${prefix}-${id}"`)
      .replace(new RegExp(`#${escaped}\\b`, 'g'), `#${prefix}-${id}`);
  }
  return result;
}

let total = 0;
const blocks = SETS.map((set) => {
  const dir = join(piecesDir, set);
  const entries = readdirSync(dir)
    .filter((f) => f.endsWith('.svg'))
    .sort()
    .map((f) => {
      const code = f.replace('.svg', '');
      const svg = scopeIds(
        readFileSync(join(dir, f), 'utf8').replace(/\s+/g, ' ').trim(),
        `${set}-${code}`,
      );
      return `    ${code}: ${JSON.stringify(svg)},`;
    });
  total += entries.length;
  return `  ${set}: {\n${entries.join('\n')}\n  },`;
});

writeFileSync(
  out,
  `// Tự sinh bởi scripts/gen-pieces.mjs — không sửa tay.
// Bộ quân "celtic" và "spatial" của Maurizio Monge, giấy phép MIT (xem board-web/src/pieces/<bộ>/LICENSE).
import type { PieceCode } from '@erpchess/board-web/geometry';

export type NativePieceSet = ${SETS.map((s) => `'${s}'`).join(' | ')};

export const PIECE_SETS_XML: Record<NativePieceSet, Record<PieceCode, string>> = {
${blocks.join('\n')}
};

export const CELTIC_XML = PIECE_SETS_XML.celtic;
`,
);
console.log(`Đã sinh ${total} quân → ${out}`);
