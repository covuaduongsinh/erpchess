-- Giai đoạn 4: thư viện puzzle, bài tập, lần làm bài, báo cáo tiến độ.
-- Lần làm bài (attempts) chỉ được ghi bởi Edge Function submit-attempt (service role), nơi server
-- tự chấm lại bằng chess-core — client không có quyền insert/update để tránh gian lận.

-- ───────────────────────── Bảng ─────────────────────────

create table public.puzzles (
  id uuid primary key default gen_random_uuid(),
  -- null = thư viện chung cho mọi học viện
  academy_id uuid references public.academies (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  fen text not null check (char_length(fen) between 15 and 100),
  -- Lời giải UCI xen kẽ: nước người giải, nước đáp, ...; luôn kết thúc bằng nước người giải
  moves text[] not null check (
    cardinality(moves) between 1 and 39 and cardinality(moves) % 2 = 1
  ),
  rating int not null default 1000 check (rating between 100 and 3500),
  themes text[] not null default '{}',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index puzzles_academy_id_idx on public.puzzles (academy_id);
create index puzzles_created_by_idx on public.puzzles (created_by);
create index puzzles_themes_idx on public.puzzles using gin (themes);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  instructions text check (char_length(instructions) <= 2000),
  due_at timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index assignments_academy_id_idx on public.assignments (academy_id);
create index assignments_created_by_idx on public.assignments (created_by);

create table public.assignment_targets (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  group_id uuid references public.groups (id) on delete cascade,
  student_id uuid references public.profiles (id) on delete cascade,
  check (num_nonnulls(group_id, student_id) = 1),
  unique (assignment_id, group_id),
  unique (assignment_id, student_id)
);
create index assignment_targets_group_id_idx on public.assignment_targets (group_id);
create index assignment_targets_student_id_idx on public.assignment_targets (student_id);

create table public.assignment_items (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments (id) on delete cascade,
  position int not null check (position >= 0),
  puzzle_id uuid not null references public.puzzles (id) on delete restrict,
  unique (assignment_id, position)
);
create index assignment_items_puzzle_id_idx on public.assignment_items (puzzle_id);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.assignment_items (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  -- Mọi nước đã thử: [{ "uci": "e2e4", "ms": 1200, "ok": true, "try": 1 }, ...]
  moves jsonb not null default '[]',
  tries int not null default 0 check (tries >= 0),
  solved boolean not null default false,
  time_ms bigint not null default 0 check (time_ms >= 0),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (item_id, student_id)
);
create index attempts_student_id_idx on public.attempts (student_id);

-- ───────────────────────── Hàm hỗ trợ RLS ─────────────────────────

create function private.assignment_academy(p_assignment uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select a.academy_id from public.assignments a where a.id = p_assignment;
$$;

-- Bài được giao cho học viên: trực tiếp hoặc qua lớp học viên đang học
create function private.is_assigned(p_assignment uuid, p_student uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.assignment_targets t
    where t.assignment_id = p_assignment
      and (
        t.student_id = p_student
        or t.group_id in (select gm.group_id from public.group_members gm where gm.student_id = p_student)
      )
  );
$$;

create function private.can_view_assignment(p_assignment uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.has_role(private.assignment_academy(p_assignment), '{owner,coach}')
    or private.is_assigned(p_assignment, (select auth.uid()))
    or exists (
      select 1 from public.parent_links pl
      where pl.parent_id = (select auth.uid())
        and private.is_assigned(p_assignment, pl.student_id)
    );
$$;

create function private.item_assignment(p_item uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select i.assignment_id from public.assignment_items i where i.id = p_item;
$$;

grant execute on all functions in schema private to authenticated;

-- ───────────────────────── RLS ─────────────────────────

alter table public.puzzles enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_targets enable row level security;
alter table public.assignment_items enable row level security;
alter table public.attempts enable row level security;

-- puzzles: thư viện chung ai đăng nhập cũng đọc; puzzle của học viện chỉ thành viên đọc
create policy "puzzles: đọc thư viện chung và của học viện mình"
  on public.puzzles for select to authenticated
  using (academy_id is null or private.is_member(academy_id));

create policy "puzzles: staff tạo cho học viện"
  on public.puzzles for insert to authenticated
  with check (academy_id is not null and private.has_role(academy_id, '{owner,coach}'));

create policy "puzzles: staff sửa"
  on public.puzzles for update to authenticated
  using (academy_id is not null and private.has_role(academy_id, '{owner,coach}'))
  with check (academy_id is not null and private.has_role(academy_id, '{owner,coach}'));

create policy "puzzles: staff xoá"
  on public.puzzles for delete to authenticated
  using (academy_id is not null and private.has_role(academy_id, '{owner,coach}'));

-- assignments
create policy "assignments: staff, học viên được giao, phụ huynh của học viên đọc"
  on public.assignments for select to authenticated
  using (private.can_view_assignment(id));

create policy "assignments: staff tạo"
  on public.assignments for insert to authenticated
  with check (private.has_role(academy_id, '{owner,coach}'));

create policy "assignments: staff sửa"
  on public.assignments for update to authenticated
  using (private.has_role(academy_id, '{owner,coach}'))
  with check (private.has_role(academy_id, '{owner,coach}'));

create policy "assignments: staff xoá"
  on public.assignments for delete to authenticated
  using (private.has_role(academy_id, '{owner,coach}'));

-- assignment_targets: chỉ giao cho lớp/học viên thuộc cùng học viện
create policy "assignment_targets: theo quyền xem bài tập"
  on public.assignment_targets for select to authenticated
  using (private.can_view_assignment(assignment_id));

create policy "assignment_targets: staff giao trong học viện"
  on public.assignment_targets for insert to authenticated
  with check (
    private.has_role(private.assignment_academy(assignment_id), '{owner,coach}')
    and (
      (group_id is not null and private.group_academy(group_id) = private.assignment_academy(assignment_id))
      or (
        student_id is not null and exists (
          select 1 from public.memberships m
          where m.academy_id = private.assignment_academy(assignment_id)
            and m.user_id = student_id
            and m.role = 'student'
        )
      )
    )
  );

create policy "assignment_targets: staff gỡ"
  on public.assignment_targets for delete to authenticated
  using (private.has_role(private.assignment_academy(assignment_id), '{owner,coach}'));

-- assignment_items: chỉ dùng puzzle xem được (thư viện chung hoặc của cùng học viện)
create policy "assignment_items: theo quyền xem bài tập"
  on public.assignment_items for select to authenticated
  using (private.can_view_assignment(assignment_id));

create policy "assignment_items: staff thêm"
  on public.assignment_items for insert to authenticated
  with check (
    private.has_role(private.assignment_academy(assignment_id), '{owner,coach}')
    and exists (
      select 1 from public.puzzles p
      where p.id = puzzle_id
        and (p.academy_id is null or p.academy_id = private.assignment_academy(assignment_id))
    )
  );

create policy "assignment_items: staff xoá"
  on public.assignment_items for delete to authenticated
  using (private.has_role(private.assignment_academy(assignment_id), '{owner,coach}'));

-- attempts: KHÔNG có policy insert/update cho client — chỉ Edge Function (service role) ghi
create policy "attempts: học viên đọc của mình, staff đọc trong học viện, phụ huynh đọc của con"
  on public.attempts for select to authenticated
  using (
    student_id = (select auth.uid())
    or private.has_role(private.assignment_academy(private.item_assignment(item_id)), '{owner,coach}')
    or private.is_parent_of(student_id)
  );

-- ───────────────────────── Báo cáo ─────────────────────────

-- Tiến độ theo học viên × bài tập. security_invoker: RLS của các bảng nguồn áp cho người xem.
create view public.assignment_progress
with (security_invoker = true)
as
with assigned as (
  select t.assignment_id, t.student_id
  from public.assignment_targets t
  where t.student_id is not null
  union
  select t.assignment_id, gm.student_id
  from public.assignment_targets t
  join public.group_members gm on gm.group_id = t.group_id
)
select
  a.id as assignment_id,
  a.academy_id,
  s.student_id,
  (select count(*) from public.assignment_items i where i.assignment_id = a.id)::int as total_items,
  count(at.id) filter (where at.solved)::int as solved_items,
  coalesce(sum(at.tries), 0)::int as tries,
  coalesce(sum(at.time_ms), 0)::bigint as time_ms,
  max(at.updated_at) as last_activity
from public.assignments a
join assigned s on s.assignment_id = a.id
left join public.assignment_items i on i.assignment_id = a.id
left join public.attempts at on at.item_id = i.id and at.student_id = s.student_id
group by a.id, a.academy_id, s.student_id;

grant select on public.assignment_progress to authenticated;

-- ───────────────────────── Dành cho Edge Function ─────────────────────────

-- Lấy puzzle của một item nếu item thuộc bài được giao cho học viên. Chỉ service role gọi được.
create function public.puzzle_for_student_item(p_item uuid, p_student uuid)
returns table (puzzle_id uuid, fen text, moves text[])
language sql stable security definer set search_path = ''
as $$
  select p.id, p.fen, p.moves
  from public.assignment_items i
  join public.puzzles p on p.id = i.puzzle_id
  where i.id = p_item
    and private.is_assigned(i.assignment_id, p_student);
$$;
revoke execute on function public.puzzle_for_student_item(uuid, uuid) from public, anon, authenticated;
grant execute on function public.puzzle_for_student_item(uuid, uuid) to service_role;
