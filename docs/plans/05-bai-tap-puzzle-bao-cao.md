# Giai đoạn 4 — Bài tập, puzzle, báo cáo

Kế hoạch tổng: [00-ke-hoach-tong.md](00-ke-hoach-tong.md) · Nền tảng đã có: `chess-core` (`gradeMove`), bàn cờ web/mobile, học viện/lớp/học viên (Giai đoạn 2).

## Mục tiêu

- **HLV:**
  - Soạn puzzle (dựng thế cờ trên bàn, đi lời giải) hoặc chọn từ thư viện.
  - Gom thành bài tập có hạn nộp, giao cho lớp hoặc từng học viên.
- **Học viên:** làm bài trên web, desktop hoặc mobile. Mỗi nước thử và thời gian làm được ghi lại.
- **HLV / phụ huynh:** xem báo cáo hoàn thành, số lần thử, thời gian.

## Cơ sở dữ liệu (migration `assignments_puzzles`)

| Bảng                 | Cột chính                                                                                                             | RLS                                                                                                 |
| -------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `puzzles`            | `academy_id` (null = thư viện chung), `fen`, `moves text[]` (UCI), `rating`, `themes text[]`, `title`, `created_by`   | Thư viện chung: mọi người đã đăng nhập đều đọc được. Puzzle của học viện: thành viên đọc, staff ghi |
| `assignments`        | `academy_id`, `title`, `instructions`, `due_at`, `created_by`                                                         | Staff đọc/ghi. Học viên/phụ huynh chỉ đọc bài được giao cho mình hoặc cho con                       |
| `assignment_targets` | `assignment_id`, `group_id` hoặc `student_id` (đúng một trong hai)                                                    | Theo `assignments`                                                                                  |
| `assignment_items`   | `assignment_id`, `position`, `puzzle_id`                                                                              | Theo `assignments`                                                                                  |
| `attempts`           | `item_id`, `student_id`, `moves jsonb` (`[{uci, ms, ok}]`), `solved`, `tries`, `time_ms`, `started_at`, `finished_at` | Học viên chỉ ghi bài của mình. Staff đọc trong học viện; phụ huynh đọc của con                      |
- **Hàm `private.assigned_to(assignment, user)`:** đúng khi bài được giao trực tiếp cho học viên, hoặc giao cho lớp mà học viên đang học.
- **View `assignment_progress`** (security_invoker): theo từng học viên × bài tập, gồm số câu đã giải trên tổng số câu, tổng số lần thử, tổng thời gian, lần làm gần nhất.
- **RPC `record_attempt(item_id, moves, solved, time_ms)`:** ghi hoặc cập nhật lần làm. Có kiểm quyền: bài phải được giao cho người gọi. Server **chấm lại** nước đi qua `puzzles.moves`, không tin cờ `solved` do client gửi lên.
  - Cách 1: Edge Function dùng `chess-core`.
  - Cách 2: RPC SQL so khớp chuỗi UCI. Nhưng cách này không chấp nhận được "mọi cách chiếu hết khác" như `gradeMove`.
  - Chọn **Edge Function `submit-attempt`** để dùng đúng `gradeMove` của `chess-core`.

## Thư viện puzzle khởi đầu

- Tôi tự soạn **khoảng 30 puzzle** theo các chủ đề cơ bản (chiếu hết 1–2 nước, bắt quân, ghim, nĩa, xiên, chiếu hết hàng cuối).
- **Mỗi lời giải đều được kiểm bằng Arasan native** qua script, xác nhận nước giải là nước tốt nhất hoặc chiếu hết, rồi mới seed vào DB.
- Thế cờ là dữ kiện, không có bản quyền.
- Bộ puzzle CC0 của Lichess (khoảng 4 triệu thế, file vài trăm MB) để sau, khi người dùng đồng ý tải về.

## Giao diện

| Màn hình                                                                | Web/desktop | Mobile      |
| ----------------------------------------------------------------------- | ----------- | ----------- |
| Thư viện puzzle (lọc theo chủ đề/rating), xem thử                       | ✓           | —           |
| Soạn puzzle: dựng FEN trên bàn, đi lời giải, chọn chủ đề                | ✓           | —           |
| Tạo bài tập: chọn puzzle, giao lớp/học viên, hạn nộp                    | ✓           | ✓ (rút gọn) |
| Học viên: danh sách bài, làm puzzle (gợi ý sai/đúng, đối phương tự đáp) | ✓           | ✓           |
| Báo cáo: bảng học viên × bài tập, chi tiết từng lần thử                 | ✓           | ✓ (xem)     |

