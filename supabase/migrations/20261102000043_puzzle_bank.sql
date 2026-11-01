-- Giai đoạn 27c: kho puzzle dùng chung toàn hệ thống (nguồn: Lichess puzzle database, CC0), để HLV tìm theo
-- chủ đề / rating / số nước rồi thêm hàng loạt vào học liệu (study). Chỉ nạp một tập con (vài trăm nghìn dòng
-- trải đều theo rating và chủ đề) bằng `scripts/puzzle-bank-import.mjs` rồi `\copy` (service role), không qua API.
-- Chỉ THÊM bảng/hàm, không drop/delete, không đụng bảng đang có.
--
-- Định dạng `fen` + `moves` giữ nguyên của Lichess: `fen` là thế TRƯỚC nước đầu của đối thủ, `moves` là các nước
-- UCI cách nhau bằng dấu cách, nước đầu là của đối thủ, các nước sau xen kẽ người giải / đối thủ. Web chuyển
-- thành hoạt động puzzle của study (thế sau nước đầu + lời giải) khi thêm vào học liệu.
--
-- Hoàn tác (chủ dự án tự quyết, xoá dữ liệu đã nạp):
--   drop function public.search_puzzle_bank(text[], int, int, int, int, int);
--   drop table public.puzzle_bank;

create table public.puzzle_bank (
  id bigint generated always as identity primary key,
  lichess_id text not null unique check (char_length(lichess_id) between 3 and 16),
  fen text not null check (char_length(fen) between 15 and 100),
  moves text not null check (char_length(moves) between 4 and 400),
  rating int not null check (rating between 100 and 4000),
  rating_deviation int not null default 0 check (rating_deviation between 0 and 1000),
  popularity int not null default 0 check (popularity between -100 and 100),
  nb_plays int not null default 0 check (nb_plays >= 0),
  themes text[] not null default '{}' check (cardinality(themes) <= 30),
  opening_tags text[] not null default '{}' check (cardinality(opening_tags) <= 30),
  source text not null default 'Lichess puzzle database (CC0)' check (char_length(source) between 3 and 200),
  imported_at timestamptz not null default now()
);
create index puzzle_bank_themes_idx on public.puzzle_bank using gin (themes);
create index puzzle_bank_rating_idx on public.puzzle_bank (rating);

alter table public.puzzle_bank enable row level security;

-- Kho công khai theo giấy phép CC0: người đăng nhập đọc; không có policy ghi (chỉ service role nạp)
create policy "puzzle_bank: người đăng nhập đọc"
  on public.puzzle_bank for select to authenticated using (true);

/**
 * Tìm puzzle: có TẤT CẢ các chủ đề đã chọn (null/rỗng = không lọc), rating trong [min, max], số nước người giải
 * tối đa (`p_moves_max`; mỗi nước người giải kèm một nước đáp nên tổng số nước trong `moves` = 2 × số nước người
 * giải). Phổ biến nhất trước. Trả kèm `total` (tổng số dòng khớp) để phân trang; `p_limit` tối đa 100.
 */
create function public.search_puzzle_bank(
  p_themes text[] default null,
  p_rating_min int default null,
  p_rating_max int default null,
  p_moves_max int default null,
  p_limit int default 20,
  p_offset int default 0
)
returns table (
  id bigint,
  lichess_id text,
  fen text,
  moves text,
  rating int,
  popularity int,
  themes text[],
  total bigint
)
language sql stable security invoker set search_path = ''
as $$
  select b.id, b.lichess_id, b.fen, b.moves, b.rating, b.popularity, b.themes,
         count(*) over () as total
  from public.puzzle_bank b
  where (p_themes is null or cardinality(p_themes) = 0 or b.themes @> p_themes)
    and (p_rating_min is null or b.rating >= p_rating_min)
    and (p_rating_max is null or b.rating <= p_rating_max)
    and (p_moves_max is null or cardinality(string_to_array(b.moves, ' ')) <= 2 * p_moves_max)
  order by b.popularity desc, b.id
  limit least(greatest(coalesce(p_limit, 20), 1), 100)
  offset greatest(coalesce(p_offset, 0), 0)
$$;
revoke execute on function public.search_puzzle_bank(text[], int, int, int, int, int) from public, anon;
grant execute on function public.search_puzzle_bank(text[], int, int, int, int, int) to authenticated;
