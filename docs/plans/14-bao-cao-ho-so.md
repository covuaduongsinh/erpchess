# Giai đoạn 13 — Báo cáo và hồ sơ

## Bối cảnh

- **Claim cần đóng** (`rea/ledger.md` L72-73):
  - `report.student` (hiện 🟡 một phần: chỉ có báo cáo bài tập): "Báo cáo tổng hợp theo học viên, xuất CSV".
  - `pref.profile` (hiện 🟡 một phần: có i18n vi/en và theme): "Hồ sơ, ngôn ngữ, múi giờ, ký hiệu nước đi, sáng/tối".
- **Spec liên quan:**
  - `rea/spec/quan-tri.md`:
    - Mục _Reports_: "Chọn học viên để xem báo cáo của học viên đó. Xuất CSV toàn học viện theo khoảng ngày và theo loại (lớp học, …)".
    - Mục _Preferences (hồ sơ)_: "Username, email, họ tên, đổi mật khẩu. Đồng bộ ván Chess.com/Lichess. Quốc gia, múi giờ, ngôn ngữ. Ký hiệu nước đi: biểu tượng quân hoặc chữ".
  - `rea/spec/00-ban-do.md` (L45, L47-48):
    - Lọc theo khoảng ngày (M/Q/Y).
    - Múi giờ theo hồ sơ người dùng. Ký hiệu nước đi chọn được dạng hình quân (figurine) hoặc dạng chữ (letters).
    - Ngôn ngữ giao diện chọn được.
- **Có sẵn để dùng lại:**
  - Bảng `profiles` (đã có `id`, `display_name`, `username`, `avatar_url`, `locale`).
  - Gói `packages/domain/src/csv.ts` (đã có `toCsv`, `parseCsv` chuẩn RFC 4180).
  - Gói `packages/i18n` (đã có `vi`, `en`, `languages`, hook và state).
  - Phân quyền RLS: hàm helper `private.has_role`, `private.is_member`, `private.is_parent_of`, `private.can_see_student`.
  - Dữ liệu học viên đã có từ các giai đoạn trước:
    - Bài tập: `assignments`, `assignment_targets`, `assignment_items`, `attempts`.
    - Quiz: `quizzes`, `quiz_targets`, `quiz_items`, `quiz_attempts`.
    - Lớp học: `classrooms`, `classroom_students`, `classroom_attendance` (trạng thái: `present`, `late`, `absent`).
    - Ván đấu: `games` (`white_id`, `black_id`, `result`, `speed`, `rated`, `pgn`), bảng xếp hạng `ratings`.
    - Giải đấu: `tournaments`, `tournament_players` (điểm, hạng, tiebreak), `pairings`.
  - Khung giao diện: `MoveList.tsx` (hiện nước cờ SAN), `Shell.tsx` (header chung), layout `/a/$slug`.
- **Chia 2 PR:**
  - **PR 13a — Hồ sơ cá nhân và tuỳ chọn người dùng:** múi giờ, ký hiệu nước đi (letters / figurine), ngôn ngữ, đổi mật khẩu; áp dụng ký hiệu nước đi lên bàn cờ, danh sách nước đi và ván đấu. Đóng `pref.profile` ✅.
  - **PR 13b — Báo cáo theo học viên và xuất CSV:** gom toàn diện bài tập, quiz, lớp học, ván đấu, giải đấu; bộ lọc khoảng ngày (M/Q/Y); xem theo từng học viên hoặc toàn học viện; xuất CSV; học viên và phụ huynh xem báo cáo cá nhân. Đóng `report.student` ✅.

---

## PR 13a — Hồ sơ cá nhân và tuỳ chọn người dùng

1. **Lõi cờ và Domain (`packages/chess-core`, `packages/domain`):**
   - `packages/chess-core/src/notation.ts` (kèm test `notation.test.ts`):
     - Định nghĩa `type MoveNotation = 'letters' | 'figurine'`.
     - Ký hiệu figurine chuẩn Unicode:
       - Vua `K` → `♔`, Hậu `Q` → `♕`, Xe `R` → `♖`, Tượng `B` → `♗`, Mã `N` → `♘`.
       - Phong cấp tốt (ví dụ `=Q` → `=♕`, `=R` → `=♖`, `=B` → `=♗`, `=N` → `=♘`). - Hàm `formatSan(san: string, notation: MoveNotation): string`. - Hàm `formatSanList(sans: string[], notation: MoveNotation): string[]`.
   - `packages/domain/src/profile.ts` (kèm test `profile.test.ts`):
     - Schema Zod `updateProfileSchema`: `display_name`, `username`, `locale` (`'vi' | 'en'`), `timezone`, `move_notation` (`'letters' | 'figurine'`), `country`, `bio`.
     - Danh sách múi giờ chuẩn IANA thường dùng (`COMMON_TIMEZONES`), ưu tiên `Asia/Ho_Chi_Minh` (mặc định), `UTC`, `America/New_York`, `Europe/London`, `Asia/Tokyo`...
