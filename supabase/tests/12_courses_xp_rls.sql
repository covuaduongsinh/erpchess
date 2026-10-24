-- Kiểm thử Giai đoạn 11a: khoá học (giao, bản nháp), XP ghi bằng trigger không cộng trùng,
-- hoàn thành khoá + thưởng XP, tiến độ khoá, quyền xem XP.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(15);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a2', 'coach.a@test.local', '{"display_name":"Coach A"}'),
  ('00000000-0000-0000-0000-0000000000a3', 'hv1@students.erpchess.local', '{"display_name":"HV 1","username":"hv1"}'),
  ('00000000-0000-0000-0000-0000000000a4', 'hv2@students.erpchess.local', '{"display_name":"HV 2","username":"hv2"}'),
  ('00000000-0000-0000-0000-0000000000a5', 'parent.a@test.local', '{"display_name":"PH 1"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'owner.b@test.local', '{"display_name":"Owner B"}');
insert into academies (id, name, slug) values
  ('10000000-0000-0000-0000-00000000000a', 'Học viện A', 'hv-a'),
  ('10000000-0000-0000-0000-00000000000b', 'Học viện B', 'hv-b');
insert into memberships (academy_id, user_id, role) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a2', 'coach'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', 'student'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a4', 'student'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a5', 'parent'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'owner');
insert into parent_links (academy_id, parent_id, student_id) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000a3');
insert into studies (id, academy_id, title, visibility, created_by) values
  ('e0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', 'Học liệu', 'academy',
   '00000000-0000-0000-0000-0000000000a2');
insert into study_activities (id, study_id, position, kind, payload) values
  ('e1000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-000000000001', 0, 'mcq',
   '{"question":"?","options":["a","b"],"correct":0}'),
  ('e1000000-0000-0000-0000-000000000002', 'e0000000-0000-0000-0000-000000000001', 1, 'mcq',
   '{"question":"?","options":["a","b"],"correct":1}');

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

-- ── Khoá học ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select lives_ok($$
  insert into courses (id, academy_id, title, status, created_by) values
    ('c1000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', 'Khoá 1', 'published',
     '00000000-0000-0000-0000-0000000000a2'),
    ('c1000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-00000000000a', 'Khoá nháp', 'draft',
     '00000000-0000-0000-0000-0000000000a2');
  insert into course_items (course_id, position, study_id) values
    ('c1000000-0000-0000-0000-000000000001', 0, 'e0000000-0000-0000-0000-000000000001');
  insert into course_targets (course_id, student_id) values
    ('c1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3'),
    ('c1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000a3')
$$, 'HLV tạo khoá, thêm học liệu, giao cho học viên');

select pg_temp.login('00000000-0000-0000-0000-0000000000a3');
select is((select count(*)::int from courses where id::text like 'c1000000-%'), 1, 'học viên chỉ thấy khoá đã xuất bản được giao');
select throws_ok($$
  insert into courses (academy_id, title, created_by) values
    ('10000000-0000-0000-0000-00000000000a', 'X', '00000000-0000-0000-0000-0000000000a3')
$$, '42501', null, 'học viên không tạo khoá');
select throws_ok($$
  insert into xp_events (student_id, source, source_id, points) values
    ('00000000-0000-0000-0000-0000000000a3', 'course', 'c1000000-0000-0000-0000-000000000001', 9999)
$$, '42501', null, 'học viên không tự cộng XP');

select pg_temp.login('00000000-0000-0000-0000-0000000000a4');
select is((select count(*)::int from courses where id::text like 'c1000000-%'), 0, 'học viên không được giao không thấy khoá');

-- ── XP bằng trigger ──
select pg_temp.logout();
insert into activity_attempts (activity_id, student_id, tries, solved, score)
  values ('e1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3', 1, true, 10);
select is((select sum(points)::int from xp_events where student_id = '00000000-0000-0000-0000-0000000000a3'), 10,
  'giải câu đầu được XP');
update activity_attempts set score = 10, tries = 2
  where activity_id = 'e1000000-0000-0000-0000-000000000001' and student_id = '00000000-0000-0000-0000-0000000000a3';
select is((select count(*)::int from xp_events where student_id = '00000000-0000-0000-0000-0000000000a3'), 1,
  'cập nhật kết quả đã giải không cộng XP lần nữa');
select is_empty($$ select 1 from course_completions $$, 'chưa xong học liệu thì chưa hoàn thành khoá');
insert into activity_attempts (activity_id, student_id, tries, solved, score)
  values ('e1000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000a3', 1, true, 8);
select is((select count(*)::int from course_completions
           where course_id = 'c1000000-0000-0000-0000-000000000001' and student_id = '00000000-0000-0000-0000-0000000000a3'), 1,
  'xong mọi học liệu bắt buộc thì hoàn thành khoá');

select pg_temp.login('00000000-0000-0000-0000-0000000000a3');
select is((select total from student_xp('00000000-0000-0000-0000-0000000000a3')), 118,
  'tổng XP = 10 + 8 + 100 thưởng hoàn thành khoá');
select is((select required_done from course_progress where course_id = 'c1000000-0000-0000-0000-000000000001'), 1,
  'tiến độ khoá: 1/1 học liệu bắt buộc');

select pg_temp.login('00000000-0000-0000-0000-0000000000a4');
select is_empty($$ select * from student_xp('00000000-0000-0000-0000-0000000000a3') $$, 'học viên khác không xem XP của bạn');
select is((select xp from xp_leaderboard('10000000-0000-0000-0000-00000000000a') where student_id = '00000000-0000-0000-0000-0000000000a3'), 118,
  'bảng XP học viện có học viên');

select pg_temp.login('00000000-0000-0000-0000-0000000000a5');
select is((select count(*)::int from xp_events), 3, 'phụ huynh xem XP của con');

select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select is_empty($$ select * from xp_events where student_id = '00000000-0000-0000-0000-0000000000a3' $$, 'học viện khác không xem XP');

select pg_temp.logout();
select * from finish();
rollback;
