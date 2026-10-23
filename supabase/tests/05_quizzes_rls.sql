-- Kiểm thử RLS Giai đoạn 7a (Quiz): học viên không đọc được đáp án, lịch mở, phạm vi giao.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(18);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner.a@test.local', '{"display_name":"Owner A"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'coach.a@test.local', '{"display_name":"Coach A"}'),
  ('00000000-0000-0000-0000-0000000000a3', 'hv1@students.erpchess.local', '{"display_name":"HV 1","username":"hv1"}'),
  ('00000000-0000-0000-0000-0000000000a4', 'hv2@students.erpchess.local', '{"display_name":"HV 2","username":"hv2"}'),
  ('00000000-0000-0000-0000-0000000000a5', 'parent.a@test.local', '{"display_name":"PH 1"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'owner.b@test.local', '{"display_name":"Owner B"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'hvb@students.erpchess.local', '{"display_name":"HV B","username":"hvb"}');

insert into academies (id, name, slug) values
  ('10000000-0000-0000-0000-00000000000a', 'Học viện A', 'hv-a'),
  ('10000000-0000-0000-0000-00000000000b', 'Học viện B', 'hv-b');
insert into memberships (academy_id, user_id, role) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'owner'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a2', 'coach'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', 'student'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a4', 'student'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a5', 'parent'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'owner'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b2', 'student');
insert into groups (id, academy_id, name) values
  ('20000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a', 'G1');
insert into group_members (group_id, student_id) values
  ('20000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a3');
insert into parent_links (academy_id, parent_id, student_id) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000a3');

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

-- ── Coach soạn quiz giao cho lớp G1, và một quiz mở cho tất cả nhưng chưa tới giờ ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select lives_ok($$
  insert into quizzes (id, academy_id, title, created_by) values
    ('70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', 'Quiz lớp G1', '00000000-0000-0000-0000-0000000000a2')
$$, 'coach tạo quiz');
select lives_ok($$
  insert into quiz_items (id, quiz_id, position, kind, payload) values
    ('71000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 0, 'puzzle',
     '{"fen":"6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1","moves":["d1d8"]}'),
    ('71000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001', 1, 'mcq',
     '{"question":"?","options":["a","b"],"correct":1}')
$$, 'coach thêm câu hỏi');
select lives_ok($$
  insert into quiz_targets (quiz_id, group_id) values ('70000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-0000000000a1')
$$, 'coach giao cho lớp G1');
select throws_ok($$
  insert into quiz_targets (quiz_id, student_id) values ('70000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b2')
$$, '42501', null, 'không giao cho học viên học viện khác');
select lives_ok($$
  insert into quizzes (id, academy_id, title, open_to_all, starts_at, created_by) values
    ('70000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-00000000000a', 'Quiz sắp mở', true, now() + interval '1 day', '00000000-0000-0000-0000-0000000000a2')
$$, 'coach tạo quiz mở cho tất cả, mở vào ngày mai');
insert into quiz_items (quiz_id, position, kind, payload) values
  ('70000000-0000-0000-0000-000000000002', 0, 'puzzle', '{"fen":"7k/6pp/8/8/8/8/8/R5K1 w - - 0 1","moves":["a1a8"]}');

-- ── Học viên trong lớp G1 ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a3');
select is((select count(*)::int from quizzes where id::text like '70000000-%'), 2, 'học viên G1 thấy quiz của lớp và quiz mở cho tất cả');
select is((select count(*)::int from quiz_items), 0, 'học viên không đọc được bảng quiz_items (có đáp án)');
select is(
  (select count(*)::int from quiz_items_for_student('70000000-0000-0000-0000-000000000001')),
  2, 'học viên lấy được đề qua RPC');
select is(
  (select payload ? 'moves' from quiz_items_for_student('70000000-0000-0000-0000-000000000001') where kind = 'puzzle'),
  false, 'đề puzzle không có lời giải');
select is(
  (select payload ? 'correct' from quiz_items_for_student('70000000-0000-0000-0000-000000000001') where kind = 'mcq'),
  false, 'đề trắc nghiệm không có đáp án');
select is_empty($$ select * from quiz_items_for_student('70000000-0000-0000-0000-000000000002') $$,
  'quiz chưa tới giờ thì chưa có đề');
select throws_ok($$
  insert into quiz_attempts (item_id, student_id, solved, score)
  values ('71000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3', true, 999)
$$, '42501', null, 'học viên không tự ghi kết quả');
select is(
  (select count(*)::int from quiz_leaderboard('70000000-0000-0000-0000-000000000001')),
  1, 'bảng xếp hạng gồm học viên được giao');

-- ── Học viên không thuộc lớp, phụ huynh, học viện khác ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a4');
select is((select count(*)::int from quizzes where id::text like '70000000-%'), 1, 'học viên ngoài lớp chỉ thấy quiz mở cho tất cả');
select is_empty($$ select * from quiz_items_for_student('70000000-0000-0000-0000-000000000001') $$,
  'học viên ngoài lớp không lấy được đề');

select pg_temp.login('00000000-0000-0000-0000-0000000000a5');
select is((select count(*)::int from quizzes where id = '70000000-0000-0000-0000-000000000001'), 1,
  'phụ huynh thấy quiz giao cho con');

select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select is((select count(*)::int from quizzes where id::text like '70000000-%'), 0, 'học viện khác không thấy quiz');

-- ── Hàm dành cho Edge Function ──
select pg_temp.logout();
select is(
  (select payload ? 'moves' from quiz_item_for_student('71000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3')),
  true, 'service role lấy được đáp án để chấm cho học viên được giao');

select pg_temp.logout();
select * from finish();
rollback;
