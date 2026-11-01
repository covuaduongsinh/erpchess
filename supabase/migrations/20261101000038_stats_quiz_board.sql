-- Giai đoạn 25g: số liệu theo ngày cho Tổng quan, bảng xếp hạng quiz toàn học viện và tỉ lệ quiz đã
-- bắt đầu. Chỉ THÊM hàm đọc (không đổi bảng, không xoá hay sửa dữ liệu). Mọi hàm là
-- security definer + search_path rỗng, tự kiểm quyền theo `auth.uid()`, và thu hồi quyền của anon.

-- ── 1. Số liệu theo ngày (nhân sự) ────────────────────────────────────────────
-- Mỗi ngày trong [p_from, p_to] theo múi giờ p_tz:
--   attempts           số lượt làm đã kết thúc (bài tập + quiz + hoạt động của study thuộc học viện)
--   attendance_present số lượt điểm danh có mặt hoặc trễ trong các buổi học bắt đầu ngày đó
--   attendance_total   số lượt điểm danh không tính "có phép"
--   quiz_completions   số cặp (quiz, học viên) làm xong đủ mọi câu, tính theo ngày nộp câu cuối
-- Chỉ owner/coach của học viện mới có kết quả (người khác nhận tập rỗng, như academy_stats).
create function public.academy_daily_stats(
  p_academy uuid,
  p_from date,
  p_to date,
  p_tz text default 'Asia/Ho_Chi_Minh'
)
returns table (
  on_date date,
  attempts int,
  attendance_present int,
  attendance_total int,
  quiz_completions int
)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_from timestamptz;
  v_to timestamptz;
begin
  if not private.has_role(p_academy, '{owner,coach}') then
    return;
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 92 then
    raise exception 'khoảng ngày không hợp lệ (tối đa 93 ngày)' using errcode = '22023';
  end if;
  -- Múi giờ sai thì raise ngay (SQLSTATE 22023) thay vì trả số sai
  perform now() at time zone p_tz;
  v_from := p_from::timestamp at time zone p_tz;
  v_to := (p_to + 1)::timestamp at time zone p_tz;

  return query
  with days as (
    select (p_from + n)::date as dt from generate_series(0, p_to - p_from) n
  ),
  hw as (
    select (at.finished_at at time zone p_tz)::date as dt, count(*) as n
    from public.attempts at
    join public.assignment_items i on i.id = at.item_id
    join public.assignments a on a.id = i.assignment_id
    where a.academy_id = p_academy and at.finished_at >= v_from and at.finished_at < v_to
    group by 1
  ),
  qz as (
    select (qa.finished_at at time zone p_tz)::date as dt, count(*) as n
    from public.quiz_attempts qa
    join public.quiz_items i on i.id = qa.item_id
    join public.quizzes q on q.id = i.quiz_id
    where q.academy_id = p_academy and qa.finished_at >= v_from and qa.finished_at < v_to
    group by 1
  ),
  act as (
    select (aa.finished_at at time zone p_tz)::date as dt, count(*) as n
    from public.activity_attempts aa
    join public.study_activities sa on sa.id = aa.activity_id
    join public.studies s on s.id = sa.study_id
    where s.academy_id = p_academy and aa.finished_at >= v_from and aa.finished_at < v_to
    group by 1
  ),
  att as (
    select
      (c.starts_at at time zone p_tz)::date as dt,
      count(*) filter (where ca.status in ('present', 'late')) as present,
      count(*) filter (where ca.status <> 'excused') as total
    from public.classrooms c
    join public.classroom_attendance ca on ca.classroom_id = c.id
    where c.academy_id = p_academy and c.starts_at >= v_from and c.starts_at < v_to
    group by 1
  ),
  done as (
    select (max(qa.finished_at) at time zone p_tz)::date as dt
    from public.quiz_attempts qa
    join public.quiz_items i on i.id = qa.item_id
    join public.quizzes q on q.id = i.quiz_id
    where q.academy_id = p_academy and qa.finished_at is not null
    group by q.id, qa.student_id
    having count(*) = (select count(*) from public.quiz_items x where x.quiz_id = q.id)
  ),
  done_by_day as (
    select dt, count(*) as n from done group by dt
  )
  select
    days.dt,
    (coalesce(hw.n, 0) + coalesce(qz.n, 0) + coalesce(act.n, 0))::int,
    coalesce(att.present, 0)::int,
    coalesce(att.total, 0)::int,
    coalesce(done_by_day.n, 0)::int
  from days
  left join hw on hw.dt = days.dt
  left join qz on qz.dt = days.dt
  left join act on act.dt = days.dt
  left join att on att.dt = days.dt
  left join done_by_day on done_by_day.dt = days.dt
  order by days.dt;
