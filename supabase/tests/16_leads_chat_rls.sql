-- Kiểm thử Giai đoạn 12c: lead chỉ staff, hẹn học thử tạo sự kiện lịch; chat lớp chỉ thành
-- viên đọc/gửi, không nhắn riêng học viên ↔ học viên, phụ huynh xem (không gửi) hội thoại của con.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(17);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner.a@test.local', '{"display_name":"Owner A"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'coach.a@test.local', '{"display_name":"Coach A"}'),
  ('00000000-0000-0000-0000-0000000000a3', 'hv1@students.erpchess.local', '{"display_name":"HV 1","username":"hv1"}'),
  ('00000000-0000-0000-0000-0000000000a4', 'hv2@students.erpchess.local', '{"display_name":"HV 2","username":"hv2"}'),
  ('00000000-0000-0000-0000-0000000000a6', 'hv3@students.erpchess.local', '{"display_name":"HV 3","username":"hv3"}'),
  ('00000000-0000-0000-0000-0000000000a5', 'parent.a@test.local', '{"display_name":"PH 1"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'owner.b@test.local', '{"display_name":"Owner B"}');
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
insert into parent_links (academy_id, parent_id, student_id) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000a3');
insert into groups (id, academy_id, name, coach_id) values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', 'Lớp A',
   '00000000-0000-0000-0000-0000000000a2');
insert into group_members (group_id, student_id) values
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3'),
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a4');

create function pg_temp.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;
create temp table ids (k text primary key, v uuid);
grant all on ids to authenticated;

-- ── Lead ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
insert into leads (id, academy_id, name, phone, child_name, child_age, source, created_by) values
  ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', 'Chị Lan', '0900000000',
   'Bé Na', 7, 'Facebook', '00000000-0000-0000-0000-0000000000a2');
select is((select count(*)::int from leads), 1, 'coach tạo và thấy lead');
insert into ids
  select 'trial', schedule_trial('60000000-0000-0000-0000-000000000001', '2026-11-01 09:00+07', '2026-11-01 10:00+07');
select is(
  (select kind || '|' || title from calendar_events where id = (select v from ids where k = 'trial')),
  'trial|Học thử: Bé Na', 'hẹn học thử tạo sự kiện lịch loại trial');
select is((select status from leads), 'trial', 'lead chuyển sang trạng thái học thử');

select pg_temp.login('00000000-0000-0000-0000-0000000000a3');
select is((select count(*)::int from leads), 0, 'học viên không thấy lead');
select throws_ok($$
  insert into leads (academy_id, name) values ('10000000-0000-0000-0000-00000000000a', 'Giả')
$$, '42501', null, 'học viên không tạo lead');
select throws_ok($$
  select schedule_trial('60000000-0000-0000-0000-000000000001', now(), now() + interval '1 hour')
$$, '42501', null, 'học viên không hẹn học thử');
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select is((select count(*)::int from leads), 0, 'owner học viện khác không thấy lead');

-- ── Chat lớp ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
insert into ids select 'group', open_group_chat('40000000-0000-0000-0000-000000000001');
select is(
  (select count(*)::int from conversation_members where conversation_id = (select v from ids where k = 'group')),
  3, 'chat lớp gồm HLV + 2 học viên');
select is(open_group_chat('40000000-0000-0000-0000-000000000001'), (select v from ids where k = 'group'),
  'mở lại trả đúng hội thoại cũ');

select pg_temp.login('00000000-0000-0000-0000-0000000000a3');
insert into messages (conversation_id, sender_id, body)
  values ((select v from ids where k = 'group'), '00000000-0000-0000-0000-0000000000a3', 'Chào cả lớp');
select pg_temp.login('00000000-0000-0000-0000-0000000000a4');
select is(
  (select unread from my_conversations('10000000-0000-0000-0000-00000000000a') where kind = 'group'), 1,
  'bạn cùng lớp có 1 tin chưa đọc');
select mark_conversation_read((select v from ids where k = 'group'));
select is(
  (select unread from my_conversations('10000000-0000-0000-0000-00000000000a') where kind = 'group'), 0,
  'đánh dấu đã đọc');
select pg_temp.login('00000000-0000-0000-0000-0000000000a6');
select is((select count(*)::int from messages), 0, 'học viên ngoài lớp không đọc được tin');
select throws_ok($$
  insert into messages (conversation_id, sender_id, body)
  values ((select v from ids where k = 'group'), '00000000-0000-0000-0000-0000000000a6', 'Xen vào')
$$, '42501', null, 'học viên ngoài lớp không gửi được');
select throws_ok($$ select open_group_chat('40000000-0000-0000-0000-000000000001') $$,
  '42501', null, 'học viên ngoài lớp không mở chat lớp');

-- ── Nhắn riêng ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a3');
select throws_ok($$
  select open_direct_chat('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a4')
$$, '42501', null, 'không nhắn riêng học viên ↔ học viên');
insert into ids
  select 'direct', open_direct_chat('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a2');
insert into messages (conversation_id, sender_id, body)
  values ((select v from ids where k = 'direct'), '00000000-0000-0000-0000-0000000000a3', 'Thầy ơi em hỏi bài');

select pg_temp.login('00000000-0000-0000-0000-0000000000a5');
select is((select count(*)::int from messages), 2, 'phụ huynh xem được tin trong hội thoại của con');
select throws_ok($$
  insert into messages (conversation_id, sender_id, body)
  values ((select v from ids where k = 'direct'), '00000000-0000-0000-0000-0000000000a5', 'Phụ huynh chen')
$$, '42501', null, 'phụ huynh không gửi vào hội thoại của con');

select * from finish();
rollback;
