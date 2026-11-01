-- Sửa lỗi: get_academy_students_report (20261026000025) join bảng không tồn tại `public.academy_levels`
-- (bảng cấp độ là `public.levels`). plpgsql không kiểm tên bảng lúc tạo hàm nên migration cũ vẫn áp được,
-- nhưng mọi lần gọi đều lỗi `relation "public.academy_levels" does not exist`, nên bảng "Toàn học viện" và
-- Xuất CSV toàn học viện ở trang Báo cáo chưa từng chạy được.
--
-- Chỉ đổi một tên bảng; giữ nguyên chữ ký, kiểu trả về, security definer và quyền thực thi
-- (create or replace giữ ACL: đã thu hồi anon ở 20261031000030).
--
-- Hoàn tác: chạy lại `create or replace` với thân hàm ở 20261026000025_student_reports.sql
-- (bản đó vẫn lỗi; chỉ dùng để quay về trạng thái trước khi áp).

create or replace function public.get_academy_students_report(
  p_academy_id uuid,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_res jsonb;
begin
  if not private.has_role(p_academy_id, array['owner', 'coach']::public.academy_role[]) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'studentId', p.id,
      'displayName', p.display_name,
      'username', p.username,
      'levelName', al.name,
      'assignmentsCompleted', coalesce(asn.completed, 0),
      'assignmentsTotal', coalesce(asn.total, 0),
      'quizAvgScore', coalesce(qz.avg_score, 0),
      'quizCompleted', coalesce(qz.completed, 0),
      'attendanceRate', coalesce(cls.attendance_rate, 0),
      'sessionsPresent', coalesce(cls.present_count, 0),
      'sessionsTotal', coalesce(cls.total_count, 0),
      'gamesTotal', coalesce(gm.total_games, 0),
      'gamesWdl', coalesce(gm.wdl, '0/0/0'),
      'blitzRating', coalesce(rt.blitz, 1200),
      'rapidRating', coalesce(rt.rapid, 1200),
      'classicalRating', coalesce(rt.classical, 1200)
    ) order by p.display_name
  ), '[]'::jsonb)
  into v_res
  from public.memberships m
  join public.profiles p on p.id = m.user_id
  left join public.levels al on al.id = m.level_id
  -- Bài tập
  left join lateral (
    select
      count(distinct a.id) as total,
      count(distinct case when att.solved then a.id end) as completed
    from public.assignments a
    join public.assignment_targets t on t.assignment_id = a.id
    left join public.group_members gmx on gmx.group_id = t.group_id and gmx.student_id = p.id
    left join public.assignment_items ai on ai.assignment_id = a.id
    left join public.attempts att on att.item_id = ai.id and att.student_id = p.id
    where a.academy_id = p_academy_id
      and (t.student_id = p.id or gmx.student_id is not null)
      and (p_from is null or a.created_at >= p_from)
      and (p_to is null or a.created_at <= p_to)
  ) asn on true
  -- Quiz
  left join lateral (
    select
      count(distinct qi.quiz_id) as completed,
      round(coalesce(avg(qa.score), 0), 1) as avg_score
    from public.quiz_attempts qa
    join public.quiz_items qi on qi.id = qa.item_id
    join public.quizzes q on q.id = qi.quiz_id
    where q.academy_id = p_academy_id
      and qa.student_id = p.id
      and qa.finished_at is not null
      and (p_from is null or qa.finished_at >= p_from)
      and (p_to is null or qa.finished_at <= p_to)
  ) qz on true
  -- Lớp học
  left join lateral (
    select
      count(distinct c.id) as total_count,
      count(distinct case when ca.status = 'present' then c.id end) as present_count,
      case
        when count(distinct c.id) > 0 then
          round((count(distinct case when ca.status = 'present' then c.id end)::numeric / count(distinct c.id)::numeric) * 100, 1)
        else 0
      end as attendance_rate
    from public.classrooms c
    left join public.classroom_attendance ca on ca.classroom_id = c.id and ca.student_id = p.id
    left join public.classroom_targets ct on ct.classroom_id = c.id
    left join public.group_members gmx on gmx.group_id = ct.group_id and gmx.student_id = p.id
    where c.academy_id = p_academy_id
      and (c.is_public or ct.student_id = p.id or gmx.student_id is not null or ca.classroom_id is not null)
      and (p_from is null or c.starts_at >= p_from)
      and (p_to is null or c.starts_at <= p_to)
  ) cls on true
  -- Ván cờ
  left join lateral (
    select
      count(*) as total_games,
      count(case when (g.white_id = p.id and g.result = '1-0') or (g.black_id = p.id and g.result = '0-1') then 1 end)
        || '/' || count(case when g.result = '1/2-1/2' then 1 end)
        || '/' || count(case when (g.white_id = p.id and g.result = '0-1') or (g.black_id = p.id and g.result = '1-0') then 1 end) as wdl
    from public.games g
    where g.academy_id = p_academy_id
      and (g.white_id = p.id or g.black_id = p.id)
      and g.result in ('1-0', '0-1', '1/2-1/2')
      and (p_from is null or g.created_at >= p_from)
      and (p_to is null or g.created_at <= p_to)
  ) gm on true
  -- Ratings
  left join lateral (
    select
      max(case when category = 'blitz' then rating end) as blitz,
      max(case when category = 'rapid' then rating end) as rapid,
      max(case when category = 'classical' then rating end) as classical
    from public.ratings
    where academy_id = p_academy_id and student_id = p.id
  ) rt on true
  where m.academy_id = p_academy_id
    and m.role = 'student';

  return v_res;
end;
$$;
