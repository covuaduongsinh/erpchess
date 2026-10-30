-- Giai đoạn 23a: địa điểm học viện (trung tâm, trường học, CLB…) và hình thức học của batch.
-- Đặc tả quan sát bằng REA (rea/spec/quan-tri.md mục Location): mỗi địa điểm có loại, tên, cờ
-- "cơ sở chính" (tối đa một), địa chỉ, ngày làm việc, giờ mở/đóng, múi giờ, người liên hệ.
-- Batch học Offline/Hybrid phải gắn một địa điểm.

create table public.academy_locations (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  kind text not null default 'centre'
    check (kind in ('centre', 'school', 'club_house', 'community_centre', 'library', 'other')),
  name text not null check (char_length(name) between 2 and 120),
  is_main boolean not null default false,
  address_line text not null default '' check (char_length(address_line) <= 300),
  country text not null check (char_length(country) between 2 and 64),
  state text not null default '' check (char_length(state) <= 64),
  city text not null default '' check (char_length(city) <= 64),
  -- 0 = Chủ nhật … 6 = Thứ bảy (cùng quy ước với lịch batch)
  working_days smallint[] not null
    check (cardinality(working_days) between 1 and 7 and working_days <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[]),
  opens_at time not null,
  closes_at time not null,
  timezone text not null default 'Asia/Ho_Chi_Minh' check (char_length(timezone) between 1 and 64),
  contact_name text not null check (char_length(contact_name) between 1 and 120),
  contact_phone text not null check (contact_phone ~ '^[+0-9][0-9 .()-]{5,29}$'),
  email text check (email is null or (char_length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
  notes text not null default '' check (char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  check (closes_at > opens_at)
);
create index academy_locations_academy_idx on public.academy_locations (academy_id, kind);
-- Mỗi học viện tối đa một cơ sở chính
create unique index academy_locations_one_main_idx
  on public.academy_locations (academy_id) where is_main;

alter table public.academy_locations enable row level security;

create policy "academy_locations: thành viên xem"
  on public.academy_locations for select to authenticated
  using (private.is_member(academy_id));

create policy "academy_locations: chủ học viện thêm"
  on public.academy_locations for insert to authenticated
  with check (private.has_role(academy_id, '{owner}'));

create policy "academy_locations: chủ học viện sửa"
  on public.academy_locations for update to authenticated
  using (private.has_role(academy_id, '{owner}'))
  with check (private.has_role(academy_id, '{owner}'));

create policy "academy_locations: chủ học viện xoá"
  on public.academy_locations for delete to authenticated
  using (private.has_role(academy_id, '{owner}'));

-- Hình thức học của batch: online / offline / hybrid; offline và hybrid gắn một địa điểm
alter table public.groups
  add column if not exists mode text not null default 'online' check (mode in ('online', 'offline', 'hybrid')),
  add column if not exists location_id uuid references public.academy_locations (id) on delete set null;
create index if not exists groups_location_id_idx on public.groups (location_id);

-- Địa điểm gắn vào batch phải thuộc cùng học viện
create function private.check_group_location()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.location_id is not null and not exists (
    select 1 from public.academy_locations l
    where l.id = new.location_id and l.academy_id = new.academy_id
  ) then
    raise exception 'location_other_academy' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger groups_location_same_academy
  before insert or update of location_id, academy_id on public.groups
  for each row execute function private.check_group_location();

/** Đặt một địa điểm làm cơ sở chính (bỏ cờ ở địa điểm cũ trong cùng giao dịch). */
create function public.set_main_location(p_location uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_academy uuid;
begin
  select academy_id into v_academy from public.academy_locations where id = p_location;
  if v_academy is null or not private.has_role(v_academy, '{owner}') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.academy_locations set is_main = false where academy_id = v_academy and is_main;
  update public.academy_locations set is_main = true where id = p_location;
end;
$$;

revoke execute on function public.set_main_location(uuid) from public, anon;
grant execute on function public.set_main_location(uuid) to authenticated;
