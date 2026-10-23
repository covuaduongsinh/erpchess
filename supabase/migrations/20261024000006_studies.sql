-- Giai đoạn 6a: Study (chuỗi hoạt động học), Collections, lần làm hoạt động, kho media.
-- Payload từng loại hoạt động được kiểm ở client và Edge Function (packages/domain/src/study.ts);
-- ở đây chỉ chặn hình dạng thô để dữ liệu hỏng không lọt vào.

-- ───────────────────────── Bảng ─────────────────────────

create table public.studies (
  id uuid primary key default gen_random_uuid(),
  -- null = thư viện chung của nền tảng (chỉ service role ghi)
  academy_id uuid references public.academies (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '' check (char_length(description) <= 2000),
  level_id uuid references public.levels (id) on delete set null,
  visibility text not null default 'private' check (visibility in ('private', 'academy', 'public')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index studies_academy_id_idx on public.studies (academy_id);
create index studies_created_by_idx on public.studies (created_by);
create index studies_level_id_idx on public.studies (level_id);
create index studies_public_idx on public.studies (visibility) where visibility = 'public';

create table public.study_activities (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies (id) on delete cascade,
  position int not null check (position >= 0),
  kind text not null check (kind in ('puzzle', 'mcq', 'capture', 'explanation', 'engine', 'video', 'game')),
  title text not null default '' check (char_length(title) <= 160),
  payload jsonb not null check (jsonb_typeof(payload) = 'object' and pg_column_size(payload) <= 200000),
  points int not null default 10 check (points between 0 and 1000),
  max_attempts int check (max_attempts is null or max_attempts between 1 and 100),
  time_limit_s int check (time_limit_s is null or time_limit_s between 5 and 7200),
  wrong_penalty int not null default 0 check (wrong_penalty between 0 and 1000),
  hint_penalty int not null default 0 check (hint_penalty between 0 and 1000),
  topics text[] not null default '{}' check (cardinality(topics) <= 20),
  created_at timestamptz not null default now(),
  unique (study_id, position) deferrable initially deferred
);
create index study_activities_topics_idx on public.study_activities using gin (topics);

create table public.study_collections (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index study_collections_academy_id_idx on public.study_collections (academy_id);
create index study_collections_created_by_idx on public.study_collections (created_by);

create table public.study_collection_items (
  collection_id uuid not null references public.study_collections (id) on delete cascade,
  study_id uuid not null references public.studies (id) on delete cascade,
  position int not null default 0,
  primary key (collection_id, study_id)
);
create index study_collection_items_study_id_idx on public.study_collection_items (study_id);

create table public.activity_attempts (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.study_activities (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  -- Mọi câu trả lời đã nộp: [{ "try": 1, "answer": {...}, "ok": false, "ms": 1200 }, ...]
  answers jsonb not null default '[]',
  tries int not null default 0 check (tries >= 0),
  solved boolean not null default false,
  score int not null default 0 check (score >= 0),
  time_ms bigint not null default 0 check (time_ms >= 0),
  finished_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (activity_id, student_id)
);
create index activity_attempts_student_id_idx on public.activity_attempts (student_id);

create trigger studies_touch_updated_at
  before update on public.studies
  for each row execute function private.touch_updated_at();

-- ───────────────────────── Hàm hỗ trợ RLS ─────────────────────────

-- Người dùng p_user có được xem study không (dùng cả trong RLS lẫn Edge Function chạy bằng service role)
create function private.study_readable_by(p_study uuid, p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.studies s
    where s.id = p_study
      and (
        s.visibility = 'public'
        or s.created_by = p_user
        or (
          s.visibility = 'academy'
          and exists (
            select 1 from public.memberships m
            where m.academy_id = s.academy_id and m.user_id = p_user
          )
        )
      )
  );
$$;

-- Staff của học viện sửa study của mình; owner sửa mọi study của học viện
create function private.can_edit_study(p_study uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.studies s
    where s.id = p_study
      and s.academy_id is not null
      and (
        private.has_role(s.academy_id, '{owner}')
        or (s.created_by = (select auth.uid()) and private.has_role(s.academy_id, '{coach}'))
      )
  );
$$;

create function private.activity_study(p_activity uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select a.study_id from public.study_activities a where a.id = p_activity;
$$;

create function private.study_academy(p_study uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select s.academy_id from public.studies s where s.id = p_study;
$$;

grant execute on all functions in schema private to authenticated;

-- ───────────────────────── RLS ─────────────────────────

alter table public.studies enable row level security;
alter table public.study_activities enable row level security;
alter table public.study_collections enable row level security;
alter table public.study_collection_items enable row level security;
alter table public.activity_attempts enable row level security;

create policy "studies: đọc theo phạm vi hiển thị"
  on public.studies for select to authenticated
  using (private.study_readable_by(id, (select auth.uid())));

create policy "studies: staff tạo trong học viện"
  on public.studies for insert to authenticated
  with check (
    academy_id is not null
    and private.has_role(academy_id, '{owner,coach}')
    and created_by = (select auth.uid())
  );

create policy "studies: tác giả hoặc owner sửa"
  on public.studies for update to authenticated
  using (private.can_edit_study(id))
  with check (academy_id is not null and private.has_role(academy_id, '{owner,coach}'));

create policy "studies: tác giả hoặc owner xoá"
  on public.studies for delete to authenticated
  using (private.can_edit_study(id));

create policy "study_activities: theo quyền xem study"
  on public.study_activities for select to authenticated
  using (private.study_readable_by(study_id, (select auth.uid())));

create policy "study_activities: người sửa được study thì thêm"
  on public.study_activities for insert to authenticated
  with check (private.can_edit_study(study_id));

create policy "study_activities: người sửa được study thì sửa"
  on public.study_activities for update to authenticated
  using (private.can_edit_study(study_id))
  with check (private.can_edit_study(study_id));

create policy "study_activities: người sửa được study thì xoá"
  on public.study_activities for delete to authenticated
  using (private.can_edit_study(study_id));

create policy "study_collections: thành viên đọc"
  on public.study_collections for select to authenticated
  using (private.is_member(academy_id));

create policy "study_collections: staff tạo"
  on public.study_collections for insert to authenticated
  with check (private.has_role(academy_id, '{owner,coach}') and created_by = (select auth.uid()));

create policy "study_collections: staff sửa"
  on public.study_collections for update to authenticated
  using (private.has_role(academy_id, '{owner,coach}'))
  with check (private.has_role(academy_id, '{owner,coach}'));

create policy "study_collections: staff xoá"
  on public.study_collections for delete to authenticated
  using (private.has_role(academy_id, '{owner,coach}'));

create function private.collection_academy(p_collection uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select c.academy_id from public.study_collections c where c.id = p_collection;
$$;
grant execute on function private.collection_academy(uuid) to authenticated;

create policy "study_collection_items: thành viên đọc study xem được"
  on public.study_collection_items for select to authenticated
  using (
    private.is_member(private.collection_academy(collection_id))
    and private.study_readable_by(study_id, (select auth.uid()))
  );

create policy "study_collection_items: staff thêm study xem được"
  on public.study_collection_items for insert to authenticated
  with check (
    private.has_role(private.collection_academy(collection_id), '{owner,coach}')
    and private.study_readable_by(study_id, (select auth.uid()))
  );

create policy "study_collection_items: staff sửa thứ tự"
  on public.study_collection_items for update to authenticated
  using (private.has_role(private.collection_academy(collection_id), '{owner,coach}'))
  with check (private.has_role(private.collection_academy(collection_id), '{owner,coach}'));

create policy "study_collection_items: staff gỡ"
  on public.study_collection_items for delete to authenticated
  using (private.has_role(private.collection_academy(collection_id), '{owner,coach}'));

-- Chỉ Edge Function (service role) ghi; người dùng chỉ đọc
create policy "activity_attempts: của mình, staff của học viện sở hữu study, phụ huynh"
  on public.activity_attempts for select to authenticated
  using (
    student_id = (select auth.uid())
    or private.is_parent_of(student_id)
    or private.has_role(
      private.study_academy(private.activity_study(activity_id)), '{owner,coach}'
    )
  );

-- ───────────────────────── Tiến độ ─────────────────────────

create view public.study_progress
with (security_invoker = true)
as
select
  a.study_id,
  at.student_id,
  (select count(*) from public.study_activities x where x.study_id = a.study_id)::int as total_activities,
  count(*) filter (where at.solved)::int as completed,
  coalesce(sum(at.score), 0)::int as score,
  coalesce(sum(at.time_ms), 0)::bigint as time_ms,
  max(at.updated_at) as last_activity
from public.activity_attempts at
join public.study_activities a on a.id = at.activity_id
group by a.study_id, at.student_id;

grant select on public.study_progress to authenticated;

-- ───────────────────────── Dành cho Edge Function ─────────────────────────

-- Lấy hoạt động để chấm nếu học viên được xem study chứa nó. Chỉ service role gọi được.
create function public.activity_for_student(p_activity uuid, p_student uuid)
returns table (
  kind text,
  payload jsonb,
  points int,
  max_attempts int,
  wrong_penalty int,
  hint_penalty int
)
language sql stable security definer set search_path = ''
as $$
  select a.kind, a.payload, a.points, a.max_attempts, a.wrong_penalty, a.hint_penalty
  from public.study_activities a
  where a.id = p_activity
    and private.study_readable_by(a.study_id, p_student);
$$;
revoke execute on function public.activity_for_student(uuid, uuid) from public, anon, authenticated;
grant execute on function public.activity_for_student(uuid, uuid) to service_role;

-- ───────────────────────── Storage ─────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'study-media', 'study-media', false, 104857600,
  array['video/mp4', 'video/webm', 'image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- Đường dẫn: <academy_id>/<study_id>/<tên tệp>; thư mục đầu không phải uuid thì coi như không thuộc học viện nào
create function private.path_academy(p_name text)
returns uuid
language plpgsql immutable set search_path = ''
as $$
begin
  return (storage.foldername(p_name))[1]::uuid;
exception when others then
  return null;
end;
$$;
grant execute on function private.path_academy(text) to authenticated;

create policy "study-media: thành viên học viện đọc"
  on storage.objects for select to authenticated
  using (bucket_id = 'study-media' and private.is_member(private.path_academy(name)));

create policy "study-media: staff tải lên"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'study-media' and private.has_role(private.path_academy(name), '{owner,coach}')
  );

create policy "study-media: staff sửa"
  on storage.objects for update to authenticated
  using (bucket_id = 'study-media' and private.has_role(private.path_academy(name), '{owner,coach}'))
  with check (
    bucket_id = 'study-media' and private.has_role(private.path_academy(name), '{owner,coach}')
  );

create policy "study-media: staff xoá"
  on storage.objects for delete to authenticated
  using (bucket_id = 'study-media' and private.has_role(private.path_academy(name), '{owner,coach}'));
