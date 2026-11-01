# Giai đoạn 27: Gửi email (Resend), nạp Masterbase từ broadcast Lichess, kho puzzle tìm và thêm hàng loạt

> **Trạng thái:** lập kế hoạch 2026-11-02, chưa triển khai.
> **Tiếp nối:** Giai đoạn 26 (`19-giai-doan-26-quan-tri-hoc-vien-theo-chesslang.md`): 26a–26c xong, PR #78–#84.
> **Quyết định của chủ dự án (2026-11-02):**
> - Gửi email dùng **Resend**.
> - **Chưa có tài khoản PayOS**, nên thanh toán tự động để sau. Thẻ PayOS giữ "Sắp có".
> - Masterbase **dùng kho ván broadcast của Lichess**.

## 1. Căn cứ quan sát bằng REA (clean-room)

- **Trình soạn study của Chesslang** (`/study/<id>/builder`): mở bản nháp "Untitled draft" có sẵn trên tài khoản, không tạo bản mới. Kịch bản và ảnh ở `rea/evidence/gd27-2026-11-02/` (`scenario-study-draft.json`, `shot_draft.png`); `capture-*.json` không commit.
  - **Nhập & AI:**
    - Nhập từ Lichess (erpchess ✅ 24c).
    - **AI Puzzle Generator** ("tìm và thêm hàng loạt puzzle, có AI hỗ trợ chọn"): erpchess **chưa có**.
    - Upload PGN thành puzzle hoặc trình xem ván: erpchess có phần nhập PGN vào CSDL ván và nhập PGN thành puzzle (GĐ6).
  - **Hoạt động lõi:** Puzzle, Trắc nghiệm, Giải thích, Bắt quân, Đánh với máy, Video, Xem ván. erpchess **đã có đủ 7 loại**.
  - Ghi chú ở 24d nói Chesslang có "walkthrough, tính toán, trang HTML". Lần quan sát này **không còn thấy** các loại đó trong trình soạn, nên bỏ khỏi danh sách cần làm.
- **Trang Email** (`/administration/email`, ảnh ở `rea/evidence/gd26-2026-11-01/shot_administration_email.png`): cấu hình tên miền gửi bằng bản ghi DNS, có nút cấu hình tên miền.
- **Sổ cái còn 🟡 liên quan:**
  - `ops.notify`: chưa gửi email hay push.
  - `db.masterbase`: chưa có dữ liệu.
  - `ops.invoices`: chưa có PayOS/Stripe, để sau.

## 2. Chia PR

Mỗi PR một nhánh riêng từ `main`. Cổng kiểm thử giống kế hoạch 18 mục 5, cộng chụp REA bằng tài khoản thử `thu-nghiem-ui`. PR có migration mở ở dạng **draft**, chủ dự án áp lên `erpchess-dev` (trong SQL Editor hoặc nhờ agent Supabase) và chạy pgTAP xong mới merge.

### PR 27a: Gửi email qua Resend (có migration nhỏ nếu cần)

