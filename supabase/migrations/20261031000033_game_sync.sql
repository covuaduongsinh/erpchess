-- Giai đoạn 23c: đồng bộ ván Chess.com / Lichess (đặc tả quan sát bằng REA: Preferences có mục
-- "Sync Games" với username Chess.com và Lichess; ván đồng bộ vào CSDL ván cá nhân).
-- - Hồ sơ lưu username hai nền tảng.
-- - Mỗi người có một CSDL đồng bộ riêng cho mỗi nguồn trong mỗi học viện (`sync_source`), kèm mốc
--   thời gian ván mới nhất đã lấy (`sync_cursor`, ms) để lần sau chỉ lấy ván mới.
-- - Học viên (trước đây không tạo được CSDL) được tạo và ghi vào CSDL đồng bộ riêng tư của mình.

alter table public.profiles
  add column if not exists chesscom_username text
    check (chesscom_username is null or chesscom_username ~ '^[A-Za-z0-9_-]{3,25}$'),
  add column if not exists lichess_username text
    check (lichess_username is null or lichess_username ~ '^[A-Za-z0-9][A-Za-z0-9_-]{1,29}$');

alter table public.game_databases
  add column if not exists sync_source text check (sync_source is null or sync_source in ('chesscom', 'lichess')),
  add column if not exists sync_cursor bigint check (sync_cursor is null or sync_cursor >= 0);
-- CSDL đồng bộ luôn riêng tư
alter table public.game_databases
  add constraint game_databases_sync_private check (sync_source is null or visibility = 'private');
create unique index if not exists game_databases_one_sync_idx
  on public.game_databases (academy_id, created_by, sync_source) where sync_source is not null;

-- Tác giả của CSDL đồng bộ (mọi vai trò trừ phụ huynh) được sửa CSDL đó và thêm/xoá ván trong đó
create or replace function private.can_edit_database(p_database uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.game_databases d
    where d.id = p_database
      and (
        private.has_role(d.academy_id, '{owner}')
        or (d.created_by = (select auth.uid()) and private.has_role(d.academy_id, '{coach}'))
        or (d.created_by = (select auth.uid()) and d.sync_source is not null
            and private.has_role(d.academy_id, '{student}'))
      )
  );
$$;

alter policy "game_databases: staff tạo" on public.game_databases
  with check (
    created_by = (select auth.uid())
    and (
      private.has_role(academy_id, '{owner,coach}')
      or (sync_source is not null and visibility = 'private' and private.has_role(academy_id, '{student}'))
    )
  );

alter policy "game_databases: tác giả hoặc owner sửa" on public.game_databases
  with check (
    private.has_role(academy_id, '{owner,coach}')
    or (created_by = (select auth.uid()) and sync_source is not null and visibility = 'private')
  );
