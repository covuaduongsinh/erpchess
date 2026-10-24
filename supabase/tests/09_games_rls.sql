-- Kiểm thử RLS Giai đoạn 9a: ván đấu chỉ staff ghép cặp, học viên không tự sửa ván, xem trực tiếp
-- ván đang diễn ra, ván đánh máy tự lưu, kênh Realtime `game:<id>`.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(14);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a2', 'coach.a@test.local', '{"display_name":"Coach A"}'),
  ('00000000-0000-0000-0000-0000000000a3', 'hv1@students.erpchess.local', '{"display_name":"HV 1","username":"hv1"}'),
  ('00000000-0000-0000-0000-0000000000a4', 'hv2@students.erpchess.local', '{"display_name":"HV 2","username":"hv2"}'),
  ('00000000-0000-0000-0000-0000000000a7', 'hv3@students.erpchess.local', '{"display_name":"HV 3","username":"hv3"}'),
  ('00000000-0000-0000-0000-0000000000a5', 'parent.a@test.local', '{"display_name":"PH 1"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'owner.b@test.local', '{"display_name":"Owner B"}');
insert into academies (id, name, slug) values
  ('10000000-0000-0000-0000-00000000000a', 'Học viện A', 'hv-a'),
  ('10000000-0000-0000-0000-00000000000b', 'Học viện B', 'hv-b');
insert into memberships (academy_id, user_id, role) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a2', 'coach'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', 'student'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a4', 'student'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a7', 'student'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a5', 'parent'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'owner');
insert into parent_links (academy_id, parent_id, student_id) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a5', '00000000-0000-0000-0000-0000000000a3');

insert into realtime.messages (topic, extension, event, payload, private)
  values ('game:b0000000-0000-0000-0000-000000000001', 'broadcast', 'state', '{}', true);

create function pg_temp.login(p_uid uuid, p_topic text default null) returns void language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('realtime.topic', coalesce(p_topic, ''), true);
end;
$$;
create function pg_temp.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end;
$$;

-- ── Ghép cặp ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select lives_ok($$
  insert into games (id, academy_id, white_id, black_id, fen, base_ms, white_ms, black_ms, rated, category, created_by)
  values ('b0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a',
          '00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a4',
          'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 180000, 180000, 180000, true, 'blitz',
          '00000000-0000-0000-0000-0000000000a2')
$$, 'HLV ghép cặp hai học viên');
select throws_ok($$
  insert into games (academy_id, white_id, black_id, fen, created_by)
  values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3',
          '00000000-0000-0000-0000-0000000000b1', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          '00000000-0000-0000-0000-0000000000a2')
$$, '42501', null, 'không ghép với người ngoài học viện');

select pg_temp.login('00000000-0000-0000-0000-0000000000a3');
select throws_ok($$
  insert into games (academy_id, white_id, black_id, fen, created_by)
  values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3',
          '00000000-0000-0000-0000-0000000000a4', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          '00000000-0000-0000-0000-0000000000a3')
$$, '42501', null, 'học viên không tự ghép cặp');
select is_empty($$
  update games set result = '1-0', status = 'finished' where id = 'b0000000-0000-0000-0000-000000000001' returning id
$$, 'học viên không tự sửa kết quả ván');
select lives_ok($$
  insert into games (academy_id, white_id, bot_elo, fen, moves, status, result, reason, created_by)
  values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', 1400,
          'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', '{e2e4}', 'finished', '0-1', 'resign',
          '00000000-0000-0000-0000-0000000000a3')
$$, 'học viên lưu ván đánh máy đã xong');
select throws_ok($$
  insert into games (academy_id, white_id, bot_elo, fen, status, rated, created_by)
  values ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', 1400,
          'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'finished', true,
          '00000000-0000-0000-0000-0000000000a3')
$$, '42501', null, 'ván đánh máy không được tính rating');

-- ── Xem ván ──
select pg_temp.login('00000000-0000-0000-0000-0000000000a7', 'game:b0000000-0000-0000-0000-000000000001');
select is((select count(*)::int from games where id = 'b0000000-0000-0000-0000-000000000001'), 1,
  'thành viên khác xem được ván đang diễn ra');
select isnt_empty($$ select 1 from realtime.messages where topic = 'game:b0000000-0000-0000-0000-000000000001' $$,
  'thành viên nghe được kênh ván đang diễn ra');

select pg_temp.logout();
update games set status = 'finished', result = '1-0', reason = 'resign', moves = '{e2e4}' where id = 'b0000000-0000-0000-0000-000000000001';

select pg_temp.login('00000000-0000-0000-0000-0000000000a7', 'game:b0000000-0000-0000-0000-000000000001');
select is((select count(*)::int from games where id = 'b0000000-0000-0000-0000-000000000001'), 0,
  'ván đã xong của người khác thì thành viên khác không xem');
select is_empty($$ select 1 from realtime.messages where topic = 'game:b0000000-0000-0000-0000-000000000001' $$,
  'không còn nghe kênh ván đã xong của người khác');

select pg_temp.login('00000000-0000-0000-0000-0000000000a4');
select is((select count(*)::int from games where id = 'b0000000-0000-0000-0000-000000000001'), 1, 'người chơi xem ván của mình');

select pg_temp.login('00000000-0000-0000-0000-0000000000a5');
select is((select count(*)::int from games where id = 'b0000000-0000-0000-0000-000000000001'), 1, 'phụ huynh xem ván của con');

select pg_temp.login('00000000-0000-0000-0000-0000000000b1', 'game:b0000000-0000-0000-0000-000000000001');
select is_empty($$ select * from games $$, 'học viện khác không thấy ván');

select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select is_empty($$ delete from games where id = 'b0000000-0000-0000-0000-000000000001' returning id $$,
  'HLV không xoá ván đã chơi');

select pg_temp.logout();
select * from finish();
rollback;
