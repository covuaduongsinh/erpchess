-- Kiểm thử RLS Giai đoạn 7c: Exercise chỉ staff, Practice theo chế độ chia sẻ, kết quả tự ghi của mình.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(16);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner.a@test.local', '{"display_name":"Owner A"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'coach.a@test.local', '{"display_name":"Coach A"}'),
  ('00000000-0000-0000-0000-0000000000a6', 'coach2.a@test.local', '{"display_name":"Coach A2"}'),
  ('00000000-0000-0000-0000-0000000000a3', 'hv1@students.erpchess.local', '{"display_name":"HV 1","username":"hv1"}'),
  ('00000000-0000-0000-0000-0000000000a5', 'parent.a@test.local', '{"display_name":"PH 1"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'owner.b@test.local', '{"display_name":"Owner B"}');

insert into academies (id, name, slug) values
  ('10000000-0000-0000-0000-00000000000a', 'Học viện A', 'hv-a'),
  ('10000000-0000-0000-0000-00000000000b', 'Học viện B', 'hv-b');
insert into memberships (academy_id, user_id, role) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'owner'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a2', 'coach'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a6', 'coach'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', 'student'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a5', 'parent'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'owner');
insert into parent_links (academy_id, parent_id, student_id) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000a3');
insert into puzzles (id, academy_id, title, fen, moves) values
  ('30000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', 'P1',
   '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', '{d1d8}');

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

-- ── Exercise ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select lives_ok($$
  insert into exercises (id, academy_id, title, created_by) values
    ('80000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', 'Ex 1', '00000000-0000-0000-0000-0000000000a2');
  insert into exercise_items (exercise_id, position, puzzle_id) values
    ('80000000-0000-0000-0000-000000000001', 0, '30000000-0000-0000-0000-000000000001')
$$, 'coach soạn Exercise');
select lives_ok($$
  insert into assignments (id, academy_id, title, created_by, exercise_id) values
    ('81000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', 'Ex 1', '00000000-0000-0000-0000-0000000000a2', '80000000-0000-0000-0000-000000000001'),
    ('81000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-00000000000a', 'Ex 1', '00000000-0000-0000-0000-0000000000a2', '80000000-0000-0000-0000-000000000001')
$$, 'giao một Exercise hai lần');

select pg_temp.login('00000000-0000-0000-0000-0000000000a3');
select is_empty($$ select * from exercises $$, 'học viên không thấy Exercise');
select is_empty($$ select * from exercise_items $$, 'học viên không thấy câu của Exercise');
select throws_ok($$
  insert into exercises (academy_id, title, created_by) values
    ('10000000-0000-0000-0000-00000000000a', 'X', '00000000-0000-0000-0000-0000000000a3')
$$, '42501', null, 'học viên không tạo Exercise');

select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select is_empty($$ select * from exercises $$, 'học viện khác không thấy Exercise');

-- ── Practice ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select lives_ok($$
  insert into practice_chapters (id, academy_id, title, visibility, created_by) values
    ('90000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', 'Chương chung', 'academy', '00000000-0000-0000-0000-0000000000a2'),
    ('90000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-00000000000a', 'Chương riêng', 'private', '00000000-0000-0000-0000-0000000000a2');
  insert into practice_positions (id, chapter_id, position, fen, side) values
    ('91000000-0000-0000-0000-000000000001', '90000000-0000-0000-0000-000000000001', 0, '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', 'w'),
    ('91000000-0000-0000-0000-000000000002', '90000000-0000-0000-0000-000000000002', 0, '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', 'w')
$$, 'coach tạo chương và thế cờ');

select pg_temp.login('00000000-0000-0000-0000-0000000000a6');
select throws_ok($$
  insert into practice_positions (chapter_id, position, fen, side) values
    ('90000000-0000-0000-0000-000000000001', 1, '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', 'w')
$$, '42501', null, 'coach khác không thêm thế vào chương không phải của mình');

select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select lives_ok($$
  update practice_positions set title = 'Owner sửa' where id = '91000000-0000-0000-0000-000000000001'
$$, 'owner sửa được mọi chương');

select pg_temp.login('00000000-0000-0000-0000-0000000000a3');
select is((select count(*)::int from practice_chapters where id::text like '90000000-%'), 1,
  'học viên chỉ thấy chương chia sẻ');
select is((select count(*)::int from practice_positions where id::text like '91000000-%'), 1,
  'học viên chỉ thấy thế cờ của chương chia sẻ');
select lives_ok($$
  insert into practice_results (position_id, student_id, result, moves) values
    ('91000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3', 'win', 12)
$$, 'học viên tự ghi kết quả của mình');
select throws_ok($$
  insert into practice_results (position_id, student_id, result) values
    ('91000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000a3', 'win')
$$, '42501', null, 'không ghi kết quả cho chương không đọc được');

select pg_temp.login('00000000-0000-0000-0000-0000000000a5');
select is((select count(*)::int from practice_results), 1, 'phụ huynh thấy kết quả của con');

select pg_temp.login('00000000-0000-0000-0000-0000000000a6');
select is((select count(*)::int from practice_results), 1, 'HLV thấy kết quả luyện tập của học viện');

select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select is_empty($$ select * from practice_chapters $$, 'học viện khác không thấy chương');

select pg_temp.logout();
select * from finish();
rollback;
