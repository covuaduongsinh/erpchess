begin;
select plan(5);

select has_column('public', 'academies', 'login_background_url', 'academies có login_background_url');
select has_column('public', 'academies', 'login_sections', 'academies có login_sections');
select ok(
  has_function_privilege('anon', 'public.academy_login_branding(text)', 'execute'),
  'khách chưa đăng nhập đọc được thương hiệu trang đăng nhập'
);
select is(public.academy_login_branding('khong-ton-tai-xyz'), null, 'slug không tồn tại trả null');

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000e1', 'login.owner@test.local');
select throws_ok(
  $$insert into public.academies (name, slug, created_by, login_sections)
    values ('CLB Năm mục', 'clb-nam-muc', '00000000-0000-0000-0000-0000000000e1',
            '[{"title":"1"},{"title":"2"},{"title":"3"},{"title":"4"},{"title":"5"}]')$$,
  '23514',
  null,
  'tối đa 4 mục nội dung'
);

select * from finish();
rollback;
