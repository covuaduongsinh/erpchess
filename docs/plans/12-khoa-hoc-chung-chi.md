# Giai đoạn 11 — Khoá học và chứng chỉ

## Bối cảnh

- **Claim cần đóng** trong `rea/ledger.md`: `course.core` (khoá học gồm các Study theo cấp độ) và `course.cert` (chứng chỉ có mã xác minh công khai). Kế hoạch tổng `docs/plans/00-ke-hoach-tong.md` L210-213: khoá học gồm Study theo cấp độ, theo dõi tiến độ, **XP, chuỗi ngày học**; chứng chỉ xác minh công khai tại `apps/site/verify/[code]`. Spec quản trị (`rea/spec/quan-tri.md` L31) có điều kiện lên cấp theo XP.
- **Đã có để dùng lại:**
  - `studies`, `study_activities`, `activity_attempts` (chỉ service role ghi qua `submit-activity`), view `study_progress` (tổng hoạt động / đã giải / điểm theo học viên × học liệu), `study_collections` (danh sách có thứ tự).
  - API `packages/api/src/studies.ts` (`fetchStudies`, `fetchStudyProgress`), hook `useStudyProgress`; trang học `a.$slug.studies.$id.index.tsx`.
  - `levels` (có `criteria jsonb` ví dụ `{ "xp": 500 }` nhưng chưa ai đánh giá), `TargetPicker`, mẫu "giao cho lớp/học viên" như `quiz_targets`.
  - `apps/site`: Next.js 16 App Router, chỉ có landing; chưa phụ thuộc Supabase.
- **Chưa có:** XP, chuỗi ngày, khoá học, chứng chỉ, công cụ PDF/QR, và **không có đường đọc công khai** (mọi policy đều `to authenticated`).
- **Quyết định thiết kế:**
  - XP ghi bằng **trigger CSDL** trên các bảng kết quả (học liệu, bài tập, quiz) khi một câu chuyển sang "đã giải" lần đầu → không thể cộng trùng, không cần sửa Edge Function.
  - Chuỗi ngày tính theo **giờ Việt Nam** từ các ngày có XP.
  - Trang xác minh dùng **một RPC `verify_certificate(code)` cho `anon`**, chỉ trả đúng vài trường cần hiển thị (tên học viên, khoá, học viện, ngày cấp, đã thu hồi chưa) — không mở bảng nào cho người lạ.
  - Chứng chỉ in/lưu PDF bằng trang HTML có `@media print` (không thêm thư viện PDF); mã QR dùng gói `qrcode` (MIT).

Kế hoạch con ghi vào `docs/plans/12-khoa-hoc-chung-chi.md`. Chia 2 PR, mỗi PR đủ quy trình commit → CI xanh → merge.

## PR 11a — Khoá học, tiến độ, XP và chuỗi ngày học

1. **Migration `…0019_courses_xp.sql`:**
   - `courses(id, academy_id, title, description, level_id?, open_to_all, auto_certificate, status draft|published, created_by, created_at)`; `course_items(course_id, position, study_id, required)`; `course_targets(course_id, group_id | student_id)`; `course_completions(course_id, student_id, completed_at)`.
   - `xp_events(id, academy_id, student_id, source activity|homework|quiz|course, source_id, points, day date, created_at)`, **unique `(student_id, source, source_id)`**.
   - Trigger trên `activity_attempts`, `attempts` (bài tập), `quiz_attempts`: lần đầu `solved` → thêm `xp_events` (điểm = điểm câu; bài tập 10/câu), ngày theo `Asia/Ho_Chi_Minh`.
   - Trigger hoàn thành khoá: khi một học liệu của học viên đủ hết hoạt động, kiểm các khoá chứa học liệu đó; mọi học liệu `required` xong → ghi `course_completions` + thưởng XP `course` (100).
   - RPC `student_xp(p_academy, p_student?)` → tổng XP, XP hôm nay, chuỗi hiện tại, chuỗi dài nhất, XP tới cấp kế (đọc `levels.criteria.xp`); `xp_leaderboard(p_academy, p_from, p_to)`.
   - View `course_progress` (security_invoker): theo khoá × học viên — số học liệu bắt buộc / đã xong / phần trăm.
   - **RLS:** staff soạn và giao; học viên đọc khoá đã xuất bản được giao (hoặc `open_to_all`); `xp_events`/`course_completions` chỉ trigger ghi; học viên/phụ huynh/staff đọc như các bảng kết quả khác.
