// Sinh SQL seed thư viện puzzle chung (academy_id null) từ puzzles.json đã kiểm bằng Arasan.
// id tất định theo FEN + lời giải nên chạy lại không tạo trùng.
//   node supabase/seed/to-sql.mjs > supabase/seed/puzzles.sql
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const puzzles = JSON.parse(readFileSync(new URL('./puzzles.json', import.meta.url), 'utf8'));
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const arr = (xs) => `array[${xs.map(q).join(', ')}]::text[]`;
const uuid = (s) => {
  const h = createHash('sha256').update(s).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

const rows = puzzles.map(
  (p) =>
    `  (${q(uuid(`${p.fen}|${p.moves.join(' ')}`))}, null, ${q(p.title)}, ${q(p.fen)}, ${arr(p.moves)}, ${p.rating}, ${arr(p.themes)})`,
);
process.stdout.write(`-- Tự sinh bởi supabase/seed/to-sql.mjs từ puzzles.json — không sửa tay.
insert into public.puzzles (id, academy_id, title, fen, moves, rating, themes) values
${rows.join(',\n')}
on conflict (id) do update
  set title = excluded.title, fen = excluded.fen, moves = excluded.moves,
      rating = excluded.rating, themes = excluded.themes;
`);
