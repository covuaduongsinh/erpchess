-- Giai đoạn 9a: ván đấu 1–1 do server làm trọng tài (Edge Function game-move), ván đánh máy,
-- đẩy trạng thái ván qua Realtime riêng tư `game:<id>`.

create table public.games (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  -- Ván đánh máy: một bên là null, `bot_elo` là mức máy (null = mạnh nhất cũng ghi 0)
  white_id uuid references public.profiles (id) on delete set null,
  black_id uuid references public.profiles (id) on delete set null,
  bot_elo int check (bot_elo is null or bot_elo between 0 and 3500),
  initial_fen text not null default 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    check (char_length(initial_fen) between 15 and 100),
  moves text[] not null default '{}' check (cardinality(moves) <= 1000),
  fen text not null check (char_length(fen) between 15 and 100),
  -- Đồng hồ: base_ms null = không giới hạn thời gian
  base_ms int check (base_ms is null or base_ms between 60000 and 10800000),
  inc_ms int not null default 0 check (inc_ms between 0 and 180000),
  white_ms int,
  black_ms int,
  turn_started_at timestamptz,
  status text not null default 'active' check (status in ('pending', 'active', 'finished', 'aborted')),
  result text check (result in ('1-0', '0-1', '1/2-1/2')),
  reason text check (reason in (
    'checkmate', 'resign', 'timeout', 'stalemate', 'repetition', 'insufficient', 'fifty', 'agreement', 'abort'
  )),
  rated boolean not null default false,
  category text check (category in ('blitz', 'rapid', 'classical')),
  draw_offer_by uuid references public.profiles (id) on delete set null,
  simul_id uuid,
  pgn text check (pgn is null or char_length(pgn) <= 100000),
  -- Thay đổi rating sau ván: {"white": +8.2, "black": -8.2}
  rating_change jsonb,
  version int not null default 0,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  check (white_id is distinct from black_id),
  check (bot_elo is null or ((white_id is null) <> (black_id is null))),
  check (bot_elo is not null or (white_id is not null and black_id is not null))
);
create index games_academy_status_idx on public.games (academy_id, status, created_at desc);
create index games_white_id_idx on public.games (white_id, created_at desc);
create index games_black_id_idx on public.games (black_id, created_at desc);
create index games_simul_id_idx on public.games (simul_id);
create index games_created_by_idx on public.games (created_by);
create index games_draw_offer_by_idx on public.games (draw_offer_by);

create function private.game_academy(p_game uuid)
returns uuid
language sql stable security definer set search_path = ''
as $$
  select g.academy_id from public.games g where g.id = p_game;
$$;

create function private.can_view_game(p_game uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.games g
    where g.id = p_game
      and (
        (select auth.uid()) in (g.white_id, g.black_id)
        or private.has_role(g.academy_id, '{owner,coach}')
        or (g.white_id is not null and private.is_parent_of(g.white_id))
        or (g.black_id is not null and private.is_parent_of(g.black_id))
        or (g.status = 'active' and private.is_member(g.academy_id))
      )
  );
$$;

create function private.game_topic_id(p_topic text)
returns uuid
language sql immutable set search_path = ''
as $$
  select case
    when p_topic ~ '^game:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then substr(p_topic, 6, 36)::uuid
  end;
$$;

grant execute on all functions in schema private to authenticated;

alter table public.games enable row level security;

create policy "games: người chơi, staff, phụ huynh; thành viên xem ván đang diễn ra"
  on public.games for select to authenticated
  using (
    (select auth.uid()) in (white_id, black_id)
    or private.has_role(academy_id, '{owner,coach}')
    or (white_id is not null and private.is_parent_of(white_id))
    or (black_id is not null and private.is_parent_of(black_id))
    or (status = 'active' and private.is_member(academy_id))
  );

-- Staff ghép cặp hai thành viên học viện; mọi cập nhật sau đó do Edge Function (service role)
create policy "games: staff ghép cặp"
  on public.games for insert to authenticated
  with check (
    private.has_role(academy_id, '{owner,coach}')
    and created_by = (select auth.uid())
    and bot_elo is null
    and status in ('pending', 'active')
    and cardinality(moves) = 0
    and result is null
    and exists (select 1 from public.memberships m where m.academy_id = games.academy_id and m.user_id = white_id)
    and exists (select 1 from public.memberships m where m.academy_id = games.academy_id and m.user_id = black_id)
  );

-- Ván đánh máy: người chơi tự lưu khi đã xong; không tính rating
create policy "games: tự lưu ván đánh máy đã xong"
  on public.games for insert to authenticated
  with check (
    bot_elo is not null
    and created_by = (select auth.uid())
    and (select auth.uid()) in (white_id, black_id)
    and status = 'finished'
    and not rated
    and private.is_member(academy_id)
  );

create policy "games: staff xoá ván chưa bắt đầu hoặc đã huỷ"
  on public.games for delete to authenticated
  using (private.has_role(academy_id, '{owner,coach}') and (status in ('pending', 'aborted') or cardinality(moves) = 0));

-- Đẩy trạng thái ván mới tới người đang xem
create function private.broadcast_game()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform realtime.send(
    jsonb_build_object(
      'id', new.id, 'moves', new.moves, 'fen', new.fen,
      'white_ms', new.white_ms, 'black_ms', new.black_ms, 'turn_started_at', new.turn_started_at,
      'status', new.status, 'result', new.result, 'reason', new.reason,
      'draw_offer_by', new.draw_offer_by, 'rating_change', new.rating_change, 'version', new.version
    ),
    'state',
    'game:' || new.id,
    true
  );
  return new;
end;
$$;

create trigger games_broadcast
  after update on public.games
  for each row execute function private.broadcast_game();

create policy "game realtime: ai xem được ván thì nghe"
  on realtime.messages for select to authenticated
  using (
    realtime.messages.extension = 'broadcast'
    and private.can_view_game(private.game_topic_id((select realtime.topic())))
  );
