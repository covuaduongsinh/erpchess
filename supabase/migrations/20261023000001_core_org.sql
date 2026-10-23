-- Giai đoạn 2: tổ chức (học viện, thành viên, lớp, phụ huynh, lời mời) + RLS
-- Hàm hỗ trợ nằm trong schema `private` để không lộ qua PostgREST.

create extension if not exists citext with schema extensions;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create type public.academy_role as enum ('owner', 'coach', 'student', 'parent');

-- ───────────────────────── Bảng ─────────────────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  username extensions.citext unique check (username ~ '^[a-z0-9_.]{3,32}$'),
  avatar_url text,
  locale text not null default 'vi' check (locale in ('vi', 'en')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.academies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug extensions.citext not null unique check (slug ~ '^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])$'),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.memberships (
  academy_id uuid not null references public.academies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.academy_role not null,
  created_at timestamptz not null default now(),
  primary key (academy_id, user_id)
);
create index memberships_user_id_idx on public.memberships (user_id);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  coach_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index groups_academy_id_idx on public.groups (academy_id);
create index groups_coach_id_idx on public.groups (coach_id);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, student_id)
);
create index group_members_student_id_idx on public.group_members (student_id);

create table public.parent_links (
  academy_id uuid not null references public.academies (id) on delete cascade,
  parent_id uuid not null references public.profiles (id) on delete cascade,
  student_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (academy_id, parent_id, student_id)
);
create index parent_links_parent_id_idx on public.parent_links (parent_id);
create index parent_links_student_id_idx on public.parent_links (student_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  role public.academy_role not null check (role in ('coach', 'parent')),
  email extensions.citext,
  token text not null unique default encode(extensions.gen_random_bytes(24), 'hex'),
  student_id uuid references public.profiles (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  expires_at timestamptz not null default now() + interval '14 days',
  accepted_by uuid references public.profiles (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  check (role <> 'parent' or student_id is not null)
);
create index invitations_academy_id_idx on public.invitations (academy_id);
create index invitations_created_by_idx on public.invitations (created_by);
create index invitations_accepted_by_idx on public.invitations (accepted_by);
create index invitations_student_id_idx on public.invitations (student_id);
create index academies_created_by_idx on public.academies (created_by);

-- ───────────────────────── Hàm hỗ trợ RLS ─────────────────────────

create function private.has_role(p_academy uuid, p_roles public.academy_role[])
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.academy_id = p_academy
      and m.user_id = (select auth.uid())
      and m.role = any (p_roles)
  );
$$;

create function private.is_member(p_academy uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.academy_id = p_academy and m.user_id = (select auth.uid())
  );
$$;

create function private.is_parent_of(p_student uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.parent_links pl
    where pl.student_id = p_student and pl.parent_id = (select auth.uid())
  );
$$;

-- Hai người có chung ít nhất một học viện
create function private.shares_academy(p_user uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships a
    join public.memberships b on b.academy_id = a.academy_id
    where a.user_id = (select auth.uid()) and b.user_id = p_user
  );
$$;

create function private.in_group(p_group uuid, p_student uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.group_members gm
    where gm.group_id = p_group and gm.student_id = p_student
  );
$$;

create function private.child_in_group(p_group uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.group_members gm
    join public.parent_links pl on pl.student_id = gm.student_id
    where gm.group_id = p_group and pl.parent_id = (select auth.uid())
  );
$$;

grant execute on all functions in schema private to authenticated;

-- ───────────────────────── Trigger ─────────────────────────

create function private.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, username, locale)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1)),
    nullif(new.raw_user_meta_data ->> 'username', ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'locale', ''), 'vi')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

create function private.touch_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function private.touch_updated_at();

-- ───────────────────────── RLS ─────────────────────────

alter table public.profiles enable row level security;
alter table public.academies enable row level security;
alter table public.memberships enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.parent_links enable row level security;
alter table public.invitations enable row level security;

-- profiles
create policy "profiles: đọc của mình hoặc người cùng học viện"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.shares_academy(id));

create policy "profiles: tự sửa của mình"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- academies (tạo qua RPC create_academy)
create policy "academies: thành viên đọc"
  on public.academies for select to authenticated
  using (private.is_member(id));

create policy "academies: owner sửa"
  on public.academies for update to authenticated
  using (private.has_role(id, '{owner}'))
  with check (private.has_role(id, '{owner}'));

create policy "academies: owner xoá"
  on public.academies for delete to authenticated
  using (private.has_role(id, '{owner}'));

-- memberships
create policy "memberships: thành viên cùng học viện đọc"
  on public.memberships for select to authenticated
  using (private.is_member(academy_id));

create policy "memberships: owner thêm mọi role, coach chỉ thêm học viên"
  on public.memberships for insert to authenticated
  with check (
    private.has_role(academy_id, '{owner}')
    or (role = 'student' and private.has_role(academy_id, '{coach}'))
  );

create policy "memberships: owner đổi role (không áp dụng cho chính mình)"
  on public.memberships for update to authenticated
  using (private.has_role(academy_id, '{owner}') and user_id <> (select auth.uid()))
  with check (private.has_role(academy_id, '{owner}'));

create policy "memberships: owner xoá, coach xoá học viên, tự rời học viện"
  on public.memberships for delete to authenticated
  using (
    (private.has_role(academy_id, '{owner}') and user_id <> (select auth.uid()))
    or (role = 'student' and private.has_role(academy_id, '{coach}'))
    or (user_id = (select auth.uid()) and role <> 'owner')
  );

-- groups
create policy "groups: staff đọc mọi lớp, học viên/phụ huynh đọc lớp liên quan"
  on public.groups for select to authenticated
  using (
    private.has_role(academy_id, '{owner,coach}')
    or private.in_group(id, (select auth.uid()))
    or private.child_in_group(id)
  );

