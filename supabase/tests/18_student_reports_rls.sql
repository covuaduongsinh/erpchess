begin;
select plan(5);

-- 1. Hàm get_student_report_summary tồn tại
select has_function(
  'public',
  'get_student_report_summary',
  array['uuid', 'uuid', 'timestamp with time zone', 'timestamp with time zone'],
  'get_student_report_summary tồn tại'
);

-- 2. Hàm get_student_report_details tồn tại
select has_function(
  'public',
  'get_student_report_details',
  array['uuid', 'uuid', 'timestamp with time zone', 'timestamp with time zone'],
  'get_student_report_details tồn tại'
);

-- 3. Hàm get_academy_students_report tồn tại
select has_function(
  'public',
  'get_academy_students_report',
  array['uuid', 'timestamp with time zone', 'timestamp with time zone'],
  'get_academy_students_report tồn tại'
);

-- 4. Người dùng ẩn danh không thể gọi hàm
select throws_ok(
  $$select public.get_academy_students_report('00000000-0000-0000-0000-000000000001')$$,
  '42501',
  null,
  'Học viên không có quyền gọi get_academy_students_report'
);

select throws_ok(
  $$select public.get_student_report_summary('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002')$$,
  '42501',
  null,
  'Người ngoài không thể xem báo cáo học viên'
);

select * from finish();
rollback;
