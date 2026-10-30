begin;
select plan(6);

select has_table('public', 'masterbase_games', 'có bảng masterbase_games');
select has_table('public', 'masterbase_positions', 'có bảng masterbase_positions');
select has_function('public', 'search_masterbase', array['text', 'integer', 'integer', 'integer', 'integer'], 'có hàm search_masterbase');
select ok(
  not has_function_privilege('anon', 'public.search_masterbase(text, integer, integer, integer, integer)', 'execute'),
  'khách chưa đăng nhập không tìm được'
);

insert into public.masterbase_games (id, white, black, white_elo, black_elo, result, date, ply_count, pgn, source) values
  (900000001, 'An', 'Bình', 2610, 2550, '1-0', '2026.10.01', 6, '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 1-0', 'thử'),
  (900000002, 'Chi', 'Dũng', null, null, '1/2-1/2', '', 3, '1. d4 d5 2. c4 *', 'thử');
insert into public.masterbase_positions values
  ('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq', 900000001);

select is(
  (select count(*)::int from public.search_masterbase('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq')),
  1,
  'lọc theo thế cờ'
);
select is(
  (select count(*)::int from public.search_masterbase(null, null, 2500) where id >= 900000001),
  1,
  'Elo cả hai bên trên 2500'
);

select * from finish();
rollback;
