begin;
select plan(6);

select has_table('public', 'quiz_schedules', 'có bảng quiz_schedules');
select has_table('public', 'quiz_schedule_targets', 'có bảng quiz_schedule_targets');
select has_column('public', 'quizzes', 'schedule_id', 'quizzes có schedule_id');
select has_function('public', 'run_quiz_schedule_now', array['uuid'], 'có hàm run_quiz_schedule_now');
select ok(
  not has_function_privilege('authenticated', 'private.run_quiz_schedules()', 'execute'),
  'người dùng không gọi trực tiếp hàm cron'
);
select ok(
  exists (select 1 from cron.job where jobname = 'quiz-schedules'),
  'có lịch cron quiz-schedules'
);

select * from finish();
rollback;
