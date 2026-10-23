-- Kiểm thử phân quyền kênh Realtime phòng học (Giai đoạn 8b), mô phỏng truy vấn kiểm quyền của
-- Realtime: đặt realtime.topic rồi thử insert/select trên realtime.messages.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a2', 'coach.a@test.local', '{"display_name":"Coach A"}'),
  ('00000000-0000-0000-0000-0000000000a3', 'hv1@students.erpchess.local', '{"display_name":"HV 1","username":"hv1"}'),
  ('00000000-0000-0000-0000-0000000000a4', 'hv2@students.erpchess.local', '{"display_name":"HV 2","username":"hv2"}');
insert into academies (id, name, slug) values ('10000000-0000-0000-0000-00000000000a', 'Học viện A', 'hv-a');
insert into memberships (academy_id, user_id, role) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a2', 'coach'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', 'student'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a4', 'student');
insert into classrooms (id, academy_id, title, starts_at, coach_id, created_by) values
  ('a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', 'Lớp', now(),
   '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a2');
insert into classroom_targets (classroom_id, student_id) values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3');

create function pg_temp.as_user(p_uid uuid, p_topic text) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('realtime.topic', p_topic, true);
end;
$$;

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2', 'classroom:a0000000-0000-0000-0000-000000000001:board');
select lives_ok($$
  insert into realtime.messages (topic, extension, event, payload, private)
  values ('classroom:a0000000-0000-0000-0000-000000000001:board', 'broadcast', 'snapshot', '{}', true)
$$, 'HLV gửi được lên kênh bàn cờ');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3', 'classroom:a0000000-0000-0000-0000-000000000001:board');
select throws_ok($$
  insert into realtime.messages (topic, extension, event, payload, private)
  values ('classroom:a0000000-0000-0000-0000-000000000001:board', 'broadcast', 'snapshot', '{}', true)
$$, '42501', null, 'học viên không gửi được lên kênh bàn cờ');
select isnt_empty($$
  select 1 from realtime.messages where topic = 'classroom:a0000000-0000-0000-0000-000000000001:board'
$$, 'học viên được giao nghe được kênh bàn cờ');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a3', 'classroom:a0000000-0000-0000-0000-000000000001');
select lives_ok($$
  insert into realtime.messages (topic, extension, event, payload, private)
  values ('classroom:a0000000-0000-0000-0000-000000000001', 'broadcast', 'chat', '{}', true)
$$, 'học viên được giao gửi chat');
select lives_ok($$
  insert into realtime.messages (topic, extension, event, payload, private)
  values ('classroom:a0000000-0000-0000-0000-000000000001', 'presence', 'presence', '{}', true)
$$, 'học viên được giao báo presence');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a4', 'classroom:a0000000-0000-0000-0000-000000000001');
select throws_ok($$
  insert into realtime.messages (topic, extension, event, payload, private)
  values ('classroom:a0000000-0000-0000-0000-000000000001', 'broadcast', 'chat', '{}', true)
$$, '42501', null, 'học viên ngoài lớp không gửi được');
select is_empty($$
  select 1 from realtime.messages where topic like 'classroom:a0000000-0000-0000-0000-000000000001%'
$$, 'học viên ngoài lớp không nghe được');

select pg_temp.as_user('00000000-0000-0000-0000-0000000000a2', 'classroom:khong-hop-le');
select throws_ok($$
  insert into realtime.messages (topic, extension, event, payload, private)
  values ('classroom:khong-hop-le', 'broadcast', 'chat', '{}', true)
$$, '42501', null, 'topic sai định dạng bị từ chối');

select * from finish();
rollback;
