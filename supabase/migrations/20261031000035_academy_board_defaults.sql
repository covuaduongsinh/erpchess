-- Giai đoạn 23f: theme bàn cờ mặc định của học viện (đặc tả quan sát bằng REA: Branding →
-- Platform Branding → Board Preferences "đặt theme bàn cờ mặc định cho mọi thành viên").
-- Khác Chesslang: thành viên đã tự chỉnh bàn cờ trong hồ sơ thì vẫn dùng của mình; chưa chỉnh thì
-- dùng mặc định của học viện. Giá trị kiểm ở tầng domain (zod) như `profiles.board_preferences`.

alter table public.academies
  add column if not exists board_defaults jsonb not null default '{}'::jsonb
    check (jsonb_typeof(board_defaults) = 'object' and pg_column_size(board_defaults) <= 1024);
