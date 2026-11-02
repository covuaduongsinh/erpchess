begin;
select plan(12);

select has_table('public', 'masterbase_games', 'có bảng masterbase_games');
select has_table('public', 'masterbase_positions', 'có bảng masterbase_positions');
select has_function('public', 'search_masterbase', array['text', 'integer', 'integer', 'integer', 'integer', 'boolean'], 'có hàm search_masterbase (kèm p_include_engines)');
select ok(
  not has_function_privilege('anon', 'public.search_masterbase(text, integer, integer, integer, integer, boolean)', 'execute'),
  'khách chưa đăng nhập không tìm được'
);

insert into public.masterbase_games (id, white, black, white_elo, black_elo, result, date, ply_count, pgn, source) values
  (900000001, 'An', 'Bình', 2610, 2550, '1-0', '2026.10.01', 6, '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 1-0', 'thử'),
  (900000002, 'Chi', 'Dũng', null, null, '1/2-1/2', '', 3, '1. d4 d5 2. c4 *', 'thử');
-- Ván engine: TCEC (event/site) và Elo > 3000 (cột sinh is_engine)
insert into public.masterbase_games (id, white, black, white_elo, black_elo, result, event, site, date, ply_count, pgn, source) values
  (900000003, 'Stash 37.24', 'c4ke 3.0', 3244, 3250, '1/2-1/2', 'TCEC Season 30 - HCE', 'tcec-chess.com', '2026.10.02', 6, '1. e4 e5 *', 'thử'),
  (900000004, 'Eng A', 'Eng B', 2900, 2950, '1-0', 'Giải', 'https://lichess.org/broadcast/tcec-s29/x', '2026.10.03', 6, '1. e4 e5 *', 'thử'),
  (900000005, 'Hikaru', 'Magnus', 2838, 3001, '1-0', 'Blitz', 'x', '2026.10.04', 6, '1. e4 e5 *', 'thử');
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


select is(
  (select array_agg(id order by id) from public.masterbase_games where is_engine and id >= 900000001),
  array[900000003, 900000004, 900000005]::bigint[],
  'is_engine: TCEC ở event, "tcec" ở site, hoặc Elo > 3000; ván người (Elo 2610, Elo rỗng) thì không'
);
select is(
  (select array_agg(id order by id) from public.search_masterbase() where id >= 900000001),
  array[900000001, 900000002]::bigint[],
  'mặc định ẩn ván engine: chỉ còn 2 ván người'
);
select is(
  (select count(*)::int from public.search_masterbase(null, null, null, 20, 0, true) where id >= 900000001),
  5,
  'p_include_engines = true gồm cả ván engine'
);
select is(
  (select count(*)::int from public.search_masterbase(null, null, null, 20, 0, null) where id >= 900000001),
  2,
  'p_include_engines = null coi như false'
);
select is(
  (select count(*)::int from public.search_masterbase(null, null, 2500, 20, 0, false) where id >= 900000001),
  1,
  'bộ lọc Elo vẫn hoạt động cùng lọc engine'
);
select throws_ok(
  $$ insert into public.masterbase_games (id, pgn, source, is_engine) values (900000009, '1. e4 *', 'thử', true) $$,
  '428C9', null, 'is_engine là cột sinh, không ghi được'
);

select * from finish();
rollback;