create policy "groups: staff tạo"
  on public.groups for insert to authenticated
  with check (private.has_role(academy_id, '{owner,coach}'));

create policy "groups: staff sửa"
  on public.groups for update to authenticated
  using (private.has_role(academy_id, '{owner,coach}'))
  with check (private.has_role(academy_id, '{owner,coach}'));

create policy "groups: staff xoá"
  on public.groups for delete to authenticated
  using (private.has_role(academy_id, '{owner,coach}'));

-- group_members: academy_id lấy qua lớp
create function private.group_academy(p_group uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select g.academy_id from public.groups g where g.id = p_group;
$$;
grant execute on function private.group_academy(uuid) to authenticated;

create policy "group_members: staff đọc, học viên đọc của mình, phụ huynh đọc của con"
  on public.group_members for select to authenticated
  using (
    private.has_role(private.group_academy(group_id), '{owner,coach}')
    or student_id = (select auth.uid())
    or private.is_parent_of(student_id)
  );

create policy "group_members: staff thêm học viên của học viện"
  on public.group_members for insert to authenticated
  with check (
    private.has_role(private.group_academy(group_id), '{owner,coach}')
    and exists (
      select 1 from public.memberships m
      where m.academy_id = private.group_academy(group_id)
        and m.user_id = student_id
        and m.role = 'student'
    )
  );

create policy "group_members: staff xoá"
  on public.group_members for delete to authenticated
  using (private.has_role(private.group_academy(group_id), '{owner,coach}'));

-- parent_links
create policy "parent_links: staff đọc, phụ huynh đọc của mình"
  on public.parent_links for select to authenticated
  using (
    private.has_role(academy_id, '{owner,coach}')
    or parent_id = (select auth.uid())
  );

create policy "parent_links: staff quản lý"
  on public.parent_links for insert to authenticated
  with check (private.has_role(academy_id, '{owner,coach}'));

create policy "parent_links: staff xoá"
  on public.parent_links for delete to authenticated
  using (private.has_role(academy_id, '{owner,coach}'));

-- invitations (tạo/chấp nhận qua RPC; owner đọc và thu hồi)
create policy "invitations: owner đọc"
  on public.invitations for select to authenticated
  using (private.has_role(academy_id, '{owner}'));

create policy "invitations: owner thu hồi"
  on public.invitations for delete to authenticated
  using (private.has_role(academy_id, '{owner}'));

-- ───────────────────────── RPC ─────────────────────────

create function public.create_academy(p_name text, p_slug text)
returns public.academies
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_academy public.academies;
begin
  if v_uid is null then
    raise exception 'Cần đăng nhập' using errcode = '42501';
  end if;
  if exists (select 1 from public.profiles p where p.id = v_uid and p.username is not null) then
    raise exception 'Tài khoản học viên không thể tạo học viện' using errcode = '42501';
  end if;

  insert into public.academies (name, slug, created_by)
  values (trim(p_name), lower(trim(p_slug)), v_uid)
  returning * into v_academy;

  insert into public.memberships (academy_id, user_id, role)
  values (v_academy.id, v_uid, 'owner');

  return v_academy;
end;
$$;

create function public.create_invitation(
  p_academy uuid,
  p_role public.academy_role,
  p_email text default null,
  p_student uuid default null
)
returns public.invitations
language plpgsql security definer set search_path = ''
as $$
declare
  v_inv public.invitations;
begin
  if not private.has_role(p_academy, '{owner}')
     and not (p_role = 'parent' and private.has_role(p_academy, '{coach}')) then
    raise exception 'Không có quyền mời' using errcode = '42501';
  end if;
  if p_role not in ('coach', 'parent') then
    raise exception 'Chỉ mời được HLV hoặc phụ huynh' using errcode = '22023';
  end if;
  if p_role = 'parent' and not exists (
    select 1 from public.memberships m
    where m.academy_id = p_academy and m.user_id = p_student and m.role = 'student'
  ) then
    raise exception 'Học viên không thuộc học viện' using errcode = '22023';
  end if;

  insert into public.invitations (academy_id, role, email, student_id, created_by)
  values (
    p_academy,
    p_role,
    nullif(trim(p_email), ''),
    case when p_role = 'parent' then p_student end,
    (select auth.uid())
  )
  returning * into v_inv;

  return v_inv;
end;
$$;

create function public.accept_invitation(p_token text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_inv public.invitations;
begin
  if v_uid is null then
    raise exception 'Cần đăng nhập' using errcode = '42501';
  end if;

  select * into v_inv from public.invitations i
  where i.token = p_token
  for update;

  if not found or v_inv.accepted_at is not null or v_inv.expires_at < now() then
    raise exception 'Lời mời không hợp lệ hoặc đã hết hạn' using errcode = '22023';
  end if;

  insert into public.memberships (academy_id, user_id, role)
  values (v_inv.academy_id, v_uid, v_inv.role)
  on conflict (academy_id, user_id) do nothing;

  if v_inv.role = 'parent' then
    insert into public.parent_links (academy_id, parent_id, student_id)
    values (v_inv.academy_id, v_uid, v_inv.student_id)
    on conflict do nothing;
  end if;

  update public.invitations
  set accepted_by = v_uid, accepted_at = now()
  where id = v_inv.id;

  return v_inv.academy_id;
end;
$$;

revoke execute on function public.create_academy(text, text) from public, anon;
revoke execute on function public.create_invitation(uuid, public.academy_role, text, uuid) from public, anon;
revoke execute on function public.accept_invitation(text) from public, anon;
grant execute on function public.create_academy(text, text) to authenticated;
grant execute on function public.create_invitation(uuid, public.academy_role, text, uuid) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
