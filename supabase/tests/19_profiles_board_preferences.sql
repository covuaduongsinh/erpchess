begin;
select plan(4);

-- 1. Cột board_preferences tồn tại
select has_column('public', 'profiles', 'board_preferences', 'profiles có cột board_preferences');

-- 2. Mặc định là object rỗng
select col_default_is(
  'public', 'profiles', 'board_preferences', '''{}''::jsonb',
  'board_preferences mặc định là {}'
);

-- 3. Nhận object hợp lệ
insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000098', 'board.pref@test.local');
select lives_ok(
  $$update public.profiles set board_preferences = '{"theme":"wood","pieceSet":"spatial"}'
    where id = '00000000-0000-0000-0000-000000000098'$$,
  'board_preferences nhận object'
);

-- 4. Từ chối giá trị không phải object
select throws_ok(
  $$update public.profiles set board_preferences = '["wood"]'
    where id = '00000000-0000-0000-0000-000000000098'$$,
  '23514',
  null,
  'board_preferences phải là object'
);

select * from finish();
rollback;
