-- Giai đoạn 13b: Báo cáo theo học viên và toàn học viện (bài tập, quiz, lớp học, ván cờ, giải đấu)

-- 1. Hàm RPC lấy dữ liệu tóm tắt KPI của một học viên
create or replace function public.get_student_report_summary(
  p_academy_id uuid,
  p_student_id uuid,
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
  v_student record;
  v_asn_total int := 0;
  v_asn_completed int := 0;
  v_asn_avg_tries numeric := 0;
  v_asn_avg_time_ms numeric := 0;
  v_quiz_total int := 0;
  v_quiz_completed int := 0;
  v_quiz_avg_score numeric := 0;
  v_quiz_avg_time_ms numeric := 0;
  v_cls_total int := 0;
  v_cls_present int := 0;
  v_cls_late int := 0;
  v_cls_absent int := 0;
  v_games_total int := 0;
  v_games_wins int := 0;
  v_games_draws int := 0;
  v_games_losses int := 0;
  v_bullet_rating int;
  v_blitz_rating int;
  v_rapid_rating int;
  v_classical_rating int;
  v_tour_joined int := 0;
  v_tour_games int := 0;
  v_tour_points numeric := 0;
  v_tour_best_rank int := null;
begin
  -- Kiểm tra quyền: Owner/Coach của học viện, hoặc chính học viên, hoặc phụ huynh của học viên
  if not (
    private.has_role(p_academy_id, array['owner', 'coach']::public.academy_role[])
    or (auth.uid() = p_student_id and private.is_member(p_academy_id))
    or private.is_parent_of(p_student_id)
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select id, display_name, username into v_student
  from public.profiles
  where id = p_student_id;

  if not found then
    raise exception 'student not found' using errcode = 'P0002';
  end if;

  -- 1. Bài tập
  select count(distinct a.id) into v_asn_total
  from public.assignments a
  join public.assignment_targets t on t.assignment_id = a.id
  left join public.group_members gm on gm.group_id = t.group_id and gm.student_id = p_student_id
  where a.academy_id = p_academy_id
    and (t.student_id = p_student_id or gm.student_id is not null)
    and (p_from is null or a.created_at >= p_from)
    and (p_to is null or a.created_at <= p_to);

  select
    count(distinct ai.assignment_id),
    coalesce(avg(att.tries), 0),
    coalesce(avg(att.time_ms), 0)
  into v_asn_completed, v_asn_avg_tries, v_asn_avg_time_ms
  from public.assignment_items ai
  join public.assignments a on a.id = ai.assignment_id
  join public.attempts att on att.item_id = ai.id and att.student_id = p_student_id and att.solved = true
  where a.academy_id = p_academy_id
    and (p_from is null or att.finished_at >= p_from)
    and (p_to is null or att.finished_at <= p_to);

  -- 2. Quiz
  select count(distinct q.id) into v_quiz_total
  from public.quizzes q
  left join public.quiz_targets t on t.quiz_id = q.id
  left join public.group_members gm on gm.group_id = t.group_id and gm.student_id = p_student_id
  where q.academy_id = p_academy_id
    and (q.open_to_all or t.student_id = p_student_id or gm.student_id is not null)
    and (p_from is null or q.created_at >= p_from)
    and (p_to is null or q.created_at <= p_to);

  select
    count(distinct qi.quiz_id),
    coalesce(avg(qa.score), 0),
    coalesce(avg(qa.time_ms), 0)
  into v_quiz_completed, v_quiz_avg_score, v_quiz_avg_time_ms
  from public.quiz_attempts qa
  join public.quiz_items qi on qi.id = qa.item_id
  join public.quizzes q on q.id = qi.quiz_id
  where q.academy_id = p_academy_id
    and qa.student_id = p_student_id
    and qa.finished_at is not null
    and (p_from is null or qa.finished_at >= p_from)
    and (p_to is null or qa.finished_at <= p_to);

  -- 3. Chuyên cần lớp học
  select
    count(distinct c.id),
    count(distinct case when ca.status = 'present' then c.id end),
    count(distinct case when ca.status = 'late' then c.id end),
    count(distinct case when ca.status = 'absent' then c.id end)
  into v_cls_total, v_cls_present, v_cls_late, v_cls_absent
  from public.classrooms c
  left join public.classroom_attendance ca on ca.classroom_id = c.id and ca.student_id = p_student_id
  left join public.classroom_targets ct on ct.classroom_id = c.id
  left join public.group_members gm on gm.group_id = ct.group_id and gm.student_id = p_student_id
  where c.academy_id = p_academy_id
    and (c.is_public or ct.student_id = p_student_id or gm.student_id is not null or ca.classroom_id is not null)
    and (p_from is null or c.starts_at >= p_from)
    and (p_to is null or c.starts_at <= p_to);

  -- 4. Ván cờ
  select
    count(*),
    count(case when (g.white_id = p_student_id and g.result = '1-0') or (g.black_id = p_student_id and g.result = '0-1') then 1 end),
    count(case when g.result = '1/2-1/2' then 1 end),
    count(case when (g.white_id = p_student_id and g.result = '0-1') or (g.black_id = p_student_id and g.result = '1-0') then 1 end)
  into v_games_total, v_games_wins, v_games_draws, v_games_losses
  from public.games g
  where g.academy_id = p_academy_id
    and (g.white_id = p_student_id or g.black_id = p_student_id)
    and g.result in ('1-0', '0-1', '1/2-1/2')
    and (p_from is null or g.created_at >= p_from)
    and (p_to is null or g.created_at <= p_to);

  select
    max(case when category = 'bullet' then rating end),
    max(case when category = 'blitz' then rating end),
    max(case when category = 'rapid' then rating end),
    max(case when category = 'classical' then rating end)
  into v_bullet_rating, v_blitz_rating, v_rapid_rating, v_classical_rating
  from public.ratings
  where academy_id = p_academy_id and student_id = p_student_id;

  -- 5. Giải đấu
  select count(distinct tp.tournament_id) into v_tour_joined
  from public.tournament_players tp
  join public.tournaments t on t.id = tp.tournament_id
  where t.academy_id = p_academy_id
    and tp.player_id = p_student_id
    and (p_from is null or t.starts_at >= p_from)
    and (p_to is null or t.starts_at <= p_to);

  select
    count(*),
    coalesce(sum(case
      when (g.white_id = p_student_id and g.result = '1-0') or (g.black_id = p_student_id and g.result = '0-1') then 1.0
      when g.result = '1/2-1/2' then 0.5
      else 0.0
    end), 0)
  into v_tour_games, v_tour_points
  from public.games g
  join public.tournaments t on t.id = g.tournament_id
  where t.academy_id = p_academy_id
    and (g.white_id = p_student_id or g.black_id = p_student_id)
    and (p_from is null or g.created_at >= p_from)
    and (p_to is null or g.created_at <= p_to);

  -- Tính toán JSON trả về
  v_res := jsonb_build_object(
    'studentId', v_student.id,
    'displayName', v_student.display_name,
    'username', v_student.username,
    'assignments', jsonb_build_object(
      'totalAssigned', v_asn_total,
      'completed', v_asn_completed,
      'solvedRate', case when v_asn_total > 0 then round((v_asn_completed::numeric / v_asn_total::numeric) * 100, 1) else 0 end,
      'avgTries', round(v_asn_avg_tries, 1),
      'avgTimeMs', round(v_asn_avg_time_ms)
    ),
    'quizzes', jsonb_build_object(
      'totalAssigned', v_quiz_total,
      'completed', v_quiz_completed,
      'avgScore', round(v_quiz_avg_score, 1),
      'avgTimeMs', round(v_quiz_avg_time_ms)
    ),
    'classrooms', jsonb_build_object(
      'totalSessions', v_cls_total,
      'presentCount', v_cls_present,
      'lateCount', v_cls_late,
      'absentCount', v_cls_absent,
      'attendanceRate', case when v_cls_total > 0 then round((v_cls_present::numeric / v_cls_total::numeric) * 100, 1) else 0 end
    ),
    'games', jsonb_build_object(
      'totalGames', v_games_total,
      'wins', v_games_wins,
      'draws', v_games_draws,
      'losses', v_games_losses,
      'ratings', jsonb_build_object(
        'bullet', v_bullet_rating,
        'blitz', v_blitz_rating,
        'rapid', v_rapid_rating,
        'classical', v_classical_rating
      )
    ),
    'tournaments', jsonb_build_object(
      'totalJoined', v_tour_joined,
      'totalGames', v_tour_games,
      'totalPoints', v_tour_points,
      'bestRank', v_tour_best_rank
    )
  );

  return v_res;
end;
$$;

-- 2. Hàm RPC lấy chi tiết các mục báo cáo (phục vụ bảng và xuất CSV)
create or replace function public.get_student_report_details(
  p_academy_id uuid,
  p_student_id uuid,
  p_from timestamptz default null,
  p_to timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_summary jsonb;
  v_student record;
  v_assignments jsonb := '[]'::jsonb;
  v_quizzes jsonb := '[]'::jsonb;
  v_classrooms jsonb := '[]'::jsonb;
  v_games jsonb := '[]'::jsonb;
  v_tournaments jsonb := '[]'::jsonb;
begin
  -- Gọi hàm summary để lấy tổng quan và đồng thời kiểm tra quyền
  v_summary := public.get_student_report_summary(p_academy_id, p_student_id, p_from, p_to);

  select p.id, p.display_name, p.username, u.email into v_student
  from public.profiles p
  left join auth.users u on u.id = p.id
  where p.id = p_student_id;

  -- 1. Danh sách bài tập
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id,
    'title', a.title,
    'assignedAt', a.created_at,
    'dueDate', a.due_at,
    'solved', coalesce(att.solved, false),
    'tries', coalesce(att.tries, 0),
    'timeMs', coalesce(att.time_ms, 0)
  ) order by a.created_at desc), '[]'::jsonb)
  into v_assignments
  from public.assignments a
  join public.assignment_targets t on t.assignment_id = a.id
  left join public.group_members gm on gm.group_id = t.group_id and gm.student_id = p_student_id
  left join lateral (
    select bool_or(atx.solved) as solved, sum(atx.tries) as tries, sum(atx.time_ms) as time_ms
    from public.assignment_items ai
    join public.attempts atx on atx.item_id = ai.id and atx.student_id = p_student_id
    where ai.assignment_id = a.id
  ) att on true
  where a.academy_id = p_academy_id
    and (t.student_id = p_student_id or gm.student_id is not null)
    and (p_from is null or a.created_at >= p_from)
    and (p_to is null or a.created_at <= p_to);

  -- 2. Danh sách quiz
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', q.id,
    'title', q.title,
    'submittedAt', qa.finished_at,
    'score', coalesce(qa.score, 0),
    'maxScore', coalesce((select sum(points) from public.quiz_items qi where qi.quiz_id = q.id), 0),
    'solved', coalesce(qa.solved, false),
    'timeMs', coalesce(qa.time_ms, 0)
  ) order by coalesce(qa.finished_at, q.created_at) desc), '[]'::jsonb)
  into v_quizzes
  from public.quizzes q
  left join public.quiz_targets t on t.quiz_id = q.id
  left join public.group_members gm on gm.group_id = t.group_id and gm.student_id = p_student_id
  left join lateral (
    select qat.finished_at, sum(qat.score) as score, bool_and(qat.solved) as solved, sum(qat.time_ms) as time_ms
    from public.quiz_items qi
    join public.quiz_attempts qat on qat.item_id = qi.id and qat.student_id = p_student_id
    where qi.quiz_id = q.id
    group by qat.finished_at
    order by qat.finished_at desc
    limit 1
  ) qa on true
  where q.academy_id = p_academy_id
    and (q.open_to_all or t.student_id = p_student_id or gm.student_id is not null)
    and (p_from is null or q.created_at >= p_from)
    and (p_to is null or q.created_at <= p_to);

  -- 3. Danh sách lớp học
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'title', c.title,
    'startsAt', c.starts_at,
    'status', coalesce(ca.status, 'absent'),
    'note', coalesce(ca.note, '')
  ) order by c.starts_at desc), '[]'::jsonb)
  into v_classrooms
  from public.classrooms c
  left join public.classroom_attendance ca on ca.classroom_id = c.id and ca.student_id = p_student_id
  left join public.classroom_targets ct on ct.classroom_id = c.id
  left join public.group_members gm on gm.group_id = ct.group_id and gm.student_id = p_student_id
  where c.academy_id = p_academy_id
    and (c.is_public or ct.student_id = p_student_id or gm.student_id is not null or ca.classroom_id is not null)
    and (p_from is null or c.starts_at >= p_from)
    and (p_to is null or c.starts_at <= p_to);

  -- 4. Danh sách ván đấu
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', g.id,
    'playedAt', g.created_at,
    'opponent', case when g.white_id = p_student_id then coalesce(pb.display_name, 'Ẩn danh') else coalesce(pw.display_name, 'Ẩn danh') end,
    'color', case when g.white_id = p_student_id then 'white' else 'black' end,
    'result', coalesce(g.result, '*'),
    'speed', coalesce(g.category, 'standard'),
    'won', case
      when (g.white_id = p_student_id and g.result = '1-0') or (g.black_id = p_student_id and g.result = '0-1') then true
      when (g.white_id = p_student_id and g.result = '0-1') or (g.black_id = p_student_id and g.result = '1-0') then false
      else null
    end
  ) order by g.created_at desc), '[]'::jsonb)
  into v_games
  from public.games g
  left join public.profiles pw on pw.id = g.white_id
  left join public.profiles pb on pb.id = g.black_id
  where g.academy_id = p_academy_id
    and (g.white_id = p_student_id or g.black_id = p_student_id)
    and (p_from is null or g.created_at >= p_from)
    and (p_to is null or g.created_at <= p_to);

  -- 5. Danh sách giải đấu
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.id,
    'title', t.title,
    'startsAt', t.starts_at,
    'rank', null,
    'points', coalesce(tp_pts.points, 0),
    'tiebreak', 0,
    'totalPlayers', coalesce((select count(*) from public.tournament_players tpx where tpx.tournament_id = t.id), 0)
  ) order by t.starts_at desc), '[]'::jsonb)
  into v_tournaments
  from public.tournament_players tp
  join public.tournaments t on t.id = tp.tournament_id
  left join lateral (
    select sum(case
      when (g.white_id = p_student_id and g.result = '1-0') or (g.black_id = p_student_id and g.result = '0-1') then 1.0
      when g.result = '1/2-1/2' then 0.5
      else 0.0
    end) as points
    from public.games g
    where g.tournament_id = t.id and (g.white_id = p_student_id or g.black_id = p_student_id)
  ) tp_pts on true
  where t.academy_id = p_academy_id
    and tp.player_id = p_student_id
    and (p_from is null or t.starts_at >= p_from)
    and (p_to is null or t.starts_at <= p_to);

  return jsonb_build_object(
    'student', jsonb_build_object(
      'id', v_student.id,
      'displayName', v_student.display_name,
      'username', v_student.username,
      'email', v_student.email
    ),
    'summary', v_summary,
    'assignments', v_assignments,
    'quizzes', v_quizzes,
    'classrooms', v_classrooms,
    'games', v_games,
    'tournaments', v_tournaments
  );
end;
$$;

-- 3. Hàm RPC lấy danh sách báo cáo tóm tắt của toàn bộ học viên trong học viện (chỉ dành cho Owner / Coach)
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
  left join public.academy_levels al on al.id = m.level_id
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

grant execute on function public.get_student_report_summary(uuid, uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.get_student_report_details(uuid, uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.get_academy_students_report(uuid, timestamptz, timestamptz) to authenticated;