> **Đã làm (PR nháp, chờ áp migration, triển khai function và đặt secret):**
> - Migration `20261102000042_email_log.sql`: bảng `email_log` (owner đọc, chỉ service role ghi) và cột `notifications.emailed_at`. Dùng bảng riêng thay vì `notifications` vì người nhận có thể là người được mời chưa có tài khoản, và nhật ký dùng để giới hạn tần suất. pgTAP `34_email_log.sql`.
> - Edge Function `send-email` (logic thuần ở `handler.ts`, mẫu email ở `packages/domain/src/email.ts` chép sang `_shared/` bằng `sync-shared.mjs`). Ba chế độ: `status` (nhân sự), `send` (nhân sự: email thử tới chính mình, lời mời HLV/phụ huynh tới email của lời mời), `flush` (chỉ service role: gửi email cho thông báo quiz và nhắc học phí chưa gửi).
> - Trang `/a/$slug/email` (chủ học viện), gửi lời mời qua email ở `InviteLink`, thẻ "Người gửi lời mời" ở trang Tích hợp phản ánh trạng thái gửi email thật.
> - Giao quiz/bài tập và nhắc học phí không sửa trigger/cron có sẵn: chúng đã tạo `notifications` (đã theo công tắc loại thông báo); `flush` gửi email cho các dòng đó nên công tắc loại thông báo áp dụng tự nhiên. Loại "bài tập" dùng chung loại `quiz` của hệ thống thông báo hiện tại.
> - Chưa có khoá Resend nên chưa gửi thật; không có khoá thì function trả `not_configured` (HTTP 503) và giao diện hiện hướng dẫn.
- **Edge Function `send-email`:**
  - Nhận `{ academy_id, kind, to, data }`.
  - Dựng nội dung từ **mẫu soạn sẵn trong code**, không lấy nội dung từ client để tránh bị lạm dụng.
  - Gọi API Resend bằng secret `RESEND_API_KEY`.
  - Người gửi lấy từ cấu hình "Người gửi lời mời" (26b, `academies.contact`): tên hiển thị và `reply_to`. Địa chỉ `from` dùng tên miền đã xác minh ở secret `RESEND_FROM` (ví dụ `ERPChess <no-reply@duongsinh.vn>`). Chưa có tên miền thì dùng `onboarding@resend.dev`; chế độ thử của Resend chỉ gửi được tới email chủ tài khoản Resend.
  - Ghi nhật ký vào bảng nhật ký thông báo có sẵn (GĐ12), gồm trạng thái `sent`/`failed` và mã lỗi.
- **Các loại email đợt đầu**, tận dụng sự kiện đã có:
  - Mời HLV (link mời).
  - Mời phụ huynh.
  - Nhắc học phí (`reminder_rules` của GĐ12, cron gọi Edge Function).
  - Giao quiz hoặc bài tập mới, kèm hạn nộp.
  - Mỗi loại có công tắc bật/tắt dùng chung cài đặt thông báo theo loại đã có.
- **Chống lạm dụng:**
  - Chỉ staff học viện, hoặc cron với service role, được gọi.
  - Mỗi học viện giới hạn N email/giờ.
  - Không gửi tới địa chỉ không thuộc thành viên hay lời mời của học viện.
- **Web:**
  - Trang `/a/$slug/email` (Quản trị → Vận hành → Email): trạng thái (đã cấu hình khoá hay chưa, chỉ biết qua lần gửi thử, không bao giờ hiện khoá), tên miền gửi, nút **Gửi thử** tới email của chính mình, nhật ký 50 email gần nhất.
  - Thẻ "Người gửi lời mời" ở trang Tích hợp đổi chữ "chưa gửi thật" thành trạng thái thật.
- **Test:** unit cho bộ dựng mẫu email (vi/en), test Edge Function với `fetch` giả lập, pgTAP nếu có migration.
- **Cần chủ dự án:**
  1. Tạo tài khoản Resend và API key.
  2. Đặt secret: `supabase secrets set RESEND_API_KEY=... RESEND_FROM=...`, hoặc nhập trong Dashboard → Edge Functions → Secrets. **Không** dán khoá vào chat hay repo.
  3. Nếu muốn gửi cho người khác, xác minh tên miền gửi trong Resend (thêm bản ghi DNS).
  4. Deploy Edge Function (agent Supabase làm được).

### PR 27b: Nạp Masterbase từ kho broadcast Lichess (không đổi giao diện, chủ yếu script)

