-- Gia cố: các hàm báo cáo (Giai đoạn 13b) là security definer nhưng chưa thu hồi quyền của `anon`,
-- nên người chưa đăng nhập gọi được qua /rest/v1/rpc (bên trong vẫn chặn bằng kiểm tra quyền,
-- nhưng không nên để lộ điểm gọi). Chỉ người đã đăng nhập mới được gọi.

revoke execute on function public.get_student_report_summary(uuid, uuid, timestamptz, timestamptz) from public, anon;
revoke execute on function public.get_student_report_details(uuid, uuid, timestamptz, timestamptz) from public, anon;
revoke execute on function public.get_academy_students_report(uuid, timestamptz, timestamptz) from public, anon;
-- Hàm trigger tạo hồ sơ khi đăng ký: không phải RPC, không ai cần gọi trực tiếp
revoke execute on function public.handle_new_user() from public, anon, authenticated;

grant execute on function public.get_student_report_summary(uuid, uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.get_student_report_details(uuid, uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.get_academy_students_report(uuid, timestamptz, timestamptz) to authenticated;
