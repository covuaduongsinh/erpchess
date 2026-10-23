-- Bảng xếp hạng học viện gộp cả Quiz: điểm = 10 × số câu bài tập giải đúng + điểm quiz (đã trừ phạt),
-- tính theo thời điểm giải xong trong [p_from, p_to). `solved` đếm cả hai loại, `tries` cộng cả hai.
create or replace function public.academy_leaderboard(p_academy uuid, p_from timestamptz, p_to timestamptz)
returns table (
  student_id uuid,
  display_name text,
  avatar_url text,
  points int,
  solved int,
  tries int
)
language sql stable security definer set search_path = ''
as $$
  with hw as (
    select at.student_id, count(*) filter (where at.solved) as solved, sum(at.tries) as tries
    from public.attempts at
    join public.assignment_items i on i.id = at.item_id
    join public.assignments a on a.id = i.assignment_id
    where a.academy_id = p_academy and at.finished_at >= p_from and at.finished_at < p_to
    group by at.student_id
  ),
  qz as (
    select qa.student_id, count(*) filter (where qa.solved) as solved, sum(qa.tries) as tries,
      sum(qa.score) as score
    from public.quiz_attempts qa
    join public.quiz_items i on i.id = qa.item_id
    join public.quizzes q on q.id = i.quiz_id
    where q.academy_id = p_academy and qa.finished_at >= p_from and qa.finished_at < p_to
    group by qa.student_id
  )
  select
    m.user_id,
    p.display_name,
    p.avatar_url,
    (10 * coalesce(hw.solved, 0) + coalesce(qz.score, 0))::int,
    (coalesce(hw.solved, 0) + coalesce(qz.solved, 0))::int,
    (coalesce(hw.tries, 0) + coalesce(qz.tries, 0))::int
  from public.memberships m
  join public.profiles p on p.id = m.user_id
  left join hw on hw.student_id = m.user_id
  left join qz on qz.student_id = m.user_id
  where m.academy_id = p_academy
    and m.role = 'student'
    and private.is_member(p_academy)
  order by 4 desc, 6 asc, 2 asc;
$$;