2. **Migration `supabase/migrations/20261026000024_profiles_preferences.sql`:**
   - Mở rộng bảng `profiles`:
     - `timezone text not null default 'Asia/Ho_Chi_Minh'`
     - `move_notation text not null default 'letters' check (move_notation in ('letters', 'figurine'))`
     - `country text null`
     - `bio text null`
   - Đảm bảo policy RLS: người dùng được `SELECT` mọi profile của thành viên cùng học viện (đã có), và chỉ được `UPDATE` chính profile của mình (`id = auth.uid()`).
3. **API (`packages/api`):**
   - `packages/api/src/profile.ts`: hàm `getMyProfile()`, `updateMyProfile(patch)`.
   - Hook React Query `useProfile(userId)` và `useUpdateProfile()` trong `packages/api/src/react.tsx`.
   - Tự động đồng bộ `locale` của profile khi người dùng đổi ngôn ngữ trên giao diện, và áp dụng `locale` từ profile khi đăng nhập.
4. **Web UI (`apps/web`):**
   - Route mới `/profile` (`apps/web/src/routes/profile.tsx`):
     - Thông tin tài khoản: Họ tên, Username, Email (chỉ đọc), Đổi mật khẩu (`supabase.auth.updateUser({ password })`).
     - Tuỳ chọn cá nhân:
       - Ngôn ngữ: Tiếng Việt / English (chuyển ngôn ngữ ngay và lưu DB).
       - Múi giờ: Chọn từ danh sách múi giờ, hiển thị đồng hồ mẫu theo múi giờ đang chọn.
       - Ký hiệu nước đi: Xem trước bàn/dòng nước mẫu giữa Dạng chữ (`1. e4 e5 2. Nf3 Nc6`) và Dạng biểu tượng (`1. e4 e5 2. ♘f3 ♞c6`).
       - Giao diện: Chuyển đổi giao diện Sáng / Tối.
   - Thêm nút / menu "Hồ sơ" trên thanh điều hướng đầu trang `Shell.tsx` (cạnh chuông thông báo).
   - Tích hợp ký hiệu nước đi `move_notation` vào:
     - `apps/web/src/components/analysis/MoveList.tsx` (bàn phân tích, trình xem ván, study).
     - `apps/web/src/components/analysis/EngineLines.tsx` (dòng gợi ý PV của Arasan).
     - Màn chơi ván cờ `/play` và giải đấu `/tournaments`.
5. **Mobile UI (`apps/mobile`):**
   - Màn hình Cài đặt / Hồ sơ (`apps/mobile/src/app/profile.tsx`):
     - Xem họ tên, username.
     - Đổi ngôn ngữ, múi giờ, ký hiệu nước đi.
     - Nút đăng xuất.
6. **Kiểm thử:**
   - Unit test `notation.test.ts` (đổi đúng mọi dạng nước đi, phong cấp, chiếu/chiếu hết, nước tốt không bị gắn nhầm hình quân).
   - Unit test `profile.test.ts` (validate schema tuỳ chọn).
   - pgTAP `supabase/tests/17_profiles_preferences_rls.sql` (chỉ user sửa được profile của mình, giá trị check constraint không cho nhập notation sai).
   - Test tích hợp `phase13_profile.integration.test.ts` (cập nhật timezone, move_notation thành công).

---

## PR 13b — Báo cáo theo học viên và xuất CSV

