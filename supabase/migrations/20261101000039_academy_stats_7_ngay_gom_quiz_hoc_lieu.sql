-- Thẻ "Lượt làm bài 7 ngày" ở Tổng quan chỉ đếm bài tập (bảng attempts, theo updated_at) nên lệch với
-- biểu đồ "Thống kê theo ngày" (academy_daily_stats, 25g) vốn đếm bài tập + quiz + hoạt động học liệu
-- theo finished_at. Đổi cột attempts_week để dùng đúng định nghĩa đó: tổng cột attempts của
-- academy_daily_stats trong 7 ngày lịch gần nhất (hôm nay và 6 ngày trước, múi giờ VN), nên luôn khớp
-- tổng biểu đồ khi chọn "7 ngày qua".
--
-- Giữ nguyên chữ ký và tên cột (students, staff, groups, batches, assignments, attempts_week) để client
-- cũ không vỡ; create or replace giữ nguyên quyền thực thi. KHÔNG drop.
--
-- Hoàn tác: chạy lại create or replace với bản cũ ở 20261023000005_levels_batches_rating.sql
-- (attempts_week = số dòng attempts của học viện có updated_at trong 7*24 giờ qua).

create or replace function public.academy_stats(p_academy uuid)
returns table (
  students int,
  staff int,
  groups int,
  batches int,
  assignments int,
  attempts_week int
)
language sql stable security definer set search_path = ''
as $$
  select
    (select count(*) from public.memberships m where m.academy_id = p_academy and m.role = 'student')::int,
    (select count(*) from public.memberships m where m.academy_id = p_academy and m.role in ('owner', 'coach'))::int,
    (select count(*) from public.groups g where g.academy_id = p_academy and g.kind = 'group')::int,
    (select count(*) from public.groups g where g.academy_id = p_academy and g.kind = 'batch')::int,
    (select count(*) from public.assignments a where a.academy_id = p_academy)::int,
    coalesce((
      select sum(d.attempts)
      from public.academy_daily_stats(
        p_academy,
        ((now() at time zone 'Asia/Ho_Chi_Minh')::date - 6),
        (now() at time zone 'Asia/Ho_Chi_Minh')::date
      ) d
    ), 0)::int
  where private.has_role(p_academy, '{owner,coach}');
$$;
revoke execute on function public.academy_stats(uuid) from public, anon;
grant execute on function public.academy_stats(uuid) to authenticated;
