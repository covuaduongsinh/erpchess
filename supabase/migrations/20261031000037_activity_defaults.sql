-- Giai đoạn 24d: cấu hình hoạt động mặc định của học viện (đặc tả quan sát bằng REA: Study →
-- Default config — với từng loại hoạt động đặt điểm, số lần thử tối đa, giới hạn thời gian, điểm
-- trừ mỗi lần sai; HLV vẫn chỉnh riêng từng hoạt động). Giá trị kiểm ở tầng domain (zod).
-- { "<loại>": { "points": 10, "maxAttempts": null, "timeLimitS": null, "wrongPenalty": 0 } }

alter table public.academies
  add column if not exists activity_defaults jsonb not null default '{}'::jsonb
    check (jsonb_typeof(activity_defaults) = 'object' and pg_column_size(activity_defaults) <= 4096);