1. **Domain (`packages/domain`):**
   - `packages/domain/src/reports.ts` (kèm test `reports.test.ts`):
     - Kiểu dữ liệu `StudentReportSummary`:
       - Bài tập: tổng giao, đã hoàn thành, điểm trung bình, thời gian trung bình.
       - Quiz: tổng giao, đã nộp, điểm trung bình, thời gian trung bình.
       - Lớp học: tổng số buổi, có mặt (`present`), đi muộn (`late`), vắng mặt (`absent`), tỉ lệ chuyên cần (%).
       - Ván cờ: tổng ván, thắng, hoà, thua (theo blitz/rapid/classical), rating hiện tại.
       - Giải đấu: số giải tham gia, tổng ván trong giải, tổng điểm, thứ hạng cao nhất. - Hàm `studentDetailedReportToCsv(studentInfo, summary, details)`: xuất báo cáo cá nhân học viên sang định dạng CSV (gồm các phần: Thông tin học viên, Tổng quan, Lịch sử bài tập, Lịch sử quiz, Chuyên cần lớp học, Lịch sử ván đấu, Thành tích giải đấu), có UTF-8 BOM để Excel hiển thị tiếng Việt chuẩn. - Hàm `academyStudentsReportToCsv(studentsSummaryList)`: xuất bảng số liệu toàn bộ học viên của học viện ra file CSV (Tên, Username, Lớp/Batch, Cấp độ, Rating Blitz/Rapid/Classical, Bài tập hoàn thành/giao, Điểm TB Quiz, Tỉ lệ chuyên cần, Ván đấu W/D/L).
2. **Migration `supabase/migrations/20261026000025_student_reports.sql`:**
   - RPC SECURITY DEFINER:
     - `get_student_report_summary(p_academy_id uuid, p_student_id uuid, p_from timestamptz default null, p_to timestamptz default null)`:
       - Kiểm tra quyền: caller phải là staff của học viện (`private.has_role(..., 'owner')` hoặc `coach`), hoặc chính học viên đó, hoặc phụ huynh của học viên đó (`private.is_parent_of`).
       - Tổng hợp dữ liệu từ `assignments`/`attempts`, `quizzes`/`quiz_attempts`, `classrooms`/`classroom_attendance`, `games`, `tournaments`/`tournament_players`. - `get_student_report_details(p_academy_id uuid, p_student_id uuid, p_from timestamptz default null, p_to timestamptz default null)`:
       - Trả về danh sách chi tiết các dòng bài tập, quiz, buổi học kèm chuyên cần, ván cờ, giải đấu trong khoảng ngày. - `get_academy_students_report(p_academy_id uuid, p_from timestamptz default null, p_to timestamptz default null)`:
       - Chỉ cho phép staff (owner/coach).
       - Trả về danh sách học viên kèm các chỉ số tóm tắt phục vụ xem danh sách và xuất CSV toàn học viện.
3. **API (`packages/api`):**
   - `packages/api/src/reports.ts`:
     - `getStudentReportSummary(academyId, studentId, options)`
     - `getStudentReportDetails(academyId, studentId, options)`
     - `getAcademyStudentsReport(academyId, options)`
   - Hook React Query trong `packages/api/src/react.tsx`: `useStudentReportSummary`, `useStudentReportDetails`, `useAcademyStudentsReport`.
4. **Web UI (`apps/web`):**
   - Thêm tab "Báo cáo" trong layout học viện `/a/$slug/reports` (`apps/web/src/routes/a.$slug.reports.tsx`):
     - Hiển thị cho cả Staff (quản lý) và Học viên / Phụ huynh (xem cá nhân).
     - **Góc nhìn Staff (Owner / Coach):**
       - Thanh bộ lọc:
         - Dropdown chọn học viên (hoặc chọn "Tất cả học viên" để xem báo cáo tổng hợp).
         - Bộ lọc khoảng ngày nhanh: Tháng này (M), Quý này (Q), Năm nay (Y), Toàn thời gian (All), hoặc tuỳ chọn từ ngày - đến ngày.
         - Nút "Xuất CSV": tải file `.csv` về máy. - Chế độ 1 học viên:
         - Thẻ KPI tổng quan: % Bài tập, Điểm Quiz, Chuyên cần, Kết quả thi đấu & Rating.
         - 5 tab chi tiết:
           1. Bài tập: tên bài, hạn nộp, trạng thái giải, số lần thử, thời gian.
           2. Quiz: tên quiz, ngày làm, điểm đạt, tổng điểm, thời gian.
           3. Chuyên cần: buổi học, ngày giờ, HLV, trạng thái (Có mặt / Muộn / Vắng), ghi chú.
           4. Ván đấu: ngày, đối thủ, màu quân, kết quả, thể loại, link xem lại ván.
           5. Giải đấu: tên giải, thể thức, ngày, số điểm, thứ hạng. - Chế độ Tất cả học viên: - Bảng tổng hợp số liệu của tất cả học viên trong học viện, có tìm kiếm theo tên/username, sắp xếp theo chuyên cần, điểm quiz, bài tập. - Bấm vào tên học viên sẽ chuyển ngay sang xem chi tiết học viên đó. - **Góc nhìn Học viên / Phụ huynh:** - Học viên xem báo cáo cá nhân của chính mình. - Phụ huynh xem báo cáo của con em mình (chọn con nếu có nhiều học viên liên kết). - Nút "Xuất CSV" tải báo cáo cá nhân về máy.
