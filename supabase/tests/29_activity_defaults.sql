begin;
select plan(2);

select has_column('public', 'academies', 'activity_defaults', 'academies có activity_defaults');
select col_default_is('public', 'academies', 'activity_defaults', '''{}''::jsonb', 'mặc định là {}');

select * from finish();
rollback;
