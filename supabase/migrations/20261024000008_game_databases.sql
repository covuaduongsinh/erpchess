-- Giai đoạn 6b: kho ván (Database). Mỗi CSDL thuộc một học viện; ván lưu PGN đầy đủ kèm cột tiêu đề để tìm.

create extension if not exists pg_trgm with schema extensions;

create table public.game_databases (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  visibility text not null default 'private' check (visibility in ('private', 'academy')),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index game_databases_academy_id_idx on public.game_databases (academy_id);
create index game_databases_created_by_idx on public.game_databases (created_by);

create table public.database_games (
  id uuid primary key default gen_random_uuid(),
  database_id uuid not null references public.game_databases (id) on delete cascade,
  white text not null default '' check (char_length(white) <= 120),
  black text not null default '' check (char_length(black) <= 120),
  result text not null default '*' check (result in ('1-0', '0-1', '1/2-1/2', '*')),
  event text not null default '' check (char_length(event) <= 120),
  site text not null default '' check (char_length(site) <= 120),
  date text not null default '' check (char_length(date) <= 10),
  eco text not null default '' check (char_length(eco) <= 3),
  white_elo int check (white_elo between 1 and 3999),
  black_elo int check (black_elo between 1 and 3999),
  ply_count int not null default 0 check (ply_count >= 0),
  start_fen text check (start_fen is null or char_length(start_fen) between 15 and 100),
  pgn text not null check (char_length(pgn) between 1 and 200000),
  created_at timestamptz not null default now()
);
create index database_games_database_id_idx on public.database_games (database_id, created_at);
-- Tìm theo tên kỳ thủ / giải bằng ilike '%…%'
create index database_games_players_trgm_idx on public.database_games
  using gin ((white || ' ' || black || ' ' || event) extensions.gin_trgm_ops);

create function private.can_edit_database(p_database uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.game_databases d
    where d.id = p_database
      and (
        private.has_role(d.academy_id, '{owner}')
        or (d.created_by = (select auth.uid()) and private.has_role(d.academy_id, '{coach}'))
      )
  );
$$;

create function private.database_readable(p_database uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.game_databases d
    where d.id = p_database
      and (
        d.created_by = (select auth.uid())
        or (d.visibility = 'academy' and private.is_member(d.academy_id))
      )
  );
$$;
grant execute on function private.can_edit_database(uuid) to authenticated;
grant execute on function private.database_readable(uuid) to authenticated;

alter table public.game_databases enable row level security;
alter table public.database_games enable row level security;

-- Kiểm trên cột của dòng (không tra lại bảng) để INSERT … RETURNING thấy được dòng vừa chèn
create policy "game_databases: tác giả hoặc thành viên khi chia sẻ học viện"
  on public.game_databases for select to authenticated
  using (
    created_by = (select auth.uid())
    or (visibility = 'academy' and private.is_member(academy_id))
  );

create policy "game_databases: staff tạo"
  on public.game_databases for insert to authenticated
  with check (private.has_role(academy_id, '{owner,coach}') and created_by = (select auth.uid()));

create policy "game_databases: tác giả hoặc owner sửa"
  on public.game_databases for update to authenticated
  using (private.can_edit_database(id))
  with check (private.has_role(academy_id, '{owner,coach}'));

create policy "game_databases: tác giả hoặc owner xoá"
  on public.game_databases for delete to authenticated
  using (private.can_edit_database(id));

create policy "database_games: theo quyền xem CSDL"
  on public.database_games for select to authenticated
  using (private.database_readable(database_id));

create policy "database_games: người sửa được CSDL thì thêm"
  on public.database_games for insert to authenticated
  with check (private.can_edit_database(database_id));

create policy "database_games: người sửa được CSDL thì xoá"
  on public.database_games for delete to authenticated
  using (private.can_edit_database(database_id));
