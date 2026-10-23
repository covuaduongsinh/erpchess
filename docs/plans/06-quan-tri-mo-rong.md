# Giai đoạn 5 — Quản trị mở rộng I

Mục tiêu: đóng các claim `org.levels`, `org.batches`, `org.rating`, `org.students-csv`, `org.dashboard` và `org.branding` trong [`rea/ledger.md`](../../rea/ledger.md). Đặc tả gốc: [`rea/spec/quan-tri.md`](../../rea/spec/quan-tri.md) và [`rea/spec/00-ban-do.md`](../../rea/spec/00-ban-do.md).

## Cơ sở dữ liệu

Migration mới: `20261023000005_levels_batches_rating.sql`.
- **Mở rộng `academies`:** thêm `description`, `logo_url`, `socials` (jsonb). Chính sách "owner sửa" hiện có đã đủ cho các cột này.
- **Bảng `levels`:** `academy_id`, `name`, `position`, `min_rating`, `max_rating`, `color`, `criteria` (jsonb: điều kiện lên cấp).
  - Thành viên học viện được đọc.
  - Chỉ owner được ghi.
- **Mở rộng `memberships`:** thêm `level_id`.
  - Ghi qua RPC `set_student_level`, vì chính sách UPDATE hiện tại chỉ cho owner đổi role.
  - RPC dùng `security definer`, kiểm tra người gọi là staff và người được gán là học viên của học viện.
- **Mở rộng `groups`:** thêm `kind` (`group`/`batch`), `level_id`, `schedule`.
  - `schedule` là jsonb, mảng các phần tử `{ day 0–6, start "HH:MM", minutes }`.
  - Batch là Group có `kind = 'batch'`, nhờ đó dùng lại toàn bộ RLS, `group_members` và cơ chế giao bài.
- **Bảng `ratings`:** khoá `(academy_id, student_id, category)`, `category` thuộc classical/rapid/blitz; các cột `rating`, `rd`, `vol` (Glicko-2), `games`.
  - Thành viên học viện được đọc.
  - Staff được đặt rating ban đầu.
- **RPC `academy_leaderboard(p_academy, p_from, p_to)`:** điểm = 10 × số câu giải đúng trong khoảng thời gian (theo `attempts.finished_at`), kèm số câu giải và số lượt thử. Chỉ thành viên học viện gọi được.
- **RPC `academy_stats(p_academy)`:** đếm học viên, staff, lớp, batch, bài tập, lượt nộp trong 7 ngày.
- **pgTAP:** `supabase/tests/03_levels_rating_rls.sql`.

## Mã dùng chung

- **`packages/chess-core/src/glicko2.ts`:** cập nhật rating theo Glicko-2. Test bằng ví dụ chuẩn trong bài báo của Glickman.
- **`packages/domain`:**
  - Schema cho level, lịch batch, branding.
  - `levelTemplate`: 6 cấp tự đặt tên.
  - `parseStudentsCsv` và `studentsToCsv`, có test.
- **`packages/api`:**
  - Query và hook cho levels, đặt cấp cho học viên, cập nhật nhóm/batch, ratings, leaderboard, stats, branding.
  - Sinh lại `database.types.ts`.

## Giao diện

- **Web:**
  - Tab "Cấp độ" mới.
  - Trang Lớp: chọn kiểu Lớp hoặc Batch, chọn cấp độ, sửa lịch tuần.
  - Trang Học viên: đổi cấp, đặt rating, nhập/xuất CSV.
  - Tổng quan: thẻ số liệu, bảng xếp hạng (tuần / tháng / 6 tháng), thông tin học viện (owner sửa được).
- **Mobile:** màn học viện thêm thẻ bảng xếp hạng và hiện cấp độ của học viên.

## Để sau

- Location.
- Đăng nhập thay học viên (impersonate).
- Rating FIDE.
- Tự động lên cấp theo điều kiện (cần dữ liệu quiz/ván của Giai đoạn 7 và 9).

## Kiểm chứng

- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- pgTAP chạy trên Supabase Cloud qua `to-mcp.mjs`.
- Test tích hợp `phase5.integration.test.ts`: owner tạo cấp độ, gán cấp cho học viên, học viên đọc được bảng xếp hạng.
- CI 3 job xanh.

## Kết quả (2026-10-23)

- **Đã làm:**
  - Migration áp lên Supabase Cloud.
  - Trang Cấp độ, thiết lập Batch (cấp độ, lịch tuần), đổi cấp/rating và nhập/xuất CSV ở trang Học viên.
  - Tổng quan: thẻ số liệu, bảng xếp hạng (tuần / tháng / 6 tháng), thông tin học viện.
  - Mobile: bảng xếp hạng và cấp độ của học viên.
- **Kiểm chứng:**
  - pgTAP `03_levels_rating_rls.sql`: 22/22 trên cloud.
  - `phase5.integration.test.ts` và `phase4.integration.test.ts` đạt trên cloud.
  - Unit test: Glicko-2 khớp ví dụ của Glickman; CSV, lộ trình, lịch, khoảng thời gian; truy vấn quản trị.
- **Còn mở:**
  - Tự lên cấp theo điều kiện.
  - Rating cập nhật từ ván đấu (Giai đoạn 9).
  - FIDE.
  - Trang đăng nhập/tên miền riêng.
  - Location.
