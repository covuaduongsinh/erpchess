-- Kiểm thử RLS Giai đoạn 6a (study, hoạt động, collection, lần làm, media). Chạy trong transaction, ROLLBACK cuối.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(21);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner.a@test.local', '{"display_name":"Owner A"}'),
  ('00000000-0000-0000-0000-0000000000a2', 'coach.a@test.local', '{"display_name":"Coach A"}'),
  ('00000000-0000-0000-0000-0000000000a7', 'coach2.a@test.local', '{"display_name":"Coach A2"}'),
  ('00000000-0000-0000-0000-0000000000a3', 'hv1@students.erpchess.local', '{"display_name":"HV 1","username":"hv1"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'owner.b@test.local', '{"display_name":"Owner B"}');

insert into academies (id, name, slug) values
  ('10000000-0000-0000-0000-00000000000a', 'Học viện A', 'hv-a'),
  ('10000000-0000-0000-0000-00000000000b', 'Học viện B', 'hv-b');
insert into memberships (academy_id, user_id, role) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'owner'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a2', 'coach'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a7', 'coach'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', 'student'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'owner');

-- Thư viện chung của nền tảng (chỉ service role/postgres ghi)
insert into studies (id, academy_id, title, visibility) values
  ('60000000-0000-0000-0000-000000000099', null, 'Thư viện chung', 'public');

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

-- ── Coach soạn ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select lives_ok($$
  insert into studies (id, academy_id, title, visibility, created_by) values
    ('60000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', 'Riêng', 'private', '00000000-0000-0000-0000-0000000000a2'),
    ('60000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-00000000000a', 'Học viện', 'academy', '00000000-0000-0000-0000-0000000000a2')
$$, 'coach tạo study riêng và study học viện');
select throws_ok($$
  insert into studies (academy_id, title, created_by)
  values ('10000000-0000-0000-0000-00000000000a', 'Giả danh', '00000000-0000-0000-0000-0000000000a1')
$$, '42501', null, 'không tạo study đứng tên người khác');
select throws_ok($$
  insert into studies (academy_id, title, visibility, created_by)
  values (null, 'Lén vào thư viện chung', 'public', '00000000-0000-0000-0000-0000000000a2')
$$, '42501', null, 'không tạo study của nền tảng');
select lives_ok($$
  insert into study_activities (id, study_id, position, kind, payload) values
    ('61000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002', 0, 'mcq',
     '{"question":"?","options":["a","b"],"correct":1}')
$$, 'coach thêm hoạt động vào study của mình');
select throws_ok($$
  insert into study_activities (study_id, position, kind, payload)
  values ('60000000-0000-0000-0000-000000000002', 1, 'html', '{"html":"<b>"}')
$$, '23514', null, 'loại hoạt động lạ bị chặn');

-- ── Coach khác: đọc study học viện, không sửa được ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a7');
select is((select count(*)::int from studies where academy_id is not null), 1, 'coach khác chỉ thấy study học viện, không thấy study riêng');
select is(
  (select count(*)::int from study_activities where study_id::text like '60000000-%'), 1, 'coach khác đọc hoạt động của study học viện');
update studies set title = 'Sửa trộm' where id = '60000000-0000-0000-0000-000000000002';
select is((select title from studies where id = '60000000-0000-0000-0000-000000000002'), 'Học viện', 'coach khác không sửa được study của người khác');
select throws_ok($$
  insert into study_activities (study_id, position, kind, payload)
  values ('60000000-0000-0000-0000-000000000002', 5, 'explanation', '{"body":"x"}')
$$, '42501', null, 'coach khác không thêm hoạt động');

-- ── Owner sửa được mọi study của học viện ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
update studies set title = 'Owner sửa' where id = '60000000-0000-0000-0000-000000000002';
select is((select title from studies where id = '60000000-0000-0000-0000-000000000002'), 'Owner sửa', 'owner sửa study của coach');

-- ── Học viên ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a3');
-- Chỉ đếm study của bài test (thư viện chung thật có thể đã có dữ liệu)
select is((select count(*)::int from studies where id::text like '60000000-%'), 2, 'học viên thấy study học viện và thư viện chung');
select throws_ok($$
  insert into activity_attempts (activity_id, student_id, solved, score)
  values ('61000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3', true, 999)
$$, '42501', null, 'học viên không tự ghi lần làm');
select throws_ok($$
  insert into studies (academy_id, title, created_by)
  values ('10000000-0000-0000-0000-00000000000a', 'HV', '00000000-0000-0000-0000-0000000000a3')
$$, '42501', null, 'học viên không tạo study');

-- ── Học viện khác ──
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select is((select count(*)::int from studies where id::text like '60000000-%'), 1, 'học viện B chỉ thấy thư viện chung');

-- ── Hàm chấm bài (service role) ──
select pg_temp.logout();
select is(
  (select kind from activity_for_student('61000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3')),
  'mcq', 'học viên học viện A lấy được hoạt động để chấm');
select is_empty($$
  select * from activity_for_student('61000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1')
$$, 'người ngoài học viện không lấy được hoạt động');
select pg_temp.login('00000000-0000-0000-0000-0000000000a3');
select throws_ok($$
  select * from activity_for_student('61000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3')
$$, '42501', null, 'người dùng thường không gọi được hàm chấm bài');

-- ── Collection ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
-- Hai lệnh riêng như client gửi: hàm kiểm quyền (stable) không thấy dòng chèn trong cùng một lệnh
select lives_ok($$
  insert into study_collections (id, academy_id, name, created_by)
  values ('62000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', 'Nhập môn', '00000000-0000-0000-0000-0000000000a2')
$$, 'coach tạo collection');
select lives_ok($$
  insert into study_collection_items (collection_id, study_id)
  values ('62000000-0000-0000-0000-000000000001', '60000000-0000-0000-0000-000000000002')
$$, 'coach thêm study vào collection');

-- ── Media ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select lives_ok($$
  insert into storage.objects (bucket_id, name, owner)
  values ('study-media', '10000000-0000-0000-0000-00000000000a/60000000-0000-0000-0000-000000000002/a.mp4', '00000000-0000-0000-0000-0000000000a2')
$$, 'coach tải media vào thư mục học viện mình');
select throws_ok($$
  insert into storage.objects (bucket_id, name, owner)
  values ('study-media', '10000000-0000-0000-0000-00000000000b/x/a.mp4', '00000000-0000-0000-0000-0000000000a2')
$$, '42501', null, 'không tải vào thư mục học viện khác');

select pg_temp.logout();
select * from finish();
rollback;