2. **Domain + API:** `domain/course.ts` (schema tạo khoá, `streakFrom(days, today)` có test); `api/courses.ts` + hook (danh sách, chi tiết kèm tiến độ, tạo/sửa/sắp xếp học liệu, giao, XP của tôi, bảng XP).
3. **Web:**
   - Tab "Khoá học" `/a/$slug/courses`: danh sách (HLV thấy cả bản nháp), tạo khoá.
   - `/courses/$id`: HLV thêm/sắp xếp học liệu (chọn từ học liệu học viện + thư viện chung, lọc theo cấp độ), đánh dấu bắt buộc, giao học viên/lớp (`TargetPicker`), xuất bản, bảng tiến độ học viên × học liệu. Học viên thấy lộ trình, % hoàn thành, nút "Học tiếp" tới học liệu chưa xong.
   - Tổng quan: thẻ "XP & chuỗi ngày" (XP hôm nay, tổng, chuỗi 🔥, tiến tới cấp kế); bảng xếp hạng thêm chế độ XP.
4. **Mobile:** thẻ "Khoá học" (sau `StudiesCard`) và XP/chuỗi ngày ở màn học viện.
5. **Kiểm thử:** domain test (`streakFrom`); pgTAP `12_courses_xp_rls.sql` (trigger XP không cộng trùng, hoàn thành khoá, RLS); test tích hợp: học viên thử giải hoạt động qua `submit-activity` → XP tăng đúng một lần, khoá hoàn thành.

## PR 11b — Chứng chỉ và trang xác minh công khai

1. **Migration `…0020_certificates.sql`:**
   - `certificates(id, code unique, academy_id, student_id, course_id?, title, student_name, academy_name, issued_at, issued_by?, revoked_at?)` — tên lưu bản chụp lúc cấp. `code` 10 ký tự base32 ngẫu nhiên (`gen_random_bytes`).
   - Tự cấp khi hoàn thành khoá có `auto_certificate`; staff cấp tay (kể cả không gắn khoá) và thu hồi.
   - RLS: học viên/phụ huynh/staff đọc; staff ghi.
   - RPC `verify_certificate(p_code)` `security definer`, **grant cho `anon`**, chỉ trả các trường hiển thị.
2. **Web:** trang chứng chỉ `/a/$slug/certificates/$id` thiết kế theo nhận diện Dương Sinh (navy `#2B3990`, Roboto, hoạ tiết bàn cờ, logo học viện), mã QR trỏ tới trang xác minh, nút "In / Lưu PDF" (`window.print` + `@media print` khổ A4 ngang); danh sách chứng chỉ trong khoá và hồ sơ học viên; nút cấp tay / thu hồi cho staff.
3. **`apps/site`:** `verify/page.tsx` (ô nhập mã) và `verify/[code]/page.tsx` (server component gọi RPC qua REST bằng khoá publishable, không giữ phiên): hợp lệ / đã thu hồi / không tồn tại; `metadata` không cho lập chỉ mục. Biến môi trường `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_KEY`, `NEXT_PUBLIC_SITE_URL` (cho QR) — thêm vào `.env.example`.
4. **Mobile:** danh sách chứng chỉ của tôi, mở link xác minh.
5. **Kiểm thử:** pgTAP `13_certificates_rls.sql` (anon chỉ gọi được RPC, không đọc bảng; thu hồi); test tích hợp (hoàn thành khoá → có chứng chỉ; gọi RPC bằng client chưa đăng nhập); Chrome: in chứng chỉ, mở trang xác minh trên `apps/site` chạy local.

## Kiểm chứng

- Mỗi PR: `pnpm lint`, `typecheck`, `test`, `build` (gồm `apps/site`), `sync-shared --check`; CI 3 job xanh.
- pgTAP qua `to-mcp.mjs` + `execute_sql`; test tích hợp với tài khoản thử trong `it.env`.
- Chrome ở localhost (DSC1, chỉ có owner): tạo "Khoá mẫu (Claude)" từ "Học liệu mẫu (Claude)", xem tiến độ, XP; cấp tay một chứng chỉ thử cho owner, in thử và xác minh trên site local; báo lại dữ liệu thử.
- Cuối giai đoạn: cập nhật `rea/ledger.md` và mục "Kết quả" trong `docs/plans/12-khoa-hoc-chung-chi.md`.

## Rủi ro và ghi chú

- **XP từ dữ liệu cũ:** trigger chỉ tính từ khi triển khai; có thể chạy một lần lệnh bù cho kết quả đã có (ghi vào `xp_events` với cùng khoá duy nhất) — làm trong migration.
- **Trang xác minh công khai:** chỉ lộ tên học viên + khoá + học viện + ngày cấp khi biết đúng mã 10 ký tự (~50 bit); không có API liệt kê.
- **Tên trên chứng chỉ** là bản chụp lúc cấp; đổi tên sau này không làm đổi chứng chỉ đã cấp (cấp lại nếu cần).

## Kết quả

### PR 11a (2026-10-24)

