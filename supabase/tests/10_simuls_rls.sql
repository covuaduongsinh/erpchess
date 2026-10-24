-- Kiểm thử Giai đoạn 9c (Simul): chỉ staff tạo, chủ simul phải là staff, chỉ chủ simul/owner bắt
-- đầu, bắt đầu thì mọi bàn active, mọi bàn xong thì simul kết thúc.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(10);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a2', 'coach.a@test.local', '{"display_name":"Coach A"}'),
  ('00000000-0000-0000-0000-0000000000a6', 'coach2.a@test.local', '{"display_name":"Coach A2"}'),
  ('00000000-0000-0000-0000-0000000000a3', 'hv1@students.erpchess.local', '{"display_name":"HV 1","username":"hv1"}'),
  ('00000000-0000-0000-0000-0000000000a4', 'hv2@students.erpchess.local', '{"display_name":"HV 2","username":"hv2"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'owner.b@test.local', '{"display_name":"Owner B"}');
insert into academies (id, name, slug) values
  ('10000000-0000-0000-0000-00000000000a', 'Học viện A', 'hv-a'),
  ('10000000-0000-0000-0000-00000000000b', 'Học viện B', 'hv-b');
insert into memberships (academy_id, user_id, role) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a2', 'coach'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a6', 'coach'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a3', 'student'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a4', 'student'),
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
  insert into simuls (id, academy_id, title, host_id, created_by) values
    ('c0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-00000000000a', 'Simul',
     '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a2');
  insert into games (academy_id, simul_id, white_id, black_id, fen, status, created_by) values
    ('10000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a2',
     '00000000-0000-0000-0000-0000000000a3', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'pending',
     '00000000-0000-0000-0000-0000000000a2'),
    ('10000000-0000-0000-0000-00000000000a', 'c0000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a2',
     '00000000-0000-0000-0000-0000000000a4', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'pending',
     '00000000-0000-0000-0000-0000000000a2')
$$, 'HLV tạo simul và hai bàn');
select throws_ok($$
  insert into simuls (academy_id, title, host_id, created_by) values
    ('10000000-0000-0000-0000-00000000000a', 'X', '00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a2')
$$, '42501', null, 'chủ simul phải là HLV/owner');

select pg_temp.login('00000000-0000-0000-0000-0000000000a3');
select throws_ok($$
  insert into simuls (academy_id, title, host_id, created_by) values
    ('10000000-0000-0000-0000-00000000000a', 'X', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a3')
$$, '42501', null, 'học viên không tạo simul');
select is((select count(*)::int from simuls), 1, 'học viên thấy simul của học viện');
select throws_ok($$ select start_simul('c0000000-0000-0000-0000-000000000001') $$, '42501', null,
  'học viên không bắt đầu simul');

select pg_temp.login('00000000-0000-0000-0000-0000000000a6');
select throws_ok($$ select start_simul('c0000000-0000-0000-0000-000000000001') $$, '42501', null,
  'HLV khác không bắt đầu simul của người khác');

select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select lives_ok($$ select start_simul('c0000000-0000-0000-0000-000000000001') $$, 'chủ simul bắt đầu');
select is((select count(*)::int from games where simul_id = 'c0000000-0000-0000-0000-000000000001' and status = 'active'), 2,
  'mọi bàn chuyển sang đang diễn ra');

select pg_temp.logout();
update games set status = 'finished', result = '1-0', reason = 'resign'
  where simul_id = 'c0000000-0000-0000-0000-000000000001';
select is((select status from simuls where id = 'c0000000-0000-0000-0000-000000000001'), 'finished',
  'mọi bàn xong thì simul kết thúc');

select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select is_empty($$ select * from simuls $$, 'học viện khác không thấy simul');

select pg_temp.logout();
select * from finish();
rollback;
