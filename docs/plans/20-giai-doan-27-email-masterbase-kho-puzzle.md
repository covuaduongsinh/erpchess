# Giai đoạn 27: Gửi email (Resend), nạp Masterbase từ broadcast Lichess, kho puzzle tìm và thêm hàng loạt

> **Trạng thái (2026-11-02):** code xong cả ba PR. 27a ✅ #86 (migration 42 đã áp). 27b ✅ script #87, dữ liệu đã nạp (2026-11-02). 27c ✅ #88 (migration 43 đã áp, pgTAP 35 đạt 18/18), dữ liệu đã nạp. 27d: script `scripts/db-load-csv.mjs` để nạp CSV bằng `DATABASE_URL` (máy không có `psql`). Dữ liệu đã nạp vào Supabase self-host và đã chụp REA có dữ liệu (`rea/evidence/gd27d/`).
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

> **Đã làm (PR #88, đã merge):** migration `20261102000043_puzzle_bank.sql` (đã áp, pgTAP 35 đạt 18/18), `scripts/puzzle-bank-import.mjs`, `PuzzleBankModal` trong trình soạn study. Dry-run thật: 6.193.530 dòng đọc, 3.292.767 đạt lọc, chọn 149.680 puzzle, CSV 27,0 MB, ước tính 55 MB trong DB. Ảnh REA hiện mới chụp được modal trống; chụp lại sau khi nạp.

### PR 27d: Nạp CSV vào Postgres (không migration)

- **Vì sao:** máy không có `psql`, nên `\copy` ở 27b/27c không chạy được.
- **Script `scripts/db-load-csv.mjs`** (thư viện `postgres` 4.0.0, ghim phiên bản; test bằng PGlite): lệnh con `puzzle-bank` và `masterbase` (games trước positions). Đọc `DATABASE_URL` từ biến môi trường, không nhận mật khẩu qua tham số, không in chuỗi kết nối. Mỗi lô một giao dịch: `COPY` vào bảng tạm rồi `insert … on conflict do nothing`, nên chạy lại không trùng. Có `--dry-run`, in tiến độ, số dòng và `pg_total_relation_size` sau khi nạp.
- **Dữ liệu đã tạo trên máy dev (`out/`, gitignore):** puzzle 149.680 dòng (27,0 MB); Masterbase 2026-04..2026-09: 23.815 ván (44,5 MB) và 960.404 thế (58,4 MB), ước tính 183 MB trong DB. Cộng kho puzzle ~55 MB và DB hiện 24 MB còn khoảng 262 MB, dưới trần 500 MB của gói Free.
- **Cần chủ dự án** (PowerShell, chuỗi kết nối ở Dashboard → Project Settings → Database; dùng Session pooler nếu chỉ có IPv4):

  ```powershell
  $env:DATABASE_URL = 'postgresql://postgres.<ref>:<mật-khẩu>@<host>:5432/postgres'
  node scripts/db-load-csv.mjs puzzle-bank
  node scripts/db-load-csv.mjs masterbase
  ```

> **Đã nạp (2026-11-02, vào Supabase self-host, không nạp vào cloud cũ):** kho puzzle 149.680 dòng (56 MB); Masterbase 23.815 ván + 960.404 thế (46 MB + 215 MB); DB tổng 339 MB. Khi nạp phát hiện lỗi của loader: ô rỗng trong CSV thành NULL làm `eco`/`event`… (`not null default ''`) bị từ chối (cũng sẽ làm `\copy` của psql hỏng); đã sửa bằng `force_not_null` cho các cột text của `masterbase_games`, có test tái hiện.

> **Masterbase lẫn ván engine (kiểm chỉ đọc 2026-11-02, chưa sửa):** broadcast Lichess có giải TCEC (engine đấu engine). Trong 23.815 ván đã nạp có **1.249 ván (5,2%) thuộc TCEC** (`event`/`site` chứa "tcec"; 1.139 ván có `site = tcec-chess.com`), kèm 51.149 thế (5,3%). Mọi ván Elo > 3000 (1.235 ván) đều thuộc TCEC; 14 ván TCEC khác có Elo ≤ 3000 (engine 4k). Không có ván người nào Elo > 3000; người thật Elo cao nhất 2.800–2.998 là 185 ván (Carlsen 2840…), nên quy tắc `Elo > 3000` không bắt nhầm họ, nhưng `Elo > 2800` thì có. Tên có số phiên bản/hash (`9.15.1`, `dev-1f2a3f16`) chỉ trùng với TCEC, không bắt người. Ngưỡng "CCC/Computer/Bot" bằng chuỗi con bắt nhầm (`VCCCSSaq` trong URL), nên chỉ dùng "tcec". Còn lại 22.566 ván người (94,8%): Elo cao nhất mỗi ván 2.300–2.499 là 9.477, 2.500–2.699 là 11.206, 2.700–2.799 là 1.698, từ 2.800 là 185. Lưu ý khi kiểm: server self-host đặt `standard_conforming_strings = off` nên `\d`, `\.`, `\m` trong chuỗi SQL bị nuốt; dùng `[0-9]`, `[.]`, `[[:<:]]`.
>
> **Đề xuất:** (a) lọc ở `masterbase-broadcast.mjs` (bỏ ván có "tcec" trong event/site hoặc Elo > 3000) cho các lần nạp sau, và cột sinh `is_engine boolean generated always as (event ~* 'tcec' or site ~* 'tcec' or coalesce(white_elo,0) > 3000 or coalesce(black_elo,0) > 3000) stored` (migration nhỏ, không UPDATE/DELETE, tự đúng cho dữ liệu nạp sau) cùng `search_masterbase` lọc `not is_engine` theo mặc định; (b) chỉ lọc trong RPC theo quy tắc (không đổi bảng, nhưng vẫn là một migration `create or replace function`, chạy regex trên mỗi dòng khớp và các lần nạp sau vẫn đưa ván engine vào DB). Khuyến nghị (a).
>
> **Mã hoá:** 408 ván (1,7%) có `event`/tên hỏng (vd. `2026å¹´…`, `1� Divis�o`). Nguồn PGN của Lichess đã chứa sẵn chữ mã hoá kép (UTF-8 đọc thành Latin-1 rồi mã hoá lại) hoặc byte Latin-1 (loader giải mã UTF-8 đúng); có thể sửa khi xuất bằng `Buffer.from(s, 'latin1').toString('utf8')` khi kết quả không có ký tự thay thế.

> **PR 27e (chờ chủ dự án áp migration 44; chủ dự án chọn phương án (a) và có sửa mã hoá):**
> - Migration `20261102000044_masterbase_is_engine.sql`: cột sinh `is_engine` (TCEC ở `event`/`site`, hoặc Elo > 3000; không UPDATE/DELETE), chỉ mục một phần `masterbase_games_human_idx`, `search_masterbase` thêm `p_include_engines` (mặc định false = ẩn ván engine; lời gọi 5 tham số cũ vẫn chạy). pgTAP 24 thêm 6 ca (engine ẩn/hiện, null, Elo, cột sinh không ghi được).
> - `masterbase-broadcast.mjs` bỏ ván engine khi lọc (`--include-engines` để giữ) và sửa chữ mã hoá kép bằng `fixMojibake`; đọc nguồn theo từng dòng (UTF-8 nghiêm ngặt, sai thì Latin-1) nên không còn tạo ký tự U+FFFD cho lần nạp sau.
> - `scripts/supabase-move/fix-masterbase-mojibake.mjs`: sửa 292 ván đã nạp (white/black/event/site), mặc định chỉ đọc, `--apply` trong một giao dịch có sao lưu, `--restore`. 110 ván đã mất byte (U+FFFD) không sửa được từ DB, cần nạp lại từ nguồn.
> - Web: công tắc "Gồm ván engine" ở tab Masterbase, mặc định tắt.

### Để sau (ghi lại, không làm trong GĐ27)

- **PayOS:** chờ chủ dự án có tài khoản. Thẻ ở trang Tích hợp giữ "Sắp có".
- **Push notification mobile:** Expo push, cần cấu hình EAS.
- **Engine trên mobile** (claim `study.activity.engine` 🟡): build Arasan cho Android/iOS (xem `03-engine-arasan.md`).

## 3. Thứ tự đề xuất

27a (email) → 27b (Masterbase) → 27c (kho puzzle) → 27d (nạp CSV).
- 27a phụ thuộc khoá Resend, nhưng vẫn viết code và test với `fetch` giả lập trước được. Chỉ phần gửi thật chờ khoá.
- 27b và 27c dùng chung cách nạp dữ liệu lớn, nên làm liền nhau.
