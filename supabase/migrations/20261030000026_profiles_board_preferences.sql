-- Giai đoạn 20c: lưu tùy chọn bàn cờ (theme, bộ quân, tọa độ, âm thanh, tự xoay) vào hồ sơ
-- để đồng bộ giữa các thiết bị. Giá trị được kiểm tra ở tầng domain (zod); DB chỉ bắt buộc là object.

alter table public.profiles
  add column if not exists board_preferences jsonb not null default '{}'::jsonb
    check (jsonb_typeof(board_preferences) = 'object' and pg_column_size(board_preferences) <= 2048);
