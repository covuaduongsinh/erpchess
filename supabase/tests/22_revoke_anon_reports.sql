begin;
select plan(4);

select ok(
  not has_function_privilege('anon', 'public.get_student_report_summary(uuid, uuid, timestamptz, timestamptz)', 'execute'),
  'anon không gọi được get_student_report_summary'
);
select ok(
  not has_function_privilege('anon', 'public.get_academy_students_report(uuid, timestamptz, timestamptz)', 'execute'),
  'anon không gọi được get_academy_students_report'
);
select ok(
  has_function_privilege('authenticated', 'public.get_student_report_details(uuid, uuid, timestamptz, timestamptz)', 'execute'),
  'người đã đăng nhập vẫn gọi được get_student_report_details'
);
select ok(
  not has_function_privilege('authenticated', 'public.handle_new_user()', 'execute'),
  'không ai gọi trực tiếp handle_new_user'
);

select * from finish();
rollback;
