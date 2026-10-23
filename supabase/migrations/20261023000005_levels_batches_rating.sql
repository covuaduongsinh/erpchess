-- Giai đoạn 5: cấp độ, batch, rating nội bộ, branding, bảng xếp hạng, số liệu học viện.

-- ───────────────────────── Branding ─────────────────────────

alter table public.academies
  add column description text not null default '' check (char_length(description) <= 2000),
  add column logo_url text check (logo_url is null or logo_url ~ '^https://'),
  add column socials jsonb not null default '{}' check (jsonb_typeof(socials) = 'object');

-- ───────────────────────── Cấp độ ─────────────────────────

create table public.levels (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  position int not null check (position >= 0),
  min_rating int not null default 0 check (min_rating >= 0),
  max_rating int check (max_rating is null or max_rating > min_rating),
  color text not null default '#2B3990' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  -- Điều kiện lên cấp, ví dụ { "xp": 500, "puzzles": 100, "tournaments": 2 }
  criteria jsonb not null default '{}' check (jsonb_typeof(criteria) = 'object'),
  created_at timestamptz not null default now(),
  unique (academy_id, position) deferrable initially deferred
);

alter table public.levels enable row level security;

create policy "levels: thành viên đọc"
  on public.levels for select to authenticated
  using (private.is_member(academy_id));

create policy "levels: owner tạo"
  on public.levels for insert to authenticated
  with check (private.has_role(academy_id, '{owner}'));

create policy "levels: owner sửa"
  on public.levels for update to authenticated
  using (private.has_role(academy_id, '{owner}'))
  with check (private.has_role(academy_id, '{owner}'));

create policy "levels: owner xoá"
  on public.levels for delete to authenticated
  using (private.has_role(academy_id, '{owner}'));

alter table public.memberships
  add column level_id uuid references public.levels (id) on delete set null;
create index memberships_level_id_idx on public.memberships (level_id);

-- Staff gán cấp cho học viên của học viện. Chính sách UPDATE của memberships chỉ dành cho owner đổi role,
-- nên việc gán cấp đi qua hàm này.
create function public.set_student_level(p_academy uuid, p_student uuid, p_level uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.has_role(p_academy, '{owner,coach}') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_level is not null and not exists (
    select 1 from public.levels l where l.id = p_level and l.academy_id = p_academy
  ) then
    raise exception 'level_not_in_academy' using errcode = '22023';
  end if;
  update public.memberships
  set level_id = p_level
  where academy_id = p_academy and user_id = p_student and role = 'student';
  if not found then
    raise exception 'student_not_found' using errcode = 'P0002';
  end if;
end;
$$;
revoke execute on function public.set_student_level(uuid, uuid, uuid) from public, anon;
grant execute on function public.set_student_level(uuid, uuid, uuid) to authenticated;

-- ───────────────────────── Batch ─────────────────────────

-- Batch là một lớp cố định: cùng cấp độ, cùng HLV, có lịch tuần.
alter table public.groups
  add column kind text not null default 'group' check (kind in ('group', 'batch')),
  add column level_id uuid references public.levels (id) on delete set null,
  -- [{ "day": 0-6 (0 = Chủ nhật), "start": "HH:MM", "minutes": 60 }]
  add column schedule jsonb not null default '[]' check (jsonb_typeof(schedule) = 'array');
create index groups_level_id_idx on public.groups (level_id);

-- ───────────────────────── Rating nội bộ ─────────────────────────

create table public.ratings (
  academy_id uuid not null references public.academies (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  category text not null check (category in ('classical', 'rapid', 'blitz')),
  rating numeric(7, 2) not null default 1500 check (rating between 0 and 4000),
  rd numeric(6, 2) not null default 350 check (rd > 0 and rd <= 350),
  vol numeric(8, 6) not null default 0.06 check (vol > 0),
  games int not null default 0 check (games >= 0),
  updated_at timestamptz not null default now(),
  primary key (academy_id, student_id, category)
);
create index ratings_student_id_idx on public.ratings (student_id);

alter table public.ratings enable row level security;

create policy "ratings: thành viên đọc"
  on public.ratings for select to authenticated
  using (private.is_member(academy_id));

create policy "ratings: staff đặt cho học viên của học viện"
  on public.ratings for insert to authenticated
  with check (
    private.has_role(academy_id, '{owner,coach}')
    and exists (
      select 1 from public.memberships m
      where m.academy_id = ratings.academy_id and m.user_id = ratings.student_id and m.role = 'student'
    )
  );

create policy "ratings: staff sửa"
  on public.ratings for update to authenticated
  using (private.has_role(academy_id, '{owner,coach}'))
  with check (private.has_role(academy_id, '{owner,coach}'));

create policy "ratings: staff xoá"
  on public.ratings for delete to authenticated
  using (private.has_role(academy_id, '{owner,coach}'));

-- ───────────────────────── Bảng xếp hạng, số liệu ─────────────────────────

-- Điểm = 10 × số câu giải đúng (theo thời điểm giải xong) trong [p_from, p_to).
create function public.academy_leaderboard(p_academy uuid, p_from timestamptz, p_to timestamptz)
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
  select
    m.user_id,
    p.display_name,
    p.avatar_url,
    (10 * count(at.id) filter (where at.solved))::int,
    count(at.id) filter (where at.solved)::int,
    coalesce(sum(at.tries), 0)::int
  from public.memberships m
  join public.profiles p on p.id = m.user_id
  left join public.attempts at
    on at.student_id = m.user_id
   and at.finished_at >= p_from and at.finished_at < p_to
   and exists (
     select 1 from public.assignment_items i
     join public.assignments a on a.id = i.assignment_id
     where i.id = at.item_id and a.academy_id = p_academy
   )
  where m.academy_id = p_academy
    and m.role = 'student'
    and private.is_member(p_academy)
  group by m.user_id, p.display_name, p.avatar_url
  order by 4 desc, 6 asc, 2 asc;
$$;
revoke execute on function public.academy_leaderboard(uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.academy_leaderboard(uuid, timestamptz, timestamptz) to authenticated;

create function public.academy_stats(p_academy uuid)
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
    (select count(*) from public.attempts at
       join public.assignment_items i on i.id = at.item_id
       join public.assignments a on a.id = i.assignment_id
      where a.academy_id = p_academy and at.updated_at >= now() - interval '7 days')::int
  where private.has_role(p_academy, '{owner,coach}');
$$;
revoke execute on function public.academy_stats(uuid) from public, anon;
grant execute on function public.academy_stats(uuid) to authenticated;
