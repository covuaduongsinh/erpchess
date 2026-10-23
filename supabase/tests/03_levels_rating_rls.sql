-- Kiểm thử RLS Giai đoạn 5 (cấp độ, batch, rating, bảng xếp hạng, số liệu). Chạy trong transaction, ROLLBACK cuối.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(22);

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
insert into groups (id, academy_id, name) values
  ('20000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a', 'G1');
insert into levels (id, academy_id, name, position, min_rating, max_rating) values
  ('50000000-0000-0000-0000-0000000000b1', '10000000-0000-0000-0000-00000000000b', 'Cấp B', 0, 0, 500);

-- Bài tập có một lần giải xong để kiểm bảng xếp hạng
insert into puzzles (id, academy_id, title, fen, moves) values
  ('30000000-0000-0000-0000-000000000001', null, 'Chung', '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', '{d1d8}');
insert into assignments (id, academy_id, title) values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', 'Bài 1');
insert into assignment_items (id, assignment_id, position, puzzle_id) values
  ('41000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 0, '30000000-0000-0000-0000-000000000001');
insert into attempts (item_id, student_id, tries, solved, finished_at) values
  ('41000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a4', 2, true, now());

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

-- ── Cấp độ ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select lives_ok($$
  insert into levels (id, academy_id, name, position, min_rating, max_rating)
  values ('50000000-0000-0000-0000-0000000000a1', '10000000-0000-0000-0000-00000000000a', 'Cơ bản', 0, 0, 800)
$$, 'owner tạo cấp độ');
select throws_ok($$
  insert into levels (academy_id, name, position, min_rating, max_rating)
  values ('10000000-0000-0000-0000-00000000000a', 'Sai', 1, 900, 800)
$$, '23514', null, 'khoảng rating ngược bị chặn');

select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select throws_ok($$
  insert into levels (academy_id, name, position) values ('10000000-0000-0000-0000-00000000000a', 'Coach', 2)
$$, '42501', null, 'coach không tạo được cấp độ');

select pg_temp.login('00000000-0000-0000-0000-0000000000a3');
select is((select count(*)::int from levels), 1, 'học viên thấy cấp độ của học viện mình, không thấy của B');

-- ── Gán cấp cho học viên ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select lives_ok($$
  select set_student_level('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', '50000000-0000-0000-0000-0000000000a1')
$$, 'coach gán cấp cho học viên');
select is(
  (select level_id from memberships where user_id = '00000000-0000-0000-0000-0000000000a3'),
  '50000000-0000-0000-0000-0000000000a1'::uuid, 'cấp đã được ghi');
select throws_ok($$
  select set_student_level('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', '50000000-0000-0000-0000-0000000000b1')
$$, '22023', null, 'không gán được cấp của học viện khác');
select throws_ok($$
  select set_student_level('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', '50000000-0000-0000-0000-0000000000a1')
$$, 'P0002', null, 'không gán cấp cho owner');
select lives_ok($$
  select set_student_level('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', null)
$$, 'coach gỡ cấp');

select pg_temp.login('00000000-0000-0000-0000-0000000000a3');
select throws_ok($$
  select set_student_level('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a4', '50000000-0000-0000-0000-0000000000a1')
$$, '42501', null, 'học viên không gán cấp được');

-- ── Batch ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select lives_ok($$
  update groups set kind = 'batch', level_id = '50000000-0000-0000-0000-0000000000a1',
    schedule = '[{"day":1,"start":"18:00","minutes":90}]'
  where id = '20000000-0000-0000-0000-0000000000a1'
$$, 'coach chuyển lớp thành batch có lịch');
select throws_ok($$
  update groups set kind = 'khac' where id = '20000000-0000-0000-0000-0000000000a1'
$$, '23514', null, 'kind ngoài danh sách bị chặn');

-- ── Rating ──
select lives_ok($$
  insert into ratings (academy_id, student_id, category, rating)
  values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', 'rapid', 900)
$$, 'coach đặt rating ban đầu cho học viên');
select throws_ok($$
  insert into ratings (academy_id, student_id, category, rating)
  values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'rapid', 900)
$$, '42501', null, 'không đặt rating cho owner');

select pg_temp.login('00000000-0000-0000-0000-0000000000a3');
update ratings set rating = 2500 where student_id = '00000000-0000-0000-0000-0000000000a3';
select is(
  (select rating::int from ratings where student_id = '00000000-0000-0000-0000-0000000000a3'),
  900, 'học viên không tự sửa rating (RLS lọc mất dòng)');
select is((select count(*)::int from ratings), 1, 'học viên đọc được rating trong học viện');

select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select is((select count(*)::int from ratings), 0, 'owner học viện khác không đọc được rating');

-- ── Bảng xếp hạng, số liệu ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a3');
select is(
  (select points from academy_leaderboard('10000000-0000-0000-0000-00000000000a', now() - interval '7 days', now() + interval '1 minute') limit 1),
  10, 'học viên giải 1 câu đứng đầu với 10 điểm');
select is(
  (select count(*)::int from academy_leaderboard('10000000-0000-0000-0000-00000000000a', now() - interval '7 days', now() + interval '1 minute')),
  2, 'bảng xếp hạng có đủ học viên, kể cả người chưa có điểm');
select is_empty($$ select * from academy_stats('10000000-0000-0000-0000-00000000000a') $$, 'học viên không xem số liệu học viện');

select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select is_empty($$
  select * from academy_leaderboard('10000000-0000-0000-0000-00000000000a', now() - interval '7 days', now())
$$, 'người ngoài học viện không xem được bảng xếp hạng');

select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select results_eq($$ select students, staff, batches from academy_stats('10000000-0000-0000-0000-00000000000a') $$,
  $$ values (2, 2, 1) $$, 'owner xem số liệu: 2 học viên, 2 staff, 1 batch');

select pg_temp.logout();
select * from finish();
rollback;
