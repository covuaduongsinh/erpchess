begin;
select plan(2);

select has_column('public', 'academies', 'board_defaults', 'academies có board_defaults');
select matches(
  (select column_default from information_schema.columns
    where table_schema = 'public' and table_name = 'academies' and column_name = 'board_defaults'),
  '^''[{][}]''(::jsonb)?$',
  'mặc định là {}'
);

select * from finish();
rollback;
