# Triển khai Edge Functions, secret, cron và Auth trên Supabase self-host (Dokploy)

Bước B2 của `docs/plans/21-chuyen-supabase-sang-self-host.md`. Đây là **cách đã làm thật** trên máy chủ `217.15.160.118` ngày 2026-11-02 (stack Dokploy `compose-reboot-neural-matrix-h335x9`, địa chỉ `https://supabaseerpchess.dsc.edu.vn`). Máy chủ chạy **nhiều stack Supabase của dự án khác**: luôn xác định đúng stack bằng cổng DB `54325` (`docker ps --format '{{.Names}} {{.Ports}}' | grep 54325`) trước khi sửa gì.

Đặt biến cho gọn (thay theo stack):

```bash
D=/etc/dokploy/compose/compose-reboot-neural-matrix-h335x9      # thư mục stack
FN=$D/files/volumes/functions                                    # volume được mount vào container `functions`
```

## 1. Cách self-host chạy function

Container `supabase/edge-runtime` mount `$FN` vào `/home/deno/functions`. `main/index.ts` là bộ định tuyến: `/functions/v1/<tên>` → thư mục `<tên>/` cùng cấp, và **chuyển nguyên môi trường của container** cho worker. Vì vậy chỉ cần (a) chép thư mục function vào `$FN`, (b) đưa secret vào môi trường container `functions`, (c) tạo lại container.

Lưu ý: `FUNCTIONS_VERIFY_JWT="false"` đang đặt cho cả stack, tức bộ định tuyến **không** kiểm JWT; mỗi function tự xác thực (`getUser` bằng token của người gọi, hoặc chuỗi bí mật như `tournament-tick`), nên hành vi giống cloud với `--no-verify-jwt`. Không đổi sang `true`: `tournament-tick` do pg_cron gọi bằng `x-tick-secret`, không có JWT.

## 2. Chép function

Mỗi function đã tự chứa thư mục `_shared` (do `supabase/functions/sync-shared.mjs`), nên chỉ cần chép thư mục; **không** chép `_lib/`, `sync-shared.mjs`, test. Chạy từ gốc repo trên máy dev:

```bash
cd supabase/functions
tar --exclude='*.test.ts' -cf - create-student game-move livekit-token quiz-answer send-email \
    submit-activity submit-attempt tournament-admin tournament-tick \
  | ssh root@217.15.160.118 "tar -C $FN -xf -"
```

Không đè `main/`, `hello/`, `deno.jsonc` của stack. Cập nhật function sau này: chạy lại đúng lệnh trên rồi tạo lại container (mục 4).

## 3. Secret

Function đọc: `RESEND_API_KEY`, `RESEND_FROM`, `APP_URL` (`send-email`); `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` (`livekit-token`); còn `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` đã do compose cấp sẵn.

Compose của Supabase chỉ truyền một danh sách biến cố định, nên secret riêng đặt trong **một tệp riêng ngoài `.env` do Dokploy quản**, nạp bằng `env_file` (tệp `chmod 600`, không commit):

```bash
# $D/files/functions.env  (ví dụ; điền giá trị thật, KHÔNG dán vào chat/repo)
RESEND_API_KEY=...            # hiện đã dùng cùng khoá Resend với SMTP của Auth (SMTP_PASS)
RESEND_FROM="ERP Chess <no-reply@dsc.edu.vn>"
APP_URL=https://<địa-chỉ-web-app>
LIVEKIT_URL=wss://<...>.livekit.cloud
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
```

Thêm đúng hai dòng vào service `functions` trong `$D/code/docker-compose.yml` (ngay dưới `image:`), sao lưu trước:

```yaml
env_file:
  - ../files/functions.env
```

```bash
mkdir -p /root/backups-erpchess-move && cp -a $D/code/docker-compose.yml $D/code/.env /root/backups-erpchess-move/
cd $D/code && docker compose config -q && echo OK
```

