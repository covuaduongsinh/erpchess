-- Giai đoạn 9c: Simul — một HLV (chủ simul) đấu cùng lúc với nhiều học viên. Mỗi bàn là một ván
-- trong `games` có `simul_id`; ván tạo sẵn ở trạng thái pending, bắt đầu simul thì chuyển active.
-- Đồng hồ (nếu có) chỉ tính cho học viên: Edge Function game-move không trừ giờ của chủ simul.

create table public.simuls (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '' check (char_length(description) <= 2000),
  host_id uuid not null references public.profiles (id) on delete cascade,
  host_color text not null default 'w' check (host_color in ('w', 'b')),
  starts_at timestamptz,
  base_ms int check (base_ms is null or base_ms between 60000 and 10800000),
  inc_ms int not null default 0 check (inc_ms between 0 and 180000),
  status text not null default 'upcoming' check (status in ('upcoming', 'active', 'finished')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index simuls_academy_id_idx on public.simuls (academy_id, created_at desc);
create index simuls_host_id_idx on public.simuls (host_id);
create index simuls_created_by_idx on public.simuls (created_by);

alter table public.games
  add constraint games_simul_id_fkey foreign key (simul_id) references public.simuls (id) on delete cascade;

alter table public.simuls enable row level security;

create policy "simuls: thành viên học viện đọc"
  on public.simuls for select to authenticated
  using (private.is_member(academy_id));
create policy "simuls: staff tạo, chủ simul là staff"
  on public.simuls for insert to authenticated
  with check (
    private.has_role(academy_id, '{owner,coach}')
    and created_by = (select auth.uid())
    and exists (
      select 1 from public.memberships m
      where m.academy_id = simuls.academy_id and m.user_id = host_id and m.role in ('owner', 'coach')
    )
  );
create policy "simuls: chủ simul hoặc owner sửa"
  on public.simuls for update to authenticated
  using (host_id = (select auth.uid()) or private.has_role(academy_id, '{owner}'))
  with check (private.has_role(academy_id, '{owner,coach}'));
create policy "simuls: chủ simul hoặc owner xoá"
  on public.simuls for delete to authenticated
  using (host_id = (select auth.uid()) or private.has_role(academy_id, '{owner}'));

-- Bắt đầu simul: mọi bàn pending chuyển active cùng lúc
create function public.start_simul(p_simul uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_simul public.simuls;
begin
  select * into v_simul from public.simuls where id = p_simul;
  if v_simul.id is null
    or not (v_simul.host_id = (select auth.uid()) or private.has_role(v_simul.academy_id, '{owner}')) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if v_simul.status <> 'upcoming' then
    raise exception 'already_started' using errcode = 'P0001';
  end if;
  update public.simuls set status = 'active', started_at = now() where id = p_simul;
  update public.games set status = 'active', version = version + 1
    where simul_id = p_simul and status = 'pending';
end;
$$;
revoke execute on function public.start_simul(uuid) from public, anon;
grant execute on function public.start_simul(uuid) to authenticated;

-- Mọi bàn đã xong (hoặc huỷ) thì simul kết thúc
create function private.finish_simul_when_done()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.simul_id is not null and new.status in ('finished', 'aborted')
    and not exists (
      select 1 from public.games g
      where g.simul_id = new.simul_id and g.status in ('pending', 'active')
    ) then
    update public.simuls set status = 'finished', finished_at = now()
      where id = new.simul_id and status <> 'finished';
  end if;
  return new;
end;
$$;

create trigger games_finish_simul
  after update of status on public.games
  for each row execute function private.finish_simul_when_done();
