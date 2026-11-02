# Chuyển Supabase từ cloud `erpchess-dev` sang self-host `supabaseerpchess.dsc.edu.vn`

> **Trạng thái:** lập kế hoạch 2026-11-02, chưa triển khai.
> **Yêu cầu của chủ dự án:** Supabase đã dựng sẵn ở `supabaseerpchess.dsc.edu.vn` (IP `217.15.160.118`). Cần chuyển dữ liệu sang đó và trỏ app tới địa chỉ mới.

## 1. Hiện trạng máy chủ mới (kiểm 2026-11-02 từ máy dev)

| Hạng mục  | Kết quả                                                                                                                                                                                                                             |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DNS       | `A supabaseerpchess.dsc.edu.vn → 217.15.160.118`. Đã phân giải được qua 8.8.8.8 (NS của Mắt Bão).                                                                                                                                   |
| HTTP      | Chuyển hướng sang HTTPS.                                                                                                                                                                                                            |
| HTTPS     | **Chứng chỉ chưa hợp lệ.** Traefik đang dùng `TRAEFIK DEFAULT CERT` tự ký, nên trình duyệt, app và Supabase JS sẽ từ chối kết nối. Bỏ qua kiểm chứng chỉ thì `/auth/v1/health` trả 401 (Kong cần `apikey`), tức Supabase đang chạy. |
| Quản trị  | Dokploy ở `http://217.15.160.118:3000`: mở công khai qua HTTP, không mã hoá.                                                                                                                                                        |
| Postgres  | Cổng **5432 mở công khai**.                                                                                                                                                                                                         |
| Cổng khác | 6543 (pooler), 8000, 8443 đóng.                                                                                                                                                                                                     |

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
NEW_DATABASE_URL=postgresql://postgres:<mật-khẩu>@217.15.160.118:5432/postgres
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

### B3. Chạy thử và nghiệm thu

- Chạy toàn bộ pgTAP trên DB mới. Chạy trong giao dịch rồi hoàn tác, giống cách đã làm trên cloud.
- Trỏ bản build web cục bộ sang instance mới, chụp REA bằng tài khoản thử `thu-nghiem-ui` các trang chính: đăng nhập, Tổng quan, Học viên, Báo cáo, Bàn cờ, Masterbase, kho puzzle, Email gửi thử, ván đấu (`game-move`).
- Nạp kho puzzle và Masterbase (27d) thẳng vào DB mới bằng `db-load-csv.mjs`. Không còn giới hạn 500 MB nên có thể nạp đủ 12 tháng.

### B4. Chuyển app (PR)

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
