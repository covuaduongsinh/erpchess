begin;
select plan(8);

select has_table('public', 'academy_locations', 'có bảng academy_locations');
select has_column('public', 'groups', 'mode', 'groups có cột mode');
select has_column('public', 'groups', 'location_id', 'groups có cột location_id');
select col_default_is('public', 'groups', 'mode', '''online''::text', 'mode mặc định online');
select has_function('public', 'set_main_location', array['uuid'], 'có hàm set_main_location');
select ok(
  not has_function_privilege('anon', 'public.set_main_location(uuid)', 'execute'),
  'anon không gọi được set_main_location'
);

-- Giờ đóng cửa phải sau giờ mở cửa
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000c1', 'loc.owner@test.local');
insert into public.academies (id, name, slug, created_by)
  values ('00000000-0000-0000-0000-0000000000a9', 'CLB Địa điểm', 'clb-dia-diem', '00000000-0000-0000-0000-0000000000c1');
select throws_ok(
  $$insert into public.academy_locations
      (academy_id, name, country, working_days, opens_at, closes_at, contact_name, contact_phone)
    values ('00000000-0000-0000-0000-0000000000a9', 'Cơ sở 1', 'VN', '{1,2}', '18:00', '08:00', 'An', '0912345678')$$,
  '23514',
  null,
  'giờ đóng phải sau giờ mở'
);

-- Tối đa một cơ sở chính
insert into public.academy_locations
  (academy_id, name, country, working_days, opens_at, closes_at, contact_name, contact_phone, is_main)
values ('00000000-0000-0000-0000-0000000000a9', 'Cơ sở chính', 'VN', '{1}', '08:00', '18:00', 'An', '0912345678', true);
select throws_ok(
  $$insert into public.academy_locations
      (academy_id, name, country, working_days, opens_at, closes_at, contact_name, contact_phone, is_main)
    values ('00000000-0000-0000-0000-0000000000a9', 'Cơ sở chính 2', 'VN', '{1}', '08:00', '18:00', 'An', '0912345678', true)$$,
  '23505',
  null,
  'chỉ một cơ sở chính mỗi học viện'
);

select * from finish();
rollback;