end;
$$;
revoke execute on function public.academy_daily_stats(uuid, date, date, text) from public, anon;
grant execute on function public.academy_daily_stats(uuid, date, date, text) to authenticated;

-- ── 2. Bảng xếp hạng quiz toàn học viện (mọi thành viên) ───────────────────────
-- Chỉ tính quiz_attempts đã kết thúc trong [p_from, p_to). `points` là tổng điểm quiz (đã trừ phạt),
-- `correct` là số câu đúng, `completed` là số quiz đã làm xong đủ mọi câu trong khoảng đó.
-- Trả mọi học viên của học viện (kể cả 0 điểm) để giao diện tự lọc, như academy_leaderboard.
create function public.academy_quiz_leaderboard(p_academy uuid, p_from timestamptz, p_to timestamptz)
returns table (
  student_id uuid,
  display_name text,
  avatar_url text,
  points int,
  correct int,
  completed int
)
language sql stable security definer set search_path = ''
as $$
  with per_quiz as (
    select
      qa.student_id,
      q.id as quiz_id,
      count(*) as done,
      count(*) filter (where qa.solved) as ok,
      coalesce(sum(qa.score), 0) as score
    from public.quiz_attempts qa
    join public.quiz_items i on i.id = qa.item_id
    join public.quizzes q on q.id = i.quiz_id
    where q.academy_id = p_academy and qa.finished_at >= p_from and qa.finished_at < p_to
    group by qa.student_id, q.id
  ),
  agg as (
    select
      pq.student_id,
      sum(pq.score) as points,
      sum(pq.ok) as correct,
      count(*) filter (
        where pq.done = (select count(*) from public.quiz_items x where x.quiz_id = pq.quiz_id)
      ) as completed
    from per_quiz pq
    group by pq.student_id
  )
  select
    m.user_id,
    p.display_name,
    p.avatar_url,
    coalesce(agg.points, 0)::int,
    coalesce(agg.correct, 0)::int,
    coalesce(agg.completed, 0)::int
  from public.memberships m
  join public.profiles p on p.id = m.user_id
  left join agg on agg.student_id = m.user_id
  where m.academy_id = p_academy
    and m.role = 'student'
    and private.is_member(p_academy)
  order by 4 desc, 6 desc, 2 asc;
$$;
revoke execute on function public.academy_quiz_leaderboard(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.academy_quiz_leaderboard(uuid, timestamptz, timestamptz) to authenticated;

-- ── 3. Tỉ lệ quiz đã bắt đầu (nhân sự) ──────────────────────────────────────
-- total_quizzes   mọi quiz của học viện
-- open_quizzes    quiz đang giao: đã tới giờ mở và chưa quá hạn
-- started_quizzes trong số đang giao, quiz đã có ít nhất một học viên bắt đầu làm (có dòng bài làm)
create function public.academy_quiz_started(p_academy uuid)
returns table (
  total_quizzes int,
  open_quizzes int,
  started_quizzes int
)
language sql stable security definer set search_path = ''
as $$
  with open_q as (
    select q.id
    from public.quizzes q
    where q.academy_id = p_academy
      and (q.starts_at is null or q.starts_at <= now())
      and (q.due_at is null or q.due_at > now())
  )
  select
    (select count(*) from public.quizzes q where q.academy_id = p_academy)::int,
    (select count(*) from open_q)::int,
    (select count(*) from open_q oq where exists (
      select 1
      from public.quiz_items i
      join public.quiz_attempts qa on qa.item_id = i.id
      where i.quiz_id = oq.id
    ))::int
  where private.has_role(p_academy, '{owner,coach}');
$$;
revoke execute on function public.academy_quiz_started(uuid) from public, anon;
grant execute on function public.academy_quiz_started(uuid) to authenticated;
