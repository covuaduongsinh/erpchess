-- Kiểm thử RLS Giai đoạn 8a: lớp học, người tham gia, điểm danh, sự kiện, lịch trống HLV, Calendar.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(22);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner.a@test.local', '{"display_name":"Owner A"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'coach.a@test.local', '{"display_name":"Coach A"}'),
  ('00000000-0000-0000-0000-0000000000a6', 'coach2.a@test.local', '{"display_name":"Coach A2"}'),
  ('00000000-0000-0000-0000-0000000000a3', 'hv1@students.erpchess.local', '{"display_name":"HV 1","username":"hv1"}'),
  ('00000000-0000-0000-0000-0000000000a4', 'hv2@students.erpchess.local', '{"display_name":"HV 2","username":"hv2"}'),
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
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a4', 'student'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a5', 'parent'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'owner');
insert into groups (id, academy_id, name, kind) values
  ('20000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a', 'Batch 1', 'batch');
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

-- ── Coach tạo lớp giao cho Batch 1 (đã bắt đầu 30 phút trước) và một lớp công khai ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select lives_ok($$
  insert into classrooms (id, academy_id, title, kind, starts_at, coach_id, created_by) values
    ('a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', 'Lớp Batch', 'offline',
     now() - interval '30 minutes', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a2'),
    ('a0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-00000000000a', 'Lớp công khai', 'online',
     now() + interval '1 hour', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a2');
  update classrooms set is_public = true where id = 'a0000000-0000-0000-0000-000000000002';
  insert into classroom_targets (classroom_id, group_id) values
    ('a0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-0000000000a1')
$$, 'coach tạo lớp và giao cho Batch');
select is((select count(*)::int from calendar_events where classroom_id::text like 'a0000000-%' and kind = 'class'), 2,
  'mỗi lớp tự có sự kiện trên Calendar');
select throws_ok($$
  insert into calendar_events (academy_id, kind, title, starts_at, ends_at, created_by)
  values ('10000000-0000-0000-0000-00000000000a', 'class', 'Giả', now(), now() + interval '1 hour', '00000000-0000-0000-0000-0000000000a2')
$$, '42501', null, 'không tự tạo sự kiện loại lớp');
select lives_ok($$
  insert into calendar_events (academy_id, kind, title, coach_id, starts_at, ends_at, created_by)
  values ('10000000-0000-0000-0000-00000000000a', 'leave', 'Nghỉ phép', '00000000-0000-0000-0000-0000000000a2',
          now() + interval '1 day', now() + interval '2 days', '00000000-0000-0000-0000-0000000000a2')
$$, 'coach ghi lịch nghỉ của mình');
select lives_ok($$
  insert into coach_availability (academy_id, coach_id, day, start, minutes)
  values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a2', 1, '17:00', 180)
$$, 'coach khai lịch trống của mình');
select throws_ok($$
  insert into coach_availability (academy_id, coach_id, day, start, minutes)
  values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a6', 1, '17:00', 180)
$$, '42501', null, 'coach không khai lịch thay HLV khác');

select pg_temp.login('00000000-0000-0000-0000-0000000000a6');
select is((select count(*)::int from classrooms where id::text like 'a0000000-%'), 2, 'coach khác đọc được lớp');
select is_empty($$ update classrooms set title = 'Đổi' where id = 'a0000000-0000-0000-0000-000000000001' returning id $$,
  'coach khác không sửa lớp không phải của mình');
select throws_ok($$
  insert into classroom_events (classroom_id, kind, actor_id, payload)
  values ('a0000000-0000-0000-0000-000000000001', 'fen', '00000000-0000-0000-0000-0000000000a6', '{}')
$$, '42501', null, 'coach khác không điều khiển bàn cờ lớp người khác');

-- ── Học viên trong Batch ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a3');
select is((select count(*)::int from classrooms where id::text like 'a0000000-%'), 2, 'học viên thấy lớp được giao và lớp công khai');
select is(classroom_join('a0000000-0000-0000-0000-000000000001'), 'late', 'vào muộn 30 phút thì ghi đi muộn');
select is(classroom_join('a0000000-0000-0000-0000-000000000002'), 'present', 'vào lớp công khai trước giờ thì có mặt');
select lives_ok($$
  insert into classroom_events (classroom_id, kind, actor_id, payload)
  values ('a0000000-0000-0000-0000-000000000001', 'chat', '00000000-0000-0000-0000-0000000000a3', '{"text":"Chào thầy"}')
$$, 'học viên chat trong lớp');
select throws_ok($$
  insert into classroom_events (classroom_id, kind, actor_id, payload)
  values ('a0000000-0000-0000-0000-000000000001', 'move', '00000000-0000-0000-0000-0000000000a3', '{}')
$$, '42501', null, 'học viên không tự ghi nước đi lên bàn chung');
select throws_ok($$
  insert into classroom_attendance (classroom_id, student_id, status)
  values ('a0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000a4', 'present')
$$, '42501', null, 'học viên không tự sửa điểm danh');
select is_empty($$ select * from calendar_events $$, 'học viên không xem Calendar quản trị');

-- ── Học viên ngoài Batch, phụ huynh, học viện khác ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a4');
select is((select count(*)::int from classrooms where id::text like 'a0000000-%'), 1, 'học viên ngoài Batch chỉ thấy lớp công khai');
select is(classroom_join('a0000000-0000-0000-0000-000000000001'), null, 'không vào được lớp không được giao');

select pg_temp.login('00000000-0000-0000-0000-0000000000a5');
select is((select count(*)::int from classroom_attendance where classroom_id = 'a0000000-0000-0000-0000-000000000001'), 1,
  'phụ huynh thấy điểm danh của con');

select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select is_empty($$ select * from classrooms where id::text like 'a0000000-%' $$, 'học viện khác không thấy lớp');

-- ── Staff điểm danh ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select lives_ok($$
  insert into classroom_attendance (classroom_id, student_id, status)
  values ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a4', 'absent')
$$, 'coach điểm danh vắng');
select is((select count(*)::int from classroom_events where classroom_id = 'a0000000-0000-0000-0000-000000000001'), 1,
  'coach đọc được chat của lớp');

select pg_temp.logout();
select * from finish();
rollback;
