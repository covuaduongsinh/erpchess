begin;
select plan(7);

select has_table('public', 'match_queue', 'có bảng match_queue');
select has_function('public', 'quick_pair', array['uuid', 'integer', 'integer'], 'có hàm quick_pair');
select has_function('public', 'cancel_quick_pair', array['uuid'], 'có hàm cancel_quick_pair');

-- Khoảng chênh Elo nới rộng theo thời gian chờ, tối đa 600
select is(private.match_window(interval '0 seconds'), 100, 'chờ 0 giây: ±100');
select is(private.match_window(interval '25 seconds'), 200, 'chờ 25 giây: ±200');
select is(private.match_window(interval '10 minutes'), 600, 'chờ lâu: tối đa ±600');

-- Không đăng nhập thì không được xếp hàng
select throws_ok(
  $$select public.quick_pair('00000000-0000-0000-0000-000000000001', 300000, 0)$$,
  '42501',
  null,
  'chưa đăng nhập thì bị từ chối'
);

select * from finish();
rollback;
