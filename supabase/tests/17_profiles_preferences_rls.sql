begin;
select plan(7);

-- 1. Cột timezone tồn tại
select has_column('public', 'profiles', 'timezone', 'profiles có cột timezone');

-- 2. Cột move_notation tồn tại
select has_column('public', 'profiles', 'move_notation', 'profiles có cột move_notation');

-- 3. Cột country tồn tại
select has_column('public', 'profiles', 'country', 'profiles có cột country');

-- 4. Cột bio tồn tại
select has_column('public', 'profiles', 'bio', 'profiles có cột bio');

-- 5. Giá trị mặc định
-- matches() thay col_default_is: bản pgTAP khác nhau so khớp đối số ép kiểu khác nhau (cloud và self-host)
select matches(
  (select column_default from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'timezone'),
  '^''Asia/Ho_Chi_Minh''(::[a-z ]+)?$',
  'timezone mặc định Asia/Ho_Chi_Minh'
);
select matches(
  (select column_default from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'move_notation'),
  '^''letters''(::[a-z ]+)?$',
  'move_notation mặc định letters'
);

-- 6. Check constraint không cho phép move_notation sai
select throws_ok(
  $$insert into auth.users (id, email) values ('00000000-0000-0000-0000-000000000099', 'invalid.notation@test.local');
    insert into public.profiles (id, move_notation) values ('00000000-0000-0000-0000-000000000099', 'wrong_notation')$$,
  '23514',
  null,
  'move_notation chỉ nhận letters hoặc figurine'
);

select * from finish();
rollback;
