-- Kiểm thử Giai đoạn 11b: chứng chỉ tự cấp khi hoàn thành khoá, cấp tay/thu hồi chỉ staff,
-- anon chỉ xác minh được bằng mã (không đọc bảng), quyền xem.
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
   '{"question":"?","options":["a","b"],"correct":0}');
insert into courses (id, academy_id, title, status, open_to_all, created_by) values
  ('c1000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', 'Khoá Khai cuộc', 'published', true,
   '00000000-0000-0000-0000-0000000000a2');
insert into course_items (course_id, position, study_id) values
  ('c1000000-0000-0000-0000-000000000001', 0, 'e0000000-0000-0000-0000-000000000001');

create function pg_temp.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;
create function pg_temp.anon() returns void language plpgsql as $$
begin
  perform set_config('role', 'anon', true);
  perform set_config('request.jwt.claims', '{"role":"anon"}', true);
end;
$$;
create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- ── Tự cấp khi hoàn thành khoá ──
insert into activity_attempts (activity_id, student_id, tries, solved, score)
  values ('e1000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3', 1, true, 10);
select is(
  (select title || '|' || student_name || '|' || academy_name from certificates
   where student_id = '00000000-0000-0000-0000-0000000000a3' and course_id = 'c1000000-0000-0000-0000-000000000001'),
  'Khoá Khai cuộc|HV 1|Học viện A', 'hoàn thành khoá thì tự cấp chứng chỉ, chụp tên lúc cấp');
select ok(
  (select code ~ '^[2-9A-HJ-NP-Z]{10}$' from certificates where student_id = '00000000-0000-0000-0000-0000000000a3'),
  'mã 10 ký tự base32');
create temp table cert_code as select code from certificates where student_id = '00000000-0000-0000-0000-0000000000a3';
grant select on cert_code to anon, authenticated;

-- ── Học viên không tự cấp/thu hồi ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a3');
select throws_ok($$
  insert into certificates (code, academy_id, student_id, title, student_name, academy_name)
  values ('ABCDEFGHJK', '10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', 'Giả', 'HV 1', 'A')
$$, '42501', null, 'học viên không ghi thẳng vào bảng');
select throws_ok($$
  select issue_certificate('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', 'Giả')
$$, '42501', null, 'học viên không gọi được issue_certificate');
select throws_ok($$
  select revoke_certificate((select id from certificates limit 1))
$$, '42501', null, 'học viên không thu hồi được');

-- ── Staff cấp tay ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select lives_ok($$
  select issue_certificate('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', 'Giải nhất CLB tháng 10')
$$, 'HLV cấp tay chứng chỉ không gắn khoá');
select throws_ok($$
  select issue_certificate('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', null,
                           'c1000000-0000-0000-0000-000000000001')
$$, '23505', null, 'không cấp trùng chứng chỉ còn hiệu lực cho cùng khoá');

-- ── Quyền xem ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a3');
select is((select count(*)::int from certificates), 2, 'học viên thấy chứng chỉ của mình');
select pg_temp.login('00000000-0000-0000-0000-0000000000a4');
select is((select count(*)::int from certificates), 0, 'học viên khác không thấy');
select pg_temp.login('00000000-0000-0000-0000-0000000000a5');
select is((select count(*)::int from certificates), 2, 'phụ huynh thấy chứng chỉ của con');
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select is((select count(*)::int from certificates), 0, 'học viện khác không thấy');

-- ── Xác minh công khai ──
select pg_temp.anon();
select is_empty($$ select * from certificates $$, 'anon không đọc được bảng');
select is(
  (select student_name from verify_certificate(lower(substr((select code from cert_code), 1, 5)) || '-' ||
                                                substr((select code from cert_code), 6))),
  'HV 1', 'anon xác minh được bằng mã (không phân biệt hoa thường, bỏ gạch)');

select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select revoke_certificate((select id from certificates where course_id is not null));
select pg_temp.anon();
select ok(
  (select revoked_at is not null from verify_certificate((select code from cert_code))), 'thu hồi hiện trên trang xác minh');
select is_empty($$ select * from verify_certificate('ZZZZZZZZZZ') $$, 'mã không tồn tại trả rỗng');

select pg_temp.logout();

select * from finish();
rollback;
