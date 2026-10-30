-- Giai đoạn 23b: Masterbase — kho ván cao thủ dùng chung toàn hệ thống, tìm theo thế cờ trên bàn,
-- Elo và độ dài ván (đặc tả quan sát bằng REA: rea/spec/choi-giai-dau.md mục Board).
-- Chỉ nạp bộ ván có giấy phép mở (cột `source` ghi nguồn + giấy phép). Dữ liệu nạp bằng
-- `packages/chess-core/scripts/masterbase-export.mjs` rồi `\copy` (service role), không qua API.

create table public.masterbase_games (
  id bigint primary key,
  white text not null default '' check (char_length(white) <= 120),
  black text not null default '' check (char_length(black) <= 120),
  white_elo int check (white_elo between 1 and 3999),
  black_elo int check (black_elo between 1 and 3999),
  result text not null default '*' check (result in ('1-0', '0-1', '1/2-1/2', '*')),
  event text not null default '' check (char_length(event) <= 120),
  site text not null default '' check (char_length(site) <= 120),
  date text not null default '' check (char_length(date) <= 10),
  eco text not null default '' check (char_length(eco) <= 3),
  ply_count int not null default 0 check (ply_count >= 0),
  pgn text not null check (char_length(pgn) between 1 and 100000),
  source text not null check (char_length(source) between 3 and 200),
  imported_at timestamptz not null default now()
);
-- Elo của bên yếu hơn: "Elo > 2500" nghĩa là cả hai kỳ thủ trên 2500
create index masterbase_games_min_elo_idx
  on public.masterbase_games ((least(coalesce(white_elo, 0), coalesce(black_elo, 0))));
create index masterbase_games_ply_idx on public.masterbase_games (ply_count);
create index masterbase_games_date_idx on public.masterbase_games (date desc, id desc);

-- Chỉ mục thế cờ: khoá = 3 trường đầu của FEN (xếp quân, bên đi, quyền nhập thành), chỉ các nước
-- đầu ván (giới hạn trong script) để kho không phình quá gói Supabase.
create table public.masterbase_positions (
  position_key text not null check (char_length(position_key) between 10 and 100),
  game_id bigint not null references public.masterbase_games (id) on delete cascade,
  primary key (position_key, game_id)
);
create index masterbase_positions_game_idx on public.masterbase_positions (game_id);

alter table public.masterbase_games enable row level security;
alter table public.masterbase_positions enable row level security;

create policy "masterbase_games: người đăng nhập đọc"
  on public.masterbase_games for select to authenticated using (true);
create policy "masterbase_positions: người đăng nhập đọc"
  on public.masterbase_positions for select to authenticated using (true);

/**
 * Tìm ván: lọc theo thế cờ (khoá như trên; null = không lọc), số nửa nước tối đa, Elo tối thiểu
 * của cả hai bên; mới nhất trước; trả kèm tổng số ván khớp để phân trang.
 */
create function public.search_masterbase(
  p_position text default null,
  p_max_plies int default null,
  p_min_elo int default null,
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  id bigint,
  white text,
  black text,
  white_elo int,
  black_elo int,
  result text,
  event text,
  date text,
  eco text,
  ply_count int,
  total bigint
)
language sql stable security invoker set search_path = ''
as $$
  select g.id, g.white, g.black, g.white_elo, g.black_elo, g.result, g.event, g.date, g.eco,
         g.ply_count, count(*) over () as total
  from public.masterbase_games g
  where (p_position is null
         or exists (select 1 from public.masterbase_positions p
                    where p.position_key = p_position and p.game_id = g.id))
    and (p_max_plies is null or g.ply_count <= p_max_plies)
    and (p_min_elo is null or least(coalesce(g.white_elo, 0), coalesce(g.black_elo, 0)) > p_min_elo)
  order by g.date desc, g.id desc
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;

revoke execute on function public.search_masterbase(text, int, int, int, int) from public, anon;
grant execute on function public.search_masterbase(text, int, int, int, int) to authenticated;
