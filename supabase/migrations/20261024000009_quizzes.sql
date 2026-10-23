-- Giai đoạn 7a: Quiz — đề do HLV ghép (chụp lại từ Study hoặc thư viện puzzle), giao cho học viên,
-- có lịch mở/đóng. Khác Study: học viên KHÔNG đọc được đáp án. Đề đi qua RPC đã lược đáp án;
-- puzzle được chấm từng nước ở Edge Function `quiz-answer` (server trả nước đáp của đối phương).

-- ───────────────────────── Bảng ─────────────────────────

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  level_id uuid references public.levels (id) on delete set null,
  topics text[] not null default '{}' check (cardinality(topics) <= 20),
  -- true: mọi học viên của học viện làm được; false: chỉ người/lớp trong quiz_targets
  open_to_all boolean not null default false,
  starts_at timestamptz,
  due_at timestamptz check (due_at is null or starts_at is null or due_at > starts_at),
  auto boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index quizzes_academy_id_idx on public.quizzes (academy_id, created_at desc);
create index quizzes_created_by_idx on public.quizzes (created_by);
create index quizzes_level_id_idx on public.quizzes (level_id);

create table public.quiz_items (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  position int not null check (position >= 0),
  kind text not null check (kind in ('puzzle', 'mcq', 'capture')),
  title text not null default '' check (char_length(title) <= 160),
  -- Bản chụp payload kèm đáp án; sửa Study về sau không đổi quiz đã giao
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 50000),
  points int not null default 10 check (points between 0 and 1000),
  max_attempts int check (max_attempts is null or max_attempts between 1 and 100),
  wrong_penalty int not null default 0 check (wrong_penalty between 0 and 1000),
  source_activity_id uuid references public.study_activities (id) on delete set null,
  unique (quiz_id, position)
);
create index quiz_items_source_activity_id_idx on public.quiz_items (source_activity_id);

create table public.quiz_targets (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes (id) on delete cascade,
  group_id uuid references public.groups (id) on delete cascade,
  student_id uuid references public.profiles (id) on delete cascade,
  check ((group_id is null) <> (student_id is null))
);
create unique index quiz_targets_group_uidx on public.quiz_targets (quiz_id, group_id) where group_id is not null;
create unique index quiz_targets_student_uidx on public.quiz_targets (quiz_id, student_id) where student_id is not null;
create index quiz_targets_group_id_idx on public.quiz_targets (group_id);
create index quiz_targets_student_id_idx on public.quiz_targets (student_id);

create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.quiz_items (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  answers jsonb not null default '[]',
  tries int not null default 0 check (tries >= 0),
  solved boolean not null default false,
  score int not null default 0 check (score >= 0),
  time_ms bigint not null default 0 check (time_ms >= 0),
  -- Tiến độ puzzle đang làm dở: { "step": 2, "moves": ["e2e4", ...] }
  state jsonb not null default '{}',
  finished_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (item_id, student_id)
);
create index quiz_attempts_student_id_idx on public.quiz_attempts (student_id);

-- ───────────────────────── Hàm hỗ trợ ─────────────────────────