## Kiểm chứng

- **pgTAP:**
  - Học viên chỉ thấy bài được giao.
  - Không ghi được attempt cho bài không được giao.
  - Phụ huynh chỉ thấy báo cáo của con.
  - Thư viện chung đọc được, nhưng học viên không ghi được.
- **Edge Function `submit-attempt`:** chấm đúng, sai, và trường hợp chiếu hết theo cách khác (test cùng bộ case với `gradeMove`).
- **E2E trên Chrome:**
  1. HLV tạo bài 3 puzzle, giao cho "Lớp Cơ bản A1".
  2. Học viên `minhan.test` làm: sai 1 lần rồi đúng.
  3. HLV xem báo cáo thấy đúng số lần thử.
- **Lint/typecheck/test/build** xanh; CI xanh.

## Kết quả (2026-10-23)

**Backend:**
- **Migration:** `20261023000002`–`04`, gồm hai bản sửa RLS do smoke test phát hiện:
  - Học viên/phụ huynh trước đó đọc được target của người khác.
  - `INSERT … RETURNING` vào `assignments` bị chặn.
- **Edge Function `submit-attempt`:** chấm lại bằng `gradeMove`, upsert `attempts` bằng service role. Client không có quyền ghi `attempts`.
- **Kiểm chứng:**
  - pgTAP `02_assignments_rls.sql`: 20/20.
  - `scripts/smoke-phase4.mjs`: 14/14.
- **Thư viện puzzle:** 13 puzzle đã kiểm bằng Arasan, seed lên cloud. Chưa đủ khoảng 30 như dự kiến — bổ sung sau.

**Lõi dùng chung:**
- `chess-core/puzzle-session.ts` là state machine thuần cho phiên làm bài: chấm ngay, đối phương tự đáp, tính giờ từng nước.
- Hook `usePuzzleSession` nằm trong `chess-core/react`.

**Gói `api`:**
- Truy vấn: `fetchPuzzles`, `fetchAssignments`, `fetchAssignment`, `createAssignment` (tự xoá bài nếu bước sau lỗi), `deleteAssignment`, `fetchAttempts`, `fetchProgress`, `submitAttempt`.
- Mỗi truy vấn có hook React tương ứng.
- Test tích hợp `phase4.integration.test.ts` chạy trên Supabase thật khi có biến môi trường, CI bỏ qua. Đã đạt: tạo bài → học viên sai rồi đúng → báo cáo 1/2 câu, 2 lần thử, 5 giây.

**Web — tab "Bài tập":**
- Danh sách bài tập.
- Tạo bài: chọn puzzle (lọc theo chủ đề, xem thử), giao lớp/học viên, đặt hạn nộp.
- Học viên làm bài: chuyển câu, đánh dấu ✓/✗, nộp mỗi lượt thử.
- Báo cáo cho HLV/phụ huynh: bảng học viên × câu, số lần thử, thời gian. HLV xoá được bài.
- Có test giao diện `PuzzleSolver.test.tsx`.

**Mobile:**
- Thẻ "Bài tập" trong màn hình học viện.
- Màn hình `assignments/[id]`: học viên làm puzzle; HLV/phụ huynh xem báo cáo rút gọn.

**Còn để sau:**
- Soạn puzzle bằng trình dựng FEN; import PGN/EPD; bộ puzzle Lichess.
- Tạo bài tập trên mobile.
- Nhắc hạn nộp qua cron + push; hàng đợi offline.
- Học viên đọc được `puzzles.moves` (cần để chấm ngay ở client). Server vẫn chấm lại nên không gian lận được kết quả, nhưng học viên xem được lời giải nếu tự gọi API — chấp nhận cho MVP.
- Chưa thử giao diện trên Chrome bằng tài khoản thật vì không tự nhập mật khẩu vào trình duyệt. Người dùng cần đăng nhập để xem trực tiếp.