- **Nguồn:** https://database.lichess.org/#broadcasts, file `lichess_db_broadcast_YYYY-MM.pgn.zst` (giấy phép **CC0**). Ghi nguồn và giấy phép vào cột `source` của `masterbase_games`.
- **Script `scripts/masterbase-broadcast.mjs`:**
  - Tải các tháng được chọn.
  - Giải nén `.zst` bằng stream.
  - Lọc ván có Elo **cả hai bên ≥ 2300**, có kết quả, ít nhất 10 nước.
  - Bỏ ván trùng (khoá: tên hai bên + ngày + giải + vòng).
  - Gọi lại logic `masterbase-export.mjs` (23b) để ra `games.csv` và `positions.csv`.
  - Giới hạn tổng dung lượng ước tính **< 300 MB** để vừa gói Free: tính trước theo số ván × 40 thế, dừng khi chạm trần.
  - In thống kê: số ván, dải năm, dung lượng ước tính.
- **Nạp:** dùng `\copy` với chuỗi kết nối Postgres (service role hoặc mật khẩu DB). Có thể tách lô và thêm `--dry-run`.
- **Kiểm:** RPC `search_masterbase` trả ván cho thế khởi đầu và sau `1.e4 c5`; trang Bàn cờ, tab Masterbase hiện ván. Chụp REA.
- **Cần chủ dự án:**
  1. Chọn khoảng tháng. Đề xuất bắt đầu 12 tháng gần nhất, xem dung lượng rồi mở rộng.
  2. Chạy lệnh nạp: cần chuỗi kết nối DB, hoặc nhờ agent Supabase chạy theo lô.
  3. Theo dõi dung lượng DB ở Dashboard.

### PR 27c: Kho puzzle, tìm và thêm hàng loạt vào học liệu (có migration)

- Thay cho "AI Puzzle Generator" của Chesslang: tìm puzzle theo **chủ đề** (fork, pin, mate in 2…), **khoảng rating**, **số nước**, rồi chọn nhiều và thêm hàng loạt thành hoạt động puzzle trong trình soạn study. Đợt đầu không dùng AI; gợi ý chọn bằng quy tắc (trải đều rating và chủ đề).
- **Nguồn:** kho puzzle Lichess https://database.lichess.org/#puzzles (giấy phép **CC0**), file CSV gồm FEN, nước giải, rating, chủ đề.
- **Dung lượng:** chỉ nạp một tập con, ví dụ **100–200 nghìn** puzzle trải đều theo rating và chủ đề. Không nạp đủ khoảng 5 triệu puzzle vì không vừa gói Free.
- **Migration:**
  - Bảng `puzzle_bank` (id Lichess, FEN, moves, rating, themes `text[]`, popularity, `source`).
  - Index GIN trên themes, index trên rating.
  - RLS chỉ đọc cho người đã đăng nhập.
  - RPC `search_puzzle_bank(themes, rating_min, rating_max, limit, offset)`.
- **Script nạp** `scripts/puzzle-bank-import.mjs`: lấy mẫu phân tầng, xuất CSV rồi `\copy`.
- **Web:**
  - Trong trình soạn study có nút "Thêm từ kho puzzle": bộ lọc chủ đề (nhãn tiếng Việt), rating, số nước; bảng kết quả có bàn cờ nhỏ; chọn nhiều; nút "Thêm N puzzle".
  - Mỗi puzzle chép thành một hoạt động puzzle, dùng cấu hình mặc định của học viện (24d).
- **Cần chủ dự án:** chạy lệnh nạp như ở 27b.

### Để sau (ghi lại, không làm trong GĐ27)

- **PayOS:** chờ chủ dự án có tài khoản. Thẻ ở trang Tích hợp giữ "Sắp có".
- **Push notification mobile:** Expo push, cần cấu hình EAS.
- **Engine trên mobile** (claim `study.activity.engine` 🟡): build Arasan cho Android/iOS (xem `03-engine-arasan.md`).

## 3. Thứ tự đề xuất

27a (email) → 27b (Masterbase) → 27c (kho puzzle).
- 27a phụ thuộc khoá Resend, nhưng vẫn viết code và test với `fetch` giả lập trước được. Chỉ phần gửi thật chờ khoá.
- 27b và 27c dùng chung cách nạp dữ liệu lớn, nên làm liền nhau.
