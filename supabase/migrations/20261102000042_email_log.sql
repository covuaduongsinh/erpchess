-- Giai đoạn 27a: gửi email qua Resend (Edge Function send-email).
--   * email_log: nhật ký mỗi email đã gửi/thất bại (chỉ Edge Function ghi bằng service role; owner đọc nhật ký học viện mình).
--     Dùng bảng riêng thay vì `notifications` vì người nhận email có thể là người được mời chưa có tài khoản,
--     và nhật ký còn dùng để giới hạn tần suất (N email/giờ/học viện).
--   * notifications.emailed_at: dấu "đã xử lý gửi email" để cron (send-email, chế độ flush) không gửi lặp.
-- Chỉ THÊM bảng/cột, không drop/delete. Không đụng RLS bảng đang có.
--
-- Hoàn tác (chủ dự án tự quyết, xoá nhật ký):
--   alter table public.notifications drop column emailed_at;
--   drop table public.email_log;

create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  academy_id uuid not null references public.academies (id) on delete cascade,
  kind text not null check (kind in ('test', 'invite_coach', 'invite_parent', 'invoice_reminder', 'quiz_assigned')),
  to_email text not null check (char_length(to_email) between 3 and 254),
  subject text not null default '' check (char_length(subject) <= 300),
  status text not null check (status in ('sent', 'failed')),
  error text check (error is null or char_length(error) <= 500),
  provider_id text,
  notification_id uuid references public.notifications (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index email_log_academy_idx on public.email_log (academy_id, created_at desc);
create index email_log_notification_idx on public.email_log (notification_id);
create index email_log_created_by_idx on public.email_log (created_by);

alter table public.email_log enable row level security;

-- Chỉ chủ học viện xem nhật ký (chứa email người nhận). Không có policy ghi: chỉ service role (Edge Function) ghi.
create policy "email_log: owner đọc nhật ký học viện mình"
  on public.email_log for select to authenticated
  using (private.has_role(academy_id, '{owner}'));

alter table public.notifications add column emailed_at timestamptz;
-- Hàng đợi gửi email: chỉ các thông báo chưa xử lý
create index notifications_email_queue_idx on public.notifications (created_at) where emailed_at is null;