⚠️ **Dokploy có thể ghi đè `code/docker-compose.yml` ở lần Deploy kế tiếp** (nó sinh lại từ cấu hình trong giao diện). Để bền: mở Dokploy → dịch vụ Supabase → **Compose**, thêm hai dòng `env_file` ở trên vào service `functions` rồi Save (cùng với dòng `54325:5432` ở service `db` nếu chưa có). Tệp `functions.env` và thư mục function nằm trong `files/` nên không bị ghi đè.

## 4. Tạo lại container và kiểm

```bash
cd $D/code && docker compose up -d --no-deps functions      # chỉ service functions; DB/Auth không bị đụng
docker ps --format '{{.Names}} {{.Status}}' | grep functions   # phải (healthy)
```

Kiểm từ máy dev (chỉ đọc):

```powershell
# OPTIONS phải 200; POST không đăng nhập phải 401 do chính function trả (chứng tỏ worker nạp được mã và _shared)
curl -i -X OPTIONS https://supabaseerpchess.dsc.edu.vn/functions/v1/send-email -H "Origin: http://localhost:5173" -H "Access-Control-Request-Method: POST"
```

Có đăng nhập: `send-email` với `{"mode":"status","academy_id":"…"}` phải trả `configured:true`.

## 5. Cron

Các job `tournament-tick` (mỗi phút), `fee-reminders` (01:00), `quiz-schedules` (5 phút) đã được migration tạo. Chỉ `tournament-tick` gọi HTTP, và migration cứng URL cloud cũ → chạy `scripts/supabase-move/post-move-cron.sql` **trên DB mới** (không phải migration; cloud cũ vẫn chạy song song). Chuỗi bí mật `private.cron_secrets` được sinh ngẫu nhiên trong DB mới, không cần chép. Kiểm: sau một phút

```sql
select status_code, left(content, 80) from net._http_response order by id desc limit 3;  -- 200 {"started":0,...}
```

(`401` ở các dòng cũ là lúc job còn gọi URL cloud bằng secret mới.) Muốn gửi email thông báo tự động, thêm job gọi `send-email` chế độ `flush` theo mục 5 trong `so-sanh.md`/kế hoạch 27a.

## 6. Auth (GoTrue)

Cấu hình Auth đặt trong **Environment** của stack ở Dokploy (compose đã ánh xạ sang `GOTRUE_*`). Hiện trạng kiểm bằng `GET /auth/v1/settings` ngày 2026-11-02 so với cloud cũ:

| Mục                                          | Cloud cũ            | Self-host                                                                 | Khuyến nghị                                                                             |
| -------------------------------------------- | ------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Đăng ký email                                | bật                 | bật                                                                       | giữ                                                                                     |
| Xác nhận email (`ENABLE_EMAIL_AUTOCONFIRM`)  | tắt (phải xác nhận) | tắt                                                                       | giữ                                                                                     |
| Đăng nhập ẩn danh (`ENABLE_ANONYMOUS_USERS`) | tắt                 | **bật**                                                                   | đặt `false` (app không dùng `signInAnonymously`)                                        |
| Đăng ký điện thoại (`ENABLE_PHONE_SIGNUP`)   | tắt                 | **bật**                                                                   | đặt `false` (app không dùng)                                                            |
| `ENABLE_PHONE_AUTOCONFIRM`                   | tắt                 | **bật**                                                                   | đặt `false` (nếu giữ phone, không được tự xác nhận)                                     |
| SMTP                                         | —                   | Resend (`smtp.resend.com`, `no-reply@dsc.edu.vn`)                         | giữ                                                                                     |
| `SITE_URL`                                   | —                   | `https://supabaseerpchess.dsc.edu.vn` (địa chỉ API)                       | đặt thành **địa chỉ web app** (link trong email xác nhận/đặt lại mật khẩu mở trang này) |
| `ADDITIONAL_REDIRECT_URLS`                   | —                   | API, `duongsinh://**`, `http://localhost:8081/**`, `tauri://localhost/**` | thêm origin web app (`https://<web-app>/**`), `http://localhost:5173/**` khi dev        |

Sau khi đổi Environment, **Deploy lại** stack trong Dokploy (hoặc `docker compose up -d --no-deps auth`).
