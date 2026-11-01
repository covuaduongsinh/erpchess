-- Kiểm thử migration 20261101000039: academy_stats.attempts_week gồm bài tập + quiz + hoạt động học liệu.
-- Chạy trong transaction, ROLLBACK cuối. Số liệu mẫu đã được đối chiếu bằng PGlite (bảng giả tối
-- thiểu) nhưng file này CHƯA chạy trên Supabase thật: cần áp migration 20261101000038 trước.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);

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
  ('41000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3', 1, true, now() - interval '1 hour'),
  ('41000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a4', 1, true, now() - interval '10 days'),
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
  ('71000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3', 1, true, 10, now() - interval '2 hours'),
  ('71000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000a3', 1, true, 8, now() - interval '3 hours'),
  ('71000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a4', 1, false, 0, now() - interval '10 days');

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
  ('61000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3', 1, true, 10, now() - interval '4 hours'),
  ('61000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-0000000000a3', 1, true, 10, now() - interval '5 hours');

-- Điểm danh buổi 10/5: có mặt, trễ, vắng và có phép
insert into classrooms (id, academy_id, title, kind, starts_at, created_by) values
  ('a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', 'Lớp 10/5', 'offline',
   now() - interval '6 hours', '00000000-0000-0000-0000-0000000000a2');
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

-- Cửa sổ 7 ngày lịch (VN). Lượt tính: 1 bài tập (1 giờ trước), 2 câu quiz HV 1 (2-3 giờ trước),
-- 1 hoạt động study học viện A (4 giờ trước). Không tính: bài tập/quiz cũ 10 ngày, lượt chưa xong,
-- study chung của nền tảng (5 giờ trước).
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select is((select attempts_week from public.academy_stats('10000000-0000-0000-0000-00000000000a')),
  4, 'owner: 1 bài tập + 2 câu quiz + 1 hoạt động study; lượt cũ, chưa xong và study chung không tính');
select is((select attempts_week from public.academy_stats('10000000-0000-0000-0000-00000000000a')),
  (select sum(attempts)::int from public.academy_daily_stats(
     '10000000-0000-0000-0000-00000000000a',
     (now() at time zone 'Asia/Ho_Chi_Minh')::date - 6,
     (now() at time zone 'Asia/Ho_Chi_Minh')::date)),
  'khớp tổng biểu đồ 7 ngày (academy_daily_stats)');
select results_eq($$ select students, staff, groups, batches, assignments from public.academy_stats('10000000-0000-0000-0000-00000000000a') $$,
  $$ values (3, 2, 0, 0, 1) $$, 'các cột cũ giữ nguyên ý nghĩa: 3 học viên, 2 staff, 0 nhóm, 0 batch, 1 bài tập');

select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select is((select attempts_week from public.academy_stats('10000000-0000-0000-0000-00000000000a')),
  4, 'coach cũng xem được số liệu');
select is_empty($$ select * from public.academy_stats('10000000-0000-0000-0000-00000000000b') $$,
  'coach học viện A không xem số liệu học viện B');

select pg_temp.login('00000000-0000-0000-0000-0000000000a3');
select is_empty($$ select * from public.academy_stats('10000000-0000-0000-0000-00000000000a') $$,
  'học viên không xem số liệu học viện');

select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select is((select attempts_week from public.academy_stats('10000000-0000-0000-0000-00000000000b')),
  0, 'học viện B không có lượt nào trong 7 ngày: 0 (không lẫn dữ liệu học viện A)');

set local role anon;
select throws_ok($$ select * from public.academy_stats('10000000-0000-0000-0000-00000000000a') $$,
  '42501', null, 'anon không gọi được academy_stats');

select pg_temp.logout();
select * from finish();
rollback;
