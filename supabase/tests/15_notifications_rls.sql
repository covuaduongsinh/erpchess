-- Kiểm thử Giai đoạn 12b: thông báo tự phát (hoá đơn, quiz), chỉ người nhận đọc, owner xem nhật
-- ký, tắt loại thì không gửi, nhắc đóng phí mỗi mốc một lần, đánh dấu đã đọc.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(16);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner.a@test.local', '{"display_name":"Owner A"}'),
  ('00000000-0000-0000-0000-0000000000a3', 'hv1@students.erpchess.local', '{"display_name":"HV 1","username":"hv1"}'),
  ('00000000-0000-0000-0000-0000000000a4', 'hv2@students.erpchess.local', '{"display_name":"HV 2","username":"hv2"}'),
  ('00000000-0000-0000-0000-0000000000a5', 'parent.a@test.local', '{"display_name":"PH 1"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'owner.b@test.local', '{"display_name":"Owner B"}');
insert into academies (id, name, slug) values
  ('10000000-0000-0000-0000-00000000000a', 'Học viện A', 'hv-a'),
  ('10000000-0000-0000-0000-00000000000b', 'Học viện B', 'hv-b');
insert into memberships (academy_id, user_id, role) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'owner'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', 'student'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a4', 'student'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a5', 'parent'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'owner');
insert into parent_links (academy_id, parent_id, student_id) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000a3');
insert into groups (id, academy_id, name) values
  ('40000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', 'Lớp A');
insert into group_members (group_id, student_id) values
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3'),
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a4');

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

-- ── Hoá đơn mới → học viên + phụ huynh ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
create temp table inv1 as
  select create_invoice('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', null, 'VND',
                        null, '2026-12-01', null, '[{"description":"Học phí","quantity":1,"unit_amount":500000}]') as id;
grant select on inv1 to authenticated;
select is(
  (select array_agg(user_id::text order by user_id)::text from notifications where category = 'invoice'),
  '{00000000-0000-0000-0000-0000000000a3,00000000-0000-0000-0000-0000000000a5}',
  'hoá đơn mới báo cho học viên và phụ huynh, không báo người tạo');
select matches(
  (select body from notifications where category = 'invoice' limit 1), '^500\.000 VND · hạn 01/12/2026$',
  'nội dung có số tiền và hạn');
select is((select count(*)::int from notifications), 2, 'owner xem được nhật ký học viện');

select pg_temp.login('00000000-0000-0000-0000-0000000000a3');
select is((select count(*)::int from notifications), 1, 'học viên chỉ thấy thông báo của mình');
select pg_temp.login('00000000-0000-0000-0000-0000000000a4');
select is((select count(*)::int from notifications), 0, 'học viên khác không thấy');
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select is((select count(*)::int from notifications), 0, 'owner học viện khác không thấy');

-- ── Học viên không tự ghi / sửa ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a3');
select throws_ok($$
  insert into notifications (academy_id, user_id, category, title)
  values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a4', 'system', 'Giả')
$$, '42501', null, 'học viên không chèn thông báo');
select throws_ok($$ select run_fee_reminders_now('10000000-0000-0000-0000-00000000000a') $$,
  '42501', null, 'học viên không chạy nhắc phí');

-- ── Quiz giao cho lớp ──
select pg_temp.logout();
insert into quizzes (id, academy_id, title) values
  ('50000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', 'Quiz chiến thuật');
insert into quiz_targets (quiz_id, group_id) values
  ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001');
select is(
  (select count(*)::int from notifications where category = 'quiz'), 3,
  'quiz giao cho lớp báo 2 học viên + phụ huynh của HV 1');
select is(
  (select link from notifications where category = 'quiz' limit 1),
  '/a/hv-a/quizzes/50000000-0000-0000-0000-000000000001', 'link tới trang quiz');

-- ── Tắt loại thì không gửi ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
insert into notification_settings (academy_id, category, enabled)
  values ('10000000-0000-0000-0000-00000000000a', 'invoice', false);
select create_invoice('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a4', null, 'VND',
                      null, null, null, '[{"description":"Sách","quantity":1,"unit_amount":100000}]');
select is((select count(*)::int from notifications where category = 'invoice'), 2, 'loại đã tắt không gửi thêm');

-- ── Nhắc đóng phí ──
select pg_temp.logout();
select is(private.run_fee_reminders('10000000-0000-0000-0000-00000000000a', '2026-11-28'), 1, 'nhắc 3 ngày trước hạn');
select is(private.run_fee_reminders('10000000-0000-0000-0000-00000000000a', '2026-11-28'), 0, 'không nhắc lại cùng mốc');
select is(private.run_fee_reminders('10000000-0000-0000-0000-00000000000a', '2026-11-29'), 0, 'ngày không thuộc quy tắc thì không nhắc');

-- ── Đánh dấu đã đọc ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a3');
select is(mark_notifications_read(), 3, 'đánh dấu đã đọc hoá đơn, quiz, nhắc phí');
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select is(
  (select sent || '/' || read from notification_stats where category = 'invoice_reminder'), '2/1',
  'thống kê nhật ký: nhắc phí gửi 2, đọc 1');

select * from finish();
rollback;
