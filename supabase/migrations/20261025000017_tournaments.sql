-- Giai đoạn 10a: giải đấu (Swiss, vòng tròn, Quad, Swiss đồng đội). Mỗi ván giải là một `games`
-- có `tournament_id` + `round`; ghép cặp và tạo ván do Edge Function (service role) làm.

create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  description text not null default '' check (char_length(description) <= 4000),
  location text not null default '' check (char_length(location) <= 160),
  format text not null default 'swiss' check (format in ('swiss', 'round_robin', 'quad', 'team_swiss')),
  rounds int not null default 5 check (rounds between 1 and 30),
  base_ms int check (base_ms is null or base_ms between 60000 and 10800000),
  inc_ms int not null default 0 check (inc_ms between 0 and 180000),
  rated boolean not null default false,
  allow_draw boolean not null default true,
  allow_resign boolean not null default true,
  is_public boolean not null default false,
  control text not null default 'manual' check (control in ('manual', 'auto_finish', 'auto_schedule')),
  start_kind text not null default 'standard' check (start_kind in ('standard', 'opening', 'fen')),
  initial_fen text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    check (char_length(initial_fen) between 15 and 100),
  team_boards int not null default 4 check (team_boards between 1 and 10),
  starts_at timestamptz,
  timezone text not null default 'Asia/Ho_Chi_Minh' check (char_length(timezone) <= 64),
  round_interval_min int not null default 0 check (round_interval_min between 0 and 10080),
  repeat text not null default 'none' check (repeat in ('none', 'daily', 'weekly', 'monthly')),
  repeat_until timestamptz,
  parent_id uuid references public.tournaments (id) on delete set null,
  status text not null default 'upcoming' check (status in ('upcoming', 'active', 'finished')),
  current_round int not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);
create index tournaments_academy_idx on public.tournaments (academy_id, starts_at);
create index tournaments_created_by_idx on public.tournaments (created_by);
create index tournaments_parent_id_idx on public.tournaments (parent_id);

create table public.tournament_teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80)
);
create index tournament_teams_tournament_idx on public.tournament_teams (tournament_id);

create table public.tournament_players (
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  player_id uuid not null references public.profiles (id) on delete cascade,
  team_id uuid references public.tournament_teams (id) on delete set null,
  board_no int check (board_no is null or board_no between 1 and 10),
  group_no int,
  seed_rating numeric(7, 2) not null default 1500,
  withdrawn boolean not null default false,
  joined_at timestamptz not null default now(),
  primary key (tournament_id, player_id)
);
create index tournament_players_player_idx on public.tournament_players (player_id);
create index tournament_players_team_idx on public.tournament_players (team_id);

create table public.tournament_rounds (
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  round int not null check (round >= 1),
  starts_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'active', 'finished')),
  primary key (tournament_id, round)
);

create table public.tournament_byes (
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  round int not null,
  player_id uuid references public.profiles (id) on delete cascade,
  team_id uuid references public.tournament_teams (id) on delete cascade,
  check ((player_id is null) <> (team_id is null))
);
create index tournament_byes_tournament_idx on public.tournament_byes (tournament_id, round);
create index tournament_byes_player_idx on public.tournament_byes (player_id);
create index tournament_byes_team_idx on public.tournament_byes (team_id);

alter table public.games
  add column tournament_id uuid references public.tournaments (id) on delete cascade,
  add column round int,
  add column board_no int;
create index games_tournament_idx on public.games (tournament_id, round);

-- ───────────────────────── Hàm ─────────────────────────

