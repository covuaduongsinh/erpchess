# Công cụ chuyển Supabase: cloud `erpchess-dev` → self-host

Kế hoạch đầy đủ: `docs/plans/21-chuyen-supabase-sang-self-host.md`. Thư mục này là bước B1. Công cụ **không xoá gì** ở DB cũ (chỉ đọc), và **chưa từng chạy vào DB thật** khi viết (chỉ test bằng PGlite và Storage API giả).

## Chuẩn bị

Tạo `.env.supabase-move` ở gốc repo (đã gitignore theo `.env.*`). Mẫu ở mục 2 của kế hoạch 21:
`OLD_DATABASE_URL`, `OLD_SUPABASE_URL`, `OLD_SERVICE_ROLE_KEY`, `NEW_DATABASE_URL`, `NEW_SUPABASE_URL`, `NEW_ANON_KEY`, `NEW_SERVICE_ROLE_KEY`.
Công cụ không in khoá, mật khẩu hay chuỗi kết nối; mọi thông báo lỗi đều được che bí mật.

## Lệnh

```powershell
node scripts/supabase-move/index.mjs check             # 2 DB: phiên bản, extension, số dòng; HTTPS + /auth/v1/health
node scripts/supabase-move/index.mjs schema [--dry-run]  # áp supabase/migrations/*.sql lên DB mới
node scripts/supabase-move/index.mjs data   [--dry-run]  # chép auth.users, auth.identities, public.*
node scripts/supabase-move/index.mjs storage [--dry-run] # bucket + tệp qua Storage API
node scripts/supabase-move/index.mjs verify             # so số dòng và số tệp
```

Thứ tự khuyến nghị: `check` → `schema` → `data --dry-run` → `data` → `storage` → `verify`. Chạy lại lần hai an toàn.

## Hành vi cần biết

- **check:** báo extension thiếu (`pg_cron`, `pg_net`, `citext`, `pg_trgm`) và **LỖI CHẶN** nếu extension cần cho migration không thể tự bật (thiếu hẳn, hoặc chưa bật + không-trusted như `pg_cron` + role không phải superuser) kèm lệnh cần chạy bằng superuser; thử quyền `session_replication_role`, và kiểm HTTPS. Chứng chỉ tự ký (Traefik default cert) bị báo rõ; khi đó **không gọi API và không gửi khoá** (không tắt kiểm chứng chỉ).
- **schema:** `--dry-run` hoàn toàn chỉ đọc (chưa có bảng lịch sử = chưa áp gì, không tạo gì). Cùng kiểm extension như `check` và dừng ngay từ đầu nếu có lỗi chặn. Áp theo thứ tự tên tệp; mỗi tệp chạy như một giao dịch ngầm; ghi `supabase_migrations.schema_migrations` để `supabase db push` sau này không áp lại; dừng ở tệp lỗi và in tên tệp cùng đoạn SQL gần vị trí lỗi. Thiếu extension thì dừng trước khi áp tệp nào.
- **data:** thứ tự `auth.users`, `auth.identities`, rồi `public.*` theo khoá ngoại (cha trước con). Cột sinh (generated) bị bỏ, cột chỉ có ở một phía bị bỏ (phiên bản GoTrue có thể khác). Mật khẩu đã băm bcrypt nên người dùng vẫn đăng nhập; phiên cũ hết hạn vì JWT secret khác. DB cũ được đọc trong **một giao dịch repeatable read** (ảnh chụp nhất quán giữa các bảng). DB mới nạp bằng `session_replication_role = replica` để không chạy trigger (không sinh thông báo/XP lặp); nếu không đủ quyền, lệnh dừng trừ khi thêm `--allow-triggers`. Mỗi bảng: COPY vào bảng tạm rồi `insert … on conflict do nothing`. **Bảng không có khoá duy nhất mà đích đã có dòng thì bị bỏ qua** để khỏi nhân đôi. Cuối cùng đồng bộ sequence/identity. Lọc bảng: `--skip masterbase_positions,...`, `--only academies`.
- **storage:** tạo bucket hoặc cập nhật cấu hình (public, giới hạn dung lượng, kiểu tệp) theo instance cũ, rồi tải tệp lên bằng Storage API (đi đệ quy thư mục, giữ kiểu tệp, bỏ qua tệp đã có cùng dung lượng). Chính sách RLS trên `storage.objects` đến từ migration (lệnh `schema`). Cần HTTPS hợp lệ ở đích.
- **verify:** so số dòng từng bảng và số tệp từng bucket; thoát mã 1 nếu lệch. Nếu dữ liệu cũ còn thay đổi trong lúc chuyển, chạy lại `data` (và `storage`) ngay trước khi đổi app, rồi `verify`.

## Lưu ý bảo mật

Cổng Postgres 5432 của instance mới đang mở công khai và có thể không có TLS, nên mật khẩu `postgres` đi qua mạng ở dạng rõ. Nên đóng cổng cho IP ngoài máy dev, dùng mật khẩu dài ngẫu nhiên, hoặc chạy công cụ qua đường hầm SSH; xoay mật khẩu sau khi chuyển xong.

## Phương án khác (đã cân nhắc)

`pg_dump | psql` qua Docker cho schema + dữ liệu `public` trong vài lệnh, nhưng: máy dev không có `psql`/Docker sẵn; `auth.*` và `storage.*` của hai phiên bản Supabase có thể khác cột; không ghi lịch sử migration; không có kiểm tra thứ tự/số dòng. Nếu chủ dự án sẵn Docker, có thể dùng `pg_dump --data-only --schema=auth --schema=public` làm cách đối chứng, còn công cụ này là đường chính vì idempotent và có `verify`.
