begin;
select plan(2);

select has_function(
  'public', 'create_challenge',
  array['uuid', 'uuid', 'text', 'integer', 'integer', 'boolean'],
  'có hàm create_challenge'
);

-- Không đăng nhập thì không được thách đấu
select throws_ok(
  $$select public.create_challenge(
    '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
    'random', 300000, 0, true
  )$$,
  '42501',
  null,
  'chưa đăng nhập thì bị từ chối'
);

select * from finish();
rollback;
