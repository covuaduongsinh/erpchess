# Chuyển Supabase từ cloud `erpchess-dev` sang self-host `supabaseerpchess.dsc.edu.vn`

> **Trạng thái (2026-11-02):** B1 xong (#90–#92). Schema, dữ liệu, storage đã chuyển và `verify` khớp (75 bảng, `auth.users` 13, 2 bucket 0 tệp). **B2 xong** (9 Edge Functions chạy, cron trỏ URL mới, secret qua `env_file`). **B3:** pgTAP đạt toàn bộ, REA chụp trên DB mới; kho puzzle/Masterbase đã nạp. **B4:** PR này đổi mẫu `.env.example` và tài liệu; bước đổi nơi deploy (Vercel) và cấu hình Auth chờ chủ dự án.
> **Yêu cầu của chủ dự án:** Supabase đã dựng sẵn ở `supabaseerpchess.dsc.edu.vn` (IP `217.15.160.118`). Cần chuyển dữ liệu sang đó và trỏ app tới địa chỉ mới.

## 1. Hiện trạng máy chủ mới (kiểm 2026-11-02 từ máy dev)

| Hạng mục  | Kết quả                                                                                                                                |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| DNS       | `A supabaseerpchess.dsc.edu.vn → 217.15.160.118`. Đã phân giải được qua 8.8.8.8 (NS của Mắt Bão).                                      |
| HTTP      | Chuyển hướng sang HTTPS.                                                                                                               |
| HTTPS     | **Chứng chỉ hợp lệ** (Let's Encrypt đã cấp thành công, kiểm tra TLS qua `YR1` đến 2027). `/auth/v1/health` trả HTTP 200 khi có apikey. |
| Quản trị  | Dokploy ở `http://217.15.160.118:3000`: mở công khai qua HTTP, không mã hoá.                                                           |
| Postgres  | Cổng **54325** dành riêng cho ERP Chess (cổng 5432 là của dự án khác).                                                                 |
| Cổng khác | 6543 (pooler), 8000, 8443 đóng.                                                                                                        |

### Việc chủ dự án cần làm trước (bảo mật và HTTPS)

1. **Cấp chứng chỉ Let's Encrypt** cho tên miền trong Dokploy: domain của service Supabase (Kong), bật HTTPS với certResolver `letsencrypt`, rồi deploy lại. DNS vừa trỏ xong nên giờ Let's Encrypt mới xác minh được.
2. **Đóng cổng 5432 ra Internet:** chỉ cho IP của máy dev hoặc mạng tin cậy qua firewall/ufw. Nếu không làm được thì ít nhất dùng mật khẩu `postgres` dài và ngẫu nhiên, và chỉ mở trong lúc chuyển dữ liệu.
3. **Không để bảng điều khiển Dokploy (cổng 3000) mở công khai qua HTTP:** gắn tên miền riêng có HTTPS, hoặc chặn bằng firewall.
4. Kiểm phiên bản Postgres (đề xuất ≥ 15) và các extension: `pg_cron`, `pg_net`, `pgcrypto`, `pgtap` (chỉ khi chạy test), `pg_graphql` tuỳ chọn.

## 2. Thông tin cần (đặt trong tệp, không dán vào chat)

Tạo tệp `D:\code\erpchess\.env.supabase-move`. Tệp này đã bị gitignore theo mẫu `.env.*`.

```
OLD_DATABASE_URL=postgresql://postgres.<ref>:<mật-khẩu>@<pooler-host>:5432/postgres   # erpchess-dev (session pooler)
OLD_SUPABASE_URL=https://eordwpktwokvmhymvcyd.supabase.co
OLD_SERVICE_ROLE_KEY=...      # để tải file Storage
NEW_DATABASE_URL=postgresql://postgres:<mật-khẩu>@217.15.160.118:54325/postgres?sslmode=disable
NEW_SUPABASE_URL=https://supabaseerpchess.dsc.edu.vn
NEW_ANON_KEY=...              # publishable/anon của instance mới
NEW_SERVICE_ROLE_KEY=...      # để tải file Storage lên
```

## 3. Các bước (mỗi bước có lệnh kiểm; không xoá gì ở `erpchess-dev`)

### B1. Công cụ chuyển (PR, không migration)

Thư mục `scripts/supabase-move/`, Node, dùng thư viện `postgres` đã có ở 27d. Mọi lệnh đọc `.env.supabase-move` và không bao giờ in khoá.
- **`check`:** kết nối cả hai DB; in phiên bản Postgres, extension, số dòng từng bảng `public` và `auth.users`; kiểm HTTPS và `/auth/v1/health` bằng `NEW_ANON_KEY`.
- **`schema`:**
  - Áp lần lượt `supabase/migrations/*.sql` lên DB mới.
  - Ghi lịch sử vào `supabase_migrations.schema_migrations` để sau này `supabase db push` không áp lại.
  - Dừng ngay nếu một file lỗi, báo tên file và lệnh lỗi.
- **`data`:**
  - Sao chép dữ liệu theo thứ tự khoá ngoại bằng `COPY TO STDOUT` ở DB cũ và `COPY FROM STDIN` ở DB mới.
  - Phạm vi: `auth.users`, `auth.identities` (mật khẩu đã băm bcrypt, nên người dùng vẫn đăng nhập được, kể cả học viên dùng PIN), rồi toàn bộ bảng `public`.
  - Tắt trigger người dùng trong lúc nạp (`session_replication_role = replica`) để không sinh thông báo hay XP lặp, rồi đồng bộ lại các sequence.
  - Có `--dry-run`. Chạy lại lần hai thì không tạo bản ghi trùng.
- **`storage`:** liệt kê bucket và file ở instance cũ qua Storage API, tạo bucket với cùng chính sách (public, giới hạn dung lượng, kiểu file) ở instance mới, rồi tải file lên lại.
- **`verify`:** so số dòng từng bảng và số file từng bucket giữa hai bên.
- Test bằng PGlite cho thứ tự bảng, COPY và đồng bộ sequence.

### B2. Edge Functions, secret, lịch chạy

- Deploy tất cả function trong `supabase/functions/` lên instance mới. Self-host chạy function bằng container `edge-runtime`: chép thư mục `functions` vào volume rồi khởi động lại, theo đúng cách Dokploy đang dựng.
- Đặt lại secret: LiveKit, `RESEND_API_KEY`, `RESEND_FROM`, `APP_URL`.
- Dựng lại các job `pg_cron` (nhắc học phí, lịch quiz, tournament-tick, flush email). Đổi URL gọi function sang `https://supabaseerpchess.dsc.edu.vn/functions/v1/...`.
- Cấu hình Auth: `SITE_URL` và các redirect URL của web; tắt hoặc bật xác nhận email theo ý chủ dự án; SMTP qua Resend nếu cần.

> **Đã làm (2026-11-02, chi tiết lệnh ở `scripts/supabase-move/deploy-functions.md`):**
> - 9 function (`create-student`, `game-move`, `livekit-token`, `quiz-answer`, `send-email`, `submit-activity`, `submit-attempt`, `tournament-admin`, `tournament-tick`) chép vào volume `functions` của stack Dokploy `compose-reboot-neural-matrix-h335x9` (nhận diện bằng cổng DB 54325; máy chủ có nhiều stack Supabase khác). Cả 9 trả `OPTIONS 200` và `POST` không đăng nhập `401` do chính function trả; `send-email` chế độ `status` có đăng nhập trả `configured: true`.
> - Secret: tệp `files/functions.env` (chmod 600, nạp bằng `env_file`) có `RESEND_API_KEY` (dùng chung khoá Resend của SMTP Auth) và `RESEND_FROM`. **Còn thiếu:** `APP_URL`, `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` (chủ dự án điền; secret của cloud không đọc ngược được).
> - Cron: 3 job đã có từ migration. `tournament-tick` cứng URL cloud cũ nên đã chạy `scripts/supabase-move/post-move-cron.sql` trên DB mới (không phải migration); sau đó tick trả 200 `{"started":0,...}`.
> - Auth (2026-11-02, đã được chủ dự án duyệt): đã đặt `ENABLE_ANONYMOUS_USERS`, `ENABLE_PHONE_SIGNUP`, `ENABLE_PHONE_AUTOCONFIRM` = `false` trong `.env` của stack (sao lưu ở `/root/backups-erpchess-move/…-auth/`), chỉ tạo lại service `auth`; `/auth/v1/settings` giờ giống cloud cũ (`anonymous_users` và `phone` tắt), đăng ký ẩn danh/điện thoại bị từ chối, đăng nhập tài khoản thử vẫn 200. **Env của Dokploy được mã hoá trong DB của nó nên chủ dự án phải đặt cùng 3 biến ở Dokploy → Environment, nếu không lần Deploy sau sẽ ghi đè về `true`.** `SITE_URL` chưa đổi (chờ địa chỉ web app). Xem bảng ở `deploy-functions.md` mục 6. Self-host đang bật thêm đăng nhập ẩn danh và đăng ký/tự xác nhận điện thoại (cloud cũ tắt, app không dùng): nên tắt; `SITE_URL` đang là địa chỉ API, nên đặt thành địa chỉ web app và thêm vào danh sách redirect.
> - ⚠️ Dokploy có thể ghi đè `docker-compose.yml` khi Deploy: cần thêm `env_file` vào service `functions` trong giao diện Compose của Dokploy.

### B3. Chạy thử và nghiệm thu

- Chạy toàn bộ pgTAP trên DB mới. Chạy trong giao dịch rồi hoàn tác, giống cách đã làm trên cloud.
- Trỏ bản build web cục bộ sang instance mới, chụp REA bằng tài khoản thử `thu-nghiem-ui` các trang chính: đăng nhập, Tổng quan, Học viên, Báo cáo, Bàn cờ, Masterbase, kho puzzle, Email gửi thử, ván đấu (`game-move`).
- Nạp kho puzzle và Masterbase (27d) thẳng vào DB mới bằng `db-load-csv.mjs`. Không còn giới hạn 500 MB nên có thể nạp đủ 12 tháng.

> **Đã làm (2026-11-02):** pgTAP chạy trên DB mới bằng `psql` trong container db (mỗi tệp `begin … rollback`): 35 tệp đạt. Lưu ý: (a) tệp 15 đếm thông báo toàn cục nên lệch khi DB có dữ liệu thật (8 thông báo quiz sẵn, giống hệt ở cloud cũ), đạt 16/16 khi xoá chúng trong giao dịch rồi rollback; (b) tệp 17, 19, 23, 27, 29 dùng `col_default_is(..., '''x''::kiểu')`, bản pgTAP trên self-host so theo kiểu nên báo lệch/lỗi, đạt khi bỏ phần ép kiểu của đối số; (c) tệp 17–29 cần `create extension pgtap` trước (cài trong giao dịch rồi rollback). REA trên DB mới (đăng nhập, Tổng quan, Học viên, Báo cáo, Email, Học liệu, kho puzzle): `rea/evidence/gd-move/`. Kho puzzle và Masterbase đã nạp vào DB mới (xem mục 27d ở plan 20): DB 339 MB; REA có dữ liệu ở `rea/evidence/gd27d/`.

### B4. Chuyển app (PR)

> **Đã làm (PR này):** `.env.example` của web, mobile, site trỏ `https://supabaseerpchess.dsc.edu.vn`; `docs/ops/deployment-guide.md` có mục 2.5 và sửa nhầm `VITE_SUPABASE_ANON_KEY` thành `VITE_SUPABASE_PUBLISHABLE_KEY`. `.env.local` trên máy dev đã trỏ DB mới (bản cũ lưu `*.bak-cloud`, bị gitignore). **Chủ dự án cần:** đổi biến môi trường trên Vercel (web, site) và EAS (mobile), build lại; đặt `SITE_URL` Auth. Memory và tài liệu cũ nhắc `eordwpktwokvmhymvcyd` còn lại là ghi chú lịch sử (migration 18 giữ nguyên, chỉ file `post-move-cron.sql` thay URL trên DB mới).
- Đổi `VITE_SUPABASE_URL` và `VITE_SUPABASE_PUBLISHABLE_KEY` (web), `EXPO_PUBLIC_*` (mobile), biến môi trường của `apps/site`, desktop và nơi deploy web. Cập nhật `.env.example` và tài liệu `docs/ops/`.
- Cập nhật memory và các tài liệu đang nhắc `eordwpktwokvmhymvcyd`.
- **Giữ `erpchess-dev` chạy song song** ít nhất 1–2 tuần. Chỉ pause khi chủ dự án xác nhận. Không xoá.

## 4. Rủi ro

| Rủi ro                                       | Cách xử lý                                                                                                                    |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Chứng chỉ tự ký làm app không kết nối được   | Chặn ở B1: lệnh `check` báo lỗi rõ ràng. Không chuyển app khi chưa có chứng chỉ hợp lệ.                                       |
| Dữ liệu thay đổi trên cloud trong lúc chuyển | Chạy `data` lần cuối ngay trước khi đổi app, dựa trên tính chạy lại không trùng của `data`. Hoặc tạm khoá ghi trong vài phút. |
| JWT secret của self-host khác cloud          | Không ảnh hưởng: phiên đăng nhập cũ hết hạn, người dùng đăng nhập lại; mật khẩu vẫn dùng được.                                |
| Extension thiếu (`pg_cron`, `pg_net`)        | `check` báo trước khi áp schema.                                                                                              |
| Lộ cổng 5432 hoặc Dokploy                    | Mục 1, việc chủ dự án làm trước.                                                                                              |