create function private.quiz_academy(p_quiz uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select q.academy_id from public.quizzes q where q.id = p_quiz;
$$;

create function private.item_quiz(p_item uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select i.quiz_id from public.quiz_items i where i.id = p_item;
$$;

-- Quiz giao cho người dùng p_user: mở cho cả học viện (p_user là học viên) hoặc giao trực tiếp/qua lớp
create function private.quiz_open_to(p_quiz uuid, p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.quizzes q
    where q.id = p_quiz
      and (
        (q.open_to_all and exists (
          select 1 from public.memberships m
          where m.academy_id = q.academy_id and m.user_id = p_user and m.role = 'student'
        ))
        or exists (
          select 1 from public.quiz_targets t
          where t.quiz_id = q.id
            and (
              t.student_id = p_user
              or t.group_id in (select gm.group_id from public.group_members gm where gm.student_id = p_user)
            )
        )
      )
  );
$$;

create function private.can_view_quiz(p_quiz uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select private.has_role(private.quiz_academy(p_quiz), '{owner,coach}')
    or private.quiz_open_to(p_quiz, (select auth.uid()))
    or exists (
      select 1 from public.parent_links pl
      where pl.parent_id = (select auth.uid()) and private.quiz_open_to(p_quiz, pl.student_id)
    );
$$;

grant execute on all functions in schema private to authenticated;

-- ───────────────────────── RLS ─────────────────────────

alter table public.quizzes enable row level security;
alter table public.quiz_items enable row level security;
alter table public.quiz_targets enable row level security;
alter table public.quiz_attempts enable row level security;

-- Staff kiểm thẳng trên cột của dòng để INSERT … RETURNING thấy dòng vừa chèn
create policy "quizzes: staff, người được giao, phụ huynh của họ đọc"
  on public.quizzes for select to authenticated
  using (private.has_role(academy_id, '{owner,coach}') or private.can_view_quiz(id));

create policy "quizzes: staff tạo"
  on public.quizzes for insert to authenticated
  with check (private.has_role(academy_id, '{owner,coach}') and created_by = (select auth.uid()));

create policy "quizzes: staff sửa"
  on public.quizzes for update to authenticated
  using (private.has_role(academy_id, '{owner,coach}'))
  with check (private.has_role(academy_id, '{owner,coach}'));

create policy "quizzes: staff xoá"
  on public.quizzes for delete to authenticated
  using (private.has_role(academy_id, '{owner,coach}'));

-- Chỉ staff đọc đề có đáp án; học viên lấy đề qua quiz_items_for_student
create policy "quiz_items: chỉ staff"
  on public.quiz_items for all to authenticated
  using (private.has_role(private.quiz_academy(quiz_id), '{owner,coach}'))
  with check (private.has_role(private.quiz_academy(quiz_id), '{owner,coach}'));

create policy "quiz_targets: staff thấy hết, người khác chỉ dòng của mình"
  on public.quiz_targets for select to authenticated
  using (
    private.has_role(private.quiz_academy(quiz_id), '{owner,coach}')
    or student_id = (select auth.uid())
    or (student_id is not null and private.is_parent_of(student_id))
    or (group_id is not null and (private.in_group(group_id, (select auth.uid())) or private.child_in_group(group_id)))
  );

create policy "quiz_targets: staff giao trong học viện"
  on public.quiz_targets for insert to authenticated
  with check (
    private.has_role(private.quiz_academy(quiz_id), '{owner,coach}')
    and (
      (group_id is not null and private.group_academy(group_id) = private.quiz_academy(quiz_id))
      or (student_id is not null and exists (
        select 1 from public.memberships m
        where m.academy_id = private.quiz_academy(quiz_id) and m.user_id = student_id and m.role = 'student'
      ))
    )
  );

create policy "quiz_targets: staff gỡ"
  on public.quiz_targets for delete to authenticated
  using (private.has_role(private.quiz_academy(quiz_id), '{owner,coach}'));

create policy "quiz_attempts: của mình, staff, phụ huynh"
  on public.quiz_attempts for select to authenticated
  using (
    student_id = (select auth.uid())
    or private.is_parent_of(student_id)
    or private.has_role(private.quiz_academy(private.item_quiz(item_id)), '{owner,coach}')
  );

-- ───────────────────────── Đề cho học viên, bảng xếp hạng, tiến độ ─────────────────────────

-- Đề đã lược đáp án; chỉ trả khi người gọi xem được quiz và quiz đã mở
create function public.quiz_items_for_student(p_quiz uuid)
returns table (id uuid, item_position int, kind text, title text, points int, max_attempts int, payload jsonb)
language sql stable security definer set search_path = ''
as $$
  select i.id, i.position, i.kind, i.title, i.points, i.max_attempts,
    case i.kind
      when 'puzzle' then jsonb_build_object('fen', i.payload -> 'fen')
      when 'mcq' then i.payload - 'correct'
      else i.payload
    end
  from public.quiz_items i
  join public.quizzes q on q.id = i.quiz_id
  where i.quiz_id = p_quiz
    and private.can_view_quiz(p_quiz)
    and (q.starts_at is null or q.starts_at <= now())
  order by i.position;
$$;
revoke execute on function public.quiz_items_for_student(uuid) from public, anon;
grant execute on function public.quiz_items_for_student(uuid) to authenticated;

create function public.quiz_leaderboard(p_quiz uuid)
returns table (student_id uuid, display_name text, score int, solved int, time_ms bigint)
language sql stable security definer set search_path = ''
as $$
  with q as (select * from public.quizzes where id = p_quiz and private.can_view_quiz(p_quiz)),
  takers as (
    select m.user_id as sid from q
    join public.memberships m on m.academy_id = q.academy_id and m.role = 'student'
    where q.open_to_all
    union
    select t.student_id from public.quiz_targets t join q on q.id = t.quiz_id where t.student_id is not null
    union
    select gm.student_id from public.quiz_targets t join q on q.id = t.quiz_id
    join public.group_members gm on gm.group_id = t.group_id
  )
  select k.sid, p.display_name,
    coalesce(sum(a.score), 0)::int,
    (count(a.id) filter (where a.solved))::int,
    coalesce(sum(a.time_ms), 0)::bigint
  from takers k
  join public.profiles p on p.id = k.sid
  left join public.quiz_items i on i.quiz_id = p_quiz
  left join public.quiz_attempts a on a.item_id = i.id and a.student_id = k.sid
  group by k.sid, p.display_name
  order by 3 desc, 5 asc, 2 asc;
$$;
revoke execute on function public.quiz_leaderboard(uuid) from public, anon;
grant execute on function public.quiz_leaderboard(uuid) to authenticated;

create view public.quiz_progress
with (security_invoker = true)
as
select
  i.quiz_id,
  a.student_id,
  (select count(*) from public.quiz_items x where x.quiz_id = i.quiz_id)::int as total_items,
  count(*) filter (where a.solved)::int as solved_items,
  coalesce(sum(a.score), 0)::int as score,
  coalesce(sum(a.tries), 0)::int as tries,
  coalesce(sum(a.time_ms), 0)::bigint as time_ms,
  max(a.updated_at) as last_activity
from public.quiz_attempts a
join public.quiz_items i on i.id = a.item_id
group by i.quiz_id, a.student_id;
grant select on public.quiz_progress to authenticated;

-- Dành cho Edge Function quiz-answer (service role): câu kèm đáp án nếu p_student được làm quiz.
-- Staff của học viện cũng làm thử được.
create function public.quiz_item_for_student(p_item uuid, p_student uuid)
returns table (
  kind text, payload jsonb, points int, max_attempts int, wrong_penalty int,
  starts_at timestamptz, due_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select i.kind, i.payload, i.points, i.max_attempts, i.wrong_penalty, q.starts_at, q.due_at
  from public.quiz_items i
  join public.quizzes q on q.id = i.quiz_id
  where i.id = p_item
    and (
      private.quiz_open_to(q.id, p_student)
      or exists (
        select 1 from public.memberships m
        where m.academy_id = q.academy_id and m.user_id = p_student and m.role in ('owner', 'coach')
      )
    );
$$;
revoke execute on function public.quiz_item_for_student(uuid, uuid) from public, anon, authenticated;
grant execute on function public.quiz_item_for_student(uuid, uuid) to service_role;
