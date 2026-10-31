begin;
select plan(2);

select has_column('public', 'academies', 'board_defaults', 'academies có board_defaults');
select col_default_is('public', 'academies', 'board_defaults', '''{}''::jsonb', 'mặc định là {}');

select * from finish();
rollback;
