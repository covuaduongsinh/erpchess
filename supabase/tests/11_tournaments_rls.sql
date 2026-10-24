-- Kiểm thử RLS Giai đoạn 10a: giải đấu do staff tạo, học viên chỉ tự đăng ký giải công khai chưa
-- bắt đầu, vòng/cặp đấu chỉ server ghi, thành viên xem được ván giải, học viện khác không thấy.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(12);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a2', 'coach.a@test.local', '{"display_name":"Coach A"}'),
  ('00000000-0000-0000-0000-0000000000a3', 'hv1@students.erpchess.local', '{"display_name":"HV 1","username":"hv1"}'),
  ('00000000-0000-0000-0000-0000000000a4', 'hv2@students.erpchess.local', '{"display_name":"HV 2","username":"hv2"}'),
  ('00000000-0000-0000-0000-0000000000a7', 'hv3@students.erpchess.local', '{"display_name":"HV 3","username":"hv3"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'owner.b@test.local', '{"display_name":"Owner B"}');
insert into academies (id, name, slug) values
  ('10000000-0000-0000-0000-00000000000a', 'Học viện A', 'hv-a'),
  ('10000000-0000-0000-0000-00000000000b', 'Học viện B', 'hv-b');
insert into memberships (academy_id, user_id, role) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a2', 'coach'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', 'student'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a4', 'student'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a7', 'student'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'owner');

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

select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select lives_ok($$
  insert into tournaments (id, academy_id, title, created_by) values
    ('d0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', 'Giải kín', '00000000-0000-0000-0000-0000000000a2'),
    ('d0000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-00000000000a', 'Giải mở', '00000000-0000-0000-0000-0000000000a2');
  update tournaments set is_public = true where id = 'd0000000-0000-0000-0000-000000000002';
  insert into tournament_players (tournament_id, player_id) values
    ('d0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a3'),
    ('d0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a4')
$$, 'HLV tạo giải và thêm người chơi');
select throws_ok($$
  insert into tournament_players (tournament_id, player_id) values
    ('d0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000b1')
$$, '42501', null, 'không thêm người ngoài học viện');

select pg_temp.login('00000000-0000-0000-0000-0000000000a7');
select throws_ok($$
  insert into tournaments (academy_id, title, created_by) values
    ('10000000-0000-0000-0000-00000000000a', 'X', '00000000-0000-0000-0000-0000000000a7')
$$, '42501', null, 'học viên không tạo giải');
select lives_ok($$
  insert into tournament_players (tournament_id, player_id) values
    ('d0000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000a7')
$$, 'học viên tự đăng ký giải công khai');
select throws_ok($$
  insert into tournament_players (tournament_id, player_id) values
    ('d0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a7')
$$, '42501', null, 'không tự đăng ký giải kín');
select isnt_empty($$
  delete from tournament_players
  where tournament_id = 'd0000000-0000-0000-0000-000000000002' and player_id = '00000000-0000-0000-0000-0000000000a7'
  returning player_id
$$, 'học viên tự rút khỏi giải chưa bắt đầu');
select is_empty($$ update tournaments set title = 'Đổi' where id = 'd0000000-0000-0000-0000-000000000001' returning id $$,
  'học viên không sửa giải');
select throws_ok($$
  insert into tournament_rounds (tournament_id, round) values ('d0000000-0000-0000-0000-000000000001', 1)
$$, '42501', null, 'học viên không tự tạo vòng');

select pg_temp.logout();
update tournaments set status = 'active', current_round = 1 where id = 'd0000000-0000-0000-0000-000000000001';
insert into games (academy_id, tournament_id, round, board_no, white_id, black_id, fen, status, result, reason, created_by)
values ('10000000-0000-0000-0000-00000000000a', 'd0000000-0000-0000-0000-000000000001', 1, 1,
        '00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a4',
        'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'finished', '1-0', 'resign',
        '00000000-0000-0000-0000-0000000000a2');

select pg_temp.login('00000000-0000-0000-0000-0000000000a7');
select is((select count(*)::int from games where tournament_id = 'd0000000-0000-0000-0000-000000000001'), 1,
  'thành viên xem được ván giải đã xong');
select is((select count(*)::int from tournaments where id::text like 'd0000000-%'), 2, 'thành viên thấy các giải của học viện');

select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select is_empty($$ update tournaments set title = 'Đổi' where id = 'd0000000-0000-0000-0000-000000000001' returning id $$,
  'giải đã bắt đầu thì không sửa thiết lập');

select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select is_empty($$ select * from tournaments where id::text like 'd0000000-%' $$, 'học viện khác không thấy giải');

select pg_temp.logout();
select * from finish();
rollback;
