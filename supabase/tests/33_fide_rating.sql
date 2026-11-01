-- Kiểm thử migration 20261101000041: academies.fide_enabled, memberships.fide_*, set_academy_fide_enabled,
-- set_member_fide. Chạy trong transaction, ROLLBACK cuối. CHƯA chạy trên Supabase thật: cần áp migration trước.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(21);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner.a@test.local', '{"display_name":"Owner A"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'coach.a@test.local', '{"display_name":"Coach A"}'),
  ('00000000-0000-0000-0000-0000000000a3', 'hv1@students.erpchess.local', '{"display_name":"HV 1","username":"hv1"}'),
  ('00000000-0000-0000-0000-0000000000a4', 'hv2@students.erpchess.local', '{"display_name":"HV 2","username":"hv2"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'owner.b@test.local', '{"display_name":"Owner B"}');
insert into academies (id, name, slug) values
  ('10000000-0000-0000-0000-00000000000a', 'Học viện A', 'hv-a'),
  ('10000000-0000-0000-0000-00000000000b', 'Học viện B', 'hv-b');
insert into memberships (academy_id, user_id, role) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'owner'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a2', 'coach'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', 'student'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a4', 'student'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'owner');

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

-- ── Mặc định ──
select is((select fide_enabled from academies where slug = 'hv-a'), false, 'học viện mới: FIDE tắt');
select is((select fide_id from memberships where user_id = '00000000-0000-0000-0000-0000000000a3'), null, 'học viên mới: chưa có mã FIDE');

-- ── Bật/tắt FIDE: chỉ owner ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select throws_ok($$ select public.set_academy_fide_enabled('10000000-0000-0000-0000-00000000000a', true) $$,
  '42501', null, 'coach không bật được FIDE');
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select throws_ok($$ select public.set_academy_fide_enabled('10000000-0000-0000-0000-00000000000a', true) $$,
  '42501', null, 'owner học viện khác không bật được');
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select lives_ok($$ select public.set_academy_fide_enabled('10000000-0000-0000-0000-00000000000a', true) $$,
  'owner bật được FIDE');
select is((select fide_enabled from academies where slug = 'hv-a'), true, 'fide_enabled = true sau khi bật');
-- Đọc học viện B dưới vai trò postgres: owner A không thấy học viện B (RLS) nên sẽ nhận NULL thay vì false
select pg_temp.logout();
select is((select fide_enabled from academies where slug = 'hv-b'), false, 'học viện khác không bị ảnh hưởng');
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select throws_ok($$ select public.set_academy_fide_enabled('10000000-0000-0000-0000-00000000000a', null) $$,
  '22023', null, 'giá trị null bị từ chối');

-- ── Nhập FIDE: owner và coach ──
select lives_ok($$ select public.set_member_fide('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', '12345678', 1800, 1750, 1700) $$,
  'owner nhập FIDE cho học viên');
select pg_temp.logout();
select results_eq($$ select fide_id, fide_standard, fide_rapid, fide_blitz from memberships where user_id = '00000000-0000-0000-0000-0000000000a3' $$,
  $$ values ('12345678'::text, 1800, 1750, 1700) $$, 'giá trị được lưu đúng');
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select lives_ok($$ select public.set_member_fide('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', '  ', null, 1600, null) $$,
  'coach sửa FIDE; chuỗi trống = xoá mã, null = xoá Elo');
select pg_temp.logout();
select results_eq($$ select fide_id, fide_standard, fide_rapid, fide_blitz from memberships where user_id = '00000000-0000-0000-0000-0000000000a3' $$,
  $$ values (null::text, null::int, 1600, null::int) $$, 'ghi đè đúng, các giá trị bỏ trống thành null');

-- ── Ràng buộc ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select throws_ok($$ select public.set_member_fide('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', 'abc', null, null, null) $$,
  '23514', null, 'mã FIDE phải là số');
select throws_ok($$ select public.set_member_fide('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', '12', null, null, null) $$,
  '23514', null, 'mã FIDE ngắn hơn 3 chữ số bị từ chối');
select throws_ok($$ select public.set_member_fide('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', null, 999, null, null) $$,
  '23514', null, 'Elo dưới 1000 bị từ chối');
select throws_ok($$ select public.set_member_fide('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', null, null, 3301, null) $$,
  '23514', null, 'Elo trên 3300 bị từ chối');
select throws_ok($$ select public.set_member_fide('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a2', '12345678', 1800, null, null) $$,
  'P0002', null, 'chỉ học viên mới có FIDE (không nhập cho HLV)');

-- ── Quyền ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a3');
select throws_ok($$ select public.set_member_fide('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a4', '12345678', 1800, null, null) $$,
  '42501', null, 'học viên không nhập FIDE cho người khác');
select throws_ok($$ select public.set_member_fide('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', '12345678', 1800, null, null) $$,
  '42501', null, 'học viên không tự nhập FIDE');
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select throws_ok($$ select public.set_member_fide('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', '12345678', 1800, null, null) $$,
  '42501', null, 'owner học viện khác không nhập được');
select pg_temp.logout();
set local role anon;
select throws_ok($$ select public.set_member_fide('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', '12345678', 1800, null, null) $$,
  '42501', null, 'anon không gọi được');
select pg_temp.logout();

select * from finish();
rollback;
