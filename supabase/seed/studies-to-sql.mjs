// Sinh SQL seed thư viện học liệu chung (academy_id null, công khai) từ studies.json.
// Nội dung tự soạn; được kiểm hợp lệ bởi packages/api/src/seed-studies.test.ts.
// id tất định theo slug nên chạy lại chỉ cập nhật, không tạo trùng.
//   node supabase/seed/studies-to-sql.mjs > supabase/seed/studies.sql
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const studies = JSON.parse(readFileSync(new URL('./studies.json', import.meta.url), 'utf8'));
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
const uuid = (s) => {
  const h = createHash('sha256').update(`study:${s}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

const studyRows = studies.map(
  (s) => `  (${q(uuid(s.slug))}, null, ${q(s.title)}, ${q(s.description)}, 'public')`,
);
const activityRows = studies.flatMap((s) =>
  s.activities.map(
    (a, i) =>
      `  (${q(uuid(`${s.slug}#${i}`))}, ${q(uuid(s.slug))}, ${i}, ${q(a.kind)}, ${q(a.title ?? '')}, ${q(JSON.stringify(a.payload))}::jsonb, ${a.points ?? 10})`,
  ),
);
const ids = studies.map((s) => q(uuid(s.slug))).join(', ');

process.stdout.write(`-- Tự sinh bởi supabase/seed/studies-to-sql.mjs từ studies.json — không sửa tay.
insert into public.studies (id, academy_id, title, description, visibility) values
${studyRows.join(',\n')}
on conflict (id) do update
  set title = excluded.title, description = excluded.description, visibility = excluded.visibility;

-- Thay toàn bộ hoạt động của các study này (thứ tự có thể đổi giữa các lần sinh)
delete from public.study_activities where study_id in (${ids});
insert into public.study_activities (id, study_id, position, kind, title, payload, points) values
${activityRows.join(',\n')};
`);
