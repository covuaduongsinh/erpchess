-- Kiểm thử migration 20261102000042: email_log (RLS) và notifications.emailed_at.
-- Chạy trong transaction, ROLLBACK cuối. Chưa chạy trên Supabase thật: cần áp migration trước.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(13);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner.a@test.local', '{"display_name":"Owner A"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'coach.a@test.local', '{"display_name":"Coach A"}'),
  ('00000000-0000-0000-0000-0000000000a3', 'hv1@students.erpchess.local', '{"display_name":"HV 1","username":"hv1"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'owner.b@test.local', '{"display_name":"Owner B"}');
insert into academies (id, name, slug) values
  ('10000000-0000-0000-0000-00000000000a', 'Học viện A', 'hv-a'),
  ('10000000-0000-0000-0000-00000000000b', 'Học viện B', 'hv-b');
insert into memberships (academy_id, user_id, role) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'owner'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a2', 'coach'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', 'student'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'owner');

insert into notifications (id, academy_id, user_id, category, title) values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', 'quiz', 'Quiz mới');
insert into email_log (academy_id, kind, to_email, subject, status, notification_id) values
  ('10000000-0000-0000-0000-00000000000a', 'quiz_assigned', 'phu.huynh@example.com', 'Quiz mới', 'sent', '20000000-0000-0000-0000-000000000001'),
  ('10000000-0000-0000-0000-00000000000a', 'invite_coach', 'hlv@example.com', 'Lời mời', 'failed', null),
  ('10000000-0000-0000-0000-00000000000b', 'test', 'b@example.com', 'Thử', 'sent', null);

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

-- ── Ràng buộc ──
select throws_ok($$ insert into email_log (academy_id, kind, to_email, status) values ('10000000-0000-0000-0000-00000000000a', 'khac', 'a@b.vn', 'sent') $$,
  '23514', null, 'kind lạ bị từ chối');
select throws_ok($$ insert into email_log (academy_id, kind, to_email, status) values ('10000000-0000-0000-0000-00000000000a', 'test', 'a@b.vn', 'dang-gui') $$,
  '23514', null, 'status lạ bị từ chối');
select is((select emailed_at from notifications where id = '20000000-0000-0000-0000-000000000001'), null, 'thông báo mới chưa có emailed_at');

-- ── RLS: chỉ owner đọc ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select is((select count(*)::int from email_log), 2, 'owner A chỉ thấy nhật ký học viện A');
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select is((select count(*)::int from email_log), 0, 'coach không đọc được nhật ký (có email người nhận)');
select pg_temp.login('00000000-0000-0000-0000-0000000000a3');
select is((select count(*)::int from email_log), 0, 'học viên không đọc được');
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select is((select count(*)::int from email_log), 1, 'owner B chỉ thấy nhật ký học viện B');

-- ── Không ai ngoài service role ghi được ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select throws_ok($$ insert into email_log (academy_id, kind, to_email, status) values ('10000000-0000-0000-0000-00000000000a', 'test', 'a@b.vn', 'sent') $$,
  '42501', null, 'owner không tự ghi nhật ký');
-- Không có policy sửa/xoá: câu lệnh chạy được nhưng không đụng dòng nào
select lives_ok($$ update email_log set status = 'sent' $$, 'owner chạy update nhưng không có dòng nào bị sửa');
select lives_ok($$ delete from email_log $$, 'owner chạy delete nhưng không có dòng nào bị xoá');
select pg_temp.logout();
select is((select count(*)::int from email_log where status = 'failed'), 1, 'nhật ký không bị sửa');
select is((select count(*)::int from email_log), 3, 'nhật ký không bị xoá');
set local role anon;
select is((select count(*)::int from email_log), 0, 'anon không thấy dòng nào');
select pg_temp.logout();

select * from finish();
rollback;
