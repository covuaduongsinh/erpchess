-- Kiểm thử migration 20261101000040: get_academy_students_report chạy được (trước đó lỗi vì join
-- bảng không tồn tại `public.academy_levels`) và trả tên cấp độ từ `public.levels`.
-- Chạy trong transaction, ROLLBACK cuối.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner.a@test.local', '{"display_name":"Owner A"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'coach.a@test.local', '{"display_name":"Coach A"}'),
  ('00000000-0000-0000-0000-0000000000a3', 'hv1@students.erpchess.local', '{"display_name":"An","username":"hv1"}'),
  ('00000000-0000-0000-0000-0000000000a4', 'hv2@students.erpchess.local', '{"display_name":"Bình","username":"hv2"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'owner.b@test.local', '{"display_name":"Owner B"}');

insert into academies (id, name, slug) values
  ('10000000-0000-0000-0000-00000000000a', 'Học viện A', 'hv-a'),
  ('10000000-0000-0000-0000-00000000000b', 'Học viện B', 'hv-b');
insert into levels (id, academy_id, name, position) values
  ('90000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', 'Cơ bản', 0);
insert into memberships (academy_id, user_id, role, level_id) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'owner', null),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a2', 'coach', null),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', 'student', '90000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a4', 'student', null),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'owner', null);

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

select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select lives_ok(
  $$ select public.get_academy_students_report('10000000-0000-0000-0000-00000000000a') $$,
  'owner gọi được (trước đây lỗi relation "public.academy_levels" does not exist)');
select is(jsonb_array_length(public.get_academy_students_report('10000000-0000-0000-0000-00000000000a')), 2,
  'trả đủ 2 học viên của học viện (không lẫn staff, không lẫn học viện khác)');
select is(
  (select e ->> 'levelName' from jsonb_array_elements(public.get_academy_students_report('10000000-0000-0000-0000-00000000000a')) e
    where e ->> 'username' = 'hv1'),
  'Cơ bản', 'tên cấp độ lấy từ public.levels');
select is(
  (select e ->> 'levelName' from jsonb_array_elements(public.get_academy_students_report('10000000-0000-0000-0000-00000000000a')) e
    where e ->> 'username' = 'hv2'),
  null, 'học viên chưa xếp cấp thì levelName rỗng');

select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select is(jsonb_array_length(public.get_academy_students_report('10000000-0000-0000-0000-00000000000a')), 2,
  'coach cũng gọi được');

select pg_temp.login('00000000-0000-0000-0000-0000000000a3');
select throws_ok(
  $$ select public.get_academy_students_report('10000000-0000-0000-0000-00000000000a') $$,
  '42501', null, 'học viên không gọi được');

select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select throws_ok(
  $$ select public.get_academy_students_report('10000000-0000-0000-0000-00000000000a') $$,
  '42501', null, 'owner học viện khác không gọi được');

select pg_temp.logout();
set local role anon;
select throws_ok(
  $$ select public.get_academy_students_report('10000000-0000-0000-0000-00000000000a') $$,
  '42501', null, 'anon không gọi được');
select pg_temp.logout();
select * from finish();
rollback;
