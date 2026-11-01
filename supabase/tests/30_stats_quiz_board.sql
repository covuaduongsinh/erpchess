-- Kiểm thử Giai đoạn 25g: academy_daily_stats, academy_quiz_leaderboard, academy_quiz_started.
-- Chạy trong transaction, ROLLBACK cuối. Số liệu mẫu đã được đối chiếu bằng PGlite (bảng giả tối
-- thiểu) nhưng file này CHƯA chạy trên Supabase thật: cần áp migration 20261101000038 trước.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(21);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner.a@test.local', '{"display_name":"Owner A"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'coach.a@test.local', '{"display_name":"Coach A"}'),
  ('00000000-0000-0000-0000-0000000000a3', 'hv1@students.erpchess.local', '{"display_name":"HV 1","username":"hv1"}'),
  ('00000000-0000-0000-0000-0000000000a4', 'hv2@students.erpchess.local', '{"display_name":"HV 2","username":"hv2"}'),
  ('00000000-0000-0000-0000-0000000000a5', 'hv3@students.erpchess.local', '{"display_name":"HV 3","username":"hv3"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'owner.b@test.local', '{"display_name":"Owner B"}');

insert into academies (id, name, slug) values
  ('10000000-0000-0000-0000-00000000000a', 'Học viện A', 'hv-a'),
  ('10000000-0000-0000-0000-00000000000b', 'Học viện B', 'hv-b');
insert into memberships (academy_id, user_id, role) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'owner'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a2', 'coach'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', 'student'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a4', 'student'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a5', 'student'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'owner');

-- Bài tập: lượt xong 03:00Z (ngày 10/5 theo VN), 18:00Z (01:00 ngày 11/5 theo VN) và một lượt chưa xong
insert into puzzles (id, academy_id, title, fen, moves) values
  ('30000000-0000-0000-0000-000000000001', null, 'Chung', '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', '{d1d8}');