create function private.tournament_academy(p_tournament uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select t.academy_id from public.tournaments t where t.id = p_tournament;
$$;

-- Người tổ chức: owner, hoặc HLV đã tạo giải
create function private.can_run_tournament(p_tournament uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.tournaments t
    where t.id = p_tournament
      and (
        private.has_role(t.academy_id, '{owner}')
        or (private.has_role(t.academy_id, '{coach}') and t.created_by = (select auth.uid()))
      )
  );
$$;

create function private.tournament_topic_id(p_topic text)
returns uuid
language sql immutable set search_path = ''
as $$
  select case
    when p_topic ~ '^tournament:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then substr(p_topic, 12, 36)::uuid
  end;
$$;

grant execute on all functions in schema private to authenticated;

-- ───────────────────────── RLS ─────────────────────────

alter table public.tournaments enable row level security;
alter table public.tournament_teams enable row level security;
alter table public.tournament_players enable row level security;
alter table public.tournament_rounds enable row level security;
alter table public.tournament_byes enable row level security;

create policy "tournaments: thành viên học viện đọc"
  on public.tournaments for select to authenticated
  using (private.is_member(academy_id));
create policy "tournaments: staff tạo"
  on public.tournaments for insert to authenticated
  with check (
    private.has_role(academy_id, '{owner,coach}')
    and created_by = (select auth.uid())
    and status = 'upcoming'
    and current_round = 0
  );
create policy "tournaments: người tổ chức sửa khi chưa bắt đầu"
  on public.tournaments for update to authenticated
  using (private.can_run_tournament(id) and status = 'upcoming')
  with check (private.has_role(academy_id, '{owner,coach}') and status = 'upcoming' and current_round = 0);
create policy "tournaments: người tổ chức xoá"
  on public.tournaments for delete to authenticated
  using (private.can_run_tournament(id));

create policy "tournament_teams: thành viên đọc"
  on public.tournament_teams for select to authenticated
  using (private.is_member(private.tournament_academy(tournament_id)));
create policy "tournament_teams: người tổ chức ghi"
  on public.tournament_teams for all to authenticated
  using (private.can_run_tournament(tournament_id))
  with check (private.can_run_tournament(tournament_id));

create policy "tournament_players: thành viên đọc"
  on public.tournament_players for select to authenticated
  using (private.is_member(private.tournament_academy(tournament_id)));
-- Người tổ chức thêm thành viên học viện; học viên tự đăng ký giải công khai chưa bắt đầu
create policy "tournament_players: người tổ chức thêm hoặc tự đăng ký"
  on public.tournament_players for insert to authenticated
  with check (
    exists (
      select 1 from public.memberships m
      where m.academy_id = private.tournament_academy(tournament_id) and m.user_id = player_id
        and m.role in ('owner', 'coach', 'student')
    )
    and (
      private.can_run_tournament(tournament_id)
      or (
        player_id = (select auth.uid())
        and exists (
          select 1 from public.tournaments t
          where t.id = tournament_id and t.is_public and t.status = 'upcoming'
        )
      )
    )
  );
create policy "tournament_players: người tổ chức sửa"
  on public.tournament_players for update to authenticated
  using (private.can_run_tournament(tournament_id))
  with check (private.can_run_tournament(tournament_id));
create policy "tournament_players: người tổ chức xoá hoặc tự rút khi chưa bắt đầu"
  on public.tournament_players for delete to authenticated
  using (
    private.can_run_tournament(tournament_id)
    or (
      player_id = (select auth.uid())
      and exists (select 1 from public.tournaments t where t.id = tournament_id and t.status = 'upcoming')
    )
  );

create policy "tournament_rounds: thành viên đọc"
  on public.tournament_rounds for select to authenticated
  using (private.is_member(private.tournament_academy(tournament_id)));
create policy "tournament_byes: thành viên đọc"
  on public.tournament_byes for select to authenticated
  using (private.is_member(private.tournament_academy(tournament_id)));

-- Thành viên học viện xem được mọi ván của giải (kể cả đã xong) để theo dõi bảng xếp hạng
create policy "games: thành viên xem ván giải"
  on public.games for select to authenticated
  using (tournament_id is not null and private.is_member(academy_id));

-- ───────────────────────── Realtime ─────────────────────────

create function private.broadcast_tournament_game()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.tournament_id is not null and new.status is distinct from old.status then
    perform realtime.send(
      jsonb_build_object('game_id', new.id, 'round', new.round, 'status', new.status, 'result', new.result),
      'game',
      'tournament:' || new.tournament_id,
      true
    );
  end if;
  return new;
end;
$$;

create trigger games_broadcast_tournament
  after update on public.games
  for each row execute function private.broadcast_tournament_game();

create policy "tournament realtime: thành viên nghe"
  on realtime.messages for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and private.is_member(private.tournament_academy(private.tournament_topic_id((select realtime.topic()))))
  );
