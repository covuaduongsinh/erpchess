begin;
select plan(2);

select has_column('public', 'academies', 'activity_defaults', 'academies có activity_defaults');
select matches(
  (select column_default from information_schema.columns
    where table_schema = 'public' and table_name = 'academies' and column_name = 'activity_defaults'),
  '^''[{][}]''(::jsonb)?$',
  'mặc định là {}'
);

select * from finish();
rollback;