insert into assignments (id, academy_id, title) values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', 'Bài 1');
insert into assignment_items (id, assignment_id, position, puzzle_id) values
  ('41000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 0, '30000000-0000-0000-0000-000000000001');
insert into attempts (item_id, student_id, tries, solved, finished_at) values
  ('41000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3', 1, true, '2026-05-10 03:00+00'),
  ('41000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a4', 1, true, '2026-05-10 18:00+00'),
  ('41000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a5', 0, false, null);

-- Quiz: Q1 đang giao (2 câu), Q2 mở không hạn (1 câu, chưa ai làm), Q3 chưa tới giờ mở, Q4 đã quá hạn
insert into quizzes (id, academy_id, title, starts_at, due_at, created_by) values
  ('70000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', 'Q1', '2026-05-01 00:00+00', now() + interval '10 days', '00000000-0000-0000-0000-0000000000a2'),
  ('70000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-00000000000a', 'Q2', null, null, '00000000-0000-0000-0000-0000000000a2'),
  ('70000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-00000000000a', 'Q3', now() + interval '1 day', null, '00000000-0000-0000-0000-0000000000a2'),
  ('70000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-00000000000a', 'Q4', '2026-01-01 00:00+00', '2026-01-05 00:00+00', '00000000-0000-0000-0000-0000000000a2');
insert into quiz_items (id, quiz_id, position, kind, payload) values
  ('71000000-0000-0000-0000-000000000001', '70000000-0000-0000-0000-000000000001', 0, 'puzzle',
   '{"fen":"6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1","moves":["d1d8"]}'),
  ('71000000-0000-0000-0000-000000000002', '70000000-0000-0000-0000-000000000001', 1, 'mcq',
   '{"question":"?","options":["a","b"],"correct":1}'),
  ('71000000-0000-0000-0000-000000000003', '70000000-0000-0000-0000-000000000002', 0, 'puzzle',
   '{"fen":"7k/6pp/8/8/8/8/8/R5K1 w - - 0 1","moves":["a1a8"]}');
-- HV 1 làm xong cả hai câu của Q1 (câu cuối lúc 05:00Z), HV 2 mới làm một câu
insert into quiz_attempts (item_id, student_id, tries, solved, score, finished_at) values
  ('71000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3', 1, true, 10, '2026-05-10 04:00+00'),
  ('71000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000a3', 1, true, 8, '2026-05-10 05:00+00'),
  ('71000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a4', 1, false, 0, '2026-05-10 04:30+00');

-- Hoạt động của study thuộc học viện A (tính) và study chung của nền tảng (không tính)
insert into studies (id, academy_id, title, visibility, created_by) values
  ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', 'Study A', 'academy', '00000000-0000-0000-0000-0000000000a2'),
  ('60000000-0000-0000-0000-000000000099', null, 'Thư viện chung', 'public', null);
insert into study_activities (id, study_id, position, kind, payload) values
  ('61000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000001', 0, 'mcq',
   '{"question":"?","options":["a","b"],"correct":1}'),
  ('61000000-0000-0000-0000-000000000099', '60000000-0000-0000-0000-000000000099', 0, 'mcq',
   '{"question":"?","options":["a","b"],"correct":1}');
insert into activity_attempts (activity_id, student_id, tries, solved, score, finished_at) values
  ('61000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3', 1, true, 10, '2026-05-10 06:00+00'),
  ('61000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-0000000000a3', 1, true, 10, '2026-05-10 06:30+00');

-- Điểm danh buổi 10/5: có mặt, trễ, vắng và có phép
insert into classrooms (id, academy_id, title, kind, starts_at, created_by) values
  ('a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', 'Lớp 10/5', 'offline',
   '2026-05-10 02:00+00', '00000000-0000-0000-0000-0000000000a2');
insert into classroom_attendance (classroom_id, student_id, status) values
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3', 'present'),
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a4', 'late'),
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a5', 'absent'),
  ('a0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1', 'excused');

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

-- ── Số liệu theo ngày: owner ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select is((select count(*)::int from public.academy_daily_stats('10000000-0000-0000-0000-00000000000a', '2026-05-09', '2026-05-11')),
  3, 'owner: một dòng cho mỗi ngày trong khoảng (kể cả ngày trống)');
select is((select attempts from public.academy_daily_stats('10000000-0000-0000-0000-00000000000a', '2026-05-09', '2026-05-11') where on_date = '2026-05-10'),
  5, '10/5 (VN): 1 bài tập + 3 câu quiz + 1 hoạt động study học viện; study chung và lượt chưa xong không tính');
select is((select attempts from public.academy_daily_stats('10000000-0000-0000-0000-00000000000a', '2026-05-09', '2026-05-11') where on_date = '2026-05-11'),
  1, '18:00Z là 01:00 ngày 11/5 theo múi giờ VN');
select is((select attempts + attendance_total + quiz_completions from public.academy_daily_stats('10000000-0000-0000-0000-00000000000a', '2026-05-09', '2026-05-11') where on_date = '2026-05-09'),
  0, 'ngày không có hoạt động trả 0');
select is((select attendance_present::text || '/' || attendance_total::text from public.academy_daily_stats('10000000-0000-0000-0000-00000000000a', '2026-05-09', '2026-05-11') where on_date = '2026-05-10'),
  '2/3', 'điểm danh: có mặt + trễ = 2 trên 3, không tính có phép');
select is((select quiz_completions from public.academy_daily_stats('10000000-0000-0000-0000-00000000000a', '2026-05-09', '2026-05-11') where on_date = '2026-05-10'),
  1, 'quiz hoàn thành: HV 1 xong đủ 2 câu, HV 2 mới 1 câu');
select is((select attempts from public.academy_daily_stats('10000000-0000-0000-0000-00000000000a', '2026-05-10', '2026-05-10', 'UTC')),
  6, 'múi giờ UTC: cả hai lượt bài tập nằm trong ngày 10/5');
select throws_ok($$ select * from public.academy_daily_stats('10000000-0000-0000-0000-00000000000a', '2026-01-01', '2026-05-11') $$,
  '22023', null, 'khoảng dài quá 93 ngày bị từ chối');
select throws_ok($$ select * from public.academy_daily_stats('10000000-0000-0000-0000-00000000000a', '2026-05-11', '2026-05-09') $$,
  '22023', null, 'ngày kết thúc trước ngày bắt đầu bị từ chối');
select throws_ok($$ select * from public.academy_daily_stats('10000000-0000-0000-0000-00000000000a', '2026-05-09', '2026-05-11', 'Khong/CoThat') $$,
  '22023', null, 'múi giờ không tồn tại bị từ chối');

-- ── Số liệu theo ngày: các vai khác ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select is((select count(*)::int from public.academy_daily_stats('10000000-0000-0000-0000-00000000000a', '2026-05-09', '2026-05-11')),
  3, 'coach cũng xem được');
select pg_temp.login('00000000-0000-0000-0000-0000000000a3');
select is((select count(*)::int from public.academy_daily_stats('10000000-0000-0000-0000-00000000000a', '2026-05-09', '2026-05-11')),
  0, 'học viên không xem được số liệu cả học viện');
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select is((select count(*)::int from public.academy_daily_stats('10000000-0000-0000-0000-00000000000a', '2026-05-09', '2026-05-11')),
  0, 'owner học viện khác không xem được');
select pg_temp.logout();
set local role anon;
select throws_ok($$ select * from public.academy_daily_stats('10000000-0000-0000-0000-00000000000a', '2026-05-09', '2026-05-11') $$,
  '42501', null, 'anon không có quyền chạy');
select pg_temp.logout();

-- ── Bảng xếp hạng quiz ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a4');
select is((select points from public.academy_quiz_leaderboard('10000000-0000-0000-0000-00000000000a', '2026-05-01 00:00+00', '2026-06-01 00:00+00') where display_name = 'HV 1'),
  18, 'học viên trong học viện xem được; HV 1 có 18 điểm quiz');
select is((select correct::text || '/' || completed::text from public.academy_quiz_leaderboard('10000000-0000-0000-0000-00000000000a', '2026-05-01 00:00+00', '2026-06-01 00:00+00') where display_name = 'HV 1'),
  '2/1', 'HV 1: 2 câu đúng, 1 quiz làm xong');
select is((select display_name from public.academy_quiz_leaderboard('10000000-0000-0000-0000-00000000000a', '2026-05-01 00:00+00', '2026-06-01 00:00+00') limit 1),
  'HV 1', 'xếp hạng nhất là HV 1');
select is((select count(*)::int from public.academy_quiz_leaderboard('10000000-0000-0000-0000-00000000000a', '2026-06-01 00:00+00', '2026-07-01 00:00+00') where points = 0),
  3, 'ngoài khoảng thời gian: đủ 3 học viên, đều 0 điểm');
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select is((select count(*)::int from public.academy_quiz_leaderboard('10000000-0000-0000-0000-00000000000a', '2026-05-01 00:00+00', '2026-06-01 00:00+00')),
  0, 'người ngoài học viện không xem được');

-- ── Quiz đã bắt đầu ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select results_eq(
  $$ select total_quizzes, open_quizzes, started_quizzes from public.academy_quiz_started('10000000-0000-0000-0000-00000000000a') $$,
  $$ values (4, 2, 1) $$,
  'tổng 4, đang giao 2 (Q1, Q2), đã bắt đầu 1 (Q1); Q3 chưa mở, Q4 quá hạn');
select pg_temp.login('00000000-0000-0000-0000-0000000000a3');
select is((select count(*)::int from public.academy_quiz_started('10000000-0000-0000-0000-00000000000a')),
  0, 'học viên không xem được tỉ lệ quiz đã bắt đầu');

select * from finish();
rollback;
