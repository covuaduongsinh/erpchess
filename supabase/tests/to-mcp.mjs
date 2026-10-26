// Đổi file pgTAP thành SQL chạy được qua công cụ execute_sql (Supabase MCP), vốn chỉ trả kết quả
// của câu lệnh cuối: ghi từng dòng TAP vào bảng tạm rồi raise exception để rollback toàn bộ.
//   node supabase/tests/to-mcp.mjs supabase/tests/02_assignments_rls.sql > out.sql
import { readFileSync } from 'node:fs';

const src = readFileSync(process.argv[2], 'utf8');
const ASSERT = /^select (lives_ok|throws_ok|results_eq|is_empty|isnt_empty|ok|is|isnt|matches)\(/;
const body = src
  .split('\n')
  .filter(
    (l) => !/^(begin|rollback);$/.test(l.trim()) && !/^select \* from finish\(\);/.test(l.trim()),
  )
  .map((l) => (ASSERT.test(l) ? l.replace(/^select /, 'insert into tap_out(line) select ') : l))
  .join('\n');

const header = `create temp table tap_out(n serial, line text);
grant all on tap_out to anon, authenticated, service_role;
grant usage on sequence tap_out_n_seq to anon, authenticated, service_role;`;
const footer = `do $$
declare v text;
begin
  select format('TAP %s/%s ok. Failed: %s',
    count(*) filter (where line like 'ok%'), count(*),
    coalesce(string_agg(line, ' || ' order by n) filter (where line not like 'ok%'), 'none'))
  into v from tap_out;
  raise exception '%', v;
end $$;`;
// Bảng tạm phải tạo sau khi đã nạp pgtap (nằm trong body) nhưng trước assertion đầu tiên
const marker = body.indexOf('select plan(');
process.stdout.write(`${body.slice(0, marker)}${header}\n${body.slice(marker)}\n${footer}\n`);