- **Migration `…0019_courses_xp.sql`:** `courses`, `course_items` (thứ tự, bắt buộc/tự chọn), `course_targets`, `course_completions`, `xp_events` (khoá duy nhất `student, source, source_id`); trigger XP trên `activity_attempts` / `attempts` / `quiz_attempts` khi lần đầu đã giải; hoàn thành khoá (mọi học liệu bắt buộc xong, học viên được học khoá) + 100 XP; RPC `recheck_course`, `student_xp` (tổng, hôm nay, các ngày có XP, cấp kế theo `levels.criteria.xp`), `xp_leaderboard`; view `course_progress`; bù XP cho kết quả đã có. XP tính theo học viên (học liệu thư viện chung không thuộc học viện nào).
- **Domain `course.ts`:** `courseInputSchema`, `streakFrom` (giữ chuỗi tới hôm qua nếu hôm nay chưa học), `vnToday` — có test.
- **API `courses.ts`** + hook; **web:** tab "Khoá học" (danh sách, % hoàn thành của học viên, tạo khoá), trang khoá (HLV: cấp độ, mở cho tất cả, tự cấp chứng chỉ, xuất bản, lộ trình thêm/sắp xếp/bắt buộc từ học liệu học viện/thư viện/của tôi lọc theo cấp, giao học viên/lớp, bảng tiến độ học viên × học liệu; học viên: thanh tiến độ, "Học tiếp"), thẻ "XP & chuỗi ngày học" (học viên) / "Bảng XP" (staff) ở tổng quan.
- **Mobile:** thẻ "Khoá học" và thẻ XP.
- **Kiểm chứng:** domain 63 test; pgTAP `12_courses_xp_rls.sql` 15/15; `phase11.integration.test.ts` đạt trên cloud (giải 2 câu qua `submit-activity` → +10 rồi +10+100, nộp lại không cộng thêm, khoá hoàn thành, tiến độ 1/1); Chrome: tạo "Khoá mẫu (Claude)" từ "Học liệu mẫu (Claude)", lưu lộ trình, xuất bản; thẻ Bảng XP hiện đúng.

### PR 11b (2026-10-24)

- **Migration `…0020_certificates.sql`:** `certificates` (mã 10 ký tự base32 bỏ 0/1/I/O ~50 bit, tên học viên/học viện chụp lúc cấp, `revoked_at`; mỗi khoá chỉ một chứng chỉ còn hiệu lực/học viên). Không có policy ghi — chỉ qua trigger tự cấp khi hoàn thành khoá bật `auto_certificate` và RPC `issue_certificate` / `revoke_certificate` (staff). Không có đường xoá, để mã đã phát luôn xác minh được. `verify_certificate(code)` cho `anon` chỉ trả các trường in trên chứng chỉ (chấp nhận chữ thường, gạch nối). Đọc: học viên, phụ huynh, staff cùng học viện. Bù chứng chỉ cho khoá đã hoàn thành.
- **API `certificates.ts`** + hook; **web:** tab "Chứng chỉ" (danh sách, cấp tay cho học viên), trang chứng chỉ in A4 ngang theo nhận diện Dương Sinh (navy, Roboto, hoạ tiết ô cờ, mã QR qua gói `qrcode` MIT, `@media print` chỉ in khung chứng chỉ), thu hồi; trang khoá: học viên có nút "Xem chứng chỉ", bảng tiến độ có 🎓 / "Cấp chứng chỉ".
- **`apps/site`:** `/verify` (ô nhập mã) và `/verify/[code]` (server component gọi REST RPC bằng khoá publishable, `noindex`): hợp lệ / đã thu hồi / không tồn tại / chưa cấu hình. `agentRules: false` để Next không sinh `AGENTS.md`.
- **Mobile:** thẻ chứng chỉ của tôi, chạm mở trang xác minh. Env mới: `VITE_SITE_URL`, `EXPO_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_KEY` (đã thêm vào `.env.example`).
- **Kiểm chứng:** pgTAP `13_certificates_rls.sql` 15/15 (`to-mcp.mjs` cấp thêm quyền `anon` cho bảng tạm); `phase11.integration.test.ts` mở rộng: tự cấp sau khi hoàn thành khoá, client chưa đăng nhập xác minh được, học viên không tự cấp, không cấp trùng, cấp tay, thu hồi hiện trên xác minh — đạt. Chrome: trang xác minh (thu hồi, không tồn tại, hợp lệ), tab Chứng chỉ, bản in chứng chỉ (chứng chỉ mẫu "(Claude)" chèn tạm bằng SQL cho owner DSC1 rồi đã xoá). Chứng chỉ thử của học viên thử bị thu hồi chứ không xoá (theo thiết kế).
