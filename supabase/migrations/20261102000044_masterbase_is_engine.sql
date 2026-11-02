-- Giai đoạn 27e: Masterbase lẫn ván engine. Broadcast Lichess có giải TCEC (engine đấu engine, Elo 3000–3800);
-- chúng không phải "ván cao thủ". Kiểm chỉ đọc trên Supabase self-host (2026-11-02): 1.249 / 23.815 ván (5,2%) có
-- "tcec" ở event hoặc site, và mọi ván có Elo > 3000 đều nằm trong đó; không có người nào Elo > 3000.
--
-- 1) Cột SINH `is_engine` (không UPDATE/DELETE dữ liệu, tự đúng cho mọi lần nạp sau).
-- 2) Chỉ mục một phần cho danh sách ván người (mới nhất trước).
-- 3) `search_masterbase` thêm tham số `p_include_engines` (mặc định false = ẩn ván engine).
--
-- Regex không dùng dấu `\`: máy chủ self-host đặt standard_conforming_strings = off nên `\d`, `\m`… trong chuỗi
-- thường bị nuốt. Biểu thức cột sinh chỉ gồm toán tử bất biến (immutable) nên hợp lệ.
--
-- Lưu ý: `drop function` ở dưới chỉ gỡ CHỮ KÝ cũ (5 tham số) để thay bằng chữ ký mới trong cùng giao dịch; vì tham số
-- mới có mặc định nên mọi lời gọi cũ (5 tham số theo tên) vẫn chạy và tự ẩn ván engine. Không đụng dữ liệu.
--
-- Hoàn tác (chạy tay, theo thứ tự):
--   drop function public.search_masterbase(text, int, int, int, int, boolean);
--   (tạo lại hàm 5 tham số gốc từ migration 20261031000032_masterbase.sql, rồi grant execute … to authenticated)
--   drop index public.masterbase_games_human_idx;
--   alter table public.masterbase_games drop column is_engine;

alter table public.masterbase_games
  add column is_engine boolean generated always as (
    event ~* 'tcec'
    or site ~* 'tcec'
    or coalesce(white_elo, 0) > 3000
    or coalesce(black_elo, 0) > 3000
  ) stored;

comment on column public.masterbase_games.is_engine is
  'Ván engine (TCEC hoặc Elo > 3000): cột sinh, không ghi được. search_masterbase ẩn chúng theo mặc định.';

create index masterbase_games_human_idx
  on public.masterbase_games (date desc, id desc) where not is_engine;

drop function public.search_masterbase(text, int, int, int, int);

/**
 * Tìm ván: lọc theo thế cờ (khoá như trên; null = không lọc), số nửa nước tối đa, Elo tối thiểu của cả hai bên;
 * mặc định ẩn ván engine (đặt p_include_engines = true để gồm cả engine); mới nhất trước; trả kèm tổng số ván khớp.
 */
create function public.search_masterbase(
  p_position text default null,
  p_max_plies int default null,
  p_min_elo int default null,
  p_limit int default 20,
  p_offset int default 0,
  p_include_engines boolean default false
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
    and (coalesce(p_include_engines, false) or not g.is_engine)
  order by g.date desc, g.id desc
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
$$;

revoke execute on function public.search_masterbase(text, int, int, int, int, boolean) from public, anon;
grant execute on function public.search_masterbase(text, int, int, int, int, boolean) to authenticated;
