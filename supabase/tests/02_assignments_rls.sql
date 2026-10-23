-- Kiểm thử RLS Giai đoạn 4 (puzzle, bài tập, lần làm bài, báo cáo). Chạy trong transaction, ROLLBACK cuối.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(19);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner.a@test.local', '{"display_name":"Owner A"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'coach.a@test.local', '{"display_name":"Coach A"}'),
  ('00000000-0000-0000-0000-0000000000a3', 'hv1@students.erpchess.local', '{"display_name":"HV 1","username":"hv1"}'),
  ('00000000-0000-0000-0000-0000000000a4', 'hv2@students.erpchess.local', '{"display_name":"HV 2","username":"hv2"}'),
  ('00000000-0000-0000-0000-0000000000a6', 'hv3@students.erpchess.local', '{"display_name":"HV 3","username":"hv3"}'),
  ('00000000-0000-0000-0000-0000000000a5', 'parent.a@test.local', '{"display_name":"PH 1"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'owner.b@test.local', '{"display_name":"Owner B"}');

-- Dữ liệu nền (quyền postgres): 2 học viện, lớp, học viên, phụ huynh, puzzle chung và puzzle riêng của B
insert into academies (id, name, slug) values
  ('10000000-0000-0000-0000-00000000000a', 'Học viện A', 'hv-a'),
  ('10000000-0000-0000-0000-00000000000b', 'Học viện B', 'hv-b');
insert into memberships (academy_id, user_id, role) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'owner'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a2', 'coach'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', 'student'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a4', 'student'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a6', 'student'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a5', 'parent'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'owner');
insert into groups (id, academy_id, name) values
  ('20000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a', 'G1'),
  ('20000000-0000-0000-0000-0000000000a2', '10000000-0000-0000-0000-00000000000a', 'G2'),
  ('20000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-00000000000b', 'GB');
insert into group_members (group_id, student_id) values
  ('20000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a3'),
  ('20000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a4');
insert into parent_links (academy_id, parent_id, student_id) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000a3');
insert into puzzles (id, academy_id, title, fen, moves) values
  ('30000000-0000-0000-0000-000000000001', null, 'Chung', '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', '{d1d8}'),
  ('30000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-00000000000b', 'Của B', '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', '{d1d8}');

create function pg_temp.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;
create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- ── Coach soạn bài ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select lives_ok($$
  insert into assignments (id, academy_id, title)
  values ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', 'Bài 1')
$$, 'coach tạo bài tập');
select lives_ok($$
  insert into assignment_targets (assignment_id, group_id)
  values ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-0000000000a1')
$$, 'coach giao cho lớp G1');
select lives_ok($$
  insert into assignment_targets (assignment_id, student_id)
  values ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a6')
$$, 'coach giao trực tiếp cho HV3');
select throws_ok($$
  insert into assignment_targets (assignment_id, group_id)
  values ('40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-0000000000b1')
$$, '42501', null, 'không giao được cho lớp của học viện khác');
select lives_ok($$
  insert into assignment_items (id, assignment_id, position, puzzle_id)
  values ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 0, '30000000-0000-0000-0000-000000000001')
$$, 'coach thêm puzzle thư viện chung');
select throws_ok($$
  insert into assignment_items (assignment_id, position, puzzle_id)
  values ('40000000-0000-0000-0000-000000000001', 1, '30000000-0000-0000-0000-0000000000b1')
$$, '42501', null, 'không dùng được puzzle riêng của học viện khác');

-- ── Học viên ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a3');
select results_eq($$ select title from assignments $$, $$ values ('Bài 1') $$, 'HV1 thấy bài giao qua lớp');
select ok((select count(*) from puzzles where academy_id is null) >= 1, 'HV1 đọc được thư viện chung');
select throws_ok($$
  insert into puzzles (academy_id, title, fen, moves)
  values ('10000000-0000-0000-0000-00000000000a', 'x', '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', '{d1d8}')
$$, '42501', null, 'học viên không tạo được puzzle');
select throws_ok($$
  insert into attempts (item_id, student_id, solved)
  values ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3', true)
$$, '42501', null, 'học viên không tự ghi được attempt (chống gian lận)');
select throws_ok($$
  select * from puzzle_for_student_item('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3')
$$, '42501', null, 'học viên không gọi được hàm nội bộ của Edge Function');

select pg_temp.login('00000000-0000-0000-0000-0000000000a4');
select is_empty($$ select 1 from assignments $$, 'HV2 (lớp G2) không thấy bài của G1');

select pg_temp.login('00000000-0000-0000-0000-0000000000a6');
select results_eq($$ select title from assignments $$, $$ values ('Bài 1') $$, 'HV3 thấy bài giao trực tiếp');

select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select is_empty($$ select 1 from assignments $$, 'owner học viện B không thấy bài của A');

-- ── Báo cáo tiến độ (attempt do service role ghi; ở đây ghi bằng postgres) ──
select pg_temp.logout();
insert into attempts (item_id, student_id, moves, tries, solved, time_ms)
values ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3',
        '[{"uci":"d1d1","ok":false},{"uci":"d1d8","ok":true}]', 2, true, 8000);

select pg_temp.login('00000000-0000-0000-0000-0000000000a3');
select results_eq(
  $$ select student_id::text, solved_items, total_items, tries from assignment_progress $$,
  $$ values ('00000000-0000-0000-0000-0000000000a3', 1, 1, 2) $$,
  'HV1 chỉ thấy tiến độ của chính mình'
);

select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select results_eq(
  $$ select student_id::text, solved_items from assignment_progress order by student_id $$,
  $$ values ('00000000-0000-0000-0000-0000000000a3', 1), ('00000000-0000-0000-0000-0000000000a6', 0) $$,
  'coach thấy tiến độ của mọi học viên được giao (HV1 qua lớp, HV3 trực tiếp)'
);

select pg_temp.login('00000000-0000-0000-0000-0000000000a5');
select results_eq(
  $$ select student_id::text from assignment_progress $$,
  $$ values ('00000000-0000-0000-0000-0000000000a3') $$,
  'phụ huynh chỉ thấy tiến độ của con'
);

-- ── Hàm cho Edge Function (service role) ──
select pg_temp.logout();
set local role service_role;
select is(
  (select count(*)::int from puzzle_for_student_item('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3')),
  1, 'service role lấy được puzzle cho học viên được giao'
);
select is(
  (select count(*)::int from puzzle_for_student_item('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a4')),
  0, 'không trả puzzle cho học viên không được giao'
);
reset role;

select * from finish();
rollback;
