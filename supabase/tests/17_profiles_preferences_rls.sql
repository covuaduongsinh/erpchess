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
select col_default_is('public', 'profiles', 'timezone', '''Asia/Ho_Chi_Minh''::text', 'timezone mặc định Asia/Ho_Chi_Minh');
select col_default_is('public', 'profiles', 'move_notation', '''letters''::text', 'move_notation mặc định letters');

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
