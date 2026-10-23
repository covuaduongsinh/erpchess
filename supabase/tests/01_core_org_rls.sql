-- Kiểm thử RLS Giai đoạn 2. Chạy: `supabase test db` (local) hoặc gửi nguyên file qua SQL editor/MCP.
-- Toàn bộ chạy trong một transaction và ROLLBACK ở cuối, không để lại dữ liệu.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(22);

-- ── Dữ liệu mẫu (chạy với quyền postgres) ──
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner.a@test.local', '{"display_name":"Owner A"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'coach.a@test.local', '{"display_name":"Coach A"}'),
  ('00000000-0000-0000-0000-0000000000a3', 'hv1@students.erpchess.local', '{"display_name":"HV 1","username":"hv1"}'),
  ('00000000-0000-0000-0000-0000000000a4', 'hv2@students.erpchess.local', '{"display_name":"HV 2","username":"hv2"}'),
  ('00000000-0000-0000-0000-0000000000a5', 'parent.a@test.local', '{"display_name":"PH 1"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'owner.b@test.local', '{"display_name":"Owner B"}');

select is(
  (select username::text from profiles where id = '00000000-0000-0000-0000-0000000000a3'),
  'hv1',
  'trigger tạo profile kèm username cho học viên'
);

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

-- ── Owner A tạo học viện ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select lives_ok(
  $$ select create_academy('Học viện A', 'hoc-vien-a') $$,
  'owner tạo được học viện qua RPC'
);
select is(
  (select role::text from memberships where user_id = '00000000-0000-0000-0000-0000000000a1'),
  'owner',
  'người tạo trở thành owner'
);

-- Owner A thêm coach + 2 học viên (học viên thường do Edge Function thêm; ở đây giả lập)
select lives_ok($$
  insert into memberships (academy_id, user_id, role)
  select id, '00000000-0000-0000-0000-0000000000a2', 'coach' from academies where slug = 'hoc-vien-a'
$$, 'owner thêm coach');

select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select lives_ok($$
  insert into memberships (academy_id, user_id, role)
  select id, u, 'student'
  from academies, unnest(array['00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a4']::uuid[]) u
  where slug = 'hoc-vien-a'
$$, 'coach thêm học viên');

select throws_ok($$
  insert into memberships (academy_id, user_id, role)
  select id, '00000000-0000-0000-0000-0000000000b1', 'owner' from academies where slug = 'hoc-vien-a'
$$, '42501', null, 'coach không thêm được owner');

select lives_ok($$
  insert into groups (academy_id, name, coach_id)
  select id, 'Lớp Cơ bản', '00000000-0000-0000-0000-0000000000a2' from academies where slug = 'hoc-vien-a'
$$, 'coach tạo lớp');
select lives_ok($$
  insert into groups (academy_id, name)
  select id, 'Lớp Nâng cao' from academies where slug = 'hoc-vien-a'
$$, 'coach tạo lớp thứ hai');

select lives_ok($$
  insert into group_members (group_id, student_id)
  select id, '00000000-0000-0000-0000-0000000000a3' from groups where name = 'Lớp Cơ bản'
$$, 'coach xếp HV1 vào Lớp Cơ bản');
select lives_ok($$
  insert into group_members (group_id, student_id)
  select id, '00000000-0000-0000-0000-0000000000a4' from groups where name = 'Lớp Nâng cao'
$$, 'coach xếp HV2 vào Lớp Nâng cao');

-- ── Mời phụ huynh cho HV1 ──
select lives_ok($$
  select create_invitation(
    (select id from academies where slug = 'hoc-vien-a'), 'parent', null,
    '00000000-0000-0000-0000-0000000000a3')
$$, 'coach tạo lời mời phụ huynh');

select pg_temp.logout();
create temp table tmp_token as select token from invitations limit 1;
grant select on tmp_token to authenticated;

select pg_temp.login('00000000-0000-0000-0000-0000000000a5');
select lives_ok(
  $$ select accept_invitation((select token from tmp_token)) $$,
  'phụ huynh chấp nhận lời mời'
);
select results_eq(
  $$ select name from groups order by name $$,
  $$ values ('Lớp Cơ bản') $$,
  'phụ huynh chỉ thấy lớp của con'
);
select throws_ok(
  $$ select accept_invitation((select token from tmp_token)) $$,
  '22023', null, 'lời mời không dùng lại được'
);

-- ── Học viên ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a3');
select results_eq(
  $$ select name from groups order by name $$,
  $$ values ('Lớp Cơ bản') $$,
  'HV1 chỉ thấy lớp mình học'
);
select is_empty(
  $$ select 1 from group_members where student_id = '00000000-0000-0000-0000-0000000000a4' $$,
  'HV1 không thấy danh sách lớp của HV2'
);
select throws_ok(
  $$ select create_academy('HV mở học viện', 'hv-mo') $$,
  '42501', null, 'tài khoản học viên không tạo được học viện'
);
select throws_ok($$
  insert into groups (academy_id, name) select id, 'Lớp lậu' from academies where slug = 'hoc-vien-a'
$$, '42501', null, 'học viên không tạo được lớp');

-- ── Học viện B tách biệt ──
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select lives_ok($$ select create_academy('Học viện B', 'hoc-vien-b') $$, 'owner B tạo học viện B');
select results_eq(
  $$ select slug::text from academies $$,
  $$ values ('hoc-vien-b') $$,
  'owner B chỉ thấy học viện của mình'
);
select is_empty($$ select 1 from groups $$, 'owner B không thấy lớp của học viện A');
select is_empty(
  $$ select 1 from profiles where id = '00000000-0000-0000-0000-0000000000a3' $$,
  'owner B không đọc được profile học viên của học viện A'
);

select * from finish();
rollback;
