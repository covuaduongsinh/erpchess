-- Giai đoạn 22c: tìm trận nhanh (Quick Pairing) — hàng đợi ghép cặp theo Elo trong học viện.
-- Người chơi gọi `quick_pair` lặp lại (khoảng 2 giây/lần) khi đang chờ: mỗi lần gọi vừa báo còn
-- ở đây (heartbeat) vừa thử ghép; khoảng chênh Elo chấp nhận nới rộng dần theo thời gian chờ.
-- Ván được tạo bằng quyền của hàm (security definer) vì học viên không tự chèn được vào `games`.

create table public.match_queue (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  base_ms int not null check (base_ms between 60000 and 10800000),
  inc_ms int not null default 0 check (inc_ms between 0 and 180000),
  rating numeric(7, 2) not null check (rating between 0 and 4000),
  status text not null default 'waiting' check (status in ('waiting', 'matched', 'cancelled')),
  game_id uuid references public.games (id) on delete set null,
  created_at timestamptz not null default now(),
  heartbeat_at timestamptz not null default now(),
  -- Lúc người chơi nhận được thông báo đã ghép (để không trả cùng một ván hai lần)
  seen_at timestamptz
);
-- Mỗi người chỉ có một lượt chờ trong một học viện
create unique index match_queue_one_waiting_idx
  on public.match_queue (academy_id, user_id) where status = 'waiting';
create index match_queue_lookup_idx
  on public.match_queue (academy_id, base_ms, inc_ms, status, created_at);
create index match_queue_user_idx on public.match_queue (user_id, created_at desc);
create index match_queue_game_idx on public.match_queue (game_id);

alter table public.match_queue enable row level security;

-- Chỉ xem lượt chờ của mình; mọi thay đổi đi qua các hàm bên dưới
create policy "match_queue: xem lượt chờ của mình"
  on public.match_queue for select to authenticated
  using (user_id = (select auth.uid()));

/** Khoảng chênh Elo chấp nhận: 100, nới thêm 50 mỗi 10 giây chờ, tối đa 600. */
create function private.match_window(p_waited interval)
returns int
language sql immutable set search_path = ''
as $$
  select least(600, 100 + 50 * floor(extract(epoch from p_waited) / 10)::int);
$$;

create function public.quick_pair(p_academy uuid, p_base_ms int, p_inc_ms int)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_category text;
  v_rating numeric;
  v_me public.match_queue;
  v_opp public.match_queue;
  v_window int;
  v_white uuid;
  v_black uuid;
  v_game uuid;
begin
  if v_uid is null or not private.has_role(p_academy, '{owner,coach,student}') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_base_ms is null or p_base_ms not between 60000 and 10800000
     or p_inc_ms is null or p_inc_ms not between 0 and 180000 then
    raise exception 'invalid_time_control' using errcode = '22023';
  end if;

  -- Đã được người khác ghép mà chưa nhận: trả ván đó
  update public.match_queue q set seen_at = now()
  where q.id = (
    select id from public.match_queue
    where academy_id = p_academy and user_id = v_uid and status = 'matched'
      and seen_at is null and game_id is not null
    order by created_at desc limit 1
  )
  returning * into v_me;
  if found then
    return jsonb_build_object('status', 'matched', 'game_id', v_me.game_id);
  end if;

  -- Cùng công thức với categoryOf (chess-core)
  v_category := case
    when p_base_ms + 40 * p_inc_ms < 600000 then 'blitz'
    when p_base_ms + 40 * p_inc_ms < 3600000 then 'rapid'
    else 'classical'
  end;
  select r.rating into v_rating from public.ratings r
  where r.academy_id = p_academy and r.student_id = v_uid and r.category = v_category;
  v_rating := coalesce(v_rating, 1500);

  -- Lượt chờ hiện tại: đổi mức thời gian thì huỷ lượt cũ và xếp hàng lại
  select * into v_me from public.match_queue
  where academy_id = p_academy and user_id = v_uid and status = 'waiting'
  for update;
  if found and (v_me.base_ms <> p_base_ms or v_me.inc_ms <> p_inc_ms
                or v_me.heartbeat_at < now() - interval '30 seconds') then
    update public.match_queue set status = 'cancelled' where id = v_me.id;
    v_me := null;
  end if;
  if v_me.id is null then
    insert into public.match_queue (academy_id, user_id, base_ms, inc_ms, rating)
    values (p_academy, v_uid, p_base_ms, p_inc_ms, v_rating)
    returning * into v_me;
  else
    update public.match_queue set heartbeat_at = now() where id = v_me.id
    returning * into v_me;
  end if;

  v_window := private.match_window(now() - v_me.created_at);

  -- Đối thủ gần Elo nhất còn đang chờ (theo khoảng nới rộng của bên chờ lâu hơn)
  select * into v_opp from public.match_queue q
  where q.academy_id = p_academy and q.status = 'waiting'
    and q.base_ms = p_base_ms and q.inc_ms = p_inc_ms
    and q.user_id <> v_uid
    and q.heartbeat_at > now() - interval '20 seconds'
    and abs(q.rating - v_me.rating)
        <= greatest(v_window, private.match_window(now() - q.created_at))
  order by abs(q.rating - v_me.rating), q.created_at
  limit 1
  for update skip locked;

  if not found then
    return jsonb_build_object(
      'status', 'waiting',
      'rating', v_me.rating,
      'window', v_window,
      'waited_ms', floor(extract(epoch from now() - v_me.created_at) * 1000)::int
    );
  end if;

  if random() < 0.5 then
    v_white := v_uid; v_black := v_opp.user_id;
  else
    v_white := v_opp.user_id; v_black := v_uid;
  end if;

  insert into public.games (
    academy_id, white_id, black_id, fen, base_ms, inc_ms, white_ms, black_ms,
    rated, category, created_by
  )
  values (
    p_academy, v_white, v_black, 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    p_base_ms, p_inc_ms, p_base_ms, p_base_ms, true, v_category, v_uid
  )
  returning id into v_game;

  update public.match_queue set status = 'matched', game_id = v_game, seen_at = now()
  where id = v_me.id;
  update public.match_queue set status = 'matched', game_id = v_game where id = v_opp.id;

  return jsonb_build_object('status', 'matched', 'game_id', v_game);
end;
$$;

/** Rời hàng đợi; nếu vừa được ghép trước khi kịp huỷ thì trả ván đó để người chơi vào luôn. */
create function public.cancel_quick_pair(p_academy uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_game uuid;
begin
  if v_uid is null then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.match_queue set status = 'cancelled'
  where academy_id = p_academy and user_id = v_uid and status = 'waiting';

  update public.match_queue q set seen_at = now()
  where q.id = (
    select id from public.match_queue
    where academy_id = p_academy and user_id = v_uid and status = 'matched'
      and seen_at is null and game_id is not null
    order by created_at desc limit 1
  )
  returning q.game_id into v_game;

  return case
    when v_game is null then jsonb_build_object('status', 'cancelled')
    else jsonb_build_object('status', 'matched', 'game_id', v_game)
  end;
end;
$$;

revoke execute on function public.quick_pair(uuid, int, int) from public, anon;
revoke execute on function public.cancel_quick_pair(uuid) from public, anon;
grant execute on function public.quick_pair(uuid, int, int) to authenticated;
grant execute on function public.cancel_quick_pair(uuid) to authenticated;
grant execute on function private.match_window(interval) to authenticated;
