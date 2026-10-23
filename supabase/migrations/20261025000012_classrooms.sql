-- Giai đoạn 8a: lớp học (online/offline), người tham gia, điểm danh, sự kiện để xem lại,
-- lịch trống của HLV và Calendar.

-- ───────────────────────── Bảng ─────────────────────────

create table public.classrooms (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  title text not null default 'Class' check (char_length(title) between 1 and 160),
  kind text not null default 'online' check (kind in ('online', 'offline')),
  video_mode text not null default 'performance' check (video_mode in ('performance', 'standard', 'none')),
  -- true: mọi thành viên đã đăng nhập của học viện có link đều vào được
  is_public boolean not null default false,
  starts_at timestamptz not null,
  minutes int not null default 60 check (minutes between 5 and 600),
  coach_id uuid references public.profiles (id) on delete set null,
  -- Batch sinh ra buổi học (nếu có); các buổi của cùng một chuỗi lặp chung series_id
  group_id uuid references public.groups (id) on delete set null,
  series_id uuid,
  -- Bàn cờ hiện tại {fen, lastMove, controller} để người vào muộn đồng bộ
  state jsonb not null default '{}',
  ended_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index classrooms_academy_starts_idx on public.classrooms (academy_id, starts_at);
create index classrooms_coach_id_idx on public.classrooms (coach_id);
create index classrooms_group_id_idx on public.classrooms (group_id);
create index classrooms_series_id_idx on public.classrooms (series_id);
create index classrooms_created_by_idx on public.classrooms (created_by);

create table public.classroom_targets (
  id uuid primary key default gen_random_uuid(),
  classroom_id uuid not null references public.classrooms (id) on delete cascade,
  group_id uuid references public.groups (id) on delete cascade,
  student_id uuid references public.profiles (id) on delete cascade,
  check ((group_id is null) <> (student_id is null))
);
create unique index classroom_targets_group_uidx on public.classroom_targets (classroom_id, group_id) where group_id is not null;
create unique index classroom_targets_student_uidx on public.classroom_targets (classroom_id, student_id) where student_id is not null;
create index classroom_targets_group_id_idx on public.classroom_targets (group_id);
create index classroom_targets_student_id_idx on public.classroom_targets (student_id);

create table public.classroom_attendance (
  classroom_id uuid not null references public.classrooms (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  status text not null check (status in ('present', 'late', 'absent', 'excused')),
  joined_at timestamptz,
  note text not null default '' check (char_length(note) <= 500),
  updated_at timestamptz not null default now(),
  primary key (classroom_id, student_id)
);
create index classroom_attendance_student_id_idx on public.classroom_attendance (student_id);

create table public.classroom_events (
  id bigint generated always as identity primary key,
  classroom_id uuid not null references public.classrooms (id) on delete cascade,
  at timestamptz not null default now(),
  kind text not null check (kind in ('move', 'fen', 'draw', 'chat', 'control')),
  actor_id uuid references public.profiles (id) on delete set null,
  payload jsonb not null default '{}' check (pg_column_size(payload) <= 4000)
);
create index classroom_events_classroom_idx on public.classroom_events (classroom_id, id);
create index classroom_events_actor_id_idx on public.classroom_events (actor_id);

-- Lịch trống lặp tuần của HLV (giờ địa phương), cùng dạng với groups.schedule
create table public.coach_availability (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  coach_id uuid not null references public.profiles (id) on delete cascade,
  day int not null check (day between 0 and 6),
  start text not null check (start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  minutes int not null check (minutes between 15 and 720)
);
create index coach_availability_academy_coach_idx on public.coach_availability (academy_id, coach_id);
create index coach_availability_coach_id_idx on public.coach_availability (coach_id);

create table public.calendar_events (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  coach_id uuid references public.profiles (id) on delete set null,
  kind text not null check (kind in ('class', 'trial', 'meeting', 'leave', 'other')),
  title text not null check (char_length(title) between 1 and 160),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  classroom_id uuid unique references public.classrooms (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index calendar_events_academy_starts_idx on public.calendar_events (academy_id, starts_at);
create index calendar_events_coach_id_idx on public.calendar_events (coach_id);
create index calendar_events_created_by_idx on public.calendar_events (created_by);

-- ───────────────────────── Hàm ─────────────────────────

create function private.classroom_academy(p_classroom uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select c.academy_id from public.classrooms c where c.id = p_classroom;
$$;

-- Học viên được vào lớp: được giao trực tiếp/qua lớp, hoặc lớp công khai và là học viên của học viện
create function private.classroom_open_to(p_classroom uuid, p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.classrooms c
    where c.id = p_classroom
      and (
        (c.is_public and exists (
          select 1 from public.memberships m
          where m.academy_id = c.academy_id and m.user_id = p_user
        ))
        or exists (
          select 1 from public.classroom_targets t
          where t.classroom_id = c.id
            and (
              t.student_id = p_user
              or t.group_id in (select gm.group_id from public.group_members gm where gm.student_id = p_user)
            )
        )
      )
  );
$$;

create function private.can_view_classroom(p_classroom uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.has_role(private.classroom_academy(p_classroom), '{owner,coach}')
    or private.classroom_open_to(p_classroom, (select auth.uid()))
    or exists (
      select 1 from public.parent_links pl
      where pl.parent_id = (select auth.uid()) and private.classroom_open_to(p_classroom, pl.student_id)
    );
$$;

-- Điều khiển lớp: owner, hoặc HLV phụ trách / người tạo
create function private.can_run_classroom(p_classroom uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.classrooms c
    where c.id = p_classroom
      and (
        private.has_role(c.academy_id, '{owner}')
        or (
          private.has_role(c.academy_id, '{coach}')
          and (c.coach_id = (select auth.uid()) or c.created_by = (select auth.uid()))
        )
      )
  );
$$;

grant execute on all functions in schema private to authenticated;

-- Lớp tạo/sửa thì Calendar có sự kiện "class" tương ứng
create function private.sync_classroom_event()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.calendar_events (academy_id, coach_id, kind, title, starts_at, ends_at, classroom_id, created_by)
  values (new.academy_id, new.coach_id, 'class', new.title, new.starts_at,
          new.starts_at + make_interval(mins => new.minutes), new.id, new.created_by)
  on conflict (classroom_id) do update
    set coach_id = excluded.coach_id, title = excluded.title,
        starts_at = excluded.starts_at, ends_at = excluded.ends_at;
  return new;
end;
$$;

create trigger classrooms_calendar_sync
  after insert or update of title, starts_at, minutes, coach_id on public.classrooms
  for each row execute function private.sync_classroom_event();

-- Học viên vào lớp: tự ghi điểm danh (đi muộn nếu quá 10 phút). Staff vào thì không ghi.
create function public.classroom_join(p_classroom uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_starts timestamptz;
  v_status text;
begin
  if v_uid is null
    or not private.classroom_open_to(p_classroom, v_uid)
    or not private.has_role(private.classroom_academy(p_classroom), '{student}') then
    return null;
  end if;
  select c.starts_at into v_starts from public.classrooms c where c.id = p_classroom;
  v_status := case when now() > v_starts + interval '10 minutes' then 'late' else 'present' end;
  insert into public.classroom_attendance (classroom_id, student_id, status, joined_at)
  values (p_classroom, v_uid, v_status, now())
  on conflict (classroom_id, student_id) do update
    set status = case when public.classroom_attendance.status in ('absent') then excluded.status
                      else public.classroom_attendance.status end,
        joined_at = coalesce(public.classroom_attendance.joined_at, excluded.joined_at),
        updated_at = now()
  returning status into v_status;
  return v_status;
end;
$$;
revoke execute on function public.classroom_join(uuid) from public, anon;
grant execute on function public.classroom_join(uuid) to authenticated;

-- ───────────────────────── RLS ─────────────────────────

alter table public.classrooms enable row level security;
alter table public.classroom_targets enable row level security;
alter table public.classroom_attendance enable row level security;
alter table public.classroom_events enable row level security;
alter table public.coach_availability enable row level security;
alter table public.calendar_events enable row level security;

-- Staff kiểm thẳng trên cột của dòng để INSERT … RETURNING thấy dòng vừa chèn
create policy "classrooms: staff, người được giao, phụ huynh đọc"
  on public.classrooms for select to authenticated
  using (private.has_role(academy_id, '{owner,coach}') or private.can_view_classroom(id));
create policy "classrooms: staff tạo"
  on public.classrooms for insert to authenticated
  with check (private.has_role(academy_id, '{owner,coach}') and created_by = (select auth.uid()));
create policy "classrooms: người điều khiển sửa"
  on public.classrooms for update to authenticated
  using (private.can_run_classroom(id))
  with check (private.has_role(academy_id, '{owner,coach}'));
create policy "classrooms: người điều khiển xoá"
  on public.classrooms for delete to authenticated
  using (private.can_run_classroom(id));

create policy "classroom_targets: staff thấy hết, người khác chỉ dòng của mình"
  on public.classroom_targets for select to authenticated
  using (
    private.has_role(private.classroom_academy(classroom_id), '{owner,coach}')
    or student_id = (select auth.uid())
    or (student_id is not null and private.is_parent_of(student_id))
    or (group_id is not null and (private.in_group(group_id, (select auth.uid())) or private.child_in_group(group_id)))
  );
create policy "classroom_targets: staff giao trong học viện"
  on public.classroom_targets for insert to authenticated
  with check (
    private.has_role(private.classroom_academy(classroom_id), '{owner,coach}')
    and (
      (group_id is not null and private.group_academy(group_id) = private.classroom_academy(classroom_id))
      or (student_id is not null and exists (
        select 1 from public.memberships m
        where m.academy_id = private.classroom_academy(classroom_id) and m.user_id = student_id and m.role = 'student'
      ))
    )
  );
create policy "classroom_targets: staff gỡ"
  on public.classroom_targets for delete to authenticated
  using (private.has_role(private.classroom_academy(classroom_id), '{owner,coach}'));

create policy "classroom_attendance: của mình, staff, phụ huynh"
  on public.classroom_attendance for select to authenticated
  using (
    student_id = (select auth.uid())
    or private.is_parent_of(student_id)
    or private.has_role(private.classroom_academy(classroom_id), '{owner,coach}')
  );
create policy "classroom_attendance: staff ghi"
  on public.classroom_attendance for insert to authenticated
  with check (
    private.has_role(private.classroom_academy(classroom_id), '{owner,coach}')
    and exists (
      select 1 from public.memberships m
      where m.academy_id = private.classroom_academy(classroom_id) and m.user_id = student_id and m.role = 'student'
    )
  );
create policy "classroom_attendance: staff sửa"
  on public.classroom_attendance for update to authenticated
  using (private.has_role(private.classroom_academy(classroom_id), '{owner,coach}'))
  with check (private.has_role(private.classroom_academy(classroom_id), '{owner,coach}'));
create policy "classroom_attendance: staff xoá"
  on public.classroom_attendance for delete to authenticated
  using (private.has_role(private.classroom_academy(classroom_id), '{owner,coach}'));

create policy "classroom_events: người xem được lớp"
  on public.classroom_events for select to authenticated
  using (private.can_view_classroom(classroom_id));
create policy "classroom_events: chat của mình, còn lại do người điều khiển"
  on public.classroom_events for insert to authenticated
  with check (
    actor_id = (select auth.uid())
    and (
      private.can_run_classroom(classroom_id)
      or (kind = 'chat' and private.can_view_classroom(classroom_id))
    )
  );

create policy "coach_availability: staff đọc"
  on public.coach_availability for select to authenticated
  using (private.has_role(academy_id, '{owner,coach}'));
create policy "coach_availability: owner hoặc chính HLV ghi"
  on public.coach_availability for insert to authenticated
  with check (
    private.has_role(academy_id, '{owner}')
    or (coach_id = (select auth.uid()) and private.has_role(academy_id, '{coach}'))
  );
create policy "coach_availability: owner hoặc chính HLV sửa"
  on public.coach_availability for update to authenticated
  using (
    private.has_role(academy_id, '{owner}')
    or (coach_id = (select auth.uid()) and private.has_role(academy_id, '{coach}'))
  )
  with check (
    private.has_role(academy_id, '{owner}')
    or (coach_id = (select auth.uid()) and private.has_role(academy_id, '{coach}'))
  );
create policy "coach_availability: owner hoặc chính HLV xoá"
  on public.coach_availability for delete to authenticated
  using (
    private.has_role(academy_id, '{owner}')
    or (coach_id = (select auth.uid()) and private.has_role(academy_id, '{coach}'))
  );

create policy "calendar_events: staff đọc"
  on public.calendar_events for select to authenticated
  using (private.has_role(academy_id, '{owner,coach}'));
create policy "calendar_events: staff tạo (không phải sự kiện lớp)"
  on public.calendar_events for insert to authenticated
  with check (
    kind <> 'class' and classroom_id is null
    and created_by = (select auth.uid())
    and (
      private.has_role(academy_id, '{owner}')
      or (private.has_role(academy_id, '{coach}') and (coach_id is null or coach_id = (select auth.uid())))
    )
  );
create policy "calendar_events: owner hoặc người tạo sửa"
  on public.calendar_events for update to authenticated
  using (classroom_id is null and (private.has_role(academy_id, '{owner}') or created_by = (select auth.uid())))
  with check (kind <> 'class' and classroom_id is null and private.has_role(academy_id, '{owner,coach}'));
create policy "calendar_events: owner hoặc người tạo xoá"
  on public.calendar_events for delete to authenticated
  using (classroom_id is null and (private.has_role(academy_id, '{owner}') or created_by = (select auth.uid())));
