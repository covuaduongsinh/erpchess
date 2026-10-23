-- Giai đoạn 7c: Exercise (bài tập soạn một lần, giao nhiều lần) và Practice (chương thế cờ luyện với máy).

-- ───────────────────────── Exercise ─────────────────────────

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '' check (char_length(description) <= 2000),
  level_id uuid references public.levels (id) on delete set null,
  tags text[] not null default '{}' check (cardinality(tags) <= 20),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index exercises_academy_id_idx on public.exercises (academy_id, created_at desc);
create index exercises_created_by_idx on public.exercises (created_by);
create index exercises_level_id_idx on public.exercises (level_id);

create table public.exercise_items (
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  position int not null check (position >= 0),
  puzzle_id uuid not null references public.puzzles (id) on delete cascade,
  primary key (exercise_id, position)
);
create index exercise_items_puzzle_id_idx on public.exercise_items (puzzle_id);

-- Lần giao ghi lại Exercise gốc (puzzle được chép sang assignment_items như cũ)
alter table public.assignments
  add column exercise_id uuid references public.exercises (id) on delete set null;
create index assignments_exercise_id_idx on public.assignments (exercise_id);

create function private.exercise_academy(p_exercise uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select e.academy_id from public.exercises e where e.id = p_exercise;
$$;

alter table public.exercises enable row level security;
alter table public.exercise_items enable row level security;

create policy "exercises: staff đọc"
  on public.exercises for select to authenticated
  using (private.has_role(academy_id, '{owner,coach}'));
create policy "exercises: staff tạo"
  on public.exercises for insert to authenticated
  with check (private.has_role(academy_id, '{owner,coach}') and created_by = (select auth.uid()));
create policy "exercises: staff sửa"
  on public.exercises for update to authenticated
  using (private.has_role(academy_id, '{owner,coach}'))
  with check (private.has_role(academy_id, '{owner,coach}'));
create policy "exercises: staff xoá"
  on public.exercises for delete to authenticated
  using (private.has_role(academy_id, '{owner,coach}'));

create policy "exercise_items: staff"
  on public.exercise_items for all to authenticated
  using (private.has_role(private.exercise_academy(exercise_id), '{owner,coach}'))
  with check (private.has_role(private.exercise_academy(exercise_id), '{owner,coach}'));

-- ───────────────────────── Practice ─────────────────────────

create table public.practice_chapters (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '' check (char_length(description) <= 2000),
  visibility text not null default 'academy' check (visibility in ('private', 'academy')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index practice_chapters_academy_id_idx on public.practice_chapters (academy_id);
create index practice_chapters_created_by_idx on public.practice_chapters (created_by);

create table public.practice_positions (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.practice_chapters (id) on delete cascade,
  position int not null check (position >= 0),
  title text not null default '' check (char_length(title) <= 160),
  fen text not null check (char_length(fen) between 15 and 100),
  side text not null check (side in ('w', 'b')),
  goal text not null default 'win' check (goal in ('win', 'draw')),
  elo int check (elo is null or elo between 1000 and 3500),
  unique (chapter_id, position) deferrable initially deferred
);

-- Kết quả do client tự báo (chưa chạy engine phía server); để HLV theo dõi việc luyện tập
create table public.practice_results (
  id uuid primary key default gen_random_uuid(),
  position_id uuid not null references public.practice_positions (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  result text not null check (result in ('win', 'draw', 'loss')),
  moves int not null default 0 check (moves between 0 and 1000),
  created_at timestamptz not null default now()
);
create index practice_results_position_id_idx on public.practice_results (position_id);
create index practice_results_student_id_idx on public.practice_results (student_id, created_at desc);

create function private.chapter_readable(p_chapter uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.practice_chapters c
    where c.id = p_chapter
      and (c.created_by = (select auth.uid()) or (c.visibility = 'academy' and private.is_member(c.academy_id)))
  );
$$;

create function private.can_edit_chapter(p_chapter uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.practice_chapters c
    where c.id = p_chapter
      and (
        private.has_role(c.academy_id, '{owner}')
        or (c.created_by = (select auth.uid()) and private.has_role(c.academy_id, '{coach}'))
      )
  );
$$;

create function private.position_chapter(p_position uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select p.chapter_id from public.practice_positions p where p.id = p_position;
$$;

create function private.chapter_academy(p_chapter uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select c.academy_id from public.practice_chapters c where c.id = p_chapter;
$$;

grant execute on all functions in schema private to authenticated;

alter table public.practice_chapters enable row level security;
alter table public.practice_positions enable row level security;
alter table public.practice_results enable row level security;

-- Kiểm trên cột của dòng để INSERT … RETURNING thấy dòng vừa chèn
create policy "practice_chapters: tác giả hoặc thành viên khi chia sẻ"
  on public.practice_chapters for select to authenticated
  using (created_by = (select auth.uid()) or (visibility = 'academy' and private.is_member(academy_id)));
create policy "practice_chapters: staff tạo"
  on public.practice_chapters for insert to authenticated
  with check (private.has_role(academy_id, '{owner,coach}') and created_by = (select auth.uid()));
create policy "practice_chapters: tác giả hoặc owner sửa"
  on public.practice_chapters for update to authenticated
  using (private.can_edit_chapter(id))
  with check (private.has_role(academy_id, '{owner,coach}'));
create policy "practice_chapters: tác giả hoặc owner xoá"
  on public.practice_chapters for delete to authenticated
  using (private.can_edit_chapter(id));

create policy "practice_positions: theo quyền xem chương"
  on public.practice_positions for select to authenticated
  using (private.chapter_readable(chapter_id));
create policy "practice_positions: người sửa được chương thì thêm"
  on public.practice_positions for insert to authenticated
  with check (private.can_edit_chapter(chapter_id));
create policy "practice_positions: người sửa được chương thì sửa"
  on public.practice_positions for update to authenticated
  using (private.can_edit_chapter(chapter_id))
  with check (private.can_edit_chapter(chapter_id));
create policy "practice_positions: người sửa được chương thì xoá"
  on public.practice_positions for delete to authenticated
  using (private.can_edit_chapter(chapter_id));

create policy "practice_results: tự ghi kết quả của mình"
  on public.practice_results for insert to authenticated
  with check (
    student_id = (select auth.uid())
    and private.chapter_readable(private.position_chapter(position_id))
  );
create policy "practice_results: của mình, staff, phụ huynh"
  on public.practice_results for select to authenticated
  using (
    student_id = (select auth.uid())
    or private.is_parent_of(student_id)
    or private.has_role(private.chapter_academy(private.position_chapter(position_id)), '{owner,coach}')
  );
