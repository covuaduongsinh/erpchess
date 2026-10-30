begin;
select plan(6);

select has_column('public', 'profiles', 'chesscom_username', 'profiles có chesscom_username');
select has_column('public', 'profiles', 'lichess_username', 'profiles có lichess_username');
select has_column('public', 'game_databases', 'sync_source', 'game_databases có sync_source');
select has_column('public', 'game_databases', 'sync_cursor', 'game_databases có sync_cursor');

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d1', 'sync.owner@test.local');
insert into public.academies (id, name, slug, created_by)
  values ('00000000-0000-0000-0000-0000000000d9', 'CLB Đồng bộ', 'clb-dong-bo', '00000000-0000-0000-0000-0000000000d1');

select throws_ok(
  $$insert into public.game_databases (academy_id, name, visibility, sync_source, created_by)
    values ('00000000-0000-0000-0000-0000000000d9', 'Chia sẻ', 'academy', 'lichess', '00000000-0000-0000-0000-0000000000d1')$$,
  '23514',
  null,
  'CSDL đồng bộ phải riêng tư'
);
select throws_ok(
  $$update public.profiles set chesscom_username = 'có dấu' where id = '00000000-0000-0000-0000-0000000000d1'$$,
  '23514',
  null,
  'username Chess.com phải đúng định dạng'
);

select * from finish();
rollback;