5. **Mobile UI (`apps/mobile`):**
   - Màn hình "Báo cáo tiến độ" (`apps/mobile/src/app/academies/[slug]/report.tsx`):
     - Học viên / phụ huynh xem các thẻ chỉ số tóm tắt: Bài tập hoàn thành, Điểm quiz, Tỉ lệ chuyên cần lớp học, Kết quả thi đấu.
6. **Kiểm thử:**
   - Unit test `reports.test.ts`: kiểm tra tính toán chỉ số, sinh chuỗi CSV có BOM, format ngày giờ theo múi giờ.
   - pgTAP `supabase/tests/18_student_reports_rls.sql`:
     - Học viên chỉ đọc được báo cáo của chính mình, không đọc được học viên khác.
     - Phụ huynh đọc được báo cáo của con.
     - Coach và Owner đọc được báo cáo học viên trong học viện của mình, không đọc được học viện khác.
     - Chỉ staff mới gọi được `get_academy_students_report`.
   - Test tích hợp `phase13_reports.integration.test.ts`: gọi RPC lấy báo cáo của học viên test, kiểm tra đầy đủ các mảng dữ liệu.
   - Kiểm tra giao diện qua Chrome trên học viện DSC1 (chỉ đọc): xem báo cáo, thử nút lọc M/Q/Y, tải thử file CSV.

---

## Kiểm chứng

- **Mỗi PR:**
  - `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm sync-shared --check`.
  - Áp migration qua MCP `apply_migration`, sinh lại types bằng `generate_typescript_types` vào `packages/api/src/database.types.ts`, format Biome.
  - Chạy `get_advisors` để đảm bảo bảo mật.
  - Chạy pgTAP test qua `to-mcp.mjs` + `execute_sql`.
  - Chạy test tích hợp bằng Vitest: `npx vitest run packages/api/src/phase13_*.integration.test.ts`.
  - CI GitHub Actions 3 job xanh (lint/typecheck, test, build).
  - Quét bí mật trước khi push; không commit `.env.local`.
- **Cuối giai đoạn:**
  - Cập nhật `rea/ledger.md`: đóng `pref.profile` ✅ và `report.student` ✅.
  - Cập nhật mục "Kết quả" trong file kế hoạch này.

---

## Rủi ro và ghi chú

- **Không chứa câu lệnh `DELETE` trong migration:** tuân thủ quy tắc MCP, không viết hàm hay migration có `DELETE`/`DROP`.
- **Mã ký hiệu nước đi figurine:** cờ vua có 5 quân có ký hiệu viết hoa (`K`, `Q`, `R`, `B`, `N`). Khi chuyển sang figurine:
  - Nước đi tốt không có chữ cái đầu (ví dụ `e4`, `exd5`), chỉ phong cấp mới có dạng `=Q`, `=R`, `=B`, `=N`.
  - Cần regex cẩn thận để không thay thế chữ cái trong phần toạ độ hay dấu thăng `#`, dấu `+`.
- **Xuất CSV tiếng Việt:** cần thêm ký tự UTF-8 BOM (`\uFEFF`) ở đầu file CSV để Excel mở trực tiếp trên Windows không bị lỗi font tiếng Việt.
- **Dữ liệu lớn khi xuất toàn học viện:** RPC trả về dữ liệu đã tổng hợp (aggregate) thay vì trả về toàn bộ hàng thô, đảm bảo tốc độ cao và nhẹ mạng.

---

## Kết quả

_(Sẽ cập nhật sau khi hoàn thành từng PR)_
