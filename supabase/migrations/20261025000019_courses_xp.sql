-- Giai đoạn 11a: khoá học (chuỗi học liệu theo cấp độ), XP và chuỗi ngày học.
-- XP ghi bằng trigger khi một câu chuyển sang "đã giải" lần đầu (học liệu, bài tập, quiz) và khi
-- hoàn thành khoá; khoá duy nhất (student, source, source_id) nên không cộng trùng. XP tính theo
-- học viên (học liệu thư viện chung không thuộc học viện nào); bảng XP học viện = tổng XP thành viên.

-- ───────────────────────── Khoá học ─────────────────────────

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '' check (char_length(description) <= 4000),
  level_id uuid references public.levels (id) on delete set null,
  open_to_all boolean not null default false,
  auto_certificate boolean not null default true,
  status text not null default 'draft' check (status in ('draft', 'published')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index courses_academy_idx on public.courses (academy_id, created_at desc);
create index courses_level_id_idx on public.courses (level_id);
create index courses_created_by_idx on public.courses (created_by);

create table public.course_items (
  course_id uuid not null references public.courses (id) on delete cascade,
  position int not null check (position >= 0),
  study_id uuid not null references public.studies (id) on delete cascade,
  required boolean not null default true,
  primary key (course_id, position),
  unique (course_id, study_id)
);
create index course_items_study_id_idx on public.course_items (study_id);

create table public.course_targets (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete cascade,
  group_id uuid references public.groups (id) on delete cascade,
  student_id uuid references public.profiles (id) on delete cascade,
  check ((group_id is null) <> (student_id is null))
);
create unique index course_targets_group_uidx on public.course_targets (course_id, group_id) where group_id is not null;
create unique index course_targets_student_uidx on public.course_targets (course_id, student_id) where student_id is not null;
create index course_targets_group_id_idx on public.course_targets (group_id);
create index course_targets_student_id_idx on public.course_targets (student_id);

create table public.course_completions (
  course_id uuid not null references public.courses (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (course_id, student_id)
);
create index course_completions_student_idx on public.course_completions (student_id);

-- ───────────────────────── XP ─────────────────────────

create table public.xp_events (
  id bigint generated always as identity primary key,
  student_id uuid not null references public.profiles (id) on delete cascade,
  source text not null check (source in ('activity', 'homework', 'quiz', 'course')),
  source_id uuid not null,
  points int not null check (points between 0 and 10000),
  day date not null default (now() at time zone 'Asia/Ho_Chi_Minh')::date,
  created_at timestamptz not null default now(),
  unique (student_id, source, source_id)
);
create index xp_events_student_day_idx on public.xp_events (student_id, day);

-- ───────────────────────── Hàm ─────────────────────────

create function private.course_academy(p_course uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select c.academy_id from public.courses c where c.id = p_course;
$$;

-- Học viên được học khoá: khoá đã xuất bản và mở cho cả học viện hoặc được giao (trực tiếp/qua lớp)
create function private.course_open_to(p_course uuid, p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.courses c
    where c.id = p_course and c.status = 'published'
      and (
        (c.open_to_all and exists (
          select 1 from public.memberships m
          where m.academy_id = c.academy_id and m.user_id = p_user and m.role = 'student'
        ))
        or exists (
          select 1 from public.course_targets t
          where t.course_id = c.id
            and (
              t.student_id = p_user
              or t.group_id in (select gm.group_id from public.group_members gm where gm.student_id = p_user)
            )
        )
      )
  );
$$;

create function private.can_view_course(p_course uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.has_role(private.course_academy(p_course), '{owner,coach}')
    or private.course_open_to(p_course, (select auth.uid()))
    or exists (
      select 1 from public.parent_links pl
      where pl.parent_id = (select auth.uid()) and private.course_open_to(p_course, pl.student_id)
    );
$$;

-- Người xem được kết quả của học viên: chính họ, phụ huynh, staff học viện có học viên đó
create function private.can_see_student(p_student uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_student = (select auth.uid())
    or private.is_parent_of(p_student)
    or exists (
      select 1 from public.memberships s
      join public.memberships m on m.academy_id = s.academy_id
      where s.user_id = (select auth.uid()) and s.role in ('owner', 'coach') and m.user_id = p_student
    );
$$;

create function private.study_done(p_study uuid, p_student uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select total > 0 and done >= total
  from (
    select
      (select count(*) from public.study_activities a where a.study_id = p_study) as total,
      (select count(*) from public.activity_attempts at
         join public.study_activities a on a.id = at.activity_id
       where a.study_id = p_study and at.student_id = p_student and at.solved) as done
  ) x;
$$;

grant execute on all functions in schema private to authenticated;

-- Ghi XP (bỏ qua nếu đã có) — dùng chung cho các trigger
create function private.award_xp(p_student uuid, p_source text, p_source_id uuid, p_points int)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare v_rows int;
begin
  insert into public.xp_events (student_id, source, source_id, points)
  values (p_student, p_source, p_source_id, greatest(0, least(p_points, 10000)))
  on conflict (student_id, source, source_id) do nothing;
  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

-- Hoàn thành khoá nếu học viên được học khoá và mọi học liệu bắt buộc đã xong (+100 XP)
create function private.complete_course_if_done(p_course uuid, p_student uuid)
returns boolean
language plpgsql security definer set search_path = ''
as $$
declare v_rows int;
begin
  if not private.course_open_to(p_course, p_student)
    or not exists (select 1 from public.course_items x where x.course_id = p_course and x.required)
    or exists (
      select 1 from public.course_items x
      where x.course_id = p_course and x.required and not private.study_done(x.study_id, p_student)
    ) then
    return false;
  end if;
  insert into public.course_completions (course_id, student_id) values (p_course, p_student)
  on conflict do nothing;
  get diagnostics v_rows = row_count;
  perform private.award_xp(p_student, 'course', p_course, 100);
  return v_rows > 0;
end;
$$;

-- Sau khi một học liệu xong: kiểm các khoá chứa học liệu đó
create function private.check_course_completion(p_study uuid, p_student uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare r record;
begin
  if not private.study_done(p_study, p_student) then
    return;
  end if;
  for r in select ci.course_id from public.course_items ci where ci.study_id = p_study loop
    perform private.complete_course_if_done(r.course_id, p_student);
  end loop;
end;
$$;

create function private.xp_on_activity()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare v_study uuid;
begin
  if new.solved and (tg_op = 'INSERT' or not old.solved) then
    perform private.award_xp(new.student_id, 'activity', new.activity_id, new.score);
    select a.study_id into v_study from public.study_activities a where a.id = new.activity_id;
    perform private.check_course_completion(v_study, new.student_id);
  end if;
  return new;
end;
$$;

create function private.xp_on_homework()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.solved and (tg_op = 'INSERT' or not old.solved) then
    perform private.award_xp(new.student_id, 'homework', new.item_id, 10);
  end if;
  return new;
end;
$$;

create function private.xp_on_quiz()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.solved and (tg_op = 'INSERT' or not old.solved) then
    perform private.award_xp(new.student_id, 'quiz', new.item_id, new.score);
  end if;
  return new;
end;
$$;

create trigger activity_attempts_xp after insert or update of solved on public.activity_attempts
  for each row execute function private.xp_on_activity();
create trigger attempts_xp after insert or update of solved on public.attempts
  for each row execute function private.xp_on_homework();
create trigger quiz_attempts_xp after insert or update of solved on public.quiz_attempts
  for each row execute function private.xp_on_quiz();

-- Tính lại hoàn thành khoá cho mọi học viên được học (sau khi thêm học liệu hoặc giao khoá cho
-- người đã học xong từ trước). Trả số học viên vừa hoàn thành.
create function public.recheck_course(p_course uuid)
returns int
language plpgsql security definer set search_path = ''
as $$
declare r record; v_new int := 0;
begin
  if not private.has_role(private.course_academy(p_course), '{owner,coach}') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  for r in
    select m.user_id from public.memberships m
    where m.academy_id = private.course_academy(p_course) and m.role = 'student'
  loop
    if private.complete_course_if_done(p_course, r.user_id) then
      v_new := v_new + 1;
    end if;
  end loop;
  return v_new;
end;
$$;
revoke execute on function public.recheck_course(uuid) from public, anon;
grant execute on function public.recheck_course(uuid) to authenticated;

-- XP của một học viên: tổng, hôm nay, các ngày có XP (để tính chuỗi ngày), cấp kế và mốc XP
create function public.student_xp(p_student uuid, p_academy uuid default null)
returns table (total int, today int, days date[], next_level text, next_level_xp int)
language sql stable security definer set search_path = ''
as $$
  select
    coalesce((select sum(e.points) from public.xp_events e where e.student_id = p_student), 0)::int,
    coalesce((select sum(e.points) from public.xp_events e
              where e.student_id = p_student and e.day = (now() at time zone 'Asia/Ho_Chi_Minh')::date), 0)::int,
    coalesce((select array_agg(distinct e.day order by e.day desc) from public.xp_events e
              where e.student_id = p_student and e.day > (now() at time zone 'Asia/Ho_Chi_Minh')::date - 400), '{}'),
    nl.name,
    (nl.criteria ->> 'xp')::int
  from (select 1) one
  left join lateral (
    select l.name, l.criteria
    from public.levels l
    where p_academy is not null and l.academy_id = p_academy
      and l.position > coalesce((
        select cur.position from public.memberships m
        join public.levels cur on cur.id = m.level_id
        where m.academy_id = p_academy and m.user_id = p_student
      ), -1)
    order by l.position
    limit 1
  ) nl on true
  where private.can_see_student(p_student);
$$;
revoke execute on function public.student_xp(uuid, uuid) from public, anon;
grant execute on function public.student_xp(uuid, uuid) to authenticated;

create function public.xp_leaderboard(p_academy uuid, p_from date default null, p_to date default null)
returns table (student_id uuid, display_name text, xp int)
language sql stable security definer set search_path = ''
as $$
  select m.user_id, p.display_name, coalesce(sum(e.points), 0)::int as xp
  from public.memberships m
  join public.profiles p on p.id = m.user_id
  left join public.xp_events e
    on e.student_id = m.user_id
    and (p_from is null or e.day >= p_from)
    and (p_to is null or e.day < p_to)
  where m.academy_id = p_academy and m.role = 'student' and private.is_member(p_academy)
  group by m.user_id, p.display_name
  order by xp desc, p.display_name
  limit 100;
$$;
revoke execute on function public.xp_leaderboard(uuid, date, date) from public, anon;
grant execute on function public.xp_leaderboard(uuid, date, date) to authenticated;

-- Tiến độ khoá theo học viên (lọc theo RLS của activity_attempts)
create view public.course_progress
with (security_invoker = true)
as
select
  ci.course_id,
  sp.student_id,
  count(*) filter (where ci.required)::int as required_total,
  count(*) filter (where ci.required and sp.total_activities > 0 and sp.completed >= sp.total_activities)::int as required_done,
  count(*) filter (where sp.total_activities > 0 and sp.completed >= sp.total_activities)::int as studies_done
from public.course_items ci
join public.study_progress sp on sp.study_id = ci.study_id
group by ci.course_id, sp.student_id;
grant select on public.course_progress to authenticated;

-- ───────────────────────── RLS ─────────────────────────

alter table public.courses enable row level security;
alter table public.course_items enable row level security;
alter table public.course_targets enable row level security;
alter table public.course_completions enable row level security;
alter table public.xp_events enable row level security;

create policy "courses: staff, người được học, phụ huynh đọc"
  on public.courses for select to authenticated
  using (private.has_role(academy_id, '{owner,coach}') or private.can_view_course(id));
create policy "courses: staff tạo"
  on public.courses for insert to authenticated
  with check (private.has_role(academy_id, '{owner,coach}') and created_by = (select auth.uid()));
create policy "courses: staff sửa"
  on public.courses for update to authenticated
  using (private.has_role(academy_id, '{owner,coach}'))
  with check (private.has_role(academy_id, '{owner,coach}'));
create policy "courses: staff xoá"
  on public.courses for delete to authenticated
  using (private.has_role(academy_id, '{owner,coach}'));

create policy "course_items: ai xem được khoá thì đọc"
  on public.course_items for select to authenticated
  using (private.can_view_course(course_id));
create policy "course_items: staff ghi"
  on public.course_items for all to authenticated
  using (private.has_role(private.course_academy(course_id), '{owner,coach}'))
  with check (private.has_role(private.course_academy(course_id), '{owner,coach}'));

create policy "course_targets: staff thấy hết, người khác chỉ dòng của mình"
  on public.course_targets for select to authenticated
  using (
    private.has_role(private.course_academy(course_id), '{owner,coach}')
    or student_id = (select auth.uid())
    or (student_id is not null and private.is_parent_of(student_id))
    or (group_id is not null and (private.in_group(group_id, (select auth.uid())) or private.child_in_group(group_id)))
  );
create policy "course_targets: staff giao trong học viện"
  on public.course_targets for insert to authenticated
  with check (
    private.has_role(private.course_academy(course_id), '{owner,coach}')
    and (
      (group_id is not null and private.group_academy(group_id) = private.course_academy(course_id))
      or (student_id is not null and exists (
        select 1 from public.memberships m
        where m.academy_id = private.course_academy(course_id) and m.user_id = student_id and m.role = 'student'
      ))
    )
  );
create policy "course_targets: staff gỡ"
  on public.course_targets for delete to authenticated
  using (private.has_role(private.course_academy(course_id), '{owner,coach}'));

create policy "course_completions: của mình, phụ huynh, staff"
  on public.course_completions for select to authenticated
  using (private.can_see_student(student_id));

create policy "xp_events: của mình, phụ huynh, staff"
  on public.xp_events for select to authenticated
  using (private.can_see_student(student_id));

-- ───────────────────────── Bù XP cho kết quả đã có ─────────────────────────

insert into public.xp_events (student_id, source, source_id, points, day, created_at)
select at.student_id, 'activity', at.activity_id, at.score,
       (coalesce(at.finished_at, at.updated_at) at time zone 'Asia/Ho_Chi_Minh')::date, coalesce(at.finished_at, at.updated_at)
from public.activity_attempts at where at.solved
on conflict do nothing;

insert into public.xp_events (student_id, source, source_id, points, day, created_at)
select a.student_id, 'homework', a.item_id, 10,
       (coalesce(a.finished_at, a.updated_at) at time zone 'Asia/Ho_Chi_Minh')::date, coalesce(a.finished_at, a.updated_at)
from public.attempts a where a.solved
on conflict do nothing;

insert into public.xp_events (student_id, source, source_id, points, day, created_at)
select q.student_id, 'quiz', q.item_id, q.score,
       (coalesce(q.finished_at, q.updated_at) at time zone 'Asia/Ho_Chi_Minh')::date, coalesce(q.finished_at, q.updated_at)
from public.quiz_attempts q where q.solved
on conflict do nothing;
