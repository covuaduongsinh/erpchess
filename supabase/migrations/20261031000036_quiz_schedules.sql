-- Giai đoạn 24b: Quiz tự động theo lịch (đặc tả quan sát bằng REA: Quiz → Automated Quiz — tên,
-- giao cho nhóm/học viên, thứ trong tuần + giờ + múi giờ, ngày hết hạn, chuỗi study theo thứ tự).
-- Mỗi lần tới lịch, hệ thống chép các hoạt động puzzle/mcq/capture của study kế tiếp trong chuỗi
-- thành một quiz `auto`, giao cho nhóm/học viên đã chọn, rồi dời con trỏ sang study sau.

create table public.quiz_schedules (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  -- 0 = Chủ nhật … 6 = Thứ bảy
  days smallint[] not null
    check (cardinality(days) between 1 and 7 and days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  at_time time not null,
  timezone text not null default 'Asia/Ho_Chi_Minh' check (char_length(timezone) between 1 and 64),
  expires_on date,
  study_ids uuid[] not null check (cardinality(study_ids) between 1 and 50),
  next_index int not null default 0 check (next_index >= 0),
  -- Quiz mở trong bao nhiêu giờ kể từ lúc giao
  open_hours int not null default 24 check (open_hours between 1 and 336),
  active boolean not null default true,
  last_run_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index quiz_schedules_academy_idx on public.quiz_schedules (academy_id);
create index quiz_schedules_created_by_idx on public.quiz_schedules (created_by);

create table public.quiz_schedule_targets (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references public.quiz_schedules (id) on delete cascade,
  group_id uuid references public.groups (id) on delete cascade,
  student_id uuid references public.profiles (id) on delete cascade,
  check ((group_id is null) <> (student_id is null))
);
create unique index quiz_schedule_targets_group_uidx
  on public.quiz_schedule_targets (schedule_id, group_id) where group_id is not null;
create unique index quiz_schedule_targets_student_uidx
  on public.quiz_schedule_targets (schedule_id, student_id) where student_id is not null;
create index quiz_schedule_targets_group_idx on public.quiz_schedule_targets (group_id);
create index quiz_schedule_targets_student_idx on public.quiz_schedule_targets (student_id);

-- Quiz sinh ra từ lịch nào (để xem lịch sử của một lịch)
alter table public.quizzes
  add column if not exists schedule_id uuid references public.quiz_schedules (id) on delete set null;
create index if not exists quizzes_schedule_id_idx on public.quizzes (schedule_id);

alter table public.quiz_schedules enable row level security;
alter table public.quiz_schedule_targets enable row level security;

create policy "quiz_schedules: staff"
  on public.quiz_schedules for all to authenticated
  using (private.has_role(academy_id, '{owner,coach}'))
  with check (private.has_role(academy_id, '{owner,coach}'));

create policy "quiz_schedule_targets: staff"
  on public.quiz_schedule_targets for all to authenticated
  using (exists (
    select 1 from public.quiz_schedules s
    where s.id = schedule_id and private.has_role(s.academy_id, '{owner,coach}')
  ))
  with check (exists (
    select 1 from public.quiz_schedules s
    where s.id = schedule_id and private.has_role(s.academy_id, '{owner,coach}')
  ));

/**
 * Giao một quiz từ study kế tiếp của lịch; trả id quiz (null nếu study không còn hoạt động chấm
 * được — khi đó vẫn dời con trỏ để lần sau sang study khác).
 */
create function private.fire_quiz_schedule(p_schedule uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  s public.quiz_schedules;
  v_study uuid;
  v_title text;
  v_quiz uuid;
  v_count int;
begin
  select * into s from public.quiz_schedules where id = p_schedule for update;
  if not found then return null; end if;

  v_study := s.study_ids[1 + (s.next_index % cardinality(s.study_ids))];
  select st.title into v_title from public.studies st where st.id = v_study;

  update public.quiz_schedules
  set next_index = (next_index + 1) % cardinality(study_ids), last_run_at = now()
  where id = p_schedule;

  select count(*) into v_count from public.study_activities a
  where a.study_id = v_study and a.kind in ('puzzle', 'mcq', 'capture');
  if v_title is null or v_count = 0 then return null; end if;

  insert into public.quizzes (academy_id, title, open_to_all, starts_at, due_at, auto, created_by, schedule_id)
  values (
    s.academy_id,
    left(s.name || ' · ' || v_title || ' · ' || to_char(now() at time zone s.timezone, 'DD/MM'), 160),
    false, now(), now() + make_interval(hours => s.open_hours), true, s.created_by, s.id
  )
  returning id into v_quiz;

  insert into public.quiz_items (quiz_id, position, kind, title, payload, points, max_attempts, wrong_penalty, source_activity_id)
  select v_quiz, (row_number() over (order by a.position)) - 1, a.kind, a.title, a.payload,
         a.points, a.max_attempts, a.wrong_penalty, a.id
  from public.study_activities a
  where a.study_id = v_study and a.kind in ('puzzle', 'mcq', 'capture') and pg_column_size(a.payload) <= 50000;

  insert into public.quiz_targets (quiz_id, group_id, student_id)
  select v_quiz, t.group_id, t.student_id from public.quiz_schedule_targets t where t.schedule_id = s.id;

  return v_quiz;
end;
$$;

/** Cron: giao quiz cho mọi lịch đã tới giờ hôm nay (theo múi giờ của lịch) mà chưa giao. */
create function private.run_quiz_schedules()
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  s record;
  v_local timestamp;
  v_fired int := 0;
begin
  for s in
    select q.id, q.days, q.at_time, q.timezone, q.expires_on, q.last_run_at
    from public.quiz_schedules q
    where q.active
  loop
    v_local := now() at time zone s.timezone;
    continue when s.expires_on is not null and v_local::date > s.expires_on;
    continue when not (extract(dow from v_local)::smallint = any (s.days));
    continue when v_local::time < s.at_time;
    continue when s.last_run_at is not null
      and (s.last_run_at at time zone s.timezone)::date >= v_local::date;
    perform private.fire_quiz_schedule(s.id);
    v_fired := v_fired + 1;
  end loop;
  return v_fired;
end;
$$;

/** Staff bấm "Chạy ngay" để giao quiz kế tiếp không cần chờ lịch. */
create function public.run_quiz_schedule_now(p_schedule uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_academy uuid;
begin
  select academy_id into v_academy from public.quiz_schedules where id = p_schedule;
  if v_academy is null or not private.has_role(v_academy, '{owner,coach}') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return private.fire_quiz_schedule(p_schedule);
end;
$$;

revoke execute on function private.fire_quiz_schedule(uuid) from public, anon, authenticated;
revoke execute on function private.run_quiz_schedules() from public, anon, authenticated;
revoke execute on function public.run_quiz_schedule_now(uuid) from public, anon;
grant execute on function public.run_quiz_schedule_now(uuid) to authenticated;

select cron.schedule('quiz-schedules', '*/5 * * * *', 'select private.run_quiz_schedules()');
