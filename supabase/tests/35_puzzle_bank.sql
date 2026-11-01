-- Kiểm thử migration 20261102000043: puzzle_bank (RLS) và search_puzzle_bank.
-- Chạy trong transaction, ROLLBACK cuối. Chưa chạy trên Supabase thật: cần áp migration trước.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(18);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'owner.a@test.local', '{"display_name":"Owner A"}');

-- 6 puzzle mẫu: chủ đề, rating, số nước khác nhau (moves = nước đối thủ + các nước xen kẽ)
insert into puzzle_bank (lichess_id, fen, moves, rating, popularity, nb_plays, themes) values
  ('p0001', 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', 'f3e5 c6e5 d2d4 e5g6', 900, 90, 500, '{fork,short,opening}'),
  ('p0002', 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', 'f3e5 c6e5 d2d4 e5g6 e4e5 g6e7 d1h5', 1200, 70, 300, '{pin,middlegame}'),
  ('p0003', 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', 'f3e5 c6e5', 1500, 50, 100, '{fork,middlegame}'),
  ('p0004', 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', 'f3e5 c6e5 d2d4 e5g6 e4e5 g6e7', 1500, 95, 800, '{fork,pin,endgame}'),
  ('p0005', 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', 'f3e5 c6e5 d2d4 e5g6', 2100, 10, 20, '{mateIn2}'),
  ('p0006', 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', 'f3e5 c6e5 d2d4 e5g6', 2600, 30, 40, '{}');

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
select throws_ok($$ insert into puzzle_bank (lichess_id, fen, moves, rating) values ('p0001', 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', 'f3e5 c6e5', 1000) $$,
  '23505', null, 'lichess_id trùng bị từ chối');
select throws_ok($$ insert into puzzle_bank (lichess_id, fen, moves, rating) values ('p9', 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', 'f3e5 c6e5', 1000) $$,
  '23514', null, 'lichess_id quá ngắn bị từ chối');
select throws_ok($$ insert into puzzle_bank (lichess_id, fen, moves, rating) values ('p9999', 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', 'f3e5 c6e5', 50) $$,
  '23514', null, 'rating ngoài 100–4000 bị từ chối');

-- ── Quyền: anon không đọc, người đăng nhập đọc, không ai ghi ──
select pg_temp.logout();
set local role anon;
select throws_ok($$ select * from search_puzzle_bank() $$, '42501', null, 'anon không gọi được search_puzzle_bank');
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select is((select count(*)::int from puzzle_bank), 6, 'người đăng nhập đọc được kho');
select throws_ok($$ insert into puzzle_bank (lichess_id, fen, moves, rating) values ('p7777', 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', 'f3e5 c6e5', 1000) $$,
  '42501', null, 'người đăng nhập không tự thêm puzzle');
select lives_ok($$ update puzzle_bank set rating = 100 $$, 'update chạy nhưng không có policy nên không đụng dòng nào');
select lives_ok($$ delete from puzzle_bank $$, 'delete chạy nhưng không có policy nên không xoá dòng nào');
select is((select count(*)::int from puzzle_bank where rating = 100), 0, 'rating không bị sửa');
select is((select count(*)::int from puzzle_bank), 6, 'kho không bị xoá');

-- ── Tìm kiếm ──
select is((select count(*)::int from search_puzzle_bank()), 6, 'không lọc: đủ 6 puzzle');
select is((select total from search_puzzle_bank() limit 1), 6::bigint, 'total = tổng số dòng khớp');
select results_eq($$ select lichess_id from search_puzzle_bank(p_limit := 3) $$,
  $$ values ('p0004'::text), ('p0001'), ('p0002') $$, 'phổ biến nhất trước (popularity giảm dần)');
select results_eq($$ select lichess_id from search_puzzle_bank(p_themes := '{fork}') order by 1 $$,
  $$ values ('p0001'::text), ('p0003'), ('p0004') $$, 'lọc một chủ đề');
select results_eq($$ select lichess_id from search_puzzle_bank(p_themes := '{fork,pin}') $$,
  $$ values ('p0004'::text) $$, 'nhiều chủ đề: phải có TẤT CẢ');
select results_eq($$ select lichess_id from search_puzzle_bank(p_rating_min := 1200, p_rating_max := 1500) order by 1 $$,
  $$ values ('p0002'::text), ('p0003'), ('p0004') $$, 'lọc khoảng rating (gồm cả hai đầu)');
select results_eq($$ select lichess_id from search_puzzle_bank(p_moves_max := 1) order by 1 $$,
  $$ values ('p0003'::text) $$, 'số nước người giải tối đa 1 (tổng 2 nước trong moves)');
select is((select count(*)::int from search_puzzle_bank(p_limit := 1000)), 6, 'p_limit bị chặn tối đa 100 (ở đây chỉ có 6 dòng)');

select pg_temp.logout();
select * from finish();
rollback;
